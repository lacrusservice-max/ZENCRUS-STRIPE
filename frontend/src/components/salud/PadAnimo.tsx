/**
 * EL PAD DE ÁNIMO
 * ═══════════════════════════════════════════════════════════════════════════
 * Dos ejes continuos que se recorren con el dedo, no una lista de emociones.
 *
 * ── Por qué no una lista de palabras ───────────────────────────────────────
 * Una lista obliga a elegir entre «ansiosa» e «irritable», y dos personas usan
 * esas palabras para cosas distintas —incluso la misma persona, en dos meses
 * distintos—. Sobre eso no se puede promediar nada, y sin poder promediar no
 * hay correlación con la fase, que es justo lo que este módulo quiere calcular.
 *
 * Valencia (mal ↔ bien) y activación (apagada ↔ acelerada) son los dos ejes del
 * modelo circumplejo del afecto, que es el estándar en psicología para esto
 * mismo. Son continuos, comparables y promediables.
 *
 * ── Y por qué SÍ aparece una palabra ───────────────────────────────────────
 * Debajo, y como consecuencia de dónde se ha puesto el punto, no como opción a
 * elegir. Sirve para confirmar que el sitio del pad es el correcto —«sí, hoy
 * estoy tensa»— sin que la palabra sea el dato. El dato son las coordenadas.
 *
 * ── El punto arranca en el centro y eso NO es una respuesta ────────────────
 * Mientras no se toque, no hay valor: el punto se pinta hueco y el guardado no
 * ocurre. Un pad que naciera con el punto puesto guardaría una afirmación sobre
 * el ánimo de alguien que esa persona no ha hecho.
 */

import { useCallback, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated'
import { base, space, radius, family, type as tipo, easing } from '@/theme/salud/tokens'
import { elegir } from '@/utils/haptica'

const LADO = 220
const PUNTO = 30

/**
 * Las palabras del plano.
 *
 * Se eligen por cuadrante y por intensidad: cerca del centro las suaves, en las
 * esquinas las fuertes. Sin eso, mover el dedo un milímetro cambiaría de
 * «serena» a «eufórica» y el pad parecería no entender nada.
 */
const PALABRAS: Array<{ v: number; a: number; txt: string }> = [
  { v:  0.8, a:  0.8, txt: 'Eufórica' },
  { v:  0.5, a:  0.4, txt: 'Animada' },
  { v:  0.8, a: -0.8, txt: 'En paz' },
  { v:  0.5, a: -0.4, txt: 'Tranquila' },
  { v: -0.8, a:  0.8, txt: 'Desbordada' },
  { v: -0.5, a:  0.4, txt: 'Tensa' },
  { v: -0.8, a: -0.8, txt: 'Hundida' },
  { v: -0.5, a: -0.4, txt: 'Apagada' },
  { v:  0.0, a:  0.0, txt: 'Normal' },
]

function palabraDe(v: number, a: number): string {
  let mejor = PALABRAS[0]
  let dist = Infinity
  for (const p of PALABRAS) {
    const d = (p.v - v) ** 2 + (p.a - a) ** 2
    if (d < dist) { dist = d; mejor = p }
  }
  return mejor.txt
}

export function PadAnimo({ valor, onChange, tono }: {
  valor: { valence: number; arousal: number } | null
  onChange: (v: { valence: number; arousal: number }) => void
  tono: string
}) {
  const centro = (LADO - PUNTO) / 2
  const aPx = (n: number) => centro + (n * (LADO - PUNTO)) / 2

  const x = useSharedValue(valor ? aPx(valor.valence) : centro)
  const y = useSharedValue(valor ? aPx(-valor.arousal) : centro)
  const puesto = useSharedValue(valor ? 1 : 0)

  const emitir = useCallback((px: number, py: number) => {
    const v = ((px - centro) / ((LADO - PUNTO) / 2))
    const a = -((py - centro) / ((LADO - PUNTO) / 2))
    const r = (n: number) => Math.round(Math.max(-1, Math.min(1, n)) * 100) / 100
    elegir()
    onChange({ valence: r(v), arousal: r(a) })
  }, [centro, onChange])

  const pan = useMemo(() => Gesture.Pan()
    .onBegin(e => {
      puesto.value = 1
      x.value = Math.max(0, Math.min(LADO - PUNTO, e.x - PUNTO / 2))
      y.value = Math.max(0, Math.min(LADO - PUNTO, e.y - PUNTO / 2))
    })
    .onUpdate(e => {
      x.value = Math.max(0, Math.min(LADO - PUNTO, e.x - PUNTO / 2))
      y.value = Math.max(0, Math.min(LADO - PUNTO, e.y - PUNTO / 2))
    })
    /* Se guarda al soltar y no en cada frame: guardar durante el arrastre
       encolaría sesenta escrituras por segundo para un solo gesto. */
    .onEnd(() => { runOnJS(emitir)(x.value, y.value) }),
  [emitir, puesto, x, y])

  const estiloPunto = useAnimatedStyle(() => ({
    transform: [
      { translateX: withSpring(x.value, easing.spring) },
      { translateY: withSpring(y.value, easing.spring) },
    ],
    backgroundColor: puesto.value ? tono : 'transparent',
    borderColor: puesto.value ? tono : base.textLow,
  }))

  const palabra = valor ? palabraDe(valor.valence, valor.arousal) : null

  return (
    <View style={s.wrap}>
      <View style={s.filaEje}>
        <Text style={s.eje}>acelerada</Text>
      </View>

      <View style={s.medio}>
        <Text style={[s.eje, s.ejeLat]}>mal</Text>

        <GestureDetector gesture={pan}>
          <View
            style={s.pad}
            accessibilityRole="adjustable"
            accessibilityLabel={palabra ? `Ánimo: ${palabra}` : 'Ánimo sin marcar'}
          >
            {/* Cruceta: marca el centro sin dibujar una rejilla. */}
            <View style={[s.cruz, s.cruzH]} />
            <View style={[s.cruz, s.cruzV]} />
            <Animated.View style={[s.punto, estiloPunto]} />
          </View>
        </GestureDetector>

        <Text style={[s.eje, s.ejeLat]}>bien</Text>
      </View>

      <View style={s.filaEje}>
        <Text style={s.eje}>apagada</Text>
      </View>

      <Text style={[s.palabra, !palabra && s.sinMarcar, palabra ? { color: tono } : null]}>
        {palabra ?? 'arrastra el punto'}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  filaEje: { height: 16, justifyContent: 'center' },
  medio: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eje: { fontFamily: family.ui, fontSize: 10, color: base.textLow },
  ejeLat: { width: 30, textAlign: 'center' },

  pad: {
    width: LADO, height: LADO, borderRadius: radius.lg,
    backgroundColor: base.surface2, overflow: 'hidden',
  },
  cruz: { position: 'absolute', backgroundColor: base.hairline },
  cruzH: { left: 0, right: 0, top: LADO / 2, height: 1 },
  cruzV: { top: 0, bottom: 0, left: LADO / 2, width: 1 },

  punto: {
    position: 'absolute', width: PUNTO, height: PUNTO,
    borderRadius: PUNTO / 2, borderWidth: 2,
  },

  palabra: {
    fontFamily: family.uiSemi, fontSize: tipo.ui.md,
    marginTop: space.sm, color: base.textHi,
  },
  sinMarcar: { fontFamily: family.ui, color: base.textLow, fontStyle: 'italic' },
})
