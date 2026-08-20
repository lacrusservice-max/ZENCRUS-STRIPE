/**
 * LA RACHA SE ENCIENDE — «FILO»
 * ═════════════════════════════
 * Una pieza compacta que se posa sobre la app: negro absoluto, un trazo de luz
 * recorriendo el borde, el personaje disolviéndose por abajo y la cifra fundida
 * en el color del hito. Se cierra sola al acabar el vídeo, o antes con la X.
 *
 * ── El color no se elige aquí ───────────────────────────────────────────────
 * Sale entero de `hitoDe(dias)`: el filo, el aura, las chispas, la cifra, los
 * días y el botón derivan del tono del fuego de ZENA en ese vídeo. Las primeras
 * versiones ponían marcos dorados sobre un personaje rojo y peleaban. Si el
 * personaje ya trae color, la pieza es una extensión suya.
 *
 * ── La coreografía, y por qué en ese orden ──────────────────────────────────
 *   0 ms     el fondo se apaga; nada salta todavía
 *   100 ms   la pieza llega desde abajo, pasada de tamaño, y se asienta
 *   280 ms   el vídeo se revela con un barrido, no de golpe
 *   680 ms   la cifra estalla — sale al 45 %, se pasa al 114 % y se asienta
 *   920 ms   los días se encienden en cascada, uno cada 55 ms
 *   1240 ms  y por último el botón
 *
 * El botón va al final a propósito: ofrecer «Continuar» mientras aún está
 * entrando la animación es invitar a saltársela.
 *
 * ── Lo que no para ──────────────────────────────────────────────────────────
 * El filo gira cada 4,5 s, el aura late cada 4,6 s y las chispas suben a
 * ritmos distintos. Ninguno cuadra con otro: si coincidieran, el ojo pillaría
 * el bucle en dos vueltas.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, Dimensions } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, withRepeat,
  Easing, interpolate, runOnJS, type SharedValue,
} from 'react-native-reanimated'
import { hitoDe } from '@/constants/hitosRacha'
import { logro } from '@/utils/haptica'

const { width: ANCHO } = Dimensions.get('window')
const CAJA = Math.min(ANCHO - 56, 330)
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Lo que dura el vídeo. Al acabar, la pieza se va sola. */
const DURACION_MS = 10_000

interface Props {
  visible: boolean
  dias: number
  semana?: boolean[]
  onCerrar: () => void
}

export function RachaEncendida({ visible, dias, semana, onCerrar }: Props) {
  const hito = useMemo(() => hitoDe(dias), [dias])
  const player = useVideoPlayer(hito.video, p => { p.loop = true; p.muted = true })
  const [montado, setMontado] = useState(false)

  const fondo = useSharedValue(0)
  const pieza = useSharedValue(0)
  const velo = useSharedValue(0)     // el barrido que revela el vídeo
  const cifra = useSharedValue(0)
  const rotulo = useSharedValue(0)
  const boton = useSharedValue(0)
  const giro = useSharedValue(0)
  const latido = useSharedValue(0)
  const casillas = DIAS.map(() => useSharedValue(0))
  const cerrando = useRef(false)

  useEffect(() => {
    if (!visible) {
      setMontado(false)
      cerrando.current = false
      // Se dejan a cero para que la próxima vez vuelva a entrar desde el principio.
      fondo.value = 0; pieza.value = 0; velo.value = 0
      cifra.value = 0; rotulo.value = 0; boton.value = 0
      casillas.forEach(c => { c.value = 0 })
      return
    }

    setMontado(true)
    try { player.currentTime = 0; player.play() } catch { /* aún no listo */ }
    logro()

    fondo.value  = withTiming(1, { duration: 450 })
    pieza.value  = withDelay(100, withSpring(1, { damping: 13, stiffness: 130, mass: .9 }))
    velo.value   = withDelay(280, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }))
    rotulo.value = withDelay(580, withTiming(1, { duration: 500 }))
    cifra.value  = withDelay(680, withSpring(1, { damping: 9, stiffness: 150 }))
    boton.value  = withDelay(1240, withTiming(1, { duration: 450 }))
    casillas.forEach((c, i) => {
      c.value = withDelay(920 + i * 55, withSpring(1, { damping: 10, stiffness: 180 }))
    })

    // Los bucles: el filo y el aura, cada uno a su ritmo.
    giro.value = withRepeat(withTiming(1, { duration: 4500, easing: Easing.linear }), -1, false)
    latido.value = withRepeat(withTiming(1, { duration: 2300, easing: Easing.inOut(Easing.quad) }), -1, true)

    /* Se cierra al acabar el vídeo. El temporizador y no un evento del reproductor
       porque `loop` está puesto: sin bucle, el último fotograma se congelaría un
       instante antes de que saltara el «terminó», y se vería el parón. */
    const t = setTimeout(() => {
      if (!cerrando.current) { cerrando.current = true; salir() }
    }, DURACION_MS)

    return () => {
      clearTimeout(t)
      try { player.pause() } catch { /* ya destruido */ }
    }
  }, [visible, hito.video])

  /** La salida: corta y seca. La pieza se encoge y cae mientras el fondo se aclara. */
  const salir = () => {
    pieza.value = withTiming(0, { duration: 420, easing: Easing.in(Easing.cubic) })
    fondo.value = withTiming(0, { duration: 420 }, fin => {
      if (fin) runOnJS(onCerrar)()
    })
  }

  const cerrarAhora = () => {
    if (cerrando.current) return
    cerrando.current = true
    salir()
  }

  // ── Estilos animados ──────────────────────────────────────────────────────
  const eFondo = useAnimatedStyle(() => ({ opacity: fondo.value }))
  const ePieza = useAnimatedStyle(() => ({
    opacity: Math.min(1, pieza.value * 1.6),
    transform: [
      { scale: interpolate(pieza.value, [0, 1], [0.72, 1]) },
      { translateY: interpolate(pieza.value, [0, 1], [30, 0]) },
    ],
  }))
  const eGiro = useAnimatedStyle(() => ({
    transform: [{ rotate: `${giro.value * 360}deg` }],
  }))
  const eAura = useAnimatedStyle(() => ({
    opacity: interpolate(latido.value, [0, 1], [0.26, 0.48]),
    transform: [{ scale: interpolate(latido.value, [0, 1], [1, 1.09]) }],
  }))
  /* El barrido: en vez de recortar el vídeo —que en RN cuesta caro— se descubre
     tapándolo con una banda opaca que sube. Se ve igual y no toca el vídeo. */
  const eVelo = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(velo.value, [0, 1], [0, -CAJA * 1.1]) }],
  }))
  const eRotulo = useAnimatedStyle(() => ({
    opacity: rotulo.value,
    transform: [{ translateY: interpolate(rotulo.value, [0, 1], [11, 0]) }],
  }))
  const eCifra = useAnimatedStyle(() => ({
    opacity: Math.min(1, cifra.value * 2),
    transform: [{ scale: interpolate(cifra.value, [0, 1], [0.45, 1]) }],
  }))
  const eBoton = useAnimatedStyle(() => ({
    opacity: boton.value,
    transform: [{ translateY: interpolate(boton.value, [0, 1], [11, 0]) }],
  }))

  const hechos = semana ?? Array.from({ length: 7 }, (_, i) => i < Math.min(dias, 7))

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={cerrarAhora}>
      <View style={s.raiz}>
        <Animated.View style={[StyleSheet.absoluteFill, s.telon, eFondo]} />

        <Animated.View style={[s.pieza, ePieza]}>
          {/* EL FILO: un degradado que gira detrás, tapado por el cuerpo salvo
              en el borde. Es la forma de tener un gradiente cónico en RN, que
              no lo trae de fábrica. */}
          <View style={s.filoCaja}>
            <Animated.View style={[s.filoGiro, eGiro]}>
              <LinearGradient
                colors={['transparent', hito.neon, hito.claro, hito.neon, 'transparent']}
                locations={[0, 0.18, 0.3, 0.42, 0.62]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            <View style={s.cuerpo}>
              {/* El aura, latiendo bajo el contenido. */}
              <Animated.View style={[s.aura, eAura]} pointerEvents="none">
                <Svg width="100%" height="100%">
                  <Defs>
                    <RadialGradient id="aura" cx="50%" cy="100%" rx="70%" ry="100%">
                      <Stop offset="0" stopColor={hito.neon} stopOpacity="0.85" />
                      <Stop offset="1" stopColor={hito.neon} stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Rect width="100%" height="100%" fill="url(#aura)" />
                </Svg>
              </Animated.View>

              <Pressable style={s.equis} onPress={cerrarAhora} hitSlop={10}>
                <Text style={s.equisTxt}>✕</Text>
              </Pressable>

              <View style={s.marco}>
                {montado && (
                  <VideoView
                    player={player}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    nativeControls={false}
                    allowsPictureInPicture={false}
                  />
                )}
                {/* Disuelve al personaje por abajo, para que no haya un corte
                    recto entre el vídeo y el fondo de la pieza. */}
                <LinearGradient
                  colors={['transparent', 'rgba(6,6,8,0.65)', '#060608']}
                  locations={[0.42, 0.78, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                {/* El barrido que lo revela al entrar. */}
                <Animated.View style={[s.barrido, eVelo]} pointerEvents="none" />
              </View>

              <View style={s.datos}>
                <Animated.Text style={[s.titulo, { color: hito.claro }, eRotulo]}>
                  {hito.titulo.toUpperCase()}
                </Animated.Text>

                <Animated.Text
                  style={[s.cifra, {
                    color: hito.claro,
                    textShadowColor: hito.neon,
                  }, eCifra]}
                >
                  {dias}
                </Animated.Text>

                <Animated.Text style={[s.unidad, eRotulo]}>
                  {dias === 1 ? 'DÍA ENCENDIDO' : 'DÍAS ENCENDIDOS'}
                </Animated.Text>

                <View style={s.semana}>
                  {DIAS.map((d, i) => (
                    <Casilla
                      key={d}
                      letra={d}
                      on={hechos[i]}
                      hito={hito}
                      progreso={casillas[i]}
                    />
                  ))}
                </View>

                <Animated.View style={eBoton}>
                  <Pressable
                    style={[s.cta, {
                      borderColor: hito.neon + '7A',
                      backgroundColor: hito.neon + '17',
                    }]}
                    onPress={cerrarAhora}
                  >
                    <Text style={[s.ctaTxt, { color: hito.claro }]}>Continuar</Text>
                  </Pressable>
                </Animated.View>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

/** Un día de la semana, con su propio rebote. */
function Casilla({ letra, on, hito, progreso }: {
  letra: string
  on: boolean
  hito: ReturnType<typeof hitoDe>
  progreso: SharedValue<number>
}) {
  const e = useAnimatedStyle(() => ({
    opacity: Math.min(1, progreso.value * 2),
    transform: [{ scale: interpolate(progreso.value, [0, 1], [0.3, 1]) }],
  }))
  return (
    <Animated.View
      style={[
        s.dia,
        on && { backgroundColor: hito.neon, shadowColor: hito.neon },
        e,
      ]}
    >
      <Text style={[s.diaTxt, on && { color: hito.fondo }]}>{letra}</Text>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  telon: { backgroundColor: 'rgba(0,0,0,0.88)' },

  pieza: { width: CAJA },

  /* El filo: 1,2 px de gradiente asomando por el borde. */
  filoCaja: {
    borderRadius: 26,
    padding: 1.2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 24,
  },
  /* Cuadrado y más grande que la caja: al girar, sus esquinas nunca dejan
     hueco sin cubrir. Con un rectángulo justo, el borde parpadearía. */
  filoGiro: {
    position: 'absolute',
    width: CAJA * 1.6,
    height: CAJA * 1.6,
    left: -CAJA * 0.3,
    top: -CAJA * 0.3,
  },
  cuerpo: { borderRadius: 25, overflow: 'hidden', backgroundColor: '#060608' },

  aura: {
    position: 'absolute',
    left: -CAJA * 0.16, right: -CAJA * 0.16, bottom: -CAJA * 0.3,
    height: CAJA * 0.8,
  },

  equis: {
    position: 'absolute', top: 11, right: 11, zIndex: 30,
    width: 27, height: 27, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
  },
  equisTxt: { color: 'rgba(255,255,255,0.62)', fontSize: 12, lineHeight: 14 },

  marco: { width: '100%', aspectRatio: 1.1, overflow: 'hidden' },
  barrido: {
    position: 'absolute',
    left: 0, right: 0, top: 0,
    height: CAJA * 1.1,
    backgroundColor: '#060608',
  },

  datos: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, marginTop: -14 },
  titulo: { fontSize: 9.5, fontWeight: '800', letterSpacing: 3 },
  cifra: {
    fontSize: 58, fontWeight: '900', letterSpacing: -3.5, lineHeight: 60, marginTop: 3,
    fontVariant: ['tabular-nums'],
    textShadowRadius: 24, textShadowOffset: { width: 0, height: 0 },
  },
  unidad: {
    fontSize: 8, fontWeight: '700', letterSpacing: 2.3,
    color: 'rgba(255,255,255,0.38)',
  },
  semana: { flexDirection: 'row', gap: 4.5, marginTop: 13 },
  dia: {
    width: 21, height: 21, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    shadowOpacity: 0.75, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  diaTxt: { fontSize: 8, fontWeight: '800', color: 'rgba(255,255,255,0.22)' },

  cta: {
    marginTop: 15, height: 43, width: CAJA - 32, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  ctaTxt: { fontSize: 12.5, fontWeight: '800' },
})
