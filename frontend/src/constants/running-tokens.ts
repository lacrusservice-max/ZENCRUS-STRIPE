/**
 * TOKENS DE LA SECCIÓN RUNNING
 * ═══════════════════════════
 * El sistema visual de Running vive AQUÍ y solo aquí. `theme.ts` no se toca.
 *
 * ── Por qué un fichero aparte y no ampliar el tema ──────────────────────────
 * Running usa una gramática visual distinta a la del resto de ZENCRUS: densidad
 * alta, jerarquía dura, líneas de un píxel en vez de sombras, y un color que
 * SIGNIFICA en lugar de decorar. Meter eso en `theme.ts` contaminaría las otras
 * secciones, que son de cristal y respiran. Aislarlo tiene además una ventaja
 * práctica: si la dirección de arte se revierte, se revierte un fichero.
 *
 * ── LA DECISIÓN DE COLOR, QUE ES LA QUE MÁS PESA ────────────────────────────
 * Hay DOS usos de color y no se mezclan nunca:
 *
 *   1. LA ESCALA FISIOLÓGICA (`state`) — verde, cian, ámbar, rojo. Aquí el
 *      color es el dato: dice cómo está el cuerpo. Se conserva entera y sin
 *      reanclar a la marca. La tentación era pintar `optimal` del rojo LACRUSS
 *      para que Running se pareciera al resto de la app, y es un error: `strained`
 *      ya es rojo, y dos estados con el mismo tono destruyen justo lo que hace
 *      útil a la escala. Que el rojo signifique «alerta» es un acuerdo universal
 *      y no se gasta en identidad de marca.
 *
 *   2. LA MARCA Y LA ACCIÓN (`signal`) — el naranja `#FF5C00` de ZENCRUS. Botones
 *      primarios, acentos de identidad, lo que se toca. Así Running sigue siendo
 *      de esta app sin robarle el significado a la escala.
 *
 * Regla que se desprende y que no se rompe: **`state.optimal` (cian) solo se usa
 * en datos vivos o midiéndose ahora mismo.** Nunca en un borde decorativo, nunca
 * en un icono genérico, nunca en un botón que no represente acción en vivo.
 *
 * ── El fondo se reancla, el color no ────────────────────────────────────────
 * El negro parte del `#050505` que ya usa toda la app, no de un negro azulado
 * propio. Un fondo distinto se nota al cambiar de pestaña; una escala de color
 * dentro de un módulo, no.
 */

import { Easing } from 'react-native-reanimated'

// ── Color ────────────────────────────────────────────────────────────────────

export const RunningColors = {
  /** Superficies. Se separan con `hairline`, nunca con sombra. */
  surface: {
    void: '#050505',
    base: '#0A0C10',
    raised: '#17181C',
    inset: '#07080B',
    hairline: '#2A2C32',
  },

  /**
   * Escala fisiológica. El ÚNICO sitio donde vive el color saturado.
   * Cada valor es un estado del cuerpo, no una decoración.
   */
  state: {
    restored: '#3DF5A0',
    optimal: '#00F5FF',
    loaded: '#FFB74D',
    strained: '#FF5A5A',
    dormant: '#5C5F66',
  },

  /** Marca y acción. El naranja de ZENCRUS. */
  signal: {
    base: '#FF5C00',
    soft: '#FF7A1F',
    deep: '#FF5C00',
    dim: 'rgba(255,92,0,0.14)',
    edge: 'rgba(255,92,0,0.28)',
  },

  text: {
    primary: '#EDF1F5',
    secondary: '#A1A3A9',
    tertiary: '#5C5F66',
    /** Sobre superficies de color de estado o de marca. */
    onSignal: '#04060A',
  },
} as const

// ── Tipografía ───────────────────────────────────────────────────────────────

/**
 * Tres familias, tres funciones. Nunca se cruzan.
 *
 * `Satoshi` es de Fontshare y no se puede empaquetar desde Google Fonts, así que
 * el cuerpo usa su respaldo declarado en el sistema: Inter, que ya carga la app.
 * Cuando exista el fichero de Satoshi se cambia SOLO esta línea.
 */
export const RunningFonts = {
  display: 'Michroma_400Regular',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodyBold: 'Inter_700Bold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
  monoBold: 'GeistMono_700Bold',
} as const

/**
 * Escala tipográfica. Base 375px.
 *
 * `lineHeight` va en píxeles absolutos y no como múltiplo: un múltiplo se
 * redondea distinto en cada tamaño y desalinea las columnas de telemetría, que
 * es justo lo que esta sección no se puede permitir.
 */
export const RunningType = {
  micro: { fontSize: 11, lineHeight: 14, letterSpacing: 0.88 },
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  lead: { fontSize: 17, lineHeight: 24, letterSpacing: 0 },
  title: { fontSize: 20, lineHeight: 24, letterSpacing: -0.1 },
  module: { fontSize: 26, lineHeight: 28, letterSpacing: -0.26 },
  metric: { fontSize: 34, lineHeight: 34, letterSpacing: -0.34 },
  hero: { fontSize: 64, lineHeight: 60, letterSpacing: -0.64 },
} as const

/**
 * Todo número MEDIDO se pinta con esto.
 *
 * `tabular-nums` es lo que impide que los dígitos tiemblen al actualizarse en
 * vivo: sin ancho fijo, un `1` ocupa menos que un `8` y el número entero se
 * mueve solo cada segundo. Es la diferencia entre un instrumento y un juguete.
 */
export const RunningNumeric = {
  fontFamily: RunningFonts.mono,
  fontVariant: ['tabular-nums'],
} as const

// ── Espacio y forma ──────────────────────────────────────────────────────────

export const RunningSpace = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64,
} as const

/** Margen lateral de la columna. Los módulos `bleed` lo ignoran a propósito. */
export const RunningGutter = 20

export const RunningRadius = {
  tight: 6,
  base: 14,
  soft: 22,
  full: 999,
} as const

/**
 * Tres niveles y ni uno más. La sombra solo existe cuando algo FLOTA de verdad;
 * para separar módulos está `surface.hairline`.
 */
export const RunningElevation = {
  0: {},
  1: {
    shadowColor: '#050505', shadowOpacity: 0.45,
    shadowRadius: 24, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  2: {
    shadowColor: '#050505', shadowOpacity: 0.6,
    shadowRadius: 48, shadowOffset: { width: 0, height: 12 }, elevation: 16,
  },
} as const

export const RunningHairline = {
  height: 1,
  backgroundColor: RunningColors.surface.hairline,
} as const

// ── Movimiento ───────────────────────────────────────────────────────────────

/**
 * El movimiento explica causalidad. Si una animación no dice de dónde viene o
 * a dónde va algo, sobra.
 */
export const RunningMotion = {
  duration: {
    instant: 120,
    fast: 200,
    base: 320,
    slow: 520,
    /** Respiración del Núcleo. Se sustituye por la FC real cuando la haya. */
    ambient: 4000,
  },
  easing: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    in: Easing.bezier(0.55, 0, 1, 0.45),
    inOut: Easing.bezier(0.65, 0, 0.35, 1),
  },
  spring: {
    damping: 18, stiffness: 180, mass: 0.9,
  },
  springSoft: {
    damping: 26, stiffness: 120, mass: 1,
  },
  /** Retardo entre módulos en la entrada a la sección. */
  stagger: 60,
} as const

// ── Tipos ────────────────────────────────────────────────────────────────────

export type RunningStateName = keyof typeof RunningColors.state
export type RunningTypeRole = keyof typeof RunningType
export type RunningSpaceStep = keyof typeof RunningSpace

// ═══════════════════════════════════════════════════════════════════════════
// AL AIRE LIBRE
// ═══════════════════════════════════════════════════════════════════════════
//
// El módulo crece de «Running» a cuatro deportes —correr, bici, caminar y
// senderismo— y necesita tres cosas que arriba no estaban: las zonas de
// esfuerzo, el material de las tarjetas y el color del fondo.
//
// Vive AQUÍ y no en un fichero nuevo por la misma razón que se escribió este:
// si la dirección de arte se revierte, se revierte un fichero.

/**
 * LAS CINCO ZONAS DE ESFUERZO
 * ───────────────────────────
 * No se inventa una paleta: son la escala fisiológica de arriba, reordenada
 * de menos a más esfuerzo. Z2 es `optimal` porque el cian ya significaba
 * «midiéndose ahora»; Z5 es `strained` porque el rojo ya significaba alerta.
 *
 * Z1 usa `dormant` y es el único préstamo discutible —ese gris azulado nació
 * para «sin actividad»—, pero moverse muy suave y no moverse se parecen más
 * entre sí que cualquiera de los dos a las otras cuatro zonas.
 *
 * Y la regla que no se rompe: **ningún deporte tiene color propio.** Si la
 * bici fuera ámbar, el ámbar dejaría de querer decir «umbral». Los deportes
 * se distinguen por icono y por qué miden, nunca por tono.
 */
export const OutdoorZones = [
  { z: 'Z1', nombre: 'Muy suave', color: RunningColors.state.dormant },
  { z: 'Z2', nombre: 'Suave', color: RunningColors.state.optimal },
  { z: 'Z3', nombre: 'Aeróbico', color: RunningColors.state.restored },
  { z: 'Z4', nombre: 'Umbral', color: RunningColors.state.loaded },
  { z: 'Z5', nombre: 'Máximo', color: RunningColors.state.strained },
] as const

export type OutdoorZona = 0 | 1 | 2 | 3 | 4

/**
 * EL MATERIAL DE LAS TARJETAS
 * ───────────────────────────
 * Vidrio con luz en el canto. Son tres capas que se montan en `Tarjeta` y que
 * NO deben replicarse a mano en cada pantalla:
 *
 *   1. un degradado diagonal que aclara la esquina superior izquierda,
 *   2. un filo de 1 px arriba —la luz que entra por el canto—,
 *   3. una sombra de elevación por debajo.
 *
 * Sin la capa 2 el vidrio parece plano; es la que hace el 80 % del efecto.
 */
export const OutdoorMaterial = {
  vidrio: {
    degradado: ['rgba(255,255,255,0.088)', 'rgba(255,255,255,0.032)', 'rgba(255,255,255,0.016)'],
    paradas: [0, 0.46, 1],
    filo: 'rgba(255,255,255,0.15)',
    borde: 'rgba(255,255,255,0.075)',
  },
  /** La variante encendida: lo que se toca o lo que urge. */
  brasa: {
    degradado: ['rgba(255,92,0,0.26)', 'rgba(255,92,0,0.07)', 'rgba(255,255,255,0.02)'],
    paradas: [0, 0.56, 1],
    filo: 'rgba(255,255,255,0.22)',
    borde: 'rgba(255,122,31,0.30)',
  },
  radio: 20,
  sombra: {
    shadowColor: '#050505',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const

/** El degradado de la marca: naranja → rojo → granate. Trazo, anillo y barra. */
export const OutdoorBrasa = ['#FFA45C', '#FF5C00', '#B33D00'] as const

/**
 * EL FONDO TEÑIDO
 * ───────────────
 * En marcha, el fondo entero toma el color de la zona en la que vas. Es
 * información periférica: a 5:24 el minuto nadie lee un número, pero sí nota
 * que la pantalla ha pasado de verde a ámbar.
 *
 * `opacidad` se queda deliberadamente baja. Por encima de 0,4 el texto blanco
 * empieza a perder contraste sobre el ámbar, que es la zona más clara.
 */
export const OutdoorAura = {
  opacidadArriba: 0.34,
  opacidadAbajo: 0.17,
  /** Al pausar, el color de zona se retira: se ve que ya no cuenta. */
  pausado: RunningColors.state.dormant,
} as const
