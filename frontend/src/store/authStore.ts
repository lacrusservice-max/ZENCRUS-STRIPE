import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import api from '../services/api'

export interface User {
  id: string
  email: string
  full_name: string
  role: string
  subscription_tier: string
  email_verified: boolean
  profile_completed: boolean
  weight?: number
  height?: number
  age?: number
  gender?: string
  activity_level?: string
  fitness_goals?: string[]
  dietary_restrictions?: string[]
  goals?: {
    main_goal?: string
    target_weight?: number
    calories_target?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
    fiber_g?: number
    meals_per_day?: number
    tdee?: number
    bmr?: number
  }
}

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  needsVerification: boolean
  pendingEmail: string | null

  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  verifyEmail: (email: string, code: string) => Promise<void>
  resendVerification: (email: string) => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (token: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

const SECURE_OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  needsVerification: false,
  pendingEmail: null,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken')
      if (!token) {
        set({ isLoading: false, isAuthenticated: false })
        return
      }
      // Validate token by fetching profile
      const { data } = await api.get('/users/profile')
      set({ user: data.data, accessToken: token, isAuthenticated: true, isLoading: false })
    } catch {
      await SecureStore.deleteItemAsync('accessToken').catch(() => {})
      await SecureStore.deleteItemAsync('refreshToken').catch(() => {})
      set({ isLoading: false, isAuthenticated: false, user: null, accessToken: null })
    }
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    const { accessToken, refreshToken } = data.data
    await SecureStore.setItemAsync('accessToken', accessToken, SECURE_OPTS)
    await SecureStore.setItemAsync('refreshToken', refreshToken, SECURE_OPTS)
    // Fetch profile
    const profileRes = await api.get('/users/profile')
    set({ user: profileRes.data.data, accessToken, isAuthenticated: true })
  },

  register: async (email, password, fullName) => {
    await api.post('/auth/register', { email, password, fullName })
    set({ needsVerification: true, pendingEmail: email })
  },

  verifyEmail: async (email, code) => {
    const { data } = await api.post('/auth/verify-email', { email, code })
    const { accessToken, refreshToken } = data.data
    await SecureStore.setItemAsync('accessToken', accessToken, SECURE_OPTS)
    await SecureStore.setItemAsync('refreshToken', refreshToken, SECURE_OPTS)
    const profileRes = await api.get('/users/profile')
    set({
      user: profileRes.data.data,
      accessToken,
      isAuthenticated: true,
      needsVerification: false,
      pendingEmail: null,
    })
  },

  resendVerification: async (email) => {
    await api.post('/auth/resend-verification', { email })
  },

  forgotPassword: async (email) => {
    await api.post('/auth/forgot-password', { email })
  },

  resetPassword: async (token, password) => {
    await api.post('/auth/reset-password', { token, password })
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {}
    await SecureStore.deleteItemAsync('accessToken').catch(() => {})
    await SecureStore.deleteItemAsync('refreshToken').catch(() => {})
    set({ user: null, accessToken: null, isAuthenticated: false })
  },

  setUser: (user) => set({ user }),
}))
