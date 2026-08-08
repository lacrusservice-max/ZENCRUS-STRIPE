import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { useRecoveryStore, type RecoveryEntry } from '@/store/recoveryStore'
import { useHabitsStore } from '@/store/habitsStore'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { GlassCard, GlassProgress } from '@/components/ui/Glass'
import { WaterWidget } from '@/components/ui/WaterWidget'
import { NavCard, sharedProgressStyles as s } from '@/components/ui/ProgressWidgets'

const SLEEP_QUALITY: Record<string, string> = {
  poor: '😴 Pobre', fair: '🙂 Regular', good: '😊 Bueno', excellent: '🤩 Excelente',
}

// ── Hoy: pasos + sueño ─────────────────────────────────────────────────────────

function TodaySection() {
  const { getTodaySummary, stepGoal, sleepGoal } = useHealthTrackerStore()
  const today = getTodaySummary()
  const stepPct = Math.min((today?.steps ?? 0) / stepGoal, 1)
  const sleepH = today?.sleepHours ?? 0
  const sleepPct = Math.min(sleepH / sleepGoal, 1)

  return (
    <View style={s.section}>
      <View style={ht.grid}>
        <View style={ht.cell}>
          <Ionicons name="walk" size={22} color={Colors.primary[400]} style={ht.cellEmoji} />
          <Text style={ht.cellVal}>{(today?.steps ?? 0).toLocaleString()}</Text>
          <Text style={ht.cellLabel}>pasos hoy</Text>
          <View style={ht.miniBarBg}>
            <View style={[ht.miniBarFill, { width: `${stepPct * 100}%` as any, backgroundColor: Colors.primary[400] }]} />
          </View>
        </View>
        <View style={ht.cell}>
          <Ionicons name="moon" size={22} color={Colors.secondary[400]} style={ht.cellEmoji} />
          <Text style={ht.cellVal}>{sleepH > 0 ? `${sleepH.toFixed(1)}h` : '—'}</Text>
          <Text style={ht.cellLabel}>{today?.sleepQuality ? SLEEP_QUALITY[today.sleepQuality] : 'sin registro'}</Text>
          <View style={ht.miniBarBg}>
            <View style={[ht.miniBarFill, { width: `${sleepPct * 100}%` as any, backgroundColor: Colors.secondary[400] }]} />
          </View>
        </View>
      </View>
    </View>
  )
}

const ht = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  cell: { width: '47%', backgroundColor: Glass.card, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Glass.cardBorder },
  cellEmoji: { fontSize: 20, marginBottom: Spacing[1] },
  cellVal: { fontSize: Typography.fontSize.xl, fontWeight: '900', color: '#fff' },
  cellLabel: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  miniBarBg: { height: 3, backgroundColor: Glass.cardBorder, borderRadius: 2, marginTop: Spacing[2], overflow: 'hidden' },
  miniBarFill: { height: 3, borderRadius: 2 },
})

// ── Recuperación ───────────────────────────────────────────────────────────────

const RECOVERY_LABELS = ['Muy bajo', 'Bajo', 'Normal', 'Bueno', 'Excelente']

function StepperRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={rc.stepperRow}>
      <Text style={rc.stepperLabel}>{label}</Text>
      <View style={rc.dots}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity key={n} onPress={() => onChange(n)} style={[rc.dot, n <= value && rc.dotOn]} activeOpacity={0.7} />
        ))}
      </View>
      <Text style={rc.stepperHint}>{RECOVERY_LABELS[value - 1]}</Text>
    </View>
  )
}

function RecoveryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { logToday, getToday } = useRecoveryStore()
  const existing = getToday()
  const [energy, setEnergy] = useState(existing?.energy ?? 3)
  const [soreness, setSoreness] = useState(existing?.soreness ?? 3)
  const [stress, setStress] = useState(existing?.stress ?? 3)

  const handleSave = async () => {
    await logToday({ energy, soreness, stress })
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={rc.container}>
          <View style={rc.header}>
            <Text style={rc.title}>¿Cómo te sientes hoy?</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
          </View>
          <View style={rc.body}>
            <StepperRow label="Energía" value={energy} onChange={setEnergy} />
            <StepperRow label="Dolor muscular (5 = sin dolor)" value={soreness} onChange={setSoreness} />
            <StepperRow label="Estrés (5 = muy relajado)" value={stress} onChange={setStress} />
            <TouchableOpacity style={rc.saveBtn} onPress={handleSave}>
              <Text style={rc.saveBtnTxt}>Guardar check-in</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function RecoverySection() {
  const [modal, setModal] = useState(false)
  const { getRecoveryScore, getToday, getWeeklyAverage, getTrend } = useRecoveryStore()
  const score = getRecoveryScore()
  const todayEntry = getToday()
  const weekAvg = getWeeklyAverage()
  const trend = getTrend()

  const scoreColor = score >= 70 ? Colors.accent.green : score >= 40 ? Colors.accent.orange : Colors.primary[500]

  return (
    <View style={s.section}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Recuperación</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setModal(true)}>
          <Text style={s.addBtnTxt}>{todayEntry ? 'Actualizar' : '+ Registrar'}</Text>
        </TouchableOpacity>
      </View>
      <GlassCard>
        <View style={rc.scoreRow}>
          <View>
            <Text style={[rc.scoreVal, { color: scoreColor }]}>{score}</Text>
            <Text style={rc.scoreSub}>Score de hoy</Text>
          </View>
          {weekAvg && (
            <View style={rc.trendBox}>
              <Ionicons
                name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
                size={16}
                color={trend === 'up' ? Colors.accent.green : trend === 'down' ? Colors.primary[400] : 'rgba(255,255,255,0.4)'}
              />
              <Text style={rc.trendTxt}>
                {trend === 'up' ? 'Mejorando' : trend === 'down' ? 'A la baja' : 'Estable'}
              </Text>
            </View>
          )}
        </View>
        <GlassProgress pct={score / 100} color={scoreColor} height={5} style={{ marginTop: Spacing[3] }} />
        {!todayEntry && (
          <Text style={rc.hint}>Registra cómo te sientes para un score más preciso — hoy se calcula solo con sueño y frecuencia cardíaca.</Text>
        )}
      </GlassCard>
      <RecoveryModal visible={modal} onClose={() => setModal(false)} />
    </View>
  )
}

const rc = StyleSheet.create({
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreVal: { fontSize: 40, fontWeight: '900' },
  scoreSub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: -2 },
  trendBox: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: BorderRadius.base, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2] },
  trendTxt: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: Spacing[3], lineHeight: 16 },
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  title: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: '#fff' },
  body: { padding: Spacing[5], gap: Spacing[5] },
  stepperRow: { gap: Spacing[2] },
  stepperLabel: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  dots: { flexDirection: 'row', gap: 10 },
  dot: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Glass.cardBorder },
  dotOn: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[500] },
  stepperHint: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  saveBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', marginTop: Spacing[2] },
  saveBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})

// ── Hábitos ────────────────────────────────────────────────────────────────────

function AddHabitModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addHabit } = useHabitsStore()
  const [label, setLabel] = useState('')

  const handleSave = async () => {
    if (!label.trim()) return
    await addHabit(label.trim(), 'checkmark-circle-outline')
    setLabel('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={rc.container}>
          <View style={rc.header}>
            <Text style={rc.title}>Nuevo hábito</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
          </View>
          <View style={rc.body}>
            <TextInput
              style={hb.input}
              value={label}
              onChangeText={setLabel}
              placeholder="ej: Estirar 10 minutos"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus
            />
            <TouchableOpacity style={rc.saveBtn} onPress={handleSave}>
              <Text style={rc.saveBtnTxt}>Agregar hábito</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function HabitsSection() {
  const { habits, getTodayStatus, toggleToday, getStreakForHabit } = useHabitsStore()
  const [addModal, setAddModal] = useState(false)
  const today = getTodayStatus()

  return (
    <View style={s.section}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Hábitos de hoy</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setAddModal(true)}>
          <Text style={s.addBtnTxt}>+ Agregar</Text>
        </TouchableOpacity>
      </View>
      <GlassCard noPad>
        {habits.map((habit, i) => {
          const done = !!today[habit.id]
          const streak = getStreakForHabit(habit.id)
          return (
            <TouchableOpacity
              key={habit.id}
              style={[hb.row, i < habits.length - 1 && hb.rowBorder]}
              onPress={() => toggleToday(habit.id)}
              activeOpacity={0.7}
            >
              <View style={[hb.check, done && hb.checkOn]}>
                {done && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Ionicons name={habit.icon as any} size={18} color={done ? Colors.primary[400] : 'rgba(255,255,255,0.4)'} />
              <Text style={[hb.label, done && hb.labelOn]}>{habit.label}</Text>
              {streak > 0 && (
                <View style={hb.streakBadge}>
                  <Text style={hb.streakTxt}>🔥 {streak}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </GlassCard>
      <AddHabitModal visible={addModal} onClose={() => setAddModal(false)} />
    </View>
  )
}

const hb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[4] },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[500] },
  label: { flex: 1, fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  labelOn: { color: '#fff' },
  streakBadge: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: BorderRadius.base, paddingHorizontal: Spacing[2], paddingVertical: 3 },
  streakTxt: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  input: { backgroundColor: Glass.card, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: Typography.fontSize.base, color: '#fff', borderWidth: 1, borderColor: Glass.cardBorder },
})

// ── Pantalla principal ─────────────────────────────────────────────────────────

export default function SaludScreen() {
  const router = useRouter()
  const { load: loadHealthTracker } = useHealthTrackerStore()
  const { load: loadRecovery } = useRecoveryStore()
  const { load: loadHabits } = useHabitsStore()

  useEffect(() => {
    loadHealthTracker()
    loadRecovery()
    loadHabits()
  }, [])

  return (
    <Screen tint={Colors.primary[500]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <ScreenHeader
          eyebrow="Zencrus · Salud"
          title="Tu salud"
          subtitle="Pasos, sueño, hidratación, recuperación y hábitos — todo en un lugar"
          icon="pulse"
        />

        <TodaySection />

        <View style={s.section}>
          <Text style={[s.cardTitle, { marginBottom: Spacing[2] }]}>Hidratación</Text>
          <WaterWidget />
        </View>

        <RecoverySection />
        <HabitsSection />

        <View style={s.section}>
          <NavCard
            emoji="🌙"
            title="Ciclo menstrual"
            subtitle="Predicción, fase y nutrición por ciclo"
            onPress={() => router.push('/menstrual')}
            color={Colors.secondary[400]}
          />
          <NavCard
            emoji="📊"
            title="Tracker de salud completo"
            subtitle="Historial de pasos, sueño y frecuencia cardíaca"
            onPress={() => router.push('/health-tracker')}
            color={Colors.primary[400]}
          />
        </View>
      </ScrollView>
    </Screen>
  )
}
