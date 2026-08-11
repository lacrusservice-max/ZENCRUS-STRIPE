/**
 * COMUNIDAD · AVISOS
 * ──────────────────
 * Quién te dio me gusta, quién comentó, quién quiere seguirte.
 *
 * Abrir la pantalla NO marca todo como leído: abrir y leer son cosas distintas,
 * y mezclarlas hace que un aviso desaparezca sin que nadie lo haya mirado. Se
 * marca al tocar cada uno, y hay un botón para marcarlos todos a la vez.
 */

import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Avatar, Btn, Empty, Skeleton, timeAgo } from '@/components/social/Bits'
import * as S from '@/services/socialService'

/** Qué dice cada tipo de aviso y con qué icono. */
const TEXTO: Record<S.NotificationType, { verbo: string; icon: any; color: string }> = {
  like:            { verbo: 'le gustó tu publicación', icon: 'heart',        color: '#FF1F3D' },
  comment:         { verbo: 'comentó tu publicación',  icon: 'chatbubble',   color: '#1F9DFF' },
  follow:          { verbo: 'empezó a seguirte',        icon: 'person-add',   color: '#12B981' },
  follow_request:  { verbo: 'quiere seguirte',          icon: 'person-add',   color: '#F5B31F' },
  follow_accepted: { verbo: 'aceptó tu solicitud',      icon: 'checkmark-circle', color: '#12B981' },
  mention:         { verbo: 'te mencionó',              icon: 'at',           color: '#C11FFF' },
}

export default function NotificationsScreen() {
  const T = useAppTheme()
  const [items, setItems] = useState<S.SocialNotification[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadBadges = useSocialStore(s => s.loadBadges)
  const badges = useSocialStore(s => s.badges)

  const cargar = useCallback(async (refrescar = false) => {
    refrescar ? setRefrescando(true) : setCargando(true)
    try {
      const p = await S.getNotifications()
      setItems(p.items)
      setCursor(p.nextBefore)
      setError(null)
      loadBadges()
    } catch (e) {
      setError(S.errorText(e, 'No pudimos cargar tus avisos'))
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { cargar(true) }, []))

  const cargarMas = async () => {
    if (!cursor) return
    try {
      const p = await S.getNotifications(cursor)
      setItems(i => [...i, ...p.items])
      setCursor(p.nextBefore)
    } catch { /* se reintenta al seguir desplazándose */ }
  }

  const abrir = async (n: S.SocialNotification) => {
    if (!n.isRead) {
      setItems(i => i.map(x => x.id === n.id ? { ...x, isRead: true } : x))
      S.markNotificationRead(n.id).then(loadBadges).catch(() => {})
    }
    if (n.type === 'follow_request') router.push('/social/requests')
    else if (n.post) router.push(`/social/comments/${n.post.id}`)
    else if (n.actor) router.push(`/social/profile/${n.actor.id}`)
  }

  const marcarTodas = async () => {
    setItems(i => i.map(x => ({ ...x, isRead: true })))
    try { await S.markAllNotificationsRead(); loadBadges() }
    catch (e) { Alert.alert('No pudimos marcarlas', S.errorText(e)) }
  }

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="COMUNIDAD"
        title="Avisos"
        icon="notifications"
        right={items.some(i => !i.isRead)
          ? <Btn label="Marcar leídas" onPress={marcarTodas} tone="soft" small />
          : undefined}
      />

      {badges.followRequests > 0 && (
        <TouchableOpacity
          style={[s.solicitudes, { backgroundColor: `${T.accent}12`, borderColor: `${T.accent}30` }]}
          onPress={() => router.push('/social/requests')}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={17} color={T.accent} />
          <Text style={[s.solicitudesTxt, { color: T.ink }]}>
            {badges.followRequests === 1
              ? 'Una persona quiere seguirte'
              : `${badges.followRequests} personas quieren seguirte`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={T.accent} />
        </TouchableOpacity>
      )}

      <FlatList
        data={items}
        keyExtractor={n => n.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={T.accent} />
        }
        onEndReached={cargarMas}
        onEndReachedThreshold={0.6}
        renderItem={({ item }) => {
          const d = TEXTO[item.type] ?? TEXTO.follow
          return (
            <TouchableOpacity
              style={[s.fila, !item.isRead && { backgroundColor: `${T.accent}0C` }]}
              onPress={() => abrir(item)}
              activeOpacity={0.75}
            >
              <View>
                <Avatar profile={item.actor} size={44} />
                <View style={[s.tipo, { backgroundColor: d.color, borderColor: T.bg }]}>
                  <Ionicons name={d.icon} size={10} color="#fff" />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[s.texto, { color: T.ink }]} numberOfLines={2}>
                  <Text style={{ fontWeight: '800' }}>
                    {item.actor?.username ?? item.actor?.fullName ?? 'Alguien'}
                  </Text>
                  {' '}{d.verbo}
                  {item.comment?.content ? `: «${item.comment.content}»` : ''}
                </Text>
                <Text style={[s.hora, { color: T.ink3 }]}>{timeAgo(item.createdAt)}</Text>
              </View>

              {item.post?.preview?.url && (
                <Image source={{ uri: item.post.preview.url }} style={s.portada} contentFit="cover" />
              )}
              {!item.isRead && <View style={[s.punto, { backgroundColor: T.accent }]} />}
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          cargando ? (
            <View style={{ gap: 18, paddingTop: 8 }}>
              {[0, 1, 2, 3].map(i => (
                <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Skeleton h={44} w={44} r={22} />
                  <View style={{ flex: 1, gap: 7 }}>
                    <Skeleton h={11} w={'80%'} /><Skeleton h={9} w={'30%'} />
                  </View>
                </View>
              ))}
            </View>
          ) : error ? (
            <Empty icon="cloud-offline-outline" title="No pudimos cargarlos" text={error}
              action="Reintentar" onAction={() => cargar()} />
          ) : (
            <Empty icon="notifications-outline" title="Nada nuevo"
              text="Cuando alguien interactúe con lo que publicas, te lo contamos aquí." tight />
          )
        }
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  solicitudes: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    marginHorizontal: 20, marginBottom: 14,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  solicitudesTxt: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 14,
  },
  tipo: {
    position: 'absolute', bottom: -2, right: -3,
    width: 19, height: 19, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  texto: { fontSize: 13.5, lineHeight: 19 },
  hora: { fontSize: 11, marginTop: 3 },
  portada: { width: 42, height: 42, borderRadius: 9 },
  punto: { width: 7, height: 7, borderRadius: 4 },
})
