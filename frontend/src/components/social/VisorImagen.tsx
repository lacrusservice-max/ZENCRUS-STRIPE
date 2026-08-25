/**
 * VISOR DE IMAGEN A PANTALLA COMPLETA
 * ──────────────────────────────────
 * Se abre al tocar una foto del chat. Enseña la imagen ENTERA —nada recortado—
 * sobre negro, con pellizco para acercar.
 *
 * ── Por qué hacía falta ─────────────────────────────────────────────────────
 * En el hilo las fotos van en una caja fija y recortadas al centro: es lo que
 * mantiene el ritmo de la conversación cuando llegan diez seguidas. Pero eso
 * significa que una foto vertical se ve por la mitad, y hasta ahora no había
 * ningún sitio donde verla completa.
 *
 * ── Sin librerías nuevas ────────────────────────────────────────────────────
 * `react-native-gesture-handler` y `reanimated` ya están montados y el root de
 * gestos vive en `app/_layout.tsx`. Meter un visor de terceros habría traído
 * otro módulo nativo y, con él, recompilar el cliente de desarrollo.
 *
 * ── Guardar en el carrete ───────────────────────────────────────────────────
 * La foto vive en el bucket detrás de una dirección FIRMADA que caduca, así
 * que no vale con apuntar a ella: hay que bajarla al disco de la app y de ahí
 * meterla en el carrete. Son dos permisos distintos en iOS —leer y añadir— y
 * aquí solo hace falta el de añadir.
 *
 * Se borra el archivo intermedio en cuanto la foto está en el carrete: si no,
 * cada guardado dejaría una copia dentro de la app ocupando sitio para nada.
 *
 * ── Las tres salidas ────────────────────────────────────────────────────────
 * La cruz, arrastrar hacia abajo, y el botón físico de Android (`Modal` lo da
 * con `onRequestClose`). Un toque suelto NO cierra: con la imagen acercada,
 * cualquier intento de arrastrar acabaría cerrándola sin querer.
 */

import { useState } from 'react'
import {
  Modal, View, Text, StyleSheet, Pressable, useWindowDimensions,
  ActivityIndicator, Alert,
} from 'react-native'
// `File` se renombra: el nombre a secas choca con el `File` del DOM que
// TypeScript trae de serie, y la anotación acababa apuntando al otro.
import { File as Fichero, Paths } from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, interpolate,
} from 'react-native-reanimated'
import { Image } from '@/components/ui/Imagen'

/** Hasta dónde deja acercar. Más de esto ya es ver el grano del JPEG. */
const ZOOM_MAX = 4
/** Cuánto hay que arrastrar para que cierre. */
const CIERRE = 110

export function VisorImagen({
  uri, abierto, onCerrar,
}: {
  uri: string | null
  abierto: boolean
  onCerrar: () => void
}) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [guardando, setGuardando] = useState(false)
  const [guardada, setGuardada] = useState(false)

  const escala = useSharedValue(1)
  const escalaGuardada = useSharedValue(1)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const xGuardada = useSharedValue(0)
  const yGuardada = useSharedValue(0)

  const reponer = () => {
    'worklet'
    escala.value = withTiming(1)
    escalaGuardada.value = 1
    x.value = withTiming(0); y.value = withTiming(0)
    xGuardada.value = 0; yGuardada.value = 0
  }

  const cerrar = () => {
    reponer()
    setGuardada(false)
    onCerrar()
  }

  const guardar = async () => {
    if (!uri || guardando) return
    setGuardando(true)
    let temporal: Fichero | null = null
    try {
      const permiso = await MediaLibrary.requestPermissionsAsync(true)
      if (!permiso.granted) {
        Alert.alert(
          'Sin acceso a tus fotos',
          'Para guardarla, dale permiso a ZENCRUS desde los ajustes del teléfono.',
        )
        return
      }

      // Nombre por tiempo: dos fotos guardadas seguidas no se pisan.
      // Se crea el destino y se usa ESE, en vez del que devuelve la descarga:
      // el tipo que devuelve no es la misma clase y no trae `delete()`.
      temporal = new Fichero(Paths.cache, `zencrus-${Date.now()}.jpg`)
      await Fichero.downloadFileAsync(uri, temporal)
      await MediaLibrary.saveToLibraryAsync(temporal.uri)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setGuardada(true)
    } catch (e: any) {
      Alert.alert('No pudimos guardarla', e?.message ?? 'Vuelve a intentarlo en un momento.')
    } finally {
      // Pase lo que pase: el archivo intermedio no pinta nada dentro de la app.
      try { temporal?.delete() } catch { /* si ya no está, mejor */ }
      setGuardando(false)
    }
  }

  const pellizco = Gesture.Pinch()
    .onUpdate(e => {
      const s = escalaGuardada.value * e.scale
      escala.value = s < 1 ? 1 : s > ZOOM_MAX ? ZOOM_MAX : s
    })
    .onEnd(() => {
      if (escala.value <= 1.01) reponer()
      else escalaGuardada.value = escala.value
    })

  const arrastre = Gesture.Pan()
    .onUpdate(e => {
      if (escala.value > 1) {
        // Acercada: el arrastre mueve la imagen para poder mirar los bordes.
        x.value = xGuardada.value + e.translationX
        y.value = yGuardada.value + e.translationY
      } else {
        // Sin acercar: el arrastre es para cerrar.
        y.value = e.translationY
      }
    })
    .onEnd(() => {
      if (escala.value > 1) {
        xGuardada.value = x.value
        yGuardada.value = y.value
      } else if (Math.abs(y.value) > CIERRE) {
        runOnJS(onCerrar)()
        reponer()
      } else {
        y.value = withTiming(0)
      }
    })

  const dobleToque = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (escala.value > 1) reponer()
      else {
        escala.value = withTiming(2.5)
        escalaGuardada.value = 2.5
      }
    })

  const gestos = Gesture.Simultaneous(pellizco, Gesture.Exclusive(dobleToque, arrastre))

  const estiloImagen = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: escala.value },
    ],
  }))

  // El fondo se aclara conforme se arrastra: dice que soltando se cierra.
  const estiloFondo = useAnimatedStyle(() => ({
    opacity: escala.value > 1
      ? 1
      : interpolate(Math.abs(y.value), [0, CIERRE * 2], [1, 0.35], 'clamp'),
  }))

  if (!uri) return null

  return (
    <Modal
      visible={abierto}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={cerrar}
    >
      <View style={v.raiz}>
        <Animated.View style={[StyleSheet.absoluteFill, v.fondo, estiloFondo]} />

        <GestureDetector gesture={gestos}>
          <Animated.View style={[v.lienzo, estiloImagen]}>
            <Image
              source={{ uri }}
              style={{ width, height: height * 0.86 }}
              // `contain`, no `cover`: aquí el objetivo es verla ENTERA.
              contentFit="contain"
              transition={140}
            />
          </Animated.View>
        </GestureDetector>

        <Pressable
          style={[v.redondo, { top: insets.top + 8, left: 16 }]}
          onPress={cerrar}
          hitSlop={12}
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>

        <Pressable
          style={[v.guardar, { bottom: insets.bottom + 26 }]}
          onPress={guardar}
          disabled={guardando || guardada}
          hitSlop={10}
        >
          {guardando ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons
              name={guardada ? 'checkmark' : 'arrow-down-circle-outline'}
              size={19}
              color="#FFFFFF"
            />
          )}
          <Text style={v.guardarTxt}>
            {guardando ? 'Guardando…' : guardada ? 'Guardada en tus fotos' : 'Guardar'}
          </Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const v = StyleSheet.create({
  raiz: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fondo: { backgroundColor: '#000000' },
  lienzo: { alignItems: 'center', justifyContent: 'center' },
  redondo: {
    position: 'absolute',
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  guardar: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  guardarTxt: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
})
