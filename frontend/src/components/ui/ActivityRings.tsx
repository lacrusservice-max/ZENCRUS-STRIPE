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

function AnimatedRing({ cx, cy, r, strokeWidth, color, value }: { cx: number; cy: number; r: number; strokeWidth: number; color: string; value: number }) {
  const circumference = 2 * Math.PI * r
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(Math.min(Math.max(value, 0), 1), { duration: 1100, easing: Easing.out(Easing.cubic) })
  }, [value])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }))

  return (
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
