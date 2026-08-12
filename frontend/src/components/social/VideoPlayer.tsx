/**
 * COMUNIDAD · REPRODUCTOR DE VÍDEO
 * ────────────────────────────────
 * Un vídeo dentro del muro, del chat o de una historia.
 *
 * ── Por qué no se reproducen solos ──────────────────────────────────────────
 * Arranca en pausa y con el sonido apagado, y hay que tocar para verlo. Un muro
 * donde cada vídeo empieza a sonar al pasar por delante es lo que hace que la
 * gente mire la aplicación con el móvil boca abajo — y esta app se usa en el
 * gimnasio, no en el sofá.
 *
 * En las historias es al revés: ahí el vídeo ES la pantalla, así que se
 * reproduce solo y con sonido (`autoPlay`), como cualquiera espera.
 *
 * ── La duración manda sobre el temporizador de la historia ──────────────────
 * Una historia de foto dura cinco segundos fijos; una de vídeo tiene que durar
 * lo que dure el vídeo. Por eso el visor recibe `onDuration` y `onEnd`: sin
 * ellos, un vídeo de veinte segundos se cortaría a los cinco.
 */

import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ViewStyle } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEventListener } from 'expo'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

export function VideoPlayer({
  uri, width, height, autoPlay, loop, paused, onEnd, onDuration, style,
}: {
  uri: string
  width: number
  height: number
  /** Historias: arranca solo y con sonido. */
  autoPlay?: boolean
  loop?: boolean
  /**
   * Pausa mandada desde fuera. La usa el visor de historias al mantener
   * pulsado: si solo se parara la barra de progreso y el vídeo siguiera, al
   * soltar el dedo la barra iría por detrás de lo que se está viendo.
   */
  paused?: boolean
  onEnd?: () => void
  onDuration?: (segundos: number) => void
  style?: ViewStyle
}) {
  const [sonando, setSonando] = useState(!!autoPlay)
  const [silencio, setSilencio] = useState(!autoPlay)
  const [listo, setListo] = useState(false)

  const player = useVideoPlayer(uri, p => {
    p.loop = !!loop
    p.muted = !autoPlay
    if (autoPlay) p.play()
  })

  // `useEventListener` en vez de sondear el estado: el reproductor avisa cuando
  // cambia, y preguntarle sesenta veces por segundo desde el hilo de JS es
  // justo lo que hace que un muro con vídeos vaya a tirones.
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay' && !listo) {
      setListo(true)
      const d = player.duration
      if (d && onDuration) onDuration(d)
    }
  })

  useEventListener(player, 'playingChange', ({ isPlaying }) => setSonando(isPlaying))

  useEventListener(player, 'playToEnd', () => {
    if (!loop) {
      setSonando(false)
      onEnd?.()
    }
  })

  // Al salir de la pantalla el vídeo tiene que callarse. Sin esto se sigue
  // oyendo desde el muro después de haber navegado a otro sitio.
  useEffect(() => () => { try { player.pause() } catch { /* ya destruido */ } }, [])

  useEffect(() => {
    if (paused === undefined) return
    try { paused ? player.pause() : player.play() } catch { /* aún no listo */ }
  }, [paused])

  const alternar = () => {
    Haptics.selectionAsync().catch(() => {})
    if (player.playing) player.pause()
    else player.play()
  }

  const alternarSonido = () => {
    const nuevo = !silencio
    setSilencio(nuevo)
    player.muted = nuevo
  }

  return (
    <View style={[{ width, height }, style]}>
      <VideoView
        player={player}
        style={{ width, height }}
        contentFit={autoPlay ? 'contain' : 'cover'}
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />

      <Pressable onPress={alternar} style={StyleSheet.absoluteFill}>
        {/* El botón grande solo mientras está parado: encima del vídeo en
            marcha estorbaría justo lo que se quiere ver. */}
        {!sonando && (
          <View style={v.centro} pointerEvents="none">
            <View style={v.play}>
              <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
          </View>
        )}
        {!listo && (
          <View style={v.centro} pointerEvents="none">
            <ActivityIndicator color="rgba(255,255,255,0.8)" />
          </View>
        )}
      </Pressable>

      {/* Sonido: siempre visible, porque arrancar callado sin decirlo hace
          pensar que el vídeo no tiene audio. */}
      <Pressable onPress={alternarSonido} style={v.sonido} hitSlop={8}>
        <Ionicons
          name={silencio ? 'volume-mute' : 'volume-high'}
          size={14}
          color="#FFFFFF"
        />
      </Pressable>

      {!!player.duration && !sonando && listo && (
        <View style={v.duracion} pointerEvents="none">
          <Text style={v.duracionTxt}>{formatea(player.duration)}</Text>
        </View>
      )}
    </View>
  )
}

/** Segundos a `m:ss`. */
function formatea(segundos: number): string {
  const s = Math.max(0, Math.round(segundos))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const v = StyleSheet.create({
  centro: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  sonido: {
    position: 'absolute', bottom: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  duracion: {
    position: 'absolute', bottom: 10, left: 10,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  duracionTxt: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
})
