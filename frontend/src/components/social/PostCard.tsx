/**
 * COMUNIDAD · TARJETA DE PUBLICACIÓN
 * ──────────────────────────────────
 * La pieza que más veces se ve de toda la sección, así que es donde más
 * importa que nada se mueva de golpe ni salte al cargar.
 *
 * ── Sin tarjeta: la foto va de borde a borde ────────────────────────────────
 * Antes cada publicación era una tarjeta de vidrio con 16 pt de margen y 1 pt de
 * borde a cada lado, y la foto se quedaba con 34 pt menos de ancho. En una
 * pantalla de 402 son casi un 9 %: se nota en cada imagen del muro. Ahora la
 * foto ocupa la pantalla entera y lo que separa una publicación de otra es el
 * aire, no un marco.
 *
 * Quien publicó viaja ENCIMA de la foto, sobre un degradado que garantiza que el
 * nombre se lea sea cual sea la imagen debajo. El texto baja al pie, como un
 * pie de foto.
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
import { Image } from '@/components/ui/Imagen'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useAppTheme } from '@/context/ThemeContext'
import { Avatar, timeAgo, compartirPost } from './Bits'
import { VideoPlayer } from './VideoPlayer'
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
 *
 * El ancho llega de fuera y no se calcula aquí porque esta pieza sale en dos
 * sitios con márgenes distintos: dentro de la tarjeta del muro y a sangre en la
 * pantalla de la publicación. Calcularlo dentro obligaría a tener dos copias
 * del carrusel, y la segunda se quedaría atrás en cuanto se tocara la primera.
 */
export function PostMedia({
  post, ancho, onDoubleTap,
}: { post: Post; ancho: number; onDoubleTap?: () => void }) {
  const T = useAppTheme()
  const { width } = useWindowDimensions()
  const [indice, setIndice] = useState(0)

  // Los hooks van antes del `return` de la publicación sin fotos.
  //
  // Estaban debajo, y en una lista eso se nota: el feed reutiliza las
  // instancias por posición, así que al pasar de una publicación con fotos a
  // una sin ellas React veía primero seis hooks y luego tres. El contador del
  // doble toque de una acababa dentro de otra, y «me gusta» se disparaba en la
  // publicación equivocada sin que hubiera forma de reproducirlo a mano.
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

  if (!post.media.length) return null

  const primera = post.media[0]
  const proporcion = primera.width && primera.height ? primera.height / primera.width : 1.25
  const alto = Math.min(Math.round(ancho * proporcion), Math.round(width * 1.3))

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

/** Una sola pieza: foto o vídeo. */
function Pieza({ pieza, ancho, alto }: { pieza: Post['media'][0]; ancho: number; alto: number }) {
  const T = useAppTheme()
  const [cargando, setCargando] = useState(true)

  if (!pieza.url) {
    return (
      <View style={[{ width: ancho, height: alto }, m.roto]}>
        <Ionicons name="image-outline" size={26} color={T.ink3} />
        <Text style={[m.rotoTxt, { color: T.ink3 }]}>No pudimos cargar este archivo</Text>
      </View>
    )
  }

  // En el muro el vídeo NO arranca solo: se toca para verlo. Un muro donde cada
  // vídeo empieza a sonar al pasar por delante es insoportable, y esta app se
  // usa en el gimnasio.
  if (pieza.type === 'video') {
    return <VideoPlayer uri={pieza.url} width={ancho} height={alto} />
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
  post, onLike, onSave, onComment, onProfile, onOptions,
}: {
  post: Post
  onLike: (p: Post) => void
  onSave: (p: Post) => void
  onComment: (p: Post) => void
  onProfile: (id: string) => void
  onOptions: (p: Post) => void
}) {
  const T = useAppTheme()
  const { width } = useWindowDimensions()
  const [expandido, setExpandido] = useState(false)

  const texto = post.content ?? ''
  const largo = texto.length > 180
  const conFoto = post.media.length > 0

  // Doble toque solo enciende, nunca apaga: quien da dos toques quiere dar me
  // gusta, y quitarlo sin querer por un toque de más es una mala sorpresa.
  const meGustaDoble = () => { if (!post.likedByMe) onLike(post) }

  /**
   * Quién publicó.
   *
   * Va encima de la foto cuando la hay, y en su propia fila cuando no. Es el
   * mismo bloque en los dos casos —cambian los colores— para que una
   * publicación de solo texto no parezca de otra app.
   */
  const autor = (sobreFoto: boolean) => (
    <View style={[c.head, sobreFoto && c.headOver]}>
      <Avatar profile={post.author} size={sobreFoto ? 30 : 38}
        onPress={() => post.author && onProfile(post.author.id)} />
      <TouchableOpacity
        style={{ flex: 1 }}
        activeOpacity={0.7}
        onPress={() => post.author && onProfile(post.author.id)}
      >
        <View style={c.nombreFila}>
          <Text
            style={[c.nombre, { color: sobreFoto ? '#FFFFFF' : T.ink }]}
            numberOfLines={1}
          >
            {post.author?.username ?? post.author?.fullName ?? 'Cuenta ZENCRUS'}
          </Text>
          {post.author?.isPrivate && (
            <Ionicons name="lock-closed" size={11}
              color={sobreFoto ? 'rgba(255,255,255,0.7)' : T.ink3} />
          )}
          <Text style={[c.punto, { color: sobreFoto ? 'rgba(255,255,255,0.6)' : T.ink3 }]}>·</Text>
          <Text style={[c.cuando, { color: sobreFoto ? 'rgba(255,255,255,0.75)' : T.ink3 }]}>
            {timeAgo(post.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
      {post.visibility === 'followers' && (
        <Ionicons name="people" size={13}
          color={sobreFoto ? 'rgba(255,255,255,0.8)' : T.ink3} />
      )}
      <TouchableOpacity onPress={() => onOptions(post)} hitSlop={10} activeOpacity={0.7}>
        <Ionicons name="ellipsis-horizontal" size={18}
          color={sobreFoto ? '#FFFFFF' : T.ink3} />
      </TouchableOpacity>
    </View>
  )

  return (
    <View>
      {conFoto ? (
        <View>
          <PostMedia post={post} ancho={width} onDoubleTap={meGustaDoble} />
          {/* El degradado no es decoración: sin él, el nombre desaparece sobre
              una foto clara. Se queda en el tercio de arriba y no toca la
              imagen donde suele estar lo que se quiere ver. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.18)', 'transparent']}
            style={c.velo}
            pointerEvents="none"
          />
          {autor(true)}
        </View>
      ) : (
        autor(false)
      )}

      <View style={c.acciones}>
        <Accion
          icon={post.likedByMe ? 'heart' : 'heart-outline'}
          label={post.likes}
          active={post.likedByMe}
          onPress={() => onLike(post)}
        />
        <Accion icon="chatbubble-outline" label={post.comments} onPress={() => onComment(post)} />
        <Accion icon="paper-plane-outline" onPress={() => compartirPost(post)} />
        <View style={{ flex: 1 }} />
        <Accion
          icon={post.savedByMe ? 'bookmark' : 'bookmark-outline'}
          active={post.savedByMe}
          onPress={() => onSave(post)}
        />
      </View>

      {!!texto && (
        <TouchableOpacity
          activeOpacity={largo ? 0.75 : 1}
          onPress={() => largo && setExpandido(v => !v)}
          style={c.textoWrap}
        >
          <Text style={[c.texto, { color: T.ink2 }]} numberOfLines={expandido ? undefined : 3}>
            {texto}
          </Text>
          {largo && (
            <Text style={[c.mas, { color: T.ink3 }]}>
              {expandido ? 'Ver menos' : 'Ver más'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const c = StyleSheet.create({
  velo: { position: 'absolute', top: 0, left: 0, right: 0, height: 78 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  // Encima de la foto: pegado arriba y sin fondo propio — lo pone el degradado.
  headOver: { position: 'absolute', top: 0, left: 0, right: 0, paddingVertical: 10 },
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nombre: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  punto: { fontSize: 12 },
  cuando: { fontSize: 11.5 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },
  textoWrap: { paddingHorizontal: 16, paddingTop: 8 },
  texto: { fontSize: 13.5, lineHeight: 19.5 },
  mas: { fontSize: 12.5, fontWeight: '700', marginTop: 4 },
})
