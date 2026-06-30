import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  useMacroCyclingStore, DAY_TYPE_CONFIG, DAY_TYPE_LABELS, PRESET_CYCLES,
  DayType, WeekCycle,
} from '@/store/macroCyclingStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const DAY_TYPES: DayType[] = ['high', 'moderate', 'low', 'rest']

// ── Today's Target Card ───────────────────────────────────────────────────────

function TodayCard() {
  const { enabled, getTodayPlan } = useMacroCyclingStore()
  const plan = getTodayPlan()
  const info = DAY_TYPE_LABELS[plan.dayType]
  const todayIdx = (new Date().getDay() + 6) % 7

  if (!enabled) return null

  return (
    <View style={[tc.card, { borderColor: info.color + '50' }]}>
      <View style={tc.header}>
        <Text style={tc.dayLabel}>{DAYS_ES[todayIdx]} — hoy</Text>
        <View style={[tc.typeBadge, { backgroundColor: info.color + '20' }]}>
          <Text style={tc.typeEmoji}>{info.emoji}</Text>
          <Text style={[tc.typeLabel, { color: info.color }]}>{info.label}</Text>
        </View>
      </View>
      <Text style={tc.desc}>{info.description}</Text>
      <View style={tc.macros}>
        <View style={tc.macroCell}>
          <Text style={[tc.macroCal, { color: info.color }]}>{plan.calories}</Text>
          <Text style={tc.macroUnit}>kcal</Text>
        </View>
        <View style={tc.macroDivider} />
        <View style={tc.macroCell}>
          <Text style={tc.macroVal}>{plan.protein}g</Text>
          <Text style={tc.macroUnit}>Proteína</Text>
        </View>
        <View style={tc.macroDivider} />
        <View style={tc.macroCell}>
          <Text style={tc.macroVal}>{plan.carbs}g</Text>
          <Text style={tc.macroUnit}>Carbs</Text>
        </View>
        <View style={tc.macroDivider} />
        <View style={tc.macroCell}>
          <Text style={tc.macroVal}>{plan.fat}g</Text>
          <Text style={tc.macroUnit}>Grasas</Text>
        </View>
      </View>
    </View>
  )
}

const tc = StyleSheet.create({
  card: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.xl, padding: Spacing[5], borderWidth: 1.5, gap: Spacing[3] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLabel: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, fontWeight: '600' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1], borderRadius: BorderRadius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1] },
  typeEmoji: { fontSize: 14 },
  typeLabel: { fontSize: Typography.fontSize.xs, fontWeight: '800' },
  desc: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, lineHeight: 20 },
  macros: { flexDirection: 'row', alignItems: 'center' },
  macroCell: { flex: 1, alignItems: 'center', gap: 2 },
  macroCal: { fontSize: Typography.fontSize.xl, fontWeight: '900' },
  macroVal: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text },
  macroUnit: { fontSize: 10, color: Colors.dark.textTertiary },
  macroDivider: { width: 1, height: 32, backgroundColor: Colors.dark.border },
})

// ── Week Grid ─────────────────────────────────────────────────────────────────

function WeekGrid({ cycle, onChangeDayType }: {
  cycle: WeekCycle
  onChangeDayType: (dayIndex: number, type: DayType) => void
}) {
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const todayIdx = (new Date().getDay() + 6) % 7

  return (
    <View style={wg.wrap}>
      {cycle.map((dayType, i) => {
        const info = DAY_TYPE_LABELS[dayType]
        const isToday = i === todayIdx
        return (
          <View key={i} style={wg.dayWrap}>
            <View style={[wg.dayCard, { borderColor: info.color + (isToday ? 'ff' : '40') }, isToday && wg.dayCardToday]}>
              <Text style={wg.dayName}>{DAYS_ES[i].slice(0, 3)}</Text>
              <Text style={wg.dayEmoji}>{info.emoji}</Text>
              <Text style={[wg.dayType, { color: info.color }]}>{info.label.split(' ')[0]}</Text>
              <TouchableOpacity
                style={[wg.editBtn, { backgroundColor: info.color + '20' }]}
                onPress={() => setEditingDay(editingDay === i ? null : i)}
              >
                <Text style={[wg.editBtnTxt, { color: info.color }]}>✏️</Text>
              </TouchableOpacity>
            </View>
            {editingDay === i && (
              <View style={wg.picker}>
                {DAY_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[wg.pickerOption, dayType === t && { backgroundColor: DAY_TYPE_LABELS[t].color + '30' }]}
                    onPress={() => { onChangeDayType(i, t); setEditingDay(null) }}
                  >
                    <Text style={wg.pickerEmoji}>{DAY_TYPE_LABELS[t].emoji}</Text>
                    <Text style={[wg.pickerLabel, { color: DAY_TYPE_LABELS[t].color }]}>
                      {DAY_TYPE_LABELS[t].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

const wg = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  dayWrap: { width: '48%', position: 'relative' },
  dayCard: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[3], borderWidth: 1.5, alignItems: 'center', gap: Spacing[1] },
  dayCardToday: { shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 8 },
  dayName: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, fontWeight: '700' },
  dayEmoji: { fontSize: 24 },
  dayType: { fontSize: Typography.fontSize.xs, fontWeight: '800', textAlign: 'center' },
  editBtn: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing[2], paddingVertical: 2, marginTop: Spacing[1] },
  editBtnTxt: { fontSize: 12 },
  picker: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: Colors.dark.background, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.dark.border, zIndex: 10, gap: 1, overflow: 'hidden', marginTop: 4 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], padding: Spacing[3] },
  pickerEmoji: { fontSize: 16 },
  pickerLabel: { fontSize: Typography.fontSize.xs, fontWeight: '700' },
})

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function MacroCyclingScreen() {
  const router = useRouter()
  const {
    enabled, weekCycle, currentPreset,
    baseCalories, baseProtein, baseCarbs, baseFat,
    load, setEnabled, setPreset, setDayType,
  } = useMacroCyclingStore()

  useEffect(() => { load() }, [])

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.backTxt}>‹</Text></TouchableOpacity>
        <Text style={s.title}>Macro Cycling</Text>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ true: Colors.primary[500], false: Colors.dark.border }}
          thumbColor="#fff"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* What is it */}
        <View style={s.section}>
          <View style={s.card}>
            <Text style={s.explainTitle}>¿Qué es el macro cycling?</Text>
            <Text style={s.explainTxt}>
              Varía tus carbohidratos según el tipo de entrenamiento del día. Los días de entreno intenso suben los carbs para más energía; los días de descanso los bajas para favorecer la quema de grasa. Sin dejar de cubrir tus proteínas.
            </Text>
            {!enabled && (
              <TouchableOpacity style={s.enableBtn} onPress={() => setEnabled(true)}>
                <Text style={s.enableBtnTxt}>Activar macro cycling</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Today */}
        {enabled && (
          <View style={s.section}>
            <TodayCard />
          </View>
        )}

        {/* Presets */}
        <View style={s.section}>
          <Text style={s.cardTitle}>Planes predefinidos</Text>
          <View style={{ gap: Spacing[3] }}>
            {Object.entries(PRESET_CYCLES).map(([key, preset]) => (
              <TouchableOpacity
                key={key}
                style={[s.presetCard, currentPreset === key && s.presetCardOn]}
                onPress={() => setPreset(key)}
                activeOpacity={0.75}
              >
                <View style={s.presetHeader}>
                  <Text style={[s.presetLabel, currentPreset === key && { color: Colors.primary[400] }]}>
                    {preset.label}
                  </Text>
                  {currentPreset === key && <Text style={s.presetCheck}>✓</Text>}
                </View>
                <Text style={s.presetDesc}>{preset.description}</Text>
                <View style={s.presetCycle}>
                  {preset.cycle.map((d, i) => (
                    <View key={i} style={[s.presetDay, { backgroundColor: DAY_TYPE_LABELS[d].color + '20' }]}>
                      <Text style={s.presetDayEmoji}>{DAY_TYPE_LABELS[d].emoji}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom week grid */}
        <View style={s.section}>
          <Text style={s.cardTitle}>Personalizar día a día</Text>
          <Text style={s.cardSub}>Toca ✏️ en cualquier día para cambiar su tipo</Text>
          <WeekGrid cycle={weekCycle} onChangeDayType={setDayType} />
        </View>

        {/* Day type legend */}
        <View style={s.section}>
          <Text style={s.cardTitle}>Tipos de día</Text>
          <View style={[s.card, { gap: Spacing[4] }]}>
            {DAY_TYPES.map(type => {
              const info = DAY_TYPE_LABELS[type]
              const config = DAY_TYPE_CONFIG[type]
              return (
                <View key={type} style={s.legendRow}>
                  <Text style={s.legendEmoji}>{info.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.legendLabel, { color: info.color }]}>{info.label}</Text>
                    <Text style={s.legendDesc}>{info.description}</Text>
                    <Text style={s.legendAdj}>
                      Carbs: {config.carbMultiplier > 1 ? '+' : ''}{Math.round((config.carbMultiplier - 1) * 100)}% · Cal: {config.calAdjust >= 0 ? '+' : ''}{config.calAdjust}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        </View>

        {/* Base targets */}
        <View style={s.section}>
          <Text style={s.cardTitle}>Tus targets base</Text>
          <View style={[s.card, s.baseCard]}>
            <View style={s.baseRow}>
              <Text style={s.baseLabel}>Calorías</Text>
              <Text style={s.baseVal}>{baseCalories} kcal</Text>
            </View>
            <View style={s.baseRow}>
              <Text style={s.baseLabel}>Proteína</Text>
              <Text style={s.baseVal}>{baseProtein}g</Text>
            </View>
            <View style={s.baseRow}>
              <Text style={s.baseLabel}>Carbohidratos</Text>
              <Text style={s.baseVal}>{baseCarbs}g</Text>
            </View>
            <View style={s.baseRow}>
              <Text style={s.baseLabel}>Grasas</Text>
              <Text style={s.baseVal}>{baseFat}g</Text>
            </View>
            <Text style={s.baseSub}>Ajusta estos targets en Perfil → Mis targets</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingTop: Spacing[3], paddingBottom: Spacing[3], gap: Spacing[3] },
  backTxt: { fontSize: 28, color: Colors.dark.text, fontWeight: '300' },
  title: { flex: 1, fontSize: Typography.fontSize.xl, fontWeight: '900', color: Colors.dark.text },
  section: { marginHorizontal: Spacing[5], marginBottom: Spacing[5] },
  card: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border },
  cardTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text, marginBottom: Spacing[1] },
  cardSub: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginBottom: Spacing[3] },
  explainTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text, marginBottom: Spacing[2] },
  explainTxt: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, lineHeight: 22 },
  enableBtn: { marginTop: Spacing[4], backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center' },
  enableBtnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  presetCard: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1.5, borderColor: Colors.dark.border, gap: Spacing[2] },
  presetCardOn: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[900] + '20' },
  presetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  presetLabel: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.dark.text },
  presetCheck: { fontSize: 16, color: Colors.accent.green },
  presetDesc: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, lineHeight: 18 },
  presetCycle: { flexDirection: 'row', gap: Spacing[1], marginTop: Spacing[1] },
  presetDay: { width: 28, height: 28, borderRadius: BorderRadius.base, alignItems: 'center', justifyContent: 'center' },
  presetDayEmoji: { fontSize: 14 },
  legendRow: { flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start' },
  legendEmoji: { fontSize: 22, width: 26 },
  legendLabel: { fontSize: Typography.fontSize.sm, fontWeight: '700', marginBottom: 2 },
  legendDesc: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, lineHeight: 16 },
  legendAdj: { fontSize: 10, color: Colors.dark.textTertiary, marginTop: 2 },
  baseCard: { gap: Spacing[3] },
  baseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing[2], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  baseLabel: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary },
  baseVal: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text },
  baseSub: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, textAlign: 'center', marginTop: Spacing[1] },
})
