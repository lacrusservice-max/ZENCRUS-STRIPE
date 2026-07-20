import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native'
import api from './api'

export type CheckoutTier = 'monthly' | 'annual_individual' | 'annual_duo' | 'annual_familiar'

export const STRIPE_PLANS: Record<CheckoutTier, { label: string; price: string; priceNum: number; period: string; savings: string | null; highlight: boolean }> = {
  monthly: {
    label: 'Mensual',
    price: '$200',
    priceNum: 200,
    period: '/mes',
    savings: null,
    highlight: false,
  },
  annual_individual: {
    label: 'Anual Individual',
    price: '$1,999',
    priceNum: 1999,
    period: '/año',
    savings: 'Ahorra $401 vs mensual',
    highlight: true,
  },
  annual_duo: {
    label: 'Anual Dúo',
    price: '$3,399',
    priceNum: 3399,
    period: '/año',
    savings: '2 usuarios incluidos',
    highlight: false,
  },
  annual_familiar: {
    label: 'Anual Familiar',
    price: '$5,799',
    priceNum: 5799,
    period: '/año',
    savings: 'Hasta 4 usuarios',
    highlight: false,
  },
}

export async function startStripePaymentSheet(tier: CheckoutTier, extraMembers = 0): Promise<void> {
  const { data } = await api.post('/subscriptions/checkout', { tier, provider: 'stripe', extraMembers })
  const { paymentIntent, ephemeralKey, customerId } = data?.data ?? {}

  if (!paymentIntent || !ephemeralKey || !customerId) {
    throw new Error('No se pudo iniciar el pago. Intenta de nuevo.')
  }

  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: 'ZENCRUS',
    customerId,
    customerEphemeralKeySecret: ephemeralKey,
    paymentIntentClientSecret: paymentIntent,
    allowsDelayedPaymentMethods: false,
    appearance: {
      colors: {
        primary: '#5B4FFF',
        background: '#0F0F14',
        componentBackground: '#1A1A2E',
        componentBorder: 'rgba(255,255,255,0.12)',
        componentDivider: 'rgba(255,255,255,0.08)',
        primaryText: '#F0F0F5',
        secondaryText: '#A8A8B8',
        componentText: '#F0F0F5',
        placeholderText: 'rgba(255,255,255,0.3)',
        icon: '#A78BFA',
        error: '#EF4444',
      },
    },
  })

  if (initError) throw new Error(initError.message)

  const { error } = await presentPaymentSheet()
  if (error) {
    if (error.code === 'Canceled') return
    throw new Error(error.message)
  }
}

export async function getCurrentSubscription() {
  const { data } = await api.get('/subscriptions/current')
  return data?.data ?? null
}

export async function cancelSubscription(): Promise<void> {
  await api.post('/subscriptions/cancel')
}
