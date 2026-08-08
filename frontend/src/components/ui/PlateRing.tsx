/**
 * MEDIDOR DEL DÍA · ZENCRUS
 * ═════════════════════════
 *
 * Arco de 276° abierto por abajo. La vuelta útil (0 → meta) ocupa 236°, y los
 * 40° restantes son reserva: ahí se dibuja en rojo lo que excede la meta, de
 * modo que pasarse tiene un lugar propio en vez de reiniciar la vuelta.
 *
 * Sobre el arco van dos marcas —el piso calórico y la meta— con la banda de
 * «zona óptima» entre ambas. Es la única lectura que necesita quien mira: si la
 * punta blanca cae dentro de la banda, el día va bien.
 *
 * ── Por qué no hay halo ─────────────────────────────────────────────────────
 * La versión anterior envolvía el anillo en un degradado radial rojo que latía.
 * Tiñe el centro de granate, compite con la cifra y convierte tres estados
 * distintos (bajo mínimo, en zona, excedido) en la misma mancha. El rojo aquí
 * significa una sola cosa: te pasaste.
 */

import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, withDelay, Easing,
} from 'react-native-reanimated'
import { Colors } from '@/constants/theme'

const AnimatedPath = Animated.createAnimatedComponent(Path)

const N = Colors.neon
const EASE = Easing.bezier(0.16, 1, 0.3, 1)

// Geometría del arco, en unidades del viewBox.
const VB_W = 250
const VB_H = 224
const CX = 125
const CY = 112
const R = 96
const SW = 15
const START = 132          // grados: extremo izquierdo del arco
const SWEEP_GOAL = 236     // 0 → meta
const SWEEP_MAX = 276      // incluye la reserva de exceso

/** Punto de la circunferencia para un ángulo absoluto en grados. */
function polar(deg: number, radius = R) {
  const rad = (deg * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

/** Camino de arco entre dos ángulos absolutos. */
function arcPath(fromDeg: number, sweepDeg: number, radius = R) {
  const a = polar(fromDeg, radius)
  const b = polar(fromDeg + sweepDeg, radius)
  const large = sweepDeg > 180 ? 1 : 0
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)} A${radius},${radius} 0 ${large},1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`
}

/** Longitud de un arco en unidades de trazo. */
const arcLen = (deg: number) => (deg / 360) * 2 * Math.PI * R

interface PlateRingProps {
  /** Meta calórica: el arco lleno hasta la marca blanca. */
  target: number
  /** Consumido hoy. */
  consumed: number
  /** Piso del día. Dibuja la banda de zona óptima y su marca. */
  minTarget?: number
  size?: number
}

export function PlateRing({ target, consumed, minTarget, size = 268 }: PlateRingProps) {
  const safeTarget = Math.max(target, 1)

  const hasFloor = typeof minTarget === 'number' && minTarget > 0 && minTarget < safeTarget
  const minDeg = hasFloor ? (minTarget! / safeTarget) * SWEEP_GOAL : 0

  const fillDeg = Math.min(consumed / safeTarget, 1) * SWEEP_GOAL
  const overDeg = Math.min(
    Math.max(consumed - safeTarget, 0) / safeTarget * SWEEP_GOAL,
    SWEEP_MAX - SWEEP_GOAL,
  )

  const trackD = arcPath(START, SWEEP_MAX)
  const zoneD = hasFloor ? arcPath(START + minDeg, SWEEP_GOAL - minDeg) : ''
  const fillD = arcPath(START, SWEEP_GOAL)
  const overD = arcPath(START + SWEEP_GOAL, SWEEP_MAX - SWEEP_GOAL)

  const fillLen = arcLen(SWEEP_GOAL)
  const overLen = arcLen(SWEEP_MAX - SWEEP_GOAL)

  // Fracción visible de cada arco, animada al montar y al cambiar el consumo.
  const p = useSharedValue(0)
  useEffect(() => {
    p.value = 0
    p.value = withDelay(120, withTiming(1, { duration: 1100, easing: EASE }))
  }, [consumed, target, minTarget])

  const fillProps = useAnimatedProps(() => ({
    strokeDashoffset: fillLen - fillLen * (fillDeg / SWEEP_GOAL) * p.value,
  }))
  const overProps = useAnimatedProps(() => ({
    strokeDashoffset: overLen - overLen * (overDeg / (SWEEP_MAX - SWEEP_GOAL)) * p.value,
  }))

  // Marcas: se dibujan cruzando la banda del trazo, no encima.
  const tickMin = { i: polar(START + minDeg, R - SW / 2 - 4), o: polar(START + minDeg, R + SW / 2 + 4) }
  const tickMeta = { i: polar(START + SWEEP_GOAL, R - SW / 2 - 5), o: polar(START + SWEEP_GOAL, R + SW / 2 + 5) }

  const h = Math.round((size * VB_H) / VB_W)

  return (
    <View style={[s.wrap, { width: size, height: h }]}>
      <Svg width={size} height={h} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <LinearGradient id="pr-fill" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" />
            <Stop offset="1" stopColor="#e6e6ea" />
          </LinearGradient>
          <LinearGradient id="pr-over" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={N.redSoft} />
            <Stop offset="1" stopColor={N.redDeep} />
          </LinearGradient>
        </Defs>

        {/* Riel */}
        <Path d={trackD} stroke="rgba(255,255,255,0.08)" strokeWidth={SW} fill="none" strokeLinecap="round" />

        {/* Zona óptima: del piso a la meta */}
        {hasFloor && (
          <Path d={zoneD} stroke="rgba(255,255,255,0.20)" strokeWidth={SW} fill="none" />
        )}

        {/* Consumido */}
        <AnimatedPath
          d={fillD}
          stroke="url(#pr-fill)" strokeWidth={SW} fill="none" strokeLinecap="round"
          strokeDasharray={fillLen}
          animatedProps={fillProps}
        />

        {/* Exceso, sobre la reserva */}
        {overDeg > 0 && (
          <AnimatedPath
            d={overD}
            stroke="url(#pr-over)" strokeWidth={SW} fill="none" strokeLinecap="round"
            strokeDasharray={overLen}
            animatedProps={overProps}
          />
        )}

        {/* Marca del piso — acero */}
        {hasFloor && (
          <Line
            x1={tickMin.i.x} y1={tickMin.i.y} x2={tickMin.o.x} y2={tickMin.o.y}
            stroke={N.steelSoft} strokeWidth={2.5} strokeLinecap="round"
          />
        )}

        {/* Marca de la meta — blanco */}
        <Line
          x1={tickMeta.i.x} y1={tickMeta.i.y} x2={tickMeta.o.x} y2={tickMeta.o.y}
          stroke={N.white} strokeWidth={3} strokeLinecap="round"
        />

        {/* Punta del recorrido */}
        {consumed > 0 && (
          <Circle
            cx={polar(START + Math.min(fillDeg + overDeg, SWEEP_MAX)).x}
            cy={polar(START + Math.min(fillDeg + overDeg, SWEEP_MAX)).y}
            r={5}
            fill={overDeg > 0 ? N.red : N.white}
          />
        )}
      </Svg>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-start' },
})
