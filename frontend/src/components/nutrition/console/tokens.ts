/**
 * CONSOLA DE ALIMENTOS — LENGUAJE VISUAL
 * ──────────────────────────────────────
 * Tokens propios de la consola. No son un tema paralelo: se derivan de la
 * paleta ZENCRUS y sólo añaden lo que este contexto necesita.
 *
 * Tres reglas gobiernan el aspecto:
 *
 * 1. El rojo es escaso. Marca exactamente tres cosas — el método activo, la
 *    acción principal y el exceso sobre el presupuesto. Todo lo demás vive en
 *    la escala de blancos. Un rojo repartido por toda la pantalla deja de
 *    significar algo y satura.
 *
 * 2. La selección se dibuja con esquinas, no con relleno. Un corchete de
 *    cuatro vértices sobre fondo transparente pesa mucho menos que un bloque
 *    de color y permite tener varios elementos activos sin ensuciar.
 *
 * 3. Los números son instrumentos. Cifra grande con `tabular-nums` para que
 *    no bailen al actualizarse, unidad diminuta en versalitas debajo.
 */

import { TextStyle } from 'react-native'
import { Colors } from '@/constants/theme'

const NEON = Colors.neon

export const CT = {
  // ── Superficies ──────────────────────────────────────────────────────────
  /** Fondo de la consola. Un punto por encima del negro del sistema. */
  base: '#08080A',
  /** Panel elevado sobre el fondo. */
  panel: 'rgba(255,255,255,0.038)',
  /** Panel en estado activo o enfocado. */
  panelHot: 'rgba(255,255,255,0.072)',
  /** Filete divisorio. Nunca un borde completo si basta una línea. */
  hairline: 'rgba(255,255,255,0.085)',
  /** Borde de un elemento que sí necesita contorno cerrado. */
  edge: 'rgba(255,255,255,0.12)',

  // ── Tinta ────────────────────────────────────────────────────────────────
  ink: '#FFFFFF',
  ink2: 'rgba(255,255,255,0.62)',
  ink3: 'rgba(255,255,255,0.36)',
  ink4: 'rgba(255,255,255,0.17)',

  // ── Señal ────────────────────────────────────────────────────────────────
  signal: NEON.red,
  signalSoft: NEON.redSoft,
  signalWash: 'rgba(255,31,61,0.10)',
  signalEdge: 'rgba(255,31,61,0.42)',

  // ── Neón ─────────────────────────────────────────────────────────────────
  // Marca los elementos que responden al toque: el filo de cada alimento y el
  // aro de añadir. Sale de aquí y de ningún otro sitio, así que el día que haya
  // tema claro basta con cambiar estos cinco valores por sus equivalentes en
  // azul — el rojo no aguanta un halo sobre fondo blanco y además chocaría con
  // el rojo de las alertas.
  //
  // El halo se pinta con `shadowColor`, que iOS respeta y ANDROID NO: allí solo
  // existe la sombra gris de `elevation`. Por eso el neón vive del borde y del
  // filo, que se ven igual en las dos, y el halo es un extra que suma donde lo
  // hay pero cuya ausencia no rompe el diseño.
  neonLine: 'rgba(255,31,61,0.55)',
  neonLineHot: 'rgba(255,88,113,0.95)',
  neonHalo: 'rgba(255,31,61,0.30)',
  neonInner: 'rgba(255,31,61,0.07)',
  /** Grosor del filo encendido a la izquierda de la fila. */
  neonEdgeWidth: 3,

  // ── Geometría ────────────────────────────────────────────────────────────
  r: { xs: 8, sm: 11, md: 14, lg: 18, pill: 999 },
} as const

/** Cifra de instrumento: no baila al actualizarse. */
export const numeral: TextStyle = {
  color: CT.ink,
  fontWeight: '800',
  fontVariant: ['tabular-nums'],
  letterSpacing: -0.6,
}

/** Versalita de etiqueta — la usan todas las unidades y encabezados menores. */
export const legend: TextStyle = {
  fontSize: 9,
  fontWeight: '800',
  color: CT.ink3,
  letterSpacing: 1.1,
  textTransform: 'uppercase',
}
