/**
 * COMUNIDAD · VISTA DE PERFIL
 * ───────────────────────────
 * La cabecera y la rejilla que comparten el perfil propio y el ajeno. Están
 * juntos porque son la MISMA pantalla con distinto botón: separarlos llevaría a
 * que uno se rediseñe y el otro se quede atrás.
 *
 * ── El candado ──────────────────────────────────────────────────────────────
 * De una cuenta privada siempre se ve la ficha —foto, nombre, biografía— para
 * poder encontrarla y pedirle seguirla. Lo que se cierra es el contenido y los
 * números. Quien decide es el servidor: aquí solo se mira `canViewContent`, sin
 * volver a razonar la regla.
 */

import React from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, useWindowDimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'

import { useAppTheme } from '@/context/ThemeContext'
import { Avatar, LockedWall } from './Bits'
import type { OtherProfile, MyProfile, Post, Profile, Relation } from '@/services/socialService'

// ── Números ──────────────────────────────────────────────────────────────────

function Stat({ n, label, onPress }: { n: number | null; label: string; onPress?: () => void }) {
  const T = useAppTheme()
  return (
    <TouchableOpacity
      style={s.stat}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress || n === null}
    >
      <Text style={[s.statN, { color: T.ink }]}>{n === null ? '—' : n}</Text>
      <Text style={[s.statL, { color: T.ink3 }]}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Cabecera ─────────────────────────────────────────────────────────────────

export function ProfileHeader({
  profile, stats, canViewContent, relation, action, onFollowersPress, onFollowingPress,
}: {
  profile: Profile
  stats: { followers: number; following: number; posts: number } | null
  canViewContent: boolean
  relation?: Relation
  /** El botón que cambia según de quién sea el perfil. */
  action: React.ReactNode
  onFollowersPress?: () => void
  onFollowingPress?: () => void
}) {
  const T = useAppTheme()

  return (
    <View style={s.wrap}>
      <View style={s.fila}>
        <Avatar profile={profile} size={82} />
        <View style={s.stats}>
          <Stat n={stats?.posts ?? null} label="Publicaciones" />
          <Stat n={stats?.followers ?? null} label="Seguidores" onPress={canViewContent ? onFollowersPress : undefined} />
          <Stat n={stats?.following ?? null} label="Siguiendo" onPress={canViewContent ? onFollowingPress : undefined} />
        </View>
      </View>

      <View style={s.datos}>
        <View style={s.nombreFila}>
          <Text style={[s.nombre, { color: T.ink }]} numberOfLines={1}>
            {profile.fullName ?? profile.username ?? 'Cuenta ZENCRUS'}
          </Text>
          {profile.isPrivate && <Ionicons name="lock-closed" size={13} color={T.ink3} />}
        </View>
        {profile.username && (
          <Text style={[s.usuario, { color: T.ink3 }]}>@{profile.username}</Text>
        )}
        {!!profile.bio && (
          <Text style={[s.bio, { color: T.ink2 }]}>{profile.bio}</Text>
        )}
      </View>

      <View style={s.acciones}>{action}</View>
    </View>
  )
}

// ── Rejilla ──────────────────────────────────────────────────────────────────

/**
 * Las publicaciones en cuadrícula de tres.
 *
 * Se enseña la primera pieza de cada una; las que solo llevan texto se pintan
 * con el propio texto sobre vidrio, porque una casilla vacía en la cuadrícula
 * parece un fallo de carga.
 */
export function PostGrid({ posts, onPress }: { posts: Post[]; onPress: (p: Post) => void }) {
  const T = useAppTheme()
  const { width } = useWindowDimensions()
  const lado = (width - 40 - 4) / 3

  return (
    <View style={s.rejilla}>
      {posts.map(p => {
        const portada = p.media[0]
        return (
          <TouchableOpacity
            key={p.id}
            style={[s.celda, { width: lado, height: lado, backgroundColor: T.glass, borderColor: T.glassBorder }]}
            onPress={() => onPress(p)}
            activeOpacity={0.82}
          >
            {portada?.url ? (
              <Image source={{ uri: portada.url }} style={s.celdaImg} contentFit="cover" transition={140} />
            ) : (
              <View style={s.celdaTexto}>
                <Text style={[s.celdaTxt, { color: T.ink2 }]} numberOfLines={5}>
                  {p.content ?? ''}
                </Text>
              </View>
            )}
            {p.media.length > 1 && (
              <View style={s.marca}><Ionicons name="copy" size={11} color="#fff" /></View>
            )}
            {portada?.type === 'video' && (
              <View style={s.marca}><Ionicons name="play" size={11} color="#fff" /></View>
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ── Cuerpo completo ──────────────────────────────────────────────────────────

/** Rejilla, candado o vacío, según lo que el servidor permita. */
export function ProfileBody({
  profile, posts, onPost,
}: {
  profile: OtherProfile | MyProfile
  posts: Post[]
  onPost: (p: Post) => void
}) {
  const esAjeno = 'canViewContent' in profile
  const puede = !esAjeno || (profile as OtherProfile).canViewContent

  if (!puede) {
    return <LockedWall requested={(profile as OtherProfile).relation === 'requested'} />
  }
  if (!posts.length) {
    return (
      <View style={s.vacio}>
        <Ionicons name="camera-outline" size={26} color="#7A7A85" />
        <Text style={s.vacioTxt}>Todavía no hay publicaciones</Text>
      </View>
    )
  }
  return <PostGrid posts={posts} onPress={onPost} />
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 18 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 3 },
  statN: { fontSize: 18, fontWeight: '800' },
  statL: { fontSize: 10.5, fontWeight: '600' },
  datos: { marginTop: 16 },
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nombre: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  usuario: { fontSize: 13, marginTop: 2 },
  bio: { fontSize: 13.5, lineHeight: 20, marginTop: 9 },
  acciones: { flexDirection: 'row', gap: 10, marginTop: 18 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 20 },
  celda: { borderRadius: 4, overflow: 'hidden', borderWidth: 1 },
  celdaImg: { width: '100%', height: '100%' },
  celdaTexto: { flex: 1, padding: 8, justifyContent: 'center' },
  celdaTxt: { fontSize: 10.5, lineHeight: 14 },
  marca: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: 3,
  },
  vacio: { alignItems: 'center', paddingVertical: 54, gap: 10 },
  vacioTxt: { fontSize: 13, color: '#7A7A85' },
})
