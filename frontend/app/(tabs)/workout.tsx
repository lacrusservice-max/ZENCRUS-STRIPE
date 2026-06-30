import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform,
  FlatList,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useWorkoutStore, Exercise, Routine } from '@/store/workoutStore'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'

const FITNESS_TOOLS = [
  { icon: 'body-outline' as const,          label: 'Medidas',       sub: 'Cuerpo completo', route: '/measurements' },
  { icon: 'sync-outline' as const,          label: 'Ciclo macro',   sub: 'Periodización',   route: '/macro-cycling' },
  { icon: 'heart-outline' as const,         label: 'Salud',         sub: 'Tracker diario',  route: '/health-tracker' },
  { icon: 'trophy-outline' as const,        label: 'Duelos',        sub: 'Reta amigos',     route: '/duels' },
]

// ── Constants ────────────────────────────────────────────────────────────────

const TRAINING_TYPES = [
  { id: 'gym',        label: 'Gym',         emoji: '🏋️' },
  { id: 'hyrox',      label: 'Hyrox',       emoji: '🔥' },
  { id: 'crossfit',   label: 'CrossFit',    emoji: '⚔️' },
  { id: 'running',    label: 'Running',     emoji: '🏃' },
  { id: 'cycling',    label: 'Ciclismo',    emoji: '🚴' },
  { id: 'calistenia', label: 'Calistenia',  emoji: '🤸' },
  { id: 'yoga',       label: 'Yoga',        emoji: '🧘' },
  { id: 'natacion',   label: 'Natación',    emoji: '🏊' },
  { id: 'combat',     label: 'Artes marciales', emoji: '🥊' },
  { id: 'hiking',     label: 'Hiking',      emoji: '🥾' },
]

const EXERCISE_SUGGESTIONS: Record<string, string[]> = {
  gym:        ['Press de banca', 'Sentadilla', 'Peso muerto', 'Press militar', 'Jalones al pecho', 'Remo con barra', 'Curl de bíceps', 'Extensión de tríceps', 'Leg press', 'Hip thrust', 'Face pull', 'Fondos en paralelas'],
  hyrox:      ['Ski erg', 'Sled push', 'Sled pull', 'Burpee broad jump', 'Rowing', 'Farmer carry', 'Sandbag lunges', 'Wall balls', 'Running 1km'],
  crossfit:   ['Thruster', 'Clean & jerk', 'Snatch', 'Muscle-up', 'Box jump', 'Double-under', 'Handstand push-up', 'Kettlebell swing', 'Wall ball', 'Bar muscle-up'],
  running:    ['Carrera continua', 'Intervalos 400m', 'Fartlek', 'Tempo run', 'Rodaje largo', 'Series 1km', 'Cuestas', 'Carrera regenerativa'],
  calistenia: ['Dominadas', 'Fondos', 'Flexiones', 'Pistol squat', 'L-sit', 'Muscle-up', 'Planche', 'Front lever', 'Handstand', 'Dips'],
  default:    ['Sentadilla', 'Plancha', 'Zancadas', 'Flexiones', 'Burpees', 'Mountain climbers', 'Jumping jacks', 'Salto a cuerda'],
}

// ── Add Exercise Modal ────────────────────────────────────────────────────────

interface AddExerciseModalProps {
  visible: boolean
  trainingType: string
  onClose: () => void
  onAdd: (ex: Exercise) => void
  initial?: Exercise | null
}

function AddExerciseModal({ visible, trainingType, onClose, onAdd, initial }: AddExerciseModalProps) {
  const [tab, setTab] = useState<'search' | 'manual'>('search')
  const [name, setName]     = useState(initial?.name ?? '')
  const [sets, setSets]     = useState(String(initial?.sets ?? '3'))
  const [reps, setReps]     = useState(initial?.reps ?? '10')
  const [weight, setWeight] = useState(initial?.weight ?? '')
  const [rest, setRest]     = useState(String(initial?.rest ?? '90'))
  const [notes, setNotes]   = useState(initial?.notes ?? '')
  const [query, setQuery]   = useState('')

  useEffect(() => {
    if (initial) {
      setName(initial.name); setSets(String(initial.sets)); setReps(initial.reps)
      setWeight(initial.weight); setRest(String(initial.rest)); setNotes(initial.notes ?? '')
    }
  }, [initial])

  const suggestions = EXERCISE_SUGGESTIONS[trainingType] ?? EXERCISE_SUGGESTIONS.default
  const filtered = query.length > 1
    ? suggestions.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : suggestions

  const pickSuggestion = (s: string) => { setName(s); setTab('manual') }

  const handleAdd = () => {
    if (!name.trim()) { Alert.alert('Nombre requerido'); return }
    onAdd({
      id: initial?.id ?? Date.now().toString(),
      name: name.trim(), sets: parseInt(sets) || 3,
      reps: reps || '10', weight: weight || 'bodyweight',
      rest: parseInt(rest) || 90, notes: notes || undefined,
    })
    setName(''); setSets('3'); setReps('10'); setWeight(''); setRest('90'); setNotes(''); setTab('search')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={ae.container}>
          <View style={ae.header}>
            <Text style={ae.title}>{initial ? 'Editar ejercicio' : 'Agregar ejercicio'}</Text>
            <TouchableOpacity onPress={onClose}><Text style={ae.close}>✕</Text></TouchableOpacity>
          </View>

          <View style={ae.tabs}>
            <TouchableOpacity style={[ae.tab, tab === 'search' && ae.tabOn]} onPress={() => setTab('search')}>
              <Text style={[ae.tabTxt, tab === 'search' && ae.tabTxtOn]}>🔍 Ejercicios frecuentes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ae.tab, tab === 'manual' && ae.tabOn]} onPress={() => setTab('manual')}>
              <Text style={[ae.tabTxt, tab === 'manual' && ae.tabTxtOn]}>✏️ Personalizar</Text>
            </TouchableOpacity>
          </View>

          {tab === 'search' && (
            <View style={{ flex: 1 }}>
              <TextInput
                style={ae.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar ejercicio..."
                placeholderTextColor={Colors.neutral[500]}
              />
              <FlatList
                data={filtered}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={ae.suggRow} onPress={() => pickSuggestion(item)}>
                    <Text style={ae.suggName}>{item}</Text>
                    <Text style={ae.suggArrow}>›</Text>
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          )}

          {tab === 'manual' && (
            <ScrollView contentContainerStyle={{ padding: Spacing[5] }} keyboardShouldPersistTaps="handled">
              <Text style={ae.fieldLabel}>Nombre del ejercicio *</Text>
              <TextInput style={ae.input} value={name} onChangeText={setName} placeholder="Ej. Press de banca" placeholderTextColor={Colors.neutral[600]} />

              <View style={ae.row3}>
                <View style={{ flex: 1 }}>
                  <Text style={ae.fieldLabel}>Series</Text>
                  <TextInput style={ae.input} value={sets} onChangeText={setSets} keyboardType="number-pad" placeholder="3" placeholderTextColor={Colors.neutral[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ae.fieldLabel}>Reps</Text>
                  <TextInput style={ae.input} value={reps} onChangeText={setReps} placeholder="8-12" placeholderTextColor={Colors.neutral[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ae.fieldLabel}>Descanso</Text>
                  <TextInput style={ae.input} value={rest} onChangeText={setRest} keyboardType="number-pad" placeholder="90s" placeholderTextColor={Colors.neutral[600]} />
                </View>
              </View>

              <Text style={ae.fieldLabel}>Peso / Resistencia</Text>
              <TextInput style={ae.input} value={weight} onChangeText={setWeight} placeholder="ej. 60kg, bodyweight, banda" placeholderTextColor={Colors.neutral[600]} />

              <Text style={ae.fieldLabel}>Notas (opcional)</Text>
              <TextInput style={[ae.input, { height: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="Técnica, variación, cómo progresar..." placeholderTextColor={Colors.neutral[600]} />

              <TouchableOpacity style={ae.addBtn} onPress={handleAdd}>
                <Text style={ae.addBtnTxt}>{initial ? 'Guardar cambios' : 'Agregar ejercicio'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const ae = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  title: { fontSize: Typography.fontSize.xl, fontWeight: '700', color: Colors.dark.text },
  close: { fontSize: 22, color: Colors.dark.textSecondary, padding: Spacing[2] },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  tab: { flex: 1, paddingVertical: Spacing[3], alignItems: 'center' },
  tabOn: { borderBottomWidth: 2, borderBottomColor: Colors.primary[500] },
  tabTxt: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, fontWeight: '600' },
  tabTxtOn: { color: Colors.primary[400] },
  searchInput: { margin: Spacing[4], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: Typography.fontSize.base, color: Colors.dark.text, borderWidth: 1, borderColor: Colors.dark.border },
  suggRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  suggName: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark.text },
  suggArrow: { fontSize: 20, color: Colors.dark.textTertiary },
  row3: { flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[3] },
  fieldLabel: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textSecondary, marginBottom: Spacing[2], textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.dark.surface, borderWidth: 1.5, borderColor: Colors.dark.border, borderRadius: BorderRadius.md, padding: Spacing[3], fontSize: Typography.fontSize.base, color: Colors.dark.text, marginBottom: Spacing[3] },
  addBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', marginTop: Spacing[2] },
  addBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})

// ── Routine Editor Modal ─────────────────────────────────────────────────────

interface RoutineEditorProps {
  visible: boolean
  initial: Partial<Routine> | null
  onClose: () => void
  onSave: (r: Routine) => void
}

function RoutineEditorModal({ visible, initial, onClose, onSave }: RoutineEditorProps) {
  const insets = useSafeAreaInsets()
  const [name, setName]               = useState('')
  const [trainingType, setTrainingType] = useState('gym')
  const [exercises, setExercises]     = useState<Exercise[]>([])
  const [minutes, setMinutes]         = useState('60')
  const [notes, setNotes]             = useState('')
  const [addExOpen, setAddExOpen]     = useState(false)
  const [editEx, setEditEx]           = useState<Exercise | null>(null)

  useEffect(() => {
    if (initial) {
      setName(initial.name ?? '')
      setTrainingType(initial.trainingType ?? 'gym')
      setExercises(initial.exercises ?? [])
      setMinutes(String(initial.estimatedMinutes ?? 60))
      setNotes(initial.notes ?? '')
    } else {
      setName(''); setTrainingType('gym'); setExercises([]); setMinutes('60'); setNotes('')
    }
  }, [initial, visible])

  const handleAddEx = (ex: Exercise) => {
    if (editEx) {
      setExercises(prev => prev.map(e => e.id === ex.id ? ex : e))
      setEditEx(null)
    } else {
      setExercises(prev => [...prev, ex])
    }
  }

  const removeEx = (id: string) => setExercises(prev => prev.filter(e => e.id !== id))

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Nombre requerido', 'Dale un nombre a tu rutina'); return }
    if (exercises.length === 0) { Alert.alert('Sin ejercicios', 'Agrega al menos un ejercicio'); return }
    const tt = TRAINING_TYPES.find(t => t.id === trainingType)
    onSave({
      id: initial?.id ?? Date.now().toString(),
      name: name.trim(),
      trainingType,
      emoji: tt?.emoji ?? '💪',
      exercises,
      estimatedMinutes: parseInt(minutes) || 60,
      notes: notes || undefined,
      createdAt: initial?.createdAt ?? Date.now(),
    })
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={re.container} edges={['bottom', 'left', 'right']}>
        <View style={[re.header, { paddingTop: insets.top + Spacing[3] }]}>
          <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={re.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={re.title}>{initial?.id ? 'Editar rutina' : 'Nueva rutina'}</Text>
          <TouchableOpacity onPress={handleSave} hitSlop={8}><Text style={re.save}>Guardar</Text></TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80 }}>
          {/* Nombre */}
          <View style={re.section}>
            <Text style={re.fieldLabel}>Nombre de la rutina *</Text>
            <TextInput style={re.input} value={name} onChangeText={setName} placeholder="Ej. Push A - Pecho y Tríceps" placeholderTextColor={Colors.neutral[600]} />
          </View>

          {/* Tipo de entrenamiento */}
          <View style={re.section}>
            <Text style={re.fieldLabel}>Tipo de entrenamiento</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={re.typeRow}>
                {TRAINING_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[re.typeChip, trainingType === t.id && re.typeChipOn]}
                    onPress={() => setTrainingType(t.id)}
                  >
                    <Text style={re.typeEmoji}>{t.emoji}</Text>
                    <Text style={[re.typeLabel, trainingType === t.id && re.typeLabelOn]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Duración estimada */}
          <View style={re.section}>
            <Text style={re.fieldLabel}>Duración estimada (min)</Text>
            <TextInput style={[re.input, { width: 120 }]} value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="60" placeholderTextColor={Colors.neutral[600]} />
          </View>

          {/* Ejercicios */}
          <View style={re.section}>
            <View style={re.exHeader}>
              <Text style={re.fieldLabel}>Ejercicios ({exercises.length})</Text>
              <TouchableOpacity style={re.addExBtn} onPress={() => { setEditEx(null); setAddExOpen(true) }}>
                <Text style={re.addExBtnTxt}>+ Agregar</Text>
              </TouchableOpacity>
            </View>

            {exercises.length === 0 ? (
              <TouchableOpacity style={re.emptyEx} onPress={() => { setEditEx(null); setAddExOpen(true) }}>
                <Text style={re.emptyExTxt}>Toca "+ Agregar" para añadir ejercicios</Text>
              </TouchableOpacity>
            ) : (
              exercises.map((ex, i) => (
                <View key={ex.id} style={re.exRow}>
                  <View style={re.exNum}><Text style={re.exNumTxt}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={re.exName}>{ex.name}</Text>
                    <Text style={re.exDetail}>{ex.sets} × {ex.reps} · {ex.weight || 'bodyweight'} · {ex.rest}s descanso</Text>
                    {ex.notes ? <Text style={re.exNotes}>{ex.notes}</Text> : null}
                  </View>
                  <TouchableOpacity style={re.exEdit} onPress={() => { setEditEx(ex); setAddExOpen(true) }}>
                    <Text style={re.exEditTxt}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={re.exDel} onPress={() => removeEx(ex.id)}>
                    <Text style={re.exDelTxt}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Notas */}
          <View style={re.section}>
            <Text style={re.fieldLabel}>Notas (opcional)</Text>
            <TextInput
              style={[re.input, { height: 80, textAlignVertical: 'top' }]}
              value={notes} onChangeText={setNotes}
              multiline placeholder="Notas generales sobre la rutina..."
              placeholderTextColor={Colors.neutral[600]}
            />
          </View>

          <TouchableOpacity style={re.saveBtn} onPress={handleSave}>
            <Text style={re.saveBtnTxt}>Guardar rutina</Text>
          </TouchableOpacity>
        </ScrollView>

        <AddExerciseModal
          visible={addExOpen}
          trainingType={trainingType}
          onClose={() => { setAddExOpen(false); setEditEx(null) }}
          onAdd={handleAddEx}
          initial={editEx}
        />
      </SafeAreaView>
    </Modal>
  )
}

const re = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  cancel: { fontSize: Typography.fontSize.base, color: Colors.dark.textSecondary },
  title: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text },
  save: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.primary[400] },
  section: { paddingHorizontal: Spacing[5], paddingTop: Spacing[5] },
  fieldLabel: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textSecondary, marginBottom: Spacing[2], textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.dark.surface, borderWidth: 1.5, borderColor: Colors.dark.border, borderRadius: BorderRadius.md, padding: Spacing[3], fontSize: Typography.fontSize.base, color: Colors.dark.text },
  typeRow: { flexDirection: 'row', gap: Spacing[2], paddingRight: Spacing[5] },
  typeChip: { alignItems: 'center', paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], borderRadius: BorderRadius.md, backgroundColor: Colors.dark.surface, borderWidth: 1.5, borderColor: Colors.dark.border, minWidth: 70 },
  typeChipOn: { backgroundColor: Colors.primary[900] + '60', borderColor: Colors.primary[500] },
  typeEmoji: { fontSize: 20, marginBottom: 2 },
  typeLabel: { fontSize: 10, color: Colors.dark.textSecondary, fontWeight: '600' },
  typeLabelOn: { color: Colors.primary[400] },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[3] },
  addExBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.base, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2] },
  addExBtnTxt: { fontSize: Typography.fontSize.sm, color: '#fff', fontWeight: '700' },
  emptyEx: { borderWidth: 2, borderColor: Colors.dark.border, borderStyle: 'dashed', borderRadius: BorderRadius.md, padding: Spacing[6], alignItems: 'center' },
  emptyExTxt: { fontSize: Typography.fontSize.sm, color: Colors.dark.textTertiary },
  exRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[3], marginBottom: Spacing[2], borderWidth: 1, borderColor: Colors.dark.border, gap: Spacing[2] },
  exNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary[500] + '30', alignItems: 'center', justifyContent: 'center' },
  exNumTxt: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.primary[400] },
  exName: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text },
  exDetail: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 2 },
  exNotes: { fontSize: 10, color: Colors.dark.textTertiary, marginTop: 2, fontStyle: 'italic' },
  exEdit: { padding: Spacing[2] },
  exEditTxt: { fontSize: 16 },
  exDel: { padding: Spacing[2] },
  exDelTxt: { fontSize: 14, color: Colors.accent.red, fontWeight: '700' },
  saveBtn: { marginHorizontal: Spacing[5], marginTop: Spacing[5], backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center' },
  saveBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})

// ── Routine Card ──────────────────────────────────────────────────────────────

function RoutineCard({ routine, onEdit, onDelete, onStart }: {
  routine: Routine
  onEdit: () => void
  onDelete: () => void
  onStart: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <View style={rc.wrap}>
      <TouchableOpacity style={rc.header} onPress={() => setOpen(v => !v)}>
        <Text style={rc.emoji}>{routine.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={rc.name}>{routine.name}</Text>
          <Text style={rc.sub}>{routine.exercises.length} ejercicios · ~{routine.estimatedMinutes} min</Text>
        </View>
        <TouchableOpacity style={rc.startBtn} onPress={onStart}>
          <Text style={rc.startBtnTxt}>▶ Empezar</Text>
        </TouchableOpacity>
        <Text style={[rc.chevron, open && { transform: [{ rotate: '90deg' }] }]}>›</Text>
      </TouchableOpacity>

      {open && (
        <View style={rc.body}>
          {routine.exercises.map((ex, i) => (
            <View key={ex.id} style={rc.exRow}>
              <Text style={rc.exNum}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={rc.exName}>{ex.name}</Text>
                <Text style={rc.exDetail}>{ex.sets}×{ex.reps} · {ex.weight || 'bodyweight'} · {ex.rest}s</Text>
              </View>
            </View>
          ))}

          <View style={rc.actions}>
            <TouchableOpacity style={rc.editBtn} onPress={onEdit}>
              <Text style={rc.editBtnTxt}>✏️ Editar rutina</Text>
            </TouchableOpacity>
            <TouchableOpacity style={rc.delBtn} onPress={() => Alert.alert('Eliminar rutina', `¿Eliminar "${routine.name}"?`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: onDelete },
            ])}>
              <Text style={rc.delBtnTxt}>🗑️ Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const rc = StyleSheet.create({
  wrap: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, marginBottom: Spacing[3], overflow: 'hidden', borderWidth: 1, borderColor: Colors.dark.border },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing[4], gap: Spacing[3] },
  emoji: { fontSize: 28 },
  name: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text },
  sub: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 2 },
  startBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.base, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2] },
  startBtnTxt: { fontSize: Typography.fontSize.xs, color: '#fff', fontWeight: '800' },
  chevron: { fontSize: 20, color: Colors.dark.textTertiary },
  body: { borderTopWidth: 1, borderTopColor: Colors.dark.border, padding: Spacing[4] },
  exRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[2], gap: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border + '50' },
  exNum: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.primary[400], width: 20 },
  exName: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark.text },
  exDetail: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 1 },
  actions: { flexDirection: 'row', gap: Spacing[3], marginTop: Spacing[4] },
  editBtn: { flex: 1, backgroundColor: Colors.primary[900] + '60', borderRadius: BorderRadius.base, padding: Spacing[3], alignItems: 'center', borderWidth: 1, borderColor: Colors.primary[500] + '40' },
  editBtnTxt: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.primary[400] },
  delBtn: { flex: 1, backgroundColor: Colors.accent.red + '15', borderRadius: BorderRadius.base, padding: Spacing[3], alignItems: 'center', borderWidth: 1, borderColor: Colors.accent.red + '30' },
  delBtnTxt: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.accent.red },
})

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const { routines, logs, loadAll, saveRoutine, deleteRoutine, addLog } = useWorkoutStore()
  const [activeTab, setActiveTab] = useState<'routines' | 'history'>('routines')
  const [editorVisible, setEditorVisible]   = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<Partial<Routine> | null>(null)

  useEffect(() => { loadAll() }, [])

  const openCreate = () => { setEditingRoutine(null); setEditorVisible(true) }
  const openEdit   = (r: Routine) => { setEditingRoutine(r); setEditorVisible(true) }

  const handleSave = async (r: Routine) => {
    await saveRoutine(r)
    setEditorVisible(false)
    Alert.alert('✅ Rutina guardada', r.name)
  }

  const handleStart = (r: Routine) => {
    router.push(`/workout/active?routineId=${r.id}`)
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayLogs = logs.filter(l => l.date === todayStr)
  const recentLogs = logs.slice(-10).reverse()

  return (
    <SafeAreaView style={ws.container}>
      {/* Header */}
      <View style={ws.header}>
        <View>
          <Text style={ws.brand}>ENTRENAMIENTO</Text>
          <Text style={ws.date}>{new Date().toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>
        <TouchableOpacity style={ws.createBtn} onPress={openCreate}>
          <Text style={ws.createBtnTxt}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* Fitness tools grid */}
      <View style={ws.toolsRow}>
        {FITNESS_TOOLS.map(tool => (
          <TouchableOpacity
            key={tool.label}
            style={ws.toolCard}
            onPress={() => router.push(tool.route as any)}
            activeOpacity={0.78}
          >
            <View style={ws.toolHighlight} pointerEvents="none" />
            <View style={ws.toolIconWrap}>
              <Ionicons name={tool.icon} size={20} color={Colors.primary[400]} />
            </View>
            <Text style={ws.toolLabel}>{tool.label}</Text>
            <Text style={ws.toolSub}>{tool.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Today status */}
      {todayLogs.length > 0 && (
        <View style={ws.todayBanner}>
          <Text style={ws.todayEmoji}>🔥</Text>
          <Text style={ws.todayTxt}>
            {todayLogs.length} sesión{todayLogs.length > 1 ? 'es' : ''} hoy: {todayLogs.map(l => l.routineName).join(', ')}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={ws.tabs}>
        <TouchableOpacity style={[ws.tab, activeTab === 'routines' && ws.tabOn]} onPress={() => setActiveTab('routines')}>
          <Text style={[ws.tabTxt, activeTab === 'routines' && ws.tabTxtOn]}>Mis rutinas ({routines.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ws.tab, activeTab === 'history' && ws.tabOn]} onPress={() => setActiveTab('history')}>
          <Text style={[ws.tabTxt, activeTab === 'history' && ws.tabTxtOn]}>Historial ({logs.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing[5], paddingBottom: 100 }}>

        {activeTab === 'routines' && (
          <>
            {routines.length === 0 ? (
              <View style={ws.empty}>
                <Text style={ws.emptyEmoji}>💪</Text>
                <Text style={ws.emptyTitle}>Sin rutinas todavía</Text>
                <Text style={ws.emptyBody}>Crea tu primera rutina de entrenamiento. Tú decides los ejercicios, series, repeticiones y descansos.</Text>
                <TouchableOpacity style={ws.emptyBtn} onPress={openCreate}>
                  <Text style={ws.emptyBtnTxt}>Crear primera rutina</Text>
                </TouchableOpacity>
              </View>
            ) : (
              routines.map(r => (
                <RoutineCard
                  key={r.id}
                  routine={r}
                  onEdit={() => openEdit(r)}
                  onDelete={() => deleteRoutine(r.id)}
                  onStart={() => handleStart(r)}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            {recentLogs.length === 0 ? (
              <View style={ws.empty}>
                <Text style={ws.emptyEmoji}>📋</Text>
                <Text style={ws.emptyTitle}>Sin sesiones registradas</Text>
                <Text style={ws.emptyBody}>Cuando completes una rutina, aparecerá aquí tu historial de entrenamientos.</Text>
              </View>
            ) : (
              recentLogs.map(log => (
                <View key={log.id} style={ws.logCard}>
                  <View style={ws.logLeft}>
                    <Text style={ws.logDate}>{new Date(log.completedAt).toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ws.logName}>{log.routineName}</Text>
                    <Text style={ws.logSub}>{log.exercises.length} ejercicios{log.durationMinutes ? ` · ${log.durationMinutes} min` : ''}</Text>
                  </View>
                  <Text style={ws.logCheck}>✅</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <RoutineEditorModal
        visible={editorVisible}
        initial={editingRoutine}
        onClose={() => setEditorVisible(false)}
        onSave={handleSave}
      />
    </SafeAreaView>
  )
}

const ws = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[5] },
  brand: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.primary[400], letterSpacing: 3 },
  date: { fontSize: Typography.fontSize.base, fontWeight: '700', color: '#fff', marginTop: 2, textTransform: 'capitalize' },
  createBtn: {
    backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2],
    shadowColor: Colors.primary[500], shadowOpacity: 0.35, shadowRadius: 8,
  },
  createBtnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  // Fitness tools
  toolsRow: { flexDirection: 'row', paddingHorizontal: Spacing[4], gap: Spacing[3], marginBottom: Spacing[4] },
  toolCard: {
    flex: 1, backgroundColor: Glass.card, borderRadius: 16,
    borderWidth: 1, borderColor: Glass.cardBorder,
    padding: Spacing[3], alignItems: 'center', gap: 5, overflow: 'hidden',
  },
  toolHighlight: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: Glass.cardHighlight,
  },
  toolIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Glass.purpleTint, borderWidth: 1, borderColor: Glass.purpleBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  toolLabel: { fontSize: 10, fontWeight: '700', color: '#fff', textAlign: 'center' },
  toolSub: { fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  todayBanner: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing[5],
    marginBottom: Spacing[3], backgroundColor: Glass.purpleTint, borderRadius: BorderRadius.md,
    padding: Spacing[3], gap: Spacing[2], borderWidth: 1, borderColor: Glass.purpleBorder,
  },
  todayEmoji: { fontSize: 20 },
  todayTxt: { fontSize: Typography.fontSize.sm, color: Colors.primary[300], fontWeight: '600', flex: 1 },
  tabs: {
    flexDirection: 'row', marginHorizontal: Spacing[5], marginBottom: Spacing[2],
    backgroundColor: Glass.card, borderRadius: BorderRadius.md,
    overflow: 'hidden', borderWidth: 1, borderColor: Glass.cardBorder,
  },
  tab: { flex: 1, paddingVertical: Spacing[3], alignItems: 'center' },
  tabOn: { backgroundColor: Colors.primary[500] },
  tabTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: 'rgba(255,255,255,0.42)' },
  tabTxtOn: { color: '#fff' },
  empty: { alignItems: 'center', paddingTop: Spacing[12], paddingHorizontal: Spacing[8] },
  emptyEmoji: { fontSize: 56, marginBottom: Spacing[4] },
  emptyTitle: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: '#fff', marginBottom: Spacing[3] },
  emptyBody: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 22, marginBottom: Spacing[8] },
  emptyBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[8], paddingVertical: Spacing[4] },
  emptyBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  logCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Glass.card,
    borderRadius: BorderRadius.md, padding: Spacing[4], marginBottom: Spacing[3],
    borderWidth: 1, borderColor: Glass.cardBorder, gap: Spacing[3],
  },
  logLeft: { width: 56, alignItems: 'center' },
  logDate: { fontSize: 10, color: 'rgba(255,255,255,0.32)', textAlign: 'center', fontWeight: '700', textTransform: 'uppercase' },
  logName: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  logSub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  logCheck: { fontSize: 20 },
})
