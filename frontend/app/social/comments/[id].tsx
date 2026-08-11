/**
 * COMUNIDAD · COMENTARIOS
 * ───────────────────────
 * Los comentarios de una publicación, con el campo de escribir anclado abajo.
 *
 * El comentario aparece en la lista en cuanto se pulsa enviar, antes de que el
 * servidor conteste, y se retira si falla. En una conversación, medio segundo
 * de espera con el campo vacío se lee como «no se envió» y la gente lo manda
 * dos veces.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Avatar, Empty, Skeleton, timeAgo } from '@/components/social/Bits'
import * as S from '@/services/socialService'

export default function CommentsScreen() {
  const T = useAppTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const me = useSocialStore(s => s.me)
  const bumpComments = useSocialStore(s => s.bumpComments)

  const [comentarios, setComentarios] = useState<S.Comment[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const lista = useRef<FlatList>(null)

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    try {
      setComentarios(await S.getComments(id))
      setError(null)
    } catch (e) {
      setError(S.errorText(e, 'No pudimos cargar los comentarios'))
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const enviar = async () => {
    const contenido = texto.trim()
    if (!contenido || enviando || !id) return

    // Se pinta ya, con un identificador provisional.
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
    } catch (e) {
      setComentarios(c => c.filter(x => x.id !== provisional.id))
      setTexto(contenido)   // no se pierde lo escrito
      Alert.alert('No pudimos publicar tu comentario', S.errorText(e))
    } finally {
      setEnviando(false)
    }
  }

  const borrar = (c: S.Comment) => {
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
          } catch (e) {
            setComentarios(copia)
            Alert.alert('No pudimos eliminarlo', S.errorText(e))
          }
        },
      },
    ])
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScreenHeader back eyebrow="COMUNIDAD" title="Comentarios" icon="chatbubbles" />

        <FlatList
          ref={lista}
          data={comentarios}
          keyExtractor={c => c.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 18 }}
          renderItem={({ item }) => (
            <View style={s.fila}>
              <Avatar
                profile={item.author}
                size={34}
                onPress={() => item.author && router.push(`/social/profile/${item.author.id}`)}
              />
              <View style={{ flex: 1 }}>
                <View style={s.cabeza}>
                  <Text style={[s.nombre, { color: T.ink }]} numberOfLines={1}>
                    {item.author?.fullName ?? item.author?.username ?? 'Cuenta ZENCRUS'}
                  </Text>
                  <Text style={[s.hora, { color: T.ink3 }]}>{timeAgo(item.createdAt)}</Text>
                  {item.isMine && !item.id.startsWith('pendiente-') && (
                    <TouchableOpacity onPress={() => borrar(item)} hitSlop={8}>
                      <Ionicons name="ellipsis-horizontal" size={15} color={T.ink3} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={[
                  s.texto,
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
              <View style={{ gap: 20, paddingTop: 10 }}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={s.fila}>
                    <Skeleton h={34} w={34} r={17} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <Skeleton h={11} w={'40%'} />
                      <Skeleton h={10} w={'85%'} />
                    </View>
                  </View>
                ))}
              </View>
            ) : error ? (
              <Empty icon="cloud-offline-outline" title="No pudimos cargarlos" text={error}
                action="Reintentar" onAction={cargar} />
            ) : (
              <Empty icon="chatbubble-outline" title="Todavía no hay comentarios"
                text="Sé el primero en decir algo." tight />
            )
          }
          onContentSizeChange={() => comentarios.length && lista.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        <View style={[s.barra, { backgroundColor: T.bgSurface, borderColor: T.glassBorder }]}>
          <Avatar profile={me} size={32} />
          <TextInput
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
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 11 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombre: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  hora: { fontSize: 11 },
  texto: { fontSize: 14, lineHeight: 20, marginTop: 3 },
  barra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24,
    borderTopWidth: 1,
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
