/**
 * BIBLIOTECA DE EJERCICIOS
 * ────────────────────────
 * Los 206 ejercicios, con su vídeo y su póster, filtrables por dónde entrenas,
 * qué grupo muscular y con qué material.
 *
 * ── «Casa o gimnasio» va primero ────────────────────────────────────────────
 * Es el filtro que más recorta —de 206 a 125— y el único que responde a algo
 * que la persona ya sabe antes de abrir la app: dónde está. Los demás filtros
 * afinan; este decide.
 *
 * ── La rejilla enseña el póster, no un icono ────────────────────────────────
 * Cada ficha tiene su fotograma real. Reconocer un ejercicio por su imagen es
 * instantáneo; leer «press inclinado con mancuerna» y traducirlo a un
 * movimiento, no. Por eso las tarjetas son grandes y el texto va encima.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, ScrollView,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { Empty, Skeleton } from '@/components/social/Bits'
import * as E from '@/services/exerciseService'
import { errorText } from '@/services/socialService'

// ── Selector de sitio ────────────────────────────────────────────────────────

function DondeEntrenas({
  value, onChange, casa, total,
}: { value: 'todo' | 'home'; onChange: (v: 'todo' | 'home') => void; casa: number; total: number }) {
  const T = useAppTheme()
  const opciones = [
    { k: 'todo' as const, icon: 'earth' as const, label: 'Todo', n: total },
    { k: 'home' as const, icon: 'home' as const, label: 'En casa', n: casa },
  ]
  return (
    <View style={[d.wrap, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
      {opciones.map(o => {
        const on = value === o.k
        return (
          <TouchableOpacity
            key={o.k}
            style={[d.opt, on && { backgroundColor: `${T.accent}1E`, borderColor: `${T.accent}3A` }]}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(o.k) }}
            activeOpacity={0.8}
          >
            <Ionicons name={o.icon} size={14} color={on ? T.accent : T.ink3} />
            <Text style={[d.txt, { color: on ? T.accent : T.ink3 }]}>{o.label}</Text>
            <Text style={[d.n, { color: on ? T.accent : T.ink4 }]}>{o.n}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const d = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 4, marginHorizontal: 20, padding: 4, borderRadius: 15, borderWidth: 1 },
  opt: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
  },
  txt: { fontSize: 13, fontWeight: '700' },
  n: { fontFamily: 'System', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] as const },
})

// ── Tarjeta ──────────────────────────────────────────────────────────────────

function Tarjeta({ ex, ancho, onPress }: { ex: E.ExerciseCard; ancho: number; onPress: () => void }) {
  const T = useAppTheme()
  const color = E.colorDe(ex.muscle)

  return (
    <TouchableOpacity
      style={[c.card, { width: ancho, borderColor: T.glassBorder, backgroundColor: T.glass }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[c.imgWrap, { backgroundColor: `${color}18` }]}>
        {ex.poster ? (
          <Image source={{ uri: ex.poster }} style={c.img} contentFit="cover" transition={160} recyclingKey={ex.slug} />
        ) : (
          <View style={c.sinFoto}><Ionicons name="barbell-outline" size={22} color={T.ink3} /></View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(5,5,7,0.88)']}
          style={c.velo}
          pointerEvents="none"
        />
        {ex.home && (
          <View style={c.casa}><Ionicons name="home" size={9} color="#fff" /></View>
        )}
        <View style={[c.tira, { backgroundColor: color }]} />
      </View>

      <View style={c.pie}>
        <Text style={[c.nombre, { color: T.ink }]} numberOfLines={2}>{ex.name}</Text>
        <View style={c.meta}>
          <Text style={[c.grupo, { color }]} numberOfLines={1}>{ex.muscleEs ?? '—'}</Text>
          <Text style={[c.mat, { color: T.ink3 }]} numberOfLines={1}>{ex.equipmentEs}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const c = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  imgWrap: { width: '100%', aspectRatio: 1, position: 'relative' },
  img: { width: '100%', height: '100%' },
  sinFoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  velo: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%' },
  casa: {
    position: 'absolute', top: 7, right: 7,
    width: 19, height: 19, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  tira: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5 },
  pie: { padding: 9, gap: 4 },
  nombre: { fontSize: 12.5, fontWeight: '700', lineHeight: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grupo: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  mat: { fontSize: 10, flex: 1 },
})

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const T = useAppTheme()
  const { width } = useWindowDimensions()

  const [filtros, setFiltros] = useState<E.Filters | null>(null)
  const [lugar, setLugar] = useState<'todo' | 'home'>('todo')
  const [grupo, setGrupo] = useState<string | null>(null)
  const [material, setMaterial] = useState<string | null>(null)
  const [texto, setTexto] = useState('')

  const [lista, setLista] = useState<E.ExerciseCard[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Número de la última petición: solo esa puede pintar. */
  const turno = useRef(0)

  useEffect(() => { E.getFilters().then(setFiltros).catch(() => {}) }, [])

  const consulta = useCallback((offset: number): E.Query => ({
    q: texto.trim().length >= 2 ? texto.trim() : undefined,
    muscle: grupo ?? undefined,
    equipment: material ?? undefined,
    place: lugar === 'home' ? 'home' : undefined,
    offset,
  }), [texto, grupo, material, lugar])

  // Se espera a que pare de escribir, como en la búsqueda de la comunidad: una
  // petición por letra agota la cuota del servidor en tres palabras.
  useEffect(() => {
    setCargando(true)
    const mio = ++turno.current
    const t = setTimeout(async () => {
      try {
        const p = await E.listExercises(consulta(0))
        if (mio !== turno.current) return
        setLista(p.exercises); setTotal(p.total); setError(null)
      } catch (e) {
        if (mio !== turno.current) return
        setError(errorText(e, 'No pudimos cargar la biblioteca'))
      } finally {
        if (mio === turno.current) setCargando(false)
      }
    }, texto ? 320 : 0)
    return () => clearTimeout(t)
  }, [consulta])

  const cargarMas = async () => {
    if (cargandoMas || lista.length >= total) return
    setCargandoMas(true)
    try {
      const p = await E.listExercises(consulta(lista.length))
      setLista(l => [...l, ...p.exercises])
    } catch { /* se reintenta al seguir bajando */ }
    finally { setCargandoMas(false) }
  }

  const limpiar = () => { setGrupo(null); setMaterial(null); setTexto(''); setLugar('todo') }
  const hayFiltro = !!grupo || !!material || !!texto || lugar === 'home'

  const COLS = 3
  const ancho = (width - 40 - (COLS - 1) * 10) / COLS

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="ENTRENA"
        title="Biblioteca"
        subtitle={filtros ? `${filtros.total} ejercicios · ${filtros.home} sin gimnasio` : undefined}
        icon="library"
      />

      <View style={[s.buscador, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
        <Ionicons name="search" size={16} color={T.ink3} />
        <TextInput
          style={[s.input, { color: T.ink }]}
          placeholder="Buscar ejercicio o músculo"
          placeholderTextColor={T.ink3}
          value={texto}
          onChangeText={setTexto}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!texto && (
          <TouchableOpacity onPress={() => setTexto('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={T.ink3} />
          </TouchableOpacity>
        )}
      </View>

      <DondeEntrenas
        value={lugar}
        onChange={setLugar}
        casa={filtros?.home ?? 0}
        total={filtros?.total ?? 0}
      />

      {/* Grupos musculares: cada uno con su color, el mismo en toda la app */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll} contentContainerStyle={s.chips}>
        {(filtros?.muscles ?? []).map(m => {
          const on = grupo === m.id
          const col = E.colorDe(m.id)
          return (
            <TouchableOpacity
              key={m.id}
              style={[
                s.chip,
                { borderColor: on ? col : T.glassBorder, backgroundColor: on ? `${col}22` : T.glass },
              ]}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setGrupo(on ? null : m.id) }}
              activeOpacity={0.8}
            >
              <View style={[s.punto, { backgroundColor: col }]} />
              <Text style={[s.chipTxt, { color: on ? T.ink : T.ink2 }]}>{m.label}</Text>
              <Text style={[s.chipN, { color: on ? col : T.ink3 }]}>{m.count}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Material */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll} contentContainerStyle={s.chips}>
        {(filtros?.equipment ?? []).map(m => {
          const on = material === m.id
          return (
            <TouchableOpacity
              key={m.id}
              style={[
                s.chip,
                { borderColor: on ? T.accent : T.glassBorder, backgroundColor: on ? `${T.accent}18` : T.glass },
              ]}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setMaterial(on ? null : m.id) }}
              activeOpacity={0.8}
            >
              <Ionicons name={E.iconoDe(m.id) as any} size={12} color={on ? T.accent : T.ink3} />
              <Text style={[s.chipTxt, { color: on ? T.ink : T.ink2 }]}>{m.label}</Text>
              <Text style={[s.chipN, { color: on ? T.accent : T.ink3 }]}>{m.count}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <View style={s.resumen}>
        <Text style={[s.cuenta, { color: T.ink3 }]}>
          {cargando ? 'Buscando…' : `${total} ${total === 1 ? 'ejercicio' : 'ejercicios'}`}
        </Text>
        {hayFiltro && (
          <TouchableOpacity onPress={limpiar} hitSlop={8}>
            <Text style={[s.limpiar, { color: T.accent }]}>Quitar filtros</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={lista}
        keyExtractor={e => e.slug}
        numColumns={COLS}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 20 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <Tarjeta ex={item} ancho={ancho} onPress={() => router.push(`/workout/exercise/${item.slug}`)} />
        )}
        onEndReached={cargarMas}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        windowSize={9}
        maxToRenderPerBatch={12}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          cargando ? (
            <View style={{ paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <View key={i} style={{ width: ancho, gap: 7 }}>
                  <Skeleton h={ancho} w={ancho} r={16} />
                  <Skeleton h={10} w={'80%'} />
                </View>
              ))}
            </View>
          ) : error ? (
            <Empty icon="cloud-offline-outline" title="No pudimos cargarla" text={error}
              action="Reintentar" onAction={() => setTexto(t => t)} />
          ) : (
            <Empty
              icon="search-outline"
              title="Nada con esos filtros"
              text="Prueba a quitar alguno o a buscar por el nombre del músculo."
              action={hayFiltro ? 'Quitar filtros' : undefined}
              onAction={hayFiltro ? limpiar : undefined}
              tight
            />
          )
        }
        ListFooterComponent={
          cargandoMas ? <ActivityIndicator color={T.accent} style={{ marginVertical: 22 }} /> : null
        }
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 15, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15 },
  // Un ScrollView horizontal dentro de una columna flexible se estira y
  // arrastra a sus hijos: hay que fijarle el alto y no dejarle crecer.
  chipsScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: 20, gap: 7, paddingVertical: 10, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  punto: { width: 7, height: 7, borderRadius: 4 },
  chipTxt: { fontSize: 12.5, fontWeight: '600' },
  chipN: { fontSize: 10.5, fontWeight: '700', fontVariant: ['tabular-nums'] as const },
  resumen: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 12, paddingTop: 2,
  },
  cuenta: { fontSize: 12, fontWeight: '600' },
  limpiar: { fontSize: 12, fontWeight: '700' },
})
