import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, PanResponder, Animated as RNAnimated } from 'react-native'
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, withDelay, Easing,
} from 'react-native-reanimated'
import { Colors } from '@/constants/theme'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const N = Colors.neon

// Geometría del semicírculo. Fija: el SVG escala por viewBox.
const W = 212
const H = 126
const R = 86
const CX = W / 2
const CY = 112
const ARC = `M${CX - R},${CY} A${R},${R} 0 0,1 ${CX + R},${CY}`
const ARC_LEN = Math.PI * R   // ≈ 270

interface PortionDialProps {
  /** Cantidad actual. */
  value: number
  /** Máximo del dial. */
  max: number
  unit: string
  onChange: (v: number) => void
  step?: number
}

/**
 * Dial curvo de porción — dirección visual aprobada.
 *
 * El arco se enciende entero (es la pista viva) y el knob marca la posición
 * actual. Se arrastra horizontalmente sobre el semicírculo para ajustar.
 */
export function PortionDial({ value, max, unit, onChange, step = 5 }: PortionDialProps) {
  const draw = useSharedValue(0)
  const safeMax = Math.max(max, 1)
  const pct = Math.min(Math.max(value / safeMax, 0), 1)

  useEffect(() => {
    draw.value = 0
    draw.value = withDelay(300, withTiming(1, { duration: 1300, easing: Easing.bezier(0.16, 1, 0.3, 1) }))
  }, [])

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LEN * (1 - draw.value),
  }))

  // Posición del knob sobre el arco: 0 = izquierda, 1 = derecha.
  const angle = Math.PI * (1 - pct)          // π → 0
  const knobX = CX + R * Math.cos(angle) * -1
  const knobY = CY - R * Math.sin(angle)

  // Arrastre: mapeamos el desplazamiento horizontal al rango del dial.
  const startValue = useRef(value)
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startValue.current = value },
      onPanResponderMove: (_, g) => {
        // Todo el ancho del dial recorre el rango completo.
        const delta = (g.dx / W) * safeMax
        const raw = startValue.current + delta
        const snapped = Math.round(raw / step) * step
        const clamped = Math.min(Math.max(snapped, 0), safeMax)
        if (clamped !== value) onChange(clamped)
      },
    }),
  ).current

  return (
    <View style={s.wrap} {...pan.panHandlers}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="pd-grad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={N.redSoft} />
            <Stop offset="1" stopColor={N.red} />
          </LinearGradient>
        </Defs>

        <Path d={ARC} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={11} strokeLinecap="round" />

        <AnimatedPath
          d={ARC} fill="none" stroke="url(#pd-grad)" strokeWidth={11} strokeLinecap="round"
          strokeDasharray={`${ARC_LEN}`}
          animatedProps={arcProps}
        />

        <Circle cx={knobX} cy={knobY} r={13} fill="rgba(255,255,255,0.22)" />
        <Circle cx={knobX} cy={knobY} r={9} fill="#ffffff" />
      </Svg>

      <View style={s.center} pointerEvents="none">
        <Text style={s.value}>{Math.round(value)}</Text>
        <Text style={s.unit}>{unit === 'g' ? 'gramos' : unit}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end', height: H },
  center: { position: 'absolute', bottom: 6, alignItems: 'center' },
  value: { fontSize: 30, fontWeight: '800', color: N.white, letterSpacing: -1.2 },
  unit: { fontSize: 11, fontWeight: '700', color: N.w3, marginTop: 4 },
})
