/**
 * COMUNIDAD · MI PERFIL
 * ─────────────────────
 * Mi ficha y mi rejilla. Nada más.
 *
 * ── El menú se fue a ajustes ────────────────────────────────────────────────
 * Solicitudes, guardados, privacidad y bloqueados vivían aquí, en cuatro cajas
 * entre la ficha y la rejilla. Separaban tu cara de lo único que se viene a
 * ver, y hacían que el perfil pareciera una pantalla de ajustes. Ahora cuelgan
 * de la rueda de la cabecera (`/social/settings`).
 *
 * La rueda se enciende cuando hay solicitudes esperando: enterrarlas sin más
 * señal habría sido esconderlas, porque nadie entra en ajustes a comprobarlo.
 *
 * Aquí no hay candado aunque la cuenta sea privada: uno siempre se ve entero a
 * sí mismo. Lo que sí se enseña es el aviso de que está cerrada, para que nadie
 * se sorprenda de que su muro no aparezca en «Para ti».
 */

import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Btn, Empty, Skeleton } from '@/components/social/Bits'
import { ProfileHeader, PostGrid } from '@/components/social/ProfileView'
import * as S from '@/services/socialService'
import { TabBar } from '@/constants/layout'

export default function MyProfileScreen() {
  const T = useAppTheme()
  const me = useSocialStore(s => s.me)
  const badges = useSocialStore(s => s.badges)
  const loadMe = useSocialStore(s => s.loadMe)
  const loadBadges = useSocialStore(s => s.loadBadges)

  const [posts, setPosts] = useState<S.Post[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async (refrescar = false) => {
    refrescar ? setRefrescando(true) : setCargando(true)
    try {
      await loadMe()
      await loadBadges()
      const yo = useSocialStore.getState().me
      if (yo) setPosts(await S.getUserPosts(yo.id))
    } catch {
      // El perfil ya avisa por su cuenta si falla; aquí no hace falta insistir.
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { cargar(true) }, []))

  if (!me && cargando) {
    return (
      <Screen>
        <ScreenHeader back eyebrow="COMUNIDAD" title="Mi perfil" />
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
            <Skeleton h={82} w={82} r={41} />
            <View style={{ flex: 1, gap: 10 }}>
              <Skeleton h={14} w={'70%'} /><Skeleton h={11} w={'45%'} />
            </View>
          </View>
        </View>
      </Screen>
    )
  }

  if (!me) {
    return (
      <Screen>
        <ScreenHeader back eyebrow="COMUNIDAD" title="Mi perfil" />
        <Empty icon="person-circle-outline" title="No pudimos cargar tu perfil"
          action="Reintentar" onAction={() => cargar()} />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="COMUNIDAD"
        title={me.username ? `@${me.username}` : 'Mi perfil'}
        right={
          <TouchableOpacity
            style={[s.rueda, { backgroundColor: T.glass, borderColor: T.glassBorder }]}
            onPress={() => router.push('/social/settings')}
            hitSlop={8}
            activeOpacity={0.75}
          >
            <Ionicons name="settings-outline" size={19} color={T.ink2} />
            {/* Un punto, no el número: el recuento exacto está dentro, y aquí
                lo único que hace falta saber es que hay algo. */}
            {!!badges.followRequests && (
              <View style={[s.punto, { backgroundColor: T.accent, borderColor: T.bg }]} />
            )}
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
          portada={me.coverImage ?? posts.find(p => p.media[0]?.url)?.media[0]?.url ?? null}
          profile={me}
          stats={me.stats}
          canViewContent
          onFollowersPress={() => router.push(`/social/followers/${me.id}?tab=followers&nombre=${me.username ?? ''}`)}
          onFollowingPress={() => router.push(`/social/followers/${me.id}?tab=following&nombre=${me.username ?? ''}`)}
          action={
            <>
              <Btn label="Editar perfil" onPress={() => router.push('/social/edit-profile')}
                tone="soft" icon="create-outline" full />
              <Btn label="Publicar" onPress={() => router.push('/social/compose')}
                tone="solid" icon="add" full />
            </>
          }
        />

        {me.isPrivate && (
          <View style={[s.aviso, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
            <Ionicons name="lock-closed" size={15} color={T.ink3} />
            <Text style={[s.avisoTxt, { color: T.ink2 }]}>
              Tu cuenta es privada: solo quien aceptes ve lo que publicas.
            </Text>
          </View>
        )}

        <Text style={[s.etiqueta, { color: T.ink3 }]}>MIS PUBLICACIONES</Text>
        {posts.length
          ? <PostGrid posts={posts} onPress={p => router.push(`/social/post/${p.id}`)} />
          : (
            <Empty
              icon="camera-outline"
              title="Aún no has publicado nada"
              text="Comparte una foto de tu progreso, una comida o un entrenamiento."
              action="Publicar algo"
              onAction={() => router.push('/social/compose')}
              tight
            />
          )}
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, padding: 13, borderRadius: 15, borderWidth: 1,
  },
  avisoTxt: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  rueda: {
    width: 38, height: 38, borderRadius: 13, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  punto: {
    position: 'absolute', top: 7, right: 7,
    width: 9, height: 9, borderRadius: 5, borderWidth: 2,
  },
  etiqueta: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 26, marginBottom: 12, paddingHorizontal: 20 },
})
