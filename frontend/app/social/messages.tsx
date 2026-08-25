/**
 * COMUNIDAD · BANDEJA
 * ───────────────────
 * Los chats y, aparte, las solicitudes de quien todavía no puede escribirme.
 *
 * ── Las solicitudes siguen aparte, pero ya no cuestan una pestaña ───────────
 * Mezclarlas con los chats convierte la bandeja en un sitio incómodo: cualquier
 * desconocido aparecería junto a la gente con la que hablas. Siguen separadas.
 *
 * Lo que cambia es cómo se llega: eran dos pestañas a todo el ancho, siempre
 * presentes aunque no hubiera ninguna solicitud — un control permanente para
 * algo que casi nunca pasa. Ahora es una fila al final de la lista, y solo
 * aparece cuando hay alguna.
 *
 * ── La fila de caras ────────────────────────────────────────────────────────
 * Arriba, las conversaciones abiertas como avatares. Abrir un chat es lo que
 * más se hace aquí y así cuesta un toque sin leer ninguna fila. Las que tienen
 * sin leer llevan el aro encendido, igual que las historias.
 */

import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, ScrollView,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Avatar, Badge, Empty, Skeleton, timeAgo } from '@/components/social/Bits'
import * as S from '@/services/socialService'
import { useLivePoll } from '@/hooks/useLivePoll'
import { TabBar } from '@/constants/layout'

export default function MessagesScreen() {
  const T = useAppTheme()
  const [inbox, setInbox] = useState<S.Inbox>({ chats: [], requests: [], unread: { chats: 0, requests: 0 } })
  const [pestana, setPestana] = useState<'chats' | 'requests'>('chats')
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadBadges = useSocialStore(s => s.loadBadges)

  const cargar = useCallback(async (refrescar = false) => {
    refrescar ? setRefrescando(true) : setCargando(true)
    try {
      setInbox(await S.getInbox())
      setError(null)
      loadBadges()
    } catch (e) {
      setError(S.errorText(e, 'No pudimos cargar tus mensajes'))
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  // Al volver de un chat hay que recargar: el contador de sin leer cambió.
  useFocusEffect(useCallback(() => { cargar(true) }, []))

  /**
   * La bandeja se refresca sola, pero mucho más despacio que un chat abierto.
   * Aquí nadie está esperando una respuesta concreta: basta con que la lista no
   * esté rancia cuando llegue un mensaje mientras se mira.
   *
   * Sin `refrescando`, la rueda de «tirar para actualizar» aparecería sola cada
   * quince segundos.
   */
  useLivePoll(async () => {
    try { setInbox(await S.getInbox()); loadBadges() } catch { /* se reintenta */ }
  }, 15000)

  const responder = async (c: S.Conversation, aceptar: boolean) => {
    try {
      aceptar ? await S.acceptConversation(c.id) : await S.rejectConversation(c.id)
      await cargar(true)
      if (aceptar) router.push(`/social/chat/${c.id}`)
    } catch (e) {
      Alert.alert('No pudimos completar la acción', S.errorText(e))
    }
  }

  const lista = pestana === 'chats' ? inbox.chats : inbox.requests

  const vistaPrevia = (c: S.Conversation) => {
    if (!c.lastMessage) return 'Sin mensajes todavía'
    const m = c.lastMessage
    const cuerpo = m.body ?? (m.mediaType === 'video' ? 'Vídeo' : 'Foto')
    return m.mine ? `Tú: ${cuerpo}` : cuerpo
  }

  return (
    <Screen>
      <ScreenHeader back eyebrow="COMUNIDAD" title="Mensajes" icon="chatbubbles" />

      {pestana === 'requests' ? (
        <TouchableOpacity
          style={sv.volver}
          onPress={() => setPestana('chats')}
          activeOpacity={0.75}
        >
          <Ionicons name="chevron-back" size={16} color={T.accent} />
          <Text style={[sv.volverTxt, { color: T.accent }]}>Volver a los chats</Text>
        </TouchableOpacity>
      ) : inbox.chats.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={sv.caras}
        >
          {inbox.chats.map(c => (
            <TouchableOpacity
              key={c.id}
              style={sv.cara}
              activeOpacity={0.8}
              onPress={() => router.push(`/social/chat/${c.id}`)}
            >
              <Avatar profile={c.other} size={46} ring={c.unread > 0 ? T.accent : undefined} />
              <Text style={[sv.caraN, { color: T.ink3 }]} numberOfLines={1}>
                {c.other?.username ?? c.other?.fullName ?? '—'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={lista}
        keyExtractor={c => c.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TabBar.scrollInset }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={T.accent} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.fila}
            onPress={() => router.push(`/social/chat/${item.id}`)}
            activeOpacity={0.75}
          >
            <Avatar profile={item.other} size={50} />
            <View style={{ flex: 1 }}>
              <View style={s.cabeza}>
                <Text style={[s.nombre, { color: T.ink }]} numberOfLines={1}>
                  {item.other?.fullName ?? item.other?.username ?? 'Cuenta ZENCRUS'}
                </Text>
                {item.lastMessageAt && (
                  <Text style={[s.hora, { color: T.ink3 }]}>{timeAgo(item.lastMessageAt)}</Text>
                )}
              </View>
              <Text
                style={[
                  s.previa,
                  { color: item.unread > 0 ? T.ink : T.ink3 },
                  item.unread > 0 && { fontWeight: '600' },
                ]}
                numberOfLines={1}
              >
                {vistaPrevia(item)}
              </Text>
              {item.iRequested && item.status === 'pending' && (
                <Text style={[s.nota, { color: T.ink3 }]}>Esperando a que acepte tu solicitud</Text>
              )}
            </View>

            {pestana === 'requests' ? (
              <View style={s.respuesta}>
                <TouchableOpacity
                  style={[s.mini, { backgroundColor: T.accent }]}
                  onPress={() => responder(item, true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark" size={15} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.mini, { backgroundColor: T.glass, borderWidth: 1, borderColor: T.glassBorder }]}
                  onPress={() => responder(item, false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={15} color={T.ink2} />
                </TouchableOpacity>
              </View>
            ) : item.unread > 0 ? (
              <Badge count={item.unread} />
            ) : null}
          </TouchableOpacity>
        )}
        ListFooterComponent={
          pestana === 'chats' && inbox.requests.length ? (
            <TouchableOpacity
              style={[sv.solicitudes, { backgroundColor: T.glass, borderColor: T.glassBorder }]}
              onPress={() => setPestana('requests')}
              activeOpacity={0.8}
            >
              <Ionicons name="mail-outline" size={16} color={T.ink3} />
              <Text style={[sv.solicitudesTxt, { color: T.ink2 }]}>
                {inbox.requests.length === 1
                  ? '1 solicitud esperando'
                  : `${inbox.requests.length} solicitudes esperando`}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={T.ink3} />
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          cargando ? (
            <View style={{ gap: 20, paddingTop: 8 }}>
              {[0, 1, 2, 3].map(i => (
                <View key={i} style={s.fila}>
                  <Skeleton h={50} w={50} r={25} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton h={12} w={'50%'} /><Skeleton h={10} w={'75%'} />
                  </View>
                </View>
              ))}
            </View>
          ) : error ? (
            <Empty icon="cloud-offline-outline" title="No pudimos cargarlos" text={error}
              action="Reintentar" onAction={() => cargar()} />
          ) : pestana === 'requests' ? (
            <Empty icon="mail-open-outline" title="Sin solicitudes"
              text="Cuando alguien a quien no sigues te escriba, su mensaje esperará aquí." tight />
          ) : (
            <Empty
              icon="chatbubbles-outline"
              title="Ninguna conversación"
              text="Entra en el perfil de alguien y escríbele para empezar."
              action="Buscar gente"
              onAction={() => router.push('/social/search')}
              tight
            />
          )
        }
      />
    </Screen>
  )
}

const sv = StyleSheet.create({
  caras: { paddingHorizontal: 20, gap: 14, paddingBottom: 16 },
  cara: { alignItems: 'center', width: 56, gap: 6 },
  caraN: { fontSize: 10, fontWeight: '600' },
  volver: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 18, paddingBottom: 12 },
  volverTxt: { fontSize: 13, fontWeight: '700' },
  solicitudes: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 18, padding: 13, borderRadius: 15, borderWidth: 1,
  },
  solicitudesTxt: { flex: 1, fontSize: 13 },
})

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombre: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  hora: { fontSize: 11 },
  previa: { fontSize: 13, marginTop: 3 },
  nota: { fontSize: 11, marginTop: 3, fontStyle: 'italic' },
  respuesta: { flexDirection: 'row', gap: 7 },
  mini: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
})
