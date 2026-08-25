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
 * ── Las fotos no van dentro de una burbuja ──────────────────────────────────
 * Una foto metida en un rectángulo rojo con 6 pt de aire alrededor se ve como
 * una foto enmarcada, no como una foto enviada. Va suelta, con sus esquinas
 * redondeadas y nada detrás.
 *
 * ── El «visto» se dice una vez ──────────────────────────────────────────────
 * Antes cada mensaje propio llevaba su doble tic. En una conversación de
 * cuarenta mensajes eso son cuarenta marcas repitiendo lo mismo. Lo que importa
 * es si han leído lo ÚLTIMO, así que se dice una sola vez al pie del hilo.
 *
 * ── El tiempo real es por refresco, no por websockets ───────────────────────
 * Mientras la conversación está delante Y la app en primer plano, se vuelve a
 * pedir la primera página cada cinco segundos (`useLivePoll`). Un socket
 * obligaría a autenticar la conexión aparte del JWT y a reconectar a mano en
 * cada cambio de red, para el mismo resultado visible. Fuera de la app avisa el
 * push (`services/pushService`), que llega sin el texto del mensaje: se leería
 * en la pantalla bloqueada.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions, Pressable,
} from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { VisorImagen } from '@/components/social/VisorImagen'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { Screen } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Avatar, Btn, Empty, Skeleton, timeAgo } from '@/components/social/Bits'
import { VideoPlayer } from '@/components/social/VideoPlayer'
import { useLivePoll } from '@/hooks/useLivePoll'
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

  /**
   * Espejo de `mensajes` para poder consultarlo fuera de un render.
   *
   * El refresco automático necesita saber qué hay ya en pantalla ANTES de
   * decidir si marca leído, y un estado de React solo se puede leer de verdad
   * dentro de su actualizador —que corre cuando React quiere—. Esta referencia
   * lleva siempre la última lista y no provoca ningún render.
   */
  const espejo = useRef<S.DirectMessage[]>([])
  useEffect(() => { espejo.current = mensajes }, [mensajes])

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

  /**
   * Trae lo que haya llegado mientras la conversación está abierta.
   *
   * Pide la primera página y añade solo lo que no estaba: reemplazar la lista
   * entera perdería la posición de quien está leyendo hacia atrás, y volvería a
   * pedir cada foto ya descargada.
   *
   * También marca leído lo nuevo del otro, que es lo que un chat abierto
   * significa — y lo que hace bajar el contador en su pantalla.
   */
  const refrescar = useCallback(async () => {
    if (!id) return
    const pagina = await S.getMessages(id)

    // Qué hay ya en pantalla se mira en el ESPEJO, no dentro del actualizador
    // de `setMensajes`.
    //
    // Estaba dentro, y de ahí salía la decisión de marcar leído. React no
    // promete ejecutar ese actualizador antes de devolver el control: solo lo
    // hace cuando la cola de la pantalla está vacía, como atajo interno. Basta
    // con que haya un cambio de estado pendiente —y escribir en el campo de
    // texto es exactamente eso— para que la comprobación de después leyera
    // siempre «no ha llegado nada». O sea: los mensajes que llegaban mientras
    // escribías no se marcaban leídos, y al otro le quedaba el visto sin
    // llenar hasta que cerrabas y volvías a abrir el chat.
    const conocidos = new Set(espejo.current.map(m => m.id))
    const nuevos = pagina.messages.filter(m => !conocidos.has(m.id))

    if (!nuevos.length) {
      // Aunque no haya mensajes nuevos, el «leído» del otro sí puede haber
      // cambiado: se refresca ese estado sin tocar el resto.
      const porId = new Map(pagina.messages.map(m => [m.id, m]))
      setMensajes(prev => prev.map(m => {
        const fresco = porId.get(m.id)
        return fresco && fresco.readAt !== m.readAt ? { ...m, readAt: fresco.readAt } : m
      }))
      return
    }

    // Se vuelve a filtrar contra `prev` porque entre leer el espejo y aplicar
    // el cambio puede haberse enviado un mensaje desde esta misma pantalla.
    setMensajes(prev => {
      const yaEstan = new Set(prev.map(m => m.id))
      return [...nuevos.filter(m => !yaEstan.has(m.id)), ...prev]
    })

    if (nuevos.some(m => !m.mine)) {
      await S.markConversationRead(id).catch(() => {})
      loadBadges()
    }
  }, [id])

  // Cinco segundos: lo bastante para que una conversación se sienta viva, y lo
  // bastante espaciado para caber de sobra en el presupuesto de la comunidad.
  useLivePoll(refrescar, 5000, !!id && !error)

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

  /**
   * Borra un mensaje propio.
   *
   * ── El aviso dice que desaparece para los dos ───────────────────────────────
   * Porque es lo que hace: el servidor borra la fila y, si llevaba archivo, lo
   * quita del bucket. No es «borrar para mí». Dejar eso sin decir es la clase
   * de sorpresa que hace que alguien borre pensando que se arrepiente en
   * privado y descubra después que le quitó el mensaje a la otra persona.
   *
   * Se quita de la lista antes de preguntar y se devuelve si el servidor dice
   * que no, igual que el resto de la sección.
   */
  const borrarMensaje = (m: S.DirectMessage) => {
    if (!m.mine) return
    Alert.alert(
      'Eliminar mensaje',
      'Desaparecerá también para la otra persona, y no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const copia = espejo.current
            setMensajes(prev => prev.filter(x => x.id !== m.id))
            try {
              await S.deleteMessage(m.id)
            } catch (e) {
              setMensajes(copia)
              Alert.alert('No pudimos borrarlo', S.errorText(e))
            }
          },
        },
      ],
    )
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

  /** El día natural de un mensaje, para saber cuándo cambia. */
  const dia = (iso: string) => new Date(iso).toDateString()

  /** «Hoy», «Ayer» o la fecha. */
  const nombreDia = (iso: string) => {
    const d = new Date(iso)
    const hoy = new Date()
    const ayer = new Date(hoy.getTime() - 86400_000)
    if (d.toDateString() === hoy.toDateString()) return 'HOY'
    if (d.toDateString() === ayer.toDateString()) return 'AYER'
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }).toUpperCase()
  }

  /** La foto que se está mirando a pantalla completa, si hay alguna. */
  const [mirando, setMirando] = useState<string | null>(null)

  /**
   * Alto real de cada foto, medido al cargarla.
   *
   * El mensaje no trae las dimensiones —`DirectMessage.media` es solo `url` y
   * `type`—, así que se sacan del propio `onLoad` y se guardan por url. Sin
   * esto todas iban a una caja fija recortadas al centro, y una foto vertical
   * se veía por la mitad.
   */
  const [proporciones, setProporciones] = useState<Record<string, number>>({})

  // El último mensaje mío, que es del único del que interesa saber si lo leyeron.
  const ultimoMio = mensajes.find(m => m.mine)

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
          renderItem={({ item, index }) => {
            // La lista va del más nuevo al más viejo, así que el siguiente es el
            // ANTERIOR en el tiempo. Si cae en otro día, este mensaje abre día.
            const anterior = mensajes[index + 1]
            const abreDia = !anterior || dia(anterior.createdAt) !== dia(item.createdAt)
            const soloFoto = !!item.media?.url && !item.body

            return (
              <View>
                {abreDia && (
                  <Text style={[b.dia, { color: T.ink3 }]}>{nombreDia(item.createdAt)}</Text>
                )}
                <View style={[b.fila, item.mine ? b.mia : b.suya]}>
                  <Pressable
                    onLongPress={() => {
                      if (!item.mine) return
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
                      borrarMensaje(item)
                    }}
                    delayLongPress={320}
                    style={[
                      soloFoto ? b.suelta : b.burbuja,
                      !soloFoto && (item.mine
                        ? { backgroundColor: T.accent, borderBottomRightRadius: 5 }
                        : { backgroundColor: T.glass, borderColor: T.glassBorder, borderWidth: 1, borderBottomLeftRadius: 5 }),
                    ]}
                  >
                    {item.media?.url && (
                      item.media.type === 'video' ? (
                        <VideoPlayer
                          uri={item.media.url}
                          width={anchoMedia}
                          height={anchoMedia * 0.8}
                          style={{ borderRadius: 16, overflow: 'hidden', marginBottom: item.body ? 8 : 0 }}
                        />
                      ) : (
                        <Pressable
                          onPress={() => setMirando(item.media!.url)}
                          // El pulsar largo de borrar es del padre; sin esto,
                          // sobre la foto dejaba de funcionar.
                          onLongPress={() => {
                            if (!item.mine) return
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
                            borrarMensaje(item)
                          }}
                          delayLongPress={320}
                        >
                          <Image
                            source={{ uri: item.media.url }}
                            style={{
                              width: anchoMedia,
                              // Tope a 1,45×: una foto muy alargada ocuparía la
                              // pantalla entera y taparía la conversación.
                              height: anchoMedia * Math.min(proporciones[item.media.url] ?? 0.8, 1.45),
                              borderRadius: 16,
                              marginBottom: item.body ? 8 : 0,
                            }}
                            contentFit="cover"
                            transition={160}
                            onLoad={e => {
                              const { width: w, height: h } = e.source ?? {}
                              if (!w || !h) return
                              const url = item.media!.url!
                              setProporciones(prev => prev[url] ? prev : { ...prev, [url]: h / w })
                            }}
                          />
                        </Pressable>
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
                  </Pressable>
                </View>
              </View>
            )
          }}
          ListFooterComponent={cargandoMas ? <ActivityIndicator color={T.ink3} style={{ marginVertical: 16 }} /> : null}
          // En una lista invertida la CABECERA se pinta abajo del todo, que es
          // justo donde tiene que ir el estado del último mensaje.
          ListHeaderComponent={
            ultimoMio ? (
              <Text style={[b.visto, { color: T.ink3 }]}>
                {ultimoMio.readAt ? `Visto ${timeAgo(ultimoMio.readAt)}` : 'Enviado'}
              </Text>
            ) : null
          }
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

      <VisorImagen uri={mirando} abierto={!!mirando} onCerrar={() => setMirando(null)} />
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
  // Una foto sola no lleva fondo: es la foto y ya.
  suelta: { maxWidth: '82%' },
  dia: { fontSize: 10, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginVertical: 12 },
  visto: { fontSize: 10.5, textAlign: 'right', marginTop: 4, marginBottom: 2 },
  texto: { fontSize: 15, lineHeight: 21 },
  roto: { fontSize: 12, fontStyle: 'italic' },

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
