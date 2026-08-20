/**
 * EL REACTOR
 * ══════════
 * El medidor de la página de rachas: una columna a presión con el núcleo
 * incandescente al fondo, anillos metálicos y una escala con los seis hitos.
 *
 * ── El desenfoque no es adorno ──────────────────────────────────────────────
 * Los hitos bloqueados se difuminan MÁS cuanto más lejos quedan: el siguiente
 * se lee nítido, el de después algo borroso, y los mil días casi no se leen.
 * Así el desenfoque dice cuánto falta sin escribir un número, y al subir de
 * nivel cada hito se va enfocando — se ve venir el premio antes de llegar.
 *
 * ── Por qué el núcleo no sube de forma lineal ───────────────────────────────
 * La escala va de 1 a 1000, y con reparto proporcional los cinco primeros
 * hitos se apelotonarían en el 20 % de abajo mientras los mil días se quedan
 * solos arriba. Los tramos se reparten a partes iguales y dentro de cada uno
 * se interpola: así el trecho de 1 a 100 ocupa lo mismo que el de 600 a 1000,
 * que es lo que hace que el nivel se mueva de forma perceptible cada día.
 */

import { useEffect } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withRepeat,
  withSequence, Easing, interpolate,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { HITOS, type Hito } from '@/constants/hitosRacha'
import { Colors } from '@/constants/theme'

const N = Colors.neon
/** De abajo (primer hito) a arriba (el último). */
const ESCALA = [...HITOS].reverse()

/**
 * Dónde cae una racha en la columna, de 0 a 1.
 *
 * Reparto por tramos, no proporcional — ver la cabecera del fichero.
 */
export function alturaDe(dias: number): number {
  const paso = 1 / (ESCALA.length - 1)
  for (let i = ESCALA.length - 1; i >= 0; i--) {
    if (dias >= ESCALA[i].desde) {
      if (i === ESCALA.length - 1) return 1
      const desde = ESCALA[i].desde
      const hasta = ESCALA[i + 1].desde
      const dentro = (dias - desde) / (hasta - desde)
      return Math.min(1, paso * (i + dentro))
    }
  }
  /* Por debajo del primer hito —racha de cero— se deja un dedo de núcleo
     encendido igualmente: un reactor a cero se lee como apagado, y la racha
     de cero días es un estado transitorio, no una avería. */
  return Math.max(0.04, (dias / ESCALA[0].desde) * paso * 0.5)
}

interface Props {
  dias: number
  /** Se llama al tocar un hito. */
  onHito?: (h: Hito) => void
}

export function Reactor({ dias, onHito }: Props) {
  const nivel = useSharedValue(0)
  const hervor = useSharedValue(0)
  const testigo = useSharedValue(0)

  useEffect(() => {
    nivel.value = withDelay(280, withTiming(alturaDe(dias), {
      duration: 1400, easing: Easing.out(Easing.cubic),
    }))
    hervor.value = withRepeat(withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.quad) }), -1, true)
    testigo.value = withRepeat(
      withSequence(withTiming(1, { duration: 900 }), withTiming(0.35, { duration: 900 })), -1, false)
  }, [dias])

  const eNucleo = useAnimatedStyle(() => ({
    height: `${4 + nivel.value * 92}%`,
    transform: [{ scaleY: interpolate(hervor.value, [0, 1], [1, 1.03]) }],
  }))
  const eTestigo = useAnimatedStyle(() => ({ opacity: testigo.value }))
  const eMarca = useAnimatedStyle(() => ({
    bottom: `${2 + nivel.value * 92}%`,
    opacity: nivel.value > 0.02 ? 1 : 0,
  }))

  return (
    <View style={s.marco}>
      {/* ── La columna ── */}
      <View style={s.tubo}>
        <Animated.View style={[s.nucleo, eNucleo]}>
          <LinearGradient
            colors={['#FFE9C4', '#FF9166', '#FF4A2E', '#8E1B0A']}
            locations={[0, 0.3, 0.62, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* La rejilla de contención, encima del núcleo. */}
        <View style={s.rejilla} pointerEvents="none">
          {Array.from({ length: 26 }).map((_, i) => <View key={i} style={s.rejillaLinea} />)}
        </View>

        {/* Los anillos metálicos: brillo arriba, sombra abajo. */}
        <View style={s.aros} pointerEvents="none">
          {Array.from({ length: 5 }).map((_, i) => (
            <LinearGradient
              key={i}
              colors={['#3A3A46', '#15151C', '#2A2A34']}
              style={s.aro}
            />
          ))}
        </View>

        <Animated.View style={[s.testigo, eTestigo]} pointerEvents="none">
          <Text style={s.testigoTxt}>ACTIVO</Text>
        </Animated.View>
      </View>

      {/* ── La escala ── */}
      <View style={s.escala}>
        {/* La marca de dónde estás, atada al mismo valor que el núcleo. */}
        <Animated.View style={[s.tuMarca, eMarca]} pointerEvents="none">
          <View style={s.tuRaya} />
          <View style={s.tuPildora}>
            <Text style={s.tuTxt}>TÚ · {dias}</Text>
          </View>
        </Animated.View>

        {ESCALA.map((h, i) => (
          <Peldano
            key={h.desde}
            hito={h}
            dias={dias}
            indice={i}
            onPress={onHito ? () => onHito(h) : undefined}
          />
        ))}
      </View>
    </View>
  )
}

/**
 * Un hito de la escala.
 *
 * El desenfoque crece con la distancia al siguiente hito pendiente, no con la
 * posición en la lista: quien lleva 300 días ve nítidos los 400 y borrosos los
 * mil, igual que quien lleva 2 ve nítido el 100.
 */
function Peldano({ hito, dias, indice, onPress }: {
  hito: Hito
  dias: number
  indice: number
  onPress?: () => void
}) {
  const logrado = dias >= hito.desde
  const siguiente = ESCALA.findIndex(h => dias < h.desde)
  const esSiguiente = indice === siguiente
  const lejania = siguiente >= 0 ? Math.max(0, indice - siguiente) : 0

  const desenfoque = logrado || esSiguiente ? 0 : Math.min(3.2, lejania * 0.95)
  const opacidad = logrado || esSiguiente ? 1 : Math.max(0.3, 1 - lejania * 0.17)

  const entrada = useSharedValue(0)
  useEffect(() => {
    entrada.value = withDelay(360 + indice * 80, withTiming(1, { duration: 460 }))
  }, [])
  const eEntrada = useAnimatedStyle(() => ({
    opacity: entrada.value * opacidad,
    transform: [{ translateX: interpolate(entrada.value, [0, 1], [14, 0]) }],
  }))

  const pulso = useSharedValue(0)
  useEffect(() => {
    if (!esSiguiente) return
    pulso.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false)
  }, [esSiguiente])
  const eOnda = useAnimatedStyle(() => ({
    opacity: interpolate(pulso.value, [0, 1], [0.9, 0]),
    transform: [{ scale: interpolate(pulso.value, [0, 1], [0.85, 1.9]) }],
  }))

  return (
    <Animated.View style={[s.peldano, eEntrada, { }]}>
      <Pressable onPress={onPress} disabled={!onPress} style={s.peldanoTocar}>
        <View style={[
          s.disco,
          /* El desenfoque va en el disco y el texto por separado: aplicarlo al
             contenedor arrastraría también la onda del hito siguiente. */
          { opacity: 1 },
          logrado && { borderColor: hito.neon + 'CC', shadowColor: hito.neon, shadowOpacity: 0.6 },
          esSiguiente && { borderColor: hito.neon, shadowColor: hito.neon, shadowOpacity: 0.85 },
        ]}>
          {esSiguiente && (
            <Animated.View style={[s.onda, { borderColor: hito.neon }, eOnda]} pointerEvents="none" />
          )}
          <View style={[
            s.punto,
            { backgroundColor: logrado || esSiguiente ? hito.neon : 'rgba(255,255,255,0.2)' },
            desenfoque > 0 && { opacity: 0.55 },
          ]} />
        </View>

        <View style={[s.textos, desenfoque > 0 && { opacity: 0.75 }]}>
          <Text style={[
            s.cifra,
            { color: logrado || esSiguiente ? hito.claro : 'rgba(255,255,255,0.34)' },
          ]}>
            {hito.desde}
          </Text>
          <Text style={s.rotulo}>{hito.titulo}</Text>
        </View>

        {!logrado && !esSiguiente && <Text style={s.candado}>🔒</Text>}
      </Pressable>

      {/* El velo que difumina: React Native no tiene blur por elemento, así que
          se simula tapando con el color del fondo. A más lejos, más tapado. */}
      {desenfoque > 0 && (
        <View
          style={[s.velo, { opacity: Math.min(0.62, desenfoque * 0.2) }]}
          pointerEvents="none"
        />
      )}
    </Animated.View>
  )
}

const s = StyleSheet.create({
  marco: { flexDirection: 'row', gap: 15, minHeight: 400 },

  tubo: {
    width: 64, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#0F0F16',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
    marginBottom: 12,
  },
  nucleo: {
    position: 'absolute', left: 4, right: 4, bottom: 4,
    borderRadius: 9, overflow: 'hidden',
    shadowColor: '#FF4A2E', shadowOpacity: 0.9, shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  rejilla: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', opacity: 0.5 },
  rejillaLinea: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  aros: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-around' },
  aro: { height: 7 },
  testigo: {
    position: 'absolute', top: 8, alignSelf: 'center',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(10,4,2,0.85)',
    borderWidth: 1, borderColor: 'rgba(255,74,46,0.4)',
  },
  testigoTxt: { fontSize: 6, fontWeight: '900', letterSpacing: 1.4, color: '#FF4A2E' },

  escala: { flex: 1, flexDirection: 'column-reverse', justifyContent: 'space-between', paddingVertical: 10 },
  peldano: { position: 'relative' },
  peldanoTocar: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 3 },
  velo: { ...StyleSheet.absoluteFillObject, backgroundColor: '#06060A' },

  disco: {
    width: 34, height: 34, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10101A',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
    shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
  },
  onda: { position: 'absolute', width: 42, height: 42, borderRadius: 22, borderWidth: 1.5 },
  punto: { width: 11, height: 11, borderRadius: 6 },

  textos: { flex: 1 },
  cifra: { fontSize: 16, fontWeight: '900', letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  rotulo: {
    fontSize: 7.5, fontWeight: '700', letterSpacing: 1,
    textTransform: 'uppercase', color: N.w3, marginTop: 1,
  },
  candado: { fontSize: 9, opacity: 0.22 },

  tuMarca: { position: 'absolute', left: -18, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 20 },
  tuRaya: {
    width: 12, height: 2, backgroundColor: '#FF4A2E',
    shadowColor: '#FF4A2E', shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  tuPildora: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: '#3A1108' },
  tuTxt: { fontSize: 6.5, fontWeight: '900', letterSpacing: 1.3, color: '#FF4A2E' },
})
