/**
 * COMUNIDAD · PANTALLA PRINCIPAL
 * ──────────────────────────────
 * El centro de la sección: historias arriba, los dos muros debajo y el menú
 * propio de Social en la cabecera.
 *
 * ── Por qué los dos muros son una sola lista ────────────────────────────────
 * «Para ti» y «Amigos» comparten componente y se intercambian con un selector.
 * Cada uno guarda su posición y su cursor en el store, así que volver de un
 * perfil no manda a nadie de vuelta arriba del todo — que es lo que más molesta
 * de un muro.
 *
 * ── El menú de la sección ───────────────────────────────────────────────────
 * Buscar, avisos y mensajes viven en la cabecera y no en la barra de abajo: la
 * barra es de la app entera y ya tiene cinco pestañas. Meter ahí lo de la
 * comunidad la convertiría en un cajón de sastre.
 */

import { BotonIA } from '@/constants/layout'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Animated, ScrollView, Alert, Pressable,
} from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Screen } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Typography } from '@/constants/theme'
import {
  Avatar, Badge, Empty, FeedSkeleton, BrandRing, timeAgo,
} from '@/components/social/Bits'
import { PostCard } from '@/components/social/PostCard'
import type { FeedScope, Post, StoryGroup } from '@/services/socialService'
import { errorText } from '@/services/socialService'
import { registerForPush, listenToPushTaps } from '@/services/pushService'

// ── Selector de muro ─────────────────────────────────────────────────────────

/**
 * Los dos muros, con el indicador deslizándose entre ellos.
 *
 * Dibujado a mano y no un control nativo: en Android el segmentado del sistema
 * no existe y en iOS impone su propio aspecto, así que la sección se vería
 * distinta en cada teléfono.
 */
function WallPicker({
  value, onChange,
}: { value: FeedScope; onChange: (v: FeedScope) => void }) {
  const T = useAppTheme()
  const pos = useRef(new Animated.Value(value === 'foryou' ? 0 : 1)).current
  const [ancho, setAncho] = useState(0)

  useEffect(() => {
    Animated.spring(pos, {
      toValue: value === 'foryou' ? 0 : 1,
      useNativeDriver: true, tension: 260, friction: 22,
    }).start()
  }, [value])

  const opciones: { key: FeedScope; label: string; icon: any }[] = [
    { key: 'foryou', label: 'Para ti', icon: 'sparkles' },
    { key: 'friends', label: 'Amigos', icon: 'people' },
  ]

  return (
    <View
      style={[wp.wrap, { backgroundColor: T.glass, borderColor: T.glassBorder }]}
      onLayout={e => setAncho(e.nativeEvent.layout.width - 8)}
    >
      {ancho > 0 && (
        <Animated.View
          style={[
            wp.pill,
            {
              width: ancho / 2,
              backgroundColor: `${T.accent}22`,
              borderColor: `${T.accent}3A`,
              transform: [{ translateX: pos.interpolate({ inputRange: [0, 1], outputRange: [0, ancho / 2] }) }],
            },
          ]}
          pointerEvents="none"
        />
      )}
      {opciones.map(o => {
        const activo = value === o.key
        return (
          <TouchableOpacity
            key={o.key}
            style={wp.opt}
            activeOpacity={0.8}
            onPress={() => {
              if (activo) return
              Haptics.selectionAsync().catch(() => {})
              onChange(o.key)
            }}
          >
            <Ionicons name={o.icon} size={14} color={activo ? T.accent : T.ink3} />
            <Text style={[wp.txt, { color: activo ? T.accent : T.ink3 }]}>{o.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const wp = StyleSheet.create({
  wrap: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
    padding: 4, borderRadius: 15, borderWidth: 1,
  },
  pill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 12, borderWidth: 1 },
  opt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9 },
  txt: { fontSize: 13, fontWeight: '700' },
})

// ── Carrusel de historias ────────────────────────────────────────────────────

function Stories({ groups, loading }: { groups: StoryGroup[]; loading: boolean }) {
  const T = useAppTheme()
  const me = useSocialStore(s => s.me)
  const vistas = useSocialStore(s => s.seenStories)

  const mias = groups.find(g => g.isMine)
  const ajenas = groups.filter(g => !g.isMine)

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.row}
    >
      {/* La mía siempre primero, y si no tengo, el botón de crear. */}
      <TouchableOpacity
        style={st.item}
        activeOpacity={0.8}
        onPress={() => mias
          ? router.push({ pathname: '/social/story', params: { authorId: mias.author.id } })
          : router.push({ pathname: '/social/compose', params: { kind: 'story' } })}
      >
        <View>
          {mias
            ? <Avatar profile={mias.author} size={58} ring={vistas.has(mias.author.id) ? T.ink4 : T.accent} />
            : <Avatar profile={me} size={58} />}
          {!mias && (
            <View style={[st.plus, { backgroundColor: T.accent, borderColor: T.bg }]}>
              <Ionicons name="add" size={14} color="#fff" />
            </View>
          )}
        </View>
        <Text style={[st.name, { color: T.ink2 }]} numberOfLines={1}>Tu historia</Text>
      </TouchableOpacity>

      {loading && !groups.length && [0, 1, 2, 3].map(i => (
        <View key={i} style={st.item}>
          <View style={[st.fantasma, { backgroundColor: T.ink4 }]} />
          <View style={[st.fantasmaTxt, { backgroundColor: T.ink4 }]} />
        </View>
      ))}

      {ajenas.map(g => (
        <TouchableOpacity
          key={g.author.id}
          style={st.item}
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/social/story', params: { authorId: g.author.id } })}
        >
          {vistas.has(g.author.id) ? (
            <Avatar profile={g.author} size={58} ring={T.ink4} />
          ) : (
            <BrandRing size={65}>
              <View style={{ borderRadius: 32, borderWidth: 2.5, borderColor: T.bg }}>
                <Avatar profile={g.author} size={57} />
              </View>
            </BrandRing>
          )}
          <Text style={[st.name, { color: T.ink2 }]} numberOfLines={1}>
            {g.author.username ?? g.author.fullName ?? '—'}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const st = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 14, paddingBottom: 16 },
  item: { alignItems: 'center', width: 68, gap: 7 },
  name: { fontSize: 11, fontWeight: '600' },
  plus: {
    position: 'absolute', bottom: -2, right: -2,
    width: 21, height: 21, borderRadius: 11, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  fantasma: { width: 58, height: 58, borderRadius: 29 },
  fantasmaTxt: { width: 44, height: 9, borderRadius: 5 },
})

// ── Cabecera ─────────────────────────────────────────────────────────────────

function Header() {
  const T = useAppTheme()
  const me = useSocialStore(s => s.me)
  const badges = useSocialStore(s => s.badges)

  const boton = (icon: any, onPress: () => void, count = 0) => (
    <TouchableOpacity
      style={[hd.btn, { backgroundColor: T.glass, borderColor: T.glassBorder }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={19} color={T.ink} />
      {count > 0 && <Badge count={count} style={hd.badge} />}
    </TouchableOpacity>
  )

  return (
    <View style={hd.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={[hd.eyebrow, { color: T.accent }]}>COMUNIDAD</Text>
        <Text style={[hd.title, { color: T.ink }]}>Social</Text>
      </View>
      <View style={hd.acciones}>
        {boton('search', () => router.push('/social/search'))}
        {boton('notifications-outline', () => router.push('/social/notifications'),
          badges.notifications + badges.followRequests)}
        {boton('chatbubble-outline', () => router.push('/social/messages'),
          badges.messages + badges.messageRequests)}
        <TouchableOpacity
          onPress={() => router.push('/social/me')}
          activeOpacity={0.75}
          style={{ marginLeft: 2 }}
        >
          <Avatar profile={me} size={38} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const hd = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16, gap: 8,
  },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 3 },
  title: { fontFamily: Typography.fontFamily.display, fontSize: 32, letterSpacing: 0.2 },
  // El margen deja libre la esquina para el botón de ZENA, que si no cae justo
  // encima de la foto de perfil.
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: BotonIA.reserva },
  btn: {
    width: 38, height: 38, borderRadius: 13, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: { position: 'absolute', top: -5, right: -5 },
})

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default function SocialScreen() {
  const T = useAppTheme()
  const [scope, setScope] = useState<FeedScope>('foryou')

  const feeds = useSocialStore(s => s.feeds)
  const stories = useSocialStore(s => s.stories)
  const storiesLoading = useSocialStore(s => s.storiesLoading)
  const loadFeed = useSocialStore(s => s.loadFeed)
  const loadStories = useSocialStore(s => s.loadStories)
  const loadMe = useSocialStore(s => s.loadMe)
  const loadBadges = useSocialStore(s => s.loadBadges)
  const toggleLike = useSocialStore(s => s.toggleLike)
  const removePost = useSocialStore(s => s.removePost)

  const feed = feeds[scope]

  // Al entrar en la sección se refresca lo que esté rancio. Cinco minutos es el
  // punto en que volver a pedir deja de ser molesto y empieza a ser útil.
  useFocusEffect(useCallback(() => {
    loadMe()
    loadBadges()
    if (Date.now() - feed.fetchedAt > 300_000) loadFeed(scope, 'first')
    loadStories()
  }, [scope]))

  /**
   * El permiso de avisos se pide AQUÍ, al entrar en la comunidad, no al abrir
   * la app. Un permiso pedido nada más instalar, sin que se entienda para qué,
   * se deniega — y en iOS solo se puede preguntar una vez.
   */
  useEffect(() => {
    registerForPush()
    return listenToPushTaps()
  }, [])

  useEffect(() => {
    if (!feed.posts.length && !feed.loading) loadFeed(scope, 'first')
  }, [scope])

  const opciones = useCallback((post: Post) => {
    const acciones: any[] = []
    if (post.isMine) {
      acciones.push({
        text: 'Eliminar publicación',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Eliminar', '¿Seguro que quieres eliminarla? No se puede deshacer.', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Eliminar',
              style: 'destructive',
              onPress: () => removePost(post.id).catch(e => Alert.alert('Ups', errorText(e))),
            },
          ])
        },
      })
    } else if (post.author) {
      acciones.push({ text: 'Ver perfil', onPress: () => router.push(`/social/profile/${post.author!.id}`) })
    }
    acciones.push({ text: 'Cancelar', style: 'cancel' })
    Alert.alert('Publicación', undefined, acciones)
  }, [removePost])

  return (
    <Screen>
      <FlatList
        data={feed.posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={toggleLike}
            onComment={p => router.push(`/social/comments/${p.id}`)}
            onProfile={id => router.push(`/social/profile/${id}`)}
            onOptions={opciones}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListHeaderComponent={
          <>
            <Header />
            <Stories groups={stories} loading={storiesLoading} />
            <WallPicker value={scope} onChange={setScope} />
          </>
        }
        ListEmptyComponent={
          feed.loading ? <FeedSkeleton /> : feed.error ? (
            <Empty
              icon="cloud-offline-outline"
              title="No pudimos cargar el muro"
              text={feed.error}
              action="Reintentar"
              onAction={() => loadFeed(scope, 'first')}
            />
          ) : (
            <Empty
              icon={scope === 'foryou' ? 'sparkles-outline' : 'people-outline'}
              title={scope === 'foryou' ? 'Aún no hay nada por aquí' : 'Tu muro está tranquilo'}
              text={scope === 'foryou'
                ? 'Cuando alguien publique algo abierto, aparecerá aquí.'
                : 'Sigue a más gente para ver lo que comparte, o publica tú algo.'}
              action={scope === 'foryou' ? 'Buscar gente' : 'Publicar algo'}
              onAction={() => router.push(scope === 'foryou' ? '/social/search' : '/social/compose')}
            />
          )
        }
        ListFooterComponent={
          feed.loadingMore
            ? <ActivityIndicator color={T.accent} style={{ marginVertical: 22 }} />
            : <View style={{ height: 8 }} />
        }
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing}
            onRefresh={() => { loadFeed(scope, 'refresh'); loadStories(); loadBadges() }}
            tintColor={T.accent}
            colors={[T.accent]}
          />
        }
        onEndReached={() => loadFeed(scope, 'more')}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        // Sin esto, en listas largas con imágenes la memoria se dispara.
        removeClippedSubviews
        windowSize={9}
        maxToRenderPerBatch={6}
      />

      <Compose />
    </Screen>
  )
}

// ── Botón de publicar ────────────────────────────────────────────────────────

/** Flotante sobre el muro, por encima de la barra de pestañas. */
function Compose() {
  const T = useAppTheme()
  const escala = useRef(new Animated.Value(1)).current

  return (
    <Animated.View style={[cp.wrap, { transform: [{ scale: escala }] }]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
          router.push('/social/compose')
        }}
        onPressIn={() => Animated.spring(escala, { toValue: 0.9, useNativeDriver: true, tension: 400, friction: 12 }).start()}
        onPressOut={() => Animated.spring(escala, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start()}
        style={[cp.btn, { backgroundColor: T.accent, shadowColor: T.accent }]}
      >
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  )
}

const cp = StyleSheet.create({
  wrap: { position: 'absolute', right: 20, bottom: 104 },
  btn: {
    width: 56, height: 56, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16,
    elevation: 12,
  },
})
