/**
 * LAS PIEZAS DEL MÓDULO DE CICLO
 * ═══════════════════════════════════════════════════════════════════════════
 * El vocabulario visual que comparten las cinco pantallas del ciclo. Ninguna
 * declara un color ni un tamaño por su cuenta: todo sale de `theme/salud`.
 *
 * ── Por qué existe este archivo ────────────────────────────────────────────
 * La primera versión del módulo era una pila de cajas grises con borde de un
 * píxel, todas del mismo peso. Se ve barato por una razón concreta: cuando
 * todo tiene el mismo tratamiento, nada tiene jerarquía, y una pantalla sin
 * jerarquía obliga a leerla entera para encontrar el dato.
 *
 * Aquí hay tres pesos y ninguno más:
 *   · BANDA   — bloque de color a sangre, sin borde. Un solo elemento manda.
 *   · PLACA   — superficie mate elevada. El contenido normal.
 *   · FILETE  — línea de un cabello. Separa sin dibujar una caja.
 *
 * Que la placa NO tenga borde es deliberado: separa por color de fondo, como
 * el papel sobre la mesa. Un borde alrededor de cada cosa es lo que convierte
 * una app en un formulario.
 */

import React from 'react'
import {
  View, Text, StyleSheet, Pressable, type ViewStyle, type StyleProp,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  base, space, radius, family, type as tipo, numeric, brandTracking,
} from '@/theme/salud/tokens'

type IconName = React.ComponentProps<typeof Ionicons>['name']

// ── Eyebrow ─────────────────────────────────────────────────────────────────

/**
 * La etiqueta de marca en mayúsculas.
 *
 * Rajdhani en mayúsculas sin `letterSpacing` se apelmaza hasta ser ilegible a
 * tamaño pequeño; el tracking de los tokens no es un adorno, es lo que la hace
 * funcionar.
 */
export function Eyebrow({ children, color }: { children: string; color?: string }) {
  return (
    <Text style={[p.eyebrow, color ? { color } : null]}>{children.toUpperCase()}</Text>
  )
}

// ── Sección ─────────────────────────────────────────────────────────────────

export function Seccion({ eyebrow, titulo, nota, color, right, children, style }: {
  eyebrow?: string
  titulo?: string
  nota?: string
  color?: string
  right?: React.ReactNode
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[p.seccion, style]}>
      {(eyebrow || titulo || right) && (
        <View style={p.seccionCab}>
          <View style={p.flex}>
            {eyebrow ? <Eyebrow color={color}>{eyebrow}</Eyebrow> : null}
            {titulo ? <Text style={p.seccionTitulo}>{titulo}</Text> : null}
          </View>
          {right}
        </View>
      )}
      {nota ? <Text style={p.seccionNota}>{nota}</Text> : null}
      {children}
    </View>
  )
}

// ── Placa ───────────────────────────────────────────────────────────────────

export function Placa({ children, style, tono }: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Tiñe la superficie con la fase. Sutil a propósito: es fondo, no acento. */
  tono?: string
}) {
  return (
    <View style={[p.placa, tono ? { backgroundColor: tono } : null, style]}>
      {children}
    </View>
  )
}

// ── Cifra ───────────────────────────────────────────────────────────────────

/**
 * Toda cantidad medida del módulo pasa por aquí.
 *
 * Monoespaciada y con cifras tabulares: sin eso los dígitos cambian de ancho
 * al actualizarse y el número tiembla. Es literalmente la diferencia entre un
 * instrumento y un juguete.
 */
export function Cifra({ valor, unidad, etiqueta, tam = 'md', color, align = 'left' }: {
  valor: string | number | null
  unidad?: string
  etiqueta?: string
  tam?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  color?: string
  align?: 'left' | 'center'
}) {
  const vacio = valor == null || valor === ''
  return (
    <View style={align === 'center' ? p.centro : undefined}>
      <View style={[p.cifraFila, align === 'center' && p.centroFila]}>
        <Text
          style={[
            p.cifra,
            { fontSize: tipo.data[tam] },
            color ? { color } : null,
            vacio && p.cifraVacia,
          ]}
        >
          {vacio ? '—' : valor}
        </Text>
        {unidad && !vacio ? <Text style={p.unidad}>{unidad}</Text> : null}
      </View>
      {etiqueta ? <Text style={p.cifraEtiqueta}>{etiqueta}</Text> : null}
    </View>
  )
}

// ── Tira de datos ───────────────────────────────────────────────────────────

/**
 * Varias cifras en fila, separadas por filete vertical.
 *
 * El filete y no una caja por cifra: en un panel de instrumentos las lecturas
 * se separan con una línea, no se meten cada una en su marco.
 */
export function Tira({ datos, color }: {
  datos: Array<{ valor: string | number | null; unidad?: string; etiqueta: string }>
  color?: string
}) {
  return (
    <View style={p.tira}>
      {datos.map((d, i) => (
        <React.Fragment key={d.etiqueta}>
          {i > 0 ? <View style={p.tiraFilete} /> : null}
          <View style={p.tiraItem}>
            <Cifra {...d} tam="md" color={color} />
          </View>
        </React.Fragment>
      ))}
    </View>
  )
}

// ── Chip ────────────────────────────────────────────────────────────────────

export function Chip({ label, activo, onPress, tono, icono, sub }: {
  label: string
  activo?: boolean
  onPress?: () => void
  tono: string
  icono?: IconName
  /** Segunda línea: el valor ya registrado, si lo hay. */
  sub?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        p.chip,
        activo && { backgroundColor: tono },
        pressed && p.pulsado,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!activo }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
    >
      {icono ? (
        <Ionicons
          name={icono}
          size={14}
          color={activo ? '#fff' : base.textMid}
        />
      ) : null}
      <View>
        <Text style={[p.chipTxt, activo && p.chipTxtOn]}>{label}</Text>
        {sub ? <Text style={[p.chipSub, activo && p.chipSubOn]}>{sub}</Text> : null}
      </View>
    </Pressable>
  )
}

// ── Fila navegable ──────────────────────────────────────────────────────────

export function Destino({ titulo, nota, icono, onPress, tono, dato }: {
  titulo: string
  nota?: string
  icono: IconName
  onPress: () => void
  tono: string
  /** El último dato real de ese destino, o nada. Nunca un cero inventado. */
  dato?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [p.destino, pressed && p.pulsado]}
      accessibilityRole="button"
      accessibilityLabel={dato ? `${titulo}, ${dato}` : titulo}
    >
      <View style={[p.destinoIcono, { backgroundColor: `${tono}22` }]}>
        <Ionicons name={icono} size={17} color={tono} />
      </View>
      <View style={p.flex}>
        <Text style={p.destinoTitulo}>{titulo}</Text>
        {nota ? <Text style={p.destinoNota}>{nota}</Text> : null}
      </View>
      {dato ? <Text style={p.destinoDato}>{dato}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={base.textLow} />
    </Pressable>
  )
}

// ── Filete ──────────────────────────────────────────────────────────────────

export const Filete = () => <View style={p.filete} />

// ── Vacío honesto ───────────────────────────────────────────────────────────

/**
 * Lo que se enseña cuando no hay dato.
 *
 * Nunca un cero, nunca una barra al 0 %, nunca una media poblacional disfrazada
 * de suya. Un hueco con una frase que dice qué falta y qué hacer es información;
 * un cero inventado es una mentira pequeña que corrompe todo lo que se calcule
 * encima.
 */
export function Vacio({ titulo, texto, accion, onAccion, tono, icono = 'ellipse-outline' }: {
  titulo: string
  texto: string
  accion?: string
  onAccion?: () => void
  tono: string
  icono?: IconName
}) {
  return (
    <View style={p.vacio}>
      <View style={[p.vacioIcono, { borderColor: `${tono}55` }]}>
        <Ionicons name={icono} size={22} color={tono} />
      </View>
      <Text style={p.vacioTitulo}>{titulo}</Text>
      <Text style={p.vacioTxt}>{texto}</Text>
      {accion && onAccion ? (
        <Pressable
          onPress={onAccion}
          style={({ pressed }) => [p.vacioBoton, { backgroundColor: tono }, pressed && p.pulsado]}
          accessibilityRole="button"
        >
          <Text style={p.vacioBotonTxt}>{accion}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

// ── Estilos ─────────────────────────────────────────────────────────────────

const p = StyleSheet.create({
  flex: { flex: 1 },
  centro: { alignItems: 'center' },
  centroFila: { justifyContent: 'center' },
  pulsado: { opacity: 0.72 },

  eyebrow: {
    fontFamily: family.brand,
    fontSize: tipo.brand.xs,
    letterSpacing: tipo.brand.xs * brandTracking,
    color: base.textMid,
  },

  seccion: { marginHorizontal: space.lg, marginTop: space.xl },
  seccionCab: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  seccionTitulo: {
    fontFamily: family.uiSemi,
    fontSize: tipo.ui.lg,
    color: base.textHi,
    marginTop: 2,
  },
  seccionNota: {
    fontFamily: family.ui,
    fontSize: tipo.ui.xs,
    color: base.textLow,
    marginTop: 3,
    lineHeight: tipo.ui.xs * 1.5,
  },

  placa: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: base.surface1,
  },

  cifraFila: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  cifra: { fontFamily: family.dataMedium, color: base.textHi, ...numeric },
  cifraVacia: { color: base.textLow },
  unidad: { fontFamily: family.data, fontSize: tipo.ui.xs, color: base.textMid },
  cifraEtiqueta: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow, marginTop: 2,
  },

  tira: { flexDirection: 'row', alignItems: 'center' },
  tiraItem: { flex: 1 },
  tiraFilete: { width: 1, height: 30, backgroundColor: base.hairline, marginHorizontal: space.sm },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: space.md - 2, paddingVertical: space.sm + 2,
    borderRadius: radius.pill, backgroundColor: base.surface2,
  },
  chipTxt: { fontFamily: family.uiMedium, fontSize: tipo.ui.sm, color: base.textMid },
  chipTxtOn: { color: '#fff' },
  chipSub: { fontFamily: family.data, fontSize: 10, color: base.textLow, ...numeric },
  chipSubOn: { color: 'rgba(255,255,255,0.82)' },

  destino: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingVertical: space.md - 2,
  },
  destinoIcono: {
    width: 34, height: 34, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  destinoTitulo: { fontFamily: family.uiMedium, fontSize: tipo.ui.md, color: base.textHi },
  destinoNota: { fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow, marginTop: 1 },
  destinoDato: { fontFamily: family.data, fontSize: tipo.ui.sm, color: base.textMid, ...numeric },

  filete: { height: 1, backgroundColor: base.hairline },

  vacio: { alignItems: 'center', paddingVertical: space.xl, gap: space.sm },
  vacioIcono: {
    width: 54, height: 54, borderRadius: radius.pill, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.xs,
  },
  vacioTitulo: { fontFamily: family.uiSemi, fontSize: tipo.ui.md, color: base.textHi },
  vacioTxt: {
    fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid,
    textAlign: 'center', lineHeight: tipo.ui.sm * 1.55, maxWidth: 300,
  },
  vacioBoton: {
    marginTop: space.sm, paddingHorizontal: space.lg, height: 44,
    borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
  },
  vacioBotonTxt: { fontFamily: family.uiSemi, fontSize: tipo.ui.md, color: '#fff' },
})
