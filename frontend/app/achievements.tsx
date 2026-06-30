import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAchievementStore, XP_LEVELS, Achievement } from '@/store/achievementStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

type FilterCat = 'all' | 'streak' | 'nutrition' | 'workout' | 'social' | 'health' | 'special'

const CAT_LABELS: Record<FilterCat, string> = {
  all: 'Todos',
  streak: '🔥 Racha',
  nutrition: '🥗 Nutrición',
  workout: '🏋️ Entreno',
  social: '👥 Social',
  health: '⭐ Salud',
  special: '✨ Especial',
}

function XPProgressBar() {
  const { totalXP, getCurrentLevel, getNextLevel, getLevelProgress, streakShields } = useAchievementStore()
  const current = getCurrentLevel()
  const next = getNextLevel()
  const pct = getLevelProgress()

  return (
    <View style={xp.wrap}>
      <View style={xp.top}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2] }}>
            <Text style={xp.levelEmoji}>{current.emoji}</Text>
            <Text style={xp.levelName}>{current.name}</Text>
            <View style={xp.levelBadge}><Text style={xp.levelNum}>Nivel {current.level}</Text></View>
          </View>
          <Text style={xp.xpTxt}>{totalXP.toLocaleString()} XP total</Text>
        </View>
        {streakShields > 0 && (
          <View style={xp.shieldBadge}>
            <Text style={xp.shieldTxt}>🛡️ {streakShields}</Text>
          </View>
        )}
      </View>
      <View style={xp.barBg}>
        <View style={[xp.barFill, { width: `${pct}%` as any }]} />
      </View>
      <View style={xp.barMeta}>
        <Text style={xp.barLabel}>{current.minXP.toLocaleString()} XP</Text>
        <Text style={xp.barPct}>{pct}%</Text>
        {next && <Text style={xp.barLabel}>{next.minXP.toLocaleString()} XP — {next.emoji} {next.name}</Text>}
      </View>
    </View>
  )
}

const xp = StyleSheet.create({
  wrap: { backgroundColor: Colors.dark.surface, margin: Spacing[4], borderRadius: 12, padding: Spacing[5], borderWidth: 1, borderColor: Colors.dark.border },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing[4] },
  levelEmoji: { fontSize: 28 },
  levelName: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  levelBadge: { backgroundColor: Colors.primary[900], borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Colors.primary[700] },
  levelNum: { fontSize: 10, fontWeight: '700', color: Colors.primary[400] },
  xpTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 2 },
  shieldBadge: { backgroundColor: Colors.accent.orange + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.accent.orange + '50' },
  shieldTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.accent.orange },
  barBg: { height: 10, backgroundColor: Colors.dark.background, borderRadius: 5, overflow: 'hidden', marginBottom: Spacing[2] },
  barFill: { height: '100%', backgroundColor: Colors.primary[500], borderRadius: 5 },
  barMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 10, color: Colors.dark.textTertiary },
  barPct: { fontSize: 10, fontWeight: '700', color: Colors.primary[400] },
})

function LevelRoadmap() {
  const { getCurrentLevel } = useAchievementStore()
  const current = getCurrentLevel()
  return (
    <View style={lr.wrap}>
      <Text style={lr.title}>Niveles</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={lr.row}>
          {XP_LEVELS.map((lvl, i) => {
            const isActive = lvl.level === current.level
            const isPast = lvl.level < current.level
            return (
              <View key={lvl.level} style={lr.item}>
                {i < XP_LEVELS.length - 1 && (
                  <View style={[lr.connector, isPast && lr.connectorActive]} />
                )}
                <View style={[lr.circle, isActive && lr.circleActive, isPast && lr.circlePast]}>
                  <Text style={{ fontSize: isActive ? 20 : 16 }}>{lvl.emoji}</Text>
                </View>
                <Text style={[lr.name, isActive && { color: Colors.primary[400] }]}>{lvl.name}</Text>
                <Text style={lr.xp}>{lvl.minXP >= 1000 ? `${lvl.minXP / 1000}k` : lvl.minXP} XP</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

const lr = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing[4], marginBottom: Spacing[4] },
  title: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing[3] },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingBottom: Spacing[2] },
  item: { alignItems: 'center', width: 72, position: 'relative' },
  connector: { position: 'absolute', left: 36, top: 20, width: 36, height: 2, backgroundColor: Colors.dark.border, zIndex: 0 },
  connectorActive: { backgroundColor: Colors.primary[500] },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.dark.border, zIndex: 1, marginBottom: 4 },
  circleActive: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[900] },
  circlePast: { borderColor: Colors.primary[700], backgroundColor: Colors.primary[900] + '80' },
  name: { fontSize: 9, color: Colors.dark.textTertiary, textAlign: 'center', fontWeight: '600', marginBottom: 2 },
  xp: { fontSize: 9, color: Colors.dark.textTertiary + '80', textAlign: 'center' },
})

function AchievementCard({ achievement, unlocked, unlockedAt }: { achievement: Achievement; unlocked: boolean; unlockedAt?: string }) {
  return (
    <View style={[ac.wrap, !unlocked && ac.wrapLocked]}>
      <View style={[ac.icon, !unlocked && ac.iconLocked]}>
        <Text style={{ fontSize: 24, opacity: unlocked ? 1 : 0.3 }}>{achievement.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ac.title, !unlocked && ac.titleLocked]}>{achievement.title}</Text>
        <Text style={ac.desc}>{achievement.description}</Text>
        {unlocked && unlockedAt && (
          <Text style={ac.date}>Desbloqueado {new Date(unlockedAt).toLocaleDateString('es-MX')}</Text>
        )}
      </View>
      <View style={[ac.xpBadge, !unlocked && ac.xpBadgeLocked]}>
        <Text style={[ac.xpTxt, !unlocked && ac.xpTxtLocked]}>+{achievement.xpReward} XP</Text>
      </View>
    </View>
  )
}

const ac = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing[4], padding: Spacing[4], backgroundColor: Colors.dark.surface, borderRadius: 12, marginBottom: Spacing[3], borderWidth: 1, borderColor: Colors.primary[700] + '40' },
  wrapLocked: { borderColor: Colors.dark.border, opacity: 0.6 },
  icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary[900], alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.primary[600] },
  iconLocked: { backgroundColor: Colors.dark.background, borderColor: Colors.dark.border },
  title: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text, marginBottom: 2 },
  titleLocked: { color: Colors.dark.textTertiary },
  desc: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, lineHeight: 16 },
  date: { fontSize: 10, color: Colors.primary[400], marginTop: 2 },
  xpBadge: { backgroundColor: Colors.primary[900], borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.primary[700] },
  xpBadgeLocked: { backgroundColor: Colors.dark.background, borderColor: Colors.dark.border },
  xpTxt: { fontSize: 10, fontWeight: '700', color: Colors.primary[400] },
  xpTxtLocked: { color: Colors.dark.textTertiary },
})

export default function AchievementsScreen() {
  const { getUnlocked, getLocked, getAllAchievements, unlockedAchievements } = useAchievementStore()
  const [filter, setFilter] = useState<FilterCat>('all')
  const [showLocked, setShowLocked] = useState(false)

  const unlocked = getUnlocked()
  const locked = getLocked()
  const all = getAllAchievements()
  const unlockedMap = new Map(unlockedAchievements.map(u => [u.achievementId, u.unlockedAt]))

  const visible = (filter === 'all' ? all : all.filter(a => a.category === filter))
  const visibleUnlocked = visible.filter(a => unlockedMap.has(a.id))
  const visibleLocked = visible.filter(a => !unlockedMap.has(a.id))

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: Spacing[2] }}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Logros</Text>
        <Text style={s.count}>{unlocked.length}/{all.length}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <XPProgressBar />
        <LevelRoadmap />

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {(Object.keys(CAT_LABELS) as FilterCat[]).map(cat => (
            <TouchableOpacity
              key={cat}
              style={[s.filterChip, filter === cat && s.filterChipActive]}
              onPress={() => setFilter(cat)}
            >
              <Text style={[s.filterTxt, filter === cat && s.filterTxtActive]}>{CAT_LABELS[cat]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.section}>
          {visibleUnlocked.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Desbloqueados ({visibleUnlocked.length})</Text>
              {visibleUnlocked.map(a => (
                <AchievementCard key={a.id} achievement={a} unlocked unlockedAt={unlockedMap.get(a.id)} />
              ))}
            </>
          )}

          {visibleLocked.length > 0 && (
            <>
              <TouchableOpacity style={s.lockedToggle} onPress={() => setShowLocked(v => !v)}>
                <Text style={s.lockedToggleTxt}>{showLocked ? '▾' : '▸'} Bloqueados ({visibleLocked.length})</Text>
              </TouchableOpacity>
              {showLocked && visibleLocked.map(a => (
                <AchievementCard key={a.id} achievement={a} unlocked={false} />
              ))}
            </>
          )}

          {visibleUnlocked.length === 0 && visibleLocked.length === 0 && (
            <Text style={s.empty}>Sin logros en esta categoría aún</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  back: { fontSize: 28, color: Colors.dark.text, marginRight: Spacing[2] },
  title: { flex: 1, fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  count: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '700' },
  filterRow: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4], gap: Spacing[2] },
  filterChip: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.dark.border, backgroundColor: Colors.dark.surface },
  filterChipActive: { backgroundColor: Colors.primary[900], borderColor: Colors.primary[500] },
  filterTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, fontWeight: '600' },
  filterTxtActive: { color: Colors.primary[400] },
  section: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[8] },
  sectionTitle: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing[3] },
  lockedToggle: { paddingVertical: Spacing[3], marginBottom: Spacing[3] },
  lockedToggleTxt: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, fontWeight: '600' },
  empty: { textAlign: 'center', color: Colors.dark.textTertiary, fontSize: Typography.fontSize.sm, paddingVertical: Spacing[8] },
})
