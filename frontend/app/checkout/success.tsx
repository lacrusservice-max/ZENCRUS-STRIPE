import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated'
import { getCurrentSubscription } from '@/services/stripeService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const PLAN_LABELS: Record<string, string> = {
  monthly: 'Mensual', annual_individual: 'Anual Individual', annual_duo: 'Anual Dúo', annual_familiar: 'Anual Familiar',
}

const INCLUDED = [
  { icon: 'flash', label: 'Coach IA ilimitado' },
  { icon: 'barcode', label: 'Escáner de alimentos sin límite' },
  { icon: 'stats-chart', label: 'Reportes PDF + historial completo' },
  { icon: 'trophy', label: 'Todos los desafíos y duelos' },
  { icon: 'restaurant', label: 'Meal Planner — guarda semanas completas' },
  { icon: 'people', label: 'Leaderboard completo de la comunidad' },
]

export default function CheckoutSuccess() {
  const router = useRouter()
  const { plan } = useLocalSearchParams<{ plan?: string }>()
  const scale = useSharedValue(0)
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const [status, setStatus] = useState<'checking' | 'confirmed' | 'timeout'>('checking')
  const [tier, setTier] = useState<string | null>(null)
  const attempts = useRef(0)

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12 })
    let cancelled = false

    const poll = async () => {
      attempts.current += 1
      try {
        const sub = await getCurrentSubscription()
        if (cancelled) return
        if (sub?.tier && sub.tier !== 'free') {
          setTier(sub.tier)
          setStatus('confirmed')
          return
        }
      } catch { /* keep polling */ }
      if (attempts.current >= 10) { if (!cancelled) setStatus('timeout'); return }
      setTimeout(poll, 1500)
    }
    poll()
    return () => { cancelled = true }
  }, [])

  if (status === 'checking') {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.primary[400]} size="large" />
        <Text style={styles.checkingText}>Confirmando tu pago con Stripe…</Text>
      </View>
    )
  }

  if (status === 'timeout') {
    return (
      <View style={styles.container}>
        <Ionicons name="time-outline" size={64} color={Colors.dark.textSecondary} />
        <Text style={styles.title}>Estamos confirmando tu pago</Text>
        <Text style={styles.sub}>A veces tarda unos segundos más. Puedes reintentar o volver más tarde — tu pago con Stripe ya se procesó.</Text>
        <TouchableOpacity style={styles.continueBtn} onPress={() => { setStatus('checking'); attempts.current = 0 }}>
          <Text style={styles.continueBtnTxt}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const planLabel = PLAN_LABELS[tier ?? plan ?? ''] ?? tier ?? plan

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: Spacing[6], paddingTop: Spacing[10] }}>
        <Animated.View style={[styles.iconWrap, iconStyle]}>
          <Ionicons name="checkmark-circle" size={88} color={Colors.accent.green} />
        </Animated.View>
        <Text style={styles.title}>¡Pago confirmado!</Text>
        <Text style={styles.sub}>Tu plan {planLabel} está activo. Esto es lo que ya puedes usar:</Text>

        <View style={styles.card}>
          {INCLUDED.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <Ionicons name={f.icon as any} size={18} color={Colors.primary[400]} />
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Ionicons name="checkmark" size={16} color={Colors.accent.green} />
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.continueBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
          <Text style={styles.continueBtnTxt}>Continuar a ZENCRUS</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center', gap: 16 },
  checkingText: { color: Colors.dark.textSecondary, fontSize: Typography.fontSize.sm },
  iconWrap: { marginBottom: 8 },
  title: { color: Colors.dark.text, fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  sub: { color: Colors.dark.textSecondary, fontSize: Typography.fontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: Spacing[4] },
  card: { width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: BorderRadius.xl, padding: Spacing[4], marginBottom: Spacing[8] },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[2] },
  featureLabel: { flex: 1, color: Colors.dark.text, fontSize: Typography.fontSize.sm, fontWeight: '600' },
  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2], backgroundColor: Colors.primary[500], borderRadius: BorderRadius.xl, paddingVertical: Spacing[4], paddingHorizontal: Spacing[8], width: '100%' },
  continueBtnTxt: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '800' },
})
