import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native'
import api from './api'

export type CheckoutTier = 'monthly' | 'annual_individual'

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
}

/**
 * Devuelve `true` solo si el usuario COMPLETÓ el pago.
 *
 * Antes no devolvía nada y el cancelado hacía un `return` seco, así que
 * resolvía igual que un pago hecho. Quien llamaba no tenía forma de
 * distinguirlos: cerrar la hoja de Stripe con la X llevaba derecho a
 * «Confirmando tu pago…» y de ahí a una pantalla sin salida, sin que hubiera
 * ocurrido ningún cargo. El comentario de `subscription.tsx` afirmaba justo lo
 * contrario de lo que hacía el código.
 */
export async function startStripePaymentSheet(tier: CheckoutTier): Promise<boolean> {
  const { data } = await api.post('/subscriptions/checkout', { tier, provider: 'stripe' })
  const { mode, clientSecret, ephemeralKey, customerId } = data?.data ?? {}

  if (!clientSecret || !ephemeralKey || !customerId) {
    throw new Error('No se pudo iniciar el pago. Intenta de nuevo.')
  }

  // mode 'setup': trial de 5 días — solo se guarda la tarjeta, sin cobro inmediato.
  // mode 'payment': cobro inmediato (sin trial, ej. renovación).
  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: 'ZENCRUS',
    customerId,
    customerEphemeralKeySecret: ephemeralKey,
    ...(mode === 'setup' ? { setupIntentClientSecret: clientSecret } : { paymentIntentClientSecret: clientSecret }),
    allowsDelayedPaymentMethods: false,
    // El PaymentSheet nativo de Stripe exige colores en hex (#RRGGBB o #RRGGBBAA) —
    // rgba(...) causa "Failed to set Payment Sheet appearance" y bloquea el pago.
    // Paleta ZENCRUS: azul eléctrico + negro. Sin morados ni amarillos.
    appearance: {
      colors: {
        primary: '#FF5C00',
        background: '#0d0d10',
        componentBackground: '#17181c',
        componentBorder: '#FFFFFF1F', // rgba(255,255,255,0.12)
        componentDivider: '#FFFFFF14', // rgba(255,255,255,0.08)
        primaryText: '#f2f3f5',
        secondaryText: '#a1a3a9',
        componentText: '#f2f3f5',
        placeholderText: '#FFFFFF4D', // rgba(255,255,255,0.3)
        icon: '#FF5C00',
        error: '#FF7A1F',
      },
      shapes: {
        borderRadius: 14,
        borderWidth: 1,
      },
      primaryButton: {
        colors: {
          background: '#FF5C00',
          text: '#ffffff',
        },
      },
    },
  })

  if (initError) throw new Error(initError.message)

  const { error } = await presentPaymentSheet()
  if (error) {
    // Cerrar la hoja no es un fallo, pero tampoco es un pago.
    if (error.code === 'Canceled') return false
    throw new Error(error.message)
  }
  return true
}

export async function getCurrentSubscription() {
  const { data } = await api.get('/subscriptions/current')
  return data?.data ?? null
}

export async function cancelSubscription(): Promise<void> {
  await api.post('/subscriptions/cancel')
}
