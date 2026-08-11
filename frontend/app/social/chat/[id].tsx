/**
 * COMUNIDAD · CHAT
 * ────────────────
 * Una conversación de dos, con adjuntos.
 *
 * ── La lista va del revés ───────────────────────────────────────────────────
 * `inverted` y los mensajes del más nuevo al más viejo, que es justo como los
 * manda el servidor. Así el chat abre abajo sin saltos y cargar lo antiguo es
 * seguir desplazándose, no un botón.
 *
 * ── Sin tiempo real, todavía ────────────────────────────────────────────────
 * No hay websockets ni avisos push: los mensajes nuevos llegan al abrir el chat
 * o al tirar hacia abajo. Está reconocido y decidido — el push se monta después
 * para toda la app de una vez, no solo para aquí.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { Screen } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Avatar, Btn, Empty, Skeleton, timeAgo } from '@/components/social/Bits'
import { VideoPlayer } from '@/components/social/VideoPlayer'
import * as S from '@/services/socialService'

export default function ChatScreen() {
  const T = useAppTheme()
  const { width } = useWindowDimensions()
  const { id } = useLocalSearchParams<{ id: string }>()
  const loadBadges = useSocialStore(s => s.loadBadges)

  const [conv, setConv] = useState<S.Conversation | null>(null)
  const [mensajes, setMensajes] = useState<S.DirectMessage[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [adjuntando, setAdjuntando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Cargar ─────────────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    if (!id) return
    try {
      const [c, pagina] = await Promise.all([S.getConversation(id), S.getMessages(id)])
      setConv(c)
      setMensajes(pagina.messages)
      setCursor(pagina.nextBefore)
      setError(null)
      // Marcar leído al abrir: el contador de la barra tiene que bajar ya.
      if (c.unread > 0) {
        await S.markConversationRead(id).catch(() => {})
        loadBadges()
      }
    } catch (e) {
      setError(S.errorText(e, 'No pudimos abrir esta conversación'))
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const cargarMas = async () => {
    if (!id || !cursor || cargandoMas) return
    setCargandoMas(true)
    try {
      const pagina = await S.getMessages(id, cursor)
      setMensajes(m => [...m, ...pagina.messages])
      setCursor(pagina.nextBefore)
    } catch { /* si falla, se reintenta al seguir desplazándose */ }
    finally { setCargandoMas(false) }
  }

  // ── Enviar ─────────────────────────────────────────────────────────────────

  const enviar = async (media?: { key: string; contentType: string }) => {
    const cuerpo = texto.trim()
    if ((!cuerpo && !media) || enviando || !id) return

    setEnviando(true)
    if (cuerpo) setTexto('')
    Haptics.selectionAsync().catch(() => {})

    try {
      const m = await S.sendMessage(id, { body: cuerpo || undefined, media })
      setMensajes(prev => [m, ...prev])
      // Si era una solicitud y el servidor la aceptó al contestar, la cabecera
      // tiene que reflejarlo o el aviso seguiría diciendo que está pendiente.
      if (m.conversationStatus && conv && m.conversationStatus !== conv.status) {
        setConv({ ...conv, status: m.conversationStatus, isRequest: false, iRequested: m.conversationStatus === 'pending' })
      }
    } catch (e) {
      if (cuerpo) setTexto(cuerpo)   // no se pierde lo escrito
      Alert.alert('No se envió', S.errorText(e))
    } finally {
      setEnviando(false)
    }
  }

  const adjuntar = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permiso.granted) {
      Alert.alert('Sin acceso a tus fotos', 'Dale permiso desde los ajustes del teléfono para enviar imágenes.')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'], quality: 0.85, videoMaxDuration: 30,
    })
    if (res.canceled) return

    setAdjuntando(true)
    try {
      const subido = await S.uploadMedia(res.assets[0].uri, 'dm')
      await enviar(subido)
    } catch (e) {
      Alert.alert('No pudimos enviar el archivo', S.errorText(e))
    } finally {
      setAdjuntando(false)
    }
  }

  const responderSolicitud = async (aceptar: boolean) => {
    if (!id) return
    try {
      aceptar ? await S.acceptConversation(id) : await S.rejectConversation(id)
      aceptar ? await cargar() : router.back()
    } catch (e) {
      Alert.alert('No pudimos completar la acción', S.errorText(e))
    }
  }

  const bloquear = () => {
    Alert.alert(
      'Bloquear esta conversación',
      'Dejará de poder escribirte. Podrás reabrirla cuando quieras.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: async () => {
            try { await S.blockConversation(id!); router.back() }
            catch (e) { Alert.alert('No pudimos bloquearla', S.errorText(e)) }
          },
        },
      ],
    )
  }

  // ── Interfaz ───────────────────────────────────────────────────────────────

  const anchoMedia = Math.min(width * 0.62, 260)

  return (
    <Screen>
      {/* Cabecera propia: más compacta que la general, para dejar sitio al chat */}
      <View style={[cb.wrap, { borderColor: T.glassBorder }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={cb.atras}>
          <Ionicons name="chevron-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <TouchableOpacity
          style={cb.quien}
          activeOpacity={0.75}
          onPress={() => conv?.other && router.push(`/social/profile/${conv.other.id}`)}
        >
          <Avatar profile={conv?.other} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={[cb.nombre, { color: T.ink }]} numberOfLines={1}>
              {conv?.other?.fullName ?? conv?.other?.username ?? 'Conversación'}
            </Text>
            {conv?.other?.username && (
              <Text style={[cb.usuario, { color: T.ink3 }]} numberOfLines={1}>@{conv.other.username}</Text>
            )}
          </View>
        </TouchableOpacity>
        {conv && conv.status === 'accepted' && (
          <TouchableOpacity onPress={bloquear} hitSlop={10}>
            <Ionicons name="ellipsis-horizontal" size={19} color={T.ink3} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <FlatList
          data={mensajes}
          keyExtractor={m => m.id}
          inverted
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14, gap: 8 }}
          onEndReached={cargarMas}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={[b.fila, item.mine ? b.mia : b.suya]}>
              <View style={[
                b.burbuja,
                item.mine
                  ? { backgroundColor: T.accent, borderBottomRightRadius: 5 }
                  : { backgroundColor: T.glass, borderColor: T.glassBorder, borderWidth: 1, borderBottomLeftRadius: 5 },
              ]}>
                {item.media?.url && (
                  item.media.type === 'video' ? (
                    <VideoPlayer
                      uri={item.media.url}
                      width={anchoMedia}
                      height={anchoMedia * 0.8}
                      style={{ borderRadius: 12, overflow: 'hidden', marginBottom: item.body ? 8 : 0 }}
                    />
                  ) : (
                    <Image
                      source={{ uri: item.media.url }}
                      style={{ width: anchoMedia, height: anchoMedia * 0.8, borderRadius: 12, marginBottom: item.body ? 8 : 0 }}
                      contentFit="cover"
                      transition={160}
                    />
                  )
                )}
                {item.media && !item.media.url && (
                  <Text style={[b.roto, { color: item.mine ? 'rgba(255,255,255,0.7)' : T.ink3 }]}>
                    No pudimos cargar el archivo
                  </Text>
                )}
                {!!item.body && (
                  <Text style={[b.texto, { color: item.mine ? '#FFFFFF' : T.ink }]}>{item.body}</Text>
                )}
                <View style={b.pie}>
                  <Text style={[b.hora, { color: item.mine ? 'rgba(255,255,255,0.66)' : T.ink3 }]}>
                    {timeAgo(item.createdAt)}
                  </Text>
                  {item.mine && (
                    <Ionicons
                      name={item.readAt ? 'checkmark-done' : 'checkmark'}
                      size={13}
                      color={item.readAt ? '#FFFFFF' : 'rgba(255,255,255,0.66)'}
                    />
                  )}
                </View>
              </View>
            </View>
          )}
          ListFooterComponent={cargandoMas ? <ActivityIndicator color={T.ink3} style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            cargando ? (
              <View style={{ gap: 14, paddingTop: 20, transform: [{ scaleY: -1 }] }}>
                {[0, 1, 2].map(i => (
                  <Skeleton key={i} h={44} w={i % 2 ? '55%' : '70%'} r={16}
                    style={{ alignSelf: i % 2 ? 'flex-end' : 'flex-start' }} />
                ))}
              </View>
            ) : error ? (
              <View style={{ transform: [{ scaleY: -1 }] }}>
                <Empty icon="cloud-offline-outline" title="No pudimos abrirla" text={error}
                  action="Reintentar" onAction={cargar} tight />
              </View>
            ) : (
              <View style={{ transform: [{ scaleY: -1 }] }}>
                <Empty icon="chatbubble-ellipses-outline" title="Todavía no os habéis escrito"
                  text="Escribe lo primero y rompe el hielo." tight />
              </View>
            )
          }
        />

        {/* Pie: escribir, responder la solicitud, o el motivo por el que no se puede */}
        {conv?.isRequest ? (
          <View style={[p.aviso, { backgroundColor: T.bgSurface, borderColor: T.glassBorder }]}>
            <Text style={[p.avisoTxt, { color: T.ink2 }]}>
              Esta persona quiere escribirte. Si aceptas, podréis hablar; si no, dejará de poder mandarte mensajes.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn label="Rechazar" onPress={() => responderSolicitud(false)} tone="soft" full />
              <Btn label="Aceptar" onPress={() => responderSolicitud(true)} tone="solid" full />
            </View>
          </View>
        ) : conv && !conv.canWrite ? (
          <View style={[p.aviso, { backgroundColor: T.bgSurface, borderColor: T.glassBorder }]}>
            <Text style={[p.avisoTxt, { color: T.ink3, textAlign: 'center' }]}>
              {conv.writeBlockedReason ?? 'No puedes escribir en esta conversación'}
            </Text>
            {conv.status === 'blocked' && !conv.iRequested && (
              <Btn label="Reabrir conversación" onPress={() => responderSolicitud(true)} tone="soft" />
            )}
          </View>
        ) : (
          <View style={[p.barra, { backgroundColor: T.bgSurface, borderColor: T.glassBorder }]}>
            <TouchableOpacity
              onPress={adjuntar}
              disabled={adjuntando}
              style={[p.adjuntar, { backgroundColor: T.glass, borderColor: T.glassBorder }]}
              activeOpacity={0.75}
            >
              {adjuntando
                ? <ActivityIndicator size="small" color={T.ink3} />
                : <Ionicons name="image-outline" size={18} color={T.ink2} />}
            </TouchableOpacity>
            <TextInput
              style={[p.input, { color: T.ink }]}
              placeholder="Escribe un mensaje…"
              placeholderTextColor={T.ink3}
              value={texto}
              onChangeText={t => t.length <= 2000 && setTexto(t)}
              multiline
            />
            <TouchableOpacity
              onPress={() => enviar()}
              disabled={!texto.trim() || enviando}
              style={[p.enviar, { backgroundColor: texto.trim() ? T.accent : T.ink4 }]}
              activeOpacity={0.8}
            >
              {enviando
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="arrow-up" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

const cb = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4, borderBottomWidth: 1,
  },
  atras: { padding: 2 },
  quien: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nombre: { fontSize: 15, fontWeight: '700' },
  usuario: { fontSize: 11.5, marginTop: 1 },
})

const b = StyleSheet.create({
  fila: { flexDirection: 'row' },
  mia: { justifyContent: 'flex-end' },
  suya: { justifyContent: 'flex-start' },
  burbuja: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  texto: { fontSize: 15, lineHeight: 21 },
  roto: { fontSize: 12, fontStyle: 'italic' },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', marginTop: 4 },
  hora: { fontSize: 10.5 },
})

const p = StyleSheet.create({
  barra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 9,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, borderTopWidth: 1,
  },
  adjuntar: {
    width: 36, height: 36, borderRadius: 13, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 1,
  },
  input: { flex: 1, fontSize: 15, maxHeight: 120, paddingVertical: 8, lineHeight: 21 },
  enviar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 1,
  },
  aviso: {
    padding: 18, paddingBottom: 28, borderTopWidth: 1, gap: 14,
  },
  avisoTxt: { fontSize: 13, lineHeight: 19 },
})
