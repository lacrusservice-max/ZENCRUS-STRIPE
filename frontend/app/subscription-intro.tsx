import { useRef, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Animated, Dimensions, ActivityIndicator, Alert,
  useColorScheme,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { usePremiumStore, PRICING } from '@/store/premiumStore'
import { Colors, Spacing, Typography } from '@/constants/theme'
import api from '@/services/api'

const { width } = Dimensions.get('window')

// ── Plan config ───────────────────────────────────────────────────────────────

type PlanKey = 'monthly' | 'annual_individual' | 'annual_duo' | 'annual_familiar'

interface PlanConfig {
  key: PlanKey
  label: string
  price: number
  period: string
  perMonth: string
  savings: string | null
  badge: string | null
  color: string
  features: string[]
}

const PLANS: PlanConfig[] = [
  {
    key: 'annual_individual',
    label: 'Anual Individual',
    price: 1999,
    period: 'año',
    perMonth: '$166/mes',
    savings: 'Ahorra $401 vs mensual',
    badge: 'MÁS POPULAR',
    color: Colors.primary[400],
    features: ['Coach IA ilimitado', 'Escáner sin límite', 'Reportes PDF', 'Todos los desafíos', 'Meal Planner completo'],
  },
  {
    key: 'monthly',
    label: 'Mensual',
    price: 200,
    period: 'mes',
    perMonth: '$200/mes',
    savings: null,
    badge: null,
    color: 'rgba(255,255,255,0.55)',
    features: ['Coach IA ilimitado', 'Escáner sin límite', 'Reportes PDF', 'Todos los desafíos', 'Meal Planner completo'],
  },
  {
    key: 'annual_duo',
    label: 'Anual Dúo',
    price: 3399,
    period: 'año',
    perMonth: '$141/mes p/usuario',
    savings: '2 usuarios incluidos',
    badge: null,
    color: Colors.secondary[400],
    features: ['Todo Individual', '2 cuentas premium', 'Panel de pareja', 'Desafíos en dúo'],
  },
  {
    key: 'annual_familiar',
    label: 'Anual Familiar',
    price: 5799,
    period: 'año',
    perMonth: '$120/mes p/usuario',
    savings: 'Hasta 4 usuarios',
    badge: 'MEJOR VALOR',
    color: Colors.accent.green,
    features: ['Todo Dúo', '4 cuentas premium', 'Panel familiar', 'Estadísticas grupales'],
  },
]

// ── Features comparadas (trial vs premium) ────────────────────────────────────

const TRIAL_FEATURES = [
  { icon: 'flash' as const,        label: 'Coach IA',          trial: '5 días ilimitado',  free: '5 msgs/día' },
  { icon: 'barcode' as const,      label: 'Escáner',           trial: '5 días ilimitado',  free: '5 scans/día' },
  { icon: 'stats-chart' as const,  label: 'Reportes PDF',      trial: 'Incluido',          free: 'Solo básico' },
  { icon: 'trophy' as const,       label: 'Todos los retos',   trial: 'Incluido',          free: '4 básicos' },
  { icon: 'restaurant' as const,   label: 'Meal Planner',      trial: 'Incluido',          free: 'Solo ver' },
]

// ── Plan Card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan, selected, onSelect, delay,
}: { plan: PlanConfig; selected: boolean; onSelect: () => void; delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(24)).current
  const scale = useRef(new Animated.Value(selected ? 1 : 0.98)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start()
  }, [])

  useEffect(() => {
    Animated.spring(scale, { toValue: selected ? 1 : 0.98, useNativeDriver: true }).start()
  }, [selected])

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <TouchableOpacity
        onPress={onSelect}
        activeOpacity={0.85}
        style={[
          s.planCard,
          selected && { borderColor: plan.color, borderWidth: 1.5, backgroundColor: `${plan.color}0A` },
        ]}
      >
        {/* Badge */}
        {plan.badge && (
          <View style={[s.badge, { backgroundColor: plan.color }]}>
            <Text style={s.badgeText}>{plan.badge}</Text>
          </View>
        )}

        <View style={s.planRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.planName, selected && { color: plan.color }]}>{plan.label}</Text>
            {plan.savings && <Text style={s.planSavings}>{plan.savings}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.planPrice, selected && { color: plan.color }]}>
              ${plan.price.toLocaleString()}
            </Text>
            <Text style={s.planPeriod}>MXN / {plan.period}</Text>
          </View>
        </View>

        <Text style={s.planPerMonth}>{plan.perMonth}</Text>

        {/* Radio */}
        <View style={s.radioRow}>
          <View style={[s.radio, selected && { borderColor: plan.color }]}>
            {selected && <View style={[s.radioDot, { backgroundColor: plan.color }]} />}
          </View>
          <Text style={s.radioLabel}>{selected ? 'Seleccionado' : 'Seleccionar'}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SubscriptionIntroScreen() {
  const { user } = useAuthStore()
  const { setPremium } = usePremiumStore()
  const colorScheme = useColorScheme()
  const [selected, setSelected] = useState<PlanKey>('annual_individual')
  const [startingTrial, setStartingTrial] = useState(false)
  const [choosingPlan, setChoosingPlan] = useState(false)

  const headerOpacity = useRef(new Animated.Value(0)).current
  const trialOpacity = useRef(new Animated.Value(0)).current

  const logoSource = colorScheme === 'light'
    ? require('@/assets/images/logo-negro.png')
    : require('@/assets/images/logo-blanco.png')

  const firstName = user?.full_name?.split(' ')[0] ?? 'Atleta'

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(trialOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start()
  }, [])

  const handleStartTrial = async () => {
    setStartingTrial(true)
    try {
      await api.post('/subscriptions/start-trial')
      const trialEnds = new Date()
      trialEnds.setDate(trialEnds.getDate() + 5)
      await setPremium('monthly', trialEnds.toISOString().slice(0, 10))
      router.replace('/(tabs)')
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'No se pudo iniciar la prueba. Intenta de nuevo.'
      Alert.alert('Error', msg)
    } finally {
      setStartingTrial(false)
    }
  }

  const handleChoosePlan = async () => {
    setChoosingPlan(true)
    try {
      router.push({ pathname: '/subscription', params: { plan: selected } })
    } catch {
      Alert.alert('Error', 'No se pudo abrir el pago. Intenta de nuevo.')
    } finally {
      setChoosingPlan(false)
    }
  }

  return (
    <View style={s.bg}>
      <View style={[s.blob, { top: -80, right: -60, backgroundColor: Colors.primary[500] }]} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <Animated.View style={[s.logoWrap, { opacity: headerOpacity }]}>
            <Image source={logoSource} style={s.logo} resizeMode="contain" />
          </Animated.View>

          {/* Header */}
          <Animated.View style={{ opacity: headerOpacity }}>
            <Text style={s.title}>Desbloquea tu{'\n'}<Text style={s.titleAccent}>potencial completo</Text></Text>
            <Text style={s.subtitle}>
              {firstName}, tienes acceso a todas las herramientas para alcanzar tu objetivo más rápido.
            </Text>
          </Animated.View>

          {/* Trial CTA — más prominente */}
          <Animated.View style={[s.trialCard, { opacity: trialOpacity }]}>
            <View style={s.trialHeader}>
              <View style={s.trialIconWrap}>
                <Ionicons name="gift" size={22} color={Colors.accent.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.trialTitle}>5 días gratis — sin tarjeta</Text>
                <Text style={s.trialSubtitle}>Prueba Premium completo sin compromiso</Text>
              </View>
            </View>

            {/* Mini feature table */}
            <View style={s.featureTable}>
              {TRIAL_FEATURES.map((f, i) => (
                <View key={i} style={s.featureRow}>
                  <Ionicons name={f.icon} size={14} color={Colors.primary[400]} style={{ width: 18 }} />
                  <Text style={s.featureName}>{f.label}</Text>
                  <Text style={s.featureTrial}>{f.trial}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[s.trialBtn, startingTrial && { opacity: 0.7 }]}
              onPress={handleStartTrial}
              disabled={startingTrial}
              activeOpacity={0.85}
            >
              {startingTrial
                ? <ActivityIndicator color="#000" />
                : (
                  <>
                    <Ionicons name="flash" size={18} color="#000" />
                    <Text style={s.trialBtnText}>Empezar 5 días gratis</Text>
                  </>
                )
              }
            </TouchableOpacity>
            <Text style={s.trialNote}>Sin cobros automáticos · Cancela cuando quieras</Text>
          </Animated.View>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>o elige un plan ahora</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Plans */}
          {PLANS.map((plan, i) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              selected={selected === plan.key}
              onSelect={() => setSelected(plan.key)}
              delay={i * 80}
            />
          ))}

          {/* Pay CTA */}
          <TouchableOpacity
            style={[s.payBtn, choosingPlan && { opacity: 0.7 }]}
            onPress={handleChoosePlan}
            disabled={choosingPlan}
            activeOpacity={0.85}
          >
            <View style={s.payShine} pointerEvents="none" />
            {choosingPlan
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <Text style={s.payBtnText}>
                    Suscribirme — ${PRICING[selected].price.toLocaleString()} MXN
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.skipBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.skipText}>Continuar con cuenta gratuita</Text>
          </TouchableOpacity>

          <Text style={s.legal}>
            Al suscribirte aceptas nuestros Términos de Servicio y Política de Privacidad.
            La suscripción se renueva automáticamente. Cancela en cualquier momento.
          </Text>

        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080808' },
  blob: { position: 'absolute', borderRadius: 9999, opacity: 0.09, width: 260, height: 260 },
  scroll: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[10] },

  logoWrap: { alignItems: 'center', paddingTop: Spacing[4], paddingBottom: Spacing[5] },
  logo: { width: 120, height: 38 },

  title: {
    fontSize: 30, fontWeight: '300', color: 'rgba(255,255,255,0.6)',
    lineHeight: 38, marginBottom: Spacing[3],
  },
  titleAccent: { fontWeight: '800', color: '#fff' },
  subtitle: {
    fontSize: Typography.fontSize.base, color: 'rgba(255,255,255,0.4)',
    lineHeight: 24, marginBottom: Spacing[6],
  },

  // Trial card
  trialCard: {
    backgroundColor: '#0D1F0D',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: `${Colors.accent.green}35`,
    padding: Spacing[5],
    marginBottom: Spacing[6],
  },
  trialHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing[4] },
  trialIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: `${Colors.accent.green}20`,
    alignItems: 'center', justifyContent: 'center',
  },
  trialTitle: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: '#fff', marginBottom: 2 },
  trialSubtitle: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.45)' },

  featureTable: { gap: 10, marginBottom: Spacing[5] },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureName: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  featureTrial: { fontSize: 13, fontWeight: '700', color: Colors.accent.green },

  trialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent.green,
    borderRadius: 14, paddingVertical: 16,
    shadowColor: Colors.accent.green, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  trialBtnText: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#000' },
  trialNote: {
    textAlign: 'center', fontSize: 11,
    color: 'rgba(255,255,255,0.25)', marginTop: 10,
  },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing[5] },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  dividerText: { fontSize: 12, color: 'rgba(255,255,255,0.25)', fontWeight: '500' },

  // Plan cards
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: Spacing[5],
    marginBottom: 12,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute', top: 0, right: 16,
    paddingHorizontal: 10, paddingVertical: 4,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#000', letterSpacing: 0.5 },

  planRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  planName: { fontSize: Typography.fontSize.base, fontWeight: '700', color: '#fff', marginBottom: 2 },
  planSavings: { fontSize: 11, color: Colors.accent.green, fontWeight: '600' },
  planPrice: { fontSize: 24, fontWeight: '800', color: '#fff' },
  planPeriod: { fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'right' },
  planPerMonth: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: Spacing[3] },

  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },

  // Pay CTA
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary[500],
    borderRadius: 16, paddingVertical: 17,
    overflow: 'hidden', marginTop: Spacing[4],
    shadowColor: Colors.primary[500], shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45, shadowRadius: 28, elevation: 16,
  },
  payShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  payBtnText: { fontSize: Typography.fontSize.base, fontWeight: '700', color: '#fff' },

  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },

  legal: {
    fontSize: 10, color: 'rgba(255,255,255,0.18)',
    textAlign: 'center', lineHeight: 16, paddingHorizontal: Spacing[4],
    marginTop: Spacing[2],
  },
})
