import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useGoalsStore } from '@/store/goalsStore'
import { useBodyMeasurementsStore } from '@/store/bodyMeasurementsStore'
import { useStreakStore } from '@/store/streakStore'
import { computeGoalProgress, generateMilestones, Goal, GoalDirection, GoalStatus } from '@/utils/goalProgress'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'

const STATUS_META: Record<GoalStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ahead:        { label: 'Vas adelantado',  color: Colors.accent.green,  icon: 'rocket-outline' },
  on_track:     { label: 'Vas a tiempo',    color: Colors.primary[400],  icon: 'checkmark-circle-outline' },
  behind:       { label: 'Vas atrasado',    color: Colors.accent.orange, icon: 'alert-circle-outline' },
  completed:    { label: '¡Meta cumplida!', color: Colors.accent.green,  icon: 'trophy' },
  expired:      { label: 'Fecha vencida',   color: Colors.accent.red,    icon: 'time-outline' },
  not_started:  { label: 'Aún no empieza',  color: 'rgba(255,255,255,0.4)', icon: 'hourglass-outline' },
}

const GOAL_TYPES: { id: Goal['type']; label: string; unit: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'weight', label: 'Peso corporal', unit: 'kg', icon: 'body-outline' },
  { id: 'streak', label: 'Días de racha', unit: 'días', icon: 'flame-outline' },
  { id: 'custom', label: 'Meta personalizada', unit: '', icon: 'flag-outline' },
]

function getCurrentValue(goal: Goal, latestWeight: number | null, currentStreak: number): number {
  if (goal.type === 'weight') return latestWeight ?? goal.startValue
  if (goal.type === 'streak') return currentStreak
  return (goal as any).currentValueOverride ?? goal.startValue
}

export default function GoalsScreen() {
  const { goals, addGoal, deleteGoal } = useGoalsStore()
  const { measurements } = useBodyMeasurementsStore()
  const { currentStreak } = useStreakStore()
  const [composerOpen, setComposerOpen] = useState(false)

  const latestWeight = measurements.find(m => typeof m.weight === 'number')?.weight ?? null

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mis metas</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => setComposerOpen(true)}>
          <Ionicons name="add" size={24} color={Colors.primary[400]} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing[5], paddingBottom: Spacing[16] }}>
        {goals.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="flag-outline" size={48} color="rgba(255,255,255,0.25)" />
            <Text style={s.emptyTitle}>Aún no tienes metas</Text>
            <Text style={s.emptyBody}>Crea una meta específica y con fecha — ZENCRUS la conecta con tu progreso real y te dice si vas a tiempo.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setComposerOpen(true)}>
              <Text style={s.emptyBtnTxt}>Crear mi primera meta</Text>
            </TouchableOpacity>
          </View>
        ) : (
          goals.map(goal => {
            const currentValue = getCurrentValue(goal, latestWeight, currentStreak)
            const progress = computeGoalProgress(goal, currentValue)
            const milestones = generateMilestones(goal)
            const meta = STATUS_META[progress.status]
            const typeInfo = GOAL_TYPES.find(t => t.id === goal.type)

            return (
              <View key={goal.id} style={s.card}>
                <View style={s.cardHead}>
                  <Ionicons name={typeInfo?.icon ?? 'flag-outline'} size={18} color={Colors.primary[400]} />
                  <Text style={s.cardTitle}>{goal.title}</Text>
                  <TouchableOpacity onPress={() => Alert.alert('Eliminar meta', `¿Eliminar "${goal.title}"?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => deleteGoal(goal.id) },
                  ])}>
                    <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                </View>

                <View style={[s.statusChip, { backgroundColor: `${meta.color}1a`, borderColor: `${meta.color}44` }]}>
                  <Ionicons name={meta.icon} size={13} color={meta.color} />
                  <Text style={[s.statusChipTxt, { color: meta.color }]}>{meta.label}</Text>
                </View>

                <View style={s.progTrack}>
                  <View style={[s.progFill, { width: `${progress.percentComplete}%`, backgroundColor: meta.color }]} />
                  <View style={[s.progExpectedMarker, { left: `${progress.expectedPercent}%` }]} />
                </View>
                <Text style={s.progLabel}>{currentValue}{goal.unit} de {goal.startValue}{goal.unit} → {goal.targetValue}{goal.unit}</Text>

                <View style={s.milestonesRow}>
                  {milestones.map(m => (
                    <View key={m.percent} style={s.milestoneDot}>
                      <View style={[s.milestoneDotInner, progress.percentComplete >= m.percent && { backgroundColor: meta.color }]} />
                      <Text style={s.milestoneVal}>{m.value}</Text>
                    </View>
                  ))}
                </View>

                <Text style={s.daysRemaining}>
                  {progress.status === 'expired' ? `Venció hace ${Math.abs(progress.daysRemaining)} días` : progress.status === 'completed' ? '¡Objetivo alcanzado!' : `${progress.daysRemaining} días restantes`}
                </Text>
              </View>
            )
          })
        )}
      </ScrollView>

      <GoalComposer visible={composerOpen} onClose={() => setComposerOpen(false)} onSave={addGoal} />
    </SafeAreaView>
  )
}

function GoalComposer({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (g: Omit<Goal, 'id'>) => void }) {
  const [type, setType] = useState<Goal['type']>('weight')
  const [title, setTitle] = useState('')
  const [startValue, setStartValue] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [weeks, setWeeks] = useState('8')

  const typeInfo = GOAL_TYPES.find(t => t.id === type)!

  const save = () => {
    const sv = parseFloat(startValue)
    const tv = parseFloat(targetValue)
    const w = parseInt(weeks)
    if (!title.trim() || isNaN(sv) || isNaN(tv) || isNaN(w) || w <= 0) {
      Alert.alert('Datos incompletos', 'Completa todos los campos con números válidos.')
      return
    }
    const startDate = new Date().toISOString().slice(0, 10)
    const targetDate = new Date(Date.now() + w * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const direction: GoalDirection = tv >= sv ? 'increase' : 'decrease'

    onSave({ title: title.trim(), type, direction, startValue: sv, targetValue: tv, startDate, targetDate, unit: typeInfo.unit })
    setTitle(''); setStartValue(''); setTargetValue(''); setWeeks('8')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={cm.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={cm.sheet}>
          <View style={cm.head}>
            <TouchableOpacity onPress={onClose}><Text style={cm.cancel}>Cancelar</Text></TouchableOpacity>
            <Text style={cm.title}>Nueva meta</Text>
            <TouchableOpacity onPress={save}><Text style={cm.save}>Guardar</Text></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: Spacing[4], gap: Spacing[4] }}>
            <View style={cm.typeRow}>
              {GOAL_TYPES.map(t => (
                <TouchableOpacity key={t.id} style={[cm.typeBtn, type === t.id && cm.typeBtnOn]} onPress={() => setType(t.id)}>
                  <Ionicons name={t.icon} size={16} color={type === t.id ? Colors.primary[400] : 'rgba(255,255,255,0.5)'} />
                  <Text style={[cm.typeBtnTxt, type === t.id && { color: Colors.primary[400] }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View>
              <Text style={cm.label}>Título de la meta</Text>
              <TextInput style={cm.input} value={title} onChangeText={setTitle} placeholder="Ej. Bajar para el verano" placeholderTextColor="rgba(255,255,255,0.3)" />
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing[3] }}>
              <View style={{ flex: 1 }}>
                <Text style={cm.label}>Valor actual{typeInfo.unit ? ` (${typeInfo.unit})` : ''}</Text>
                <TextInput style={cm.input} value={startValue} onChangeText={setStartValue} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="rgba(255,255,255,0.3)" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={cm.label}>Meta{typeInfo.unit ? ` (${typeInfo.unit})` : ''}</Text>
                <TextInput style={cm.input} value={targetValue} onChangeText={setTargetValue} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="rgba(255,255,255,0.3)" />
              </View>
            </View>

            <View>
              <Text style={cm.label}>Plazo (semanas)</Text>
              <TextInput style={cm.input} value={weeks} onChangeText={setWeeks} keyboardType="number-pad" placeholder="8" placeholderTextColor="rgba(255,255,255,0.3)" />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Typography.fontFamily.display, fontSize: Typography.fontSize.lg + 2, color: '#fff' },

  empty: { alignItems: 'center', paddingVertical: Spacing[16], paddingHorizontal: Spacing[6], gap: Spacing[3] },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: '#fff' },
  emptyBody: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: Spacing[3], backgroundColor: Colors.primary[500], borderRadius: BorderRadius.full, paddingHorizontal: Spacing[6], paddingVertical: Spacing[3] },
  emptyBtnTxt: { color: '#fff', fontWeight: '800', fontSize: Typography.fontSize.sm },

  card: { backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.lg, padding: Spacing[4], marginBottom: Spacing[3] },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[3] },
  cardTitle: { flex: 1, fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing[3], paddingVertical: 4, marginBottom: Spacing[3] },
  statusChipTxt: { fontSize: 11, fontWeight: '800' },

  progTrack: { height: 8, backgroundColor: Glass.cardBorder, borderRadius: 4, overflow: 'visible', marginBottom: Spacing[2] },
  progFill: { height: 8, borderRadius: 4 },
  progExpectedMarker: { position: 'absolute', top: -2, width: 2, height: 12, backgroundColor: 'rgba(255,255,255,0.6)' },
  progLabel: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.55)', marginBottom: Spacing[3] },

  milestonesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing[3] },
  milestoneDot: { alignItems: 'center', gap: 4 },
  milestoneDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  milestoneVal: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },

  daysRemaining: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
})

const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Glass.cardBorder, maxHeight: '85%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing[4], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  cancel: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  save: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '800' },
  typeRow: { flexDirection: 'row', gap: Spacing[2] },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing[3], borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Glass.cardBorder },
  typeBtnOn: { backgroundColor: Glass.purpleTint, borderColor: Glass.purpleBorder },
  typeBtnTxt: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.md, padding: Spacing[3], fontSize: Typography.fontSize.base, color: '#fff' },
})
