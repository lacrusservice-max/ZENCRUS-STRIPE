// Intercepta la creación de elementos de React para reescribir el color de todo
// lo que se renderiza cuando el tema claro está activo.
//
// Por qué aquí y no en cada pantalla: los colores de la app viven dentro de
// StyleSheet.create a nivel de módulo (1900+ literales en 67 archivos), que se
// evalúa al importar y no puede leer un hook. Este es el único punto por el que
// pasa absolutamente todo lo que se renderiza, así que un solo interceptor
// cubre la app completa — incluidas las pantallas que se escriban después.
//
// Se parchean las TRES puertas de entrada, porque con React 19 + el transform
// automático de babel-preset-expo el JSX compilado NO llama a createElement:
//   · react/jsx-dev-runtime → jsxDEV   (builds de desarrollo — Metro)
//   · react/jsx-runtime     → jsx/jsxs (builds de producción)
//   · React.createElement              (llamadas manuales y librerías antiguas)
//
// Coste en tema oscuro: una comparación booleana por elemento y nada más.

import React from 'react'
import { remap, isSolidStrong, isNearWhite, KEEP_WHITE } from './remap'

// ── Estado del tema (fuera de React, lo lee el interceptor) ───────────────────

let LIGHT = false
let warned = false

export function setLightMode(on: boolean) { LIGHT = on }

// ── Props que transportan color ───────────────────────────────────────────────

/** Claves de estilo cuyo valor es un color. */
const STYLE_COLOR_KEYS = new Set([
  'color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor',
  'borderBottomColor', 'borderLeftColor', 'borderStartColor', 'borderEndColor',
  'shadowColor', 'tintColor', 'textDecorationColor', 'textShadowColor',
  'overlayColor', 'placeholderTextColor', 'underlayColor', 'selectionColor',
])

/** Props de color a nivel de elemento (Ionicons, Svg, ActivityIndicator…). */
const PROP_COLOR_KEYS = new Set([
  'color', 'fill', 'stroke', 'stopColor', 'tintColor', 'placeholderTextColor',
  'underlayColor', 'selectionColor', 'backgroundColor', 'borderColor',
  'thumbColor', 'shadowColor', 'cursorColor',
])

/** Props que son un array de colores (LinearGradient). */
const PROP_COLOR_ARRAY_KEYS = new Set(['colors'])

/**
 * Props cuyo blanco siempre se conserva.
 *
 * La perilla de un Switch va sobre una pista de color, no sobre el fondo de la
 * pantalla, así que invertirla la dejaría negra sobre azul.
 */
const KEEP_WHITE_PROPS = new Set(['thumbColor'])

// Props originales de cada elemento remapeado, para poder revertir el cambio en
// los hijos de un botón sólido (blanco sobre azul sigue blanco).
//
// La clave es el objeto de props RECIÉN creado, no el elemento: React congela
// elemento y props al construirlos, y en Hermes registrar un objeto congelado
// en un WeakMap lanza "cannot add a new property". El objeto de props todavía
// no está congelado en el momento del registro, así que aquí sí es seguro.
const ORIG_PROPS = new WeakMap<object, any>()

// ── Remapeo de estilos ────────────────────────────────────────────────────────

// Caché de estilos ya convertidos.
//
// Es un Map y no un WeakMap a propósito: en desarrollo StyleSheet.create congela
// cada objeto de estilo, y Hermes implementa WeakMap colgando una propiedad
// oculta de la clave, así que registrar un objeto congelado lanza
// "cannot add a new property". Map sí es una tabla hash real y no toca la clave.
//
// Solo se cachean los objetos congelados —los de StyleSheet.create, que son
// singletons de módulo y por tanto un conjunto finito—. Los estilos en línea se
// crean nuevos en cada render, así que cachearlos sería una fuga de memoria.
const styleCache = new Map<object, any>()

/** Objetos de estilo que ya son resultado de una conversión (ver `produced`). */
const producedStyles = new WeakSet<object>()

function remapStyleObject(style: any): any {
  if (!style || typeof style !== 'object') return style
  if (producedStyles.has(style)) return style

  const cacheable = Object.isFrozen(style)
  if (cacheable) {
    const cached = styleCache.get(style)
    if (cached !== undefined) return cached
  }

  let out: any = style
  let changed = false
  for (const k in style) {
    if (!STYLE_COLOR_KEYS.has(k)) continue
    const v = style[k]
    if (typeof v !== 'string') continue
    const nv = remap(v)
    if (nv !== v) {
      if (!changed) { out = { ...style }; changed = true }
      out[k] = nv
    }
  }

  // Se registra antes de que React lo congele, para que un reenvío posterior del
  // mismo objeto no lo vuelva a convertir.
  if (changed) producedStyles.add(out)
  if (cacheable) styleCache.set(style, out)
  return out
}

function remapStyle(style: any): any {
  if (!style) return style
  if (Array.isArray(style)) {
    let changed = false
    const arr = style.map(s => {
      const n = remapStyle(s)
      if (n !== s) changed = true
      return n
    })
    return changed ? arr : style
  }
  if (typeof style === 'object') return remapStyleObject(style)
  return style
}

/** Detecta si el elemento pinta un fondo sólido fuerte (botón de acción). */
function hasSolidStrongBg(props: any): boolean {
  if (!props) return false
  // Degradado de marca: LinearGradient pinta el fondo con `colors`, no con
  // backgroundColor, y así es como está hecha buena parte de los CTA.
  if (Array.isArray(props.colors) && props.colors.some((c: any) => typeof c === 'string' && isSolidStrong(c))) {
    return true
  }
  return styleHasSolidStrongBg(props.style)
}

function styleHasSolidStrongBg(style: any): boolean {
  if (!style) return false
  if (Array.isArray(style)) return style.some(styleHasSolidStrongBg)
  if (typeof style !== 'object') return false
  const bg = style.backgroundColor
  return typeof bg === 'string' && isSolidStrong(bg)
}

/** Capa de estilo que fuerza primer plano blanco y que el interceptor ignora. */
const WHITE_OVERLAY = { color: KEEP_WHITE }
producedStyles.add(WHITE_OVERLAY)

// Fábrica sin envolver, capturada antes de instalar el parche.
let rawFactory: ((type: any, props: any, key?: any, isStatic?: boolean) => any) | null = null

/**
 * Reconstruye un elemento con props modificadas.
 *
 * No usa `cloneElement` porque este revalida las claves de los hijos: al
 * reemplazar un array de `children` React lo trata como lista dinámica y avisa
 * de que "cada hijo necesita una key", aunque los hijos sean estáticos. La
 * fábrica original con `isStaticChildren` no hace esa comprobación.
 */
function rebuild(node: any, patch: any): any {
  const props = { ...node.props, ...patch }
  if (!rawFactory) return React.cloneElement(node, patch)

  // `isStaticChildren` solo es válido cuando los hijos vienen en array; con un
  // hijo único React avisa de lo contrario.
  const isStatic = Array.isArray(props.children)
  const out = rawFactory(node.type, props, node.key ?? undefined, isStatic)

  // El elemento nuevo nace sin validar. Si estaba dentro de un array, React lo
  // toma por un hijo de lista sin `key` y avisa, aunque el original —ya
  // validado— fuese estático. Se hereda esa marca del elemento de origen.
  try {
    if (node._store && out?._store) out._store.validated = node._store.validated
  } catch { /* la marca solo existe en desarrollo */ }

  return out
}

/**
 * Dentro de un botón sólido, el primer plano blanco debe seguir blanco.
 *
 * No basta con devolverle al hijo su color original: ese elemento vuelve a
 * pasar por el interceptor cuando reenvía su estilo al nodo nativo, y el `#fff`
 * restaurado se convertiría en tinta otra vez. Por eso se aplica KEEP_WHITE,
 * que está marcado como resultado final y sobrevive a cualquier pasada.
 */
function restoreForeground(node: any): any {
  if (Array.isArray(node)) {
    let changed = false
    const arr = node.map(n => {
      const r = restoreForeground(n)
      if (r !== n) changed = true
      return r
    })
    return changed ? arr : node
  }
  if (!React.isValidElement(node)) return node

  const props: any = node.props
  if (!props) return node
  // Si las props se reescribieron, el blanco original está en ORIG_PROPS; si no,
  // sigue en las props actuales.
  const orig = ORIG_PROPS.get(props) ?? props
  const patch: any = {}
  let changed = false

  for (const k of PROP_COLOR_KEYS) {
    if (typeof orig[k] === 'string' && isNearWhite(orig[k])) {
      patch[k] = KEEP_WHITE
      changed = true
    }
  }

  if (whiteForeground(orig.style)) {
    patch.style = [props.style, WHITE_OVERLAY]
    changed = true
  }

  if (props.children) {
    const kids = restoreForeground(props.children)
    if (kids !== props.children) { patch.children = kids; changed = true }
  }

  return changed ? rebuild(node, patch) : node
}

function whiteForeground(style: any): boolean {
  if (!style) return false
  if (Array.isArray(style)) return style.some(whiteForeground)
  if (typeof style !== 'object') return false
  return typeof style.color === 'string' && isNearWhite(style.color)
}

// ── Reescritura de props ──────────────────────────────────────────────────────

/** Devuelve props nuevas con el color convertido, o las mismas si no cambia nada. */
function remapProps(props: any): any {
  let next: any = null
  const set = (k: string, v: any) => {
    if (!next) next = { ...props }
    next[k] = v
  }

  // Estilos
  if (props.style) {
    const s = remapStyle(props.style)
    if (s !== props.style) set('style', s)
  }
  if (props.contentContainerStyle) {
    const s = remapStyle(props.contentContainerStyle)
    if (s !== props.contentContainerStyle) set('contentContainerStyle', s)
  }

  // Props de color sueltas (Ionicons, Svg, TextInput…)
  for (const k of PROP_COLOR_KEYS) {
    const v = props[k]
    if (typeof v !== 'string') continue
    if (KEEP_WHITE_PROPS.has(k) && isNearWhite(v)) {
      if (v !== KEEP_WHITE) set(k, KEEP_WHITE)
      continue
    }
    const nv = remap(v)
    if (nv !== v) set(k, nv)
  }

  // Arrays de color (LinearGradient)
  for (const k of PROP_COLOR_ARRAY_KEYS) {
    const v = props[k]
    if (Array.isArray(v) && v.every(x => typeof x === 'string')) {
      let changed = false
      const arr = v.map(x => { const n = remap(x); if (n !== x) changed = true; return n })
      if (changed) set(k, arr)
    }
  }

  // Switch: { true, false }
  if (props.trackColor && typeof props.trackColor === 'object') {
    const tc = props.trackColor
    const nt: any = {}
    let changed = false
    for (const k of ['true', 'false']) {
      const v = tc[k]
      if (typeof v === 'string') {
        const nv = remap(v)
        nt[k] = nv
        if (nv !== v) changed = true
      } else nt[k] = v
    }
    if (changed) set('trackColor', nt)
  }

  // El desenfoque oscuro no funciona sobre fondo claro
  if (props.tint === 'dark') set('tint', 'light')
  if (props.barStyle === 'light-content') set('barStyle', 'dark-content')

  // Registrar mientras `next` sigue siendo un objeto normal: React lo congelará
  // después, y entonces ya no admitiría entrar en el WeakMap.
  if (next) ORIG_PROPS.set(next, props)
  return next ?? props
}

/**
 * Envuelve cualquier fábrica de elementos (createElement, jsx, jsxs, jsxDEV).
 * Todas comparten la forma (type, props, ...resto) y devuelven un elemento.
 */
function wrapFactory<F extends (...a: any[]) => any>(factory: F): F {
  return function patched(this: any, type: any, props: any, ...rest: any[]) {
    if (!LIGHT || !props || typeof props !== 'object') {
      return factory.call(this, type, props, ...rest)
    }

    let finalProps: any
    try {
      finalProps = remapProps(props)

      // Blanco sobre botón de acción: el primer plano se conserva blanco.
      // Con el runtime automático los hijos viajan dentro de props, así que se
      // corrigen antes de construir el elemento y no hace falta clonarlo.
      if (finalProps.children && hasSolidStrongBg(props)) {
        const restored = restoreForeground(finalProps.children)
        if (restored !== finalProps.children) {
          finalProps = { ...finalProps, children: restored }
          ORIG_PROPS.set(finalProps, props)
        }
      }
    } catch (e) {
      // El tema nunca debe poder tumbar un render: se cae al color original.
      // Se avisa una sola vez, porque si esto falla en silencio el síntoma es
      // "el tema claro no cambia nada" y no hay rastro de la causa.
      if (__DEV__ && !warned) {
        warned = true
        console.warn('[tema] remapeo de color fallido, usando la paleta oscura:', e)
      }
      finalProps = props
    }

    return factory.call(this, type, finalProps, ...rest)
  } as unknown as F
}

// ── Instalación ───────────────────────────────────────────────────────────────

let installed = false

export function installThemePatch() {
  if (installed) return
  installed = true

  // 1. createElement (llamadas manuales y librerías compiladas con el transform clásico)
  const R = React as any
  if (typeof R.createElement === 'function') {
    R.createElement = wrapFactory(R.createElement.bind(React))
  }

  // 2. Runtime automático de desarrollo — es el que usa Metro
  try {
    const dev = require('react/jsx-dev-runtime')
    if (typeof dev.jsxDEV === 'function') {
      const raw = dev.jsxDEV
      rawFactory = (type, props, key, isStatic) => raw(type, props, key, isStatic)
      dev.jsxDEV = wrapFactory(raw)
    }
  } catch { /* no disponible en este build */ }

  // 3. Runtime automático de producción
  try {
    const prod = require('react/jsx-runtime')
    if (typeof prod.jsxs === 'function') {
      const rawJsxs = prod.jsxs
      if (!rawFactory) rawFactory = (type, props, key) => rawJsxs(type, props, key)
      prod.jsxs = wrapFactory(rawJsxs)
    }
    if (typeof prod.jsx === 'function') prod.jsx = wrapFactory(prod.jsx)
  } catch { /* no disponible en este build */ }
}
