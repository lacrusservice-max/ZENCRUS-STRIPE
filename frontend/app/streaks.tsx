import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useStreakStore, DayStatus } from '@/store/streakStore'
import { useAchievementStore } from '@/store/achievementStore'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'

const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365]

const STATUS_COLOR: Record<DayStatus, string> = {
  completed: Colors.accent.green,
  protected: Colors.primary[400],
  missed: 'rgba(255,59,48,0.35)',
  empty: 'rgba(255,255,255,0.08)',
  future: 'transparent',
}

export default function StreaksScreen() {
  const { currentStreak, longestStreak, totalDaysActive, justProtected, acknowledgeProtection, getHistory } = useStreakStore()
  const { streakShields } = useAchievementStore()
  const [history, setHistory] = useState<{ date: string; status: DayStatus }[]>([])

  useEffect(() => {
    getHistory(84).then(setHistory)
  }, [])

  const nextMilestone = MILESTONES.find(m => m > currentStreak) ?? null
  const daysToGo = nextMilestone ? nextMilestone - currentStreak : 0

  // Agrupar historial en semanas (columnas) de 7 días (filas) para el grid tipo GitHub
  const weeks: { date: string; status: DayStatus }[][] = []
  for (let i = 0; i < history.length; i += 7) weeks.push(history.slice(i, i + 7))

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Racha y constancia</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.push('/achievements')}>
          <Ionicons name="trophy-outline" size={20} color={Colors.primary[400]} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing[5], paddingBottom: Spacing[16] }}>
        {justProtected && (
          <View style={s.protectedBanner}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.primary[400]} />
            <Text style={s.protectedTxt}>Un protector cubrió el día que faltó. Tu racha sigue viva — retomemos hoy.</Text>
            <TouchableOpacity onPress={acknowledgeProtection}><Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" /></TouchableOpacity>
          </View>
        )}

        {/* Hero: racha actual */}
        <View style={s.hero}>
          <Ionicons name="flame" size={40} color={Colors.accent.orange} />
          <Text style={s.heroNum}>{currentStreak}</Text>
          <Text style={s.heroLabel}>{currentStreak === 1 ? 'día de racha' : 'días de racha'}</Text>
          {nextMilestone && (
            <Text style={s.heroNext}>Faltan {daysToGo} {daysToGo === 1 ? 'día' : 'días'} para tu hito de {nextMilestone} días</Text>
          )}
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statVal}>{longestStreak}</Text>
            <Text style={s.statLabel}>Mejor racha</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>{totalDaysActive}</Text>
            <Text style={s.statLabel}>Días activos</Text>
          </View>
          <View style={[s.statCard, s.shieldCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="shield" size={16} color={Colors.primary[400]} />
              <Text style={s.statVal}>{streakShields}</Text>
            </View>
            <Text style={s.statLabel}>Protectores</Text>
          </View>
        </View>

        <View style={s.protectorInfo}>
          <Ionicons name="information-circle-outline" size={15} color="rgba(255,255,255,0.4)" />
          <Text style={s.protectorInfoTxt}>Ganas un protector cada 7 días de racha. Si un día se te pasa, se usa uno solo para que tu progreso siga contando.</Text>
        </View>

        {/* Calendario histórico */}
        <Text style={s.sectionTitle}>Últimas 12 semanas</Text>
        <View style={s.calendarWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {weeks.map((week, wi) => (
                <View key={wi} style={{ gap: 4 }}>
                  {week.map(day => (
                    <View key={day.date} style={[s.dayCell, { backgroundColor: STATUS_COLOR[day.status] }]} />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
        <View style={s.legend}>
          <LegendItem color={Colors.accent.green} label="Cumplido" />
          <LegendItem color={Colors.primary[400]} label="Protegido" />
          <LegendItem color="rgba(255,59,48,0.35)" label="Perdido" />
        </View>

        {/* Roadmap de hitos */}
        <Text style={[s.sectionTitle, { marginTop: Spacing[6] }]}>Camino de hitos</Text>
        {MILESTONES.map(m => {
          const reached = currentStreak >= m || longestStreak >= m
          return (
            <View key={m} style={[s.milestoneRow, reached && s.milestoneRowDone]}>
              <View style={[s.milestoneBadge, reached && s.milestoneBadgeDone]}>
                <Ionicons name={reached ? 'checkmark' : 'lock-closed'} size={14} color={reached ? '#fff' : 'rgba(255,255,255,0.3)'} />
              </View>
              <Text style={[s.milestoneLabel, reached && s.milestoneLabelDone]}>{m} días</Text>
              {m === nextMilestone && <View style={s.milestoneNextTag}><Text style={s.milestoneNextTagTxt}>SIGUIENTE</Text></View>}
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={s.legendTxt}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },

  protectedBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: Glass.purpleTint, borderWidth: 1, borderColor: Glass.purpleBorder, borderRadius: BorderRadius.md, padding: Spacing[3], marginBottom: Spacing[4] },
  protectedTxt: { flex: 1, fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.85)', lineHeight: 17 },

  hero: { alignItems: 'center', paddingVertical: Spacing[6] },
  heroNum: { fontFamily: Typography.fontFamily.display, fontSize: 64, color: '#fff', marginTop: Spacing[2] },
  heroLabel: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  heroNext: { fontSize: Typography.fontSize.xs, color: Colors.primary[400], marginTop: Spacing[3], fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[4] },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.lg, paddingVertical: Spacing[4] },
  shieldCard: { borderColor: Glass.purpleBorder, backgroundColor: Glass.purpleTint },
  statVal: { fontSize: Typography.fontSize.xl, fontWeight: '900', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },

  protectorInfo: { flexDirection: 'row', gap: Spacing[2], marginBottom: Spacing[6], paddingHorizontal: Spacing[1] },
  protectorInfoTxt: { flex: 1, fontSize: 11.5, color: 'rgba(255,255,255,0.4)', lineHeight: 16 },

  sectionTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff', marginBottom: Spacing[3] },
  calendarWrap: { backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.lg, padding: Spacing[4], marginBottom: Spacing[3] },
  dayCell: { width: 12, height: 12, borderRadius: 3 },
  legend: { flexDirection: 'row', gap: Spacing[5], marginBottom: Spacing[2] },
  legendTxt: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },

  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  milestoneRowDone: {},
  milestoneBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  milestoneBadgeDone: { backgroundColor: Colors.accent.green },
  milestoneLabel: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  milestoneLabelDone: { color: '#fff', fontWeight: '800' },
  milestoneNextTag: { marginLeft: 'auto', backgroundColor: Colors.primary[500], borderRadius: BorderRadius.full, paddingHorizontal: Spacing[3], paddingVertical: 3 },
  milestoneNextTagTxt: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
})
