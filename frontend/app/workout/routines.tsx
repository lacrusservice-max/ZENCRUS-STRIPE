/**
 * RUTINAS
 * ───────
 * Sesiones guardadas para repetir. El PLAN, no lo realizado: lo realizado vive
 * en el historial y casi nunca coincide, que es lo interesante.
 *
 * ── Lo que cambió respecto a la versión anterior ────────────────────────────
 * · Los ejercicios se eligen del CATÁLOGO de 206, con su músculo, su material y
 *   su vídeo. Antes se elegían de una lista de doce nombres escritos a mano en
 *   el código, que no llevaban a ninguna ficha y envejecían solas.
 * · Sin emojis. El tipo de entrenamiento se dice con iconografía propia, que se
 *   tiñe con el tema y se ve igual en todos los teléfonos.
 * · Al guardar un ejercicio se guarda su SLUG, no solo su nombre. Es lo que
 *   hace que al entrenarlo las series entren en el historial de ese ejercicio
 *   y no en el de un nombre parecido.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Vacio } from '@/components/workout/Charts'
import { MaterialIcon } from '@/components/workout/Kit'
import { NOMBRE_GRUPO } from '@/components/workout/anatomy'
import { useWorkoutStore, Routine, Exercise } from '@/store/workoutStore'
import { listExercises, ExerciseCard, colorDe } from '@/services/exerciseService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

/**
 * Los tipos de entrenamiento.
 *
 * Cuatro, no diez. Los diez de antes —hyrox, crossfit, natación, artes
 * marciales…— no cambiaban NADA en la app: eran una etiqueta y un emoji. Estos
 * cuatro son los que de verdad cambian qué se te enseña al entrenar, y coinciden
 * con los cuatro modos de sesión, que es lo que evita tener dos taxonomías
 * distintas para la misma cosa.
 */
const TIPOS = [
  { id: 'gym', label: 'Gimnasio', icono: 'barbell' },
  { id: 'home', label: 'En casa', icono: 'bodyweight' },
  { id: 'outdoor', label: 'Aire libre', icono: 'kettlebell' },
  { id: 'class', label: 'Dirigido', icono: 'bench' },
] as const

// ── Buscador del catálogo ────────────────────────────────────────────────────

function Buscador({ visible, tipo, onElegir, onCerrar }: {
  visible: boolean
  tipo: string
  onElegir: (e: { slug?: string; nombre: string; muscle?: string | null }) => void
  onCerrar: () => void
}) {
  const [q, setQ] = useState('')
  const [lista, setLista] = useState<ExerciseCard[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!visible) return
    let vivo = true
    setCargando(true)
    // Se espera a que pare de teclear: sin esto se pide una vez por letra.
    const t = setTimeout(() => {
      listExercises({ q, place: tipo === 'home' ? 'home' : undefined, limit: 40 })
        .then(r => { if (vivo) setLista(r.exercises) })
        .catch(() => { if (vivo) setLista([]) })
        .finally(() => { if (vivo) setCargando(false) })
    }, 280)
    return () => { vivo = false; clearTimeout(t) }
  }, [q, visible, tipo])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
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
          contentContainerStyle={{ padding: Spacing[4], paddingBottom: 40 }}
          ListHeaderComponent={
            q.trim().length > 1 ? (
              <TouchableOpacity style={b.libre} onPress={() => { onElegir({ nombre: q.trim() }); setQ('') }} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={16} color={Colors.neon.red} />
                <Text style={b.libreTxt}>Usar «{q.trim()}» tal cual</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            !cargando ? <Text style={b.vacio}>Nada con ese nombre en la biblioteca.</Text> : null
          }
          renderItem={({ item: e }) => (
            <TouchableOpacity
              style={b.fila}
              onPress={() => { void Haptics.selectionAsync(); onElegir({ slug: e.slug, nombre: e.name, muscle: e.muscle }); setQ('') }}
              activeOpacity={0.85}
            >
              <View style={[b.punto, { backgroundColor: colorDe(e.muscle) }]} />
              <View style={{ flex: 1 }}>
                <Text style={b.filaNombre}>{e.name}</Text>
                <Text style={b.filaSub}>{e.muscleEs ?? '—'} · {e.equipmentEs}</Text>
              </View>
              <MaterialIcon id={e.equipment} size={18} color={Colors.neon.w3} />
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  )
}

// ── Editor ───────────────────────────────────────────────────────────────────

function Editor({ visible, inicial, onGuardar, onCerrar }: {
  visible: boolean
  inicial: Routine | null
  onGuardar: (r: Routine) => void
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<string>('gym')
  const [ejercicios, setEjercicios] = useState<Exercise[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (!visible) return
    setNombre(inicial?.name ?? '')
    setTipo(inicial?.trainingType ?? 'gym')
    setEjercicios(inicial?.exercises ?? [])
  }, [visible, inicial])

  const anadir = (e: { slug?: string; nombre: string; muscle?: string | null }) => {
    setEjercicios(prev => [...prev, {
      id: `${Date.now()}-${prev.length}`,
      slug: e.slug,
      muscle: e.muscle ?? undefined,
      name: e.nombre,
      sets: 3, reps: '8-12', weight: '', rest: 90,
    }])
    setBuscando(false)
  }

  const cambiar = (id: string, campo: keyof Exercise, valor: string) => {
    setEjercicios(prev => prev.map(x => x.id === id
      ? { ...x, [campo]: campo === 'sets' || campo === 'rest' ? (parseInt(valor) || 0) : valor }
      : x))
  }

  const guardar = () => {
    if (!nombre.trim()) { Alert.alert('Falta el nombre', 'Ponle un nombre a la rutina para reconocerla luego.'); return }
    if (ejercicios.length === 0) { Alert.alert('Sin ejercicios', 'Añade al menos uno.'); return }
    onGuardar({
      id: inicial?.id ?? Date.now().toString(),
      name: nombre.trim(),
      trainingType: tipo,
      exercises: ejercicios,
      estimatedMinutes: Math.max(15, ejercicios.reduce((a, e) => a + e.sets * ((e.rest + 45) / 60), 0)),
      createdAt: inicial?.createdAt ?? Date.now(),
    })
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={ed.wrap}>
          <View style={ed.cabecera}>
            <TouchableOpacity onPress={onCerrar} hitSlop={10}><Text style={ed.cancelar}>Cancelar</Text></TouchableOpacity>
            <Text style={ed.titulo}>{inicial ? 'Editar rutina' : 'Nueva rutina'}</Text>
            <TouchableOpacity onPress={guardar} hitSlop={10}><Text style={ed.guardar}>Guardar</Text></TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: Spacing[4], paddingBottom: 60, gap: Spacing[5] }}>
            <View style={{ gap: Spacing[2] }}>
              <Text style={ed.etiqueta}>NOMBRE</Text>
              <TextInput
                style={ed.input} value={nombre} onChangeText={setNombre}
                placeholder="Empuje A · Pecho y tríceps"
                placeholderTextColor={Colors.neon.w3}
              />
            </View>

            <View style={{ gap: Spacing[2] }}>
              <Text style={ed.etiqueta}>DÓNDE</Text>
              <View style={ed.tipos}>
                {TIPOS.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[ed.tipo, tipo === t.id && ed.tipoOn]}
                    onPress={() => { void Haptics.selectionAsync(); setTipo(t.id) }}
                    activeOpacity={0.85}
                  >
                    <MaterialIcon id={t.icono} size={20}
                      color={tipo === t.id ? Colors.neon.white : Colors.neon.w3} />
                    <Text style={[ed.tipoTxt, tipo === t.id && { color: Colors.neon.white }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ gap: Spacing[2] }}>
              <View style={ed.filaTitulo}>
                <Text style={ed.etiqueta}>EJERCICIOS ({ejercicios.length})</Text>
                <TouchableOpacity onPress={() => setBuscando(true)} hitSlop={8}>
                  <Text style={ed.anadir}>+ Añadir</Text>
                </TouchableOpacity>
              </View>

              {ejercicios.length === 0 ? (
                <TouchableOpacity onPress={() => setBuscando(true)} activeOpacity={0.85}>
                  <Vacio texto="Toca «Añadir» y busca en la biblioteca de 206 ejercicios." />
                </TouchableOpacity>
              ) : (
                ejercicios.map((e, i) => (
                  <View key={e.id} style={ed.ejercicio}>
                    <View style={ed.ejercicioCabecera}>
                      <Text style={ed.ejercicioNum}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ed.ejercicioNombre} numberOfLines={1}>{e.name}</Text>
                        {e.muscle ? <Text style={ed.ejercicioSub}>{NOMBRE_GRUPO[e.muscle] ?? e.muscle}</Text> : null}
                      </View>
                      <TouchableOpacity onPress={() => setEjercicios(p => p.filter(x => x.id !== e.id))} hitSlop={10}>
                        <Ionicons name="close" size={17} color={Colors.neon.w4} />
                      </TouchableOpacity>
                    </View>

                    <View style={ed.campos}>
                      <Campo label="Series" valor={String(e.sets)} onCambiar={v => cambiar(e.id, 'sets', v)} numerico />
                      <Campo label="Reps" valor={e.reps} onCambiar={v => cambiar(e.id, 'reps', v)} />
                      <Campo label="Descanso" valor={String(e.rest)} onCambiar={v => cambiar(e.id, 'rest', v)} numerico sufijo="s" />
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          <Buscador visible={buscando} tipo={tipo} onElegir={anadir} onCerrar={() => setBuscando(false)} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function Campo({ label, valor, onCambiar, numerico, sufijo }: {
  label: string; valor: string; onCambiar: (v: string) => void; numerico?: boolean; sufijo?: string
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={ed.campoLabel}>{label.toUpperCase()}</Text>
      <View style={ed.campoCaja}>
        <TextInput
          style={ed.campoInput} value={valor} onChangeText={onCambiar}
          keyboardType={numerico ? 'number-pad' : 'default'}
          selectTextOnFocus
        />
        {sufijo ? <Text style={ed.campoSufijo}>{sufijo}</Text> : null}
      </View>
    </View>
  )
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default function Rutinas() {
  const { routines, loadAll, saveRoutine, deleteRoutine } = useWorkoutStore()
  const [editor, setEditor] = useState(false)
  const [editando, setEditando] = useState<Routine | null>(null)

  useEffect(() => { void loadAll() }, [loadAll])

  const guardar = useCallback(async (r: Routine) => {
    await saveRoutine(r)
    setEditor(false)
    setEditando(null)
  }, [saveRoutine])

  const borrar = (r: Routine) => {
    Alert.alert('¿Borrar la rutina?', `«${r.name}» se borra del teléfono. Los entrenamientos que hiciste con ella se quedan en tu historial.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => void deleteRoutine(r.id) },
    ])
  }

  return (
    <Screen>
      <CabeceraSeccion
        titulo="Mis rutinas"
        subtitulo={routines.length > 0 ? `${routines.length} guardadas` : 'Sesiones que repites'}
        derecha={
          <TouchableOpacity
            style={s.nueva}
            onPress={() => { setEditando(null); setEditor(true) }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing[4], paddingBottom: 110, gap: Spacing[3] }}
      >
        {routines.length === 0 ? (
          <Vacio texto="Sin rutinas todavía. Una rutina es una sesión que repites: la guardas una vez y la empiezas de un toque. No hace falta para entrenar — también puedes ir sobre la marcha." />
        ) : (
          routines.map((r, i) => (
            <Animated.View key={r.id} entering={FadeInDown.delay(i * 50).duration(340)}>
              <View style={s.tarjeta}>
                <View style={s.tarjetaCabecera}>
                  <MaterialIcon
                    id={TIPOS.find(t => t.id === r.trainingType)?.icono ?? 'barbell'}
                    size={20} color={Colors.neon.w2}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.nombre} numberOfLines={1}>{r.name}</Text>
                    <Text style={s.sub}>
                      {r.exercises.length} ejercicios · ~{Math.round(r.estimatedMinutes)} min
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => { setEditando(r); setEditor(true) }} hitSlop={8} style={{ padding: 4 }}>
                    <Ionicons name="create-outline" size={18} color={Colors.neon.w3} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => borrar(r)} hitSlop={8} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={17} color={Colors.neon.w4} />
                  </TouchableOpacity>
                </View>

                <View style={s.lista}>
                  {r.exercises.slice(0, 4).map(e => (
                    <Text key={e.id} style={s.listaItem} numberOfLines={1}>
                      · {e.name} — {e.sets}×{e.reps}
                    </Text>
                  ))}
                  {r.exercises.length > 4 && (
                    <Text style={s.listaMas}>y {r.exercises.length - 4} más</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={s.empezar}
                  onPress={() => router.push(`/workout/active?routineId=${r.id}&mode=${r.trainingType === 'home' ? 'home' : 'gym'}`)}
                  activeOpacity={0.88}
                >
                  <Ionicons name="play" size={15} color="#fff" />
                  <Text style={s.empezarTxt}>Empezar</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>

      <Editor
        visible={editor}
        inicial={editando}
        onGuardar={guardar}
        onCerrar={() => { setEditor(false); setEditando(null) }}
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  nueva: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neon.red,
  },
  tarjeta: {
    gap: Spacing[3], padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  tarjetaCabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  nombre: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  sub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  lista: { gap: 2 },
  listaItem: { fontSize: 12, color: Colors.neon.w2 },
  listaMas: { fontSize: 11, color: Colors.neon.w3, fontStyle: 'italic' },
  empezar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.neon.red,
  },
  empezarTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
})

const ed = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.neon.void },
  cabecera: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing[4], borderBottomWidth: 1, borderBottomColor: Colors.neon.edge,
  },
  cancelar: { fontSize: Typography.fontSize.sm, color: Colors.neon.w3 },
  titulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  guardar: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.red },

  etiqueta: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 1.3 },
  input: {
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    padding: Spacing[3],
    fontSize: Typography.fontSize.base, color: Colors.neon.white,
  },
  tipos: { flexDirection: 'row', gap: Spacing[2] },
  tipo: {
    flex: 1, alignItems: 'center', gap: 5, paddingVertical: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  tipoOn: { borderColor: 'rgba(255,31,61,0.45)', backgroundColor: Colors.neon.redDim },
  tipoTxt: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3 },

  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  anadir: { fontSize: 12, fontWeight: '800', color: Colors.neon.red },

  ejercicio: {
    gap: Spacing[3], padding: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  ejercicioCabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  ejercicioNum: {
    width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22,
    fontSize: 11, fontWeight: '800', color: Colors.neon.w2,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  ejercicioNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  ejercicioSub: { fontSize: 10, color: Colors.neon.w3, marginTop: 1 },
  campos: { flexDirection: 'row', gap: Spacing[2] },
  campoLabel: { fontSize: 9, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 1 },
  campoCaja: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[2],
  },
  campoInput: {
    flex: 1, paddingVertical: 8, textAlign: 'center',
    fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.neon.white,
  },
  campoSufijo: { fontSize: 11, color: Colors.neon.w3, fontWeight: '700' },
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
  libre: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    padding: Spacing[3], marginBottom: Spacing[3],
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.3)',
    borderRadius: BorderRadius.md,
  },
  libreTxt: { fontSize: Typography.fontSize.sm, color: Colors.neon.redCore, fontWeight: '700' },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[3],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  filaNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  vacio: { fontSize: Typography.fontSize.sm, color: Colors.neon.w3, textAlign: 'center', marginTop: Spacing[6] },
})
