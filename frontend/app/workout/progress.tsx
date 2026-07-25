import { useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Polyline, Circle, Line } from 'react-native-svg'
import { useWorkoutStore } from '@/store/workoutStore'
import { epley1RM } from '@/utils/oneRepMax'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'

const CHART_W = 320
const CHART_H = 140
const PAD = 16

interface Point { date: string; est1RM: number; weightKg: number; reps: number }

function OneRMChart({ points }: { points: Point[] }) {
  if (points.length === 0) return null

  const values = points.map(p => p.est1RM)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const stepX = points.length > 1 ? (CHART_W - PAD * 2) / (points.length - 1) : 0
  const coords = points.map((p, i) => {
    const x = PAD + i * stepX
    const y = CHART_H - PAD - ((p.est1RM - min) / range) * (CHART_H - PAD * 2)
    return { x, y, ...p }
  })

  const polylinePoints = coords.map(c => `${c.x},${c.y}`).join(' ')

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H}>
        <Line x1={PAD} y1={CHART_H - PAD} x2={CHART_W - PAD} y2={CHART_H - PAD} stroke={Colors.dark.border} strokeWidth={1} />
        <Polyline points={polylinePoints} fill="none" stroke={Colors.primary[400]} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 5 : 3.5} fill={i === coords.length - 1 ? Colors.primary[400] : Colors.dark.background} stroke={Colors.primary[400]} strokeWidth={2} />
        ))}
      </Svg>
    </View>
  )
}

export default function WorkoutProgressScreen() {
  const { logs, personalRecords } = useWorkoutStore()
  const [selected, setSelected] = useState<string | null>(null)

  // Todos los ejercicios que tienen al menos una serie con peso/reps registrados
  const exerciseNames = useMemo(() => {
    const set = new Set<string>()
    logs.forEach(log => log.exerciseLogs?.forEach(el => { if (el.sets.length) set.add(el.exerciseName) }))
    return Array.from(set).sort()
  }, [logs])

  const activeName = selected ?? exerciseNames[0] ?? null

  const points: Point[] = useMemo(() => {
    if (!activeName) return []
    const pts: Point[] = []
    logs
      .slice()
      .sort((a, b) => a.completedAt - b.completedAt)
      .forEach(log => {
        const el = log.exerciseLogs?.find(e => e.exerciseName === activeName)
        if (!el || !el.sets.length) return
        // El mejor 1RM estimado de esa sesión para este ejercicio
        const best = el.sets
          .filter(s => s.type === 'normal' || s.type === 'failure')
          .reduce((max, s) => Math.max(max, epley1RM(s.weightKg, s.reps)), 0)
        if (best > 0) pts.push({ date: log.date, est1RM: best, weightKg: 0, reps: 0 })
      })
    return pts
  }, [logs, activeName])

  const pr = activeName ? personalRecords.find(p => p.exerciseName === activeName) : null

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Progreso por ejercicio</Text>
        <View style={{ width: 40 }} />
      </View>

      {exerciseNames.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="trending-up-outline" size={48} color="rgba(255,255,255,0.25)" />
          <Text style={s.emptyTitle}>Aún no hay datos de progreso</Text>
          <Text style={s.emptyBody}>Registra el peso y las reps de tus series en un entrenamiento activo para ver tu evolución aquí.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing[5] }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing[2], marginBottom: Spacing[5] }}>
            {exerciseNames.map(name => (
              <TouchableOpacity key={name} style={[s.chip, activeName === name && s.chipOn]} onPress={() => setSelected(name)}>
                <Text style={[s.chipTxt, activeName === name && s.chipTxtOn]}>{name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {activeName && (
            <>
              <View style={s.card}>
                <Text style={s.cardTitle}>1RM estimado — {activeName}</Text>
                <Text style={s.cardSub}>Fórmula de Epley · basada en tus series normales/al fallo</Text>
                {points.length >= 2 ? (
                  <View style={{ alignItems: 'center', marginTop: Spacing[4] }}>
                    <OneRMChart points={points} />
                  </View>
                ) : (
                  <Text style={s.needMore}>Necesitas al menos 2 sesiones registradas para ver la gráfica de tendencia.</Text>
                )}
              </View>

              {pr && (
                <View style={s.prCard}>
                  <Ionicons name="trophy" size={22} color={Colors.accent.yellow} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.prTitle}>Récord personal</Text>
                    <Text style={s.prSub}>{pr.weightKg} kg × {pr.reps} reps · 1RM est. {pr.est1RM} kg</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },

  chip: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: BorderRadius.full, backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder },
  chipOn: { backgroundColor: Glass.purpleTint, borderColor: Glass.purpleBorder },
  chipTxt: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
  chipTxtOn: { color: Colors.primary[400] },

  card: { backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.xl, padding: Spacing[5], marginBottom: Spacing[4] },
  cardTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  cardSub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  needMore: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: Spacing[6], marginBottom: Spacing[2] },

  prCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: 'rgba(255,214,10,0.1)', borderWidth: 1, borderColor: 'rgba(255,214,10,0.28)', borderRadius: BorderRadius.lg, padding: Spacing[4] },
  prTitle: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.accent.yellow },
  prSub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing[8], gap: Spacing[3] },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: '#fff' },
  emptyBody: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20 },
})
