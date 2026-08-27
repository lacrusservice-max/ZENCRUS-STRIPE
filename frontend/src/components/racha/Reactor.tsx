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
  withSequence, Easing, interpolate, type SharedValue,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { HITOS, type Hito } from '@/constants/hitosRacha'
import { Llama } from './Llama'
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

/**
 * Las brasas que suben del núcleo.
 *
 * Estaban en la maqueta y se me quedaron fuera al pasarlo a la app: sin ellas
 * el tubo es un rectángulo con relleno, y con ellas se lee como algo que arde.
 *
 * Las posiciones y los ritmos son fijos, no sorteados: con `Math.random` cada
 * render las recolocaría y el ojo pillaría el salto.
 */
const BRASAS = [
  { x: 0.22, tam: 3, dur: 2400, espera: 0,    deriva: -5 },
  { x: 0.58, tam: 2, dur: 3100, espera: 700,  deriva: 4 },
  { x: 0.38, tam: 4, dur: 2700, espera: 1300, deriva: 6 },
  { x: 0.72, tam: 2, dur: 3400, espera: 400,  deriva: -3 },
  { x: 0.46, tam: 3, dur: 2900, espera: 1900, deriva: 2 },
  { x: 0.30, tam: 2, dur: 3600, espera: 2400, deriva: 7 },
]

function Brasa({ dato, alto, base }: {
  dato: typeof BRASAS[number]
  alto: SharedValue<number>
  base: SharedValue<number>
}) {
  const v = useSharedValue(0)
  useEffect(() => {
    v.value = withDelay(dato.espera, withRepeat(
      withTiming(1, { duration: dato.dur, easing: Easing.out(Easing.quad) }), -1, false))
  }, [])

  const e = useAnimatedStyle(() => {
    /* Nacen en la superficie del núcleo y suben. Al ir atadas a `base`, cuando
       el nivel sube las brasas arrancan más arriba: salen del fuego, no de un
       punto fijo del tubo. */
    const desde = alto.value * (0.04 + base.value * 0.92)
    return {
      opacity: interpolate(v.value, [0, 0.15, 0.75, 1], [0, 0.9, 0.5, 0]),
      transform: [
        { translateY: -(desde + v.value * alto.value * 0.55) },
        { translateX: v.value * dato.deriva },
        { scale: interpolate(v.value, [0, 1], [1, 0.35]) },
      ],
    }
  })

  return (
    <Animated.View
      style={[
        s.brasa,
        { left: `${dato.x * 100}%`, width: dato.tam, height: dato.tam, borderRadius: dato.tam },
        e,
      ]}
      pointerEvents="none"
    />
  )
}

interface Props {
  dias: number
  /** Se llama al tocar un hito. */
  onHito?: (h: Hito) => void
}

export function Reactor({ dias, onHito }: Props) {
  /* La altura del tubo, medida al vuelo.
     Reanimated no interpola alturas en porcentaje de forma fiable: el núcleo
     se quedaba clavado en su valor inicial y parecía que no había animación
     ninguna. Con la medida real se anima un número de píxeles, que sí. */
  /* También como shared value: los estilos animados leen de aquí en vez de
     capturar el estado de React, que en la nueva arquitectura no siempre
     reevalúa el worklet al cambiar. */
  const alto = useSharedValue(0)
  const nivel = useSharedValue(0)
  const hervor = useSharedValue(0)
  const testigo = useSharedValue(0)

  /* Los bucles NO dependen de la medida del tubo.
     Estaban detrás de un `if (!altoTubo) return` junto con la subida del
     núcleo, así que mientras `onLayout` no respondiera no arrancaba NADA: ni el
     hervor, ni el testigo, ni las brasas. Una sola guarda mal puesta dejaba la
     pantalla entera congelada. */
  useEffect(() => {
    hervor.value = withRepeat(withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.quad) }), -1, true)
    testigo.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0.12, { duration: 700 })), -1, false)
  }, [])

  useEffect(() => {
    /* Arranca desde cero en cada montaje para que la subida SE VEA. Sin esto,
       al volver a la pantalla el núcleo ya estaría arriba y la animación —que
       es lo que cuenta la historia— se la perdería quien vuelve. */
    nivel.value = 0
    nivel.value = withDelay(280, withTiming(alturaDe(dias), {
      duration: 1400, easing: Easing.out(Easing.cubic),
    }))
  }, [dias])

  /* El hervor mueve la ALTURA, no un `scaleY` del 3 %.
     Escalar un gradiente lo deforma y, sobre un núcleo pequeño, tres píxeles no
     los ve nadie: la primera versión animaba de verdad y aun así se leía como
     una pantalla congelada. El vaivén es una fracción fija del TUBO, así que se
     escala solo — con la racha a cero el núcleo mide un dedo y respirar ±1,8 %
     de la columna lo cambia a la mitad de su tamaño, que es justo la señal de
     «esto está esperando a que lo enciendas»; con la racha llena esos mismos
     píxeles son un temblor discreto, que es lo que le toca a un reactor
     a plena carga. */
  const eNucleo = useAnimatedStyle(() => {
    const base = 0.04 + nivel.value * 0.92
    const vaiven = interpolate(hervor.value, [0, 1], [-0.018, 0.018])
    return { height: Math.max(10, alto.value * Math.max(0.03, base + vaiven)) }
  })

  /* La lengua de fuego de la superficie: lo que de verdad se lee como arder.
     Crece y se aclara con el mismo ciclo que el núcleo, medio compás por
     delante, para que el borde parezca lamer y no subir en bloque. */
  const eLengua = useAnimatedStyle(() => ({
    height: interpolate(hervor.value, [0, 1], [9, 27]),
    opacity: interpolate(hervor.value, [0, 1], [0.3, 1]),
  }))

  const eTestigo = useAnimatedStyle(() => ({ opacity: testigo.value }))
  const eMarca = useAnimatedStyle(() => ({
    bottom: Math.max(6, alto.value * (0.02 + nivel.value * 0.92)),
    opacity: nivel.value > 0.02 ? 1 : 0,
  }))

  return (
    <View style={s.marco}>
      {/* ── La columna ── */}
      <View style={s.tubo} onLayout={e => { alto.value = e.nativeEvent.layout.height }}>
        <Animated.View style={[s.nucleo, eNucleo]}>
          <LinearGradient
            colors={['#FFFFFF', '#FFA45C', '#FF7A1F', '#B33D00']}
            locations={[0, 0.3, 0.62, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={[s.lengua, eLengua]} pointerEvents="none">
            <LinearGradient
              colors={['rgba(255,233,196,0)', '#FFE9C4']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
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
              colors={['#2A2C32', '#17181C', '#2A2C32']}
              style={s.aro}
            />
          ))}
        </View>

        {/* Las brasas, sobre el núcleo y bajo los anillos. */}
        {BRASAS.map((b, i) => (
          <Brasa key={i} dato={b} alto={alto} base={nivel} />
        ))}

        {/* A cero días el reactor NO está activo, y ponerlo sería mentir sobre
            lo único que esta pantalla tiene que decir. En espera va en ámbar:
            no es un error —es un reactor listo para encenderse—. */}
        <Animated.View
          style={[s.testigo, dias > 0 ? null : s.testigoEspera, eTestigo]}
          pointerEvents="none"
        >
          <Text style={[s.testigoTxt, dias > 0 ? null : s.testigoTxtEspera]}>
            {dias > 0 ? 'ACTIVO' : 'EN ESPERA'}
          </Text>
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
          {/* La llama, no un punto: es el signo de la racha y lo que hace que
              cada peldaño se lea como fuego y no como una viñeta. */}
          <View style={desenfoque > 0 ? { opacity: 0.5 } : undefined}>
            <Llama
              tam={18}
              neon={hito.neon}
              claro={hito.claro}
              apagada={!logrado && !esSiguiente}
              fondo="#10101A"
            />
          </View>
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
    backgroundColor: '#0D0D10',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
    marginBottom: 12,
  },
  nucleo: {
    position: 'absolute', left: 4, right: 4, bottom: 4,
    borderRadius: 9, overflow: 'hidden',
    shadowColor: '#FF7A1F', shadowOpacity: 0.9, shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  rejilla: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', opacity: 0.5 },
  rejillaLinea: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  aros: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-around' },
  aro: { height: 7 },
  brasa: {
    position: 'absolute', bottom: 0,
    backgroundColor: '#FFA45C',
    shadowColor: '#FFA45C', shadowOpacity: 0.95, shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 5,
  },
  testigo: {
    position: 'absolute', top: 8, alignSelf: 'center',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(5,5,5,0.85)',
    borderWidth: 1, borderColor: 'rgba(255,122,31,0.4)',
  },
  testigoTxt: { fontSize: 6, fontWeight: '900', letterSpacing: 1.4, color: '#FF7A1F' },
  testigoEspera: { borderColor: 'rgba(255,176,31,0.45)' },
  testigoTxtEspera: { color: '#FFB01F' },

  /* La superficie del núcleo. Va dentro de él, pegada arriba, y por eso sube
     con él sin que haya que atarla a nada más. */
  lengua: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },

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

  textos: { flex: 1 },
  cifra: { fontSize: 16, fontWeight: '900', letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  rotulo: {
    fontSize: 7.5, fontWeight: '700', letterSpacing: 1,
    textTransform: 'uppercase', color: N.w3, marginTop: 1,
  },
  candado: { fontSize: 9, opacity: 0.22 },

  tuMarca: { position: 'absolute', left: -18, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 20 },
  tuRaya: {
    width: 12, height: 2, backgroundColor: '#FF7A1F',
    shadowColor: '#FF7A1F', shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  tuPildora: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: '#17181C' },
  tuTxt: { fontSize: 6.5, fontWeight: '900', letterSpacing: 1.3, color: '#FF7A1F' },
})
