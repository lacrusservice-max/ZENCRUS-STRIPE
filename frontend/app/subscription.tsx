import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { usePremiumStore } from '@/store/premiumStore'
import { startStripePaymentSheet, cancelSubscription, getCurrentSubscription, STRIPE_PLANS, CheckoutTier } from '@/services/stripeService'
import { Colors, Typography, Spacing, BorderRadius, Glass } from '@/constants/theme'

const logoBlanco = require('@/assets/images/logo-blanco.png')

const FEATURES = [
  { icon: 'flash',            label: 'Coach IA',         free: '5 msgs/día',   premium: 'Ilimitado' },
  { icon: 'barcode',          label: 'Escáner',          free: '5 scans/día',  premium: 'Ilimitado' },
  { icon: 'trophy',           label: 'Desafíos',         free: '4 básicos',    premium: 'Todos' },
  { icon: 'camera',           label: 'Fotos progreso',   free: '3 fotos',      premium: 'Ilimitado' },
  { icon: 'stats-chart',      label: 'Reportes',         free: 'Básico',       premium: 'PDF + historial' },
  { icon: 'people',           label: 'Rankings',         free: 'Top 10',       premium: 'Completo' },
  { icon: 'restaurant',       label: 'Meal Planner',     free: 'Solo ver',     premium: 'Guardar semanas' },
] as const

const PLAN_ORDER: CheckoutTier[] = ['monthly', 'annual_individual']

export default function SubscriptionScreen() {
  const { user } = useAuthStore()
  const { setFree } = usePremiumStore()
  const [selected, setSelected] = useState<CheckoutTier>('annual_individual')
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [realStatus, setRealStatus] = useState<{ tier: string; end_date?: string } | null>(null)

  const refreshStatus = async () => {
    try {
      const sub = await getCurrentSubscription()
      setRealStatus(sub)
    } catch {
      setRealStatus(null)
    } finally {
      setCheckingStatus(false)
    }
  }

  useEffect(() => { refreshStatus() }, [])

  const activePlan = !!realStatus?.tier && realStatus.tier !== 'free'
  const planLabelMap: Record<string, string> = { monthly: 'Mensual', annual_individual: 'Anual Individual' }

  const handleCheckout = async () => {
    if (!user) {
      Alert.alert('Inicia sesión', 'Debes iniciar sesión para suscribirte.')
      return
    }

    setConfirmVisible(false)
    setLoading(true)
    try {
      // `false` = el usuario cerró la hoja de Stripe. No se sigue a la pantalla
      // de confirmación: no hay nada que confirmar y se quedaba dando vueltas
      // esperando un webhook que no iba a llegar.
      const pago = await startStripePaymentSheet(selected)
      if (!pago) return
      // Tampoco se asume éxito local: /checkout/success confirma contra el
      // backend real, porque el webhook de Stripe tarda unos segundos.
      router.replace({ pathname: '/checkout/success', params: { plan: selected } })
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'No se pudo iniciar el pago. Intenta de nuevo.'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    Alert.alert(
      'Cancelar suscripción',
      '¿Estás seguro? Perderás acceso a todas las funciones Premium al final de tu período actual.',
      [
        { text: 'No, mantener', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true)
            try {
              await cancelSubscription()
              await setFree()
              await refreshStatus()
              Alert.alert('Cancelado', 'Tu suscripción fue cancelada. Sigues con acceso hasta que expire.')
            } catch {
              Alert.alert('Error', 'No se pudo cancelar. Contacta a soporte.')
            } finally {
              setCancelling(false)
            }
          },
        },
      ]
    )
  }

  if (checkingStatus) {
    return (
      <SafeAreaView style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.primary[400]} size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>ZENCRUS Premium</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Active badge or hero */}
        {activePlan ? (
          <View style={s.activeBadge}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.accent.green} />
            <View style={{ flex: 1 }}>
              <Text style={s.activeTitle}>Plan activo</Text>
              <Text style={s.activeSub}>
                {planLabelMap[realStatus?.tier ?? ''] ?? realStatus?.tier}
                {realStatus?.end_date ? ` · vence ${new Date(realStatus.end_date).toLocaleDateString('es-MX')}` : ''}
              </Text>
            </View>
          </View>
        ) : (
          <View style={s.hero}>
            <View style={s.heroIcon}>
              <Ionicons name="flash" size={36} color={Colors.primary[400]} />
            </View>
            <Text style={s.heroTitle}>Desbloquea todo{'\n'}ZENCRUS</Text>
            <Text style={s.heroSub}>Coach IA ilimitado, escáner sin límite, reportes avanzados y mucho más.</Text>
          </View>
        )}

        {/* Feature comparison */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Qué incluye Premium</Text>
          <View style={s.featureHeader}>
            <View style={{ flex: 1 }} />
            <Text style={s.featureColFree}>Gratis</Text>
            <Text style={s.featureColPremium}>Premium</Text>
          </View>
          {FEATURES.map(f => (
            <View key={f.label} style={s.featureRow}>
              <View style={s.featureIconWrap}>
                <Ionicons name={f.icon as any} size={14} color={Colors.primary[400]} />
              </View>
              <Text style={s.featureLabel}>{f.label}</Text>
              <Text style={s.featureColFreeVal}>{f.free}</Text>
              <Text style={s.featureColPremiumVal}>{f.premium}</Text>
            </View>
          ))}
        </View>

        {/* Plan selector (only for non-premium) */}
        {!activePlan && (
          <>
            <Text style={s.sectionTitle}>Elige tu plan</Text>

            {PLAN_ORDER.map(tier => {
              const p = STRIPE_PLANS[tier]
              const isSelected = selected === tier
              return (
                <TouchableOpacity
                  key={tier}
                  style={[s.planCard, isSelected && s.planCardSelected, p.highlight && s.planCardHighlight]}
                  onPress={() => setSelected(tier)}
                  activeOpacity={0.8}
                >
                  {p.highlight && (
                    <View style={s.bestBadge}>
                      <Text style={s.bestBadgeTxt}>MEJOR VALOR</Text>
                    </View>
                  )}
                  <View style={s.planRow}>
                    <View style={[s.radio, isSelected && s.radioSelected]}>
                      {isSelected && <View style={s.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.planLabel}>{p.label}</Text>
                      {p.savings && <Text style={s.planSavings}>{p.savings}</Text>}
                    </View>
                    <View style={s.planPriceWrap}>
                      <Text style={s.planPrice}>{p.price}</Text>
                      <Text style={s.planPeriod}>MXN{p.period}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}

            {/* Checkout button */}
            <TouchableOpacity
              style={[s.checkoutBtn, loading && s.checkoutBtnOff]}
              onPress={() => setConfirmVisible(true)}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : (
                  <View style={s.checkoutBtnInner}>
                    <Ionicons name="flash" size={18} color="#fff" />
                    <Text style={s.checkoutBtnTxt}>Suscribirme — {STRIPE_PLANS[selected].price} MXN</Text>
                  </View>
                )
              }
            </TouchableOpacity>

            <Text style={s.disclaimer}>
              Pago seguro con Stripe. Cancela cuando quieras.{'\n'}Al suscribirte aceptas los términos de servicio.
            </Text>
          </>
        )}

        {/* Cancel (for premium users) */}
        {activePlan && (
          <TouchableOpacity
            style={s.cancelBtn}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling
              ? <ActivityIndicator color={Colors.accent.red} />
              : <Text style={s.cancelBtnTxt}>Cancelar suscripción</Text>
            }
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Confirmación previa al pago — refuerza confianza con el logo real de ZENCRUS,
          ya que el PaymentSheet nativo de Stripe solo admite texto, no imágenes. */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <TouchableOpacity style={s.modalClose} onPress={() => setConfirmVisible(false)}>
              <Ionicons name="close" size={22} color={Colors.dark.textSecondary} />
            </TouchableOpacity>

            <Image source={logoBlanco} style={s.modalLogo} resizeMode="contain" />

            <Text style={s.modalPlanLabel}>{STRIPE_PLANS[selected].label}</Text>
            <Text style={s.modalPlanPrice}>
              {STRIPE_PLANS[selected].price} <Text style={s.modalPlanPeriod}>MXN{STRIPE_PLANS[selected].period}</Text>
            </Text>
            <Text style={s.modalTrial}>5 días gratis · después se cobra automáticamente</Text>

            <View style={s.modalSecureRow}>
              <Ionicons name="lock-closed" size={14} color={Colors.dark.textSecondary} />
              <Text style={s.modalSecureTxt}>Pago protegido y cifrado por Stripe</Text>
            </View>

            <TouchableOpacity style={s.modalConfirmBtn} onPress={handleCheckout} activeOpacity={0.85}>
              <Text style={s.modalConfirmBtnTxt}>Continuar con el pago seguro</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setConfirmVisible(false)}>
              <Text style={s.modalCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.dark.background },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  backBtn:            { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text },
  scroll:             { padding: Spacing[5], paddingBottom: Spacing[12] },

  // Active badge
  activeBadge:        { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: Glass.successTint, borderWidth: 1, borderColor: Glass.successBorder, borderRadius: BorderRadius.xl, padding: Spacing[4], marginBottom: Spacing[5] },
  activeTitle:        { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text },
  activeSub:          { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, marginTop: 2 },

  // Hero
  hero:               { alignItems: 'center', paddingVertical: Spacing[6], marginBottom: Spacing[2] },
  heroIcon:           { width: 80, height: 80, borderRadius: 40, backgroundColor: Glass.purpleTint, borderWidth: 1.5, borderColor: Glass.purpleBorder, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[4] },
  heroTitle:          { fontSize: Typography.fontSize['3xl'], fontWeight: '900', color: Colors.dark.text, textAlign: 'center', lineHeight: 38, marginBottom: Spacing[3] },
  heroSub:            { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Feature comparison
  card:               { backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.xl, padding: Spacing[4], marginBottom: Spacing[6] },
  cardTitle:          { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text, marginBottom: Spacing[3] },
  featureHeader:      { flexDirection: 'row', marginBottom: Spacing[2], paddingBottom: Spacing[2], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  featureColFree:     { width: 76, fontSize: 10, fontWeight: '700', color: Colors.dark.textTertiary, textAlign: 'center' },
  featureColPremium:  { width: 80, fontSize: 10, fontWeight: '700', color: Colors.primary[400], textAlign: 'center' },
  featureRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[2] },
  featureIconWrap:    { width: 22, alignItems: 'center' },
  featureLabel:       { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark.text, marginLeft: Spacing[2] },
  featureColFreeVal:  { width: 76, fontSize: 10, color: Colors.dark.textTertiary, textAlign: 'center' },
  featureColPremiumVal: { width: 80, fontSize: 10, color: Colors.primary[300], fontWeight: '700', textAlign: 'center' },

  // Plans
  sectionTitle:       { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text, marginBottom: Spacing[3] },
  planCard:           { backgroundColor: Glass.card, borderWidth: 1.5, borderColor: Glass.cardBorder, borderRadius: BorderRadius.xl, padding: Spacing[4], marginBottom: Spacing[3] },
  planCardSelected:   { borderColor: Colors.primary[500], backgroundColor: Glass.purpleTint },
  planCardHighlight:  { borderColor: Colors.primary[600] },
  bestBadge:          { alignSelf: 'flex-start', backgroundColor: Colors.primary[500], borderRadius: BorderRadius.full, paddingHorizontal: Spacing[3], paddingVertical: 2, marginBottom: Spacing[2] },
  bestBadgeTxt:       { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.8 },
  planRow:            { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  radio:              { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.dark.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected:      { borderColor: Colors.primary[500] },
  radioDot:           { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary[500] },
  planLabel:          { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text },
  planSavings:        { fontSize: Typography.fontSize.xs, color: Colors.primary[400], marginTop: 2 },
  planPriceWrap:      { alignItems: 'flex-end' },
  planPrice:          { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  planPeriod:         { fontSize: 10, color: Colors.dark.textTertiary },

  // Checkout
  checkoutBtn:        { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.xl, paddingVertical: Spacing[4], alignItems: 'center', marginTop: Spacing[2], marginBottom: Spacing[3] },
  checkoutBtnOff:     { opacity: 0.6 },
  checkoutBtnInner:   { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  checkoutBtnTxt:     { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '800' },
  disclaimer:         { fontSize: 11, color: Colors.dark.textTertiary, textAlign: 'center', lineHeight: 16 },

  // Cancel
  cancelBtn:          { backgroundColor: Glass.errorTint, borderWidth: 1, borderColor: 'rgba(255,122,31,0.22)', borderRadius: BorderRadius.lg, paddingVertical: Spacing[4], alignItems: 'center', marginTop: Spacing[4] },
  cancelBtnTxt:       { color: Colors.accent.red, fontSize: Typography.fontSize.sm, fontWeight: '700' },

  // Modal de confirmación previa al pago
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(5,5,5,0.7)', alignItems: 'center', justifyContent: 'center', padding: Spacing[6] },
  modalCard:          { width: '100%', maxWidth: 380, backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: BorderRadius['2xl'], padding: Spacing[6], alignItems: 'center' },
  modalClose:         { position: 'absolute', top: Spacing[3], right: Spacing[3], width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalLogo:          { width: 96, height: 40, marginTop: Spacing[2], marginBottom: Spacing[5] },
  modalPlanLabel:     { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, fontWeight: '700' },
  modalPlanPrice:     { fontSize: Typography.fontSize['3xl'], color: Colors.dark.text, fontWeight: '900', marginTop: 4 },
  modalPlanPeriod:    { fontSize: Typography.fontSize.sm, color: Colors.dark.textTertiary, fontWeight: '600' },
  modalTrial:         { fontSize: Typography.fontSize.xs, color: Colors.primary[400], fontWeight: '700', marginTop: Spacing[2], textAlign: 'center' },
  modalSecureRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing[5], marginBottom: Spacing[5] },
  modalSecureTxt:     { fontSize: 11, color: Colors.dark.textSecondary },
  modalConfirmBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2], backgroundColor: Colors.primary[500], borderRadius: BorderRadius.xl, paddingVertical: Spacing[4], width: '100%', marginBottom: Spacing[3] },
  modalConfirmBtnTxt: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '800' },
  modalCancelTxt:     { color: Colors.dark.textTertiary, fontSize: Typography.fontSize.sm, fontWeight: '600', paddingVertical: Spacing[2] },
})
