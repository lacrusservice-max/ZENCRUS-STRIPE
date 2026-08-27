/**
 * COMUNIDAD · VISOR DE HISTORIAS
 * ──────────────────────────────
 * Pantalla completa, avance automático y barras de progreso arriba.
 *
 * ── Cómo se navega ──────────────────────────────────────────────────────────
 * Tocar la mitad derecha avanza, la izquierda retrocede, y mantener pulsado
 * pausa — que es el gesto que todo el mundo ya conoce y por tanto el único que
 * no hay que explicar. Al terminar las de una persona se cierra el visor en vez
 * de saltar a otra: encadenar historias de desconocidos es lo que convierte esto
 * en una máquina de perder el tiempo, y esta app va de otra cosa.
 *
 * Las barras se animan con `Animated` y `useNativeDriver: false` porque lo que
 * cambia es el ANCHO, que no es una propiedad que el hilo nativo pueda animar.
 * Es la excepción consciente a la regla de animar siempre en nativo.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableWithoutFeedback, Animated, Pressable,
  useWindowDimensions, ActivityIndicator,
} from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { useSocialStore } from '@/store/socialStore'
import { Avatar, timeAgo, timeLeft } from '@/components/social/Bits'
import { VideoPlayer } from '@/components/social/VideoPlayer'
import type { StoryGroup } from '@/services/socialService'

const DURACION = 5000

export default function StoryViewer() {
  const { width, height } = useWindowDimensions()
  const { authorId } = useLocalSearchParams<{ authorId: string }>()
  const stories = useSocialStore(s => s.stories)
  const markStorySeen = useSocialStore(s => s.markStorySeen)

  const grupo: StoryGroup | undefined = stories.find(g => g.author.id === authorId)
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)
  const [cargando, setCargando] = useState(true)
  /**
   * Cuánto dura la historia visible.
   *
   * Una foto dura lo fijo; un vídeo, lo que dure el vídeo. Sin esto, uno de
   * veinte segundos se cortaría a los cinco.
   */
  const [duracion, setDuracion] = useState(DURACION)

  const progreso = useRef(new Animated.Value(0)).current
  const animacion = useRef<Animated.CompositeAnimation | null>(null)

  const actual = grupo?.stories[indice]

  const cerrar = useCallback(() => {
    if (grupo) markStorySeen(grupo.author.id)
    router.back()
  }, [grupo])

  const avanzar = useCallback(() => {
    if (!grupo) return cerrar()
    if (indice < grupo.stories.length - 1) {
      setIndice(i => i + 1)
      setCargando(true)
      setDuracion(DURACION)
    } else {
      cerrar()
    }
  }, [grupo, indice, cerrar])

  const retroceder = () => {
    if (indice > 0) { setIndice(i => i - 1); setCargando(true); setDuracion(DURACION) }
  }

  // Arranca el contador de la historia visible. Se reinicia al cambiar de
  // historia y se detiene mientras la imagen no haya cargado: si no, una foto
  // lenta se pasaría sola antes de verse.
  useEffect(() => {
    animacion.current?.stop()
    progreso.setValue(0)
    if (cargando || pausado || !actual) return

    animacion.current = Animated.timing(progreso, {
      toValue: 1,
      duration: duracion,
      useNativeDriver: false,
    })
    animacion.current.start(({ finished }) => { if (finished) avanzar() })

    return () => animacion.current?.stop()
  }, [indice, pausado, cargando, duracion, actual?.id])

  if (!grupo || !actual) {
    return (
      <View style={[v.root, { width, height, alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style="light" />
        <Text style={v.vacio}>Esta historia ya no está disponible</Text>
        <Pressable onPress={() => router.back()} style={v.volver}>
          <Text style={v.volverTxt}>Volver</Text>
        </Pressable>
      </View>
    )
  }

  const pieza = actual.media[0]

  return (
    <View style={[v.root, { width, height }]}>
      <StatusBar style="light" />

      {pieza?.url && pieza.type === 'video' ? (
        <VideoPlayer
          uri={pieza.url}
          width={width}
          height={height}
          autoPlay
          paused={pausado}
          onDuration={seg => { setDuracion(Math.max(1200, seg * 1000)); setCargando(false) }}
          onEnd={avanzar}
        />
      ) : pieza?.url ? (
        <Image
          source={{ uri: pieza.url }}
          style={{ width, height }}
          contentFit="contain"
          transition={140}
          onLoadEnd={() => setCargando(false)}
        />
      ) : (
        <View style={[v.roto, { width, height }]}>
          <Ionicons name="image-outline" size={34} color="rgba(255,255,255,0.4)" />
          <Text style={v.rotoTxt}>No pudimos cargar esta historia</Text>
        </View>
      )}

      {cargando && pieza?.url && (
        <View style={v.cargando}><ActivityIndicator color="#fff" /></View>
      )}

      {/* Barras de progreso, una por historia */}
      <View style={[v.barras, { top: 54 }]}>
        {grupo.stories.map((_, i) => (
          <View key={i} style={v.barraFondo}>
            <Animated.View
              style={[
                v.barraLlena,
                {
                  width: i < indice ? '100%'
                    : i > indice ? '0%'
                    : progreso.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Quién y cuándo */}
      <View style={[v.cabecera, { top: 68 }]}>
        <Avatar profile={grupo.author} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={v.nombre} numberOfLines={1}>
            {grupo.author.username ?? grupo.author.fullName ?? 'Cuenta ZENCRUS'}
          </Text>
          <Text style={v.hora}>
            {timeAgo(actual.createdAt)}
            {actual.expiresAt ? ` · quedan ${timeLeft(actual.expiresAt)}` : ''}
          </Text>
        </View>
        <Pressable onPress={cerrar} hitSlop={14}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
      </View>

      {/* Texto de la historia, si lo lleva */}
      {!!actual.content && (
        <View style={v.pie}>
          <Text style={v.pieTxt}>{actual.content}</Text>
        </View>
      )}

      {/* Zonas de toque: izquierda atrás, derecha adelante, mantener pausa */}
      <View style={v.zonas} pointerEvents="box-none">
        <TouchableWithoutFeedback
          onPress={retroceder}
          onLongPress={() => setPausado(true)}
          onPressOut={() => setPausado(false)}
          delayLongPress={180}
        >
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback
          onPress={avanzar}
          onLongPress={() => setPausado(true)}
          onPressOut={() => setPausado(false)}
          delayLongPress={180}
        >
          <View style={{ flex: 1.4 }} />
        </TouchableWithoutFeedback>
      </View>
    </View>
  )
}

const v = StyleSheet.create({
  root: { backgroundColor: '#050505', position: 'relative' },
  barras: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 4 },
  barraFondo: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  barraLlena: { height: 2.5, backgroundColor: '#fff', borderRadius: 2 },
  cabecera: {
    position: 'absolute', left: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  nombre: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hora: { color: 'rgba(255,255,255,0.66)', fontSize: 11, marginTop: 1 },
  pie: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 22, paddingTop: 26, paddingBottom: 46,
    backgroundColor: 'rgba(5,5,5,0.42)',
  },
  pieTxt: { color: '#fff', fontSize: 15, lineHeight: 22 },
  zonas: { position: 'absolute', top: 100, left: 0, right: 0, bottom: 90, flexDirection: 'row' },
  cargando: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  roto: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  rotoTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  vacio: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  volver: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)' },
  volverTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
