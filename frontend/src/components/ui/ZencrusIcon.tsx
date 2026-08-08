/**
 * ZENCRUS ICONOGRAFÍA
 * ───────────────────
 * Set propio, dibujado a mano sobre retícula de 24×24. Todo el set comparte
 * las mismas reglas para que se lea como una familia y no como una colección:
 *
 *   · Retícula 24 · margen óptico de 2.4 · trazo base 1.7 con remates redondos
 *   · Geometría de instrumento: círculos exactos, ángulos de 45°, sin curvas
 *     decorativas — el lenguaje es de panel técnico, no de ilustración
 *   · Un solo peso visual por icono; los sólidos se reservan para estados
 *     energéticos (rayo, llama, chispa) donde la silueta debe leerse a 14 px
 *
 * Sustituye a Ionicons y a los emojis dentro de Nutrición: los emojis se
 * renderizan distinto en cada plataforma y rompen la línea gráfica.
 */

import Svg, { Path, Circle, Rect, G } from 'react-native-svg'

export type ZIconName =
  // Métodos de captura
  | 'reticle' | 'stack' | 'frame' | 'codex' | 'waveform' | 'aperture' | 'barcode'
  // Momentos del día
  | 'dawn' | 'zenith' | 'dusk' | 'bolt'
  // Acciones
  | 'plus' | 'minus' | 'check' | 'close' | 'trash' | 'pen' | 'undo'
  | 'chevronLeft' | 'chevronRight' | 'chevronUp' | 'chevronDown' | 'arrowRight'
  // Datos y estado
  | 'flame' | 'spark' | 'target' | 'gauge' | 'droplet' | 'warning' | 'layers'
  | 'sliders' | 'clock' | 'star'

/** Iconos que se dibujan sólidos en vez de a trazo. */
const SOLID = new Set<ZIconName>(['bolt', 'flame', 'spark', 'dusk'])

interface ZIconProps {
  name: ZIconName
  size?: number
  color?: string
  /** Trazo en unidades de la retícula de 24. Por defecto 1.7. */
  weight?: number
  opacity?: number
}

export function ZIcon({ name, size = 20, color = '#FFFFFF', weight = 1.7, opacity = 1 }: ZIconProps) {
  const solid = SOLID.has(name)
  const stroke = solid ? 'none' : color
  const fill = solid ? color : 'none'

  return (
    // `color` es lo que resuelve `currentColor` en los glifos que mezclan
    // trazo y relleno (target). Sin él, esos rellenos salen en negro.
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" color={color} opacity={opacity}>
      <G
        stroke={stroke}
        strokeWidth={weight}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={fill}
      >
        {GLYPHS[name]}
      </G>
    </Svg>
  )
}

// ── Retícula ──────────────────────────────────────────────────────────────────
// Cada glifo se declara una sola vez y se reutiliza; son elementos estáticos,
// así que no hay coste en mantenerlos como constantes de módulo.

const GLYPHS: Record<ZIconName, React.ReactNode> = {
  // ── Métodos de captura ──────────────────────────────────────────────────
  /** Retícula de puntería con mango — "buscar" como acto de apuntar, no de lupa. */
  reticle: (
    <>
      <Circle cx={10.4} cy={10.4} r={6.4} />
      <Path d="M10.4 6.5V8.3M10.4 12.5V14.3M6.5 10.4H8.3M12.5 10.4H14.3" />
      <Path d="M15.2 15.2L20.6 20.6" />
    </>
  ),
  /** Pila de registros con marcador de línea. */
  stack: (
    <>
      <Rect x={3.4} y={5.3} width={2.8} height={2.8} rx={0.7} />
      <Rect x={3.4} y={10.6} width={2.8} height={2.8} rx={0.7} />
      <Rect x={3.4} y={15.9} width={2.8} height={2.8} rx={0.7} />
      <Path d="M9.8 6.7H20.6M9.8 12H18.2M9.8 17.3H20.6" />
    </>
  ),
  /** Marco de captura con línea de barrido. */
  frame: (
    <>
      <Path d="M3.2 8.6V5.6A2.4 2.4 0 015.6 3.2H8.6" />
      <Path d="M15.4 3.2H18.4A2.4 2.4 0 0120.8 5.6V8.6" />
      <Path d="M20.8 15.4V18.4A2.4 2.4 0 0118.4 20.8H15.4" />
      <Path d="M8.6 20.8H5.6A2.4 2.4 0 013.2 18.4V15.4" />
      <Path d="M6.6 12H17.4" />
    </>
  ),
  /** Códice abierto — recetario. */
  codex: (
    <>
      <Path d="M12 6.8C10.2 5.3 7.8 4.5 4.4 4.5V17.5C7.8 17.5 10.2 18.3 12 19.8" />
      <Path d="M12 6.8C13.8 5.3 16.2 4.5 19.6 4.5V17.5C16.2 17.5 13.8 18.3 12 19.8" />
      <Path d="M12 6.8V19.8" />
    </>
  ),
  /** Forma de onda — dictado. */
  waveform: (
    <Path d="M3.6 10V14M8 6.6V17.4M12 3.4V20.6M16 6.6V17.4M20.4 10V14" />
  ),
  /** Diafragma de 3 palas — análisis por foto. */
  aperture: (
    <>
      <Circle cx={12} cy={12} r={8.6} />
      <Path d="M12 12V3.4M12 12L19.4 16.3M12 12L4.6 16.3" />
    </>
  ),
  /** Código de barras. */
  barcode: (
    <Path d="M4 5.6V18.4M8 5.6V18.4M11.6 5.6V18.4M16 5.6V18.4M20 5.6V18.4" />
  ),

  // ── Momentos del día ────────────────────────────────────────────────────
  /** Amanecer — desayuno. */
  dawn: (
    <>
      <Path d="M3.4 18.6H20.6" />
      <Path d="M7 18.6A5 5 0 0117 18.6" />
      <Path d="M12 5.6V3.4M6 8.2L4.5 6.7M18 8.2L19.5 6.7" />
    </>
  ),
  /** Cénit — almuerzo. */
  zenith: (
    <>
      <Circle cx={12} cy={12} r={4.6} />
      <Path d="M12 2.6V5M12 19V21.4M2.6 12H5M19 12H21.4M5.4 5.4L7.1 7.1M16.9 16.9L18.6 18.6M18.6 5.4L16.9 7.1M7.1 16.9L5.4 18.6" />
    </>
  ),
  /** Ocaso — cena. */
  dusk: (
    <Path d="M20.2 14.6A8.7 8.7 0 119.4 3.8 6.9 6.9 0 0020.2 14.6Z" />
  ),
  /** Rayo — snack / energía rápida. */
  bolt: (
    <Path d="M13.6 2.4L5.2 13.6H11.1L10.4 21.6L18.8 10.4H12.9Z" />
  ),

  // ── Acciones ────────────────────────────────────────────────────────────
  plus:  <Path d="M12 5.4V18.6M5.4 12H18.6" />,
  minus: <Path d="M5.4 12H18.6" />,
  check: <Path d="M4.8 12.6L9.6 17.4L19.2 6.6" />,
  close: <Path d="M6.4 6.4L17.6 17.6M17.6 6.4L6.4 17.6" />,
  trash: (
    <>
      <Path d="M4.4 6.6H19.6" />
      <Path d="M9 6.6V4.9A1.5 1.5 0 0110.5 3.4H13.5A1.5 1.5 0 0115 4.9V6.6" />
      <Path d="M6.4 6.6L7.4 19.3A1.9 1.9 0 009.3 21H14.7A1.9 1.9 0 0016.6 19.3L17.6 6.6" />
      <Path d="M10.2 10.4V17.2M13.8 10.4V17.2" />
    </>
  ),
  pen: (
    <>
      <Path d="M3.6 20.4L4.5 16.2L16.1 4.6A2.1 2.1 0 0119.1 7.6L7.5 19.2Z" />
      <Path d="M14.2 6.5L17.2 9.5" />
    </>
  ),
  undo: (
    <>
      <Path d="M4.2 9.6H9.6" />
      <Path d="M4.2 9.6V4.2" />
      <Path d="M4.8 14.4A7.8 7.8 0 105.4 8.4" />
    </>
  ),
  chevronLeft:  <Path d="M14.8 5.6L8.4 12L14.8 18.4" />,
  chevronRight: <Path d="M9.2 5.6L15.6 12L9.2 18.4" />,
  chevronUp:    <Path d="M5.6 14.8L12 8.4L18.4 14.8" />,
  chevronDown:  <Path d="M5.6 9.2L12 15.6L18.4 9.2" />,
  arrowRight:   <Path d="M4 12H19.4M13.6 6.2L19.4 12L13.6 17.8" />,

  // ── Datos y estado ──────────────────────────────────────────────────────
  flame: (
    <Path d="M12 21.8C15.8 21.8 18.9 18.9 18.9 15.1C18.9 11.3 12 2.2 12 2.2C12 2.2 5.1 11.3 5.1 15.1C5.1 18.9 8.2 21.8 12 21.8Z" />
  ),
  /** Chispa de cuatro puntas — todo lo que viene de la IA. */
  spark: (
    <>
      <Path d="M11.4 3.2C12.2 8.4 14.9 11.1 20.1 11.9C14.9 12.7 12.2 15.4 11.4 20.6C10.6 15.4 7.9 12.7 2.7 11.9C7.9 11.1 10.6 8.4 11.4 3.2Z" />
      <Path d="M19 2.4C19.3 4.1 19.9 4.7 21.6 5C19.9 5.3 19.3 5.9 19 7.6C18.7 5.9 18.1 5.3 16.4 5C18.1 4.7 18.7 4.1 19 2.4Z" />
    </>
  ),
  target: (
    <>
      <Circle cx={12} cy={12} r={8.6} />
      <Circle cx={12} cy={12} r={4.4} />
      <Circle cx={12} cy={12} r={1.1} fill="currentColor" />
    </>
  ),
  gauge: (
    <>
      <Path d="M4.2 17.6A9.2 9.2 0 1119.8 17.6" />
      <Path d="M12 12L16.4 8.2" />
      <Circle cx={12} cy={12} r={1.3} />
    </>
  ),
  droplet: (
    <Path d="M12 3.2C12 3.2 5.6 10.2 5.6 14.5A6.4 6.4 0 1018.4 14.5C18.4 10.2 12 3.2 12 3.2Z" />
  ),
  warning: (
    <>
      <Path d="M12 3.6L21.6 20.4H2.4Z" />
      <Path d="M12 9.8V14.6M12 17.6V17.7" />
    </>
  ),
  layers: (
    <>
      <Path d="M12 3.2L21 8L12 12.8L3 8Z" />
      <Path d="M3 12.8L12 17.6L21 12.8" />
      <Path d="M3 17.6L12 22.4L21 17.6" />
    </>
  ),
  sliders: (
    <>
      <Path d="M3.6 7.4H14M18.4 7.4H20.4M3.6 16.6H9.6M14 16.6H20.4" />
      <Circle cx={16.2} cy={7.4} r={2.2} />
      <Circle cx={11.8} cy={16.6} r={2.2} />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={8.6} />
      <Path d="M12 7V12L15.4 14" />
    </>
  ),
  star: (
    <Path d="M12 3.4L14.7 9.1L21 10L16.5 14.4L17.6 20.6L12 17.7L6.4 20.6L7.5 14.4L3 10L9.3 9.1Z" />
  ),
}
