import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Circle } from 'react-native-svg'
import { useAuthStore } from '@/store/authStore'
import { useNutritionStore } from '@/store/nutritionStore'
import { useWorkoutStore } from '@/store/workoutStore'
import { useHealthStore } from '@/store/healthStore'
import { useStreakStore } from '@/store/streakStore'
import { useProgressStore } from '@/store/progressStore'
import { useChallengeStore } from '@/store/challengeStore'
import { useAchievementStore } from '@/store/achievementStore'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { useDuelStore } from '@/store/duelStore'
import { Colors, Typography, Spacing, BorderRadius, Glass } from '@/constants/theme'
import { GlassCard, SectionLabel, GlassProgress, GlassSep } from '@/components/ui/Glass'

type IconName = React.ComponentProps<typeof Ionicons>['name']

// ── Design helpers ─────────────────────────────────────────────────────────────

const G = {
  card:      Glass.card,
  border:    Glass.cardBorder,
  highlight: Glass.cardHighlight,
  elev:      Glass.elevated,
}

// ── Health Score Ring ─────────────────────────────────────────────────────────

function HealthScoreRing({ score }: { score: number }) {
  const R = 60
  const STROKE = 9
  const circ = 2 * Math.PI * R
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? Colors.accent.green : score >= 55 ? Colors.primary[400] : Colors.accent.orange
  const label = score >= 80 ? 'Excelente' : score >= 55 ? 'Muy bien' : score >= 30 ? 'Regular' : 'Empezando'

  return (
    <View style={hr.wrap}>
      <Svg width={136} height={136} viewBox="0 0 136 136">
        <Circle cx={68} cy={68} r={R} stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} fill="none" />
        <Circle
          cx={68} cy={68} r={R}
          stroke={color} strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin="68, 68"
        />
      </Svg>
      <View style={hr.center}>
        <Text style={[hr.num, { color }]}>{score}</Text>
        <Text style={[hr.label, { color }]}>{label}</Text>
        <Text style={hr.sub}>SCORE</Text>
      </View>
    </View>
  )
}

const hr = StyleSheet.create({
  wrap: { width: 136, height: 136, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center' },
  num: { fontSize: 36, fontWeight: '900', lineHeight: 40 },
  label: { fontSize: 9, fontWeight: '800', marginTop: 0 },
  sub: { fontSize: 7, color: 'rgba(255,255,255,0.3)', marginTop: 1, letterSpacing: 1.5 },
})

// ── Score Pill ─────────────────────────────────────────────────────────────────

function ScorePill({ label, val, max, color }: {
  label: string; val: number; max: number; color: string
}) {
  const pct = max > 0 ? Math.min(val / max, 1) : 0
  return (
    <View style={sp.wrap}>
      <Text style={[sp.val, { color }]}>{val}</Text>
      <Text style={sp.max}>/{max}</Text>
      <View style={sp.bar}>
        <View style={[sp.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={sp.label}>{label}</Text>
    </View>
  )
}

const sp = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 3 },
  val: { fontSize: 17, fontWeight: '900' },
  max: { fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: -2, fontWeight: '500' },
  bar: { width: '100%', height: 3, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
  label: { fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
})

// ── Streak Row ────────────────────────────────────────────────────────────────

function StreakRow({ weekActivity, currentStreak }: {
  weekActivity: Array<{ date: string; loggedFood: boolean; loggedWorkout: boolean; checkInDone: boolean; drank8Glasses: boolean }>
  currentStreak: number
}) {
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const today = new Date().toISOString().slice(0, 10)

  return (
    <GlassCard style={sr.wrap} noPad>
      <View style={sr.inner}>
        <View style={sr.left}>
          <Text style={sr.bigNum}>{currentStreak}</Text>
          <Text style={sr.bigLabel}>días de racha</Text>
        </View>
        <View style={sr.dots}>
          {weekActivity.map((day, i) => {
            const active = day.loggedFood || day.loggedWorkout || day.checkInDone
            const isToday = day.date === today
            return (
              <View key={day.date} style={sr.dotCol}>
                <View style={[
                  sr.dot,
                  active ? sr.dotOn : sr.dotOff,
                  isToday && sr.dotToday,
                ]}>
                  {active && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={[sr.dayLabel, isToday && { color: Colors.primary[400] }]}>{labels[i]}</Text>
              </View>
            )
          })}
        </View>
      </View>
    </GlassCard>
  )
}

const sr = StyleSheet.create({
  wrap: {},
  inner: { flexDirection: 'row', alignItems: 'center', gap: Spacing[4], padding: Spacing[4] },
  left: { alignItems: 'center', minWidth: 64 },
  bigNum: { fontSize: 36, fontWeight: '900', color: Colors.accent.orange, lineHeight: 40 },
  bigLabel: { fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  dotCol: { alignItems: 'center', gap: 4 },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: Colors.accent.green },
  dotOff: { backgroundColor: 'rgba(255,255,255,0.07)' },
  dotToday: { borderWidth: 1.5, borderColor: Colors.primary[500] },
  dayLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: '700' },
})

// ── Daily Check-In Modal ──────────────────────────────────────────────────────

type SliderKey = 'sleep' | 'energy' | 'mood' | 'stress'

function CheckInModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { saveCheckIn } = useHealthStore()
  const { markActivity } = useStreakStore()
  const [sleep, setSleep] = useState(7)
  const [energy, setEnergy] = useState(7)
  const [mood, setMood] = useState(7)
  const [stress, setStress] = useState(3)
  const [intention, setIntention] = useState('')

  const metrics: Array<{
    key: SliderKey; label: string; val: number; set: (n: number) => void; lo: string; hi: string
  }> = [
    { key: 'sleep',  label: 'Calidad de sueño',  val: sleep,  set: setSleep,  lo: 'Malísimo',   hi: 'Perfecto' },
    { key: 'energy', label: 'Nivel de energía',   val: energy, set: setEnergy, lo: 'Sin energía', hi: 'A tope' },
    { key: 'mood',   label: 'Estado de ánimo',    val: mood,   set: setMood,   lo: 'Muy bajo',    hi: 'Excelente' },
    { key: 'stress', label: 'Nivel de estrés',    val: stress, set: setStress, lo: 'Relajado',    hi: 'Alto' },
  ]

  const handleSave = async () => {
    const today = new Date().toISOString().slice(0, 10)
    await saveCheckIn({ sleep, energy, mood, stress, intention })
    await markActivity(today, { checkInDone: true })
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={ci.container}>
        <View style={ci.header}>
          <View>
            <Text style={ci.brand}>CHECK-IN</Text>
            <Text style={ci.title}>¿Cómo estás hoy?</Text>
          </View>
          <TouchableOpacity style={ci.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={ci.body} showsVerticalScrollIndicator={false}>
          <Text style={ci.intro}>La honestidad aquí es poder. Tu bienestar importa.</Text>

          {metrics.map(item => (
            <View key={item.key} style={ci.metricWrap}>
              <View style={ci.metricHeader}>
                <Text style={ci.metricLabel}>{item.label}</Text>
                <View style={ci.metricBadge}>
                  <Text style={ci.metricBadgeTxt}>{item.val}/10</Text>
                </View>
              </View>
              <View style={ci.scaleRow}>
                <Text style={ci.scaleLo}>{item.lo}</Text>
                <View style={ci.scaleDots}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[ci.dot, item.val >= n && ci.dotOn]}
                      onPress={() => item.set(n)}
                    />
                  ))}
                </View>
                <Text style={ci.scaleHi}>{item.hi}</Text>
              </View>
            </View>
          ))}

          <View style={ci.metricWrap}>
            <Text style={ci.metricLabel}>Intención de hoy</Text>
            <TextInput
              style={ci.intentInput}
              value={intention}
              onChangeText={setIntention}
              placeholder="Hoy voy a..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              multiline
              numberOfLines={2}
            />
          </View>

          <TouchableOpacity style={ci.saveBtn} onPress={handleSave}>
            <Text style={ci.saveBtnTxt}>Activar mi día</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const ci = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  brand: { fontSize: 9, fontWeight: '900', color: Colors.primary[500], letterSpacing: 2.5, marginBottom: 4 },
  title: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: '#f4f4f5' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: G.card, borderWidth: 1, borderColor: G.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  body: { padding: Spacing[5], gap: Spacing[5], paddingBottom: 40 },
  intro: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.45)', lineHeight: 22 },
  metricWrap: { gap: Spacing[3] },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#f4f4f5' },
  metricBadge: { backgroundColor: `${Colors.primary[500]}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: `${Colors.primary[500]}35` },
  metricBadgeTxt: { fontSize: 11, fontWeight: '700', color: Colors.primary[400] },
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  scaleLo: { fontSize: 9, color: 'rgba(255,255,255,0.3)', width: 50, textAlign: 'right' },
  scaleHi: { fontSize: 9, color: 'rgba(255,255,255,0.3)', width: 50 },
  scaleDots: { flex: 1, flexDirection: 'row', gap: 3, justifyContent: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: Glass.cardBorder },
  dotOn: { backgroundColor: Colors.primary[500], borderColor: 'transparent' },
  intentInput: { backgroundColor: G.card, borderWidth: 1, borderColor: G.border, borderRadius: 14, padding: Spacing[4], fontSize: Typography.fontSize.sm, color: '#f4f4f5', lineHeight: 22 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary[500], borderRadius: 16, padding: Spacing[4], marginTop: 8 },
  saveBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})

// ── XP Level Card ─────────────────────────────────────────────────────────────

function XPCard() {
  const { totalXP, getCurrentLevel, getNextLevel, getLevelProgress, streakShields } = useAchievementStore()
  const current = getCurrentLevel()
  const next = getNextLevel()
  const pct = getLevelProgress()

  return (
    <GlassCard
      elevated
      accent={Colors.primary[500]}
      onPress={() => router.push('/achievements')}
    >
      <View style={xp.row}>
        <View style={xp.left}>
          <Text style={xp.emoji}>{current.emoji}</Text>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={xp.name}>{current.name}</Text>
              <View style={xp.levelBadge}>
                <Text style={xp.levelTxt}>Nivel {current.level}</Text>
              </View>
            </View>
            <Text style={xp.xpTxt}>{totalXP.toLocaleString()} XP acumulados</Text>
          </View>
        </View>
        <View style={xp.right}>
          {streakShields > 0 && (
            <View style={xp.shield}>
              <Ionicons name="shield-outline" size={12} color={Colors.accent.orange} />
              <Text style={xp.shieldTxt}>{streakShields}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
        </View>
      </View>
      <GlassSep />
      <View style={{ gap: 6 }}>
        <GlassProgress pct={pct / 100} color={Colors.primary[500]} height={5} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={xp.meta}>{pct}% hacia {next?.emoji} {next?.name}</Text>
          {next && <Text style={xp.meta}>{next.minXP.toLocaleString()} XP</Text>}
        </View>
      </View>
    </GlassCard>
  )
}

const xp = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  emoji: { fontSize: 28 },
  name: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#f4f4f5' },
  levelBadge: { backgroundColor: `${Colors.primary[500]}20`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: `${Colors.primary[500]}35` },
  levelTxt: { fontSize: 9, fontWeight: '700', color: Colors.primary[400] },
  xpTxt: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.4)' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shield: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${Colors.accent.orange}18`, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  shieldTxt: { fontSize: 11, fontWeight: '700', color: Colors.accent.orange },
  meta: { fontSize: 9, color: 'rgba(255,255,255,0.3)' },
})

// ── Challenges Card ───────────────────────────────────────────────────────────

function ChallengesCard() {
  const { getActive } = useChallengeStore()
  const active = getActive()
  if (active.length === 0) return null

  return (
    <GlassCard noPad>
      <View style={ch.header}>
        <Text style={ch.title}>Desafíos activos</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/progress')}>
          <Text style={ch.link}>Ver todos</Text>
        </TouchableOpacity>
      </View>
      <View style={ch.body}>
        {active.slice(0, 2).map(({ challenge, pctDone, daysLeft }) => (
          <View key={challenge.id} style={ch.item}>
            <View style={ch.dot}>
              <Text style={{ fontSize: 16 }}>{challenge.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={ch.itemTitle} numberOfLines={1}>{challenge.title}</Text>
                <View style={ch.xpBadge}>
                  <Text style={ch.xpTxt}>+{challenge.xpReward} XP</Text>
                </View>
              </View>
              <GlassProgress pct={pctDone} color={Colors.primary[500]} height={4} />
              <Text style={ch.sub}>{daysLeft} días restantes · {Math.round(pctDone * 100)}% completado</Text>
            </View>
          </View>
        ))}
      </View>
    </GlassCard>
  )
}

const ch = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[4], paddingBottom: Spacing[3] },
  title: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#f4f4f5' },
  link: { fontSize: Typography.fontSize.xs, color: Colors.primary[400], fontWeight: '700' },
  body: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4], gap: Spacing[3] },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 36, height: 36, borderRadius: 12, backgroundColor: `${Colors.primary[500]}18`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${Colors.primary[500]}28` },
  itemTitle: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: '#f4f4f5', flex: 1 },
  xpBadge: { backgroundColor: `${Colors.accent.yellow}18`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  xpTxt: { fontSize: 9, fontWeight: '700', color: Colors.accent.yellow },
  sub: { fontSize: 9, color: 'rgba(255,255,255,0.3)' },
})

// ── Duels Card ────────────────────────────────────────────────────────────────

function DuelsCard() {
  const { getActive, getMetricEmoji, getMetricLabel } = useDuelStore()
  const active = getActive()
  if (active.length === 0) return null

  return (
    <GlassCard noPad>
      <View style={du.header}>
        <Text style={du.title}>Duelos activos</Text>
        <TouchableOpacity onPress={() => router.push('/duels')}>
          <Text style={du.link}>Ver todos</Text>
        </TouchableOpacity>
      </View>
      <View style={du.body}>
        {active.slice(0, 2).map(duel => {
          const isWinning = duel.challenger.progress >= duel.opponent.progress
          const total = duel.challenger.progress + duel.opponent.progress
          const myPct = total > 0 ? duel.challenger.progress / total : 0.5
          const daysLeft = Math.max(0, Math.ceil((new Date(duel.endDate).getTime() - Date.now()) / 86400000))
          return (
            <TouchableOpacity key={duel.id} style={du.item} onPress={() => router.push('/duels')} activeOpacity={0.82}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={du.metric}>{getMetricEmoji(duel.metric)} {getMetricLabel(duel.metric)}</Text>
                <Text style={du.days}>{daysLeft}d restantes</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[du.player, isWinning && { color: Colors.accent.green }]}>
                  Tú: {duel.challenger.progress.toLocaleString()}
                </Text>
                <Text style={[du.player, !isWinning && { color: Colors.accent.orange }]}>
                  {duel.opponent.userName.split(' ')[0]}: {duel.opponent.progress.toLocaleString()}
                </Text>
              </View>
              <GlassProgress pct={myPct} color={isWinning ? Colors.accent.green : Colors.accent.orange} height={5} />
              <Text style={du.xp}>+{duel.xpReward} XP al ganar</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </GlassCard>
  )
}

const du = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[4], paddingBottom: Spacing[3] },
  title: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#f4f4f5' },
  link: { fontSize: Typography.fontSize.xs, color: Colors.primary[400], fontWeight: '700' },
  body: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4], gap: Spacing[3] },
  item: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: Spacing[3], borderWidth: 1, borderColor: G.border },
  metric: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: '#f4f4f5' },
  days: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)' },
  player: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  xp: { fontSize: 9, color: Colors.accent.yellow, fontWeight: '600', marginTop: 4 },
})

// ── Daily Tip ─────────────────────────────────────────────────────────────────

const TIPS = [
  { tip: 'Come despacio. Tu cerebro tarda 20 min en recibir la señal de saciedad. Quien mastica bien, come menos y disfruta más.', tag: 'Neurociencia' },
  { tip: 'El 75% de la sensación de hambre a media mañana es en realidad sed. Hidratación = energía.', tag: 'Hidratación' },
  { tip: 'Las proteínas no son solo para el gym. Son los bloques de construcción de cada célula de tu cuerpo.', tag: 'Proteína' },
  { tip: 'Consistencia supera perfección. Una semana al 80% > una semana perfecta seguida de abandono.', tag: 'Disciplina' },
  { tip: 'Dormir mal aumenta la hormona del hambre (grelina) hasta 24%. El sueño ES parte de tu plan.', tag: 'Recuperación' },
  { tip: 'Los ultraprocesados fueron diseñados para que no pares de comer. Tú controlas lo que entra.', tag: 'Consciencia' },
  { tip: 'El estrés crónico eleva el cortisol, favoreciendo el almacenamiento de grasa abdominal.', tag: 'Bienestar' },
]

function DailyTip() {
  const idx = new Date().getDate() % TIPS.length
  const { tip, tag } = TIPS[idx]
  return (
    <GlassCard style={dt.card}>
      <View style={dt.tagRow}>
        <Ionicons name="bulb-outline" size={13} color={Colors.primary[400]} />
        <Text style={dt.tag}>{tag}</Text>
      </View>
      <Text style={dt.tip}>{tip}</Text>
    </GlassCard>
  )
}

const dt = StyleSheet.create({
  card: {},
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  tag: { fontSize: 10, fontWeight: '800', color: Colors.primary[400], letterSpacing: 0.8, textTransform: 'uppercase' },
  tip: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.55)', lineHeight: 22 },
})

// ── Quick Access — Categorized ─────────────────────────────────────────────────

const QUICK_SECTIONS = [
  {
    category: 'Nutrición',
    items: [
      { id: 'recipes',  label: 'Recetas',     icon: 'restaurant-outline' as IconName,       route: '/recipes' },
      { id: 'planner',  label: 'Planificador', icon: 'calendar-outline' as IconName,         route: '/meal-planner' },
      { id: 'grocery',  label: 'Compras',      icon: 'cart-outline' as IconName,             route: '/grocery' },
      { id: 'photo',    label: 'Foto IA',      icon: 'camera-outline' as IconName,           route: '/(tabs)/nutrition' },
    ],
  },
  {
    category: 'Fitness',
    items: [
      { id: 'measures', label: 'Medidas',      icon: 'body-outline' as IconName,             route: '/measurements' },
      { id: 'macro',    label: 'Macro Cycling',icon: 'refresh-circle-outline' as IconName,   route: '/macro-cycling' },
      { id: 'cycle',    label: 'Ciclo',         icon: 'flower-outline' as IconName,           route: '/menstrual' },
      { id: 'health',   label: 'Salud',         icon: 'heart-outline' as IconName,            route: '/health-tracker' },
    ],
  },
  {
    category: 'Comunidad',
    items: [
      { id: 'ranking',  label: 'Ranking',      icon: 'trophy-outline' as IconName,           route: '/leaderboard' },
      { id: 'duels',    label: 'Duelos',        icon: 'flash-outline' as IconName,            route: '/duels' },
      { id: 'coach',    label: 'Coach IA',      icon: 'sparkles-outline' as IconName,         route: '/(tabs)/chat' },
      { id: 'achieve',  label: 'Logros',        icon: 'ribbon-outline' as IconName,           route: '/achievements' },
    ],
  },
] as const

function QuickAccessGrid() {
  return (
    <View style={qa.container}>
      {QUICK_SECTIONS.map(section => (
        <View key={section.category} style={qa.section}>
          <SectionLabel>{section.category}</SectionLabel>
          <View style={qa.row}>
            {section.items.map(item => (
              <TouchableOpacity
                key={item.id}
                style={qa.tile}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.78}
              >
                <View style={qa.tileHighlight} pointerEvents="none" />
                <View style={qa.iconWrap}>
                  <Ionicons name={item.icon} size={20} color={Colors.primary[300]} />
                </View>
                <Text style={qa.label}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

const qa = StyleSheet.create({
  container: { gap: Spacing[5] },
  section: { gap: 10 },
  row: { flexDirection: 'row', gap: Spacing[2] },
  tile: {
    flex: 1,
    backgroundColor: G.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.border,
    paddingVertical: Spacing[4],
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  tileHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: G.highlight,
  },
  iconWrap: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: `${Colors.primary[500]}14`,
    borderWidth: 1,
    borderColor: `${Colors.primary[500]}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },
})

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuthStore()
  const {
    totalCalories, totalProtein, totalCarbs, totalFat,
    waterGlasses, meals, loadToday: loadNutrition,
    addWater, removeWater,
  } = useNutritionStore()
  const { logs, loadAll: loadWorkouts } = useWorkoutStore()
  const {
    checkInDone, todayCheckIn, scoreHistory,
    loadToday: loadHealth, computeAndSaveScore,
  } = useHealthStore()
  const {
    currentStreak, weekActivity,
    load: loadStreak, getStreakMessage,
  } = useStreakStore()
  const { load: loadProgress } = useProgressStore()
  const { load: loadChallenges } = useChallengeStore()
  const { getTodayProgress, getRestingHeartRate, getSleepForDate, load: loadHealthTracker } = useHealthTrackerStore()
  const { load: loadDuels } = useDuelStore()

  const [checkInModal, setCheckInModal] = useState(false)
  const [liveScore, setLiveScore] = useState(0)
  const fadeAnim = useRef(new Animated.Value(0)).current

  const goals = (user as any)?.goals ?? {}
  const caloriesTarget = goals.calories_target ?? 2000
  const proteinTarget  = goals.protein_g ?? 150
  const carbsTarget    = goals.carbs_g ?? 200
  const fatTarget      = goals.fat_g ?? 65
  const mealsPerDay    = goals.meals_per_day ?? 3

  const today = new Date().toISOString().slice(0, 10)
  const workedOut = logs.some(l => l.date === today)
  const todayLog  = logs.find(l => l.date === today)

  const trackerProgress = getTodayProgress()
  const restHR = getRestingHeartRate()
  const sleepLog = getSleepForDate(today)

  const recompute = useCallback(async () => {
    const score = await computeAndSaveScore({
      caloriesConsumed: totalCalories,
      caloriesTarget,
      waterGlasses,
      waterTarget: 8,
      workedOut,
    })
    setLiveScore(score.total)
  }, [totalCalories, caloriesTarget, waterGlasses, workedOut])

  useEffect(() => {
    loadNutrition()
    loadHealth()
    loadStreak()
    loadProgress()
    loadWorkouts()
    loadChallenges()
    loadHealthTracker()
    loadDuels()
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start()
  }, [])

  useEffect(() => { recompute() }, [totalCalories, waterGlasses, workedOut])

  const todayScore  = scoreHistory.find(s => s.date === today)
  const firstName   = user?.full_name?.split(' ')[0] ?? 'Atleta'
  const hour        = new Date().getHours()
  const greeting    = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const calPct      = Math.min(totalCalories / Math.max(caloriesTarget, 1), 1)

  return (
    <SafeAreaView style={s.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>ZENCRUS</Text>
            <Text style={s.greeting}>{greeting}, {firstName}</Text>
            <Text style={s.date}>
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.checkInBtn, checkInDone && s.checkInBtnDone]}
            onPress={() => { if (!checkInDone) setCheckInModal(true) }}
            activeOpacity={0.8}
          >
            <Ionicons
              name={checkInDone ? 'checkmark-circle' : 'sunny-outline'}
              size={14}
              color={checkInDone ? Colors.accent.green : Colors.primary[400]}
            />
            <Text style={[s.checkInTxt, checkInDone && { color: Colors.accent.green }]}>
              {checkInDone ? 'Check-in' : 'Check-in'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Intention / prompt ── */}
        {checkInDone && todayCheckIn.intention ? (
          <View style={s.intentRow}>
            <Ionicons name="flag-outline" size={13} color={Colors.primary[400]} />
            <Text style={s.intentTxt} numberOfLines={1}>"{todayCheckIn.intention}"</Text>
          </View>
        ) : !checkInDone ? (
          <TouchableOpacity style={s.promptRow} onPress={() => setCheckInModal(true)} activeOpacity={0.8}>
            <Ionicons name="sunny-outline" size={14} color={Colors.primary[400]} />
            <Text style={s.promptTxt}>Haz tu check-in matutino para activar tu día</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
          </TouchableOpacity>
        ) : null}

        {/* ── ZENCRUS Score ── */}
        <View style={s.sec}>
          <GlassCard elevated accent={Colors.primary[500]} noPad>
            <View style={s.scoreTop}>
              <HealthScoreRing score={liveScore} />
              <View style={s.scoreInfo}>
                <Text style={s.scoreBrand}>ZENCRUS HEALTH SCORE</Text>
                <Text style={s.scoreMsg}>{getStreakMessage()}</Text>
                <View style={s.scoreMeta}>
                  <View style={s.metaItem}>
                    <Ionicons name="flame" size={12} color={Colors.accent.orange} />
                    <Text style={s.metaText}>{currentStreak} días de racha</Text>
                  </View>
                  <View style={s.metaItem}>
                    <Ionicons name={workedOut ? 'checkmark-circle' : 'ellipse-outline'} size={12} color={workedOut ? Colors.accent.green : 'rgba(255,255,255,0.3)'} />
                    <Text style={s.metaText}>{workedOut ? 'Entreno completado' : 'Sin entreno aún'}</Text>
                  </View>
                  <View style={s.metaItem}>
                    <Ionicons name={checkInDone ? 'checkmark-circle' : 'ellipse-outline'} size={12} color={checkInDone ? Colors.accent.green : 'rgba(255,255,255,0.3)'} />
                    <Text style={s.metaText}>{checkInDone ? 'Check-in hecho' : 'Check-in pendiente'}</Text>
                  </View>
                </View>
              </View>
            </View>
            {/* Score sub-components */}
            <View style={s.scoreGrid}>
              <ScorePill label="Nutrición"   val={todayScore?.nutrition  ?? 0} max={25} color={Colors.primary[400]} />
              <ScorePill label="Entreno"     val={todayScore?.workout    ?? 0} max={25} color={Colors.secondary[400]} />
              <ScorePill label="Hidratación" val={todayScore?.hydration  ?? 0} max={20} color="#38BDF8" />
              <ScorePill label="Sueño"       val={todayScore?.sleep      ?? 0} max={15} color={Colors.accent.orange} />
              <ScorePill label="Bienestar"   val={todayScore?.mood       ?? 0} max={15} color={Colors.accent.green} />
            </View>
          </GlassCard>
        </View>

        {/* ── Alimentación ── */}
        <View style={s.sec}>
          <SectionLabel action="Ver diario" onAction={() => router.push('/(tabs)/nutrition')}>
            Alimentación
          </SectionLabel>
          <GlassCard noPad>
            <View style={s.calSection}>
              <View>
                <Text style={s.calBig}>{totalCalories.toLocaleString()}</Text>
                <Text style={s.calSub}>/ {caloriesTarget.toLocaleString()} kcal</Text>
              </View>
              <View style={s.macroCol}>
                {[
                  { l: 'P', v: totalProtein, c: Colors.primary[400] },
                  { l: 'C', v: totalCarbs,   c: Colors.secondary[400] },
                  { l: 'G', v: totalFat,     c: Colors.accent.orange },
                ].map(m => (
                  <View key={m.l} style={s.macroRow}>
                    <View style={[s.macroDot, { backgroundColor: m.c }]} />
                    <Text style={s.macroTxt}>{m.l} {Math.round(m.v)}g</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={s.calBarWrap}>
              <GlassProgress pct={calPct} color={totalCalories > caloriesTarget * 1.15 ? Colors.accent.red : Colors.primary[500]} height={5} />
            </View>
            <View style={s.mealsRow}>
              {meals.slice(0, mealsPerDay).map(m => (
                <View key={m.id} style={s.mealSlot}>
                  <Text style={{ fontSize: 18 }}>{m.emoji}</Text>
                  <View style={[s.mealDot, m.entries.length > 0 && s.mealDotOn]} />
                </View>
              ))}
              <TouchableOpacity
                style={s.addMealBtn}
                onPress={() => router.push('/(tabs)/nutrition')}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={14} color="#fff" />
                <Text style={s.addMealTxt}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>

        {/* ── Actividad de hoy (horizontal scroll) ── */}
        <View style={s.sec}>
          <SectionLabel>Actividad de hoy</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.actScroll} contentContainerStyle={s.actContent}>

            {/* Water */}
            <View style={act.card}>
              <View style={act.highlight} pointerEvents="none" />
              <View style={act.top}>
                <Text style={{ fontSize: 20 }}>💧</Text>
                <Text style={act.bigVal}>{waterGlasses}<Text style={act.bigSub}>/8</Text></Text>
              </View>
              <Text style={act.label}>Hidratación</Text>
              <GlassProgress pct={waterGlasses / 8} color="#38BDF8" height={4} style={{ marginBottom: 8 }} />
              <View style={act.btnRow}>
                <TouchableOpacity style={act.btn} onPress={removeWater} activeOpacity={0.7}>
                  <Ionicons name="remove" size={14} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
                <TouchableOpacity style={[act.btn, act.btnAdd]} onPress={addWater} activeOpacity={0.7}>
                  <Ionicons name="add" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Workout */}
            <TouchableOpacity style={act.card} onPress={() => router.push('/(tabs)/workout')} activeOpacity={0.82}>
              <View style={act.highlight} pointerEvents="none" />
              <View style={[act.top, { justifyContent: 'space-between' }]}>
                <Ionicons name="barbell-outline" size={20} color={Colors.secondary[400]} />
                {workedOut && <Ionicons name="checkmark-circle" size={18} color={Colors.accent.green} />}
              </View>
              <Text style={act.label}>Entrenamiento</Text>
              <Text style={[act.status, { color: workedOut ? Colors.accent.green : 'rgba(255,255,255,0.3)' }]}>
                {workedOut ? todayLog?.routineName ?? 'Completado' : 'Pendiente'}
              </Text>
              {workedOut && todayLog && (
                <Text style={act.sub}>{todayLog.exercises.length} ejercicios</Text>
              )}
              {!workedOut && (
                <View style={[act.cta]}>
                  <Text style={act.ctaTxt}>Comenzar</Text>
                  <Ionicons name="chevron-forward" size={11} color={Colors.primary[400]} />
                </View>
              )}
            </TouchableOpacity>

            {/* Steps */}
            <TouchableOpacity style={act.card} onPress={() => router.push('/health-tracker')} activeOpacity={0.82}>
              <View style={act.highlight} pointerEvents="none" />
              <View style={act.top}>
                <Ionicons name="walk-outline" size={20} color={Colors.accent.orange} />
              </View>
              <Text style={act.label}>Pasos</Text>
              <Text style={[act.bigVal, { fontSize: 20, color: Colors.accent.orange }]}>
                {trackerProgress.steps.toLocaleString()}
              </Text>
              <GlassProgress pct={trackerProgress.pct / 100} color={Colors.accent.orange} height={4} style={{ marginTop: 8 }} />
              <Text style={act.sub}>{Math.round(trackerProgress.pct)}% de la meta</Text>
            </TouchableOpacity>

            {/* Sleep */}
            <TouchableOpacity style={act.card} onPress={() => router.push('/health-tracker')} activeOpacity={0.82}>
              <View style={act.highlight} pointerEvents="none" />
              <View style={act.top}>
                <Ionicons name="moon-outline" size={20} color="#9B8FFF" />
              </View>
              <Text style={act.label}>Sueño</Text>
              <Text style={[act.bigVal, { fontSize: 20, color: '#9B8FFF' }]}>
                {sleepLog ? `${sleepLog.totalHours}h` : '—'}
              </Text>
              {sleepLog && (
                <GlassProgress pct={Math.min(sleepLog.totalHours / 9, 1)} color="#9B8FFF" height={4} style={{ marginTop: 8 }} />
              )}
              <Text style={act.sub}>{restHR} BPM reposo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ── Racha ── */}
        <View style={s.sec}>
          <SectionLabel>Racha semanal</SectionLabel>
          <StreakRow weekActivity={weekActivity} currentStreak={currentStreak} />
        </View>

        {/* ── XP ── */}
        <View style={s.sec}>
          <SectionLabel>Nivel y progreso</SectionLabel>
          <XPCard />
        </View>

        {/* ── Desafíos y Duelos ── */}
        <View style={s.sec}>
          <SectionLabel>Competición</SectionLabel>
          <ChallengesCard />
          <View style={{ height: 10 }} />
          <DuelsCard />
        </View>

        {/* ── Accesos rápidos ── */}
        <View style={s.sec}>
          <QuickAccessGrid />
        </View>

        {/* ── Tip del día ── */}
        <View style={s.sec}>
          <SectionLabel>Conocimiento</SectionLabel>
          <DailyTip />
        </View>

      </ScrollView>
      </Animated.View>

      <CheckInModal visible={checkInModal} onClose={() => setCheckInModal(false)} />
    </SafeAreaView>
  )
}

// ── Activity card mini (horizontal scroll) ────────────────────────────────────

const act = StyleSheet.create({
  card: {
    width: 148,
    backgroundColor: G.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: G.border,
    padding: 14,
    marginRight: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
    gap: 4,
  },
  highlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: G.highlight,
  },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  bigVal: { fontSize: 26, fontWeight: '900', color: '#f4f4f5', marginLeft: 8 },
  bigSub: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  status: { fontSize: Typography.fontSize.xs, fontWeight: '700', marginTop: 2 },
  sub: { fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 },
  ctaTxt: { fontSize: 10, fontWeight: '700', color: Colors.primary[400] },
  btnRow: { flexDirection: 'row', gap: 6 },
  btn: {
    flex: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: G.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAdd: { backgroundColor: `${Colors.primary[500]}30`, borderColor: `${Colors.primary[500]}40` },
})

// ── Main styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  content: { paddingBottom: 140 },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[4],
  },
  brand: { fontSize: 9, fontWeight: '900', color: Colors.primary[500], letterSpacing: 3.5, marginBottom: 4 },
  greeting: { fontSize: Typography.fontSize['2xl'], fontWeight: '800', color: '#f4f4f5' },
  date: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)', marginTop: 3, textTransform: 'capitalize' },
  checkInBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: G.card,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: `${Colors.primary[500]}40`,
    marginTop: 4,
  },
  checkInBtnDone: { borderColor: `${Colors.accent.green}40` },
  checkInTxt: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.primary[400] },
  // Banners
  intentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing[5], marginBottom: Spacing[3],
    backgroundColor: `${Colors.primary[500]}10`,
    borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: `${Colors.primary[500]}22`,
  },
  intentTxt: { flex: 1, fontSize: Typography.fontSize.xs, color: Colors.primary[300], fontStyle: 'italic' },
  promptRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing[5], marginBottom: Spacing[3],
    backgroundColor: G.card,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: G.border,
  },
  promptTxt: { flex: 1, fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.4)' },
  // Score
  scoreTop: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: Spacing[4], paddingBottom: Spacing[3] },
  scoreInfo: { flex: 1 },
  scoreBrand: { fontSize: 8, fontWeight: '900', color: Colors.primary[400], letterSpacing: 2, marginBottom: 5 },
  scoreMsg: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#f4f4f5', lineHeight: 20, marginBottom: 8 },
  scoreMeta: { gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.45)' },
  scoreGrid: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: G.border,
    paddingVertical: Spacing[3], paddingHorizontal: Spacing[4],
    gap: Spacing[1],
  },
  // Nutrition
  calSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: Spacing[4], paddingBottom: Spacing[3] },
  calBig: { fontSize: 38, fontWeight: '900', color: '#f4f4f5', lineHeight: 42 },
  calSub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  macroCol: { alignItems: 'flex-end', gap: 4, paddingTop: 4 },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  macroDot: { width: 7, height: 7, borderRadius: 3.5 },
  macroTxt: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
  calBarWrap: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[3] },
  mealsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderTopWidth: 1, borderTopColor: G.border,
    paddingHorizontal: Spacing[4], paddingVertical: 12,
  },
  mealSlot: { alignItems: 'center', gap: 4 },
  mealDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.12)' },
  mealDotOn: { backgroundColor: Colors.accent.green },
  addMealBtn: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary[500], borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  addMealTxt: { fontSize: Typography.fontSize.xs, color: '#fff', fontWeight: '800' },
  // Activity scroll
  actScroll: {},
  actContent: { paddingRight: Spacing[5] },
  // Section wrapper
  sec: { marginHorizontal: Spacing[5], marginBottom: Spacing[5] },
})
