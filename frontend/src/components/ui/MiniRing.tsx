import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Anillo individual compacto y animado — para macros, metas pequeñas, etc. */
export function MiniRing({ value, color, size = 52, strokeWidth = 5, children }: {
  value: number // 0-1
  color: string
  size?: number
  strokeWidth?: number
  children?: React.ReactNode
}) {
  const r = size / 2 - strokeWidth / 2
  const circumference = 2 * Math.PI * r
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(Math.min(Math.max(value, 0), 1), { duration: 900, easing: Easing.out(Easing.cubic) })
  }, [value])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }))

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFillObject}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  )
}
