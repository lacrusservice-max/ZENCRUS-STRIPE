import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useNutritionStore } from '@/store/nutritionStore'
import { useWorkoutStore } from '@/store/workoutStore'
import { useHealthStore } from '@/store/healthStore'
import { useStreakStore } from '@/store/streakStore'
import { usePremiumStore } from '@/store/premiumStore'
import {
  sendMessage as coachSend,
  createMessage,
  CoachMessage,
  CoachContext,
} from '@/services/aiCoachService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const QUICK_QUESTIONS = [
  '¿Qué debería comer hoy para complementar mis macros?',
  '¿Cómo puedo mejorar mi Health Score esta semana?',
  '¿Qué ejercicio recomiendas para hoy?',
  '¿Cuánta proteína necesito y cómo distribuirla?',
  'Dame un tip de nutrición para hoy',
  '¿Cómo puedo mantener mi racha activa?',
]

const DAILY_LIMIT = 5

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: CoachMessage }) {
  const isUser = msg.role === 'user'
  const time = new Date(msg.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  return (
    <View style={[b.wrap, isUser ? b.wrapRight : b.wrapLeft]}>
      {!isUser && (
        <View style={b.avatar}>
          <Text style={b.avatarEmoji}>⚡</Text>
        </View>
      )}
      <View style={[b.bubble, isUser ? b.bubbleUser : b.bubbleAssistant]}>
        <Text style={[b.txt, isUser ? b.txtUser : b.txtAssistant]}>{msg.content}</Text>
        <Text style={[b.time, isUser ? { color: 'rgba(255,255,255,0.5)' } : { color: Colors.dark.textTertiary }]}>{time}</Text>
      </View>
    </View>
  )
}

const b = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: Spacing[3], gap: Spacing[2] },
  wrapLeft: { justifyContent: 'flex-start' },
  wrapRight: { justifyContent: 'flex-end' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary[900], alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary[500] + '60' },
  avatarEmoji: { fontSize: 14 },
  bubble: { maxWidth: '80%', borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3] },
  bubbleUser: { backgroundColor: Colors.primary[500], borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: Colors.dark.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.dark.border },
  txt: { fontSize: Typography.fontSize.sm, lineHeight: 21 },
  txtUser: { color: '#fff' },
  txtAssistant: { color: Colors.dark.text },
  time: { fontSize: 10, marginTop: Spacing[1], textAlign: 'right' },
})

// ── Typing Indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <View style={[b.wrap, b.wrapLeft]}>
      <View style={b.avatar}><Text style={b.avatarEmoji}>⚡</Text></View>
      <View style={[b.bubble, b.bubbleAssistant, { paddingVertical: Spacing[4], paddingHorizontal: Spacing[5] }]}>
        <ActivityIndicator size="small" color={Colors.primary[400]} />
      </View>
    </View>
  )
}

// ── Premium Gate Banner ────────────────────────────────────────────────────────

function PremiumGate({ used, limit }: { used: number; limit: number }) {
  return (
    <View style={pg.wrap}>
      <Text style={pg.emoji}>⚡</Text>
      <Text style={pg.title}>Límite diario alcanzado</Text>
      <Text style={pg.sub}>
        Usaste {used}/{limit} mensajes gratis de hoy.
        {'\n'}Actualiza a Premium para conversaciones ilimitadas.
      </Text>
      <TouchableOpacity style={pg.btn} onPress={() => router.push('/(tabs)/profile')}>
        <Text style={pg.btnTxt}>Ver Premium →</Text>
      </TouchableOpacity>
    </View>
  )
}

const pg = StyleSheet.create({
  wrap: { margin: Spacing[4], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[5], alignItems: 'center', borderWidth: 1, borderColor: Colors.primary[500] + '50' },
  emoji: { fontSize: 36, marginBottom: Spacing[2] },
  title: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text, marginBottom: Spacing[2] },
  sub: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing[4] },
  btn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md, paddingHorizontal: Spacing[6], paddingVertical: Spacing[3] },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: Typography.fontSize.sm },
})

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { totalCalories, totalProtein, waterGlasses } = useNutritionStore()
  const { logs } = useWorkoutStore()
  const { checkInDone, todayCheckIn, scoreHistory } = useHealthStore()
  const { currentStreak } = useStreakStore()
  const { canUseAI, incrementAI, isPremium, aiMessagesToday } = usePremiumStore()

  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const today = new Date().toISOString().slice(0, 10)
  const workedOut = logs.some(l => l.date === today)
  const healthScore = scoreHistory.find(s => (s as any).date === today)?.total
    ?? scoreHistory[0]?.total ?? 0

  const context: CoachContext = {
    totalCalories,
    caloriesTarget: 2000,
    totalProtein,
    proteinTarget: 150,
    waterGlasses,
    currentStreak,
    healthScore,
    workedOut,
    checkInDone,
    mood: todayCheckIn?.mood,
    sleep: todayCheckIn?.sleep,
    intention: todayCheckIn?.intention,
  }

  // Welcome message on first mount
  useEffect(() => {
    const welcome = createMessage(
      'assistant',
      `¡Hola! Soy tu Coach ZENCRUS. Hoy llevas ${totalCalories} kcal, ${waterGlasses} vasos de agua y una racha de ${currentStreak} días. ¿En qué te puedo ayudar?`
    )
    setMessages([welcome])
  }, [])

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [messages, sending])

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || sending) return
    if (!canUseAI()) return // Gate is shown in UI

    setInput('')
    setSending(true)

    const userMsg = createMessage('user', content)
    setMessages(prev => [...prev, userMsg])
    await incrementAI()

    try {
      const reply = await coachSend(content, messages, context)
      const assistantMsg = createMessage('assistant', reply)
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      const errMsg = createMessage('assistant', 'Ocurrió un error. Por favor intenta de nuevo.')
      setMessages(prev => [...prev, errMsg])
    } finally {
      setSending(false)
    }
  }, [input, sending, canUseAI, incrementAI, messages, context])

  const atLimit = !canUseAI()
  const remaining = DAILY_LIMIT - aiMessagesToday

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.headerIcon}>
            <Text style={s.headerIconTxt}>⚡</Text>
          </View>
          <View>
            <Text style={s.headerTitle}>Coach ZENCRUS</Text>
            <Text style={s.headerSub}>
              {isPremium() ? 'Premium · ilimitado' : `${remaining} mensajes gratis hoy`}
            </Text>
          </View>
        </View>
        <View style={[s.statusDot, { backgroundColor: sending ? Colors.accent.orange : Colors.accent.green }]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Context bar */}
        <View style={s.ctxBar}>
          <CtxChip label={`${totalCalories} kcal`} emoji="🍽️" />
          <CtxChip label={`${waterGlasses} vasos`} emoji="💧" />
          <CtxChip label={`${currentStreak}d racha`} emoji="🔥" />
          <CtxChip label={`Score ${healthScore}`} emoji="⭐" />
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
          {sending && <TypingIndicator />}

          {/* Quick questions (show when only welcome msg) */}
          {messages.length <= 1 && !sending && (
            <View style={s.quickWrap}>
              <Text style={s.quickTitle}>Preguntas frecuentes</Text>
              {QUICK_QUESTIONS.map(q => (
                <TouchableOpacity
                  key={q}
                  style={s.quickBtn}
                  onPress={() => handleSend(q)}
                  disabled={atLimit}
                >
                  <Text style={s.quickBtnTxt}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {atLimit && <PremiumGate used={aiMessagesToday} limit={DAILY_LIMIT} />}
        </ScrollView>

        {/* Input */}
        <View style={s.inputRow}>
          <TextInput
            style={[s.input, atLimit && s.inputDisabled]}
            value={input}
            onChangeText={setInput}
            placeholder={atLimit ? 'Límite diario alcanzado' : 'Escribe tu pregunta...'}
            placeholderTextColor={Colors.dark.textTertiary}
            multiline
            maxLength={500}
            editable={!atLimit}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending || atLimit) && s.sendBtnOff]}
            onPress={() => handleSend()}
            disabled={!input.trim() || sending || atLimit}
          >
            <Text style={s.sendBtnTxt}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function CtxChip({ label, emoji }: { label: string; emoji: string }) {
  return (
    <View style={cc.wrap}>
      <Text style={cc.emoji}>{emoji}</Text>
      <Text style={cc.label}>{label}</Text>
    </View>
  )
}

const cc = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderWidth: 1, borderColor: Colors.dark.border },
  emoji: { fontSize: 12 },
  label: { fontSize: 10, color: Colors.dark.textSecondary, fontWeight: '600' },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary[900], alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.primary[500] },
  headerIconTxt: { fontSize: 20 },
  headerTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text },
  headerSub: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  ctxBar: { flexDirection: 'row', gap: Spacing[2], paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], flexWrap: 'wrap' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing[4], paddingBottom: Spacing[4] },
  quickWrap: { marginTop: Spacing[4] },
  quickTitle: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing[3] },
  quickBtn: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[3], marginBottom: Spacing[2], borderWidth: 1, borderColor: Colors.dark.border },
  quickBtnTxt: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '500' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[2], paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderTopWidth: 1, borderTopColor: Colors.dark.border },
  input: { flex: 1, borderWidth: 1.5, borderColor: Colors.dark.border, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], fontSize: Typography.fontSize.base, color: Colors.dark.text, backgroundColor: Colors.dark.surface, maxHeight: 100 },
  inputDisabled: { opacity: 0.4 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary[500], alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border },
  sendBtnTxt: { fontSize: 20, color: '#fff', fontWeight: '800' },
})
