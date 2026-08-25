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
 * En la cabecera solo quedan los avisos, pegados al borde derecho. Buscar,
 * mensajes y el perfil bajaron a la barra flotante: son sitios donde te
 * quedas, y ahí caen bajo el pulgar en vez de en la esquina de arriba. Los
 * avisos se quedan porque son lo único que INTERRUMPE — cuentan algo que acaba
 * de pasar— y porque el contador tiene que verse sin abrir nada.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Animated, ScrollView, Alert,
} from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Screen } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Typography } from '@/constants/theme'
import {
  Avatar, Badge, Empty, FeedSkeleton, BrandRing, timeAgo, confirmarBloqueo,
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
/**
 * Los dos muros, como dos palabras.
 *
 * Era un segmentado de vidrio a todo el ancho con su pastilla deslizante. Con
 * las publicaciones ya sin marco, ese control era el único bloque con borde de
 * la pantalla y tiraba del ojo más que las fotos. Dos palabras y una línea bajo
 * la activa hacen el mismo trabajo ocupando un tercio del alto.
 */
function WallPicker({
  value, onChange,
}: { value: FeedScope; onChange: (v: FeedScope) => void }) {
  const T = useAppTheme()

  const opciones: { key: FeedScope; label: string }[] = [
    { key: 'foryou', label: 'Para ti' },
    { key: 'friends', label: 'Amigos' },
  ]

  return (
    <View style={wp.wrap}>
      {opciones.map(o => {
        const activo = value === o.key
        return (
          <TouchableOpacity
            key={o.key}
            activeOpacity={0.7}
            hitSlop={10}
            onPress={() => {
              if (activo) return
              Haptics.selectionAsync().catch(() => {})
              onChange(o.key)
            }}
          >
            <Text style={[wp.txt, { color: activo ? T.ink : T.ink3 }]}>{o.label}</Text>
            <View style={[wp.raya, { backgroundColor: activo ? T.accent : 'transparent' }]} />
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const wp = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 18, paddingHorizontal: 16, paddingBottom: 14 },
  txt: { fontSize: 14, fontWeight: '700' },
  raya: { height: 2, borderRadius: 1, marginTop: 5 },
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
            ? <Avatar profile={mias.author} size={50} ring={vistas.has(mias.author.id) ? T.ink4 : T.accent} />
            : <Avatar profile={me} size={50} />}
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
            <Avatar profile={g.author} size={50} ring={T.ink4} />
          ) : (
            <BrandRing size={57}>
              <View style={{ borderRadius: 28, borderWidth: 2.5, borderColor: T.bg }}>
                <Avatar profile={g.author} size={49} />
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
  row: { paddingHorizontal: 16, gap: 13, paddingBottom: 14 },
  item: { alignItems: 'center', width: 60, gap: 6 },
  // Los nombres se quedan, más pequeños: una fila de caras sin nombre obliga a
  // tocar para saber de quién es cada historia.
  name: { fontSize: 10, fontWeight: '600' },
  plus: {
    position: 'absolute', bottom: -2, right: -2,
    width: 21, height: 21, borderRadius: 11, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  fantasma: { width: 50, height: 50, borderRadius: 25 },
  fantasmaTxt: { width: 44, height: 9, borderRadius: 5 },
})

// ── Cabecera ─────────────────────────────────────────────────────────────────

function Header() {
  const T = useAppTheme()
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
      {/*
        Solo Avisos.

        Buscar, Mensajes y el perfil bajaron a la barra flotante, detrás del
        galón: son sitios donde te quedas, y en la barra están donde está el
        pulgar en vez de en la esquina de arriba. Avisos se queda porque no
        cabía —el menú son cuatro y ninguno de los otros sobra— y porque es lo
        único de los cuatro que interrumpe: avisa de algo que ha pasado.
      */}
      <View style={hd.acciones}>
        {boton('notifications-outline', () => router.push('/social/notifications'),
          badges.notifications + badges.followRequests)}
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
  // Pegado al borde, sin reserva.
  //
  // Llevaba `marginRight: BotonIA.reserva` de cuando la cabecera tenía cuatro
  // botones y el de ZENA flotaba encima de la esquina. En Social ZENA no se
  // pinta, así que esos 44 pt eran un hueco vacío que dejaba la campana
  // colgando a media distancia del borde: ni alineada con el título ni con el
  // margen de la pantalla.
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  const toggleSave = useSocialStore(s => s.toggleSave)
  const removePost = useSocialStore(s => s.removePost)

  const feed = feeds[scope]

  // Al entrar en la sección se refresca lo que esté rancio. Cinco minutos es el
  // punto en que volver a pedir deja de ser molesto y empieza a ser útil.
  //
  // La fecha se pregunta al store en el momento, no se lee de `feed`: esta
  // función solo se vuelve a crear cuando cambia el muro elegido, así que
  // `feed` se quedaba congelado en el del último cambio —con `fetchedAt` a
  // cero— y la condición se cumplía SIEMPRE. El muro se volvía a pedir entero
  // cada vez que se entraba en la pestaña, que es justo lo que estas cinco
  // líneas existían para evitar.
  useFocusEffect(useCallback(() => {
    loadMe()
    loadBadges()
    const { fetchedAt } = useSocialStore.getState().feeds[scope]
    if (Date.now() - fetchedAt > 300_000) loadFeed(scope, 'first')
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

  /**
   * El menú de los tres puntos.
   *
   * Lo de una publicación propia y lo de una ajena no tienen nada que ver: en la
   * mía la única acción es borrarla; en la de otro, las que sirven para dejar de
   * verla. Por eso son dos listas distintas y no una con cosas apagadas.
   */
  const opciones = useCallback((post: Post) => {
    const acciones: any[] = [
      {
        text: post.savedByMe ? 'Quitar de guardados' : 'Guardar',
        onPress: () => toggleSave(post).catch(e => Alert.alert('Ups', errorText(e))),
      },
    ]

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
      const autor = post.author
      acciones.push(
        { text: 'Ver perfil', onPress: () => router.push(`/social/profile/${autor.id}`) },
        {
          text: 'Denunciar publicación',
          onPress: () => router.push({
            pathname: '/social/report',
            params: {
              tipo: 'post', id: post.id,
              nombre: autor.username ?? '', autorId: autor.id,
              // Para que se vea QUÉ se está denunciando antes de acusar.
              foto: post.media[0]?.url ?? '',
              resumen: post.content ?? '',
            },
          }),
        },
        {
          text: `Bloquear a ${autor.username ?? 'esta persona'}`,
          style: 'destructive',
          // Al bloquear, el muro entero cambia —sus publicaciones dejan de
          // existir para mí—, así que se vuelve a pedir en vez de intentar
          // quitarlas una a una de la lista que ya está en pantalla.
          onPress: () => confirmarBloqueo(autor.id, autor.username ?? undefined, () => {
            loadFeed(scope, 'refresh')
            loadStories()
            loadBadges()
          }),
        },
      )
    }

    acciones.push({ text: 'Cancelar', style: 'cancel' })
    Alert.alert('Publicación', undefined, acciones)
  }, [removePost, toggleSave, scope])

  return (
    <Screen>
      <FlatList
        data={feed.posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={toggleLike}
            onSave={p => toggleSave(p).catch(e => Alert.alert('Ups', errorText(e)))}
            onComment={p => router.push(`/social/post/${p.id}?comentar=1`)}
            onProfile={id => router.push(`/social/profile/${id}`)}
            onOptions={opciones}
          />
        )}
        // Sin marco que las delimite, lo que separa una publicación de otra es
        // este hueco. 14 pt bastaban entre tarjetas; a sangre se leían pegadas.
        ItemSeparatorComponent={() => <View style={{ height: 28 }} />}
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

    </Screen>
  )
}

/*
 * AQUÍ ESTABA EL BOTÓN FLOTANTE DE PUBLICAR
 * ─────────────────────────────────────────
 * Un círculo rojo sobre el muro, a la derecha, encima de la barra.
 *
 * Se quitó al bajar el menú de Social a la píldora: «Publicar» es una de sus
 * cuatro entradas, detrás del galón, y tener las dos era ofrecer dos veces lo
 * mismo a dos dedos de distancia. La que se queda es la del menú, porque está
 * donde están las otras tres cosas que se pueden hacer aquí.
 *
 * Si algún día se echa de menos, lo que se echa de menos es un atajo de UN
 * toque frente a los dos del menú — y esa es la conversación que hay que
 * tener, no devolver el botón sin más.
 */
