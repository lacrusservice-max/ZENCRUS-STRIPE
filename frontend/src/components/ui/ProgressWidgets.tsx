import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useProgressStore } from '@/store/progressStore'
import { useAchievementStore } from '@/store/achievementStore'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'

// Widgets compartidos entre la pantalla Salud y la pantalla Estadísticas de
// Perfil — antes vivían solo en app/(tabs)/progress.tsx.

// ── Level Badge (XP) ───────────────────────────────────────────────────────────

export function LevelBadge() {
  const router = useRouter()
  const { getCurrentLevel, getNextLevel, getLevelProgress, totalXP, streakShields } = useAchievementStore()
  const current = getCurrentLevel()
  const next = getNextLevel()
  const pct = getLevelProgress()

  return (
    <TouchableOpacity style={lb.wrap} onPress={() => router.push('/streaks')} activeOpacity={0.85}>
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
    </TouchableOpacity>
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

export function WeightChart({ data }: { data: Array<{ date: string; weight: number }> }) {
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

export function WeightModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
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
  body: { padding: Spacing[5], gap: Spacing[4] },
  fieldLabel: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.8 },
  bigInput: { backgroundColor: Glass.card, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: 32, fontWeight: '800', color: '#fff', textAlign: 'center', borderWidth: 1.5, borderColor: Glass.cardBorder },
  input: { backgroundColor: Glass.card, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: Typography.fontSize.sm, color: '#fff', borderWidth: 1, borderColor: Glass.cardBorder },
  saveBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', marginTop: Spacing[2] },
  saveBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})

// ── Measurements Modal ─────────────────────────────────────────────────────────

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

export function MeasurementsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
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

export function AchievementCard({ emoji, title, description, xp, unlockedAt }: {
  emoji: string; title: string; description: string; xp: number; unlockedAt: string
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

export function NavCard({ emoji, title, subtitle, onPress, color = Colors.primary[500] }: {
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

// ── Estilos compartidos de sección (igual a los que tenía progress.tsx) ───────

export const sharedProgressStyles = StyleSheet.create({
  section: { marginHorizontal: Spacing[5], marginBottom: Spacing[4] },
  card: { backgroundColor: Glass.card, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Glass.cardBorder },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[3] },
  cardTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  sub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)' },
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
  tab: { paddingVertical: Spacing[2], paddingHorizontal: Spacing[3], borderRadius: BorderRadius.md, backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder },
  tabActive: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[500] },
  tabTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  tabTxtActive: { color: '#fff' },
  tabsScroll: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[4], gap: Spacing[2] },
  goalsLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.lg, padding: Spacing[4], marginHorizontal: Spacing[5], marginTop: Spacing[3], marginBottom: Spacing[2] },
  goalsLinkIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Glass.purpleTint, alignItems: 'center', justifyContent: 'center' },
  goalsLinkTitle: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  goalsLinkSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
})
