import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type PremiumPlan = 'free' | 'monthly' | 'yearly'

export interface PremiumFeatures {
  aiCoachUnlimited: boolean      // Free: 5 msgs/día | Premium: ilimitado
  barcodeScanner: boolean        // Free: 5 scans/día | Premium: ilimitado
  advancedReports: boolean       // Free: resumen básico | Premium: PDF + histórico
  premiumChallenges: boolean     // Free: 4 challenges | Premium: todos
  mealPlanner: boolean           // Free: ver | Premium: guardar semana completa
  communityRankings: boolean     // Free: top 10 | Premium: leaderboard completo
  progressPhotos: boolean        // Free: 3 fotos | Premium: ilimitado
}

const FREE_FEATURES: PremiumFeatures = {
  aiCoachUnlimited: false,
  barcodeScanner: false,
  advancedReports: false,
  premiumChallenges: false,
  mealPlanner: false,
  communityRankings: false,
  progressPhotos: false,
}

const PREMIUM_FEATURES: PremiumFeatures = {
  aiCoachUnlimited: true,
  barcodeScanner: true,
  advancedReports: true,
  premiumChallenges: true,
  mealPlanner: true,
  communityRankings: true,
  progressPhotos: true,
}

export const PRICING = {
  monthly: { price: 99, currency: 'MXN', label: 'Mensual', savings: null },
  yearly:  { price: 799, currency: 'MXN', label: 'Anual', savings: '33% de descuento' },
} as const

interface PremiumState {
  plan: PremiumPlan
  features: PremiumFeatures
  expiresAt: string | null          // ISO date
  aiMessagesToday: number
  barcodeScanToday: number
  photoCount: number
  lastResetDate: string

  load: () => Promise<void>
  setPremium: (plan: PremiumPlan, expiresAt: string) => Promise<void>
  setFree: () => Promise<void>
  isPremium: () => boolean
  canUseAI: () => boolean
  canScanBarcode: () => boolean
  canAddPhoto: () => boolean
  incrementAI: () => Promise<void>
  incrementScan: () => Promise<void>
  incrementPhoto: () => Promise<void>
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

export const usePremiumStore = create<PremiumState>((set, get) => ({
  plan: 'free',
  features: FREE_FEATURES,
  expiresAt: null,
  aiMessagesToday: 0,
  barcodeScanToday: 0,
  photoCount: 0,
  lastResetDate: todayStr(),

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem('premium_state')
      if (!raw) return
      const saved = JSON.parse(raw)
      // Reset daily counters if new day
      const today = todayStr()
      if (saved.lastResetDate !== today) {
        saved.aiMessagesToday = 0
        saved.barcodeScanToday = 0
        saved.lastResetDate = today
      }
      // Check expiry
      if (saved.expiresAt && saved.expiresAt < today) {
        saved.plan = 'free'
        saved.features = FREE_FEATURES
        saved.expiresAt = null
      }
      set({ ...saved, features: saved.plan !== 'free' ? PREMIUM_FEATURES : FREE_FEATURES })
    } catch {}
  },

  setPremium: async (plan, expiresAt) => {
    const update = { plan, features: PREMIUM_FEATURES, expiresAt, lastResetDate: todayStr() }
    set(update)
    await AsyncStorage.setItem('premium_state', JSON.stringify({ ...get(), ...update }))
  },

  setFree: async () => {
    const update = { plan: 'free' as PremiumPlan, features: FREE_FEATURES, expiresAt: null }
    set(update)
    await AsyncStorage.setItem('premium_state', JSON.stringify({ ...get(), ...update }))
  },

  isPremium: () => get().plan !== 'free',

  canUseAI: () => {
    if (get().isPremium()) return true
    return get().aiMessagesToday < 5
  },

  canScanBarcode: () => {
    if (get().isPremium()) return true
    return get().barcodeScanToday < 5
  },

  canAddPhoto: () => {
    if (get().isPremium()) return true
    return get().photoCount < 3
  },

  incrementAI: async () => {
    const n = get().aiMessagesToday + 1
    set({ aiMessagesToday: n })
    await AsyncStorage.setItem('premium_state', JSON.stringify({ ...get(), aiMessagesToday: n }))
  },

  incrementScan: async () => {
    const n = get().barcodeScanToday + 1
    set({ barcodeScanToday: n })
    await AsyncStorage.setItem('premium_state', JSON.stringify({ ...get(), barcodeScanToday: n }))
  },

  incrementPhoto: async () => {
    const n = get().photoCount + 1
    set({ photoCount: n })
    await AsyncStorage.setItem('premium_state', JSON.stringify({ ...get(), photoCount: n }))
  },
}))
