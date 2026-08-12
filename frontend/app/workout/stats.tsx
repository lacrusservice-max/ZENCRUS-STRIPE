/**
 * PROGRESO
 * ────────
 * Si se está mejorando o solo yendo al gimnasio. Son cosas distintas y esta es
 * la pantalla que las separa.
 *
 * ── Tres preguntas, tres bloques ────────────────────────────────────────────
 * · ¿Estoy haciendo MÁS que antes?      → volumen y series por semana
 * · ¿Estoy más FUERTE?                  → la curva de 1RM de cada ejercicio
 * · ¿En qué me estoy apoyando?          → los ejercicios por trabajo hecho
 *
 * Volumen y fuerza no son lo mismo y por eso no comparten gráfica: se puede
 * subir el volumen sin ganar un kilo de fuerza —haciendo más series flojas— y
 * se puede ganar fuerza bajando el volumen. Juntarlas escondería justo eso.
 */

import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { MenuSeccion, CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Barras, Curva, Cifra, Vacio } from '@/components/workout/Charts'
import { NOMBRE_GRUPO } from '@/components/workout/anatomy'
import {
  getVolumen, getEjercicios, getCurva, getResumen,
  Semana, EjercicioHecho, Curva as CurvaDatos, Resumen,
  kilosCorto, minutosCorto, desdeCuando,
} from '@/services/statsService'
import { COLOR_GRUPO } from '@/services/exerciseService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

/** «12 ago» — corto, que es lo que cabe bajo una gráfica. */
const diaCorto = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

export default function Progreso() {
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [semanas, setSemanas] = useState<Semana[]>([])
  const [ejercicios, setEjercicios] = useState<EjercicioHecho[]>([])
  const [curva, setCurva] = useState<CurvaDatos | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)
  const [metrica, setMetrica] = useState<'volumen' | 'series' | 'minutos'>('volumen')
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [r, v, e] = await Promise.all([
        getResumen(90).catch(() => null),
        getVolumen(84).catch(() => null),
        getEjercicios(90).catch(() => null),
      ])
      setResumen(r)
      setSemanas(v?.semanas ?? [])
      const lista = e?.ejercicios ?? []
      setEjercicios(lista)

      // Se abre con el ejercicio MÁS HECHO ya cargado en vez de con un selector
      // vacío: una pantalla de progreso que empieza sin ninguna curva parece
      // que no tiene datos aunque los tenga todos.
      const primero = lista.find(x => x.mejor1RM > 0) ?? lista[0]
      if (primero) {
        setElegido(primero.exerciseKey)
        setCurva(await getCurva(primero.exerciseKey).catch(() => null))
      }
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void cargar() }, [cargar]))

  const verCurva = async (key: string) => {
    void Haptics.selectionAsync()
    setElegido(key)
    setCurva(null)
    setCurva(await getCurva(key).catch(() => null))
  }

  const valorSemana = (s: Semana) =>
    metrica === 'volumen' ? s.volumen : metrica === 'series' ? s.series : s.minutos

  const barras = semanas.map((s, i) => ({
    etiqueta: diaCorto(s.lunes),
    valor: valorSemana(s),
    enCurso: i === semanas.length - 1,
  }))

  const conDatos = semanas.some(s => s.sesiones > 0)

  return (
    <Screen>
      <CabeceraSeccion titulo="Progreso" subtitulo="Últimas 12 semanas" />
      <MenuSeccion activo="progreso" />

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
        ) : !conDatos ? (
          <Vacio texto="Todavía no hay entrenamientos que comparar. Con dos semanas registradas esta pantalla empieza a tener sentido." />
        ) : (
          <>
            {/* ── Cifras de la ventana ─────────────────────────────────── */}
            <Animated.View entering={FadeInDown.duration(360)} style={s.cifras}>
              <Cifra valor={String(resumen?.sesiones ?? 0)} etiqueta="SESIONES" />
              <Cifra valor={kilosCorto(semanas.reduce((a, x) => a + x.volumen, 0))} etiqueta="MOVIDOS" />
              <Cifra valor={minutosCorto(semanas.reduce((a, x) => a + x.minutos, 0))} etiqueta="EN TOTAL" />
            </Animated.View>

            {/* ── Por semana ───────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(60).duration(360)} style={s.tarjeta}>
              <View style={s.tituloFila}>
                <Text style={s.tarjetaTitulo}>Por semana</Text>
                <View style={s.selector}>
                  {([
                    { id: 'volumen' as const, label: 'Kilos' },
                    { id: 'series' as const, label: 'Series' },
                    { id: 'minutos' as const, label: 'Tiempo' },
                  ]).map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.selectorChip, metrica === m.id && s.selectorChipOn]}
                      onPress={() => { void Haptics.selectionAsync(); setMetrica(m.id) }}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.selectorTxt, metrica === m.id && s.selectorTxtOn]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Barras datos={barras} />

              <Text style={s.nota}>
                La última barra es la semana en curso y va a medias a propósito:
                todavía le quedan días.
              </Text>
            </Animated.View>

            {/* ── Fuerza ───────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(120).duration(360)} style={s.tarjeta}>
              <Text style={s.tarjetaTitulo}>Fuerza por ejercicio</Text>

              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={s.tiraScroll} contentContainerStyle={s.tira}
              >
                {ejercicios.slice(0, 12).map(e => (
                  <TouchableOpacity
                    key={e.exerciseKey}
                    style={[s.tiraChip, elegido === e.exerciseKey && s.tiraChipOn]}
                    onPress={() => void verCurva(e.exerciseKey)}
                    activeOpacity={0.85}
                  >
                    <View style={[s.tiraPunto, { backgroundColor: COLOR_GRUPO[e.muscle ?? ''] ?? Colors.neon.steel }]} />
                    <Text style={[s.tiraTxt, elegido === e.exerciseKey && s.tiraTxtOn]} numberOfLines={1}>
                      {e.exerciseName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {curva === null ? (
                <View style={s.cargandoCurva}><ActivityIndicator size="small" color={Colors.neon.w3} /></View>
              ) : curva.puntos.length === 0 ? (
                <Vacio
                  texto={`De ${curva.exerciseName} hay ${curva.totalSeries} series y ${kilosCorto(curva.volumenTotal)} movidos, pero sin 1RM estimable: se hace sin kilos o a repeticiones altas. Su progreso se mide en volumen, no en fuerza máxima.`}
                />
              ) : (
                <>
                  <Text style={s.curvaNombre}>{curva.exerciseName}</Text>
                  <Curva
                    puntos={curva.puntos.map(p => ({ x: diaCorto(p.dia), y: p.est1RM }))}
                    unidad="kg"
                  />
                  <Text style={s.nota}>
                    1RM estimado con la fórmula de Epley sobre la mejor serie de cada día.
                    No hace falta fallar un máximo para saber que has subido.
                  </Text>
                </>
              )}
            </Animated.View>

            {/* ── En qué te apoyas ─────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(180).duration(360)} style={s.tarjeta}>
              <Text style={s.tarjetaTitulo}>Lo que más haces</Text>
              {ejercicios.slice(0, 10).map(e => (
                <TouchableOpacity
                  key={e.exerciseKey}
                  style={s.fila}
                  onPress={() => void verCurva(e.exerciseKey)}
                  activeOpacity={0.8}
                >
                  <View style={[s.filaPunto, { backgroundColor: COLOR_GRUPO[e.muscle ?? ''] ?? Colors.neon.steel }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.filaNombre} numberOfLines={1}>{e.exerciseName}</Text>
                    <Text style={s.filaSub}>
                      {NOMBRE_GRUPO[e.muscle ?? ''] ?? 'Sin grupo'} · {desdeCuando(e.ultimaVez)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.filaSeries}>{e.series} series</Text>
                    {e.mejor1RM > 0 && <Text style={s.filaRM}>1RM {e.mejor1RM}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </Animated.View>

            <TouchableOpacity
              style={s.acceso}
              onPress={() => router.push('/workout/history')}
              activeOpacity={0.85}
            >
              <Text style={s.accesoTxt}>Ver el historial completo</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },
  cargandoCurva: { paddingVertical: Spacing[6], alignItems: 'center' },
  cifras: { flexDirection: 'row', gap: Spacing[2] },

  tarjeta: {
    gap: Spacing[3], padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 22,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  tituloFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Spacing[2] },
  tarjetaTitulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  nota: { fontSize: 11, color: Colors.neon.w3, lineHeight: 16 },

  selector: { flexDirection: 'row', gap: 3, padding: 2, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: BorderRadius.full },
  selectorChip: { paddingHorizontal: Spacing[3], paddingVertical: 5, borderRadius: BorderRadius.full },
  selectorChipOn: { backgroundColor: Colors.neon.paneHi },
  selectorTxt: { fontSize: 11, fontWeight: '700', color: Colors.neon.w3 },
  selectorTxtOn: { color: Colors.neon.white },

  tiraScroll: { flexGrow: 0 },
  tira: { flexDirection: 'row', gap: Spacing[2], alignItems: 'center' },
  tiraChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 160,
    paddingHorizontal: Spacing[3], paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  tiraChipOn: { borderColor: 'rgba(255,31,61,0.45)', backgroundColor: Colors.neon.redDim },
  tiraPunto: { width: 7, height: 7, borderRadius: 4 },
  tiraTxt: { fontSize: 11, fontWeight: '700', color: Colors.neon.w3 },
  tiraTxtOn: { color: Colors.neon.white },

  curvaNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.w2 },

  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[3],
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.055)',
  },
  filaPunto: { width: 9, height: 9, borderRadius: 5 },
  filaNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  filaSeries: { fontSize: 12, fontWeight: '700', color: Colors.neon.w2 },
  filaRM: { fontSize: 10, color: Colors.neon.w3, marginTop: 1 },

  acceso: { alignItems: 'center', paddingVertical: Spacing[4] },
  accesoTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.red },
})
