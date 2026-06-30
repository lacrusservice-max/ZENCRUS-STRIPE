import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useDuelStore, Duel, DuelMetric, DuelDuration, METRIC_LABELS, METRIC_EMOJIS } from '@/store/duelStore'
import { useAchievementStore } from '@/store/achievementStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const DURATIONS: { value: DuelDuration; label: string }[] = [
  { value: 1, label: '1 día' },
  { value: 3, label: '3 días' },
  { value: 7, label: '1 semana' },
  { value: 14, label: '2 semanas' },
]

function timeLeft(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return 'Terminado'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`
}

// ── Create Duel Modal ─────────────────────────────────────────────────────────

function CreateDuelModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { createDuel } = useDuelStore()
  const [metric, setMetric] = useState<DuelMetric>('steps')
  const [duration, setDuration] = useState<DuelDuration>(7)
  const [opponentName, setOpponentName] = useState('')
  const [opponentHandle, setOpponentHandle] = useState('')
  const [message, setMessage] = useState('')

  const METRICS = Object.keys(METRIC_LABELS) as DuelMetric[]

  const handle = () => {
    if (!opponentName.trim()) {
      Alert.alert('Falta el rival', 'Ingresa el nombre de tu rival')
      return
    }
    createDuel({
      metric,
      duration,
      opponentId: `u_${Date.now()}`,
      opponentName: opponentName.trim(),
      opponentHandle: opponentHandle.trim() || `@${opponentName.toLowerCase().replace(/\s/g, '')}`,
      message: message.trim() || undefined,
    })
    setOpponentName('')
    setOpponentHandle('')
    setMessage('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark.background }}>
        <View style={cd.header}>
          <TouchableOpacity onPress={onClose}><Text style={cd.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={cd.title}>Nuevo duelo</Text>
          <TouchableOpacity onPress={handle}><Text style={cd.save}>Retar ⚔️</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={cd.body} keyboardShouldPersistTaps="handled">

          <Text style={cd.label}>¿A quién retas?</Text>
          <TextInput
            style={cd.input}
            value={opponentName}
            onChangeText={setOpponentName}
            placeholder="Nombre de tu rival"
            placeholderTextColor={Colors.dark.textTertiary}
          />
          <TextInput
            style={[cd.input, { marginTop: Spacing[3] }]}
            value={opponentHandle}
            onChangeText={setOpponentHandle}
            placeholder="@usuario (opcional)"
            placeholderTextColor={Colors.dark.textTertiary}
            autoCapitalize="none"
          />

          <Text style={cd.label}>¿En qué compiten?</Text>
          <View style={cd.metricGrid}>
            {METRICS.map(m => (
              <TouchableOpacity
                key={m}
                style={[cd.metricItem, metric === m && cd.metricItemActive]}
                onPress={() => setMetric(m)}
              >
                <Text style={{ fontSize: 20 }}>{METRIC_EMOJIS[m]}</Text>
                <Text style={[cd.metricLabel, metric === m && cd.metricLabelActive]}>{METRIC_LABELS[m]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={cd.label}>Duración</Text>
          <View style={cd.durationRow}>
            {DURATIONS.map(d => (
              <TouchableOpacity
                key={d.value}
                style={[cd.durationChip, duration === d.value && cd.durationChipActive]}
                onPress={() => setDuration(d.value)}
              >
                <Text style={[cd.durationTxt, duration === d.value && cd.durationTxtActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={cd.label}>Mensaje de reto (opcional)</Text>
          <TextInput
            style={[cd.input, { minHeight: 60 }]}
            value={message}
            onChangeText={setMessage}
            placeholder="¡A ver quién puede más! 😤"
            placeholderTextColor={Colors.dark.textTertiary}
            multiline
            maxLength={140}
          />

          <View style={cd.summary}>
            <Text style={cd.summaryTxt}>
              Recompensa: <Text style={{ color: Colors.accent.yellow, fontWeight: '700' }}>+{duration * 50} XP</Text> al ganador
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const cd = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  cancel: { fontSize: Typography.fontSize.base, color: Colors.dark.textSecondary },
  title: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text },
  save: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.primary[400] },
  body: { padding: Spacing[5], gap: Spacing[4] },
  label: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing[2] },
  input: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: Typography.fontSize.base, color: Colors.dark.text, borderWidth: 1, borderColor: Colors.dark.border },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  metricItem: { width: '48%', backgroundColor: Colors.dark.surface, borderRadius: 10, padding: Spacing[3], alignItems: 'center', gap: Spacing[2], borderWidth: 1, borderColor: Colors.dark.border },
  metricItemActive: { backgroundColor: Colors.primary[900], borderColor: Colors.primary[500] },
  metricLabel: { fontSize: 11, color: Colors.dark.textSecondary, fontWeight: '600', textAlign: 'center' },
  metricLabelActive: { color: Colors.primary[400] },
  durationRow: { flexDirection: 'row', gap: Spacing[2] },
  durationChip: { flex: 1, paddingVertical: Spacing[3], borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.dark.border, alignItems: 'center' },
  durationChipActive: { backgroundColor: Colors.primary[900], borderColor: Colors.primary[500] },
  durationTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, fontWeight: '600' },
  durationTxtActive: { color: Colors.primary[400] },
  summary: { backgroundColor: Colors.dark.surface, borderRadius: 10, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border, alignItems: 'center' },
  summaryTxt: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary },
})

// ── Duel Card ──────────────────────────────────────────────────────────────────

function DuelCard({ duel }: { duel: Duel }) {
  const { acceptDuel, declineDuel } = useDuelStore()
  const { addXP } = useAchievementStore()
  const isWinning = duel.challenger.progress >= duel.opponent.progress
  const total = duel.challenger.progress + duel.opponent.progress
  const myPct = total > 0 ? (duel.challenger.progress / total) * 100 : 50
  const isPending = duel.status === 'pending'
  const isCompleted = duel.status === 'completed'

  const statusColor = isCompleted
    ? (duel.challenger.isWinner ? Colors.accent.green : Colors.accent.red)
    : duel.status === 'pending' ? Colors.accent.yellow
    : Colors.primary[400]

  return (
    <View style={dc.wrap}>
      {/* Header */}
      <View style={dc.header}>
        <View style={dc.metricBadge}>
          <Text style={{ fontSize: 16 }}>{METRIC_EMOJIS[duel.metric]}</Text>
          <Text style={dc.metricTxt}>{METRIC_LABELS[duel.metric]}</Text>
        </View>
        <View style={[dc.statusBadge, { borderColor: statusColor + '50', backgroundColor: statusColor + '15' }]}>
          <Text style={[dc.statusTxt, { color: statusColor }]}>
            {isPending ? 'Pendiente' : isCompleted ? (duel.challenger.isWinner ? '🏆 Ganaste' : '😞 Perdiste') : `⏱ ${timeLeft(duel.endDate)}`}
          </Text>
        </View>
      </View>

      {/* VS Row */}
      <View style={dc.vsRow}>
        <View style={dc.player}>
          <View style={[dc.avatar, { borderColor: isWinning ? Colors.primary[500] : Colors.dark.border }]}>
            <Text style={{ fontSize: 18 }}>⚡</Text>
          </View>
          <Text style={[dc.playerName, isWinning && dc.playerNameWin]}>Tú</Text>
          <Text style={dc.playerScore}>{duel.challenger.progress.toLocaleString()}</Text>
        </View>

        <View style={dc.vsCircle}><Text style={dc.vsText}>VS</Text></View>

        <View style={dc.player}>
          <View style={[dc.avatar, { borderColor: !isWinning ? Colors.accent.red : Colors.dark.border }]}>
            <Text style={{ fontSize: 18 }}>🔥</Text>
          </View>
          <Text style={[dc.playerName, !isWinning && dc.playerNameLose]}>{duel.opponent.userName.split(' ')[0]}</Text>
          <Text style={dc.playerScore}>{duel.opponent.progress.toLocaleString()}</Text>
        </View>
      </View>

      {/* Progress bar */}
      {!isPending && (
        <View style={dc.bar}>
          <View style={[dc.barMe, { width: `${myPct}%` as any }]} />
        </View>
      )}

      {/* Message */}
      {duel.message && (
        <Text style={dc.message}>"{duel.message}"</Text>
      )}

      {/* XP reward */}
      <Text style={dc.xpLabel}>+{duel.xpReward} XP al ganar · {duel.duration} días</Text>

      {/* Actions for pending */}
      {isPending && duel.opponent.userId === 'me' && (
        <View style={dc.actions}>
          <TouchableOpacity style={dc.declineBtn} onPress={() => declineDuel(duel.id)}>
            <Text style={dc.declineTxt}>Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dc.acceptBtn} onPress={() => acceptDuel(duel.id)}>
            <Text style={dc.acceptTxt}>Aceptar duelo ⚔️</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const dc = StyleSheet.create({
  wrap: { backgroundColor: Colors.dark.surface, borderRadius: 14, padding: Spacing[4], marginBottom: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[4] },
  metricBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  metricTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text },
  statusBadge: { borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  vsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing[3] },
  player: { alignItems: 'center', gap: Spacing[2], flex: 1 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  playerName: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.textSecondary },
  playerNameWin: { color: Colors.primary[400] },
  playerNameLose: { color: Colors.accent.red },
  playerScore: { fontSize: Typography.fontSize.xl, fontWeight: '900', color: Colors.dark.text },
  vsCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  vsText: { fontSize: 11, fontWeight: '900', color: Colors.dark.textSecondary },
  bar: { height: 8, backgroundColor: Colors.dark.background, borderRadius: 4, overflow: 'hidden', marginBottom: Spacing[2] },
  barMe: { height: '100%', backgroundColor: Colors.primary[500], borderRadius: 4 },
  message: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, fontStyle: 'italic', marginBottom: Spacing[2] },
  xpLabel: { fontSize: 10, color: Colors.accent.yellow, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: Spacing[3], marginTop: Spacing[4] },
  declineBtn: { flex: 1, padding: Spacing[3], borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.dark.border, alignItems: 'center' },
  declineTxt: { color: Colors.dark.textSecondary, fontWeight: '600', fontSize: Typography.fontSize.sm },
  acceptBtn: { flex: 2, padding: Spacing[3], borderRadius: BorderRadius.md, backgroundColor: Colors.primary[500], alignItems: 'center' },
  acceptTxt: { color: '#fff', fontWeight: '700', fontSize: Typography.fontSize.sm },
})

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function DuelsScreen() {
  const { duels, getActive, getPending, getCompleted } = useDuelStore()
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'active' | 'pending' | 'completed'>('active')

  const tabs = { active: getActive(), pending: getPending(), completed: getCompleted() }
  const current = tabs[tab]

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: Spacing[2] }}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Duelos 1v1</Text>
        <TouchableOpacity style={s.createBtn} onPress={() => setShowCreate(true)}>
          <Text style={s.createTxt}>+ Retar</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {(['active', 'pending', 'completed'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === 'active' ? `Activos (${tabs.active.length})` : t === 'pending' ? `Pendientes (${tabs.pending.length})` : `Historial (${tabs.completed.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {current.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>⚔️</Text>
            <Text style={s.emptyTitle}>
              {tab === 'active' ? 'Sin duelos activos' : tab === 'pending' ? 'Sin duelos pendientes' : 'Sin historial aún'}
            </Text>
            <Text style={s.emptySub}>Reta a un amigo y demuestra quién tiene más disciplina.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)}>
              <Text style={s.emptyBtnTxt}>Crear primer duelo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          current.map(d => <DuelCard key={d.id} duel={d} />)
        )}
      </ScrollView>

      <CreateDuelModal visible={showCreate} onClose={() => setShowCreate(false)} />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  back: { fontSize: 28, color: Colors.dark.text, marginRight: Spacing[2] },
  title: { flex: 1, fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  createBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.full, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2] },
  createTxt: { color: '#fff', fontWeight: '700', fontSize: Typography.fontSize.xs },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  tab: { flex: 1, paddingVertical: Spacing[4], alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary[500] },
  tabTxt: { fontSize: 11, color: Colors.dark.textSecondary, fontWeight: '600' },
  tabTxtActive: { color: Colors.primary[400] },
  body: { padding: Spacing[4] },
  empty: { paddingTop: 60, alignItems: 'center', paddingHorizontal: Spacing[6] },
  emptyEmoji: { fontSize: 52, marginBottom: Spacing[4] },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700', color: Colors.dark.text, marginBottom: Spacing[2] },
  emptySub: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing[6] },
  emptyBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md, paddingHorizontal: Spacing[6], paddingVertical: Spacing[3] },
  emptyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: Typography.fontSize.sm },
})
