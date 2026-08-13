/**
 * MONTA TU PLAN
 * ─────────────
 * Crear un plan propio: cuántas semanas, qué días y qué ejercicios en cada uno.
 *
 * ── Es un PROGRAMA, no una cosa nueva ───────────────────────────────────────
 * Se guarda en la misma tabla que los de ZENCRUS, solo que con dueño. Por eso
 * hereda todo sin escribir nada: la línea de tiempo, el peso que se calcula
 * desde tus marcas, la descarga cada N semanas, el avance al terminar un día y
 * el cambio de ejercicio. Un «planificador semanal» aparte habría sido un
 * segundo sistema para decir lo mismo, y dos sistemas acaban discrepando.
 *
 * ── Un patrón de semana, repetido ───────────────────────────────────────────
 * No se piden doce semanas distintas: se pide UNA y se repite las que digas. Es
 * lo que hace casi todo el mundo, y lo que cambia de una semana a la siguiente
 * no son los ejercicios, es el peso — y de eso ya se encarga la progresión.
 *
 * ── El día se define por lo que se ENTRENA, no por el día de la semana ──────
 * «Día 1, Día 2» y no «lunes, martes». El programa avanza cuando entrenas, no
 * cuando pasa el calendario: si el martes surge algo, el día 2 te espera al
 * miércoles en vez de quedar marcado como fallado.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Vacio } from '@/components/workout/Charts'
import { Miniatura } from '@/components/workout/Miniatura'
import { MaterialIcon } from '@/components/workout/Kit'
import { NOMBRE_GRUPO } from '@/components/workout/anatomy'
import { listExercises, ExerciseCard } from '@/services/exerciseService'
import {
  guardarPlan, inscribirse, getPrograma,
  EjercicioPlan, PlanPropio, Objetivo,
} from '@/services/programService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

/** Duraciones que se ofrecen. Ni un campo libre ni veinte opciones. */
const SEMANAS = [4, 6, 8, 12]

const SITIOS = [
  { id: 'gym' as const, label: 'Gimnasio', icono: 'barbell' },
  { id: 'home' as const, label: 'En casa', icono: 'bodyweight' },
]

const OBJETIVOS: { id: Objetivo; label: string }[] = [
  { id: 'strength', label: 'Fuerza' },
  { id: 'hypertrophy', label: 'Músculo' },
  { id: 'general', label: 'General' },
]

interface DiaBorrador {
  dia: number
  nombre: string
  foco?: string
  ejercicios: (EjercicioPlan & { poster?: string | null })[]
}

export default function MontarPlan() {
  const { id } = useLocalSearchParams<{ id?: string }>()

  const [nombre, setNombre] = useState('')
  const [semanas, setSemanas] = useState(8)
  const [sitio, setSitio] = useState<'gym' | 'home'>('gym')
  const [objetivo, setObjetivo] = useState<Objetivo>('hypertrophy')
  const [descarga, setDescarga] = useState<number | null>(4)
  const [dias, setDias] = useState<DiaBorrador[]>([
    { dia: 1, nombre: 'Día 1', ejercicios: [] },
  ])
  const [buscandoEn, setBuscandoEn] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(!!id)

  // Editar uno existente: se trae y se vuelca en el borrador.
  useEffect(() => {
    if (!id) return
    let vivo = true
    getPrograma(id)
      .then(p => {
        if (!vivo) return
        setNombre(p.name)
        setSemanas(p.weeks)
        setSitio(p.mode === 'home' ? 'home' : 'gym')
        setObjetivo(p.goal)
        setDescarga(p.deload_every)
        setDias(p.plan.dias.map(d => ({
          ...d,
          ejercicios: d.ejercicios.map(e => ({
            ...e,
            poster: e.slug ? p.posters[e.slug] ?? null : null,
          })),
        })))
      })
      .catch(() => Alert.alert('No se pudo cargar', 'Ese plan no está disponible.'))
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [id])

  const anadirDia = () => {
    if (dias.length >= 7) return
    void Haptics.selectionAsync()
    setDias(d => [...d, { dia: d.length + 1, nombre: `Día ${d.length + 1}`, ejercicios: [] }])
  }

  const quitarDia = (dia: number) => {
    // Se renumeran al vuelo: el motor recorre los días de uno en uno y un hueco
    // lo dejaría esperando un día que ya no existe.
    setDias(d => d.filter(x => x.dia !== dia).map((x, i) => ({ ...x, dia: i + 1 })))
  }

  const anadirEjercicio = (dia: number, e: ExerciseCard) => {
    setDias(ds => ds.map(d => d.dia !== dia ? d : {
      ...d,
      // El foco del día lo pone el PRIMER ejercicio: es el que decide de qué va.
      foco: d.foco ?? e.muscle ?? undefined,
      ejercicios: [...d.ejercicios, {
        slug: e.slug,
        nombre: e.name,
        series: 3,
        reps: '8-12',
        descanso: 90,
        progresion: e.equipment === 'bodyweight' ? 'fija' : 'doble',
        incremento: e.equipment === 'barbell' ? 2.5 : 2,
        carga: e.equipment === 'bodyweight' ? 'bodyweight' : e.equipment === 'band' ? 'band' : 'weight',
        poster: e.poster,
      }],
    }))
    setBuscandoEn(null)
  }

  const cambiarCampo = (dia: number, i: number, campo: 'series' | 'reps' | 'descanso', v: string) => {
    setDias(ds => ds.map(d => d.dia !== dia ? d : {
      ...d,
      ejercicios: d.ejercicios.map((e, j) => j !== i ? e : {
        ...e,
        [campo]: campo === 'reps' ? v : (parseInt(v) || 0),
      }),
    }))
  }

  const guardar = async () => {
    if (!nombre.trim()) {
      Alert.alert('Falta el nombre', 'Ponle un nombre para reconocerlo luego.'); return
    }
    const vacios = dias.filter(d => d.ejercicios.length === 0)
    if (vacios.length > 0) {
      Alert.alert(
        'Hay días sin ejercicios',
        `${vacios.map(d => d.nombre).join(', ')} ${vacios.length === 1 ? 'está vacío' : 'están vacíos'}. Añádeles algo o quítalos.`,
      )
      return
    }

    setGuardando(true)
    try {
      const cuerpo: PlanPropio = {
        name: nombre.trim(),
        weeks: semanas,
        goal: objetivo,
        level: 'intermediate',
        mode: sitio,
        deloadEvery: descarga,
        dias: dias.map(d => ({
          dia: d.dia,
          nombre: d.nombre.trim() || `Día ${d.dia}`,
          foco: d.foco,
          // El póster NO se guarda: son direcciones firmadas que caducan en una
          // hora y guardarlas sería guardar imágenes rotas.
          ejercicios: d.ejercicios.map(({ poster, ...e }) => e),
        })),
      }

      const p = await guardarPlan(cuerpo, id)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      if (id) {
        router.back()
        return
      }

      Alert.alert(
        'Plan creado',
        '¿Quieres empezarlo ahora? Si ya sigues otro, se dejará a medias.',
        [
          { text: 'Ahora no', onPress: () => router.replace('/workout/programs') },
          {
            text: 'Empezar',
            onPress: async () => {
              try {
                await inscribirse(p.id)
                router.replace('/workout/program/plan')
              } catch {
                router.replace('/workout/programs')
              }
            },
          },
        ],
      )
    } catch {
      Alert.alert('No se pudo guardar', 'Inténtalo otra vez en un momento.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <Screen>
        <CabeceraSeccion titulo="Tu plan" />
        <View style={{ paddingVertical: Spacing[8], alignItems: 'center' }}>
          <ActivityIndicator color={Colors.neon.red} />
        </View>
      </Screen>
    )
  }

  const totalEjercicios = dias.reduce((a, d) => a + d.ejercicios.length, 0)

  return (
    <Screen>
      <CabeceraSeccion
        titulo={id ? 'Editar plan' : 'Monta tu plan'}
        subtitulo={`${dias.length} ${dias.length === 1 ? 'día' : 'días'} · ${semanas} semanas · ${totalEjercicios} ejercicios`}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Spacing[4], paddingBottom: 140, gap: Spacing[5] }}
        >
          {/* ── 1 · Cómo se llama ──────────────────────────────────────── */}
          <View style={{ gap: Spacing[2] }}>
            <Text style={s.etiqueta}>CÓMO SE LLAMA</Text>
            <TextInput
              style={s.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Mi plan de fuerza"
              placeholderTextColor={Colors.neon.w3}
            />
          </View>

          {/* ── 2 · Cuánto dura ────────────────────────────────────────── */}
          <View style={{ gap: Spacing[2] }}>
            <Text style={s.etiqueta}>CUÁNTO DURA</Text>
            <View style={s.fila}>
              {SEMANAS.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.pastilla, semanas === n && s.pastillaOn]}
                  onPress={() => { void Haptics.selectionAsync(); setSemanas(n) }}
                  activeOpacity={0.85}
                >
                  <Text style={[s.pastillaNum, semanas === n && { color: Colors.neon.white }]}>{n}</Text>
                  <Text style={s.pastillaTxt}>semanas</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── 3 · Dónde y para qué ───────────────────────────────────── */}
          <View style={{ gap: Spacing[2] }}>
            <Text style={s.etiqueta}>DÓNDE ENTRENAS</Text>
            <View style={s.fila}>
              {SITIOS.map(x => (
                <TouchableOpacity
                  key={x.id}
                  style={[s.pastilla, sitio === x.id && s.pastillaOn]}
                  onPress={() => { void Haptics.selectionAsync(); setSitio(x.id) }}
                  activeOpacity={0.85}
                >
                  <MaterialIcon id={x.icono} size={19} color={sitio === x.id ? Colors.neon.white : Colors.neon.w3} />
                  <Text style={[s.pastillaTxt, sitio === x.id && { color: Colors.neon.white }]}>{x.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ gap: Spacing[2] }}>
            <Text style={s.etiqueta}>QUÉ BUSCAS</Text>
            <View style={s.fila}>
              {OBJETIVOS.map(x => (
                <TouchableOpacity
                  key={x.id}
                  style={[s.pastilla, objetivo === x.id && s.pastillaOn]}
                  onPress={() => { void Haptics.selectionAsync(); setObjetivo(x.id) }}
                  activeOpacity={0.85}
                >
                  <Text style={[s.pastillaTxt, objetivo === x.id && { color: Colors.neon.white }]}>{x.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── 4 · Descarga ───────────────────────────────────────────── */}
          <TouchableOpacity
            style={s.descarga}
            onPress={() => { void Haptics.selectionAsync(); setDescarga(d => d ? null : 4) }}
            activeOpacity={0.85}
          >
            <Ionicons
              name={descarga ? 'checkbox' : 'square-outline'}
              size={21}
              color={descarga ? Colors.neon.red : Colors.neon.w3}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.descargaTitulo}>Bajar la carga cada 4 semanas</Text>
              <Text style={s.descargaSub}>
                Una semana más suave: menos series y algo menos de peso. Es cuando
                el cuerpo termina de construir lo de las semanas anteriores.
              </Text>
            </View>
          </TouchableOpacity>

          {/* ── 5 · Los días ───────────────────────────────────────────── */}
          <View style={{ gap: Spacing[3] }}>
            <View style={s.seccionFila}>
              <Text style={s.etiqueta}>TUS DÍAS</Text>
              {dias.length < 7 && (
                <TouchableOpacity onPress={anadirDia} hitSlop={8}>
                  <Text style={s.enlace}>+ Añadir día</Text>
                </TouchableOpacity>
              )}
            </View>

            {dias.map((d, di) => (
              <Animated.View key={d.dia} entering={FadeInDown.delay(Math.min(di * 50, 250)).duration(300)}>
                <View style={s.dia}>
                  <View style={s.diaCabecera}>
                    <View style={s.diaNum}><Text style={s.diaNumTxt}>{d.dia}</Text></View>
                    <TextInput
                      style={s.diaNombre}
                      value={d.nombre}
                      onChangeText={v => setDias(ds => ds.map(x => x.dia === d.dia ? { ...x, nombre: v } : x))}
                      placeholder={`Día ${d.dia}`}
                      placeholderTextColor={Colors.neon.w3}
                    />
                    {d.foco ? (
                      <Text style={s.diaFoco}>{NOMBRE_GRUPO[d.foco] ?? d.foco}</Text>
                    ) : null}
                    {dias.length > 1 && (
                      <TouchableOpacity onPress={() => quitarDia(d.dia)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={17} color={Colors.neon.w4} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {d.ejercicios.map((e, i) => (
                    <View key={`${e.slug ?? e.nombre}-${i}`} style={s.ejercicio}>
                      <Miniatura poster={e.poster} tam={40} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={s.ejercicioTitulo}>
                          <Text style={s.ejercicioNombre} numberOfLines={1}>{e.nombre}</Text>
                          <TouchableOpacity
                            onPress={() => setDias(ds => ds.map(x => x.dia !== d.dia ? x : {
                              ...x, ejercicios: x.ejercicios.filter((_, j) => j !== i),
                            }))}
                            hitSlop={8}
                          >
                            <Ionicons name="close" size={16} color={Colors.neon.w4} />
                          </TouchableOpacity>
                        </View>
                        <View style={s.campos}>
                          <Campo label="Series" valor={String(e.series)} onCambiar={v => cambiarCampo(d.dia, i, 'series', v)} numerico />
                          <Campo label="Reps" valor={e.reps ?? ''} onCambiar={v => cambiarCampo(d.dia, i, 'reps', v)} />
                          <Campo label="Descanso" valor={String(e.descanso)} onCambiar={v => cambiarCampo(d.dia, i, 'descanso', v)} numerico sufijo="s" />
                        </View>
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={s.anadirEj}
                    onPress={() => setBuscandoEn(d.dia)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add" size={17} color={Colors.neon.redCore} />
                    <Text style={s.anadirEjTxt}>
                      {d.ejercicios.length === 0 ? 'Añadir el primer ejercicio' : 'Añadir otro'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))}
          </View>

          <Text style={s.pie}>
            Los pesos no se ponen aquí: los calcula la app desde lo que ya has
            levantado, y sube solo cuando completas el rango. La primera semana los
            eliges tú.
          </Text>
        </ScrollView>

        <View style={s.pieFijo}>
          <TouchableOpacity style={s.guardar} onPress={guardar} activeOpacity={0.88} disabled={guardando}>
            {guardando
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={s.guardarTxt}>{id ? 'Guardar cambios' : 'Crear mi plan'}</Text>
                </>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Buscador
        visible={buscandoEn !== null}
        sitio={sitio}
        onElegir={e => buscandoEn !== null && anadirEjercicio(buscandoEn, e)}
        onCerrar={() => setBuscandoEn(null)}
      />
    </Screen>
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Campo({ label, valor, onCambiar, numerico, sufijo }: {
  label: string; valor: string; onCambiar: (v: string) => void; numerico?: boolean; sufijo?: string
}) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={s.campoLabel}>{label.toUpperCase()}</Text>
      <View style={s.campoCaja}>
        <TextInput
          style={s.campoInput}
          value={valor}
          onChangeText={onCambiar}
          keyboardType={numerico ? 'number-pad' : 'default'}
          selectTextOnFocus
        />
        {sufijo ? <Text style={s.campoSufijo}>{sufijo}</Text> : null}
      </View>
    </View>
  )
}

function Buscador({ visible, sitio, onElegir, onCerrar }: {
  visible: boolean
  sitio: 'gym' | 'home'
  onElegir: (e: ExerciseCard) => void
  onCerrar: () => void
}) {
  const [q, setQ] = useState('')
  const [lista, setLista] = useState<ExerciseCard[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!visible) return
    let vivo = true
    setCargando(true)
    const t = setTimeout(() => {
      listExercises({ q, place: sitio === 'home' ? 'home' : undefined, limit: 40 })
        .then(r => { if (vivo) setLista(r.exercises) })
        .catch(() => { if (vivo) setLista([]) })
        .finally(() => { if (vivo) setCargando(false) })
    }, 280)
    return () => { vivo = false; clearTimeout(t) }
  }, [q, visible, sitio])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <SafeAreaProvider>
        <SafeAreaView style={b.wrap}>
          <View style={b.cabecera}>
            <Text style={b.titulo}>Añadir ejercicio</Text>
            <TouchableOpacity onPress={onCerrar} hitSlop={10}>
              <Ionicons name="close" size={22} color={Colors.neon.w2} />
            </TouchableOpacity>
          </View>

          <View style={b.buscador}>
            <Ionicons name="search" size={16} color={Colors.neon.w3} />
            <TextInput
              style={b.input} value={q} onChangeText={setQ}
              placeholder="Buscar en los 206 ejercicios…"
              placeholderTextColor={Colors.neon.w3} autoCorrect={false}
            />
            {cargando && <ActivityIndicator size="small" color={Colors.neon.w3} />}
          </View>

          <FlatList
            data={lista}
            keyExtractor={e => e.slug}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: Spacing[4], paddingBottom: 40, gap: Spacing[2] }}
            ListEmptyComponent={!cargando ? <Vacio texto="Nada con ese nombre en la biblioteca." /> : null}
            renderItem={({ item: e }) => (
              <TouchableOpacity
                style={b.fila}
                onPress={() => { void Haptics.selectionAsync(); onElegir(e); setQ('') }}
                activeOpacity={0.85}
              >
                <Miniatura poster={e.poster} tam={44} />
                <View style={{ flex: 1 }}>
                  <Text style={b.filaNombre} numberOfLines={2}>{e.name}</Text>
                  <Text style={b.filaSub}>{e.muscleEs ?? '—'} · {e.equipmentEs}</Text>
                </View>
                <Ionicons name="add-circle-outline" size={20} color={Colors.neon.w3} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const s = StyleSheet.create({
  etiqueta: { fontSize: 10, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.4 },
  enlace: { fontSize: 12, fontWeight: '800', color: Colors.neon.red },
  seccionFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  input: {
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    padding: Spacing[3],
    fontSize: Typography.fontSize.base, color: Colors.neon.white,
  },

  fila: { flexDirection: 'row', gap: Spacing[2] },
  pastilla: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing[3],
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  pastillaOn: { borderColor: 'rgba(255,31,61,0.5)', backgroundColor: Colors.neon.redDim },
  pastillaNum: { fontSize: 22, fontWeight: '800', color: Colors.neon.w2, letterSpacing: -0.8 },
  pastillaTxt: { fontSize: 10.5, fontWeight: '700', color: Colors.neon.w3 },

  descarga: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  descargaTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.white },
  descargaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 3, lineHeight: 16 },

  dia: {
    gap: Spacing[3], padding: Spacing[3] + 2,
    backgroundColor: Colors.neon.pane,
    borderRadius: 18,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  diaCabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  diaNum: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  diaNumTxt: { fontSize: 12, fontWeight: '800', color: Colors.neon.w2 },
  diaNombre: {
    flex: 1, fontSize: Typography.fontSize.base, fontWeight: '800',
    color: Colors.neon.white, paddingVertical: 2,
  },
  diaFoco: { fontSize: 10, color: Colors.neon.w3 },

  ejercicio: {
    flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start',
    paddingTop: Spacing[3],
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.055)',
  },
  ejercicioTitulo: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  ejercicioNombre: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.neon.white },
  campos: { flexDirection: 'row', gap: Spacing[2] },
  campoLabel: { fontSize: 8.5, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 0.9 },
  campoCaja: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[2],
  },
  campoInput: {
    flex: 1, paddingVertical: 6, textAlign: 'center',
    fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white,
  },
  campoSufijo: { fontSize: 10, color: Colors.neon.w3, fontWeight: '700' },

  anadirEj: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.3)',
    backgroundColor: Colors.neon.redDim,
  },
  anadirEjTxt: { fontSize: 12, fontWeight: '800', color: Colors.neon.redCore },

  pie: { fontSize: 11, color: Colors.neon.w3, lineHeight: 16 },

  pieFijo: {
    padding: Spacing[4], paddingBottom: Spacing[6],
    backgroundColor: 'rgba(5,5,6,0.96)',
    borderTopWidth: 1, borderTopColor: Colors.neon.edge,
  },
  guardar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2],
    backgroundColor: Colors.neon.red,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[4],
  },
  guardarTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})

const b = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.neon.void },
  cabecera: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing[4], borderBottomWidth: 1, borderBottomColor: Colors.neon.edge,
  },
  titulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    margin: Spacing[4], paddingHorizontal: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  input: { flex: 1, paddingVertical: Spacing[3], fontSize: Typography.fontSize.base, color: Colors.neon.white },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  filaNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
})
