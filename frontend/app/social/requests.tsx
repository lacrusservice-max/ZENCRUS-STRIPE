/**
 * COMUNIDAD · SOLICITUDES DE SEGUIMIENTO
 * ──────────────────────────────────────
 * Quién ha pedido seguir mi cuenta privada.
 *
 * La fila desaparece en cuanto se responde, sin esperar al servidor: quedarse
 * mirando una solicitud ya aceptada durante medio segundo hace que la gente
 * pulse dos veces.
 */

import { useCallback, useState } from 'react'
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Avatar, NameBlock, Btn, Empty, Skeleton, timeAgo } from '@/components/social/Bits'
import * as S from '@/services/socialService'
import { TabBar } from '@/constants/layout'

export default function RequestsScreen() {
  const T = useAppTheme()
  const [lista, setLista] = useState<S.FollowRequest[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadBadges = useSocialStore(s => s.loadBadges)
  const loadMe = useSocialStore(s => s.loadMe)

  const cargar = useCallback(async (refrescar = false) => {
    refrescar ? setRefrescando(true) : setCargando(true)
    try {
      setLista(await S.getFollowRequests())
      setError(null)
      loadBadges()
    } catch (e) {
      setError(S.errorText(e, 'No pudimos cargar las solicitudes'))
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { cargar(true) }, []))

  const responder = async (u: S.FollowRequest, aceptar: boolean) => {
    const copia = lista
    setLista(l => l.filter(x => x.id !== u.id))
    try {
      aceptar ? await S.acceptFollowRequest(u.id) : await S.rejectFollowRequest(u.id)
      loadBadges()
      if (aceptar) loadMe()   // el número de seguidores acaba de subir
    } catch (e) {
      setLista(copia)
      Alert.alert('No pudimos completar la acción', S.errorText(e))
    }
  }

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="COMUNIDAD"
        title="Solicitudes"
        subtitle="Personas que quieren seguir tu cuenta"
        icon="person-add"
      />

      <FlatList
        data={lista}
        keyExtractor={u => u.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TabBar.scrollInset }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={T.accent} />
        }
        renderItem={({ item }) => (
          <View style={s.fila}>
            <Avatar profile={item} size={46} onPress={() => router.push(`/social/profile/${item.id}`)} />
            <NameBlock profile={item} subtitle={`Pidió ${timeAgo(item.requestedAt)}`} />
            <View style={s.botones}>
              <Btn label="Aceptar" onPress={() => responder(item, true)} tone="solid" small />
              <Btn label="No" onPress={() => responder(item, false)} tone="soft" small />
            </View>
          </View>
        )}
        ListEmptyComponent={
          cargando ? (
            <View style={{ gap: 18, paddingTop: 8 }}>
              {[0, 1].map(i => (
                <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Skeleton h={46} w={46} r={23} />
                  <View style={{ flex: 1, gap: 7 }}>
                    <Skeleton h={12} w={'55%'} /><Skeleton h={10} w={'35%'} />
                  </View>
                </View>
              ))}
            </View>
          ) : error ? (
            <Empty icon="cloud-offline-outline" title="No pudimos cargarlas" text={error}
              action="Reintentar" onAction={() => cargar()} />
          ) : (
            <Empty icon="checkmark-done-outline" title="Nadie esperando"
              text="Cuando alguien pida seguirte, aparecerá aquí para que decidas." tight />
          )
        }
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  botones: { flexDirection: 'row', gap: 7 },
})
