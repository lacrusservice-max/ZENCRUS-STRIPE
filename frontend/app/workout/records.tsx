/**
 * RÉCORDS
 * ───────
 * El muro de marcas. Lo que se ha conseguido.
 *
 * ── Rehecho con el sistema de la sección ────────────────────────────────────
 * Antes era una lista de filas de texto. Ahora la marca principal ocupa una
 * pieza entera sobre fotografía —una marca es lo más parecido a un trofeo que
 * tiene esta app y merece tamaño— y cada ejercicio lleva su imagen.
 *
 * ── Cinco métricas, no una ──────────────────────────────────────────────────
 * Cada forma de entrenar tiene su récord y todas hacen la misma ilusión: en el
 * gimnasio el 1RM, en calistenia las repeticiones, en una plancha el tiempo y
 * corriendo la distancia. Una app que solo celebra kilos le dice a quien
 * entrena en casa que lo suyo no cuenta.
 *
 * ── Se agrupan por ejercicio, no por fecha ──────────────────────────────────
 * Un récord no es una noticia, es un estado: «mi mejor press son 105». Por
 * fecha, el mismo ejercicio aparecería cinco veces según se fue superando.
 */

import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Vacio } from '@/components/workout/Charts'
import { misRecords, Marca, Metrica } from '@/services/sessionService'
import { desdeCuando } from '@/services/statsService'
import { FOTOS } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

/**
 * Cómo se dice cada métrica y en qué unidad.
 *
 * El orden importa: dentro de un ejercicio el 1RM va primero porque es el que
 * la gente busca. Las demás solo salen si existen.
 */
const METRICAS: { id: Metrica; label: string; unidad: string; formato?: (v: number) => string }[] = [
  { id: 'est_1rm', label: '1RM estimado', unidad: 'kg' },
  { id: 'max_weight', label: 'Más peso', unidad: 'kg' },
  { id: 'max_reps', label: 'Más repeticiones', unidad: '' },
  {
    id: 'max_duration', label: 'Más tiempo', unidad: '',
    formato: v => v >= 60 ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` : `${Math.round(v)} s`,
  },
  {
    id: 'max_distance', label: 'Más distancia', unidad: '',
    formato: v => v >= 1000 ? `${(Math.round(v / 100) / 10).toString().replace('.', ',')} km` : `${Math.round(v)} m`,
  },
]

const POR_ID = new Map(METRICAS.map(m => [m.id, m]))

export default function Records() {
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setMarcas(await misRecords())
    } catch {
      setMarcas([])
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void cargar() }, [cargar]))

  const porEjercicio = useMemo(() => {
    const mapa = new Map<string, { nombre: string; poster: string | null; marcas: Marca[]; ultima: string }>()
    for (const m of marcas) {
      const acc = mapa.get(m.exercise_key)
        ?? { nombre: m.exercise_name, poster: m.poster ?? null, marcas: [], ultima: m.achieved_at }
      acc.marcas.push(m)
      if (m.poster && !acc.poster) acc.poster = m.poster
      if (m.achieved_at > acc.ultima) acc.ultima = m.achieved_at
      mapa.set(m.exercise_key, acc)
    }
    return [...mapa.entries()]
      .map(([key, v]) => ({
        key, ...v,
        marcas: v.marcas.sort((a, b) =>
          METRICAS.findIndex(x => x.id === a.metric) - METRICAS.findIndex(x => x.id === b.metric)),
      }))
      .sort((a, b) => b.ultima.localeCompare(a.ultima))
  }, [marcas])

  /** El 1RM más alto: es la cifra que la gente enseña. */
  const mejor = marcas
    .filter(m => m.metric === 'est_1rm')
    .reduce<Marca | null>((max, m) => (!max || Number(m.value) > Number(max.value) ? m : max), null)

  const esteMes = marcas.filter(
    m => new Date(m.achieved_at).getTime() > Date.now() - 30 * 86400_000,
  ).length

  return (
    <Screen>
      <CabeceraSeccion
        titulo="Récords"
        subtitulo={marcas.length > 0
          ? `${marcas.length} ${marcas.length === 1 ? 'marca' : 'marcas'} en ${porEjercicio.length} ${porEjercicio.length === 1 ? 'ejercicio' : 'ejercicios'}`
          : 'Tus mejores marcas'}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refrescando}
            onRefresh={() => { setRefrescando(true); void cargar() }}
            tintColor={Colors.neon.w3} />
        }
      >
        {cargando ? (
          <View style={s.cargando}><ActivityIndicator color={Colors.neon.red} /></View>
        ) : marcas.length === 0 ? (
          <View style={{ padding: Spacing[4] }}>
            <Vacio texto="Sin récords todavía. La primera serie que registres ya es uno: nunca has hecho más que eso." />
          </View>
        ) : (
          <>
            {/* ── La marca ─────────────────────────────────────────────── */}
            {mejor && (
              <Animated.View entering={FadeIn.duration(440)} style={s.zonaHero}>
                <View style={s.hero}>
                  <Image
                    source={mejor.poster ? { uri: mejor.poster } : FOTOS.gimnasio.fuente}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={300}
                  />
                  <LinearGradient
                    colors={['rgba(5,5,5,0.30)', 'rgba(5,5,5,0.75)', 'rgba(5,5,5,0.97)']}
                    locations={[0, 0.45, 1]}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />

                  <View style={s.heroDentro}>
                    <View style={s.trofeo}>
                      <Ionicons name="trophy" size={13} color={Colors.neon.void} />
                      <Text style={s.trofeoTxt}>TU MEJOR LEVANTAMIENTO</Text>
                    </View>

                    <View>
                      <Text style={s.heroCifra}>
                        {Number(mejor.value)}<Text style={s.heroUnidad}> kg</Text>
                      </Text>
                      <Text style={s.heroNombre} numberOfLines={2}>{mejor.exercise_name}</Text>
                      <Text style={s.heroPie}>
                        1RM estimado
                        {mejor.weight_kg && mejor.reps ? ` desde ${mejor.weight_kg} kg × ${mejor.reps}` : ''}
                        {' · '}{desdeCuando(mejor.achieved_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── Cifras ───────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(70).duration(380)} style={s.bloque}>
              <View style={s.cifras}>
                <Cifra valor={String(marcas.length)} etiqueta="marcas" />
                <View style={s.cifraSep} />
                <Cifra valor={String(porEjercicio.length)} etiqueta="ejercicios" />
                <View style={s.cifraSep} />
                <Cifra valor={String(esteMes)} etiqueta="este mes" destacada={esteMes > 0} />
              </View>
            </Animated.View>

            {/* ── Por ejercicio ────────────────────────────────────────── */}
            <View style={s.bloque}>
              <Text style={s.seccion}>POR EJERCICIO</Text>
              {porEjercicio.map((e, i) => (
                <Animated.View
                  key={e.key}
                  entering={FadeInDown.delay(Math.min(110 + i * 45, 420)).duration(360)}
                >
                  <TouchableOpacity
                    style={s.tarjeta}
                    onPress={() => router.push('/workout/stats')}
                    activeOpacity={0.85}
                  >
                    <View style={s.tarjetaCabecera}>
                      <View style={s.foto}>
                        {e.poster ? (
                          <Image source={{ uri: e.poster }} style={s.fotoImg} contentFit="cover" transition={180} />
                        ) : (
                          <View style={s.fotoVacia}>
                            <Ionicons name="barbell-outline" size={18} color={Colors.neon.w4} />
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.ejercicio} numberOfLines={2}>{e.nombre}</Text>
                        <Text style={s.ejercicioPie}>{desdeCuando(e.ultima)}</Text>
                      </View>
                      <Ionicons name="trending-up" size={16} color={Colors.neon.w4} />
                    </View>

                    <View style={s.marcas}>
                      {e.marcas.map(m => {
                        const def = POR_ID.get(m.metric)
                        const v = Number(m.value)
                        return (
                          <View key={m.metric} style={s.marca}>
                            <Text style={s.marcaValor}>
                              {def?.formato ? def.formato(v) : `${v}${def?.unidad ? ` ${def.unidad}` : ''}`}
                            </Text>
                            <Text style={s.marcaLabel}>{def?.label ?? m.metric}</Text>
                          </View>
                        )
                      })}
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>

            <Text style={s.pieLegal}>
              Los récords se rehacen solos si corriges una serie mal metida: se recalculan
              desde tu historial, no se guardan aparte.
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

function Cifra({ valor, etiqueta, destacada }: { valor: string; etiqueta: string; destacada?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[s.cifraValor, destacada && { color: Colors.neon.red }]}>{valor}</Text>
      <Text style={s.cifraEtiqueta}>{etiqueta}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },

  zonaHero: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4] },
  hero: {
    height: 300, borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'space-between',
    backgroundColor: Colors.neon.void,
  },
  heroDentro: { flex: 1, justifyContent: 'space-between', padding: Spacing[4] },
  trofeo: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: Spacing[3], paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  trofeoTxt: { fontSize: 9, fontWeight: '800', color: Colors.neon.void, letterSpacing: 1.1 },
  heroCifra: { fontSize: 62, fontWeight: '800', color: Colors.neon.white, letterSpacing: -2.6, lineHeight: 66 },
  heroUnidad: { fontSize: 22, fontWeight: '700', color: Colors.neon.w2, letterSpacing: 0 },
  heroNombre: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.neon.white, marginTop: 2 },
  heroPie: { fontSize: 11, color: Colors.neon.w2, marginTop: 4 },

  bloque: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4], gap: Spacing[3] },
  seccion: { fontSize: 10, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.6 },

  cifras: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  cifraSep: { width: 1, height: 28, backgroundColor: Colors.neon.edge },
  cifraValor: { fontSize: 24, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.6 },
  cifraEtiqueta: { fontSize: 10, color: Colors.neon.w3, marginTop: 1 },

  tarjeta: {
    gap: Spacing[3], padding: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  tarjetaCabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  foto: {
    width: 54, height: 54, borderRadius: 14, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  fotoImg: { width: '100%', height: '100%' },
  fotoVacia: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ejercicio: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white, lineHeight: 20 },
  ejercicioPie: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },

  // Las métricas en fila, cada una con su cifra grande: una tabla de etiqueta y
  // valor se lee como un formulario, y esto son logros.
  marcas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  marca: {
    flexGrow: 1, minWidth: '30%',
    paddingVertical: Spacing[2], paddingHorizontal: Spacing[3],
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(5,5,5,0.3)',
  },
  marcaValor: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  marcaLabel: { fontSize: 9.5, color: Colors.neon.w3, marginTop: 1 },

  pieLegal: {
    fontSize: 11, color: Colors.neon.w3, lineHeight: 16,
    paddingHorizontal: Spacing[4], paddingTop: Spacing[2],
  },
})
