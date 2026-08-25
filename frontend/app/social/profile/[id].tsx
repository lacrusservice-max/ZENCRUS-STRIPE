/**
 * COMUNIDAD · PERFIL DE OTRA PERSONA
 * ──────────────────────────────────
 * Ficha, números y rejilla — o candado si la cuenta está cerrada.
 *
 * El botón de seguir cambia de forma según la relación, y se pinta el nuevo
 * estado antes de que el servidor conteste. Si falla, vuelve atrás: pulsar
 * «Seguir» y no ver nada durante un segundo hace que la gente lo pulse otra vez
 * y acabe dejando de seguir sin querer.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  View, ScrollView, RefreshControl, Alert, TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { Btn, Empty, Skeleton, confirmarBloqueo } from '@/components/social/Bits'
import { ProfileHeader, ProfileBody } from '@/components/social/ProfileView'
import * as S from '@/services/socialService'
import { TabBar } from '@/constants/layout'

export default function ProfileScreen() {
  const T = useAppTheme()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [perfil, setPerfil] = useState<S.OtherProfile | null>(null)
  const [posts, setPosts] = useState<S.Post[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async (refrescar = false) => {
    if (!id) return
    refrescar ? setRefrescando(true) : setCargando(true)
    try {
      const p = await S.getProfile(id)
      setPerfil(p)
      setError(null)
      // La rejilla solo se pide si el servidor dice que se puede ver. Pedirla
      // igualmente daría un 403 y un aviso de error donde lo correcto es un
      // candado.
      setPosts(p.canViewContent ? await S.getUserPosts(id) : [])
    } catch (e) {
      setError(S.errorText(e, 'No pudimos cargar este perfil'))
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  // ── Seguir ─────────────────────────────────────────────────────────────────

  const cambiarSeguimiento = async () => {
    if (!perfil || ocupado) return
    const antes = perfil
    setOcupado(true)

    const siguiendo = perfil.relation === 'following' || perfil.relation === 'requested'
    // Optimista: la relación que va a quedar.
    const provisional: S.Relation = siguiendo ? 'none' : (perfil.isPrivate ? 'requested' : 'following')
    setPerfil({
      ...perfil,
      relation: provisional,
      canViewContent: provisional === 'following' || !perfil.isPrivate,
    })

    try {
      if (siguiendo) {
        await S.unfollow(perfil.id)
      } else {
        await S.follow(perfil.id)
      }
      // Se recarga para traer los números y la rejilla que ahora corresponden.
      await cargar(true)
    } catch (e) {
      setPerfil(antes)
      Alert.alert('No pudimos completar la acción', S.errorText(e))
    } finally {
      setOcupado(false)
    }
  }

  const escribir = async () => {
    if (!perfil) return
    try {
      const conv = await S.openConversation(perfil.id)
      router.push(`/social/chat/${conv.id}`)
    } catch (e) {
      Alert.alert('No puedes escribirle', S.errorText(e))
    }
  }

  /**
   * El menú de los tres puntos del perfil ajeno.
   *
   * Al bloquear se vuelve atrás en vez de recargar: esta pantalla dejaría de
   * poder existir —el servidor responde como si la cuenta no estuviera— y
   * quedarse en ella solo enseñaría un «no encontramos esta cuenta» que parece
   * un error y no el resultado de lo que se acaba de pedir.
   */
  const opciones = () => {
    if (!perfil) return
    Alert.alert(
      perfil.username ? `@${perfil.username}` : 'Esta cuenta',
      undefined,
      [
        {
          text: 'Denunciar cuenta',
          onPress: () => router.push({
            pathname: '/social/report',
            params: {
              tipo: 'user', id: perfil.id, nombre: perfil.username ?? '',
              foto: perfil.avatar ?? '', resumen: perfil.bio ?? '',
            },
          }),
        },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: () => confirmarBloqueo(
            perfil.id,
            perfil.username ?? undefined,
            () => router.back(),
          ),
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
    )
  }

  const confirmarDejarDeSeguir = () => {
    if (!perfil) return
    if (perfil.relation === 'following') {
      Alert.alert(
        `¿Dejar de seguir a ${perfil.username ?? 'esta cuenta'}?`,
        perfil.isPrivate ? 'Para volver a ver su contenido tendrás que pedirlo otra vez.' : undefined,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Dejar de seguir', style: 'destructive', onPress: cambiarSeguimiento },
        ],
      )
    } else {
      cambiarSeguimiento()
    }
  }

  // ── Interfaz ───────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <Screen>
        <ScreenHeader back eyebrow="COMUNIDAD" title="Perfil" />
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
            <Skeleton h={82} w={82} r={41} />
            <View style={{ flex: 1, gap: 10 }}>
              <Skeleton h={14} w={'70%'} />
              <Skeleton h={11} w={'45%'} />
            </View>
          </View>
          <Skeleton h={40} r={14} />
        </View>
      </Screen>
    )
  }

  if (error || !perfil) {
    return (
      <Screen>
        <ScreenHeader back eyebrow="COMUNIDAD" title="Perfil" />
        <Empty
          icon="person-circle-outline"
          title="No encontramos esta cuenta"
          text={error ?? undefined}
          action="Reintentar"
          onAction={() => cargar()}
        />
      </Screen>
    )
  }

  const etiqueta =
    perfil.relation === 'following' ? 'Siguiendo'
    : perfil.relation === 'requested' ? 'Solicitado'
    : 'Seguir'

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="COMUNIDAD"
        title={perfil.username ? `@${perfil.username}` : 'Perfil'}
        right={
          <TouchableOpacity onPress={opciones} hitSlop={10} activeOpacity={0.7}>
            <Ionicons name="ellipsis-horizontal" size={20} color={T.ink3} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: TabBar.scrollInset }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={T.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          // La elegida manda; si no hay, se cae a la última publicación,
          // que es como funcionaba antes de que se pudiera elegir.
          portada={perfil.coverImage ?? posts.find(p => p.media[0]?.url)?.media[0]?.url ?? null}
          profile={perfil}
          stats={perfil.stats}
          canViewContent={perfil.canViewContent}
          relation={perfil.relation}
          onFollowersPress={() => router.push(`/social/followers/${perfil.id}?tab=followers&nombre=${perfil.username ?? ''}`)}
          onFollowingPress={() => router.push(`/social/followers/${perfil.id}?tab=following&nombre=${perfil.username ?? ''}`)}
          action={
            <>
              <Btn
                label={etiqueta}
                onPress={confirmarDejarDeSeguir}
                tone={perfil.relation === 'none' ? 'solid' : 'soft'}
                icon={perfil.relation === 'following' ? 'checkmark'
                  : perfil.relation === 'requested' ? 'time-outline' : 'person-add'}
                loading={ocupado}
                full
              />
              <Btn label="Mensaje" onPress={escribir} tone="soft" icon="chatbubble-outline" full />
            </>
          }
        />

        <ProfileBody profile={perfil} posts={posts} onPost={p => router.push(`/social/post/${p.id}`)} />
      </ScrollView>
    </Screen>
  )
}
