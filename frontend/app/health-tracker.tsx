import { hoyLocal } from '@/utils/fechas'
import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { useAchievementStore } from '@/store/achievementStore'
import { detectTrend } from '@/utils/healthTrends'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { Screen, ScreenHeader } from '@/components/ui/Screen'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const QUALITY_COLORS = {
  poor: Colors.accent.red,
  fair: Colors.accent.yellow,
  good: Colors.accent.green,
  excellent: Colors.primary[400] }
const QUALITY_LABELS = {
  poor: 'Malo', fair: 'Regular', good: 'Bueno', excellent: 'Excelente' }

// ── Mini Bar Chart ──────────────────────────────────────────────────────────

/**
 * Un día sin medir no pinta barra.
 *
 * El `Math.max(4, ...)` de antes garantizaba un tocón del 4 % en TODAS las
 * columnas, hubiera dato o no. Con el historial relleno de valores inventados
 * eso no se notaba; en cuanto el historial pasó a arrancar vacío, la gráfica se
 * quedó con siete tocones iguales que se leen como siete días medidos y flojos,
 * en vez de como una semana sin registrar.
 *
 * El suelo de 4 % se queda solo para los días que SÍ tienen medición: ahí evita
 * que un valor pequeño desaparezca del todo, que es para lo que estaba puesto.
 */
function BarChart({ data, maxVal, color, unit }: { data: { date: string; value: number | null }[]; maxVal: number; color: string; unit: string }) {
  /* Con los siete días vacíos, la rejilla quedaba como un rectángulo de 100 px
     en blanco con los nombres de los días debajo: parece que la gráfica no ha
     cargado. Decir que no hay nada ocupa lo mismo y se entiende. */
  if (!data.some(d => d.value != null && d.value > 0)) {
    return (
      <View style={[chart.wrap, chart.vacio]}>
        <Text style={chart.vacioTxt}>Sin registros esta semana</Text>
      </View>
    )
  }

  return (
    <View style={chart.wrap}>
      {data.slice().reverse().map((d, i) => {
        const hay = d.value != null && d.value > 0
        const pct = hay && maxVal > 0 ? Math.min(1, (d.value as number) / maxVal) : 0
        const date = new Date(d.date + 'T12:00:00')
        return (
          <View key={i} style={chart.col}>
            <Text style={chart.val} numberOfLines={1}>
              {hay
                ? (unit === 'h'
                    ? (d.value as number).toFixed(1)
                    : (d.value as number) >= 1000 ? `${((d.value as number) / 1000).toFixed(1)}k` : d.value)
                : ''}
            </Text>
            <View style={chart.barWrap}>
              {hay && <View style={[chart.bar, { height: `${Math.max(4, pct * 100)}%` as any, backgroundColor: color }]} />}
            </View>
            <Text style={chart.label}>{DAYS[date.getDay()]}</Text>
          </View>
        )
      })}
    </View>
  )
}

const chart = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 6, height: 100, alignItems: 'flex-end', paddingBottom: 20 },
  vacio: { alignItems: 'center', justifyContent: 'center', paddingBottom: 0 },
  vacioTxt: { fontSize: 11, color: 'rgba(255,255,255,0.28)' },
  col: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barWrap: { width: '70%', height: 70, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3, minHeight: 4 },
  val: { fontSize: 8, color: Colors.dark.textTertiary, marginBottom: 2, textAlign: 'center' },
  label: { fontSize: 8, color: Colors.dark.textTertiary, position: 'absolute', bottom: 0 } })

// ── Ring Progress ───────────────────────────────────────────────────────────

function RingProgress({ pct, size = 90, color, children }: { pct: number; size?: number; color: string; children?: React.ReactNode }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const stroke = circ * (1 - Math.min(1, pct / 100))
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute' }}>
        {/* SVG ring simulation via View */}
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: 6, borderColor: Colors.dark.border }} />
        <View style={{
          position: 'absolute', width: size, height: size, borderRadius: size / 2,
          borderWidth: 6, borderColor: color,
          borderTopColor: pct > 75 ? color : 'transparent',
          borderRightColor: pct > 50 ? color : 'transparent',
          borderBottomColor: pct > 25 ? color : 'transparent',
          borderLeftColor: pct > 0 ? color : 'transparent',
          transform: [{ rotate: '-90deg' }] }} />
      </View>
      {children}
    </View>
  )
}

// ── Add Steps Modal ─────────────────────────────────────────────────────────

function AddStepsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addSteps, setTodaySteps, getTodayProgress } = useHealthTrackerStore()
  /* `todaySteps` es un contador persistido que no se reinicia de un día para
     otro, así que decía «Pasos actuales hoy: 8.000» con los del lunes. Los de
     hoy salen del historial, que lleva la fecha. */
  const hoy = getTodayProgress()
  const { updateStats } = useAchievementStore()
  const [mode, setMode] = useState<'add' | 'set'>('add')
  const [val, setVal] = useState('')

  const handle = () => {
    const n = parseInt(val)
    if (isNaN(n) || n < 0) return
    if (mode === 'add') addSteps(n)
    else setTodaySteps(n)
    setVal('')
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={asp.overlay}>
        <View style={asp.card}>
          <Text style={asp.title}>Registrar pasos</Text>
          <Text style={asp.sub}>
            {hoy.registrado
              ? `Pasos actuales hoy: ${hoy.steps.toLocaleString('es-MX')}`
              : 'Hoy todavía no has registrado pasos'}
          </Text>
          <View style={asp.modeTabs}>
            {(['add', 'set'] as const).map(m => (
              <TouchableOpacity key={m} style={[asp.modeTab, mode === m && asp.modeTabActive]} onPress={() => setMode(m)}>
                <Text style={[asp.modeTxt, mode === m && asp.modeTxtActive]}>{m === 'add' ? 'Agregar pasos' : 'Establecer total'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={asp.input}
            value={val}
            onChangeText={setVal}
            placeholder={mode === 'add' ? 'Pasos a agregar' : 'Total de pasos hoy'}
            placeholderTextColor={Colors.dark.textTertiary}
            keyboardType="number-pad"
            autoFocus
          />
          <View style={asp.actions}>
            <TouchableOpacity style={asp.cancel} onPress={onClose}><Text style={asp.cancelTxt}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={asp.save} onPress={handle}><Text style={asp.saveTxt}>Guardar</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const asp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  card: { backgroundColor: Colors.dark.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing[6] },
  title: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text, marginBottom: 4 },
  sub: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, marginBottom: Spacing[4] },
  modeTabs: { flexDirection: 'row', gap: Spacing[2], marginBottom: Spacing[4] },
  modeTab: { flex: 1, paddingVertical: Spacing[3], borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.dark.border, alignItems: 'center' },
  modeTabActive: { backgroundColor: Colors.primary[900], borderColor: Colors.primary[500] },
  modeTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, fontWeight: '600' },
  modeTxtActive: { color: Colors.primary[400] },
  input: { backgroundColor: Colors.dark.background, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: Typography.fontSize.xl, fontWeight: '600', color: Colors.dark.text, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: Spacing[4], textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing[3] },
  cancel: { flex: 1, padding: Spacing[4], borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.dark.border, alignItems: 'center' },
  cancelTxt: { color: Colors.dark.textSecondary, fontWeight: '600' },
  save: { flex: 1, padding: Spacing[4], borderRadius: BorderRadius.md, backgroundColor: Colors.primary[500], alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '700' } })

// ── Log Sleep Modal ─────────────────────────────────────────────────────────

function LogSleepModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { logSleep } = useHealthTrackerStore()
  const [bedtime, setBedtime] = useState('23:00')
  const [waketime, setWaketime] = useState('07:00')

  const handle = () => {
    logSleep({
      date: hoyLocal(),
      bedtime,
      wakeTime: waketime,
      deepSleepHours: 0,
      remSleepHours: 0 })
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={asp.overlay}>
        <View style={asp.card}>
          <Text style={asp.title}>Registrar sueño</Text>
          <View style={{ flexDirection: 'row', gap: Spacing[4], marginBottom: Spacing[5] }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginBottom: 6 }}>Hora de dormir</Text>
              <TextInput
                style={asp.input}
                value={bedtime}
                onChangeText={setBedtime}
                placeholder="23:00"
                placeholderTextColor={Colors.dark.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginBottom: 6 }}>Hora de despertar</Text>
              <TextInput
                style={asp.input}
                value={waketime}
                onChangeText={setWaketime}
                placeholder="07:00"
                placeholderTextColor={Colors.dark.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          <View style={asp.actions}>
            <TouchableOpacity style={asp.cancel} onPress={onClose}><Text style={asp.cancelTxt}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={asp.save} onPress={handle}><Text style={asp.saveTxt}>Guardar</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ── Log HR Modal ──────────────────────────────────────────────────────────

function LogHRModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { logHeartRate, getRestingHeartRate } = useHealthTrackerStore()
  const [bpm, setBpm] = useState('')
  const [type, setType] = useState<'resting' | 'active' | 'peak'>('resting')
  const resting = getRestingHeartRate()

  const handle = () => {
    const n = parseInt(bpm)
    if (isNaN(n) || n < 30 || n > 250) {
      Alert.alert('Valor inválido', 'Ingresa un valor entre 30 y 250 BPM')
      return
    }
    logHeartRate(n, type)
    setBpm('')
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={asp.overlay}>
        <View style={asp.card}>
          <Text style={asp.title}>Registrar frecuencia cardíaca</Text>
          <Text style={asp.sub}>
            {resting != null ? `FC en reposo actual: ${resting} BPM` : 'Aún no has medido tu FC en reposo'}
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing[2], marginBottom: Spacing[4] }}>
            {(['resting', 'active', 'peak'] as const).map(t => (
              <TouchableOpacity key={t} style={[asp.modeTab, type === t && asp.modeTabActive]} onPress={() => setType(t)}>
                <Text style={[asp.modeTxt, type === t && asp.modeTxtActive]}>
                  {t === 'resting' ? 'Reposo' : t === 'active' ? 'Activo' : 'Pico'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={asp.input}
            value={bpm}
            onChangeText={setBpm}
            placeholder="BPM"
            placeholderTextColor={Colors.dark.textTertiary}
            keyboardType="number-pad"
            autoFocus
          />
          <View style={asp.actions}>
            <TouchableOpacity style={asp.cancel} onPress={onClose}><Text style={asp.cancelTxt}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={asp.save} onPress={handle}><Text style={asp.saveTxt}>Guardar</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function HealthTrackerScreen() {
  const { getTodayProgress, getWeeklySummary, getRestingHeartRate, getAvgHeartRate, getSleepForDate, stepGoal, sleepGoal, stepHistory, sleepHistory, heartRateHistory } = useHealthTrackerStore()
  const [showSteps, setShowSteps] = useState(false)
  const [showSleep, setShowSleep] = useState(false)
  const [showHR, setShowHR] = useState(false)

  const today = hoyLocal()
  const progress = getTodayProgress()
  const weekly = getWeeklySummary()
  const restingHR = getRestingHeartRate()
  const avgHR = getAvgHeartRate(today)
  const todaySleep = getSleepForDate(today)

  // Tendencias — hasta 21 días de historial real, más reciente primero
  const stepsPoints = stepHistory.slice(0, 21).map(e => ({ date: e.date, value: e.steps }))
  const sleepPoints = sleepHistory.slice(0, 21).map(e => ({ date: e.date, value: e.totalHours }))
  const stepsTrend = detectTrend(stepsPoints, 'steps')
  const sleepTrend = detectTrend(sleepPoints, 'sleepHours')

  const stepsData = weekly.map(d => ({ date: d.date, value: d.steps }))
  const sleepData = weekly.map(d => ({ date: d.date, value: d.sleepHours }))
  const hrData = weekly.map(d => ({ date: d.date, value: d.avgHeartRate }))

  /**
   * La media es de los días MEDIDOS, no de siete.
   *
   * Estas cuatro cifras dividían la suma entre 7 siempre. Quien registrara dos
   * días de la semana veía su media partida entre siete: 12.000 pasos el lunes y
   * 10.000 el martes daban «3.143 pasos/día», un número que no le había pasado a
   * nadie. Y con la semana entera en blanco daba «0 pasos/día», que se lee como
   * una semana sedentaria en vez de como una semana sin datos.
   */
  const mediaDe = (valores: (number | null)[]): number | null => {
    const medidos = valores.filter((v): v is number => v != null && v > 0)
    if (!medidos.length) return null
    return medidos.reduce((a, b) => a + b, 0) / medidos.length
  }
  const mediaPasos = mediaDe(weekly.map(d => d.steps))
  const mediaSueno = mediaDe(weekly.map(d => d.sleepHours))
  const mediaKcal = mediaDe(weekly.map(d => d.caloriesBurned))

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="Zencrus · Salud"
        title="Tracker de salud"
        subtitle="Pasos, sueño y frecuencia cardiaca"
        icon="heart"
        color="#FF5871"
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing[10] }}>
        {/* Tendencias — patrones sostenidos, no reacciones a un solo día */}
        {(stepsTrend.hasEnoughData || sleepTrend.hasEnoughData) && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Tendencias</Text>
            {stepsTrend.hasEnoughData && (
              <TrendRow icon="walk" trend={stepsTrend} />
            )}
            {sleepTrend.hasEnoughData && (
              <TrendRow icon="moon" trend={sleepTrend} />
            )}
          </View>
        )}

        {/* ID médica de emergencia */}
        <TouchableOpacity style={s.medicalLink} onPress={() => router.push('/medical-id')} activeOpacity={0.85}>
          <Ionicons name="medical-outline" size={18} color={Colors.accent.red} />
          <Text style={s.medicalLinkTxt}>ID médica de emergencia</Text>
          <Text style={s.medicalLinkArrow}>›</Text>
        </TouchableOpacity>

        {/* Steps */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>👟 Pasos hoy</Text>
            <TouchableOpacity style={s.logBtn} onPress={() => setShowSteps(true)}>
              <Text style={s.logTxt}>+ Registrar</Text>
            </TouchableOpacity>
          </View>
          {/* Sin registro no hay cifra, ni derivadas, ni barra. Las kcal, los km
              y los minutos activos SALEN de los pasos: si los pasos no están
              medidos, esos tres ceros son tres afirmaciones más, no una. */}
          <View style={s.stepsRow}>
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={[s.bigNum, !progress.registrado && s.numVacio]}>
                {progress.registrado ? progress.steps.toLocaleString('es-MX') : '—'}
              </Text>
              <Text style={s.bigSub}>
                {progress.registrado
                  ? `de ${stepGoal.toLocaleString('es-MX')} pasos`
                  : `sin registro · meta ${stepGoal.toLocaleString('es-MX')}`}
              </Text>
            </View>
            {progress.registrado && (
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={s.metaStat}>🔥 {progress.calories} kcal</Text>
                <Text style={s.metaStat}>📍 {progress.km} km</Text>
                <Text style={s.metaStat}>⏱ {progress.activeMin} min activo</Text>
              </View>
            )}
          </View>
          {progress.registrado && (
            <>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${progress.pct}%` as any, backgroundColor: Colors.primary[500] }]} />
              </View>
              <Text style={s.progressLabel}>{progress.pct}% de tu meta diaria</Text>
            </>
          )}
          <BarChart data={stepsData} maxVal={stepGoal} color={Colors.primary[500]} unit="pasos" />
        </View>

        {/* Sleep */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>🌙 Sueño</Text>
            <TouchableOpacity style={s.logBtn} onPress={() => setShowSleep(true)}>
              <Text style={s.logTxt}>+ Registrar</Text>
            </TouchableOpacity>
          </View>
          {todaySleep ? (
            <View style={s.sleepRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.bigNum}>{todaySleep.totalHours}h</Text>
                <Text style={s.bigSub}>de {sleepGoal}h objetivo</Text>
                <View style={[s.qualityBadge, { backgroundColor: QUALITY_COLORS[todaySleep.quality] + '20', borderColor: QUALITY_COLORS[todaySleep.quality] + '50' }]}>
                  <Text style={[s.qualityTxt, { color: QUALITY_COLORS[todaySleep.quality] }]}>{QUALITY_LABELS[todaySleep.quality]}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={s.metaStat}>😴 Sueño profundo: {todaySleep.deepSleepHours}h</Text>
                <Text style={s.metaStat}>🧠 REM: {todaySleep.remSleepHours}h</Text>
                <Text style={s.metaStat}>🌙 {todaySleep.bedtime} → {todaySleep.wakeTime}</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.emptyLog} onPress={() => setShowSleep(true)}>
              <Text style={s.emptyLogTxt}>Toca para registrar tu sueño de anoche</Text>
            </TouchableOpacity>
          )}
          <BarChart data={sleepData} maxVal={sleepGoal + 2} color={Colors.primary[700]} unit="h" />
        </View>

        {/* Heart Rate */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>❤️ Frecuencia cardíaca</Text>
            <TouchableOpacity style={s.logBtn} onPress={() => setShowHR(true)}>
              <Text style={s.logTxt}>+ Medir</Text>
            </TouchableOpacity>
          </View>
          <View style={s.hrRow}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[s.hrBig, restingHR == null && s.hrVacio]}>{restingHR ?? '—'}</Text>
              <Text style={s.hrSub}>BPM en reposo</Text>
              {/* Sin pulso no hay veredicto: llamar «Atlético» a quien no se ha
                  medido nunca es exactamente el número inventado de antes, pero
                  escrito con letras. */}
              {restingHR != null && (
                <Text style={[s.hrZone, { color: restingHR <= 60 ? Colors.accent.green : restingHR <= 80 ? Colors.primary[400] : Colors.accent.red }]}>
                  {restingHR <= 60 ? 'Atlético' : restingHR <= 80 ? 'Normal' : 'Elevado'}
                </Text>
              )}
            </View>
            <View style={s.divider} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[s.hrBig, avgHR == null && s.hrVacio]}>{avgHR ?? '—'}</Text>
              <Text style={s.hrSub}>BPM promedio hoy</Text>
            </View>
          </View>
          <BarChart data={hrData} maxVal={200} color={Colors.accent.red} unit="BPM" />
        </View>

        {/* Weekly summary */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📊 Resumen semanal</Text>
          <View style={s.weekGrid}>
            <View style={s.weekCard}>
              <Text style={[s.weekVal, mediaPasos == null && s.weekVacio]}>
                {mediaPasos != null ? Math.round(mediaPasos).toLocaleString('es-MX') : '—'}
              </Text>
              <Text style={s.weekLabel}>pasos/día</Text>
            </View>
            <View style={s.weekCard}>
              <Text style={[s.weekVal, mediaSueno == null && s.weekVacio]}>
                {mediaSueno != null ? `${mediaSueno.toFixed(1)}h` : '—'}
              </Text>
              <Text style={s.weekLabel}>sueño/noche</Text>
            </View>
            <View style={s.weekCard}>
              <Text style={[s.weekVal, mediaKcal == null && s.weekVacio]}>
                {mediaKcal != null ? Math.round(mediaKcal) : '—'}
              </Text>
              <Text style={s.weekLabel}>kcal/día</Text>
            </View>
            <View style={s.weekCard}>
              <Text style={[s.weekVal, restingHR == null && s.weekVacio]}>{restingHR ?? '—'}</Text>
              <Text style={s.weekLabel}>BPM reposo</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <AddStepsModal visible={showSteps} onClose={() => setShowSteps(false)} />
      <LogSleepModal visible={showSleep} onClose={() => setShowSleep(false)} />
      <LogHRModal visible={showHR} onClose={() => setShowHR(false)} />
    </Screen>
  )
}

function TrendRow({ icon, trend }: { icon: keyof typeof Ionicons.glyphMap; trend: ReturnType<typeof detectTrend> }) {
  const color = trend.direction === 'improving' ? Colors.accent.green : trend.direction === 'declining' ? Colors.accent.orange : 'rgba(255,255,255,0.4)'
  const trendIcon = trend.direction === 'improving' ? 'trending-up' : trend.direction === 'declining' ? 'trending-down' : 'remove'
  return (
    <View style={s.trendRow}>
      <Ionicons name={icon} size={16} color="rgba(255,255,255,0.5)" />
      <Text style={s.trendTxt}>{trend.message}</Text>
      <Ionicons name={trendIcon as any} size={16} color={color} />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[3], borderTopWidth: 1, borderTopColor: Colors.dark.border },
  trendTxt: { flex: 1, fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.65)', lineHeight: 17 },
  medicalLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: 'rgba(255,59,48,0.06)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.2)', borderRadius: BorderRadius.lg, padding: Spacing[4], marginHorizontal: Spacing[5], marginBottom: Spacing[4] },
  medicalLinkTxt: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  medicalLinkArrow: { fontSize: 20, color: 'rgba(255,255,255,0.3)' },
  back: { fontSize: 28, color: Colors.dark.text, marginRight: Spacing[2] },
  title: { flex: 1, fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  card: { margin: Spacing[4], marginBottom: 0, backgroundColor: Colors.dark.surface, borderRadius: 16, padding: Spacing[5], borderWidth: 1, borderColor: Colors.dark.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing[4] },
  cardTitle: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text },
  logBtn: { backgroundColor: Colors.primary[900], borderRadius: BorderRadius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderWidth: 1, borderColor: Colors.primary[700] },
  logTxt: { fontSize: 11, fontWeight: '700', color: Colors.primary[400] },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing[3] },
  bigNum: { fontSize: 36, fontWeight: '800', color: Colors.dark.text, lineHeight: 40 },
  numVacio: { color: 'rgba(255,255,255,0.28)', fontWeight: '700' },
  bigSub: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 2 },
  metaStat: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary },
  progressBg: { height: 8, backgroundColor: Colors.dark.background, borderRadius: 4, overflow: 'hidden', marginBottom: Spacing[2] },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontSize: 10, color: Colors.dark.textTertiary, marginBottom: Spacing[4] },
  sleepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing[4] },
  qualityBadge: { alignSelf: 'flex-start', borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3, marginTop: Spacing[2] },
  qualityTxt: { fontSize: 11, fontWeight: '700' },
  emptyLog: { backgroundColor: Colors.dark.background, borderRadius: BorderRadius.md, padding: Spacing[5], alignItems: 'center', marginBottom: Spacing[4] },
  emptyLogTxt: { fontSize: Typography.fontSize.sm, color: Colors.dark.textTertiary, textAlign: 'center' },
  hrRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing[4] },
  hrBig: { fontSize: 32, fontWeight: '800', color: Colors.dark.text },
  hrVacio: { color: 'rgba(255,255,255,0.28)', fontWeight: '700' },
  hrSub: { fontSize: 10, color: Colors.dark.textSecondary, marginTop: 2 },
  hrZone: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  divider: { width: 1, height: 60, backgroundColor: Colors.dark.border, marginHorizontal: Spacing[4] },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  weekCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.dark.background, borderRadius: 10, padding: Spacing[4], alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  weekVal: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.dark.text },
  weekVacio: { color: 'rgba(255,255,255,0.28)', fontWeight: '700' },
  weekLabel: { fontSize: 10, color: Colors.dark.textTertiary, marginTop: 4 } })
