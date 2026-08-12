/**
 * ICONOGRAFÍA DE ENTRENAMIENTO
 * ────────────────────────────
 * Los iconos de material y de patrón de movimiento, dibujados para ZENCRUS.
 *
 * ── Por qué no valen los de la librería ─────────────────────────────────────
 * Ionicons tiene UNA mancuerna («barbell») y la usa para todo: barra, mancuerna,
 * kettlebell y máquina salen con el mismo dibujo. En una app donde el material
 * decide si puedes hacer un ejercicio hoy, que cuatro cosas distintas se vean
 * iguales no es un detalle estético: es información que se pierde.
 *
 * ── Reglas del set ──────────────────────────────────────────────────────────
 * Todos sobre 24 × 24, trazo de 1,6 y extremos redondeados, `currentColor` para
 * que hereden el color de donde estén. Dibujados a línea y no rellenos: a 18 px
 * una silueta rellena se convierte en una mancha.
 */

import Svg, { Path, Circle, Rect, Line, G } from 'react-native-svg'

export type IconoMaterial =
  | 'barbell' | 'dumbbell' | 'kettlebell' | 'cable' | 'machine'
  | 'band' | 'bodyweight' | 'plate' | 'landmine' | 'bench'

export type IconoPatron =
  | 'push' | 'pull' | 'squat' | 'hinge' | 'carry' | 'core' | 'stretch'

interface Props {
  size?: number
  color?: string
  /** Grosor del trazo. Sube a 2 cuando el icono va grande y solo. */
  weight?: number
}

const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24',
})

const trazo = (color: string, weight: number) => ({
  stroke: color, strokeWidth: weight, fill: 'none',
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
})

// ── Material ─────────────────────────────────────────────────────────────────

/** Barra olímpica: eje largo, dos discos por lado y los topes. */
export const IconBarbell = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Line x1="7" y1="12" x2="17" y2="12" />
      <Rect x="4" y="8" width="2.2" height="8" rx="0.8" />
      <Rect x="17.8" y="8" width="2.2" height="8" rx="0.8" />
      <Line x1="2.6" y1="10" x2="2.6" y2="14" />
      <Line x1="21.4" y1="10" x2="21.4" y2="14" />
    </G>
  </Svg>
)

/** Mancuerna: eje CORTO y discos gruesos. Es lo que la distingue de la barra. */
export const IconDumbbell = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Line x1="9.5" y1="12" x2="14.5" y2="12" />
      <Rect x="5.5" y="7.5" width="3.6" height="9" rx="1.4" />
      <Rect x="14.9" y="7.5" width="3.6" height="9" rx="1.4" />
      <Line x1="3.4" y1="9.5" x2="3.4" y2="14.5" />
      <Line x1="20.6" y1="9.5" x2="20.6" y2="14.5" />
    </G>
  </Svg>
)

/** Kettlebell: la campana con asa. Inconfundible, y por eso vale la pena. */
export const IconKettlebell = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Path d="M9 7.5a3 3 0 0 1 6 0" />
      <Path d="M9.4 8.2C6.6 9.6 5 12.3 5 15.2c0 2 .8 3.3 2 3.3h10c1.2 0 2-1.3 2-3.3 0-2.9-1.6-5.6-4.4-7" />
    </G>
  </Svg>
)

/** Polea: la torre, el cable que cae y el agarre. */
export const IconCable = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Circle cx="17" cy="6" r="2.2" />
      <Path d="M17 8.2v2.4c0 .8-.6 1.4-1.4 1.4H9" />
      <Path d="M9 12v5.5" />
      <Path d="M6.6 17.5h4.8" />
      <Line x1="4" y1="4" x2="4" y2="20" />
    </G>
  </Svg>
)

/** Máquina: respaldo, asiento y la columna de placas. */
export const IconMachine = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Rect x="3.5" y="5" width="6" height="9" rx="1.4" />
      <Path d="M3.5 14h7.5v3.5" />
      <Rect x="14" y="4.5" width="6.5" height="15" rx="1.2" />
      <Line x1="15.4" y1="8.5" x2="19.1" y2="8.5" />
      <Line x1="15.4" y1="11.5" x2="19.1" y2="11.5" />
      <Line x1="15.4" y1="14.5" x2="19.1" y2="14.5" />
    </G>
  </Svg>
)

/** Goma elástica: la banda estirada con sus dos anillas. */
export const IconBand = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Circle cx="5" cy="12" r="2.2" />
      <Circle cx="19" cy="12" r="2.2" />
      <Path d="M7.2 12c1.6-3.2 8-3.2 9.6 0" />
      <Path d="M7.2 12c1.6 3.2 8 3.2 9.6 0" />
    </G>
  </Svg>
)

/** Peso corporal: una figura. Sin hierro, que es justo lo que dice. */
export const IconBodyweight = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Circle cx="12" cy="5" r="2.3" />
      <Path d="M12 7.6v6.2" />
      <Path d="M6.5 10.5 12 9l5.5 1.5" />
      <Path d="M12 13.8 8.6 20" />
      <Path d="M12 13.8 15.4 20" />
    </G>
  </Svg>
)

/** Disco suelto: para los ejercicios que se hacen con un disco en la mano. */
export const IconPlate = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Circle cx="12" cy="12" r="8" />
      <Circle cx="12" cy="12" r="2.6" />
    </G>
  </Svg>
)

/** Landmine: la barra clavada en el suelo, en diagonal. */
export const IconLandmine = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Path d="M4 19.5 17 7" />
      <Circle cx="18.4" cy="5.6" r="2.4" />
      <Path d="M2.5 20.5h5" />
    </G>
  </Svg>
)

/** Banco: la tabla y las patas. */
export const IconBench = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Rect x="3" y="9" width="18" height="3" rx="1.2" />
      <Path d="M6 12v7M18 12v7" />
      <Path d="M4 19h4M16 19h4" />
    </G>
  </Svg>
)

// ── Patrones de movimiento ───────────────────────────────────────────────────
// El patrón es lo que decide si un ejercicio sustituye a otro cuando la máquina
// está ocupada, así que merece su propio icono y no un color más.

/** Empuje: flecha que sale del cuerpo. */
export const IconPush = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Line x1="4" y1="5" x2="4" y2="19" />
      <Path d="M7 12h11" />
      <Path d="M14.5 8.5 18 12l-3.5 3.5" />
    </G>
  </Svg>
)

/** Tracción: flecha que vuelve al cuerpo. */
export const IconPull = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Line x1="20" y1="5" x2="20" y2="19" />
      <Path d="M17 12H6" />
      <Path d="M9.5 8.5 6 12l3.5 3.5" />
    </G>
  </Svg>
)

/**
 * Sentadilla: la barra que baja del hombro al suelo.
 *
 * Va en la MISMA familia que empuje y tracción —dos líneas y una flecha— en vez
 * de dibujar a alguien en cuclillas. Probada la versión figurativa, a 20 px
 * salía una herradura que no significaba nada; la flecha entre dos niveles se
 * lee al instante y encaja con sus hermanas.
 */
export const IconSquat = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Line x1="5" y1="4.5" x2="19" y2="4.5" />
      <Path d="M12 7v8.5" />
      <Path d="M8.6 12.1 12 15.5l3.4-3.4" />
      <Line x1="5" y1="19.5" x2="19" y2="19.5" />
    </G>
  </Svg>
)

/** Bisagra: el tronco que se parte por la cadera. */
export const IconHinge = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Path d="M4 8.5 13 12" />
      <Circle cx="14.6" cy="12.6" r="1.8" />
      <Path d="M15.4 14.2 17 20" />
      <Path d="M14 20h6" />
    </G>
  </Svg>
)

/** Acarreo: la carga colgando de los lados. */
export const IconCarry = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Line x1="12" y1="4" x2="12" y2="20" />
      <Path d="M6 8v4M18 8v4" />
      <Rect x="3.6" y="12" width="4.8" height="5" rx="1.2" />
      <Rect x="15.6" y="12" width="4.8" height="5" rx="1.2" />
    </G>
  </Svg>
)

/** Core: el tronco y su eje. */
export const IconCore = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Path d="M8 4.5c-1 4-1 11 0 15h8c1-4 1-11 0-15z" />
      <Line x1="8.6" y1="10" x2="15.4" y2="10" />
      <Line x1="8.6" y1="14" x2="15.4" y2="14" />
    </G>
  </Svg>
)

/** Estiramiento: la curva larga. */
export const IconStretch = ({ size = 24, color = 'currentColor', weight = 1.6 }: Props) => (
  <Svg {...base(size)}>
    <G {...trazo(color, weight)}>
      <Path d="M4 18c3-9 13-13 16-14" />
      <Circle cx="4.6" cy="18.4" r="1.8" />
    </G>
  </Svg>
)

// ── Búsqueda ─────────────────────────────────────────────────────────────────

const MATERIAL = {
  barbell: IconBarbell, dumbbell: IconDumbbell, kettlebell: IconKettlebell,
  cable: IconCable, machine: IconMachine, band: IconBand,
  bodyweight: IconBodyweight, plate: IconPlate, landmine: IconLandmine,
  bench: IconBench,
} as const

const PATRON = {
  push: IconPush, pull: IconPull, squat: IconSquat, hinge: IconHinge,
  carry: IconCarry, core: IconCore, stretch: IconStretch,
} as const

/**
 * El icono del material. Si el catálogo trae uno que no conocemos, cae en el
 * disco: es genérico pero sigue siendo de gimnasio, y es mejor que un hueco.
 */
export function MaterialIcon({ id, ...p }: Props & { id: string }) {
  const C = MATERIAL[id as IconoMaterial] ?? IconPlate
  return <C {...p} />
}

/**
 * El icono del patrón. Los patrones del catálogo son más de siete (hay
 * `press`, `row`, `curl`…), así que se agrupan en los siete que de verdad
 * cambian cómo se sustituye un ejercicio por otro.
 */
const ALIAS_PATRON: Record<string, IconoPatron> = {
  press: 'push', push: 'push', dip: 'push', fly: 'push',
  row: 'pull', pull: 'pull', pulldown: 'pull', curl: 'pull', shrug: 'pull',
  squat: 'squat', lunge: 'squat', legpress: 'squat',
  hinge: 'hinge', deadlift: 'hinge', swing: 'hinge', goodmorning: 'hinge',
  carry: 'carry', hold: 'carry',
  core: 'core', rotation: 'core', antirotation: 'core',
  stretch: 'stretch', mobility: 'stretch',
}

export function PatronIcon({ id, ...p }: Props & { id: string | null }) {
  const C = PATRON[ALIAS_PATRON[id ?? ''] ?? 'core']
  return <C {...p} />
}
