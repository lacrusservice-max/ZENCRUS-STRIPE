/**
 * UN ENTRENAMIENTO
 * ────────────────
 * Lo que pasó aquel día, serie a serie, con su firma.
 *
 * ── La firma va arriba ──────────────────────────────────────────────────────
 * Antes que los números. Una lista de series es un registro contable; la figura
 * es lo que hace que una sesión de hace tres meses se reconozca de un vistazo
 * —«ese fue el día de pierna larga»— sin leer una sola cifra.
 */

import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Signature } from '@/components/workout/Signature'
import { Cifra, Vacio } from '@/components/workout/Charts'
import { NOMBRE_GRUPO } from '@/components/workout/anatomy'
import { detalleSesion, Sesion, Serie } from '@/services/sessionService'
import { kilosCorto, minutosCorto } from '@/services/statsService'
import { COLOR_GRUPO } from '@/services/exerciseService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const NOMBRE_MODO: Record<string, string> = {
  gym: 'Gimnasio', home: 'En casa', outdoor: 'Aire libre', class: 'Clase',
}

export default function DetalleSesion() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [series, setSeries] = useState<Serie[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    let vivo = true
    detalleSesion(id)
      .then(r => { if (vivo) { setSesion(r.session); setSeries(r.sets) } })
      .catch(() => { if (vivo) setError(true) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [id])

  if (cargando) {
    return (
      <Screen>
        <CabeceraSeccion titulo="Entrenamiento" />
        <View style={s.centro}><ActivityIndicator color={Colors.neon.w3} /></View>
      </Screen>
    )
  }

  if (error || !sesion) {
    return (
      <Screen>
        <CabeceraSeccion titulo="Entrenamiento" />
        <View style={{ padding: Spacing[4] }}>
          <Vacio texto="No se encontró este entrenamiento. Puede que se haya descartado." />
        </View>
      </Screen>
    )
  }

  // Las series se agrupan por hueco, que es como se hicieron: cuatro series de
  // press seguidas son un ejercicio, no cuatro cosas sueltas.
  const huecos = [...new Set(series.map(x => x.order_index))].sort((a, b) => a - b)
  const fecha = new Date(sesion.started_at)

  return (
    <Screen>
      <CabeceraSeccion
        titulo={sesion.title}
        subtitulo={`${NOMBRE_MODO[sesion.mode] ?? sesion.mode} · ${fecha.toLocaleDateString('es-ES', {
          weekday: 'long', day: 'numeric', month: 'long',
        })}`}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing[4], paddingBottom: 110, gap: Spacing[4] }}
      >
        {/* ── Firma ────────────────────────────────────────────────────── */}
        {series.length > 0 && (
          <Animated.View entering={FadeIn.duration(600)} style={s.firma}>
            <Signature sessionId={sesion.id} series={series} tam={240} />
            <Text style={s.firmaPie}>
              Un rayo por serie. El largo son los kilos que moviste, el color el músculo
              y el grosor lo que te costó. No hay dos iguales.
            </Text>
          </Animated.View>
        )}

        {/* ── Cifras ───────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).duration(360)} style={s.cifras}>
          <Cifra valor={minutosCorto(Math.round((sesion.duration_seconds ?? 0) / 60))} etiqueta="DURACIÓN" />
          <Cifra valor={String(sesion.total_sets)} etiqueta="SERIES" />
          <Cifra
            valor={Number(sesion.total_volume_kg) > 0 ? kilosCorto(Number(sesion.total_volume_kg)) : '—'}
            etiqueta="MOVIDOS"
          />
        </Animated.View>

        {(sesion.distance_m || sesion.calories_kcal || sesion.perceived_effort) && (
          <Animated.View entering={FadeInDown.delay(120).duration(360)} style={s.cifras}>
            {sesion.distance_m ? (
              <Cifra valor={`${(sesion.distance_m / 1000).toFixed(1).replace('.', ',')}`} sufijo=" km" etiqueta="DISTANCIA" />
            ) : null}
            {sesion.calories_kcal ? (
              <Cifra valor={String(sesion.calories_kcal)} sufijo=" kcal" etiqueta="GASTO" />
            ) : null}
            {sesion.perceived_effort ? (
              <Cifra valor={`${sesion.perceived_effort}/10`} etiqueta="ESFUERZO" />
            ) : null}
          </Animated.View>
        )}

        {/* Que la cifra de gasto DIGA que es una estimación.
            Sin pulsómetro no se mide, se calcula, y el margen es de un 20 % o
            más. Una cifra estimada presentada igual que una medida es la que
            luego alguien resta de su comida al gramo. */}
        {sesion.calories_kcal && sesion.metrics?.gasto?.origen === 'estimado' ? (
          <Text style={s.aviso}>
            Gasto estimado a partir del ejercicio, su duración y tu peso. Es una
            aproximación, no una medida.
          </Text>
        ) : null}

        {sesion.notes ? (
          <View style={s.notas}>
            <Text style={s.notasTxt}>{sesion.notes}</Text>
          </View>
        ) : null}

        {/* ── Ejercicios ───────────────────────────────────────────────── */}
        {huecos.length === 0 ? (
          <Vacio texto="Esta sesión no registró series. Fue de las que se miden por distancia o por tiempo." />
        ) : (
          huecos.map((h, i) => {
            const suyas = series.filter(x => x.order_index === h).sort((a, b) => a.set_index - b.set_index)
            const primera = suyas[0]
            const volumen = suyas.reduce(
              (a, x) => a + (x.kind !== 'warmup' && x.load_type === 'weight' && x.weight_kg && x.reps ? x.weight_kg * x.reps : 0), 0,
            )

            return (
              <Animated.View
                key={h}
                entering={FadeInDown.delay(Math.min(160 + i * 50, 480)).duration(340)}
                style={s.ejercicio}
              >
                <View style={s.ejercicioCabecera}>
                  <View style={[s.punto, { backgroundColor: COLOR_GRUPO[primera.muscle ?? ''] ?? Colors.neon.steel }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.ejercicioNombre} numberOfLines={1}>{primera.exercise_name}</Text>
                    <Text style={s.ejercicioSub}>
                      {NOMBRE_GRUPO[primera.muscle ?? ''] ?? 'Sin grupo'}
                      {volumen > 0 ? ` · ${kilosCorto(volumen)}` : ''}
                    </Text>
                  </View>
                  {primera.exercise_slug && (
                    <TouchableOpacity
                      onPress={() => router.push(`/workout/exercise/${primera.exercise_slug}`)}
                      hitSlop={8}
                    >
                      <Ionicons name="play-circle-outline" size={20} color={Colors.neon.w3} />
                    </TouchableOpacity>
                  )}
                </View>

                {suyas.map((x, j) => (
                  <View key={x.id} style={s.serie}>
                    <View style={[s.serieNum, x.kind === 'warmup' && s.serieNumCalent]}>
                      <Text style={s.serieNumTxt}>{x.kind === 'warmup' ? 'C' : j + 1}</Text>
                    </View>
                    <Text style={s.serieCarga}>
                      {x.load_type === 'weight' && x.weight_kg
                        ? `${x.weight_kg} kg × ${x.reps}`
                        : x.duration_seconds
                          ? `${x.duration_seconds} s`
                          : x.distance_m
                            ? `${x.distance_m} m`
                            : `${x.reps} reps`}
                    </Text>
                    {x.rir != null && <Text style={s.serieRir}>RIR {x.rir}</Text>}
                    {x.est_1rm ? <Text style={s.serieRm}>1RM ~{x.est_1rm}</Text> : null}
                  </View>
                ))}
              </Animated.View>
            )
          })
        )}
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  firma: {
    alignItems: 'center', gap: Spacing[3], padding: Spacing[4],
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 22,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  firmaPie: { fontSize: 11, color: Colors.neon.w3, textAlign: 'center', lineHeight: 16 },

  cifras: { flexDirection: 'row', gap: Spacing[2] },

  notas: {
    padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  notasTxt: { fontSize: Typography.fontSize.sm, color: Colors.neon.w2, lineHeight: 20 },

  aviso: {
    fontSize: Typography.fontSize.xs,
    color: Colors.neon.w3,
    lineHeight: 16,
    paddingHorizontal: Spacing[1],
  },

  ejercicio: {
    gap: Spacing[2], padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  ejercicioCabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  punto: { width: 9, height: 9, borderRadius: 5 },
  ejercicioNombre: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.white },
  ejercicioSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },

  serie: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: 5,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  serieNum: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  serieNumCalent: { backgroundColor: 'rgba(255,255,255,0.04)' },
  serieNumTxt: { fontSize: 10, fontWeight: '800', color: Colors.neon.w2 },
  serieCarga: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  serieRir: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3 },
  serieRm: { fontSize: 10, fontWeight: '700', color: Colors.neon.w2 },
})
