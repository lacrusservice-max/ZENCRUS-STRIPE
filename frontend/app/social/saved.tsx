/**
 * COMUNIDAD · GUARDADOS
 * ─────────────────────
 * Lo que he guardado para volver a verlo.
 *
 * ── Es una lista privada, no un muro ────────────────────────────────────────
 * Nadie sabe que guardaste su publicación: no avisa, no suma a ningún contador
 * y no sale en ninguna respuesta ajena. Por eso esta pantalla cuelga de mi
 * perfil y no de la sección.
 *
 * ── Puede devolver menos de lo que guardaste ────────────────────────────────
 * El servidor vuelve a comprobar los permisos al leer, así que lo de una cuenta
 * que se cerró —o que dejó de aceptarte, o que te bloqueó— deja de salir. La
 * fila no se borra, por si vuelve a poderse. El texto de abajo lo explica, para
 * que un hueco no se lea como que la app perdió algo.
 */

import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { Empty, FeedSkeleton } from '@/components/social/Bits'
import { PostGrid } from '@/components/social/ProfileView'
import * as S from '@/services/socialService'
import { TabBar } from '@/constants/layout'

export default function SavedScreen() {
  const T = useAppTheme()
  const [posts, setPosts] = useState<S.Post[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async (refrescar = false) => {
    refrescar ? setRefrescando(true) : setCargando(true)
    try {
      const p = await S.getSaved()
      setPosts(p.posts)
      setCursor(p.nextBefore)
      setError(null)
    } catch (e) {
      setError(S.errorText(e, 'No pudimos cargar tus guardados'))
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { cargar(true) }, []))

  /**
   * Se sigue pidiendo aunque una página venga vacía.
   *
   * El cursor avanza con lo que el servidor MIRÓ, no con lo que devolvió: si
   * una página entera era de cuentas que ya no se pueden ver, llegan cero
   * publicaciones pero sí un cursor nuevo. Parar ahí escondería todo lo que
   * hubiera detrás.
   */
  const cargarMas = async () => {
    if (!cursor || cargandoMas) return
    setCargandoMas(true)
    try {
      const p = await S.getSaved(cursor)
      setPosts(x => [...x, ...p.posts])
      setCursor(p.nextBefore)
    } catch { /* se reintenta al seguir desplazándose */ }
    finally { setCargandoMas(false) }
  }

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="COMUNIDAD"
        title="Guardados"
        subtitle="Solo tú ves esta lista"
        icon="bookmark"
      />

      <FlatList
        // Una sola fila con la rejilla dentro: `PostGrid` ya coloca las tres
        // columnas, y anidarla en una FlatList de una fila da paginación y
        // «tirar para actualizar» sin duplicar el código de la cuadrícula.
        data={posts.length ? [posts] : []}
        keyExtractor={() => 'rejilla'}
        renderItem={({ item }) => (
          <PostGrid posts={item} onPress={p => router.push(`/social/post/${p.id}`)} />
        )}
        contentContainerStyle={{ paddingBottom: TabBar.scrollInset }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={T.accent} />
        }
        onEndReached={cargarMas}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          cargando ? <FeedSkeleton />
          : error ? (
            <Empty icon="cloud-offline-outline" title="No pudimos cargarlos" text={error}
              action="Reintentar" onAction={() => cargar()} />
          ) : (
            <Empty
              icon="bookmark-outline"
              title="Todavía no has guardado nada"
              text="Toca el marcador de una publicación para tenerla aquí a mano."
              tight
            />
          )
        }
        ListFooterComponent={
          cargandoMas
            ? <ActivityIndicator color={T.accent} style={{ marginVertical: 22 }} />
            : posts.length ? (
              <Text style={[s.pie, { color: T.ink3 }]}>
                Si guardaste algo de una cuenta que después se cerró o dejó de aceptarte,
                deja de aparecer aquí. Vuelve si esa persona te acepta otra vez.
              </Text>
            ) : null
        }
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  pie: { fontSize: 11.5, lineHeight: 17, paddingHorizontal: 24, marginTop: 22, textAlign: 'center' },
})
