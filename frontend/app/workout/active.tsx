import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Vibration, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useSharedValue, withSpring, withSequence, useAnimatedStyle } from 'react-native-reanimated'
import { useWorkoutStore, Exercise, ExerciseLog } from '@/store/workoutStore'
import { useStreakStore } from '@/store/streakStore'
import { useAchievementStore } from '@/store/achievementStore'
import { SetEntry } from '@/utils/oneRepMax'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const SET_TYPES: { id: SetEntry['type']; label: string; color: string }[] = [
  { id: 'warmup',  label: 'Calent.', color: Colors.accent.yellow },
  { id: 'normal',  label: 'Normal',  color: Colors.primary[400] },
  { id: 'dropset', label: 'Drop',    color: Colors.accent.orange },
  { id: 'failure', label: 'Fallo',   color: Colors.accent.red },
]

// ── Rest Timer ────────────────────────────────────────────────────────────────

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setRemaining(seconds)
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          Vibration.vibrate([0, 400, 200, 400])
          onDone()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const pct = remaining / seconds
  const color = remaining > seconds * 0.4 ? Colors.accent.green : remaining > 15 ? Colors.accent.orange : Colors.accent.red

  return (
    <View style={rt.wrap}>
      <Text style={rt.label}>Descanso</Text>
      <Text style={[rt.time, { color }]}>{mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}</Text>
      <View style={rt.bar}><View style={[rt.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} /></View>
      <TouchableOpacity style={rt.skipBtn} onPress={onDone}>
        <Text style={rt.skipTxt}>Saltar descanso</Text>
      </TouchableOpacity>
    </View>
  )
}

const rt = StyleSheet.create({
  wrap: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border, alignItems: 'center' },
  label: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing[1] },
  time: { fontSize: 44, fontWeight: '900', lineHeight: 52 },
  bar: { width: '100%', height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, overflow: 'hidden', marginVertical: Spacing[3] },
  fill: { height: 4, borderRadius: 2 },
  skipBtn: { paddingVertical: Spacing[2] },
  skipTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.textSecondary },
})

// ── PR Celebration ──────────────────────────────────────────────────────────

function PRBanner({ est1RM, exerciseName }: { est1RM: number; exerciseName: string }) {
  const scale = useSharedValue(0)
  useEffect(() => {
    scale.value = withSequence(withSpring(1.05, { damping: 8 }), withSpring(1, { damping: 10 }))
  }, [])
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={[pr.wrap, animStyle]}>
      <Ionicons name="trophy" size={22} color={Colors.accent.yellow} />
      <View style={{ flex: 1 }}>
        <Text style={pr.title}>¡Nuevo récord personal!</Text>
        <Text style={pr.sub}>{exerciseName} · 1RM estimado {est1RM} kg</Text>
      </View>
    </Animated.View>
  )
}

const pr = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: 'rgba(255,214,10,0.12)', borderWidth: 1, borderColor: 'rgba(255,214,10,0.35)', borderRadius: BorderRadius.md, padding: Spacing[3], marginBottom: Spacing[3] },
  title: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.accent.yellow },
  sub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
})

// ── Set Row (peso/reps reales) ───────────────────────────────────────────────

interface LoggedSet extends SetEntry { done: boolean }

function ExerciseCard({
  exercise, index, total, isCurrent, loggedSets, onSetLogged, onNext,
}: {
  exercise: Exercise
  index: number
  total: number
  isCurrent: boolean
  loggedSets: LoggedSet[]
  onSetLogged: (set: SetEntry) => Promise<{ isPR: boolean; est1RM: number } | null>
  onNext: () => void
}) {
  const [showRest, setShowRest] = useState(false)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [type, setType] = useState<SetEntry['type']>('normal')
  const [prBanner, setPrBanner] = useState<{ est1RM: number } | null>(null)

  const completed = loggedSets.filter(s => s.done).length

  const handleLogSet = async () => {
    const w = parseFloat(weight)
    const r = parseInt(reps)
    if (isNaN(r) || r <= 0) { Alert.alert('Faltan reps', 'Ingresa las repeticiones de esta serie.'); return }
    const entry: SetEntry = { weightKg: isNaN(w) ? 0 : w, reps: r, type }
    const result = await onSetLogged(entry)
    if (result?.isPR) setPrBanner({ est1RM: result.est1RM })
    setWeight(''); setReps('')
    if (completed + 1 < exercise.sets) setShowRest(true)
  }

  return (
    <View style={[ec.wrap, isCurrent && ec.wrapActive]}>
      <View style={ec.header}>
        <View style={[ec.numBadge, isCurrent && ec.numBadgeActive]}><Text style={ec.num}>{index + 1}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={ec.name}>{exercise.name}</Text>
          <Text style={ec.sub}>{exercise.sets} series objetivo × {exercise.reps} reps</Text>
        </View>
        <Text style={ec.progress}>{completed}/{exercise.sets}</Text>
      </View>

      {isCurrent && (
        <View style={ec.controls}>
          {/* Series ya registradas */}
          {loggedSets.filter(s => s.done).map((s, i) => (
            <View key={i} style={ec.loggedRow}>
              <Text style={ec.loggedNum}>{i + 1}</Text>
              <Text style={ec.loggedTxt}>{s.weightKg > 0 ? `${s.weightKg} kg × ` : ''}{s.reps} reps</Text>
              <View style={[ec.typeChip, { borderColor: SET_TYPES.find(t => t.id === s.type)?.color }]}>
                <Text style={[ec.typeChipTxt, { color: SET_TYPES.find(t => t.id === s.type)?.color }]}>{SET_TYPES.find(t => t.id === s.type)?.label}</Text>
              </View>
            </View>
          ))}

          {prBanner && <PRBanner est1RM={prBanner.est1RM} exerciseName={exercise.name} />}

          {showRest ? (
            <RestTimer seconds={exercise.rest} onDone={() => { setShowRest(false); setPrBanner(null) }} />
          ) : completed < exercise.sets ? (
            <View style={ec.logForm}>
              <View style={ec.inputRow}>
                <View style={ec.inputWrap}>
                  <Text style={ec.inputLabel}>Peso (kg)</Text>
                  <TextInput style={ec.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="rgba(255,255,255,0.3)" />
                </View>
                <View style={ec.inputWrap}>
                  <Text style={ec.inputLabel}>Reps</Text>
                  <TextInput style={ec.input} value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="0" placeholderTextColor="rgba(255,255,255,0.3)" />
                </View>
              </View>
              <View style={ec.typeRow}>
                {SET_TYPES.map(t => (
                  <TouchableOpacity key={t.id} style={[ec.typeBtn, type === t.id && { backgroundColor: `${t.color}22`, borderColor: t.color }]} onPress={() => setType(t.id)}>
                    <Text style={[ec.typeBtnTxt, type === t.id && { color: t.color }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={ec.setBtn} onPress={handleLogSet}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={ec.setBtnTxt}>Registrar serie {completed + 1}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[ec.setBtn, { backgroundColor: Colors.accent.green }]} onPress={onNext}>
              <Ionicons name={index + 1 < total ? 'arrow-forward' : 'trophy'} size={16} color="#fff" />
              <Text style={ec.setBtnTxt}>{index + 1 < total ? 'Siguiente ejercicio' : 'Finalizar entrenamiento'}</Text>
            </TouchableOpacity>
          )}

          {exercise.notes ? <Text style={ec.notes}>{exercise.notes}</Text> : null}
        </View>
      )}
    </View>
  )
}

const ec = StyleSheet.create({
  wrap: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], marginBottom: Spacing[3], borderWidth: 1, borderColor: Colors.dark.border },
  wrapActive: { borderColor: Colors.primary[500], borderWidth: 1.5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  numBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.dark.border, alignItems: 'center', justifyContent: 'center' },
  numBadgeActive: { backgroundColor: Colors.primary[500] },
  num: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  name: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text },
  sub: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 2 },
  progress: { fontSize: Typography.fontSize.base, fontWeight: '900', color: Colors.primary[400] },
  controls: { marginTop: Spacing[4], gap: Spacing[3] },
  loggedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: 4 },
  loggedNum: { width: 18, fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, fontWeight: '700' },
  loggedTxt: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark.text, fontWeight: '600' },
  typeChip: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  typeChipTxt: { fontSize: 10, fontWeight: '800' },
  logForm: { gap: Spacing[3] },
  inputRow: { flexDirection: 'row', gap: Spacing[3] },
  inputWrap: { flex: 1 },
  inputLabel: { fontSize: 11, color: Colors.dark.textTertiary, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  input: { backgroundColor: Colors.dark.background, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: BorderRadius.md, padding: Spacing[3], fontSize: Typography.fontSize.lg, fontWeight: '800', color: '#fff', textAlign: 'center' },
  typeRow: { flexDirection: 'row', gap: Spacing[2] },
  typeBtn: { flex: 1, paddingVertical: Spacing[2], borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.dark.border, alignItems: 'center' },
  typeBtnTxt: { fontSize: 11, fontWeight: '700', color: Colors.dark.textSecondary },
  setBtn: { flexDirection: 'row', gap: Spacing[2], backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md, padding: Spacing[4], alignItems: 'center', justifyContent: 'center' },
  setBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  notes: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, fontStyle: 'italic' },
})

// ── Main Active Workout Screen ────────────────────────────────────────────────

export default function ActiveWorkout() {
  const { routineId } = useLocalSearchParams<{ routineId: string }>()
  const { routines, addLog, recordSet } = useWorkoutStore()
  const { markActivity } = useStreakStore()
  const { addXP } = useAchievementStore()

  const routine = routines.find(r => r.id === routineId)

  const [currentIdx, setCurrentIdx] = useState(0)
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, LoggedSet[]>>({})
  const [startTime] = useState(Date.now())
  const [finished, setFinished] = useState(false)
  const [prCount, setPrCount] = useState(0)

  useEffect(() => {
    if (routine) {
      const init: Record<string, LoggedSet[]> = {}
      routine.exercises.forEach(ex => { init[ex.id] = [] })
      setExerciseLogs(init)
    }
  }, [routine])

  const handleSetLogged = useCallback(async (exId: string, exName: string, set: SetEntry) => {
    const result = await recordSet(exName, set)
    setExerciseLogs(prev => ({ ...prev, [exId]: [...(prev[exId] ?? []), { ...set, done: true }] }))
    if (result.isPR) setPrCount(c => c + 1)
    return result
  }, [recordSet])

  const handleNext = useCallback(async () => {
    if (!routine) return
    if (currentIdx + 1 < routine.exercises.length) {
      setCurrentIdx(i => i + 1)
    } else {
      const durationMinutes = Math.round((Date.now() - startTime) / 60000)
      const today = new Date().toISOString().slice(0, 10)
      const exerciseLogsPayload: ExerciseLog[] = routine.exercises.map(ex => ({
        exerciseId: ex.id, exerciseName: ex.name, sets: exerciseLogs[ex.id] ?? [],
      }))
      await addLog({
        id: Date.now().toString(),
        date: today,
        routineId: routine.id,
        routineName: routine.name,
        exercises: routine.exercises,
        exerciseLogs: exerciseLogsPayload,
        durationMinutes,
        completedAt: Date.now(),
      })
      await markActivity(today, { loggedWorkout: true })
      await addXP(25 + prCount * 15)
      setFinished(true)
    }
  }, [currentIdx, routine, startTime, addLog, markActivity, exerciseLogs, prCount])

  if (!routine) {
    return (
      <SafeAreaView style={s.container}>
        <Text style={s.errorTxt}>Rutina no encontrada</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.backLink}>← Volver</Text></TouchableOpacity>
      </SafeAreaView>
    )
  }

  if (finished) {
    const durationMinutes = Math.round((Date.now() - startTime) / 60000)
    const totalSets = Object.values(exerciseLogs).reduce((a, s) => a + s.length, 0)
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.finishedContent}>
          <Ionicons name="trophy" size={64} color={Colors.accent.yellow} />
          <Text style={s.finishedTitle}>¡Entrenamiento completado!</Text>
          <Text style={s.finishedSub}>{routine.name}</Text>

          <View style={s.statsGrid}>
            <StatCard label="Duración" value={`${durationMinutes} min`} icon="time-outline" />
            <StatCard label="Series" value={String(totalSets)} icon="barbell-outline" />
            <StatCard label="Nuevos PRs" value={String(prCount)} icon="trophy-outline" />
          </View>

          <Text style={s.finishedMsg}>Cada serie que hiciste hoy es una inversión en quien serás mañana. ZENCRUS sabe lo que hiciste.</Text>

          <TouchableOpacity style={s.doneBtn} onPress={() => router.replace('/(tabs)/workout')}>
            <Text style={s.doneBtnTxt}>Volver a mis rutinas</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const elapsed = Math.round((Date.now() - startTime) / 60000)

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => Alert.alert('¿Abandonar entrenamiento?', 'Tu progreso de esta sesión no se guardará.', [
            { text: 'Continuar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => router.back() },
          ])}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.routineName}>{routine.name}</Text>
            <Text style={s.elapsed}>{elapsed} min · {currentIdx + 1}/{routine.exercises.length} ejercicios</Text>
          </View>
          <Text style={s.xp}>+25 XP</Text>
        </View>

        <View style={s.progressBar}><View style={[s.progressFill, { width: `${((currentIdx) / routine.exercises.length) * 100}%` as any }]} /></View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing[5], paddingBottom: 60 }}>
          {routine.exercises.map((exercise, i) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              index={i}
              total={routine.exercises.length}
              isCurrent={i === currentIdx}
              loggedSets={exerciseLogs[exercise.id] ?? []}
              onSetLogged={(set) => handleSetLogged(exercise.id, exercise.name, set)}
              onNext={handleNext}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={sc.wrap}>
      <Ionicons name={icon} size={22} color={Colors.primary[400]} style={{ marginBottom: Spacing[1] }} />
      <Text style={sc.val}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  )
}

const sc = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border },
  val: { fontSize: Typography.fontSize.xl, fontWeight: '900', color: Colors.dark.text },
  label: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, textAlign: 'center' },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  routineName: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text },
  elapsed: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 2 },
  xp: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.accent.yellow },
  progressBar: { height: 3, backgroundColor: Colors.dark.border },
  progressFill: { height: 3, backgroundColor: Colors.primary[500], borderRadius: 2 },
  errorTxt: { fontSize: Typography.fontSize.base, color: Colors.dark.textSecondary, textAlign: 'center', marginTop: 100 },
  backLink: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], textAlign: 'center', marginTop: Spacing[4] },
  finishedContent: { alignItems: 'center', padding: Spacing[6], gap: Spacing[4] },
  finishedTitle: { fontSize: Typography.fontSize['2xl'], fontWeight: '900', color: Colors.dark.text, textAlign: 'center', marginTop: Spacing[4] },
  finishedSub: { fontSize: Typography.fontSize.base, color: Colors.dark.textSecondary },
  statsGrid: { flexDirection: 'row', gap: Spacing[3], width: '100%' },
  finishedMsg: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: Spacing[2] },
  doneBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], width: '100%', alignItems: 'center', marginTop: Spacing[2] },
  doneBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})
