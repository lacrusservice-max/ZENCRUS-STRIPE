/**
 * COMUNIDAD · TARJETA DE PUBLICACIÓN
 * ──────────────────────────────────
 * La pieza que más veces se ve de toda la sección, así que es donde más
 * importa que nada se mueva de golpe ni salte al cargar.
 *
 * ── Por qué la imagen reserva su sitio antes de existir ─────────────────────
 * El servidor manda el alto y el ancho de cada archivo. Con eso se calcula la
 * altura EXACTA de la foto antes de descargarla y se deja el hueco hecho. Sin
 * ello, cada imagen que termina de bajar empuja hacia abajo lo que hay debajo y
 * el muro salta bajo el dedo mientras se desplaza. Cuando no vienen medidas se
 * usa 4:5, que es el formato más común en vertical.
 *
 * ── El corazón ──────────────────────────────────────────────────────────────
 * Late al pulsar con un muelle de `Animated`, y también con doble toque sobre
 * la foto. El estado lo lleva el store, que lo pinta antes de preguntar al
 * servidor y lo deshace si la respuesta es que no.
 */

import React, { useRef, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Pressable,
  useWindowDimensions, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useAppTheme } from '@/context/ThemeContext'
import { Avatar, NameBlock, timeAgo } from './Bits'
import type { Post } from '@/services/socialService'

type IconName = React.ComponentProps<typeof Ionicons>['name']

// ── Medios ───────────────────────────────────────────────────────────────────

/**
 * Las piezas de una publicación.
 *
 * Con una, ocupa el ancho entero. Con varias, un carrusel que se desliza de una
 * en una con `pagingEnabled` y unos puntos debajo — no una rejilla: recortar
 * fotos ajenas para que cuadren en una cuadrícula es decidir por quien las
 * publicó dónde está lo importante.
 */
function Media({ post, onDoubleTap }: { post: Post; onDoubleTap?: () => void }) {
  const T = useAppTheme()
  const { width } = useWindowDimensions()
  const ancho = width - 32 - 2   // margen de la tarjeta y su borde
  const [indice, setIndice] = useState(0)

  if (!post.media.length) return null

  const primera = post.media[0]
  const proporcion = primera.width && primera.height ? primera.height / primera.width : 1.25
  const alto = Math.min(Math.round(ancho * proporcion), Math.round(width * 1.3))

  const ultimoToque = useRef(0)
  const corazon = useRef(new Animated.Value(0)).current

  const dobleToque = useCallback(() => {
    const ahora = Date.now()
    if (ahora - ultimoToque.current < 280) {
      ultimoToque.current = 0
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      corazon.setValue(0)
      Animated.sequence([
        Animated.spring(corazon, { toValue: 1, useNativeDriver: true, tension: 220, friction: 7 }),
        Animated.timing(corazon, { toValue: 0, duration: 260, delay: 380, useNativeDriver: true }),
      ]).start()
      onDoubleTap?.()
    } else {
      ultimoToque.current = ahora
    }
  }, [onDoubleTap])

  return (
    <Pressable onPress={dobleToque}>
      <View style={[m.wrap, { height: alto, backgroundColor: T.ink4 }]}>
        {post.media.length === 1 ? (
          <Pieza pieza={primera} ancho={ancho} alto={alto} />
        ) : (
          <>
            <Animated.ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={ev =>
                setIndice(Math.round(ev.nativeEvent.contentOffset.x / ancho))}
            >
              {post.media.map((p, i) => (
                <Pieza key={i} pieza={p} ancho={ancho} alto={alto} />
              ))}
            </Animated.ScrollView>
            <View style={m.puntos}>
              {post.media.map((_, i) => (
                <View
                  key={i}
                  style={[
                    m.punto,
                    { backgroundColor: i === indice ? '#FFFFFF' : 'rgba(255,255,255,0.42)' },
                    i === indice && { width: 16 },
                  ]}
                />
              ))}
            </View>
            <View style={m.contador}>
              <Text style={m.contadorTxt}>{indice + 1}/{post.media.length}</Text>
            </View>
          </>
        )}

        <Animated.View
          pointerEvents="none"
          style={[
            m.corazonGrande,
            { opacity: corazon, transform: [{ scale: corazon.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
          ]}
        >
          <Ionicons name="heart" size={92} color="rgba(255,255,255,0.92)" />
        </Animated.View>
      </View>
    </Pressable>
  )
}

/** Una sola pieza: foto, o vídeo con su marca de reproducción. */
function Pieza({ pieza, ancho, alto }: { pieza: Post['media'][0]; ancho: number; alto: number }) {
  const T = useAppTheme()
  const [cargando, setCargando] = useState(true)

  if (!pieza.url) {
    return (
      <View style={[{ width: ancho, height: alto }, m.roto]}>
        <Ionicons name="image-outline" size={26} color={T.ink3} />
        <Text style={[m.rotoTxt, { color: T.ink3 }]}>No pudimos cargar esta imagen</Text>
      </View>
    )
  }

  return (
    <View style={{ width: ancho, height: alto }}>
      <Image
        source={{ uri: pieza.url }}
        style={{ width: ancho, height: alto }}
        contentFit="cover"
        transition={200}
        onLoadEnd={() => setCargando(false)}
      />
      {cargando && (
        <View style={m.cargando}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
        </View>
      )}
      {pieza.type === 'video' && (
        <View style={m.play} pointerEvents="none">
          <Ionicons name="play" size={22} color="#FFFFFF" style={{ marginLeft: 3 }} />
        </View>
      )}
    </View>
  )
}

const m = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', position: 'relative' },
  puntos: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    flexDirection: 'row', gap: 5,
  },
  punto: { width: 5, height: 5, borderRadius: 3 },
  contador: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 11,
  },
  contadorTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  corazonGrande: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  cargando: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  play: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  roto: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  rotoTxt: { fontSize: 12 },
})

// ── Acción (corazón, comentario…) ────────────────────────────────────────────

function Accion({
  icon, label, active, color, onPress,
}: {
  icon: IconName
  label?: string | number
  active?: boolean
  color?: string
  onPress: () => void
}) {
  const T = useAppTheme()
  const escala = useRef(new Animated.Value(1)).current

  const pulsar = () => {
    Animated.sequence([
      Animated.spring(escala, { toValue: 0.82, useNativeDriver: true, tension: 500, friction: 10 }),
      Animated.spring(escala, { toValue: 1, useNativeDriver: true, tension: 320, friction: 9 }),
    ]).start()
    Haptics.selectionAsync().catch(() => {})
    onPress()
  }

  const tinte = active ? (color ?? T.accent) : T.ink2

  return (
    <TouchableOpacity onPress={pulsar} activeOpacity={0.7} style={ac.wrap} hitSlop={8}>
      <Animated.View style={{ transform: [{ scale: escala }] }}>
        <Ionicons name={icon} size={21} color={tinte} />
      </Animated.View>
      {label !== undefined && label !== 0 && (
        <Text style={[ac.txt, { color: active ? tinte : T.ink2 }]}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

const ac = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txt: { fontSize: 13, fontWeight: '700' },
})

// ── Tarjeta ──────────────────────────────────────────────────────────────────

export function PostCard({
  post, onLike, onComment, onProfile, onOptions,
}: {
  post: Post
  onLike: (p: Post) => void
  onComment: (p: Post) => void
  onProfile: (id: string) => void
  onOptions: (p: Post) => void
}) {
  const T = useAppTheme()
  const [expandido, setExpandido] = useState(false)

  const texto = post.content ?? ''
  const largo = texto.length > 180

  // Doble toque solo enciende, nunca apaga: quien da dos toques quiere dar me
  // gusta, y quitarlo sin querer por un toque de más es una mala sorpresa.
  const meGustaDoble = () => { if (!post.likedByMe) onLike(post) }

  return (
    <View style={[c.card, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
      <View style={[c.highlight, { backgroundColor: T.glassHighlight }]} pointerEvents="none" />

      <View style={c.head}>
        <Avatar profile={post.author} size={40} onPress={() => post.author && onProfile(post.author.id)} />
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={0.7}
          onPress={() => post.author && onProfile(post.author.id)}
        >
          <NameBlock profile={post.author} subtitle={timeAgo(post.createdAt)} />
        </TouchableOpacity>
        {post.visibility === 'followers' && (
          <View style={[c.chip, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
            <Ionicons name="people" size={11} color={T.ink3} />
            <Text style={[c.chipTxt, { color: T.ink3 }]}>Seguidores</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => onOptions(post)} hitSlop={10} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={18} color={T.ink3} />
        </TouchableOpacity>
      </View>

      {!!texto && (
        <TouchableOpacity
          activeOpacity={largo ? 0.75 : 1}
          onPress={() => largo && setExpandido(v => !v)}
          style={c.textoWrap}
        >
          <Text style={[c.texto, { color: T.ink }]} numberOfLines={expandido ? undefined : 4}>
            {texto}
          </Text>
          {largo && (
            <Text style={[c.mas, { color: T.ink3 }]}>
              {expandido ? 'Ver menos' : 'Ver más'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      <Media post={post} onDoubleTap={meGustaDoble} />

      <View style={c.acciones}>
        <Accion
          icon={post.likedByMe ? 'heart' : 'heart-outline'}
          label={post.likes}
          active={post.likedByMe}
          onPress={() => onLike(post)}
        />
        <Accion icon="chatbubble-outline" label={post.comments} onPress={() => onComment(post)} />
        <View style={{ flex: 1 }} />
      </View>
    </View>
  )
}

const c = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 22, borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34, shadowRadius: 22,
    elevation: 8,
  },
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 9, borderWidth: 1,
  },
  chipTxt: { fontSize: 10, fontWeight: '700' },
  textoWrap: { paddingHorizontal: 14, paddingBottom: 12 },
  texto: { fontSize: 14.5, lineHeight: 21 },
  mas: { fontSize: 12.5, fontWeight: '700', marginTop: 5 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 20, padding: 14 },
})
