import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useProgressStore } from '@/store/progressStore'
import { useAchievementStore, XP_LEVELS } from '@/store/achievementStore'
import { useBodyMeasurementsStore } from '@/store/bodyMeasurementsStore'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'

// ── Level Badge (new XP system from achievementStore) ─────────────────────────

function LevelBadge() {
  const { getCurrentLevel, getNextLevel, getLevelProgress, totalXP, streakShields } = useAchievementStore()
  const current = getCurrentLevel()
  const next = getNextLevel()
  const pct = getLevelProgress()

  return (
    <View style={lb.wrap}>
      <View style={[lb.badge, { borderColor: Colors.primary[500] }]}>
        <Text style={lb.emoji}>{current.emoji}</Text>
      </View>
      <View style={lb.info}>
        <View style={lb.row}>
          <Text style={[lb.title, { color: Colors.primary[400] }]}>{current.name}</Text>
          <View style={lb.xpRow}>
            {streakShields > 0 && (
              <Text style={lb.shields}>🛡️ ×{streakShields}</Text>
            )}
            <Text style={lb.xp}>{totalXP} XP</Text>
          </View>
        </View>
        <View style={lb.barBg}>
          <View style={[lb.barFill, { width: `${pct * 100}%` as any }]} />
        </View>
        {next && (
          <Text style={lb.next}>{totalXP - current.minXP} / {next.minXP - current.minXP} XP para {next.name} {next.emoji}</Text>
        )}
      </View>
    </View>
  )
}

const lb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing[4], backgroundColor: Glass.card, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Glass.cardBorder },
  badge: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 26 },
  info: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[2] },
  title: { fontSize: Typography.fontSize.base, fontWeight: '800' },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  shields: { fontSize: Typography.fontSize.xs, color: Colors.accent.yellow },
  xp: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)' },
  barBg: { height: 6, backgroundColor: Glass.cardBorder, borderRadius: 3, overflow: 'hidden', marginBottom: Spacing[1] },
  barFill: { height: 6, borderRadius: 3, backgroundColor: Colors.primary[500] },
  next: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },
})

// ── Weight Chart ──────────────────────────────────────────────────────────────

function WeightChart({ data }: { data: Array<{ date: string; weight: number }> }) {
  if (data.length === 0) return null
  const last10 = data.slice(-10)
  const min = Math.min(...last10.map(d => d.weight)) - 1
  const max = Math.max(...last10.map(d => d.weight)) + 1
  const range = max - min || 1
  const H = 60

  return (
    <View style={wc.wrap}>
      <View style={wc.chart}>
        {last10.map((d, i) => {
          const pct = (d.weight - min) / range
          const barH = Math.max(4, pct * H)
          const isLast = i === last10.length - 1
          return (
            <View key={d.date} style={wc.barWrap}>
              <Text style={wc.val}>{isLast ? d.weight : ''}</Text>
              <View style={{ height: H, justifyContent: 'flex-end' }}>
                <View style={[wc.bar, { height: barH, backgroundColor: isLast ? Colors.primary[500] : Glass.cardBorder }]} />
              </View>
              <Text style={wc.label}>{d.date.slice(5)}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const wc = StyleSheet.create({
  wrap: { marginTop: Spacing[3] },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barWrap: { flex: 1, alignItems: 'center', gap: 2 },
  val: { fontSize: 8, color: Colors.primary[400], fontWeight: '700', height: 12 },
  bar: { width: '100%', borderRadius: 3 },
  label: { fontSize: 8, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
})

// ── Weight Entry Modal ────────────────────────────────────────────────────────

function WeightModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addWeight, getLatestWeight } = useProgressStore()
  const latest = getLatestWeight()
  const [val, setVal] = useState(latest ? String(latest.weight) : '')
  const [note, setNote] = useState('')

  const handleSave = async () => {
    const w = parseFloat(val)
    if (isNaN(w) || w < 20 || w > 300) return
    await addWeight(w, note.trim() || undefined)
    setNote('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={wm.container}>
          <View style={wm.header}>
            <Text style={wm.title}>Registrar peso</Text>
            <TouchableOpacity onPress={onClose}><Text style={wm.close}>✕</Text></TouchableOpacity>
          </View>
          <View style={wm.body}>
            <Text style={wm.fieldLabel}>Peso actual (kg)</Text>
            <TextInput
              style={wm.bigInput}
              value={val}
              onChangeText={setVal}
              keyboardType="decimal-pad"
              placeholder="70.5"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <Text style={wm.fieldLabel}>Nota (opcional)</Text>
            <TextInput
              style={wm.input}
              value={note}
              onChangeText={setNote}
              placeholder="ej: después de entrenar, en ayunas..."
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <TouchableOpacity style={wm.saveBtn} onPress={handleSave}>
              <Text style={wm.saveBtnTxt}>Guardar +10 XP</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const wm = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  title: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: '#fff' },
  close: { fontSize: 22, color: 'rgba(255,255,255,0.6)' },
  body: { padding: Spacing[5], gap: Spacing[4] },
  fieldLabel: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.8 },
  bigInput: { backgroundColor: Glass.card, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: 32, fontWeight: '800', color: '#fff', textAlign: 'center', borderWidth: 1.5, borderColor: Glass.cardBorder },
  input: { backgroundColor: Glass.card, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: Typography.fontSize.sm, color: '#fff', borderWidth: 1, borderColor: Glass.cardBorder },
  saveBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', marginTop: Spacing[2] },
  saveBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})

// ── Measurements Modal (old quick-entry for progressStore) ────────────────────

const MEASURE_FIELDS = [
  { key: 'waist',     label: 'Cintura' },
  { key: 'chest',     label: 'Pecho' },
  { key: 'hips',      label: 'Cadera' },
  { key: 'leftArm',   label: 'Brazo Iz.' },
  { key: 'rightArm',  label: 'Brazo Der.' },
  { key: 'leftThigh', label: 'Muslo Iz.' },
  { key: 'neck',      label: 'Cuello' },
  { key: 'bodyFat',   label: '% Grasa' },
] as const

type MeasureKey = typeof MEASURE_FIELDS[number]['key']

function MeasurementsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addMeasurements } = useProgressStore()
  const [vals, setVals] = useState<Partial<Record<MeasureKey, string>>>({})

  const setVal = (key: MeasureKey, v: string) => setVals(prev => ({ ...prev, [key]: v }))

  const handleSave = async () => {
    const parsed: Partial<Record<MeasureKey, number>> = {}
    for (const { key } of MEASURE_FIELDS) {
      const v = vals[key]
      if (v && !isNaN(parseFloat(v))) parsed[key] = parseFloat(v)
    }
    if (Object.keys(parsed).length === 0) return
    await addMeasurements(parsed)
    setVals({})
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={mm.container}>
          <View style={mm.header}>
            <Text style={mm.title}>Medidas corporales</Text>
            <TouchableOpacity onPress={onClose}><Text style={mm.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={mm.body}>
            <Text style={mm.subtitle}>Llena las que tengas disponibles (cm / %)</Text>
            <View style={mm.grid}>
              {MEASURE_FIELDS.map(({ key, label }) => (
                <View key={key} style={mm.field}>
                  <Text style={mm.label}>{label}</Text>
                  <TextInput
                    style={mm.input}
                    value={vals[key] ?? ''}
                    onChangeText={v => setVal(key, v)}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>
              ))}
            </View>
            <TouchableOpacity style={mm.saveBtn} onPress={handleSave}>
              <Text style={mm.saveBtnTxt}>Guardar medidas +20 XP</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const mm = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  title: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: '#fff' },
  close: { fontSize: 22, color: 'rgba(255,255,255,0.6)' },
  body: { padding: Spacing[5], gap: Spacing[4], paddingBottom: 60 },
  subtitle: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  field: { width: '47%' },
  label: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: Spacing[1] },
  input: { backgroundColor: Glass.card, borderRadius: BorderRadius.md, padding: Spacing[3], fontSize: Typography.fontSize.base, color: '#fff', borderWidth: 1, borderColor: Glass.cardBorder, textAlign: 'center' },
  saveBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', marginTop: Spacing[2] },
  saveBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})

// ── Achievement Card ──────────────────────────────────────────────────────────

function AchievementCard({ emoji, title, description, xp, unlockedAt }: {
  emoji: string; title: string; description: string; xp: number; unlockedAt: number
}) {
  const date = new Date(unlockedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  return (
    <View style={ac.wrap}>
      <Text style={ac.emoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={ac.title}>{title}</Text>
        <Text style={ac.desc}>{description}</Text>
      </View>
      <View style={ac.xpBadge}>
        <Text style={ac.xpTxt}>+{xp} XP</Text>
        <Text style={ac.date}>{date}</Text>
      </View>
    </View>
  )
}

const ac = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: Glass.card, borderRadius: BorderRadius.md, padding: Spacing[4], borderWidth: 1, borderColor: Colors.accent.yellow + '40', borderLeftWidth: 3, borderLeftColor: Colors.accent.yellow },
  emoji: { fontSize: 28 },
  title: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  desc: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  xpBadge: { alignItems: 'flex-end' },
  xpTxt: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.accent.yellow },
  date: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
})

// ── Quick Nav Card ────────────────────────────────────────────────────────────

function NavCard({ emoji, title, subtitle, onPress, color = Colors.primary[500] }: {
  emoji: string; title: string; subtitle: string; onPress: () => void; color?: string
}) {
  return (
    <TouchableOpacity style={[nc.card, { borderLeftColor: color }]} onPress={onPress} activeOpacity={0.75}>
      <Text style={nc.emoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={nc.title}>{title}</Text>
        <Text style={nc.sub}>{subtitle}</Text>
      </View>
      <Text style={[nc.arrow, { color }]}>›</Text>
    </TouchableOpacity>
  )
}

const nc = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: Glass.card, borderRadius: BorderRadius.md, padding: Spacing[4], borderWidth: 1, borderColor: Glass.cardBorder, borderLeftWidth: 3, marginBottom: Spacing[2] },
  emoji: { fontSize: 24 },
  title: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  sub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  arrow: { fontSize: 22, fontWeight: '700' },
})

// ── Health Tracker Tab ────────────────────────────────────────────────────────

function HealthTab({ onGoToTracker }: { onGoToTracker: () => void }) {
  const { getTodaySummary, getWeeklySummary, stepGoal, sleepGoal } = useHealthTrackerStore()
  const today = getTodaySummary()
  const weekly = getWeeklySummary()

  const stepPct = Math.min((today?.steps ?? 0) / stepGoal, 1)
  const sleepH = today?.sleep?.totalHours ?? 0
  const sleepPct = Math.min(sleepH / sleepGoal, 1)
  const restingHR = today?.heartRate?.resting ?? weekly.avgHeartRate ?? 0

  const SLEEP_QUALITY: Record<string, string> = {
    poor: '😴 Pobre', fair: '🙂 Regular', good: '😊 Bueno', excellent: '🤩 Excelente'
  }

  return (
    <>
      {/* Quick stats 2×2 */}
      <View style={s.section}>
        <View style={ht.grid}>
          <View style={ht.cell}>
            <Text style={ht.cellEmoji}>👟</Text>
            <Text style={ht.cellVal}>{(today?.steps ?? 0).toLocaleString()}</Text>
            <Text style={ht.cellLabel}>pasos hoy</Text>
            <View style={ht.miniBarBg}>
              <View style={[ht.miniBarFill, { width: `${stepPct * 100}%` as any, backgroundColor: Colors.accent.green }]} />
            </View>
          </View>
          <View style={ht.cell}>
            <Text style={ht.cellEmoji}>❤️</Text>
            <Text style={ht.cellVal}>{restingHR > 0 ? `${restingHR}` : '—'}</Text>
            <Text style={ht.cellLabel}>FC reposo bpm</Text>
            <View style={ht.miniBarBg}>
              <View style={[ht.miniBarFill, { width: restingHR > 0 ? `${Math.min(restingHR / 100, 1) * 100}%` as any : '0%', backgroundColor: Colors.accent.orange }]} />
            </View>
          </View>
          <View style={ht.cell}>
            <Text style={ht.cellEmoji}>🌙</Text>
            <Text style={ht.cellVal}>{sleepH > 0 ? `${sleepH.toFixed(1)}h` : '—'}</Text>
            <Text style={ht.cellLabel}>{today?.sleep ? SLEEP_QUALITY[today.sleep.quality] : 'sin registro'}</Text>
            <View style={ht.miniBarBg}>
              <View style={[ht.miniBarFill, { width: `${sleepPct * 100}%` as any, backgroundColor: Colors.secondary[400] }]} />
            </View>
          </View>
          <View style={ht.cell}>
            <Text style={ht.cellEmoji}>🔥</Text>
            <Text style={ht.cellVal}>{today?.caloriesBurned ?? 0}</Text>
            <Text style={ht.cellLabel}>cal quemadas</Text>
            <View style={ht.miniBarBg}>
              <View style={[ht.miniBarFill, { width: `${Math.min((today?.caloriesBurned ?? 0) / 500, 1) * 100}%` as any, backgroundColor: Colors.accent.yellow }]} />
            </View>
          </View>
        </View>
      </View>

      {/* Weekly summary */}
      <View style={s.section}>
        <Text style={s.cardTitle}>Resumen semanal</Text>
        <View style={[s.card, { marginTop: Spacing[2] }]}>
          <View style={ht.weekRow}>
            <View style={ht.weekCell}>
              <Text style={ht.weekVal}>{weekly.avgSteps.toLocaleString()}</Text>
              <Text style={ht.weekLabel}>pasos/día</Text>
            </View>
            <View style={ht.weekDivider} />
            <View style={ht.weekCell}>
              <Text style={ht.weekVal}>{weekly.avgSleep.toFixed(1)}h</Text>
              <Text style={ht.weekLabel}>sueño/noche</Text>
            </View>
            <View style={ht.weekDivider} />
            <View style={ht.weekCell}>
              <Text style={ht.weekVal}>{weekly.avgCalories}</Text>
              <Text style={ht.weekLabel}>cal/día</Text>
            </View>
            <View style={ht.weekDivider} />
            <View style={ht.weekCell}>
              <Text style={ht.weekVal}>{weekly.avgHeartRate > 0 ? weekly.avgHeartRate : '—'}</Text>
              <Text style={ht.weekLabel}>FC media</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Navigate to full tracker */}
      <View style={s.section}>
        <NavCard
          emoji="📊"
          title="Tracker de salud completo"
          subtitle="Registra pasos, sueño y frecuencia cardíaca"
          onPress={onGoToTracker}
          color={Colors.accent.green}
        />
      </View>
    </>
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
  weekRow: { flexDirection: 'row', alignItems: 'center' },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing[2] },
  weekVal: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  weekLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, textAlign: 'center' },
  weekDivider: { width: 1, height: 32, backgroundColor: Glass.cardBorder },
})

// ── Body Measurements Tab ─────────────────────────────────────────────────────

function MedidasTab({ onGoToMeasurements }: { onGoToMeasurements: () => void }) {
  const { measurements, getLatest, getProgress } = useBodyMeasurementsStore()
  const latest = getLatest()

  const KEY_METRICS = [
    { key: 'weight',      emoji: '⚖️', label: 'Peso',    unit: 'kg',  goodDown: true },
    { key: 'waist',       emoji: '📏', label: 'Cintura',  unit: 'cm',  goodDown: true },
    { key: 'chest',       emoji: '💪', label: 'Pecho',    unit: 'cm',  goodDown: false },
    { key: 'bodyFatPct',  emoji: '🔥', label: 'Grasa',    unit: '%',   goodDown: true },
    { key: 'muscleMassPct', emoji: '💪', label: 'Músculo', unit: '%',  goodDown: false },
    { key: 'hips',        emoji: '📐', label: 'Cadera',   unit: 'cm',  goodDown: false },
  ] as const

  return (
    <>
      {latest ? (
        <View style={s.section}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>📅 Último registro</Text>
            <Text style={s.sub}>{new Date(latest.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</Text>
          </View>
          <View style={[s.card, { gap: Spacing[2] }]}>
            {KEY_METRICS.map(({ key, emoji, label, unit, goodDown }) => {
              const value = (latest as any)[key]
              if (value == null) return null
              const progress = getProgress(key as any)
              const change = progress?.change ?? 0
              const isGood = goodDown ? change <= 0 : change >= 0
              const changeColor = change === 0 ? 'rgba(255,255,255,0.35)' : (isGood ? Colors.accent.green : '#FF375F')
              return (
                <View key={key} style={mt.row}>
                  <Text style={mt.rowEmoji}>{emoji}</Text>
                  <Text style={mt.rowLabel}>{label}</Text>
                  <Text style={mt.rowVal}>{value}<Text style={mt.rowUnit}> {unit}</Text></Text>
                  {change !== 0 && (
                    <Text style={[mt.rowChange, { color: changeColor }]}>
                      {change > 0 ? '+' : ''}{change.toFixed(1)}
                    </Text>
                  )}
                </View>
              )
            })}
          </View>
          <Text style={mt.totalReg}>{measurements.length} registro{measurements.length !== 1 ? 's' : ''} en total</Text>
        </View>
      ) : (
        <View style={s.section}>
          <View style={s.card}>
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>📏</Text>
              <Text style={s.emptyTxt}>Sin medidas todavía</Text>
              <Text style={s.emptySub}>Registra tus medidas corporales para ver tu transformación real</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={onGoToMeasurements}>
                <Text style={s.emptyBtnTxt}>Ir a Medidas</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Navigate to full measurements screen */}
      <View style={s.section}>
        <NavCard
          emoji="📏"
          title="Medidas corporales completas"
          subtitle="Historial, fotos de progreso y 12 métricas"
          onPress={onGoToMeasurements}
          color={Colors.accent.orange}
        />
      </View>
    </>
  )
}

const mt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[2], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder, gap: Spacing[2] },
  rowEmoji: { fontSize: 16, width: 22 },
  rowLabel: { flex: 1, fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.6)' },
  rowVal: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  rowUnit: { fontSize: Typography.fontSize.xs, fontWeight: '400', color: 'rgba(255,255,255,0.35)' },
  rowChange: { fontSize: Typography.fontSize.xs, fontWeight: '700', minWidth: 32, textAlign: 'right' },
  totalReg: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)', marginTop: Spacing[2], textAlign: 'right' },
})

// ── Logros Tab ────────────────────────────────────────────────────────────────

function LogrosTab({ onGoToAchievements, onGoToLeaderboard }: {
  onGoToAchievements: () => void; onGoToLeaderboard: () => void
}) {
  const { getUnlocked, getLocked, totalXP, getCurrentLevel } = useAchievementStore()
  const unlocked = getUnlocked()
  const locked = getLocked()
  const level = getCurrentLevel()
  const [showLocked, setShowLocked] = useState(false)

  return (
    <>
      {/* XP summary */}
      <View style={s.section}>
        <View style={[s.card, lt.xpCard]}>
          <Text style={lt.xpEmoji}>{level.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={lt.xpName}>{level.name}</Text>
            <Text style={lt.xpTotal}>{totalXP.toLocaleString()} XP total</Text>
          </View>
          <View style={lt.xpBadge}>
            <Text style={lt.xpBadgeTxt}>{unlocked.length} logros</Text>
          </View>
        </View>
      </View>

      {/* Unlocked achievements */}
      {unlocked.length > 0 ? (
        <View style={s.section}>
          <Text style={[s.cardTitle, { marginBottom: Spacing[3] }]}>
            🏆 Desbloqueados ({unlocked.length})
          </Text>
          <View style={{ gap: Spacing[2] }}>
            {unlocked.slice().reverse().slice(0, 6).map(a => (
              <AchievementCard
                key={a.id}
                emoji={a.emoji}
                title={a.title}
                description={a.description}
                xp={a.xp}
                unlockedAt={a.unlockedAt!}
              />
            ))}
          </View>
          {unlocked.length > 6 && (
            <TouchableOpacity style={lt.seeAll} onPress={onGoToAchievements}>
              <Text style={lt.seeAllTxt}>Ver todos los {unlocked.length} logros →</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={s.section}>
          <View style={s.card}>
            <View style={s.achieveEmpty}>
              <Text style={s.achieveEmoji}>🏆</Text>
              <Text style={s.achieveEmptyTxt}>Sin logros aún</Text>
              <Text style={s.achieveEmptySub}>Registra tu peso, completa entrenamientos y mantén tu racha para desbloquear logros</Text>
            </View>
          </View>
        </View>
      )}

      {/* Toggle locked */}
      {locked.length > 0 && (
        <View style={s.section}>
          <TouchableOpacity onPress={() => setShowLocked(v => !v)} style={lt.toggleBtn}>
            <Text style={lt.toggleTxt}>{showLocked ? '▼' : '▶'} {locked.length} logros por desbloquear</Text>
          </TouchableOpacity>
          {showLocked && (
            <View style={{ gap: Spacing[2], marginTop: Spacing[2] }}>
              {locked.slice(0, 8).map(a => (
                <View key={a.id} style={lt.lockedCard}>
                  <Text style={lt.lockedEmoji}>{a.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={lt.lockedTitle}>{a.title}</Text>
                    <Text style={lt.lockedDesc}>{a.description}</Text>
                  </View>
                  <Text style={lt.lockedXp}>+{a.xp} XP</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Navigation */}
      <View style={s.section}>
        <NavCard
          emoji="🏆"
          title="Logros completos"
          subtitle="Mapa de niveles, categorías y todos tus logros"
          onPress={onGoToAchievements}
          color={Colors.accent.yellow}
        />
        <NavCard
          emoji="🏅"
          title="Ranking global"
          subtitle="Compite por XP, racha, pasos y más"
          onPress={onGoToLeaderboard}
          color={Colors.accent.orange}
        />
      </View>
    </>
  )
}

const lt = StyleSheet.create({
  xpCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  xpEmoji: { fontSize: 36 },
  xpName: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  xpTotal: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)' },
  xpBadge: { backgroundColor: Colors.accent.yellow + '20', borderRadius: BorderRadius.base, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1] },
  xpBadgeTxt: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.accent.yellow },
  seeAll: { marginTop: Spacing[3], alignItems: 'center', padding: Spacing[3] },
  seeAllTxt: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '700' },
  toggleBtn: { padding: Spacing[3], backgroundColor: Glass.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Glass.cardBorder },
  toggleTxt: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  lockedCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: Glass.card, borderRadius: BorderRadius.md, padding: Spacing[3], opacity: 0.5, borderWidth: 1, borderColor: Glass.cardBorder },
  lockedEmoji: { fontSize: 22 },
  lockedTitle: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  lockedDesc: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  lockedXp: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
})

// ── Main Progress Screen ──────────────────────────────────────────────────────

type ProgressTab = 'body' | 'salud' | 'medidas' | 'logros'

const TAB_LABELS: Record<ProgressTab, string> = {
  body: '📊 Cuerpo',
  salud: '❤️ Salud',
  medidas: '📏 Medidas',
  logros: '🏆 Logros',
}

export default function ProgressScreen() {
  const router = useRouter()
  const {
    weightHistory, measurementHistory, achievements,
    getLatestWeight, getWeightChange, load,
  } = useProgressStore()

  const { load: loadAchievements } = useAchievementStore()
  const { load: loadMeasurements } = useBodyMeasurementsStore()
  const { load: loadHealthTracker } = useHealthTrackerStore()

  const [weightModal, setWeightModal] = useState(false)
  const [measureModal, setMeasureModal] = useState(false)
  const [tab, setTab] = useState<ProgressTab>('body')

  useEffect(() => {
    load()
    loadAchievements()
    loadMeasurements()
    loadHealthTracker()
  }, [])

  const latestWeight = getLatestWeight()
  const weightChange = getWeightChange()
  const latestMeasures = measurementHistory.length > 0 ? measurementHistory[measurementHistory.length - 1] : null

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Tu progreso</Text>
          <Text style={s.subHeader}>Evidencia real de tu transformación</Text>
        </View>

        {/* Level Badge */}
        <View style={s.section}>
          <LevelBadge />
        </View>

        {/* Tabs — horizontal scroll for 4 tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabsScroll}
        >
          {(Object.keys(TAB_LABELS) as ProgressTab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {TAB_LABELS[t]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Cuerpo Tab ── */}
        {tab === 'body' && (
          <>
            {/* Peso */}
            <View style={s.section}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>⚖️ Peso corporal</Text>
                <TouchableOpacity style={s.addBtn} onPress={() => setWeightModal(true)}>
                  <Text style={s.addBtnTxt}>+ Registrar</Text>
                </TouchableOpacity>
              </View>

              <View style={s.card}>
                {latestWeight ? (
                  <>
                    <View style={s.weightRow}>
                      <View>
                        <Text style={s.weightBig}>{latestWeight.weight}<Text style={s.weightUnit}> kg</Text></Text>
                        <Text style={s.weightDate}>Último: {latestWeight.date}</Text>
                      </View>
                      {weightHistory.length >= 2 && (
                        <View style={[s.changeBadge, { backgroundColor: weightChange < 0 ? Colors.accent.green + '20' : Colors.accent.orange + '20' }]}>
                          <Text style={[s.changeVal, { color: weightChange < 0 ? Colors.accent.green : Colors.accent.orange }]}>
                            {weightChange > 0 ? '+' : ''}{weightChange} kg
                          </Text>
                          <Text style={s.changeLbl}>desde inicio</Text>
                        </View>
                      )}
                    </View>
                    <WeightChart data={weightHistory} />
                  </>
                ) : (
                  <View style={s.empty}>
                    <Text style={s.emptyEmoji}>⚖️</Text>
                    <Text style={s.emptyTxt}>Registra tu primer peso</Text>
                    <Text style={s.emptySub}>Ganarás 10 XP y comenzarás a ver tu evolución</Text>
                    <TouchableOpacity style={s.emptyBtn} onPress={() => setWeightModal(true)}>
                      <Text style={s.emptyBtnTxt}>Registrar ahora</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Medidas rápidas */}
            <View style={s.section}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>📏 Medidas rápidas</Text>
                <TouchableOpacity style={s.addBtn} onPress={() => setMeasureModal(true)}>
                  <Text style={s.addBtnTxt}>+ Registrar</Text>
                </TouchableOpacity>
              </View>

              <View style={s.card}>
                {latestMeasures ? (
                  <>
                    <Text style={s.measureDate}>Último registro: {latestMeasures.date}</Text>
                    <View style={{ flexDirection: 'row', gap: Spacing[3], flexWrap: 'wrap' }}>
                      {[
                        { key: 'waist', label: 'Cintura', unit: 'cm' },
                        { key: 'chest', label: 'Pecho', unit: 'cm' },
                        { key: 'leftArm', label: 'Brazo', unit: 'cm' },
                        { key: 'bodyFat', label: 'Grasa', unit: '%' },
                      ].map(({ key, label, unit }) => (latestMeasures as any)[key] != null ? (
                        <View key={key} style={s.measureChip}>
                          <Text style={s.measureChipVal}>{(latestMeasures as any)[key]}<Text style={s.measureChipUnit}>{unit}</Text></Text>
                          <Text style={s.measureChipLabel}>{label}</Text>
                        </View>
                      ) : null)}
                    </View>
                    <Text style={s.historyCount}>{measurementHistory.length} registro{measurementHistory.length !== 1 ? 's' : ''}</Text>
                  </>
                ) : (
                  <View style={s.empty}>
                    <Text style={s.emptyEmoji}>📏</Text>
                    <Text style={s.emptyTxt}>Sin medidas todavía</Text>
                    <Text style={s.emptySub}>Las medidas muestran el cambio real, independiente de la báscula</Text>
                    <TouchableOpacity style={s.emptyBtn} onPress={() => setMeasureModal(true)}>
                      <Text style={s.emptyBtnTxt}>Tomar medidas +20 XP</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Historial de peso */}
            {weightHistory.length > 0 && (
              <View style={s.section}>
                <Text style={s.cardTitle}>Historial de peso</Text>
                <View style={[s.card, { marginTop: Spacing[2] }]}>
                  {weightHistory.slice().reverse().slice(0, 8).map(w => (
                    <View key={w.id} style={s.historyRow}>
                      <Text style={s.historyDate}>{w.date}</Text>
                      <Text style={s.historyVal}>{w.weight} kg</Text>
                      {w.note && <Text style={s.historyNote}>{w.note}</Text>}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Nav cards */}
            <View style={s.section}>
              <NavCard emoji="📏" title="Medidas detalladas" subtitle="12 campos, fotos y evolución completa" onPress={() => router.push('/measurements')} color={Colors.accent.orange} />
              <NavCard emoji="❤️" title="Tracker de salud" subtitle="Pasos, sueño y frecuencia cardíaca" onPress={() => router.push('/health-tracker')} color={Colors.accent.green} />
            </View>
          </>
        )}

        {/* ── Salud Tab ── */}
        {tab === 'salud' && (
          <HealthTab onGoToTracker={() => router.push('/health-tracker')} />
        )}

        {/* ── Medidas Tab ── */}
        {tab === 'medidas' && (
          <MedidasTab onGoToMeasurements={() => router.push('/measurements')} />
        )}

        {/* ── Logros Tab ── */}
        {tab === 'logros' && (
          <LogrosTab
            onGoToAchievements={() => router.push('/achievements')}
            onGoToLeaderboard={() => router.push('/leaderboard')}
          />
        )}

      </ScrollView>

      <WeightModal visible={weightModal} onClose={() => setWeightModal(false)} />
      <MeasurementsModal visible={measureModal} onClose={() => setMeasureModal(false)} />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], paddingBottom: Spacing[2] },
  title: { fontSize: Typography.fontSize['2xl'], fontWeight: '900', color: '#fff' },
  subHeader: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  sub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)' },
  section: { marginHorizontal: Spacing[5], marginBottom: Spacing[4] },
  tabsScroll: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[4], gap: Spacing[2] },
  tab: { paddingVertical: Spacing[2], paddingHorizontal: Spacing[3], borderRadius: BorderRadius.md, backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder },
  tabActive: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[500] },
  tabTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  tabTxtActive: { color: '#fff' },
  card: { backgroundColor: Glass.card, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Glass.cardBorder },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[3] },
  cardTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  addBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.base, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1] },
  addBtnTxt: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: '#fff' },
  weightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  weightBig: { fontSize: 40, fontWeight: '900', color: '#fff' },
  weightUnit: { fontSize: Typography.fontSize.base, fontWeight: '400', color: 'rgba(255,255,255,0.6)' },
  weightDate: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)' },
  changeBadge: { borderRadius: BorderRadius.md, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], alignItems: 'center' },
  changeVal: { fontSize: Typography.fontSize.base, fontWeight: '800' },
  changeLbl: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  measureDate: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)', marginBottom: Spacing[3] },
  historyCount: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)', marginTop: Spacing[3] },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[2], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder, gap: Spacing[3] },
  historyDate: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)', width: 90 },
  historyVal: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  historyNote: { flex: 1, fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },
  measureChip: { alignItems: 'center', backgroundColor: Glass.elevated, borderRadius: BorderRadius.md, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], borderWidth: 1, borderColor: Glass.cardBorder },
  measureChipVal: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  measureChipUnit: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)', fontWeight: '400' },
  measureChipLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  empty: { alignItems: 'center', padding: Spacing[6], gap: Spacing[2] },
  emptyEmoji: { fontSize: 40 },
  emptyTxt: { fontSize: Typography.fontSize.base, fontWeight: '700', color: '#fff' },
  emptySub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 18 },
  emptyBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md, paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], marginTop: Spacing[2] },
  emptyBtnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  achieveEmpty: { alignItems: 'center', padding: Spacing[8], gap: Spacing[3] },
  achieveEmoji: { fontSize: 56 },
  achieveEmptyTxt: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: '#fff' },
  achieveEmptySub: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 22 },
})
