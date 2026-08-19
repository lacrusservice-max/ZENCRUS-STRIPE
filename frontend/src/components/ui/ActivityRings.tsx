import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from 'react-native-reanimated'
import { Colors, Typography } from '@/constants/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface RingSpec {
  label: string
  value: number   // 0-1
  color: string
}

/**
 * Anillos de actividad ZENCRUS — Movimiento / Entrenamiento / Constancia,
 * tal como los define la Fase 4.1 del sistema de producto. Tres círculos
 * concéntricos que se llenan con una animación suave (nunca estáticos),
 * inspirados funcionalmente en el patrón de Apple Fitness pero con
 * identidad 100% ZENCRUS: paleta propia, sin réplica visual literal.
 */
export function ActivityRings({ rings, size = 168 }: { rings: [RingSpec, RingSpec, RingSpec]; size?: number }) {
  const strokeWidth = size * 0.072
  const gap = strokeWidth * 0.35
  const center = size / 2

  const radii = [
    center - strokeWidth / 2,
    center - strokeWidth * 1.5 - gap,
    center - strokeWidth * 2.5 - gap * 2,
  ]

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring, i) => (
          <RingTrack key={`track-${i}`} cx={center} cy={center} r={radii[i]} strokeWidth={strokeWidth} />
        ))}
        {rings.map((ring, i) => (
          <AnimatedRing key={`ring-${i}`} cx={center} cy={center} r={radii[i]} strokeWidth={strokeWidth} color={ring.color} value={ring.value} />
        ))}
      </Svg>
    </View>
  )
}

function RingTrack({ cx, cy, r, strokeWidth }: { cx: number; cy: number; r: number; strokeWidth: number }) {
  return <Circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="none" />
}


/**
 * DE VALOR A LONGITUD DE TRAZO, CONTANDO LOS REMATES
 * ──────────────────────────────────────────────────
 * `strokeLinecap="round"` añade media circunferencia de radio SW/2 en CADA
 * extremo, y esa media luna se proyecta MÁS ALLÁ del punto que el trazo mide.
 * Así que un anillo con `strokeDashoffset = C·(1−v)` no pinta v, pinta v + SW/C.
 *
 * Con tres anillos que comparten grosor y tienen radios distintos, cada uno
 * miente en distinta medida: aquí eran +2,5 %, +3,1 % y +4,3 %. Efectos:
 *
 *   · el número de al lado decía 67 % mientras el anillo pintaba 70,9 %;
 *   · a partir del 95,8 % las dos puntas ya se solapan, así que un 96 % era
 *     indistinguible de un 100 %;
 *   · y el mismo valor en los tres anillos NO dibujaba el mismo ángulo: el
 *     interior siempre parecía ir por delante.
 *
 * Se corrige acortando el trazo un grosor completo (medio por punta). Y como un
 * trazo más corto que sus propios remates no se dibuja, hace falta el punto de
 * arranque: sin él, los valores pequeños dejaban el anillo vacío.
 */
function trazoDe(valor: number, circunferencia: number, strokeWidth: number): number {
  return Math.max(0, valor * circunferencia - strokeWidth)
}

function AnimatedRing({ cx, cy, r, strokeWidth, color, value }: { cx: number; cy: number; r: number; strokeWidth: number; color: string; value: number }) {
  const circumference = 2 * Math.PI * r
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(Math.min(Math.max(value, 0), 1), { duration: 1100, easing: Easing.out(Easing.cubic) })
  }, [value])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference - trazoDe(progress.value, circumference, strokeWidth),
  }))

  /* Arriba del todo (rotation -90), que es donde nace el anillo. */
  const arranque = { x: cx, y: cy - r }

  return (
    <>
    {value > 0 && (
      <Circle cx={arranque.x} cy={arranque.y} r={strokeWidth / 2} fill={color} />
    )}
    <AnimatedCircle
      cx={cx} cy={cy} r={r}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeDasharray={circumference}
      animatedProps={animatedProps}
      strokeLinecap="round"
      rotation={-90}
      origin={`${cx}, ${cy}`}
    />
    </>
  )
}

/** Leyenda compacta debajo o al lado de los anillos, con valores reales. */
export function RingsLegend({ rings }: { rings: { label: string; display: string; color: string }[] }) {
  return (
    <View style={l.wrap}>
      {rings.map(r => (
        <View key={r.label} style={l.row}>
          <View style={[l.dot, { backgroundColor: r.color }]} />
          <Text style={l.value}>{r.display}</Text>
          <Text style={l.label}>{r.label}</Text>
        </View>
      ))}
    </View>
  )
}

const l = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  value: { fontFamily: Typography.fontFamily.display, fontSize: 17, color: '#fff' },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
})
