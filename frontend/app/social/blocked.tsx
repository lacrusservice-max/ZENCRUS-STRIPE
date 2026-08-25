/**
 * COMUNIDAD · CUENTAS BLOQUEADAS
 * ──────────────────────────────
 * A quién he bloqueado, y el único sitio desde donde se puede deshacer.
 *
 * ── Por qué el único ────────────────────────────────────────────────────────
 * Para la app, una cuenta bloqueada NO EXISTE: no sale en el buscador, no se
 * abre su perfil y sus publicaciones no llegan. Eso es lo que hace que el
 * bloqueo funcione, y también lo que deja sin sitio al botón de desbloquear.
 * Así que tiene que haber esta lista, o bloquear sería irreversible.
 *
 * ── Aquí solo salen los que bloqueé YO ──────────────────────────────────────
 * Quien me haya bloqueado a mí no aparece. Enseñarlo sería contarle a la gente
 * quién la ha bloqueado, que es exactamente lo que el bloqueo no hace.
 */

import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { Avatar, NameBlock, Btn, Empty, Skeleton } from '@/components/social/Bits'
import * as S from '@/services/socialService'
import { TabBar } from '@/constants/layout'

export default function BlockedScreen() {
  const T = useAppTheme()
  const [lista, setLista] = useState<S.Profile[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const cargar = useCallback(async (refrescar = false) => {
    refrescar ? setRefrescando(true) : setCargando(true)
    try {
      setLista(await S.getBlocked())
      setError(null)
    } catch (e) {
      setError(S.errorText(e, 'No pudimos cargar tu lista'))
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { cargar(true) }, []))

  const desbloquear = (p: S.Profile) => {
    Alert.alert(
      p.username ? `¿Desbloquear a @${p.username}?` : '¿Desbloquear a esta persona?',
      'Volveréis a veros en la app. No recupera el seguimiento: si quieres '
        + 'seguirla otra vez, tendrás que pedirlo — y ella a ti.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          onPress: async () => {
            setOcupado(p.id)
            // La fila desaparece al momento: quedarse mirando a alguien ya
            // desbloqueado hace que se pulse dos veces.
            const copia = lista
            setLista(l => l.filter(x => x.id !== p.id))
            try {
              await S.unblockUser(p.id)
            } catch (e) {
              setLista(copia)
              Alert.alert('No pudimos desbloquear', S.errorText(e))
            } finally {
              setOcupado(null)
            }
          },
        },
      ],
    )
  }

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="COMUNIDAD"
        title="Cuentas bloqueadas"
        subtitle="Nadie sabe que está en esta lista"
        icon="ban"
      />

      <FlatList
        data={lista}
        keyExtractor={p => p.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TabBar.scrollInset }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={T.accent} />
        }
        renderItem={({ item }) => (
          <View style={s.fila}>
            {/* Sin `onPress` en el avatar: su perfil no se puede abrir, que es
                justo lo que significa tenerla bloqueada. */}
            <Avatar profile={item} size={46} />
            <NameBlock profile={item} />
            <Btn
              label="Desbloquear"
              onPress={() => desbloquear(item)}
              tone="soft"
              small
              loading={ocupado === item.id}
            />
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
            <Empty icon="cloud-offline-outline" title="No pudimos cargarla" text={error}
              action="Reintentar" onAction={() => cargar()} />
          ) : (
            <Empty
              icon="ban-outline"
              title="No has bloqueado a nadie"
              text="Si alguna vez lo haces, aparecerá aquí para poder deshacerlo."
              tight
            />
          )
        }
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
})
