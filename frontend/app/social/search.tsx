/**
 * COMUNIDAD · BUSCAR GENTE
 * ────────────────────────
 * Busca por nombre de usuario y por nombre visible.
 *
 * ── Por qué espera antes de buscar ──────────────────────────────────────────
 * Se lanza la petición 320 ms después de la última tecla, no en cada letra:
 * escribir «sergio» dispararía seis búsquedas de las que cinco se tiran, y con
 * el limitador del servidor en cien peticiones cada cuarto de hora eso agota la
 * cuota escribiendo tres nombres.
 *
 * Las respuestas que llegan tarde se descartan: sin ese control, la búsqueda de
 * «ser» puede contestar DESPUÉS que la de «sergio» y dejar en pantalla
 * resultados que no corresponden a lo que está escrito.
 */

import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { Avatar, NameBlock, Empty } from '@/components/social/Bits'
import * as S from '@/services/socialService'

const MINIMO = 2

export default function SearchScreen() {
  const T = useAppTheme()
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<S.SearchResult[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Número de la última búsqueda pedida: solo esa puede pintar. */
  const turno = useRef(0)

  useEffect(() => {
    const q = texto.trim()
    if (q.length < MINIMO) {
      setResultados([])
      setBuscando(false)
      setError(null)
      return
    }

    setBuscando(true)
    const mio = ++turno.current
    const temporizador = setTimeout(async () => {
      try {
        const r = await S.searchUsers(q)
        if (mio !== turno.current) return   // llegó tarde: ya hay otra búsqueda
        setResultados(r)
        setError(null)
      } catch (e) {
        if (mio !== turno.current) return
        setError(S.errorText(e, 'No pudimos buscar ahora mismo'))
      } finally {
        if (mio === turno.current) setBuscando(false)
      }
    }, 320)

    return () => clearTimeout(temporizador)
  }, [texto])

  const insignia = (r: S.Relation) =>
    r === 'following' ? { t: 'Siguiendo', i: 'checkmark-circle' as const }
    : r === 'requested' ? { t: 'Solicitado', i: 'time-outline' as const }
    : null

  return (
    <Screen>
      <ScreenHeader back eyebrow="COMUNIDAD" title="Buscar" icon="search" />

      <View style={[s.caja, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
        <Ionicons name="search" size={17} color={T.ink3} />
        <TextInput
          style={[s.input, { color: T.ink }]}
          placeholder="Nombre o usuario"
          placeholderTextColor={T.ink3}
          value={texto}
          onChangeText={setTexto}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
        />
        {buscando && <ActivityIndicator size="small" color={T.ink3} />}
        {!!texto && !buscando && (
          <TouchableOpacity onPress={() => setTexto('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={T.ink3} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={resultados}
        keyExtractor={u => u.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40, gap: 4 }}
        renderItem={({ item }) => {
          const marca = insignia(item.relation)
          return (
            <TouchableOpacity
              style={s.fila}
              onPress={() => router.push(`/social/profile/${item.id}`)}
              activeOpacity={0.75}
            >
              <Avatar profile={item} size={44} />
              <NameBlock profile={item} />
              {marca && (
                <View style={[s.marca, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
                  <Ionicons name={marca.i} size={11} color={T.ink3} />
                  <Text style={[s.marcaTxt, { color: T.ink3 }]}>{marca.t}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={T.ink3} />
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          error ? (
            <Empty icon="cloud-offline-outline" title="No pudimos buscar" text={error} tight />
          ) : texto.trim().length >= MINIMO && !buscando ? (
            <Empty
              icon="person-outline"
              title="Nadie con ese nombre"
              text="Prueba con el nombre de usuario exacto — se escribe sin espacios ni acentos."
              tight
            />
          ) : (
            <Empty
              icon="search-outline"
              title="Encuentra a tu gente"
              text={`Escribe al menos ${MINIMO} letras del nombre o del usuario.`}
              tight
            />
          )
        }
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  caja: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 16, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  marca: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, borderWidth: 1,
  },
  marcaTxt: { fontSize: 10, fontWeight: '700' },
})
