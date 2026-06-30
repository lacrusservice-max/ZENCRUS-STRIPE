// Payments Service — MercadoPago + RevenueCat
// TODO: conectar con MercadoPago y RevenueCat cuando se configuren las keys
// Por ahora toda la lógica de premium está en premiumStore (local)

export type PaymentPlan = 'monthly' | 'yearly'

export interface PaymentResult {
  success: boolean
  orderId?: string
  error?: string
}

// TODO: Reemplazar con tus keys reales
const MP_PUBLIC_KEY = 'TODO_MP_PUBLIC_KEY'
const REVENUECAT_KEY = 'TODO_REVENUECAT_KEY'

export const PLANS = {
  monthly: {
    id: 'zencrus_monthly',
    label: 'ZENCRUS Premium Mensual',
    price: 99,
    currency: 'MXN',
    mpProductId: 'TODO_MP_PRODUCT_ID_MONTHLY',
    revenueCatProductId: 'zencrus_premium_monthly',
    features: [
      'Coach IA ilimitado',
      'Scanner de alimentos sin límite',
      'Reportes avanzados y PDF',
      'Todos los desafíos premium',
      'Fotos de progreso ilimitadas',
      'Rankings completos de comunidad',
    ],
  },
  yearly: {
    id: 'zencrus_yearly',
    label: 'ZENCRUS Premium Anual',
    price: 799,
    currency: 'MXN',
    savings: '33% vs mensual',
    mpProductId: 'TODO_MP_PRODUCT_ID_YEARLY',
    revenueCatProductId: 'zencrus_premium_yearly',
    features: [
      'Todo lo del plan mensual',
      '2 meses gratis (ahorro de $200 MXN)',
      'Badge exclusivo de miembro anual',
      'Acceso a features beta',
    ],
  },
} as const

// ── MercadoPago ──────────────────────────────────────────────────────────────
// TODO: implementar cuando se configure la cuenta de MercadoPago

export async function createMercadoPagoPreference(plan: PaymentPlan, userEmail: string): Promise<string | null> {
  // TODO: llamar al backend para crear una preference:
  // const { data } = await api.post('/payments/mp/preference', { plan, email: userEmail })
  // return data.preferenceId
  console.log('[Payments] MP preference creation - TODO:', { plan, userEmail })
  return null
}

export async function verifyMercadoPagoPayment(paymentId: string): Promise<boolean> {
  // TODO: verificar en el backend con HMAC signature
  console.log('[Payments] MP payment verification - TODO:', paymentId)
  return false
}

// ── RevenueCat ───────────────────────────────────────────────────────────────
// TODO: implementar con react-native-purchases cuando se configure RevenueCat

export async function initRevenueCat(userId: string): Promise<void> {
  // TODO:
  // import Purchases from 'react-native-purchases'
  // Purchases.configure({ apiKey: REVENUECAT_KEY, appUserID: userId })
  console.log('[Payments] RevenueCat init - TODO:', userId)
}

export async function getOfferings(): Promise<any[]> {
  // TODO:
  // const offerings = await Purchases.getOfferings()
  // return offerings.current?.availablePackages ?? []
  return []
}

export async function purchasePackage(packageId: string): Promise<PaymentResult> {
  // TODO:
  // const { customerInfo } = await Purchases.purchasePackage(pkg)
  // const hasPremium = customerInfo.entitlements.active['premium'] !== undefined
  // return { success: hasPremium }
  console.log('[Payments] Purchase - TODO:', packageId)
  return { success: false, error: 'Pagos no configurados aún' }
}

export async function restorePurchases(): Promise<PaymentResult> {
  // TODO:
  // const { customerInfo } = await Purchases.restorePurchases()
  // const hasPremium = customerInfo.entitlements.active['premium'] !== undefined
  // return { success: hasPremium }
  return { success: false, error: 'Pagos no configurados aún' }
}

export async function checkPremiumStatus(): Promise<boolean> {
  // TODO:
  // const customerInfo = await Purchases.getCustomerInfo()
  // return customerInfo.entitlements.active['premium'] !== undefined
  return false
}
