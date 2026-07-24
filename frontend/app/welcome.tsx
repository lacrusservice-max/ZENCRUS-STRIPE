import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Animated, Dimensions, useColorScheme,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/theme'

const { width } = Dimensions.get('window')

// ── Goal labels ───────────────────────────────────────────────────────────────

const GOAL_LABEL: Record<string, string> = {
  lose_fat:     'Perder grasa',
  maintain:     'Mantener peso',
  gain_muscle:  'Ganar músculo',
}

const GOAL_EMOJI: Record<string, string> = {
  lose_fat:    '🔥',
  maintain:    '⚖️',
  gain_muscle: '💪',
}

// ── Macro card ────────────────────────────────────────────────────────────────

interface MacroCardProps {
  label: string
  value: string | number
  unit: string
  color: string
  icon: keyof typeof Ionicons.glyphMap
  delay: number
}

function MacroCard({ label, value, unit, color, icon, delay }: MacroCardProps) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[s.macroCard, { opacity, transform: [{ translateY }] }]}>
      <View style={[s.macroIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[s.macroValue, { color }]}>{value}<Text style={s.macroUnit}> {unit}</Text></Text>
      <Text style={s.macroLabel}>{label}</Text>
    </Animated.View>
  )
}

// ── AI message generator ──────────────────────────────────────────────────────

function getAIMessage(name: string, goal: string, calories: number): string {
  const firstName = name?.split(' ')[0] ?? 'Atleta'
  const goalKey = goal ?? 'maintain'

  if (goalKey === 'lose_fat') {
    return `${firstName}, analicé tu perfil completo y calculé un déficit calórico personalizado de ${calories} kcal/día. Esta estrategia está diseñada para que pierdas grasa de forma efectiva y sostenible, sin sacrificar músculo ni energía.`
  }
  if (goalKey === 'gain_muscle') {
    return `${firstName}, tu plan de ${calories} kcal/día incluye un superávit calórico calculado para maximizar la síntesis proteica y el crecimiento muscular, mientras minimizas la ganancia de grasa. Cada macro tiene su razón de ser.`
  }
  return `${firstName}, con ${calories} kcal/día mantendrás tu composición corporal actual mientras optimizas tu rendimiento y energía diaria. Este balance está ajustado a tu nivel de actividad y metabolismo real.`
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const { user } = useAuthStore()
  const colorScheme = useColorScheme()
  const [typedText, setTypedText] = useState('')

  const headerOpacity = useRef(new Animated.Value(0)).current
  const headerY = useRef(new Animated.Value(-30)).current
  const cardOpacity = useRef(new Animated.Value(0)).current
  const cardScale = useRef(new Animated.Value(0.92)).current
  const btnOpacity = useRef(new Animated.Value(0)).current

  const goals = user?.goals
  const calories = goals?.calories_target ?? 2000
  const protein = goals?.protein_g ?? 150
  const carbs = goals?.carbs_g ?? 200
  const fat = goals?.fat_g ?? 65
  const fiber = goals?.fiber_g ?? 28
  const mainGoal = goals?.main_goal ?? 'maintain'
  const firstName = user?.full_name?.split(' ')[0] ?? 'Atleta'

  const aiMessage = getAIMessage(user?.full_name ?? '', mainGoal, calories)

  const logoSource = colorScheme === 'light'
    ? require('@/assets/images/logo-negro.png')
    : require('@/assets/images/logo-blanco.png')

  // Typewriter effect for AI message
  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      if (i <= aiMessage.length) {
        setTypedText(aiMessage.slice(0, i))
        i++
      } else {
        clearInterval(timer)
      }
    }, 18)
    return () => clearInterval(timer)
  }, [aiMessage])

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(headerY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(btnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <View style={s.bg}>
      {/* Blobs decorativos */}
      <View style={[s.blob, { top: -100, right: -80, backgroundColor: Colors.primary[500] }]} />
      <View style={[s.blob, { bottom: -60, left: -60, backgroundColor: Colors.secondary[500], opacity: 0.06 }]} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Logo */}
          <Animated.View style={[s.logoWrap, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}>
            <Image source={logoSource} style={s.logo} resizeMode="contain" />
          </Animated.View>

          {/* Saludo */}
          <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerY }] }}>
            <View style={s.greetRow}>
              <View style={s.sparkBadge}>
                <Ionicons name="sparkles" size={14} color={Colors.primary[400]} />
                <Text style={s.sparkText}>Tu coach IA habla</Text>
              </View>
            </View>
            <Text style={s.greeting}>Bienvenido,{'\n'}<Text style={s.greetingName}>{firstName} 👋</Text></Text>
          </Animated.View>

          {/* Objetivo */}
          <Animated.View style={[s.goalChip, { opacity: headerOpacity }]}>
            <Text style={s.goalEmoji}>{GOAL_EMOJI[mainGoal]}</Text>
            <Text style={s.goalText}>Objetivo: <Text style={s.goalHighlight}>{GOAL_LABEL[mainGoal]}</Text></Text>
          </Animated.View>

          {/* Mensaje IA - typewriter */}
          <Animated.View style={[s.aiCard, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
            <View style={s.aiHeader}>
              <View style={s.aiIconWrap}>
                <Ionicons name="flash" size={16} color={Colors.primary[400]} />
              </View>
              <Text style={s.aiHeaderText}>Análisis ZENCRUS IA</Text>
              <View style={s.pulseDot} />
            </View>
            <Text style={s.aiText}>{typedText}</Text>
          </Animated.View>

          {/* Macros */}
          <Text style={s.sectionTitle}>Tu plan nutricional diario</Text>
          <View style={s.kcalBadge}>
            <Ionicons name="flame" size={22} color={Colors.accent.orange} />
            <Text style={s.kcalNumber}>{calories.toLocaleString()}</Text>
            <Text style={s.kcalLabel}>kcal / día</Text>
          </View>

          <View style={s.macroGrid}>
            <MacroCard label="Proteína" value={protein} unit="g" color="#60a5fa" icon="barbell" delay={200} />
            <MacroCard label="Carbohidratos" value={carbs} unit="g" color={Colors.accent.yellow} icon="leaf" delay={350} />
            <MacroCard label="Grasas" value={fat} unit="g" color={Colors.accent.orange} icon="water" delay={500} />
            <MacroCard label="Fibra" value={fiber} unit="g" color={Colors.accent.green} icon="nutrition" delay={650} />
          </View>

          {/* Disclaimer científico */}
          <View style={s.sciNote}>
            <Ionicons name="flask" size={13} color="rgba(255,255,255,0.3)" />
            <Text style={s.sciText}>Calculado con ecuación Mifflin-St Jeor · Ajustado a tu nivel de actividad y objetivo</Text>
          </View>

          {/* CTA */}
          <Animated.View style={{ opacity: btnOpacity, marginTop: Spacing[6] }}>
            <TouchableOpacity style={s.ctaBtn} onPress={() => router.replace('/subscription-intro')} activeOpacity={0.85}>
              <View style={s.ctaShine} pointerEvents="none" />
              <Text style={s.ctaText}>Elegir mi plan y empezar gratis</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={s.skipText}>5 días gratis en cualquier plan · después se cobra automáticamente</Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080808' },
  blob: {
    position: 'absolute', borderRadius: 9999,
    opacity: 0.10, width: 280, height: 280,
  },
  scroll: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[10] },

  logoWrap: { alignItems: 'center', paddingTop: Spacing[4], paddingBottom: Spacing[5] },
  logo: { width: 130, height: 40 },

  greetRow: { alignItems: 'flex-start', marginBottom: Spacing[2] },
  sparkBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.primary[500]}20`,
    borderWidth: 1, borderColor: `${Colors.primary[500]}40`,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  sparkText: { fontSize: 12, color: Colors.primary[400], fontWeight: '600' },

  greeting: {
    fontSize: 30, fontWeight: '300', color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing[3], lineHeight: 38,
  },
  greetingName: { fontSize: 32, fontWeight: '800', color: '#fff' },

  goalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
    alignSelf: 'flex-start', marginTop: Spacing[4], marginBottom: Spacing[6],
  },
  goalEmoji: { fontSize: 18 },
  goalText: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.45)' },
  goalHighlight: { color: '#fff', fontWeight: '700' },

  // AI Card
  aiCard: {
    backgroundColor: '#111',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: `${Colors.primary[500]}30`,
    padding: Spacing[5],
    marginBottom: Spacing[6],
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing[3] },
  aiIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: `${Colors.primary[500]}25`,
    alignItems: 'center', justifyContent: 'center',
  },
  aiHeaderText: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.primary[400] },
  pulseDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.accent.green,
    shadowColor: Colors.accent.green, shadowRadius: 6, shadowOpacity: 0.8, elevation: 4,
  },
  aiText: {
    fontSize: Typography.fontSize.base,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 24,
    minHeight: 72,
  },

  // Macros
  sectionTitle: {
    fontSize: Typography.fontSize.sm, fontWeight: '600',
    color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: Spacing[4],
  },
  kcalBadge: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    marginBottom: Spacing[5],
  },
  kcalNumber: { fontSize: 42, fontWeight: '800', color: '#fff' },
  kcalLabel: { fontSize: Typography.fontSize.base, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },

  macroGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, marginBottom: Spacing[4],
  },
  macroCard: {
    width: (width - Spacing[5] * 2 - 12) / 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: Spacing[4],
    gap: 6,
  },
  macroIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  macroValue: { fontSize: 26, fontWeight: '800' },
  macroUnit: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  macroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },

  sciNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingHorizontal: 4,
  },
  sciText: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.25)', lineHeight: 16 },

  // CTA
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary[500],
    borderRadius: 16, paddingVertical: 17,
    overflow: 'hidden',
    shadowColor: Colors.primary[500], shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 28, elevation: 16,
  },
  ctaShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  ctaText: { fontSize: Typography.fontSize.base, fontWeight: '700', color: '#fff' },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
})
