import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useBodyMeasurementsStore, BodyMeasurement } from '@/store/bodyMeasurementsStore'
import { useAchievementStore } from '@/store/achievementStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

type MeasurementField = {
  key: keyof BodyMeasurement
  label: string
  unit: string
  emoji: string
}

const FIELDS: MeasurementField[] = [
  { key: 'weight', label: 'Peso', unit: 'kg', emoji: '⚖️' },
  { key: 'bodyFatPct', label: '% Grasa corporal', unit: '%', emoji: '📊' },
  { key: 'muscleMassPct', label: '% Masa muscular', unit: '%', emoji: '💪' },
  { key: 'chest', label: 'Pecho', unit: 'cm', emoji: '👕' },
  { key: 'waist', label: 'Cintura', unit: 'cm', emoji: '📏' },
  { key: 'hips', label: 'Cadera', unit: 'cm', emoji: '📐' },
  { key: 'leftArm', label: 'Brazo izquierdo', unit: 'cm', emoji: '💪' },
  { key: 'rightArm', label: 'Brazo derecho', unit: 'cm', emoji: '💪' },
  { key: 'leftThigh', label: 'Muslo izquierdo', unit: 'cm', emoji: '🦵' },
  { key: 'rightThigh', label: 'Muslo derecho', unit: 'cm', emoji: '🦵' },
  { key: 'shoulders', label: 'Hombros', unit: 'cm', emoji: '🏋️' },
  { key: 'neck', label: 'Cuello', unit: 'cm', emoji: '📏' },
]

function AddMeasurementModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addMeasurement } = useBodyMeasurementsStore()
  const { updateStats, addXP } = useAchievementStore()
  const [values, setValues] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')

  const handleSave = () => {
    const numericValues: Record<string, number> = {}
    Object.entries(values).forEach(([k, v]) => {
      const n = parseFloat(v)
      if (!isNaN(n) && n > 0) numericValues[k] = n
    })
    if (Object.keys(numericValues).length === 0) {
      Alert.alert('Sin datos', 'Ingresa al menos una medida para guardar.')
      return
    }
    addMeasurement({
      date: new Date().toISOString().slice(0, 10),
      ...numericValues as any,
      note: note.trim() || undefined,
    })
    updateStats({ weightLogged: !!numericValues.weight })
    addXP(30)
    setValues({})
    setNote('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={am.container}>
          <View style={am.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={am.cancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={am.title}>Nueva medición</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={am.save}>Guardar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={am.body} keyboardShouldPersistTaps="handled">
            <Text style={am.date}>Fecha: {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            {FIELDS.map(f => (
              <View key={String(f.key)} style={am.row}>
                <Text style={am.rowEmoji}>{f.emoji}</Text>
                <Text style={am.rowLabel}>{f.label}</Text>
                <TextInput
                  style={am.input}
                  value={values[String(f.key)] ?? ''}
                  onChangeText={v => setValues(prev => ({ ...prev, [String(f.key)]: v }))}
                  placeholder="—"
                  placeholderTextColor={Colors.dark.textTertiary}
                  keyboardType="decimal-pad"
                />
                <Text style={am.unit}>{f.unit}</Text>
              </View>
            ))}
            <TextInput
              style={am.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Nota opcional (cómo te sientes, contexto...)"
              placeholderTextColor={Colors.dark.textTertiary}
              multiline
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const am = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  cancel: { fontSize: Typography.fontSize.base, color: Colors.dark.textSecondary },
  title: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text },
  save: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.primary[400] },
  body: { padding: Spacing[5] },
  date: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, marginBottom: Spacing[5], textTransform: 'capitalize' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border + '80', gap: Spacing[3] },
  rowEmoji: { fontSize: 18, width: 26 },
  rowLabel: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark.text },
  input: { width: 80, textAlign: 'right', fontSize: Typography.fontSize.base, fontWeight: '600', color: Colors.dark.text, paddingVertical: Spacing[1] },
  unit: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, width: 28 },
  noteInput: { marginTop: Spacing[5], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: Typography.fontSize.sm, color: Colors.dark.text, borderWidth: 1, borderColor: Colors.dark.border, minHeight: 80 },
})

function StatCard({ label, value, unit, change, emoji }: { label: string; value: number; unit: string; change: number; emoji: string }) {
  const up = change > 0
  const isWeight = label === 'Peso'
  const positive = isWeight ? !up : up
  return (
    <View style={sc.wrap}>
      <Text style={sc.emoji}>{emoji}</Text>
      <Text style={sc.label}>{label}</Text>
      <Text style={sc.value}>{value}<Text style={sc.unit}> {unit}</Text></Text>
      {change !== 0 && (
        <Text style={[sc.change, { color: positive ? Colors.accent.green : Colors.accent.red }]}>
          {up ? '↑' : '↓'} {Math.abs(change)} {unit}
        </Text>
      )}
    </View>
  )
}

const sc = StyleSheet.create({
  wrap: { backgroundColor: Colors.dark.surface, borderRadius: 12, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border, alignItems: 'center', flex: 1, minWidth: 100 },
  emoji: { fontSize: 22, marginBottom: Spacing[2] },
  label: { fontSize: 10, color: Colors.dark.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing[1] },
  value: { fontSize: Typography.fontSize.xl, fontWeight: '700', color: Colors.dark.text },
  unit: { fontSize: Typography.fontSize.xs, fontWeight: '400', color: Colors.dark.textSecondary },
  change: { fontSize: 10, fontWeight: '600', marginTop: Spacing[1] },
})

function HistoryRow({ measurement, onDelete }: { measurement: BodyMeasurement; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const filled = FIELDS.filter(f => measurement[f.key] != null)
  return (
    <View style={hr.wrap}>
      <TouchableOpacity style={hr.top} onPress={() => setExpanded(v => !v)} activeOpacity={0.7}>
        <Text style={hr.date}>{new Date(measurement.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        {measurement.weight && <Text style={hr.weight}>{measurement.weight} kg</Text>}
        <Text style={hr.arrow}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={hr.body}>
          {filled.map(f => (
            <View key={String(f.key)} style={hr.row}>
              <Text style={hr.fieldLabel}>{f.emoji} {f.label}</Text>
              <Text style={hr.fieldValue}>{measurement[f.key]} {f.unit}</Text>
            </View>
          ))}
          {measurement.note && <Text style={hr.note}>📝 {measurement.note}</Text>}
          <TouchableOpacity onPress={onDelete} style={hr.deleteBtn}>
            <Text style={hr.deleteTxt}>Eliminar registro</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const hr = StyleSheet.create({
  wrap: { backgroundColor: Colors.dark.surface, borderRadius: 12, marginBottom: Spacing[3], borderWidth: 1, borderColor: Colors.dark.border, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', padding: Spacing[4], gap: Spacing[3] },
  date: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark.text, fontWeight: '600' },
  weight: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '700' },
  arrow: { fontSize: 12, color: Colors.dark.textTertiary },
  body: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4], borderTopWidth: 1, borderTopColor: Colors.dark.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing[2], borderBottomWidth: 1, borderBottomColor: Colors.dark.border + '50' },
  fieldLabel: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary },
  fieldValue: { fontSize: Typography.fontSize.xs, color: Colors.dark.text, fontWeight: '600' },
  note: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: Spacing[3], lineHeight: 18 },
  deleteBtn: { marginTop: Spacing[4], paddingVertical: Spacing[2] },
  deleteTxt: { fontSize: Typography.fontSize.xs, color: Colors.accent.red, textAlign: 'center' },
})

export default function MeasurementsScreen() {
  const { measurements, getLatest, getProgress, deleteMeasurement } = useBodyMeasurementsStore()
  const [showAdd, setShowAdd] = useState(false)

  const latest = getLatest()
  const weightProgress = getProgress('weight')
  const waistProgress = getProgress('waist')
  const chestProgress = getProgress('chest')

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: Spacing[2] }}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Medidas corporales</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addTxt}>+ Registrar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {latest ? (
          <>
            <View style={s.statsGrid}>
              {weightProgress && (
                <StatCard label="Peso" value={weightProgress.value} unit="kg" change={weightProgress.change} emoji="⚖️" />
              )}
              {waistProgress && (
                <StatCard label="Cintura" value={waistProgress.value} unit="cm" change={waistProgress.change} emoji="📏" />
              )}
              {chestProgress && (
                <StatCard label="Pecho" value={chestProgress.value} unit="cm" change={chestProgress.change} emoji="👕" />
              )}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Historial de medidas ({measurements.length})</Text>
              {measurements.map(m => (
                <HistoryRow
                  key={m.id}
                  measurement={m}
                  onDelete={() => {
                    Alert.alert('Eliminar', '¿Eliminar este registro?', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Eliminar', style: 'destructive', onPress: () => deleteMeasurement(m.id) },
                    ])
                  }}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>📏</Text>
            <Text style={s.emptyTitle}>Sin medidas registradas</Text>
            <Text style={s.emptySub}>Registra tus medidas corporales para ver tu evolución física con el tiempo.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowAdd(true)}>
              <Text style={s.emptyBtnTxt}>Registrar primera medida</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <AddMeasurementModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  back: { fontSize: 28, color: Colors.dark.text, marginRight: Spacing[2] },
  title: { flex: 1, fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  addBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.full, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2] },
  addTxt: { color: '#fff', fontWeight: '700', fontSize: Typography.fontSize.xs },
  statsGrid: { flexDirection: 'row', gap: Spacing[3], padding: Spacing[4] },
  section: { padding: Spacing[4] },
  sectionTitle: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing[3] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing[8], marginTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: Spacing[4] },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700', color: Colors.dark.text, marginBottom: Spacing[2] },
  emptySub: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing[6] },
  emptyBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md, paddingHorizontal: Spacing[6], paddingVertical: Spacing[3] },
  emptyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: Typography.fontSize.sm },
})
