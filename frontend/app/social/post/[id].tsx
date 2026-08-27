/**
 * COMUNIDAD · UNA PUBLICACIÓN
 * ───────────────────────────
 * La foto a sangre, lo que se escribió debajo, y los comentarios en la misma
 * pantalla.
 *
 * ── Por qué los comentarios viven AQUÍ y no en su propia pantalla ───────────
 * Antes había una pantalla solo de comentarios, y era a donde iban a parar los
 * cuatro caminos que deberían llevar a la publicación: tocar una foto en la
 * rejilla de un perfil, y tocar un aviso de «le gustó tu publicación». O sea
 * que para ver la foto que alguien acababa de comentar había que salir y
 * buscarla. Juntarlas arregla eso y evita lo de siempre: dos pantallas que
 * hacen casi lo mismo y que a los dos meses ya no se parecen.
 *
 * ── La foto es la pantalla ──────────────────────────────────────────────────
 * Ocupa su alto natural desde arriba del todo, y el nombre y el texto viajan
 * ENCIMA sobre un degradado. Así los comentarios empiezan justo debajo del
 * pliegue: se ve que hay conversación sin desplazar, que es la razón de entrar
 * aquí desde un aviso.
 *
 * Volver y el menú también flotan sobre la foto. Cuando la publicación es solo
 * texto no hay nada sobre lo que flotar, así que reaparece la barra de siempre:
 * dos disposiciones para dos contenidos distintos, no una que sirva a medias
 * para los dos.
 *
 * ── El me gusta se anuncia al muro ──────────────────────────────────────────
 * Al dar al corazón se avisa al store (`patchPost`) además de al servidor: si
 * no, volver atrás enseñaría la misma publicación sin el corazón encendido y
 * parecería que no se guardó.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { Screen } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import {
  Avatar, NameBlock, Empty, Skeleton, timeAgo, compartirPost, confirmarBloqueo,
} from '@/components/social/Bits'
import { PostMedia } from '@/components/social/PostCard'
import * as S from '@/services/socialService'

export default function PostScreen() {
  const T = useAppTheme()
  const { width } = useWindowDimensions()
  const { id, comentar } = useLocalSearchParams<{ id: string; comentar?: string }>()

  const me = useSocialStore(s => s.me)
  const patchPost = useSocialStore(s => s.patchPost)
  const toggleSave = useSocialStore(s => s.toggleSave)
  const bumpComments = useSocialStore(s => s.bumpComments)
  const removePost = useSocialStore(s => s.removePost)

  const [post, setPost] = useState<S.Post | null>(null)
  const [comentarios, setComentarios] = useState<S.Comment[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  const campo = useRef<TextInput>(null)

  // ── Cargar ─────────────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    try {
      // Las dos a la vez: los comentarios no dependen de la publicación, y
      // encadenarlas dobla la espera de la pantalla sin ganar nada.
      const [p, c] = await Promise.all([S.getPost(id), S.getComments(id)])
      setPost(p)
      setComentarios(c)
      setError(null)
    } catch (e) {
      setError(S.errorText(e, 'No pudimos cargar esta publicación'))
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  // Llegar desde el icono de comentar abre el teclado. Se espera a que la
  // pantalla esté montada: pedir el foco durante la transición no hace nada.
  useEffect(() => {
    if (comentar !== '1' || cargando || !post) return
    const t = setTimeout(() => campo.current?.focus(), 350)
    return () => clearTimeout(t)
  }, [comentar, cargando, !!post])

  // ── Me gusta ───────────────────────────────────────────────────────────────

  const meGusta = async (forzarEncendido = false) => {
    if (!post) return
    const daba = post.likedByMe
    if (daba && forzarEncendido) return   // el doble toque enciende, nunca apaga

    const despues = { likedByMe: !daba, likes: Math.max(0, post.likes + (daba ? -1 : 1)) }
    setPost({ ...post, ...despues })
    patchPost(post.id, despues)

    try {
      daba ? await S.unlikePost(post.id) : await S.likePost(post.id)
    } catch {
      const antes = { likedByMe: daba, likes: post.likes }
      setPost(p => (p ? { ...p, ...antes } : p))
      patchPost(post.id, antes)
    }
  }

  // Compartir es el mismo gesto que en la tarjeta del muro, así que vive en un
  // solo sitio (`Bits`) y aquí solo se llama.
  const compartir = () => { if (post) compartirPost(post) }

  const guardar = async () => {
    if (!post) return
    const antes = post.savedByMe
    setPost({ ...post, savedByMe: !antes })
    try {
      await toggleSave(post)
    } catch (e) {
      setPost(p => (p ? { ...p, savedByMe: antes } : p))
      Alert.alert('Ups', S.errorText(e))
    }
  }

  // ── Comentar ───────────────────────────────────────────────────────────────

  const enviar = async () => {
    const contenido = texto.trim()
    if (!contenido || enviando || !id) return

    const provisional: S.Comment = {
      id: `pendiente-${Date.now()}`,
      content: contenido,
      createdAt: new Date().toISOString(),
      author: me ? { ...me } : null,
      isMine: true,
    }
    setComentarios(c => [...c, provisional])
    setTexto('')
    setEnviando(true)
    Haptics.selectionAsync().catch(() => {})

    try {
      const real = await S.addComment(id, contenido)
      setComentarios(c => c.map(x => x.id === provisional.id
        ? { ...real, author: provisional.author, isMine: true } : x))
      bumpComments(id, 1)
      setPost(p => (p ? { ...p, comments: p.comments + 1 } : p))
    } catch (e) {
      setComentarios(c => c.filter(x => x.id !== provisional.id))
      setTexto(contenido)   // no se pierde lo escrito
      Alert.alert('No pudimos publicar tu comentario', S.errorText(e))
    } finally {
      setEnviando(false)
    }
  }

  const borrarComentario = (c: S.Comment) => {
    Alert.alert('Eliminar comentario', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const copia = comentarios
          setComentarios(x => x.filter(y => y.id !== c.id))
          try {
            await S.deleteComment(c.id)
            if (id) bumpComments(id, -1)
            setPost(p => (p ? { ...p, comments: Math.max(0, p.comments - 1) } : p))
          } catch (e) {
            setComentarios(copia)
            Alert.alert('No pudimos eliminarlo', S.errorText(e))
          }
        },
      },
    ])
  }

  // ── Menú de la publicación ─────────────────────────────────────────────────

  const opciones = () => {
    if (!post) return
    const acciones: any[] = [
      { text: 'Compartir', onPress: compartir },
      { text: post.savedByMe ? 'Quitar de guardados' : 'Guardar', onPress: guardar },
    ]

    if (post.isMine) {
      acciones.push({
        text: 'Eliminar publicación',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Eliminar',
          '¿Seguro que quieres eliminarla? No se puede deshacer.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Eliminar',
              style: 'destructive',
              onPress: () => removePost(post.id)
                .then(() => router.back())
                .catch(e => Alert.alert('Ups', S.errorText(e))),
            },
          ],
        ),
      })
    } else if (post.author) {
      const autor = post.author
      acciones.push(
        { text: 'Ver perfil', onPress: () => router.push(`/social/profile/${autor.id}`) },
        {
          text: 'Denunciar publicación',
          onPress: () => router.push({
            pathname: '/social/report',
            params: {
              tipo: 'post', id: post.id,
              nombre: autor.username ?? '', autorId: autor.id,
              // Para que se vea QUÉ se está denunciando antes de acusar.
              foto: post.media[0]?.url ?? '',
              resumen: post.content ?? '',
            },
          }),
        },
        {
          text: `Bloquear a ${autor.username ?? 'esta persona'}`,
          style: 'destructive',
          // Al bloquear, esta publicación deja de existir para mí: quedarse
          // mirándola sería enseñar justo lo que se acaba de cerrar.
          onPress: () => confirmarBloqueo(autor.id, autor.username ?? undefined, () => router.back()),
        },
      )
    }
    acciones.push({ text: 'Cancelar', style: 'cancel' })
    Alert.alert('Publicación', undefined, acciones)
  }

  // ── Interfaz ───────────────────────────────────────────────────────────────

  const conFoto = !!post?.media.length

  const cabecera = post && (
    <View>
      {conFoto ? (
        <View>
          <PostMedia post={post} ancho={width} onDoubleTap={() => meGusta(true)} />

          {/* Arriba, para que se lean volver y el menú. Abajo, para el nombre y
              el texto. Sin los dos, sobre una foto clara desaparece todo. */}
          <LinearGradient
            colors={['rgba(5,5,5,0.55)', 'transparent']}
            style={[s.velo, { top: 0, height: 92 }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(5,5,5,0.82)']}
            style={[s.velo, { bottom: 0, height: 168 }]}
            pointerEvents="none"
          />

          <View style={s.mandoSobre}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={opciones} hitSlop={12}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={s.pieSobre}>
            <TouchableOpacity
              style={s.autorSobre}
              activeOpacity={0.75}
              onPress={() => post.author && router.push(`/social/profile/${post.author.id}`)}
            >
              <Avatar profile={post.author} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={s.nombreSobre} numberOfLines={1}>
                  {post.author?.username ?? post.author?.fullName ?? 'Cuenta ZENCRUS'}
                </Text>
                <Text style={s.cuandoSobre}>
                  {timeAgo(post.createdAt)}
                  {post.visibility === 'followers' ? ' · solo seguidores' : ''}
                </Text>
              </View>
            </TouchableOpacity>
            {!!post.content && (
              <Text style={s.textoSobre} numberOfLines={4}>{post.content}</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={{ paddingTop: 4 }}>
          <View style={s.autor}>
            <Avatar
              profile={post.author}
              size={38}
              onPress={() => post.author && router.push(`/social/profile/${post.author.id}`)}
            />
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={0.7}
              onPress={() => post.author && router.push(`/social/profile/${post.author.id}`)}
            >
              <NameBlock profile={post.author} subtitle={timeAgo(post.createdAt)} />
            </TouchableOpacity>
          </View>
          {!!post.content && (
            <Text style={[s.texto, { color: T.ink }]}>{post.content}</Text>
          )}
        </View>
      )}

      <View style={s.acciones}>
        <Accion
          icon={post.likedByMe ? 'heart' : 'heart-outline'}
          label={post.likes}
          active={post.likedByMe}
          onPress={() => meGusta()}
        />
        <Accion icon="chatbubble-outline" label={post.comments} onPress={() => campo.current?.focus()} />
        <Accion icon="paper-plane-outline" onPress={compartir} />
        <Accion
          icon={post.savedByMe ? 'bookmark' : 'bookmark-outline'}
          active={post.savedByMe}
          onPress={guardar}
        />
        <View style={{ flex: 1 }} />
      </View>

      <View style={[s.raya, { backgroundColor: T.glassBorder }]} />
    </View>
  )

  return (
    <Screen>
      {/* Sin foto no hay nada sobre lo que flotar, así que vuelve la barra. */}
      {!conFoto && (
        <View style={[cb.wrap, { borderColor: T.glassBorder }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 2 }}>
            <Ionicons name="chevron-back" size={22} color={T.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[cb.eyebrow, { color: T.accent }]}>COMUNIDAD</Text>
            <Text style={[cb.titulo, { color: T.ink }]}>Publicación</Text>
          </View>
          {!!post && (
            <TouchableOpacity onPress={opciones} hitSlop={10}>
              <Ionicons name="ellipsis-horizontal" size={19} color={T.ink3} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <FlatList
          data={post ? comentarios : []}
          keyExtractor={c => c.id}
          ListHeaderComponent={cabecera ?? null}
          contentContainerStyle={{ paddingBottom: 16 }}
          style={{ marginTop: 0 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={s.comentario}>
              <Avatar
                profile={item.author}
                size={34}
                onPress={() => item.author && router.push(`/social/profile/${item.author.id}`)}
              />
              <View style={{ flex: 1 }}>
                <View style={s.comentarioCabeza}>
                  <Text style={[s.comentarioNombre, { color: T.ink }]} numberOfLines={1}>
                    {item.author?.fullName ?? item.author?.username ?? 'Cuenta ZENCRUS'}
                  </Text>
                  <Text style={[s.comentarioHora, { color: T.ink3 }]}>{timeAgo(item.createdAt)}</Text>
                  {item.isMine && !item.id.startsWith('pendiente-') && (
                    <TouchableOpacity onPress={() => borrarComentario(item)} hitSlop={8}>
                      <Ionicons name="ellipsis-horizontal" size={15} color={T.ink3} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={[
                  s.comentarioTexto,
                  { color: T.ink2 },
                  item.id.startsWith('pendiente-') && { opacity: 0.55 },
                ]}>
                  {item.content}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            cargando ? (
              <View style={{ padding: 20, gap: 16 }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Skeleton h={42} w={42} r={21} />
                  <View style={{ flex: 1, gap: 7 }}>
                    <Skeleton h={12} w={'52%'} /><Skeleton h={10} w={'28%'} />
                  </View>
                </View>
                <Skeleton h={260} r={18} />
              </View>
            ) : error ? (
              <Empty icon="cloud-offline-outline" title="No pudimos cargarla" text={error}
                action="Reintentar" onAction={cargar} />
            ) : post ? (
              <Empty icon="chatbubble-outline" title="Todavía no hay comentarios"
                text="Sé el primero en decir algo." tight />
            ) : null
          }
        />

        {!!post && (
          <View style={[s.barra, { backgroundColor: T.bgSurface, borderColor: T.glassBorder }]}>
            <Avatar profile={me} size={32} />
            <TextInput
              ref={campo}
              style={[s.input, { color: T.ink }]}
              placeholder="Escribe un comentario…"
              placeholderTextColor={T.ink3}
              value={texto}
              onChangeText={t => t.length <= 1000 && setTexto(t)}
              multiline
            />
            <TouchableOpacity
              onPress={enviar}
              disabled={!texto.trim() || enviando}
              style={[
                s.enviar,
                { backgroundColor: texto.trim() ? T.accent : T.ink4, opacity: enviando ? 0.6 : 1 },
              ]}
              activeOpacity={0.8}
            >
              {enviando
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="arrow-up" size={17} color="#fff" />}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

// ── Acción ───────────────────────────────────────────────────────────────────

/** Igual que la del muro, con el mismo muelle al pulsar. */
function Accion({
  icon, label, active, onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label?: number
  active?: boolean
  onPress: () => void
}) {
  const T = useAppTheme()
  const tinte = active ? T.accent : T.ink2
  return (
    <TouchableOpacity
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress() }}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      hitSlop={8}
    >
      <Ionicons name={icon} size={22} color={tinte} />
      {label !== undefined && label > 0 && (
        <Text style={{ fontSize: 13, fontWeight: '700', color: tinte }}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

const cb = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4, borderBottomWidth: 1,
  },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 2.5, marginBottom: 2 },
  titulo: { fontSize: 17, fontWeight: '800' },
})

const s = StyleSheet.create({
  velo: { position: 'absolute', left: 0, right: 0 },
  mandoSobre: {
    position: 'absolute', top: 6, left: 14, right: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  pieSobre: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 10 },
  autorSobre: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nombreSobre: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },
  cuandoSobre: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  textoSobre: { fontSize: 14.5, lineHeight: 21, color: '#FFFFFF' },
  raya: { height: 1, marginTop: 12 },
  autor: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, paddingVertical: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9, borderWidth: 1,
  },
  chipTxt: { fontSize: 10, fontWeight: '700' },
  texto: { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingTop: 10 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: 16, paddingTop: 14 },
  comentario: { flexDirection: 'row', gap: 11, paddingHorizontal: 16, marginBottom: 18 },
  comentarioCabeza: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  comentarioNombre: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  comentarioHora: { fontSize: 11 },
  comentarioTexto: { fontSize: 14, lineHeight: 20, marginTop: 3 },
  barra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, borderTopWidth: 1,
  },
  input: {
    flex: 1, fontSize: 14.5, maxHeight: 110,
    paddingVertical: 8, paddingHorizontal: 4, lineHeight: 20,
  },
  enviar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
})
