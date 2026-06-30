import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, Switch, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  useMenstrualStore, SYMPTOM_LABELS, MOOD_LABELS, FLOW_LABELS,
  Symptom, MoodLevel, FlowLevel, CyclePhase,
} from '@/store/menstrualStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

// ── Phase colors ──────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<CyclePhase, string> = {
  menstrual: '#FF375F',
  follicular: Colors.accent.green,
  ovulation: Colors.accent.yellow,
  luteal: Colors.secondary[400],
}

const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Folicular',
  ovulation: 'Ovulación',
  luteal: 'Lútea',
}

// ── Cycle Wheel ───────────────────────────────────────────────────────────────

function CycleWheel({ dayOfCycle, cycleLength, phase }: {
  dayOfCycle: number; cycleLength: number; phase: CyclePhase
}) {
  const color = PHASE_COLORS[phase]
  const pct = (dayOfCycle / cycleLength) * 100

  return (
    <View style={cw.wrap}>
      <View style={[cw.circle, { borderColor: color }]}>
        <Text style={[cw.day, { color }]}>{dayOfCycle}</Text>
        <Text style={cw.dayLabel}>día {dayOfCycle} de {cycleLength}</Text>
        <Text style={cw.phaseLabel}>{PHASE_LABELS[phase]}</Text>
      </View>
      <View style={cw.barWrap}>
        <View style={cw.barBg}>
          <View style={[cw.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
        </View>
        <Text style={cw.barTxt}>{Math.round(pct)}% del ciclo</Text>
      </View>
    </View>
  )
}

const cw = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing[4] },
  circle: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark.surface },
  day: { fontSize: 40, fontWeight: '900' },
  dayLabel: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary },
  phaseLabel: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text, marginTop: 4 },
  barWrap: { width: '80%', gap: Spacing[1] },
  barBg: { height: 6, backgroundColor: Colors.dark.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barTxt: { fontSize: 10, color: Colors.dark.textTertiary, textAlign: 'center' },
})

// ── Log Day Modal ─────────────────────────────────────────────────────────────

function LogDayModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { logDaily, getLogForDate } = useMenstrualStore()
  const todayStr = new Date().toISOString().split('T')[0]
  const existing = getLogForDate(todayStr)

  const [mood, setMood] = useState<MoodLevel>(existing?.mood ?? '')
  const [flow, setFlow] = useState<FlowLevel>(existing?.flow ?? '')
  const [symptoms, setSymptoms] = useState<Symptom[]>(existing?.symptoms ?? [])

  const toggleSymptom = (s: Symptom) => {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const handleSave = async () => {
    await logDaily({ mood, flow, symptoms })
    onClose()
  }

  const MOODS: MoodLevel[] = ['great', 'good', 'neutral', 'bad', 'terrible']
  const FLOWS: FlowLevel[] = ['none', 'light', 'medium', 'heavy']
  const ALL_SYMPTOMS = Object.keys(SYMPTOM_LABELS) as Symptom[]

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={ld.container}>
        <View style={ld.header}>
          <Text style={ld.title}>Registrar hoy</Text>
          <TouchableOpacity onPress={onClose}><Text style={ld.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing[5], gap: Spacing[5], paddingBottom: 60 }}>

          {/* Mood */}
          <View>
            <Text style={ld.sectionLabel}>¿Cómo te sientes?</Text>
            <View style={ld.moodRow}>
              {MOODS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[ld.moodChip, mood === m && ld.moodChipOn]}
                  onPress={() => setMood(m)}
                >
                  <Text style={ld.moodEmoji}>{MOOD_LABELS[m].split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Flow */}
          <View>
            <Text style={ld.sectionLabel}>Flujo menstrual</Text>
            <View style={ld.flowRow}>
              {FLOWS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[ld.flowChip, flow === f && ld.flowChipOn]}
                  onPress={() => setFlow(f)}
                >
                  <Text style={[ld.flowTxt, flow === f && ld.flowTxtOn]}>
                    {FLOW_LABELS[f].split(' ').slice(1).join(' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Symptoms */}
          <View>
            <Text style={ld.sectionLabel}>Síntomas (selecciona los que apliquen)</Text>
            <View style={ld.symptomsGrid}>
              {ALL_SYMPTOMS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[ld.symptomChip, symptoms.includes(s) && ld.symptomChipOn]}
                  onPress={() => toggleSymptom(s)}
                >
                  <Text style={[ld.symptomTxt, symptoms.includes(s) && ld.symptomTxtOn]}>
                    {SYMPTOM_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={ld.saveBtn} onPress={handleSave}>
            <Text style={ld.saveTxt}>Guardar registro</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const ld = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  title: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  close: { fontSize: 22, color: Colors.dark.textSecondary },
  sectionLabel: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text, marginBottom: Spacing[3] },
  moodRow: { flexDirection: 'row', gap: Spacing[3] },
  moodChip: { flex: 1, alignItems: 'center', paddingVertical: Spacing[3], borderRadius: BorderRadius.lg, backgroundColor: Colors.dark.surface, borderWidth: 1.5, borderColor: Colors.dark.border },
  moodChipOn: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[900] + '40' },
  moodEmoji: { fontSize: 26 },
  flowRow: { flexDirection: 'row', gap: Spacing[2] },
  flowChip: { flex: 1, alignItems: 'center', paddingVertical: Spacing[3], borderRadius: BorderRadius.md, backgroundColor: Colors.dark.surface, borderWidth: 1.5, borderColor: Colors.dark.border },
  flowChipOn: { borderColor: '#FF375F', backgroundColor: '#FF375F20' },
  flowTxt: { fontSize: Typography.fontSize.xs, fontWeight: '600', color: Colors.dark.textSecondary, textAlign: 'center' },
  flowTxtOn: { color: '#FF375F' },
  symptomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  symptomChip: { paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], borderRadius: BorderRadius.full, backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border },
  symptomChipOn: { backgroundColor: Colors.primary[900] + '40', borderColor: Colors.primary[500] },
  symptomTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary },
  symptomTxtOn: { color: Colors.primary[400] },
  saveBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center' },
  saveTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function MenstrualScreen() {
  const router = useRouter()
  const {
    cycles, isTracking, cycleLength, periodLength,
    load, setTracking, logPeriodStart, logPeriodEnd,
    getPrediction, getPhaseNutrition, getLogForDate,
    updateCycleLength, updatePeriodLength,
  } = useMenstrualStore()

  const [logModal, setLogModal] = useState(false)
  const [tab, setTab] = useState<'cycle' | 'nutrition' | 'history'>('cycle')

  useEffect(() => { load() }, [])

  const prediction = getPrediction()
  const phaseNutrition = getPhaseNutrition()
  const todayStr = new Date().toISOString().split('T')[0]
  const todayLog = getLogForDate(todayStr)
  const currentCycle = cycles.length > 0 ? cycles[cycles.length - 1] : null
  const isPeriodActive = currentCycle && !currentCycle.endDate

  if (!isTracking) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}><Text style={s.backTxt}>‹</Text></TouchableOpacity>
          <Text style={s.title}>Ciclo menstrual</Text>
        </View>
        <View style={s.enableWrap}>
          <Text style={s.enableEmoji}>🌸</Text>
          <Text style={s.enableTitle}>Seguimiento de ciclo</Text>
          <Text style={s.enableSub}>
            Registra tu ciclo menstrual para recibir recomendaciones nutricionales personalizadas según tu fase hormonal
          </Text>
          <View style={s.featureList}>
            {[
              '🩸 Registro de período y síntomas',
              '📅 Predicción del próximo ciclo',
              '🥗 Nutrición adaptada a cada fase',
              '✨ Ventana fértil y ovulación',
              '😊 Registro diario de estado de ánimo',
            ].map(f => (
              <View key={f} style={s.featureRow}>
                <Text style={s.featureTxt}>{f}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.enableBtn} onPress={() => setTracking(true)}>
            <Text style={s.enableBtnTxt}>Activar seguimiento</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.backTxt}>‹</Text></TouchableOpacity>
        <Text style={s.title}>Mi ciclo</Text>
        <TouchableOpacity style={s.logBtn} onPress={() => setLogModal(true)}>
          <Text style={s.logBtnTxt}>+ Registrar hoy</Text>
        </TouchableOpacity>
      </View>

      {/* Today log summary */}
      {todayLog && (
        <View style={s.todayBanner}>
          <Text style={s.todayBannerTxt}>
            Hoy: {MOOD_LABELS[todayLog.mood]} · {todayLog.symptoms.length} síntoma{todayLog.symptoms.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        {(['cycle', 'nutrition', 'history'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabOn]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtOn]}>
              {t === 'cycle' ? '📅 Ciclo' : t === 'nutrition' ? '🥗 Nutrición' : '📋 Historial'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Cycle Tab ── */}
        {tab === 'cycle' && (
          <>
            {prediction ? (
              <>
                <View style={s.section}>
                  <CycleWheel
                    dayOfCycle={prediction.dayOfCycle}
                    cycleLength={cycleLength}
                    phase={prediction.currentPhase}
                  />
                </View>

                {/* Upcoming dates */}
                <View style={s.section}>
                  <Text style={s.cardTitle}>Próximas fechas</Text>
                  <View style={s.card}>
                    <DateRow
                      emoji="🩸"
                      label="Próximo período"
                      date={prediction.nextPeriodDate}
                      highlight={prediction.daysUntilPeriod <= 3}
                      daysLabel={prediction.daysUntilPeriod > 0
                        ? `en ${prediction.daysUntilPeriod} días`
                        : 'hoy o mañana'}
                    />
                    <DateRow emoji="✨" label="Ovulación" date={prediction.ovulationDate} />
                    <DateRow emoji="🌿" label="Ventana fértil" date={`${prediction.fertileStart} – ${prediction.fertileEnd}`} />
                  </View>
                </View>

                {/* Period controls */}
                <View style={s.section}>
                  <View style={s.periodBtns}>
                    {isPeriodActive ? (
                      <TouchableOpacity
                        style={[s.periodBtn, { borderColor: Colors.accent.green }]}
                        onPress={() => Alert.alert('¿Termina tu período?', 'Esto marcará el fin del período actual.', [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Sí, termina', onPress: () => logPeriodEnd() },
                        ])}
                      >
                        <Text style={[s.periodBtnTxt, { color: Colors.accent.green }]}>✓ Marcar fin del período</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[s.periodBtn, { borderColor: '#FF375F' }]}
                        onPress={() => Alert.alert('¿Inició tu período?', 'Esto registrará el inicio de un nuevo ciclo.', [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Sí, inició', onPress: () => logPeriodStart() },
                        ])}
                      >
                        <Text style={[s.periodBtnTxt, { color: '#FF375F' }]}>🩸 Inició mi período</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Cycle settings */}
                <View style={s.section}>
                  <Text style={s.cardTitle}>Configuración del ciclo</Text>
                  <View style={s.card}>
                    <View style={s.settingRow}>
                      <Text style={s.settingLabel}>Duración del ciclo</Text>
                      <View style={s.counter}>
                        <TouchableOpacity style={s.counterBtn} onPress={() => updateCycleLength(cycleLength - 1)}>
                          <Text style={s.counterBtnTxt}>−</Text>
                        </TouchableOpacity>
                        <Text style={s.counterVal}>{cycleLength} días</Text>
                        <TouchableOpacity style={s.counterBtn} onPress={() => updateCycleLength(cycleLength + 1)}>
                          <Text style={s.counterBtnTxt}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={[s.settingRow, { borderTopWidth: 1, borderTopColor: Colors.dark.border, marginTop: Spacing[3], paddingTop: Spacing[3] }]}>
                      <Text style={s.settingLabel}>Duración del período</Text>
                      <View style={s.counter}>
                        <TouchableOpacity style={s.counterBtn} onPress={() => updatePeriodLength(periodLength - 1)}>
                          <Text style={s.counterBtnTxt}>−</Text>
                        </TouchableOpacity>
                        <Text style={s.counterVal}>{periodLength} días</Text>
                        <TouchableOpacity style={s.counterBtn} onPress={() => updatePeriodLength(periodLength + 1)}>
                          <Text style={s.counterBtnTxt}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              /* No cycles logged yet */
              <View style={s.section}>
                <View style={s.card}>
                  <View style={s.noCycleWrap}>
                    <Text style={s.noCycleEmoji}>🩸</Text>
                    <Text style={s.noCycleTxt}>Sin ciclos registrados</Text>
                    <Text style={s.noCycleSub}>Registra el inicio de tu período para comenzar el seguimiento</Text>
                    <TouchableOpacity style={s.noCycleBtn} onPress={() => logPeriodStart()}>
                      <Text style={s.noCycleBtnTxt}>Registrar inicio de período</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Disable tracking */}
            <View style={[s.section, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border }]}>
              <Text style={s.settingLabel}>Seguimiento activo</Text>
              <Switch
                value={isTracking}
                onValueChange={setTracking}
                trackColor={{ true: Colors.primary[500], false: Colors.dark.border }}
                thumbColor="#fff"
              />
            </View>
          </>
        )}

        {/* ── Nutrition Tab ── */}
        {tab === 'nutrition' && phaseNutrition && (
          <>
            <View style={s.section}>
              <View style={[s.phaseCard, { borderColor: PHASE_COLORS[phaseNutrition.phase] + '60' }]}>
                <Text style={s.phaseEmoji}>{phaseNutrition.emoji}</Text>
                <Text style={[s.phaseTitle, { color: PHASE_COLORS[phaseNutrition.phase] }]}>{phaseNutrition.title}</Text>
                <Text style={s.phaseDesc}>{phaseNutrition.description}</Text>
              </View>
            </View>

            <View style={s.section}>
              <Text style={s.cardTitle}>Ajustes nutricionales</Text>
              <View style={s.card}>
                <View style={s.nutriRow}>
                  <Text style={s.nutriEmoji}>🌾</Text>
                  <Text style={s.nutriLabel}>Carbohidratos</Text>
                  <Text style={[s.nutriAdj, { color: phaseNutrition.carbAdjust > 0 ? Colors.accent.green : Colors.dark.textTertiary }]}>
                    {phaseNutrition.carbAdjust > 0 ? `+${phaseNutrition.carbAdjust}%` : 'Normal'}
                  </Text>
                </View>
                {phaseNutrition.ironFocus && (
                  <View style={[s.nutriRow, { borderTopWidth: 1, borderTopColor: Colors.dark.border }]}>
                    <Text style={s.nutriEmoji}>🔴</Text>
                    <Text style={s.nutriLabel}>Hierro</Text>
                    <Text style={[s.nutriAdj, { color: Colors.accent.orange }]}>Prioridad alta</Text>
                  </View>
                )}
                {phaseNutrition.magnesiumFocus && (
                  <View style={[s.nutriRow, { borderTopWidth: 1, borderTopColor: Colors.dark.border }]}>
                    <Text style={s.nutriEmoji}>🫐</Text>
                    <Text style={s.nutriLabel}>Magnesio</Text>
                    <Text style={[s.nutriAdj, { color: Colors.accent.orange }]}>Prioridad alta</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={s.section}>
              <Text style={s.cardTitle}>Recomendaciones de esta fase</Text>
              <View style={[s.card, { gap: Spacing[3] }]}>
                {phaseNutrition.tips.map((tip, i) => (
                  <View key={i} style={s.tipRow}>
                    <View style={s.tipDot} />
                    <Text style={s.tipTxt}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Phase roadmap */}
            <View style={s.section}>
              <Text style={s.cardTitle}>Las 4 fases del ciclo</Text>
              <View style={[s.card, { gap: Spacing[3] }]}>
                {(['menstrual', 'follicular', 'ovulation', 'luteal'] as CyclePhase[]).map(p => (
                  <View key={p} style={[s.phaseRowSmall, phaseNutrition.phase === p && { backgroundColor: PHASE_COLORS[p] + '15', borderRadius: BorderRadius.base, padding: Spacing[2] }]}>
                    <View style={[s.phaseDot, { backgroundColor: PHASE_COLORS[p] }]} />
                    <Text style={[s.phaseRowTxt, phaseNutrition.phase === p && { color: PHASE_COLORS[p], fontWeight: '700' }]}>
                      {p === 'menstrual' ? '🩸 Días 1-5' : p === 'follicular' ? '🌱 Días 6-13' : p === 'ovulation' ? '✨ Días 14-16' : '🌙 Días 17-28'} — {PHASE_LABELS[p]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {tab === 'nutrition' && !phaseNutrition && (
          <View style={s.section}>
            <View style={s.card}>
              <Text style={[s.noCycleSub, { textAlign: 'center', padding: Spacing[4] }]}>Registra tu período para ver recomendaciones nutricionales personalizadas</Text>
            </View>
          </View>
        )}

        {/* ── History Tab ── */}
        {tab === 'history' && (
          <>
            {cycles.length === 0 ? (
              <View style={s.section}>
                <View style={s.card}>
                  <View style={s.noCycleWrap}>
                    <Text style={s.noCycleEmoji}>📋</Text>
                    <Text style={s.noCycleTxt}>Sin historial</Text>
                    <Text style={s.noCycleSub}>Los ciclos registrados aparecerán aquí</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={s.section}>
                {cycles.slice().reverse().map(cycle => (
                  <View key={cycle.id} style={s.historyCard}>
                    <View style={s.historyHeader}>
                      <Text style={s.historyDate}>{cycle.startDate}</Text>
                      {cycle.duration && <Text style={s.historyDuration}>{cycle.duration} días</Text>}
                      {!cycle.endDate && <View style={s.activeBadge}><Text style={s.activeBadgeTxt}>Activo</Text></View>}
                    </View>
                    {cycle.endDate && (
                      <Text style={s.historyEnd}>Fin: {cycle.endDate}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

      </ScrollView>

      <LogDayModal visible={logModal} onClose={() => setLogModal(false)} />
    </SafeAreaView>
  )
}

function DateRow({ emoji, label, date, highlight, daysLabel }: {
  emoji: string; label: string; date: string; highlight?: boolean; daysLabel?: string
}) {
  return (
    <View style={dr.row}>
      <Text style={dr.emoji}>{emoji}</Text>
      <Text style={dr.label}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[dr.date, highlight && { color: Colors.accent.orange }]}>{date}</Text>
        {daysLabel && <Text style={[dr.days, highlight && { color: Colors.accent.orange }]}>{daysLabel}</Text>}
      </View>
    </View>
  )
}
const dr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border, gap: Spacing[3] },
  emoji: { fontSize: 18, width: 22 },
  label: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary },
  date: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text },
  days: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingTop: Spacing[3], paddingBottom: Spacing[3], gap: Spacing[3] },
  backTxt: { fontSize: 28, color: Colors.dark.text, fontWeight: '300' },
  title: { flex: 1, fontSize: Typography.fontSize.xl, fontWeight: '900', color: Colors.dark.text },
  logBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2] },
  logBtnTxt: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: '#fff' },
  todayBanner: { marginHorizontal: Spacing[5], marginBottom: Spacing[2], backgroundColor: Colors.primary[500] + '15', borderRadius: BorderRadius.base, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2] },
  todayBannerTxt: { fontSize: Typography.fontSize.xs, color: Colors.primary[400], fontWeight: '600' },
  tabs: { flexDirection: 'row', marginHorizontal: Spacing[5], marginBottom: Spacing[4], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: 3, gap: 3 },
  tab: { flex: 1, paddingVertical: Spacing[2], borderRadius: BorderRadius.md, alignItems: 'center' },
  tabOn: { backgroundColor: Colors.primary[500] },
  tabTxt: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textSecondary },
  tabTxtOn: { color: '#fff' },
  section: { marginHorizontal: Spacing[5], marginBottom: Spacing[4] },
  card: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border },
  cardTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text, marginBottom: Spacing[3] },
  phaseCard: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.xl, padding: Spacing[6], borderWidth: 2, alignItems: 'center', gap: Spacing[2] },
  phaseEmoji: { fontSize: 48 },
  phaseTitle: { fontSize: Typography.fontSize.xl, fontWeight: '900' },
  phaseDesc: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 20 },
  nutriRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[2] },
  nutriEmoji: { fontSize: 18, width: 22 },
  nutriLabel: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark.text },
  nutriAdj: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  tipRow: { flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start' },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary[500], marginTop: 6 },
  tipTxt: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, lineHeight: 20 },
  phaseRowSmall: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseRowTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary },
  periodBtns: { gap: Spacing[3] },
  periodBtn: { borderWidth: 1.5, borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center' },
  periodBtnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLabel: { fontSize: Typography.fontSize.sm, color: Colors.dark.text, fontWeight: '500' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  counterBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.dark.border, alignItems: 'center', justifyContent: 'center' },
  counterBtnTxt: { fontSize: 18, color: Colors.dark.text, fontWeight: '700', lineHeight: 22 },
  counterVal: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text, minWidth: 60, textAlign: 'center' },
  noCycleWrap: { alignItems: 'center', padding: Spacing[6], gap: Spacing[3] },
  noCycleEmoji: { fontSize: 48 },
  noCycleTxt: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  noCycleSub: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 20 },
  noCycleBtn: { backgroundColor: '#FF375F', borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[6], paddingVertical: Spacing[3], marginTop: Spacing[2] },
  noCycleBtnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  historyCard: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border, marginBottom: Spacing[3] },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  historyDate: { flex: 1, fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text },
  historyDuration: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary },
  historyEnd: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, marginTop: Spacing[1] },
  activeBadge: { backgroundColor: Colors.accent.green + '20', borderRadius: BorderRadius.full, paddingHorizontal: Spacing[2], paddingVertical: 2 },
  activeBadgeTxt: { fontSize: 10, fontWeight: '700', color: Colors.accent.green },
  // Enable screen
  enableWrap: { flex: 1, alignItems: 'center', padding: Spacing[8], gap: Spacing[4] },
  enableEmoji: { fontSize: 64 },
  enableTitle: { fontSize: Typography.fontSize['2xl'], fontWeight: '900', color: Colors.dark.text },
  enableSub: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 22 },
  featureList: { width: '100%', gap: Spacing[2] },
  featureRow: { padding: Spacing[3], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.dark.border },
  featureTxt: { fontSize: Typography.fontSize.sm, color: Colors.dark.text },
  enableBtn: { backgroundColor: '#FF375F', borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[8], paddingVertical: Spacing[4] },
  enableBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '900', color: '#fff' },
})
