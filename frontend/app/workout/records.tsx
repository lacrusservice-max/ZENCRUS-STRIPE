/**
 * RÉCORDS
 * ───────
 * El muro de marcas. Lo que se ha conseguido, sin adornos.
 *
 * ── Cinco métricas, no una ──────────────────────────────────────────────────
 * Cada forma de entrenar tiene su récord y todos hacen la misma ilusión: en el
 * gimnasio el 1RM, en calistenia las repeticiones, en una plancha el tiempo y
 * corriendo la distancia. Una app que solo celebra kilos le dice a quien
 * entrena en casa que lo suyo no cuenta.
 *
 * ── Se agrupan por ejercicio, no por fecha ──────────────────────────────────
 * Un récord no es una noticia, es un estado: «mi mejor press de banca son 105».
 * Ordenado por fecha, el mismo ejercicio aparecería cinco veces según se fue
 * superando, que es justo lo que no se quiere leer.
 */

import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/ui/Screen'
import { MenuSeccion, CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Vacio, Cifra } from '@/components/workout/Charts'
import { misRecords, Marca, Metrica } from '@/services/sessionService'
import { desdeCuando } from '@/services/statsService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

/**
 * Cómo se dice cada métrica y en qué unidad.
 *
 * El orden importa: dentro de un ejercicio, el 1RM va primero porque es el que
 * la gente busca. Las demás solo salen si existen.
 */
const METRICAS: { id: Metrica; label: string; unidad: string; formato?: (v: number) => string }[] = [
  { id: 'est_1rm', label: '1RM estimado', unidad: 'kg' },
  { id: 'max_weight', label: 'Más peso', unidad: 'kg' },
  { id: 'max_reps', label: 'Más repeticiones', unidad: '' },
  {
    id: 'max_duration', label: 'Más tiempo', unidad: '',
    formato: (v) => v >= 60 ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` : `${Math.round(v)} s`,
  },
  {
    id: 'max_distance', label: 'Más distancia', unidad: '',
    formato: (v) => v >= 1000 ? `${(Math.round(v / 100) / 10).toString().replace('.', ',')} km` : `${Math.round(v)} m`,
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

  /**
   * Por ejercicio, y dentro de cada uno sus métricas.
   *
   * El orden entre ejercicios es por lo más RECIENTE: un récord de esta semana
   * interesa más que uno de hace ocho meses, aunque el de hace ocho meses sea
   * un número más grande.
   */
  const porEjercicio = useMemo(() => {
    const mapa = new Map<string, { nombre: string; marcas: Marca[]; ultima: string }>()
    for (const m of marcas) {
      const acc = mapa.get(m.exercise_key) ?? { nombre: m.exercise_name, marcas: [], ultima: m.achieved_at }
      acc.marcas.push(m)
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

  /** El 1RM más alto de todos: es la cifra que la gente enseña. */
  const mejor1RM = marcas
    .filter(m => m.metric === 'est_1rm')
    .reduce<Marca | null>((max, m) => (!max || Number(m.value) > Number(max.value) ? m : max), null)

  const conteoEsteMes = marcas.filter(
    m => new Date(m.achieved_at).getTime() > Date.now() - 30 * 86400_000,
  ).length

  return (
    <Screen>
      <CabeceraSeccion
        titulo="Récords"
        subtitulo={marcas.length > 0 ? `${marcas.length} marcas en ${porEjercicio.length} ejercicios` : 'Tus mejores marcas'}
      />
      <MenuSeccion activo="records" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing[4], paddingBottom: 110, gap: Spacing[4] }}
        refreshControl={
          <RefreshControl refreshing={refrescando}
            onRefresh={() => { setRefrescando(true); void cargar() }}
            tintColor={Colors.neon.w3} />
        }
      >
        {cargando ? (
          <View style={s.cargando}><ActivityIndicator color={Colors.neon.w3} /></View>
        ) : marcas.length === 0 ? (
          <Vacio texto="Sin récords todavía. La primera serie que registres ya es uno: nunca has hecho más que eso." />
        ) : (
          <>
            {/* ── Lo más alto ──────────────────────────────────────────── */}
            {mejor1RM && (
              <Animated.View entering={FadeInDown.duration(360)} style={s.destacado}>
                <Ionicons name="trophy" size={22} color={Colors.neon.red} />
                <Text style={s.destacadoEtiqueta}>TU MEJOR LEVANTAMIENTO</Text>
                <Text style={s.destacadoValor}>{Number(mejor1RM.value)} kg</Text>
                <Text style={s.destacadoNombre}>{mejor1RM.exercise_name}</Text>
                <Text style={s.destacadoPie}>
                  1RM estimado
                  {mejor1RM.weight_kg && mejor1RM.reps ? ` desde ${mejor1RM.weight_kg} kg × ${mejor1RM.reps}` : ''}
                  {' · '}{desdeCuando(mejor1RM.achieved_at)}
                </Text>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(60).duration(360)} style={s.cifras}>
              <Cifra valor={String(marcas.length)} etiqueta="MARCAS" />
              <Cifra valor={String(porEjercicio.length)} etiqueta="EJERCICIOS" />
              <Cifra valor={String(conteoEsteMes)} etiqueta="ESTE MES" />
            </Animated.View>

            {/* ── Por ejercicio ────────────────────────────────────────── */}
            {porEjercicio.map((e, i) => (
              <Animated.View
                key={e.key}
                entering={FadeInDown.delay(Math.min(120 + i * 40, 400)).duration(340)}
                style={s.tarjeta}
              >
                <View style={s.tituloFila}>
                  <Text style={s.ejercicio} numberOfLines={1}>{e.nombre}</Text>
                  <TouchableOpacity onPress={() => router.push(`/workout/stats`)} hitSlop={8}>
                    <Ionicons name="trending-up" size={16} color={Colors.neon.w3} />
                  </TouchableOpacity>
                </View>

                {e.marcas.map(m => {
                  const def = POR_ID.get(m.metric)
                  const v = Number(m.value)
                  return (
                    <View key={m.metric} style={s.marca}>
                      <Text style={s.marcaLabel}>{def?.label ?? m.metric}</Text>
                      <Text style={s.marcaValor}>
                        {def?.formato ? def.formato(v) : `${v}${def?.unidad ? ` ${def.unidad}` : ''}`}
                      </Text>
                      <Text style={s.marcaCuando}>{desdeCuando(m.achieved_at)}</Text>
                    </View>
                  )
                })}
              </Animated.View>
            ))}

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

const s = StyleSheet.create({
  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },
  cifras: { flexDirection: 'row', gap: Spacing[2] },

  destacado: {
    alignItems: 'center', gap: 3, padding: Spacing[5],
    backgroundColor: Colors.neon.redDim,
    borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.35)',
  },
  destacadoEtiqueta: { fontSize: 9, fontWeight: '800', color: Colors.neon.redCore, letterSpacing: 1.6, marginTop: 4 },
  destacadoValor: { fontSize: 44, fontWeight: '800', color: Colors.neon.white, letterSpacing: -1.5, lineHeight: 50 },
  destacadoNombre: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.neon.white },
  destacadoPie: { fontSize: 11, color: Colors.neon.redCore, textAlign: 'center', marginTop: 2 },

  tarjeta: {
    gap: Spacing[2], padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  tituloFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing[2] },
  ejercicio: { flex: 1, fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },

  marca: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[2],
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.055)',
  },
  marcaLabel: { flex: 1, fontSize: 12, color: Colors.neon.w2 },
  marcaValor: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  marcaCuando: { fontSize: 10, color: Colors.neon.w3, minWidth: 76, textAlign: 'right' },

  pieLegal: { fontSize: 11, color: Colors.neon.w3, lineHeight: 16, paddingHorizontal: Spacing[2] },
})
