import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useLeaderboardStore, LeaderboardMetric, LeaderboardPeriod, LeaderboardEntry } from '@/store/leaderboardStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const METRICS: { id: LeaderboardMetric; label: string; emoji: string; unit: string }[] = [
  { id: 'xp', label: 'XP Total', emoji: '⚡', unit: 'XP' },
  { id: 'streak', label: 'Racha', emoji: '🔥', unit: 'días' },
  { id: 'workouts', label: 'Entrenamientos', emoji: '🏋️', unit: '' },
  { id: 'steps', label: 'Pasos', emoji: '👟', unit: 'pasos' },
  { id: 'health_score', label: 'Health Score', emoji: '⭐', unit: 'pts' },
]

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'weekly', label: 'Semana' },
  { id: 'monthly', label: 'Mes' },
  { id: 'alltime', label: 'Histórico' },
]

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Text style={{ fontSize: 22 }}>🥇</Text>
  if (rank === 2) return <Text style={{ fontSize: 22 }}>🥈</Text>
  if (rank === 3) return <Text style={{ fontSize: 22 }}>🥉</Text>
  return (
    <View style={rb.wrap}>
      <Text style={rb.txt}>#{rank}</Text>
    </View>
  )
}

const rb = StyleSheet.create({
  wrap: { width: 36, alignItems: 'center' },
  txt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.textSecondary },
})

function EntryRow({ entry, metric }: { entry: LeaderboardEntry; metric: typeof METRICS[0] }) {
  const isTop3 = entry.rank <= 3
  const changeColor = entry.change > 0 ? Colors.accent.green : entry.change < 0 ? Colors.accent.red : Colors.dark.textTertiary
  const changeSymbol = entry.change > 0 ? '▲' : entry.change < 0 ? '▼' : '—'

  return (
    <View style={[er.wrap, entry.isMe && er.wrapMe, isTop3 && er.wrapTop]}>
      <RankBadge rank={entry.rank} />
      <View style={[er.avatar, entry.isMe && er.avatarMe]}>
        <Text style={{ fontSize: 16 }}>⚡</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[er.name, entry.isMe && er.nameMe]} numberOfLines={1}>{entry.userName}</Text>
          {entry.isMe && <View style={er.meBadge}><Text style={er.meBadgeTxt}>Tú</Text></View>}
        </View>
        <Text style={er.handle}>{entry.userHandle} · Nivel {entry.userLevel}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[er.value, entry.isMe && er.valueMe]}>
          {entry.value.toLocaleString()} {metric.unit}
        </Text>
        {entry.change !== 0 && (
          <Text style={[er.change, { color: changeColor }]}>
            {changeSymbol} {Math.abs(entry.change)}
          </Text>
        )}
      </View>
    </View>
  )
}

const er = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[3], paddingHorizontal: Spacing[4], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  wrapMe: { backgroundColor: Colors.primary[900] + '40' },
  wrapTop: { backgroundColor: Colors.dark.surface },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.dark.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  avatarMe: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[900] },
  name: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark.text },
  nameMe: { color: Colors.primary[400] },
  handle: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, marginTop: 1 },
  meBadge: { backgroundColor: Colors.primary[900], borderRadius: BorderRadius.full, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: Colors.primary[700] },
  meBadgeTxt: { fontSize: 9, fontWeight: '700', color: Colors.primary[400] },
  value: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text },
  valueMe: { color: Colors.primary[400] },
  change: { fontSize: 10, fontWeight: '600', marginTop: 1 },
})

export default function LeaderboardScreen() {
  const [metric, setMetric] = useState<LeaderboardMetric>('xp')
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly')
  const { load, getLeaderboard, getMyRank } = useLeaderboardStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    load(metric, period).finally(() => setLoading(false))
  }, [metric, period])

  const entries = getLeaderboard(metric, period)
  const myRank = getMyRank(metric, period)
  const selectedMetric = METRICS.find(m => m.id === metric)!

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: Spacing[2] }}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Clasificación</Text>
        <View style={s.rankBadge}>
          <Text style={s.rankTxt}>#{myRank || '–'}</Text>
        </View>
      </View>

      {/* Period tabs */}
      <View style={s.periodTabs}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[s.periodTab, period === p.id && s.periodTabActive]}
            onPress={() => setPeriod(p.id)}
          >
            <Text style={[s.periodTxt, period === p.id && s.periodTxtActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Metric selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.metricRow}>
        {METRICS.map(m => (
          <TouchableOpacity
            key={m.id}
            style={[s.metricChip, metric === m.id && s.metricChipActive]}
            onPress={() => setMetric(m.id)}
          >
            <Text style={s.metricEmoji}>{m.emoji}</Text>
            <Text style={[s.metricTxt, metric === m.id && s.metricTxtActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.loading}>
          <ActivityIndicator color={Colors.primary[400]} size="large" />
        </View>
      ) : (
        <ScrollView>
          {entries.map(entry => (
            <EntryRow key={entry.userId} entry={entry} metric={selectedMetric} />
          ))}
          {entries.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTxt}>Sin datos para este período</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  back: { fontSize: 28, color: Colors.dark.text, marginRight: Spacing[2] },
  title: { flex: 1, fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  rankBadge: { backgroundColor: Colors.primary[900], borderRadius: BorderRadius.full, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderWidth: 1, borderColor: Colors.primary[600] },
  rankTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.primary[400] },
  periodTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  periodTab: { flex: 1, paddingVertical: Spacing[4], alignItems: 'center' },
  periodTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary[500] },
  periodTxt: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, fontWeight: '600' },
  periodTxtActive: { color: Colors.primary[400] },
  metricRow: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], gap: Spacing[2] },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.dark.border, backgroundColor: Colors.dark.surface },
  metricChipActive: { backgroundColor: Colors.primary[900], borderColor: Colors.primary[500] },
  metricEmoji: { fontSize: 14 },
  metricTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, fontWeight: '600' },
  metricTxtActive: { color: Colors.primary[400] },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty: { padding: Spacing[8], alignItems: 'center' },
  emptyTxt: { color: Colors.dark.textTertiary, fontSize: Typography.fontSize.sm },
})
