/**
 * COMUNIDAD · VISTA DE PERFIL
 * ───────────────────────────
 * La cabecera y la rejilla que comparten el perfil propio y el ajeno. Están
 * juntos porque son la MISMA pantalla con distinto botón: separarlos llevaría a
 * que uno se rediseñe y el otro se quede atrás.
 *
 * ── La portada sale de lo que esa persona publica ───────────────────────────
 * La cabecera arranca con la foto de su última publicación, difuminada bajo un
 * degradado, y el avatar montado sobre el borde inferior. No es adorno: una
 * ficha con avatar, tres números y una biografía se parece a la de cualquier
 * otra cuenta, y aquí lo que distingue a una persona es lo que sube.
 *
 * Cuando no hay nada que publicar —cuenta nueva, o cerrada y sin acceso— la
 * portada se cae y queda la ficha sola. No se inventa una imagen de relleno.
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
import { Image } from '@/components/ui/Imagen'
import { Ionicons } from '@expo/vector-icons'

import { useAppTheme } from '@/context/ThemeContext'
import { LinearGradient } from 'expo-linear-gradient'
import { Avatar, LockedWall } from './Bits'
import type { OtherProfile, MyProfile, Post, Profile, Relation } from '@/services/socialService'

// ── Números ──────────────────────────────────────────────────────────────────

// ── Cabecera ─────────────────────────────────────────────────────────────────

export function ProfileHeader({
  profile, stats, canViewContent, relation, action, portada,
  onFollowersPress, onFollowingPress,
}: {
  profile: Profile
  stats: { followers: number; following: number; posts: number } | null
  canViewContent: boolean
  relation?: Relation
  /** El botón que cambia según de quién sea el perfil. */
  action: React.ReactNode
  /** Foto de su última publicación. Sin ella, la cabecera va sin portada. */
  portada?: string | null
  onFollowersPress?: () => void
  onFollowingPress?: () => void
}) {
  const T = useAppTheme()

  return (
    <View>
      {!!portada && (
        <View style={s.portadaWrap}>
          <Image source={{ uri: portada }} style={s.portada} contentFit="cover" transition={220} />
          {/* Hasta abajo del todo y opaco al final: el avatar y el nombre se
              apoyan justo ahí y tienen que leerse sobre cualquier foto. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'rgba(8,8,8,0.75)', T.bg]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>
      )}

      <View style={[s.wrap, !!portada && s.wrapConPortada]}>
        <View style={s.fila}>
          <Avatar profile={profile} size={72} />
          <View style={{ flex: 1 }}>
            <View style={s.nombreFila}>
              <Text style={[s.nombre, { color: T.ink }]} numberOfLines={1}>
                {profile.fullName ?? profile.username ?? 'Cuenta ZENCRUS'}
              </Text>
              {profile.isPrivate && <Ionicons name="lock-closed" size={13} color={T.ink3} />}
            </View>
            {profile.username && (
              <Text style={[s.usuario, { color: T.ink3 }]}>@{profile.username}</Text>
            )}
          </View>
        </View>

        {!!profile.bio && <Text style={[s.bio, { color: T.ink2 }]}>{profile.bio}</Text>}

        {/*
          Los números en texto corrido, no en tres columnas.

          Tres cifras grandes centradas hacen que un perfil se lea como un
          marcador y empujan a compararse. Escritos como una frase siguen ahí
          para quien los busca y dejan de ser lo primero que ve todo el mundo.
        */}
        <View style={s.cifras}>
          <Cifra n={stats?.posts ?? null} palabra="publicaciones" />
          <Cifra n={stats?.followers ?? null} palabra="seguidores"
            onPress={canViewContent ? onFollowersPress : undefined} />
          <Cifra n={stats?.following ?? null} palabra="siguiendo"
            onPress={canViewContent ? onFollowingPress : undefined} />
        </View>

        <View style={s.acciones}>{action}</View>
      </View>
    </View>
  )
}

/** Un número y su palabra, en la misma línea. */
function Cifra({ n, palabra, onPress }: { n: number | null; palabra: string; onPress?: () => void }) {
  const T = useAppTheme()
  return (
    <TouchableOpacity
      style={s.cifra}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress || n === null}
      hitSlop={6}
    >
      <Text style={[s.cifraN, { color: T.ink }]}>{n === null ? '—' : n}</Text>
      <Text style={[s.cifraP, { color: T.ink3 }]}>{palabra}</Text>
    </TouchableOpacity>
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
  portadaWrap: { height: 150, width: '100%' },
  portada: { width: '100%', height: '100%' },
  wrap: { paddingHorizontal: 16, paddingBottom: 18 },
  // Con portada, la ficha sube para que el avatar la pise.
  wrapConPortada: { marginTop: -40 },
  fila: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nombre: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  usuario: { fontSize: 13, marginTop: 2 },
  bio: { fontSize: 13.5, lineHeight: 20, marginTop: 12 },
  cifras: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' },
  cifra: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  cifraN: { fontSize: 14, fontWeight: '800' },
  cifraP: { fontSize: 12.5 },
  acciones: { flexDirection: 'row', gap: 10, marginTop: 16 },
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
