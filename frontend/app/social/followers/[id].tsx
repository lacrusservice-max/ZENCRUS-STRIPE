/**
 * COMUNIDAD · SEGUIDORES Y SEGUIDOS
 * ─────────────────────────────────
 * Las dos listas en una pantalla, con la pestaña que llega por parámetro para
 * que tocar «Seguidores» abra directamente esa y no la otra.
 *
 * Si la cuenta es privada y no se sigue, el servidor responde 403 y aquí se
 * enseña el candado: saber a quién sigue alguien también es información sobre
 * esa persona.
 */

import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { Avatar, NameBlock, Empty, LockedWall, Skeleton } from '@/components/social/Bits'
import * as S from '@/services/socialService'

type Pestana = 'followers' | 'following'

export default function FollowersScreen() {
  const T = useAppTheme()
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>()
  const [pestana, setPestana] = useState<Pestana>(tab === 'following' ? 'following' : 'followers')
  const [lista, setLista] = useState<S.Profile[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [cerrada, setCerrada] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async (refrescar = false) => {
    if (!id) return
    refrescar ? setRefrescando(true) : setCargando(true)
    setCerrada(false)
    try {
      const r = pestana === 'followers' ? await S.getFollowers(id) : await S.getFollowing(id)
      setLista(r)
      setError(null)
    } catch (e: any) {
      if (e?.response?.status === 403) setCerrada(true)
      else setError(S.errorText(e, 'No pudimos cargar la lista'))
      setLista([])
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [id, pestana])

  useEffect(() => { cargar() }, [cargar])

  return (
    <Screen>
      <ScreenHeader back eyebrow="COMUNIDAD" title="Conexiones" icon="people" />

      <View style={[t.wrap, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
        {([
          { k: 'followers' as const, label: 'Seguidores' },
          { k: 'following' as const, label: 'Siguiendo' },
        ]).map(o => {
          const activa = pestana === o.k
          return (
            <TouchableOpacity
              key={o.k}
              style={[t.opt, activa && { backgroundColor: `${T.accent}1E`, borderColor: `${T.accent}38` }]}
              onPress={() => setPestana(o.k)}
              activeOpacity={0.8}
            >
              <Text style={[t.txt, { color: activa ? T.accent : T.ink3 }]}>{o.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {cerrada ? (
        <LockedWall requested={false} />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={u => u.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={T.accent} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.fila}
              onPress={() => router.push(`/social/profile/${item.id}`)}
              activeOpacity={0.75}
            >
              <Avatar profile={item} size={44} />
              <NameBlock profile={item} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            cargando ? (
              <View style={{ gap: 18, paddingTop: 8 }}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <Skeleton h={44} w={44} r={22} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <Skeleton h={12} w={'50%'} /><Skeleton h={10} w={'30%'} />
                    </View>
                  </View>
                ))}
              </View>
            ) : error ? (
              <Empty icon="cloud-offline-outline" title="No pudimos cargarla" text={error}
                action="Reintentar" onAction={() => cargar()} />
            ) : (
              <Empty
                icon="people-outline"
                title={pestana === 'followers' ? 'Sin seguidores todavía' : 'No sigue a nadie todavía'}
                tight
              />
            )
          }
        />
      )}
    </Screen>
  )
}

const t = StyleSheet.create({
  wrap: {
    flexDirection: 'row', gap: 4, marginHorizontal: 20, marginBottom: 12,
    padding: 4, borderRadius: 15, borderWidth: 1,
  },
  opt: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
  },
  txt: { fontSize: 13, fontWeight: '700' },
})

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
})
