import { Linking } from 'react-native'
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

export async function startStripeCheckout(tier: CheckoutTier, extraMembers = 0): Promise<void> {
  const { data } = await api.post('/subscriptions/checkout', { tier, provider: 'stripe', extraMembers })
  const url: string | undefined = data?.data?.checkoutUrl
  if (!url) throw new Error('No se pudo crear la sesión de pago')
  const supported = await Linking.canOpenURL(url)
  if (!supported) throw new Error('No se puede abrir el navegador')
  await Linking.openURL(url)
}

export async function getCurrentSubscription() {
  const { data } = await api.get('/subscriptions/current')
  return data?.data ?? null
}

export async function cancelSubscription(): Promise<void> {
  await api.post('/subscriptions/cancel')
}
