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
import { elegir, confirmar, logro } from '@/utils/haptica'
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

/**
 * Las dos celdas cuentan el mismo vacío de la misma forma.
 *
 * Antes no: la de sueño distinguía «sin registro» y pintaba «—», y la de pasos
 * de al lado soltaba un «0» enorme en blanco. Dos celdas gemelas, una honesta y
 * otra no, a tres centímetros la una de la otra. Mientras el historial venía
 * relleno de datos inventados nadie lo notaba, porque el cero no aparecía nunca.
 *
 * Y la barra desaparece cuando no hay medición, en las dos. Un carril vacío no
 * es neutro: dice «llevas el 0 % de tu meta», que es una afirmación sobre el día
 * de alguien de quien no sabemos nada todavía.
 */
function TodaySection() {
  const { getTodaySummary, getTodayProgress, stepGoal, sleepGoal } = useHealthTrackerStore()
  const today = getTodaySummary()
  const pasos = getTodayProgress()

  // Guardas contra meta 0: sin ellas la anchura sale 'NaN%' y el carril se rompe.
  const stepPct = stepGoal > 0 ? Math.min(pasos.steps / stepGoal, 1) : 0
  const sleepH = today.sleepHours          // null = esa noche no se registró
  const durmio = sleepH != null && sleepH > 0
  const sleepPct = durmio && sleepGoal > 0 ? Math.min(sleepH / sleepGoal, 1) : 0

  return (
    <View style={s.section}>
      <View style={ht.grid}>
        <View style={ht.cell}>
          <Ionicons name="walk" size={22} color={Colors.primary[400]} style={ht.cellEmoji} />
          <Text style={[ht.cellVal, !pasos.registrado && ht.cellValVacio]}>
            {pasos.registrado ? pasos.steps.toLocaleString('es-MX') : '—'}
          </Text>
          <Text style={ht.cellLabel}>{pasos.registrado ? 'pasos hoy' : 'sin registro'}</Text>
          {pasos.registrado && (
            <View style={ht.miniBarBg}>
              <View style={[ht.miniBarFill, { width: `${stepPct * 100}%` as any, backgroundColor: Colors.primary[400] }]} />
            </View>
          )}
        </View>
        <View style={ht.cell}>
          <Ionicons name="moon" size={22} color={Colors.secondary[400]} style={ht.cellEmoji} />
          <Text style={[ht.cellVal, !durmio && ht.cellValVacio]}>
            {durmio ? `${sleepH.toFixed(1)}h` : '—'}
          </Text>
          <Text style={ht.cellLabel}>{today.sleepQuality ? SLEEP_QUALITY[today.sleepQuality] : 'sin registro'}</Text>
          {durmio && (
            <View style={ht.miniBarBg}>
              <View style={[ht.miniBarFill, { width: `${sleepPct * 100}%` as any, backgroundColor: Colors.secondary[400] }]} />
            </View>
          )}
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
  /* El hueco no compite con el dato: si el «—» pesara lo mismo que un número,
     seguiría leyéndose como una medición. */
  cellValVacio: { color: 'rgba(255,255,255,0.28)', fontWeight: '700' },
  cellLabel: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  miniBarBg: { height: 3, backgroundColor: Glass.cardBorder, borderRadius: 2, marginTop: Spacing[2], overflow: 'hidden' },
  miniBarFill: { height: 3, borderRadius: 2 },
})

// ── Recuperación ───────────────────────────────────────────────────────────────

const RECOVERY_LABELS = ['Muy bajo', 'Bajo', 'Normal', 'Bueno', 'Excelente']

/**
 * Sin tocar nada, no hay respuesta.
 *
 * Las tres filas arrancaban en 3 con tres puntos encendidos y el rótulo
 * «Normal»: el formulario venía contestado. Quien abriera el check-in y pulsara
 * «Guardar» sin mirar, persistía un 3/3/3 que nadie había dicho — y ese
 * check-in entra en el score de recuperación con la mitad del peso.
 *
 * Es el mismo pecado que el pulso de 65, solo que en vez de fabricar el dato al
 * leerlo lo fabrica al escribirlo, que es peor: queda guardado.
 */
function StepperRow({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <View style={rc.stepperRow}>
      <Text style={rc.stepperLabel}>{label}</Text>
      <View style={rc.dots}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity key={n} onPress={() => onChange(n)} style={[rc.dot, value != null && n <= value && rc.dotOn]} activeOpacity={0.7} />
        ))}
      </View>
      <Text style={[rc.stepperHint, value == null && rc.stepperHintVacio]}>
        {value != null ? RECOVERY_LABELS[value - 1] : 'sin marcar'}
      </Text>
    </View>
  )
}

function RecoveryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { logToday, getToday } = useRecoveryStore()
  const existing = getToday()
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null)
  const [soreness, setSoreness] = useState<number | null>(existing?.soreness ?? null)
  const [stress, setStress] = useState<number | null>(existing?.stress ?? null)
  const completo = energy != null && soreness != null && stress != null

  const handleSave = async () => {
    if (!completo) return
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
            <TouchableOpacity
              style={[rc.saveBtn, !completo && rc.saveBtnOff]}
              onPress={handleSave}
              disabled={!completo}
            >
              <Text style={rc.saveBtnTxt}>
                {completo ? 'Guardar check-in' : 'Marca las tres para guardar'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/**
 * EL SCORE QUE SALÍA DE LA NADA
 * ─────────────────────────────
 * Esta tarjeta enseñaba un 70 en verde a cualquiera que abriese la app por
 * primera vez. No lo calculaba mal: `getRestingHeartRate()` devolvía 65 cuando
 * no había ni una pulsación medida, y de ese 65 salía un score de 70 exacto,
 * siempre el mismo. Debajo, el texto de ayuda remataba diciendo que el número
 * venía «de sueño y frecuencia cardíaca», que era falso y además le daba
 * procedencia de dato objetivo.
 *
 * Ahora el score puede no existir, y cuando no existe se dice. Y cuando existe
 * a medias, el texto nombra SOLO las señales que de verdad han entrado, en vez
 * de recitar una lista fija.
 */
function RecoverySection() {
  const [modal, setModal] = useState(false)
  const { getRecoveryScore, getRecoverySources, getToday, getWeeklyAverage, getTrend } = useRecoveryStore()
  const score = getRecoveryScore()
  const fuentes = getRecoverySources()
  const todayEntry = getToday()
  const weekAvg = getWeeklyAverage()
  const trend = getTrend()

  const scoreColor = score == null
    ? 'rgba(255,255,255,0.28)'
    : score >= 70 ? Colors.accent.green : score >= 40 ? Colors.accent.orange : Colors.primary[500]

  /* Nombra lo que hay, no lo que podría haber. Sin esto el texto afirmaba una
     procedencia que en la mitad de los casos no era la real. */
  const medido = [fuentes.sueno && 'tu sueño', fuentes.pulso && 'tus pulsaciones'].filter(Boolean) as string[]
  const listaMedida = medido.length === 2 ? `${medido[0]} y ${medido[1]}` : medido[0]

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
            <Text style={[rc.scoreVal, score == null && rc.scoreVacio, { color: scoreColor }]}>
              {score ?? '—'}
            </Text>
            <Text style={rc.scoreSub}>{score == null ? 'Sin datos todavía' : 'Score de hoy'}</Text>
          </View>
          {/* `trend` puede valer 'none' —serie sin puntos suficientes— y los
              ternarios de abajo no lo contemplan: caería al ramal final y
              pintaría «Estable», afirmando estabilidad de algo que no se ha
              medido. Hoy lo tapa el guarda de weekAvg, pero depender de eso es
              frágil, así que se pide explícitamente. */}
          {weekAvg && trend !== 'none' && (
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
        {/* Sin score no hay barra: una barra al 0 % se lee como «estás a cero»,
            y de lo que no se ha medido no se puede decir eso. */}
        {score != null && (
          <GlassProgress pct={score / 100} color={scoreColor} height={5} style={{ marginTop: Spacing[3] }} />
        )}
        {/* Tres estados, y ninguno recita una lista fija de señales. El de en
            medio nombra lo que de verdad ha entrado; el último existe porque un
            80 a secas, hecho con una señal de tres, se lee como un veredicto
            completo. */}
        {score == null ? (
          <Text style={rc.hint}>
            Aún no hay nada con lo que puntuar tu recuperación. Registra cómo te sientes
            y el score aparece aquí.
          </Text>
        ) : !todayEntry ? (
          <Text style={rc.hint}>
            {listaMedida
              ? `Registra cómo te sientes para afinarlo — hoy sale solo de ${listaMedida}.`
              : 'Registra cómo te sientes para afinarlo.'}
          </Text>
        ) : !listaMedida ? (
          <Text style={rc.hint}>
            Sale solo de tu check-in. Apunta tu sueño o tus pulsaciones en reposo en el
            tracker y contarán también.
          </Text>
        ) : null}
      </GlassCard>
      <RecoveryModal visible={modal} onClose={() => setModal(false)} />
    </View>
  )
}

const rc = StyleSheet.create({
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreVal: { fontSize: 40, fontWeight: '900' },
  /* Un guión a 40 px con peso 900 no se lee como «no hay dato»: se lee como una
     barra de carga a medio pintar. Al bajarlo se ve por lo que es —un hueco— y
     además deja de competir con el titular de la tarjeta. */
  scoreVacio: { fontSize: 30, fontWeight: '700', lineHeight: 42 },
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
  stepperHintVacio: { color: 'rgba(255,255,255,0.28)', fontStyle: 'italic' },
  saveBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', marginTop: Spacing[2] },
  saveBtnOff: { opacity: 0.4 },
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
              onPress={() => {
                /* Marcar el último hábito pendiente cierra el día: eso sí es
                   un logro. Desmarcar no se celebra —solo se acusa recibo—
                   porque felicitar a alguien por deshacer algo es raro. */
                toggleToday(habit.id)
                if (done) { elegir(); return }
                const faltaban = habits.filter(h => !today[h.id]).length
                faltaban <= 1 ? logro() : confirmar()
              }}
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
