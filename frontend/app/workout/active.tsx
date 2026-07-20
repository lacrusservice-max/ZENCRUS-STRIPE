import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Vibration, AppState,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useWorkoutStore, Routine, Exercise } from '@/store/workoutStore'
import { useStreakStore } from '@/store/streakStore'
import { useAchievementStore } from '@/store/achievementStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

// ── Rest Timer ────────────────────────────────────────────────────────────────

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds)
  const [active, setActive] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(() => {
    setActive(true)
    setRemaining(seconds)
  }, [seconds])

  const stop = useCallback(() => {
    setActive(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const reset = useCallback(() => {
    stop()
    setRemaining(seconds)
  }, [seconds, stop])

  useEffect(() => {
    if (!active) return
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          setActive(false)
          Vibration.vibrate([0, 400, 200, 400])
          onDone()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [active, onDone])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const pct = remaining / seconds
  const color = remaining > seconds * 0.4 ? Colors.accent.green : remaining > 15 ? Colors.accent.orange : Colors.accent.red

  return (
    <View style={rt.wrap}>
      <Text style={rt.label}>Descanso</Text>
      <Text style={[rt.time, { color }]}>
        {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}
      </Text>
      <View style={rt.bar}>
        <View style={[rt.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      <View style={rt.btns}>
        {!active
          ? <TouchableOpacity style={[rt.btn, rt.btnStart]} onPress={start}>
              <Text style={rt.btnTxt}>▶ Iniciar</Text>
            </TouchableOpacity>
          : <TouchableOpacity style={[rt.btn, rt.btnSkip]} onPress={() => { stop(); onDone() }}>
              <Text style={rt.btnTxt}>Saltar ›</Text>
            </TouchableOpacity>
        }
        <TouchableOpacity style={rt.btn} onPress={reset}>
          <Text style={[rt.btnTxt, { color: Colors.dark.textSecondary }]}>Reiniciar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const rt = StyleSheet.create({
  wrap: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border, alignItems: 'center' },
  label: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing[1] },
  time: { fontSize: 52, fontWeight: '900', lineHeight: 60 },
  bar: { width: '100%', height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, overflow: 'hidden', marginVertical: Spacing[3] },
  fill: { height: 4, borderRadius: 2 },
  btns: { flexDirection: 'row', gap: Spacing[3] },
  btn: { paddingHorizontal: Spacing[5], paddingVertical: Spacing[2], borderRadius: BorderRadius.base, borderWidth: 1, borderColor: Colors.dark.border },
  btnStart: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[500] },
  btnSkip: { backgroundColor: Colors.secondary[600], borderColor: Colors.secondary[600] },
  btnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
})

// ── Exercise Card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise, index, total, isCurrent, completedSets,
  onSetDone, onNext,
}: {
  exercise: Exercise
  index: number
  total: number
  isCurrent: boolean
  completedSets: number
  onSetDone: () => void
  onNext: () => void
}) {
  const [showRest, setShowRest] = useState(false)

  const handleSetDone = () => {
    onSetDone()
    if (completedSets + 1 < exercise.sets) {
      setShowRest(true)
    }
  }

  return (
    <View style={[ec.wrap, isCurrent && ec.wrapActive]}>
      <View style={ec.header}>
        <View style={[ec.numBadge, isCurrent && ec.numBadgeActive]}>
          <Text style={ec.num}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ec.name}>{exercise.name}</Text>
          <Text style={ec.sub}>
            {exercise.sets} series × {exercise.reps} reps
            {exercise.weight ? ` · ${exercise.weight}` : ''}
            {exercise.weight !== 'bodyweight' && exercise.weight ? ' kg' : ''}
          </Text>
        </View>
        <Text style={ec.progress}>{completedSets}/{exercise.sets}</Text>
      </View>

      {isCurrent && (
        <View style={ec.controls}>
          {/* Sets dots */}
          <View style={ec.setsDots}>
            {Array.from({ length: exercise.sets }, (_, i) => (
              <View key={i} style={[ec.setDot, i < completedSets && ec.setDotDone]} />
            ))}
          </View>

          {showRest ? (
            <RestTimer
              seconds={exercise.rest}
              onDone={() => setShowRest(false)}
            />
          ) : completedSets < exercise.sets ? (
            <TouchableOpacity style={ec.setBtn} onPress={handleSetDone}>
              <Text style={ec.setBtnTxt}>✓ Serie {completedSets + 1} completada</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[ec.setBtn, { backgroundColor: Colors.accent.green }]} onPress={onNext}>
              <Text style={ec.setBtnTxt}>
                {index + 1 < total ? 'Siguiente ejercicio →' : 'Finalizar entrenamiento 🏆'}
              </Text>
            </TouchableOpacity>
          )}

          {exercise.notes ? (
            <Text style={ec.notes}>📋 {exercise.notes}</Text>
          ) : null}
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
  setsDots: { flexDirection: 'row', gap: Spacing[2] },
  setDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.dark.border },
  setDotDone: { backgroundColor: Colors.accent.green },
  setBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md, padding: Spacing[4], alignItems: 'center' },
  setBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  notes: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, fontStyle: 'italic' },
})

// ── Main Active Workout Screen ────────────────────────────────────────────────

export default function ActiveWorkout() {
  const { routineId } = useLocalSearchParams<{ routineId: string }>()
  const { routines, addLog } = useWorkoutStore()
  const { markActivity } = useStreakStore()
  const { addXP } = useAchievementStore()

  const routine = routines.find(r => r.id === routineId)

  const [currentIdx, setCurrentIdx] = useState(0)
  const [completedSets, setCompletedSets] = useState<number[]>([])
  const [startTime] = useState(Date.now())
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (routine) {
      setCompletedSets(Array(routine.exercises.length).fill(0))
    }
  }, [routine])

  const handleSetDone = useCallback((exIdx: number) => {
    setCompletedSets(prev => {
      const next = [...prev]
      next[exIdx] = (next[exIdx] ?? 0) + 1
      return next
    })
  }, [])

  const handleNext = useCallback(async () => {
    if (!routine) return
    if (currentIdx + 1 < routine.exercises.length) {
      setCurrentIdx(i => i + 1)
    } else {
      // Workout complete
      const durationMinutes = Math.round((Date.now() - startTime) / 60000)
      const today = new Date().toISOString().slice(0, 10)
      await addLog({
        id: Date.now().toString(),
        date: today,
        routineId: routine.id,
        routineName: routine.name,
        exercises: routine.exercises,
        durationMinutes,
        completedAt: Date.now(),
      })
      await markActivity(today, { loggedWorkout: true })
      await addXP(25)
      setFinished(true)
    }
  }, [currentIdx, routine, startTime, addLog, markActivity])

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
    const totalSets = completedSets.reduce((a, b) => a + b, 0)
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.finishedContent}>
          <Text style={s.finishedEmoji}>🏆</Text>
          <Text style={s.finishedTitle}>¡Entrenamiento completado!</Text>
          <Text style={s.finishedSub}>{routine.name}</Text>

          <View style={s.statsGrid}>
            <StatCard label="Duración" value={`${durationMinutes} min`} emoji="⏱️" />
            <StatCard label="Ejercicios" value={String(routine.exercises.length)} emoji="📋" />
            <StatCard label="Series hechas" value={String(totalSets)} emoji="💪" />
          </View>

          <Text style={s.finishedMsg}>
            Cada serie que hiciste hoy es una inversión en quien serás mañana. ZENCRUS sabe lo que hiciste.
          </Text>

          <TouchableOpacity style={s.doneBtn} onPress={() => router.replace('/(tabs)/workout')}>
            <Text style={s.doneBtnTxt}>Volver a mis rutinas</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const elapsed = Math.round((Date.now() - startTime) / 60000)

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => Alert.alert(
          '¿Abandonar entrenamiento?',
          'Tu progreso de esta sesión no se guardará.',
          [
            { text: 'Continuar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => router.back() },
          ]
        )}>
          <Text style={s.closeBtn}>✕</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.routineName}>{routine.emoji} {routine.name}</Text>
          <Text style={s.elapsed}>{elapsed} min · {currentIdx + 1}/{routine.exercises.length} ejercicios</Text>
        </View>
        <Text style={s.xp}>+25 XP</Text>
      </View>

      {/* Progress bar */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${((currentIdx) / routine.exercises.length) * 100}%` as any }]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing[5], paddingBottom: 60 }}
      >
        {routine.exercises.map((exercise, i) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            index={i}
            total={routine.exercises.length}
            isCurrent={i === currentIdx}
            completedSets={completedSets[i] ?? 0}
            onSetDone={() => handleSetDone(i)}
            onNext={handleNext}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <View style={sc.wrap}>
      <Text style={sc.emoji}>{emoji}</Text>
      <Text style={sc.val}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  )
}

const sc = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border },
  emoji: { fontSize: 24, marginBottom: Spacing[1] },
  val: { fontSize: Typography.fontSize.xl, fontWeight: '900', color: Colors.dark.text },
  label: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, textAlign: 'center' },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  closeBtn: { fontSize: 22, color: Colors.dark.textSecondary, padding: Spacing[1] },
  routineName: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text },
  elapsed: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 2 },
  xp: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.accent.yellow },
  progressBar: { height: 3, backgroundColor: Colors.dark.border },
  progressFill: { height: 3, backgroundColor: Colors.primary[500], borderRadius: 2 },
  errorTxt: { fontSize: Typography.fontSize.base, color: Colors.dark.textSecondary, textAlign: 'center', marginTop: 100 },
  backLink: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], textAlign: 'center', marginTop: Spacing[4] },
  finishedContent: { alignItems: 'center', padding: Spacing[6], gap: Spacing[4] },
  finishedEmoji: { fontSize: 72, marginTop: Spacing[8] },
  finishedTitle: { fontSize: Typography.fontSize['2xl'], fontWeight: '900', color: Colors.dark.text, textAlign: 'center' },
  finishedSub: { fontSize: Typography.fontSize.base, color: Colors.dark.textSecondary },
  statsGrid: { flexDirection: 'row', gap: Spacing[3], width: '100%' },
  finishedMsg: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: Spacing[2] },
  doneBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], width: '100%', alignItems: 'center', marginTop: Spacing[2] },
  doneBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})
