import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useProgressStore } from '@/store/progressStore'
import { useAchievementStore } from '@/store/achievementStore'
import { useBodyMeasurementsStore } from '@/store/bodyMeasurementsStore'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { useEntrenoResumen } from '@/hooks/useEntreno'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import {
  LevelBadge, WeightChart, WeightModal, MeasurementsModal, AchievementCard, NavCard,
  sharedProgressStyles as s,
} from '@/components/ui/ProgressWidgets'

type StatsTab = 'body' | 'medidas' | 'logros'

const TAB_LABELS: Record<StatsTab, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  body:    { icon: 'body',    label: 'Cuerpo' },
  medidas: { icon: 'resize',  label: 'Medidas' },
  logros:  { icon: 'trophy',  label: 'Logros' },
}

// ── Totales de entrenamiento ───────────────────────────────────────────────────

function TrainingTotals() {
  const { datos } = useEntrenoResumen()
  const { getWeeklySummary } = useHealthTrackerStore()

  // Del servidor: es donde vive el historial desde que lo realizado dejó de
  // guardarse en el teléfono.
  const totalWorkouts = datos?.historico.sesiones ?? 0
  const totalHours = Math.round(((datos?.historico.minutos ?? 0) / 60) * 10) / 10
  // Aproximación de calorías totales quemadas a partir del historial diario de salud.
  const totalCalories = getWeeklySummary().reduce((sum, d) => sum + d.caloriesBurned, 0) * 4 // ~ extrapolado a un mes de historial disponible

  return (
    <View style={s.section}>
      <Text style={[s.cardTitle, { marginBottom: Spacing[3] }]}>Totales</Text>
      <View style={tt.row}>
        <View style={tt.cell}>
          <Ionicons name="barbell" size={18} color={Colors.primary[400]} />
          <Text style={tt.val}>{totalWorkouts}</Text>
          <Text style={tt.label}>Entrenamientos</Text>
        </View>
        <View style={tt.divider} />
        <View style={tt.cell}>
          <Ionicons name="time" size={18} color={Colors.secondary[400]} />
          <Text style={tt.val}>{totalHours}h</Text>
          <Text style={tt.label}>Tiempo total</Text>
        </View>
        <View style={tt.divider} />
        <View style={tt.cell}>
          <Ionicons name="flame" size={18} color={Colors.accent.orange} />
          <Text style={tt.val}>{totalCalories.toLocaleString()}</Text>
          <Text style={tt.label}>Calorías totales</Text>
        </View>
      </View>
    </View>
  )
}

const tt = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: Glass.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Glass.cardBorder, paddingVertical: Spacing[4] },
  cell: { flex: 1, alignItems: 'center', gap: 4 },
  divider: { width: 1, backgroundColor: Glass.cardBorder },
  val: { fontSize: Typography.fontSize.lg, fontWeight: '900', color: '#fff' },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
})

// ── Cuerpo tab ─────────────────────────────────────────────────────────────────

function BodyTab({ onWeight, onMeasure }: { onWeight: () => void; onMeasure: () => void }) {
  const router = useRouter()
  const { weightHistory, measurementHistory, getLatestWeight, getWeightChange } = useProgressStore()
  const latestWeight = getLatestWeight()
  const weightChange = getWeightChange()
  const latestMeasures = measurementHistory.length > 0 ? measurementHistory[measurementHistory.length - 1] : null

  return (
    <>
      <View style={s.section}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>Peso corporal</Text>
          <TouchableOpacity style={s.addBtn} onPress={onWeight}>
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
              <TouchableOpacity style={s.emptyBtn} onPress={onWeight}>
                <Text style={s.emptyBtnTxt}>Registrar ahora</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={s.section}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>Medidas rápidas</Text>
          <TouchableOpacity style={s.addBtn} onPress={onMeasure}>
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
              <TouchableOpacity style={s.emptyBtn} onPress={onMeasure}>
                <Text style={s.emptyBtnTxt}>Tomar medidas +20 XP</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

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

      <View style={s.section}>
        <NavCard emoji="📏" title="Medidas detalladas" subtitle="12 campos, fotos y evolución completa" onPress={() => router.push('/measurements')} color={Colors.accent.orange} />
        <NavCard emoji="❤️" title="Tracker de salud" subtitle="Pasos, sueño y frecuencia cardíaca" onPress={() => router.push('/health-tracker')} color={Colors.primary[400]} />
      </View>
    </>
  )
}

// ── Medidas tab ────────────────────────────────────────────────────────────────

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
            <Text style={s.cardTitle}>Último registro</Text>
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

// ── Logros tab ─────────────────────────────────────────────────────────────────

function LogrosTab({ onGoToAchievements, onGoToLeaderboard }: {
  onGoToAchievements: () => void; onGoToLeaderboard: () => void
}) {
  const { getUnlocked, getLocked, totalXP, getCurrentLevel, unlockedAchievements } = useAchievementStore()
  const unlocked = getUnlocked()
  const unlockedDateMap = Object.fromEntries(unlockedAchievements.map(u => [u.achievementId, u.unlockedAt]))
  const locked = getLocked()
  const level = getCurrentLevel()
  const [showLocked, setShowLocked] = useState(false)

  return (
    <>
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

      {unlocked.length > 0 ? (
        <View style={s.section}>
          <Text style={[s.cardTitle, { marginBottom: Spacing[3] }]}>
            Desbloqueados ({unlocked.length})
          </Text>
          <View style={{ gap: Spacing[2] }}>
            {unlocked.slice().reverse().slice(0, 6).map(a => (
              <AchievementCard
                key={a.id}
                emoji={a.emoji}
                title={a.title}
                description={a.description}
                xp={a.xpReward}
                unlockedAt={unlockedDateMap[a.id] ?? new Date().toISOString()}
              />
            ))}
          </View>
          {unlocked.length > 6 && (
            <TouchableOpacity style={lt.seeAll} onPress={onGoToAchievements}>
              <Text style={lt.seeAllTxt}>Ver todos los {unlocked.length} logros</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.primary[400]} />
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
                  <Text style={lt.lockedXp}>+{a.xpReward} XP</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={s.section}>
        <NavCard emoji="🏆" title="Logros completos" subtitle="Mapa de niveles, categorías y todos tus logros" onPress={onGoToAchievements} color={Colors.accent.yellow} />
        <NavCard emoji="🏅" title="Ranking global" subtitle="Compite por XP, racha, pasos y más" onPress={onGoToLeaderboard} color={Colors.accent.orange} />
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
  seeAll: { marginTop: Spacing[3], flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', padding: Spacing[3] },
  seeAllTxt: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '700' },
  toggleBtn: { padding: Spacing[3], backgroundColor: Glass.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Glass.cardBorder },
  toggleTxt: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  lockedCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: Glass.card, borderRadius: BorderRadius.md, padding: Spacing[3], opacity: 0.5, borderWidth: 1, borderColor: Glass.cardBorder },
  lockedEmoji: { fontSize: 22 },
  lockedTitle: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  lockedDesc: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  lockedXp: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
})

// ── Pantalla principal ─────────────────────────────────────────────────────────

export default function ProfileStatsScreen() {
  const router = useRouter()
  const { load } = useProgressStore()
  const { load: loadAchievements } = useAchievementStore()
  const { load: loadMeasurements } = useBodyMeasurementsStore()
  const { load: loadHealthTracker } = useHealthTrackerStore()

  const [weightModal, setWeightModal] = useState(false)
  const [measureModal, setMeasureModal] = useState(false)
  const [tab, setTab] = useState<StatsTab>('body')

  useEffect(() => {
    load()
    loadAchievements()
    loadMeasurements()
    loadHealthTracker()
  }, [])

  return (
    <Screen tint={Colors.accent.yellow}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenHeader
          eyebrow="Zencrus · Perfil"
          title="Estadísticas"
          subtitle="Evidencia real de tu transformación"
          icon="trending-up"
          back
        />

        <View style={s.section}>
          <LevelBadge />
        </View>

        <TrainingTotals />

        <TouchableOpacity style={s.goalsLink} onPress={() => router.push('/goals')} activeOpacity={0.85}>
          <View style={s.goalsLinkIcon}>
            <Ionicons name="flag" size={18} color={Colors.primary[400]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.goalsLinkTitle}>Mis metas</Text>
            <Text style={s.goalsLinkSub}>Objetivos con fecha y seguimiento real</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScroll}>
          {(Object.keys(TAB_LABELS) as StatsTab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, { flexDirection: 'row', gap: 6, alignItems: 'center' }, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
            >
              <Ionicons name={TAB_LABELS[t].icon} size={14} color={tab === t ? Colors.primary[400] : Colors.dark.textSecondary} />
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{TAB_LABELS[t].label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {tab === 'body' && <BodyTab onWeight={() => setWeightModal(true)} onMeasure={() => setMeasureModal(true)} />}
        {tab === 'medidas' && <MedidasTab onGoToMeasurements={() => router.push('/measurements')} />}
        {tab === 'logros' && (
          <LogrosTab
            onGoToAchievements={() => router.push('/achievements')}
            onGoToLeaderboard={() => router.push('/leaderboard')}
          />
        )}
      </ScrollView>

      <WeightModal visible={weightModal} onClose={() => setWeightModal(false)} />
      <MeasurementsModal visible={measureModal} onClose={() => setMeasureModal(false)} />
    </Screen>
  )
}
