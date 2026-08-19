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

  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(Math.min(Math.max(value, 0), 1), { duration: 900, easing: Easing.out(Easing.cubic) })
  }, [value])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference - trazoDe(progress.value, circumference, strokeWidth),
  }))

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFillObject}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} fill="none" />
        {value > 0 && (
          <Circle cx={size / 2} cy={size / 2 - r} r={strokeWidth / 2} fill={color} />
        )}
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
