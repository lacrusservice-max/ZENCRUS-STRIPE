/**
 * COMUNIDAD · AVISOS
 * ──────────────────
 * Quién te dio me gusta, quién comentó, quién quiere seguirte.
 *
 * Abrir la pantalla NO marca todo como leído: abrir y leer son cosas distintas,
 * y mezclarlas hace que un aviso desaparezca sin que nadie lo haya mirado. Se
 * marca al tocar cada uno, y hay un botón para marcarlos todos a la vez.
 *
 * ── Se agrupan por tiempo y se juntan los repetidos ─────────────────────────
 * «Hoy», «Esta semana», «Antes». Y varios me gusta sobre la MISMA publicación
 * salen en una línea —«ana y luis le dieron me gusta»— en vez de tres filas
 * idénticas: con quince me gusta, la lista dejaba de servir para ver lo demás.
 *
 * Un aviso de «empezó a seguirte» NO trae botón de seguir de vuelta. El aviso no
 * dice si ya sigues a esa persona, y pintar «Seguir» sobre alguien a quien ya
 * sigues es peor que no ofrecerlo. Se toca la fila y se decide en su perfil.
 *
 * Mantener pulsado un aviso lo descarta. El subtítulo de la cabecera lo dice,
 * porque un gesto que no se ve en ninguna parte no lo encuentra nadie.
 */

import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Avatar, Btn, Empty, Skeleton, timeAgo } from '@/components/social/Bits'
import * as S from '@/services/socialService'
import { TabBar } from '@/constants/layout'

/** Qué dice cada tipo de aviso y con qué icono. */
const TEXTO: Record<S.NotificationType, { verbo: string; icon: any; color: string }> = {
  like:            { verbo: 'le gustó tu publicación', icon: 'heart',        color: '#FF5C00' },
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
    else if (n.post) router.push(`/social/post/${n.post.id}`)
    else if (n.actor) router.push(`/social/profile/${n.actor.id}`)
  }

  const marcarTodas = async () => {
    // Se guarda el estado anterior para poder devolverlo. Sin esto, un fallo
    // del servidor dejaba los avisos marcados EN PANTALLA y sin marcar en el
    // servidor: al volver a entrar reaparecían todos sin leer, que se lee como
    // que la app perdió lo que hiciste.
    const copia = items
    setItems(i => i.map(x => ({ ...x, isRead: true })))
    try {
      await S.markAllNotificationsRead()
      loadBadges()
    } catch (e) {
      setItems(copia)
      Alert.alert('No pudimos marcarlas', S.errorText(e))
    }
  }

  /**
   * Descarta un aviso.
   *
   * Mantener pulsado, no deslizar: en esta app ninguna lista se desliza, y
   * meter aquí el único gesto de ese tipo obligaría a descubrirlo por accidente.
   *
   * Solo desaparece de MI bandeja — no deshace el me gusta ni avisa a nadie—,
   * y por eso la palabra es «descartar» y no «eliminar».
   */
  const descartar = (n: S.SocialNotification) => {
    Alert.alert(
      'Descartar aviso',
      'Desaparecerá de tu lista. Quien lo provocó no se entera de nada.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: async () => {
            const copia = items
            setItems(i => i.filter(x => x.id !== n.id))
            try {
              await S.deleteNotification(n.id)
              // Si estaba sin leer, su contador acaba de bajar.
              if (!n.isRead) loadBadges()
            } catch (e) {
              setItems(copia)
              Alert.alert('No pudimos descartarlo', S.errorText(e))
            }
          },
        },
      ],
    )
  }

  /**
   * La lista tal y como se pinta: separadores de tiempo y avisos ya agrupados.
   *
   * Se recorre una sola vez y en orden, que ya viene del más nuevo al más
   * viejo. Solo se juntan me gusta CONSECUTIVOS de la misma publicación: si
   * entre medias hay un comentario, la conversación se rompería.
   */
  const filas = (() => {
    const out: ({ sep: string } | { avisos: S.SocialNotification[] })[] = []
    const ahora = Date.now()
    let tramoActual = ''

    for (const n of items) {
      const horas = (ahora - new Date(n.createdAt).getTime()) / 3600_000
      const tramo = horas < 24 ? 'HOY' : horas < 168 ? 'ESTA SEMANA' : 'ANTES'
      if (tramo !== tramoActual) { out.push({ sep: tramo }); tramoActual = tramo }

      const ultima = out[out.length - 1]
      const juntable =
        ultima && 'avisos' in ultima &&
        n.type === 'like' && ultima.avisos[0].type === 'like' &&
        !!n.post && ultima.avisos[0].post?.id === n.post.id
      if (juntable) (ultima as { avisos: S.SocialNotification[] }).avisos.push(n)
      else out.push({ avisos: [n] })
    }
    return out
  })()

  /** «ana», «ana y luis», «ana y 4 más». */
  const quienes = (grupo: S.SocialNotification[]) => {
    const nombres = grupo.map(n => n.actor?.username ?? n.actor?.fullName ?? 'Alguien')
    if (nombres.length === 1) return nombres[0]
    if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`
    return `${nombres[0]} y ${nombres.length - 1} más`
  }

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="COMUNIDAD"
        title="Avisos"
        subtitle={items.length ? 'Mantén pulsado uno para descartarlo' : undefined}
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
        data={filas}
        keyExtractor={(f, i) => ('sep' in f ? `sep-${f.sep}-${i}` : f.avisos[0].id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: TabBar.scrollInset }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={T.accent} />
        }
        onEndReached={cargarMas}
        onEndReachedThreshold={0.6}
        renderItem={({ item: fila }) => {
          if ('sep' in fila) {
            return <Text style={[s.tramo, { color: T.ink3 }]}>{fila.sep}</Text>
          }
          const grupo = fila.avisos
          const item = grupo[0]
          const d = TEXTO[item.type] ?? TEXTO.follow
          const sinLeer = grupo.some(n => !n.isRead)

          return (
            <TouchableOpacity
              style={s.fila}
              onPress={() => abrir(item)}
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
                descartar(item)
              }}
              delayLongPress={320}
              activeOpacity={0.75}
            >
              <View>
                <Avatar profile={item.actor} size={38} />
                <View style={[s.tipo, { backgroundColor: d.color, borderColor: T.bg }]}>
                  <Ionicons name={d.icon} size={9} color="#fff" />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[s.texto, { color: T.ink }]} numberOfLines={2}>
                  <Text style={{ fontWeight: '800' }}>{quienes(grupo)}</Text>
                  {' '}{grupo.length > 1 ? 'le dieron me gusta' : d.verbo}
                  {grupo.length === 1 && item.comment?.content ? `: «${item.comment.content}»` : ''}
                </Text>
                <Text style={[s.hora, { color: T.ink3 }]}>{timeAgo(item.createdAt)}</Text>
              </View>

              {item.post?.preview?.url && (
                <Image source={{ uri: item.post.preview.url }} style={s.portada} contentFit="cover" />
              )}
              {sinLeer && <View style={[s.punto, { backgroundColor: T.accent }]} />}
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
  tramo: {
    fontSize: 10, fontWeight: '900', letterSpacing: 2,
    marginTop: 18, marginBottom: 10,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  tipo: {
    position: 'absolute', bottom: -2, right: -3,
    width: 17, height: 17, borderRadius: 9, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  texto: { fontSize: 13.5, lineHeight: 19 },
  hora: { fontSize: 11, marginTop: 3 },
  // Más grande que antes: es lo que dice de QUÉ publicación te hablan.
  portada: { width: 46, height: 46, borderRadius: 8 },
  punto: { width: 7, height: 7, borderRadius: 4 },
})
