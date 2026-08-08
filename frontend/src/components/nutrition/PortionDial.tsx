/**
 * DIAL DE PORCIÓN · ZENCRUS
 * ═════════════════════════
 *
 * Semicírculo arrastrable para fijar una cantidad. Es el control transversal de
 * la app: sirve para la porción de un alimento y para las metas del perfil, con
 * la misma interacción en ambos sitios.
 *
 * ── Geometría ───────────────────────────────────────────────────────────────
 * El arco va de (CX−R, CY) a (CX+R, CY) barriendo 180° por encima del centro.
 * El SVG se dibuja al tamaño exacto del viewBox, así que las coordenadas del
 * gesto y las del dibujo son las mismas y no hace falta reescalar.
 *
 * ── Dos correcciones respecto al dial de la web ─────────────────────────────
 * 1. Allí el relleno se pintaba con `strokeDashoffset={0}` fijo, de modo que el
 *    arco salía siempre completo y solo el knob indicaba el valor. Aquí el
 *    offset se deriva de la fracción, y el arco se llena de verdad.
 * 2. Allí el knob usaba `Math.PI * (1 - pct)`, que lo recorría de derecha a
 *    izquierda mientras el relleno crecía de izquierda a derecha: ambos solo
 *    coincidían en el 50 %. Aquí el knob usa `Math.PI * pct`, el mismo sentido
 *    que el relleno.
 */

import { useMemo, useRef } from 'react'
import { View, Text, StyleSheet, PanResponder, TouchableOpacity } from 'react-native'
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { Colors } from '@/constants/theme'

const N = Colors.neon

const R = 86
const W = 212
const H = 126
const CX = W / 2
const CY = 112
const ARC = `M${CX - R},${CY} A${R},${R} 0 0,1 ${CX + R},${CY}`
const ARC_LEN = Math.PI * R
const TICKS = 8

interface PortionDialProps {
  /** Cantidad actual, en las unidades de `unit`. */
  value: number
  /** Tope del recorrido; el arco lleno equivale a este valor. */
  max: number
  /** Unidad corta para los atajos — «g», «ml», «pza». */
  unit: string
  /** Etiqueta larga bajo la cifra central — «gramos». Por defecto, `unit`. */
  unitLabel?: string
  /** Salto al arrastrar y al pulsar los atajos. */
  step?: number
  /** Atajos de cantidad. Se ocultan si no se pasan. */
  presets?: number[]
  onChange: (next: number) => void
}

/** Redondea al múltiplo de `step` más cercano, dentro de [0, max]. */
function quantize(raw: number, step: number, max: number) {
  const snapped = Math.round(raw / step) * step
  const clamped = Math.min(Math.max(snapped, 0), max)
  // El paso puede ser fraccionario (0.25 de pieza): evita 0.30000000000000004.
  return Math.round(clamped * 100) / 100
}

export function PortionDial({
  value, max, unit, unitLabel, step = 5, presets, onChange,
}: PortionDialProps) {
  const safeMax = Math.max(max, 1)
  const pct = Math.min(Math.max(value / safeMax, 0), 1)

  // El knob recorre el arco en el mismo sentido en que se llena.
  const knobX = CX - R * Math.cos(Math.PI * pct)
  const knobY = CY - R * Math.sin(Math.PI * pct)

  const ticks = useMemo(() => (
    Array.from({ length: TICKS + 1 }, (_, i) => {
      const a = Math.PI * (i / TICKS)
      return {
        key: i,
        x1: CX - (R - 9) * Math.cos(a),
        y1: CY - (R - 9) * Math.sin(a),
        x2: CX - (R - 14) * Math.cos(a),
        y2: CY - (R - 14) * Math.sin(a),
        lit: i / TICKS <= pct,
      }
    })
  ), [pct])

  // ── Gesto ───────────────────────────────────────────────────────────────
  // Se guardan en refs porque el PanResponder se crea una sola vez y sus
  // callbacks capturarían valores obsoletos si leyeran las props directamente.
  const stateRef = useRef({ value, safeMax, step, onChange })
  stateRef.current = { value, safeMax, step, onChange }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => applyTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: e => applyTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
    }),
  ).current

  function applyTouch(x: number, y: number) {
    const cur = stateRef.current
    // Ángulo del punto tocado respecto al centro, medido desde el eje +X con
    // la Y invertida (en pantalla crece hacia abajo). Arriba del centro cae en
    // [0, π]: π en el extremo izquierdo (0 %) y 0 en el derecho (100 %).
    const theta = Math.atan2(CY - y, x - CX)
    // Por debajo del centro atan2 devuelve negativo y un clamp a [0, π] lo
    // llevaría siempre a 0 rad, es decir al 100 %, aunque el dedo esté en la
    // esquina inferior izquierda. Ahí manda el lado, no el ángulo.
    const clamped = theta < 0
      ? (x < CX ? Math.PI : 0)
      : Math.min(theta, Math.PI)
    const next = quantize((1 - clamped / Math.PI) * cur.safeMax, cur.step, cur.safeMax)
    if (next !== cur.value) {
      Haptics.selectionAsync().catch(() => {})
      cur.onChange(next)
    }
  }

  const shown = Number.isInteger(value) ? value : Math.round(value * 100) / 100

  // Una porción base diminuta puede generar atajos repetidos o en cero al
  // redondear (0.5 g → [0, 1, 1, 2]). Se limpian aquí y no en cada llamador:
  // los duplicados romperían además las claves de la lista.
  const chips = useMemo(
    () => Array.from(new Set((presets ?? []).filter(p => p > 0))).sort((a, b) => a - b),
    [presets],
  )

  return (
    <View style={s.wrap}>
      <View style={s.dial} {...responder.panHandlers}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <LinearGradient id="pd-fill" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={N.redSoft} />
              <Stop offset="1" stopColor={N.red} />
            </LinearGradient>
          </Defs>

          <Path d={ARC} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={11} strokeLinecap="round" />

          {ticks.map(t => (
            <Line
              key={t.key}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.lit ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.13)'}
              strokeWidth={1.5} strokeLinecap="round"
            />
          ))}

          <Path
            d={ARC} fill="none" stroke="url(#pd-fill)" strokeWidth={11} strokeLinecap="round"
            strokeDasharray={ARC_LEN}
            strokeDashoffset={ARC_LEN * (1 - pct)}
          />

          <Circle cx={knobX} cy={knobY} r={13} fill="rgba(255,255,255,0.22)" />
          <Circle cx={knobX} cy={knobY} r={9} fill={N.white} />
        </Svg>

        <View style={s.center} pointerEvents="none">
          <Text style={s.value}>{shown.toLocaleString('es-MX')}</Text>
          <Text style={s.unit}>{unitLabel ?? unit}</Text>
        </View>
      </View>

      <Text style={s.hint}>Desliza para ajustar</Text>

      {chips.length > 0 && (
        <View style={s.presets}>
          {chips.map(p => {
            const on = Math.abs(p - value) < 0.01
            return (
              <TouchableOpacity
                key={p}
                style={[s.preset, on && s.presetOn]}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {})
                  onChange(quantize(p, step, safeMax))
                }}
              >
                <Text style={[s.presetTxt, on && s.presetTxtOn]}>{p} {unit}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  dial: { width: W, height: H, justifyContent: 'flex-end' },
  center: { position: 'absolute', left: 0, right: 0, bottom: 4, alignItems: 'center' },
  value: { fontSize: 30, fontWeight: '800', color: N.white, letterSpacing: -0.5 },
  unit: { fontSize: 11, color: N.w3, marginTop: 1 },
  hint: {
    fontSize: 8.5, fontWeight: '700', letterSpacing: 1.8,
    textTransform: 'uppercase', color: N.w4, marginTop: 6,
  },
  presets: { flexDirection: 'row', gap: 6, marginTop: 12, alignSelf: 'stretch' },
  preset: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    backgroundColor: N.pane, borderWidth: 1, borderColor: N.edge,
  },
  presetOn: { backgroundColor: N.redDim, borderColor: N.red },
  presetTxt: { fontSize: 11.5, fontWeight: '800', color: N.w2 },
  presetTxtOn: { color: N.red },
})
