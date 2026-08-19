/**
 * LA RACHA SE ENCIENDE
 * ════════════════════
 * ZENA en llamas, los días encendidos y un botón. Aparece una vez al día, en el
 * primer gesto que cuenta —apuntar una comida, empezar la rutina, terminar un
 * ejercicio— y se va cuando el usuario quiere.
 *
 * ── Por qué el vídeo no lleva recorte ───────────────────────────────────────
 * Porque su fondo ya es negro puro y el de la app también. Recortar el
 * personaje habría costado una máscara por fotograma —o un formato con alfa que
 * pesa el triple— para tapar algo que no se ve. Encima, el resplandor del fuego
 * se desvanece contra el negro: un recorte duro le habría cortado justo el halo
 * que lo hace parecer caliente.
 *
 * ── Y por qué va en el paquete y no en R2 ───────────────────────────────────
 * Los vídeos de ejercicios se sirven de R2 porque son 206 y se ven cuando toca.
 * Este se ve en el instante exacto en que alguien acaba de hacer algo bien: si
 * tarda dos segundos en llegar por red, el premio llega tarde y ya no premia.
 * Recortado a 3,5 s y a 960 px pesa 2,6 MB, que es lo que cuesta que sea
 * instantáneo.
 */

import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, Dimensions } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, Easing,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { logro } from '@/utils/haptica'

const { width: ANCHO } = Dimensions.get('window')
const VIDEO = require('@/assets/video/racha.mp4')

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface Props {
  visible: boolean
  /** Días seguidos, ya contando el de hoy. */
  dias: number
  /** Qué días de esta semana están hechos, de lunes a domingo. */
  semana?: boolean[]
  onCerrar: () => void
}

export function RachaEncendida({ visible, dias, semana, onCerrar }: Props) {
  const player = useVideoPlayer(VIDEO, p => { p.loop = true; p.muted = true })
  const [montado, setMontado] = useState(false)

  const cifra = useSharedValue(0)
  const texto = useSharedValue(0)
  const boton = useSharedValue(0)

  useEffect(() => {
    if (!visible) { setMontado(false); return }
    setMontado(true)
    try { player.currentTime = 0; player.play() } catch { /* aún no listo */ }
    logro()

    /* El número entra cuando el fuego ya está alto, no a la vez: si aparece
       todo junto, la vista no sabe dónde mirar y se pierde el personaje, que
       es lo que hay que ver. */
    cifra.value = withDelay(420, withSpring(1, { damping: 11, stiffness: 130 }))
    texto.value = withDelay(620, withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }))
    /* Y el botón el último. Ofrecer «Continuar» mientras aún está entrando la
       animación es invitar a saltársela. */
    boton.value = withDelay(1500, withTiming(1, { duration: 380 }))

    return () => { try { player.pause() } catch { /* ya destruido */ } }
  }, [visible])

  const eCifra = useAnimatedStyle(() => ({
    opacity: cifra.value,
    transform: [{ scale: 0.7 + cifra.value * 0.3 }],
  }))
  const eTexto = useAnimatedStyle(() => ({
    opacity: texto.value,
    transform: [{ translateY: (1 - texto.value) * 14 }],
  }))
  const eBoton = useAnimatedStyle(() => ({
    opacity: boton.value,
    transform: [{ translateY: (1 - boton.value) * 16 }],
  }))

  const hechos = semana ?? Array.from({ length: 7 }, (_, i) => i < Math.min(dias, 7))

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent onRequestClose={onCerrar}>
      <View style={s.fondo}>
        {montado && (
          <VideoView
            player={player}
            style={s.video}
            contentFit="contain"
            nativeControls={false}
            /* Sin esto, al cerrar el modal el vídeo intenta seguir en una vista
               que ya no existe y deja el audio-session abierto. */
            allowsPictureInPicture={false}
          />
        )}

        <SafeAreaView style={s.capa} pointerEvents="box-none">
          <View style={s.centro} pointerEvents="none">
            <Animated.Text style={[s.cifra, eCifra]}>{dias}</Animated.Text>
            <Animated.View style={eTexto}>
              <Text style={s.unidad}>{dias === 1 ? 'DÍA ENCENDIDO' : 'DÍAS ENCENDIDOS'}</Text>
              <View style={s.semana}>
                {DIAS.map((d, i) => (
                  <View key={d} style={[s.dia, hechos[i] && s.diaOn]}>
                    <Text style={[s.diaTxt, hechos[i] && s.diaTxtOn]}>{d}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>

          <Animated.View style={[s.pie, eBoton]}>
            <Pressable style={s.btn} onPress={onCerrar}>
              <Text style={s.btnTxt}>Continuar</Text>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  /* Negro puro, el mismo del vídeo: cualquier otro tono dibujaría el rectángulo
     del vídeo como una caja más clara en mitad de la pantalla. */
  fondo: { flex: 1, backgroundColor: '#000' },
  video: { ...StyleSheet.absoluteFillObject },
  capa: { flex: 1, justifyContent: 'flex-end' },

  /* El texto vive en el tercio de abajo, donde el personaje deja sitio. */
  centro: { alignItems: 'center', paddingBottom: 26 },
  cifra: {
    fontSize: 88, fontWeight: '900', color: '#fff', letterSpacing: -4,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(255,90,0,0.55)', textShadowRadius: 26,
  },
  unidad: {
    fontSize: 11, fontWeight: '800', letterSpacing: 3, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', marginTop: 2,
  },
  semana: { flexDirection: 'row', gap: 7, marginTop: 20, justifyContent: 'center' },
  dia: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  diaOn: { backgroundColor: '#FF5A00' },
  diaTxt: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.3)' },
  diaTxtOn: { color: '#12060A' },

  pie: { paddingHorizontal: 22, paddingBottom: 14 },
  btn: {
    height: 52, borderRadius: 15, backgroundColor: '#FF1F3D',
    alignItems: 'center', justifyContent: 'center',
  },
  btnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
})
