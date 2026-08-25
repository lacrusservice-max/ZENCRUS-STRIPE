/**
 * TOKENS · MÓDULO DE SALUD (CICLO)
 * ═══════════════════════════════════════════════════════════════════════════
 * Fuente única de verdad del sistema visual del módulo. Ningún componente de
 * `/salud/ciclo/*` declara un color, un tamaño ni una duración por su cuenta.
 *
 * ── La idea que sostiene todo el archivo ───────────────────────────────────
 * La interfaz cambia de temperatura según la fase del ciclo. No un distintivo
 * de color: la luz ambiente de la pantalla entera. El usuario aprende a leer
 * su fase por la temperatura antes de leer un solo número.
 *
 * Y no solo cambia el color: en fase menstrual la app **se mueve menos** y
 * **respira más** (menos densidad, más espacio). Eso no es decoración, es
 * respeto por cómo se lee una pantalla el primer día del periodo.
 *
 * ── Sobre el rosa ─────────────────────────────────────────────────────────
 * El prompt maestro de este módulo prohibía el rosa por ser el cliché de la
 * categoría. La instrucción del 21/08 lo pide, y manda. Queda en DECISIONES.md
 * como D-14.
 *
 * Lo que evita el cliché no es el tono, es el tratamiento: rosa pastel con
 * serif redondeada y flores es condescendiente; rosa saturado y profundo sobre
 * casi-negro, con cifras tabulares y tipografía de instrumento, no lo es. Por
 * eso la escala arranca en un rosa oscuro y solo alcanza el brillo pleno en la
 * ovulación — el día más luminoso del mes.
 */

import { Easing } from 'react-native-reanimated'
import { type Phase, PHASE_ORDER, nextPhase } from '@/features/salud/ciclo/fases'

/* El vocabulario de fases vive en el dominio, no aquí: ver ciclo/fases.ts.
   Se reexporta para que todo lo que ya importaba `Phase` desde el tema siga
   funcionando, y para que exista un solo orden de fases en el proyecto. */
export { PHASE_ORDER, nextPhase }
export type { Phase }

// ── BASE · invariante ───────────────────────────────────────────────────────

export const base = {
  void:     '#050507',  // fondo absoluto
  surface1: '#0C0D11',  // superficie elevada 1
  surface2: '#14161C',  // superficie elevada 2
  surface3: '#1D2028',  // superficie elevada 3 (interactiva)
  hairline: '#262A34',  // divisores — nunca sombras para separar
  textHi:   '#F2F4F8',
  textMid:  '#9AA1B0',
  textLow:  '#5D6472',
  danger:   '#FF4D4D',
  warn:     '#FFB020',
  ok:       '#29C48D',
} as const

// ── FASES ───────────────────────────────────────────────────────────────────

export interface PhaseTokens {
  /** Color principal de la fase. */
  accent: string
  /** Versión atenuada, para fondos y superficies teñidas. */
  accentSoft: string
  /** rgba para halos y sombras. */
  accentGlow: string
  /** 0–1 · modula el brillo global del tema. */
  luminance: number
  /** 0.6–1 · modula amplitud y velocidad de las animaciones. */
  motionScale: number
  /** 0.8–1 · modula el espaciado. Menos denso en menstrual. */
  density: number
  /** Nombre visible. El color NUNCA viaja solo: siempre lleva su etiqueta. */
  label: string
}

/**
 * La escala del rosa.
 *
 * Sube de oscuro a brillante y vuelve a bajar, siguiendo la curva real del
 * ciclo. El pico de luz coincide con el pico fisiológico: aparecer siempre
 * abarata un color, aparecer en el momento correcto lo convierte en un evento.
 */
export const PHASES: Record<Phase, PhaseTokens> = {
  menstrual: {
    accent:      '#B3184C',
    accentSoft:  '#2A0A16',
    accentGlow:  'rgba(179,24,76,0.32)',
    luminance:   0.62,
    motionScale: 0.65,
    density:     0.85,
    label:       'Menstrual',
  },
  folicular: {
    accent:      '#E0326E',
    accentSoft:  '#33101F',
    accentGlow:  'rgba(224,50,110,0.34)',
    luminance:   0.82,
    motionScale: 0.90,
    density:     0.95,
    label:       'Folicular',
  },
  ovulatoria: {
    accent:      '#FF4D8F',
    accentSoft:  '#3B1425',
    accentGlow:  'rgba(255,77,143,0.44)',
    luminance:   1.00,
    motionScale: 1.00,
    density:     1.00,
    label:       'Ovulatoria',
  },
  lutea: {
    accent:      '#C4436B',
    accentSoft:  '#2E1220',
    accentGlow:  'rgba(196,67,107,0.30)',
    luminance:   0.74,
    motionScale: 0.78,
    density:     0.92,
    label:       'Lútea',
  },
} as const

// ── ESPACIADO ───────────────────────────────────────────────────────────────

export const space = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64, huge: 96,
} as const

/**
 * El espaciado se multiplica por la densidad de la fase.
 *
 * En menstrual la interfaz se abre: mismo contenido, más aire. Se redondea
 * porque un valor fraccionario de píxel produce bordes borrosos en Android.
 */
export const spaceFor = (key: keyof typeof space, phase: PhaseTokens): number =>
  Math.round(space[key] * (2 - phase.density))

// ── RADIOS ──────────────────────────────────────────────────────────────────

export const radius = { sm: 6, md: 12, lg: 20, xl: 28, pill: 999 } as const

// ── TIPOGRAFÍA ──────────────────────────────────────────────────────────────

/**
 * Cuatro roles, cada uno con una razón.
 *
 * `brand` es Rajdhani y no Michroma: la app entera —Nutrición, Entrena,
 * Social— ya descansa en ella, y cambiar la voz de marca solo en este módulo
 * lo dejaría hablando otro idioma. Cumple la misma función (geométrica,
 * ilegible en párrafo, perfecta en etiqueta corta). Ver DECISIONES.md D-03.
 */
export const family = {
  brand:      'Rajdhani_700Bold',
  display:    'Fraunces_400Regular',
  displaySemi:'Fraunces_600SemiBold',
  ui:         'Inter_400Regular',
  uiMedium:   'Inter_500Medium',
  uiSemi:     'Inter_600SemiBold',
  /**
   * El dato medido es GeistMono, la misma que usa Running, y NO JetBrainsMono
   * como decía este archivo antes.
   *
   * Dos razones. La primera es que JetBrainsMono no se carga en `_layout.tsx`:
   * el nombre estaba escrito aquí y en ningún sitio más, así que cada cifra de
   * este módulo caía en la fuente del sistema sin avisar de nada — el fallo
   * silencioso clásico de las tipografías. La segunda es que aunque se cargara,
   * dos monoespaciadas distintas en la misma app se leen como dos apps.
   */
  data:       'GeistMono_400Regular',
  dataMedium: 'GeistMono_500Medium',
} as const

export const type = {
  brand:   { xs: 10, sm: 12, md: 14 },              // Rajdhani · MAYÚSCULAS
  display: { sm: 24, md: 32, lg: 42, xl: 56 },      // Fraunces · titulares e insights
  ui:      { xs: 11, sm: 13, md: 15, lg: 17, xl: 20 },
  data:    { sm: 13, md: 18, lg: 28, xl: 40, hero: 64 },
} as const

export const lineHeight = { tight: 1.15, snug: 1.35, normal: 1.55, loose: 1.75 } as const

/** Tracking de la fuente de marca. Sin esto, Rajdhani en mayúsculas se apelmaza. */
export const brandTracking = 0.18

/**
 * Toda cifra medida va con esto.
 *
 * Sin `tabular-nums` los dígitos cambian de ancho al actualizarse y el número
 * tiembla. Es la diferencia entre un instrumento y un juguete.
 */
export const numeric = { fontVariant: ['tabular-nums' as const] }

// ── MOVIMIENTO ──────────────────────────────────────────────────────────────

export const duration = {
  instant: 120, fast: 200, base: 340, slow: 600, ambient: 2400,
} as const

export const easing = {
  out:    Easing.bezier(0.16, 1, 0.30, 1),
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
  breath: Easing.inOut(Easing.sin),
} as const

/**
 * La duración también depende de la fase.
 *
 * En menstrual todo se mueve un tercio menos. No es un detalle estético: una
 * pantalla que salta menos se lee mejor cuando duele la cabeza.
 */
export const durationFor = (key: keyof typeof duration, phase: PhaseTokens): number =>
  Math.round(duration[key] * (2 - phase.motionScale))

// ── INTERPOLACIÓN ENTRE FASES ───────────────────────────────────────────────

/**
 * El tema no salta de fase a fase: se desliza.
 *
 * Un ciclo es continuo, así que los tokens también. `t` es el progreso dentro
 * de la fase actual (0 = acaba de entrar, 1 = está a punto de salir) y se usa
 * para mezclar con la fase siguiente. Sin esto, el día que cambia de fase la
 * app daría un salto de color que no corresponde a nada que pase en el cuerpo.
 */
export function mixPhases(from: Phase, to: Phase, t: number): PhaseTokens {
  const a = PHASES[from]
  const b = PHASES[to]
  const k = Math.min(1, Math.max(0, t))
  return {
    accent:      mixHex(a.accent, b.accent, k),
    accentSoft:  mixHex(a.accentSoft, b.accentSoft, k),
    accentGlow:  k < 0.5 ? a.accentGlow : b.accentGlow,
    luminance:   a.luminance + (b.luminance - a.luminance) * k,
    motionScale: a.motionScale + (b.motionScale - a.motionScale) * k,
    density:     a.density + (b.density - a.density) * k,
    label:       k < 0.5 ? a.label : b.label,
  }
}

/** Mezcla dos hex en RGB. Suficiente aquí: los cuatro tonos son vecinos. */
function mixHex(from: string, to: string, k: number): string {
  const a = parseInt(from.slice(1), 16)
  const b = parseInt(to.slice(1), 16)
  const ch = (shift: number) => {
    const x = (a >> shift) & 0xff
    const y = (b >> shift) & 0xff
    return Math.round(x + (y - x) * k)
  }
  const r = ch(16), g = ch(8), bl = ch(0)
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`
}

// ── CAMPO DE FASE ───────────────────────────────────────────────────────────

/**
 * El fondo ambiental. Nunca compite con el contenido.
 *
 * Se congela al perder el foco y se apaga con reduce-motion o con ahorro de
 * batería: un ruido animado a pantalla completa es de lo más caro que puede
 * hacer una app, y aquí es lo primero prescindible.
 */
export const field = {
  maxOpacity: 0.35,
  frequency: 0.05,   // Hz · respiración
  blur: 48,
} as const
