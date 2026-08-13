import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import api, { alCaducarLaSesion } from '../services/api'
import { useSocialStore } from './socialStore'
import { unregisterPush } from '../services/pushService'

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
    /**
     * Piso calórico del día. Comer por debajo frena el progreso tanto como
     * pasarse, así que la pantalla de Nutrición lo señala igual que el exceso.
     * Sin valor guardado se deriva del objetivo (85 %).
     */
    calories_min?: number
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
  pendingProfileData: Record<string, unknown> | null

  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string, username?: string, profileData?: Record<string, unknown>) => Promise<void>
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
  pendingProfileData: null,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken')
      if (!token) {
        set({ isLoading: false, isAuthenticated: false })
        return
      }
      // Se valida pidiendo el perfil. Si el token de acceso ha caducado, el
      // interceptor lo refresca solo y esto ni se entera.
      const { data } = await api.get('/users/profile')
      set({ user: data.data, accessToken: token, isAuthenticated: true, isLoading: false })
    } catch (e) {
      /**
       * Solo se cierra la sesión si el servidor RECHAZÓ las credenciales.
       *
       * Antes se borraban ante cualquier fallo, red incluida. Eso significaba
       * que abrir la app sin cobertura —en un gimnasio en un sótano, que es el
       * caso de uso central— te echaba y te obligaba a escribir la contraseña,
       * aunque tu sesión siguiera siendo válida treinta días más.
       *
       * Si el fallo es de red se conserva TODO y se deja la sesión como estaba:
       * la app sigue abierta con lo que tenga en memoria y el siguiente intento
       * la recupera. Perder la sesión es una decisión del servidor, no un
       * efecto secundario de una mala conexión.
       */
      const st = (e as { response?: { status?: number } })?.response?.status
      const rechazado = st === 401 || st === 403

      if (rechazado) {
        await SecureStore.deleteItemAsync('accessToken').catch(() => {})
        await SecureStore.deleteItemAsync('refreshToken').catch(() => {})
        set({ isLoading: false, isAuthenticated: false, user: null, accessToken: null })
        return
      }

      /**
       * Sin token de REFRESCO no se entra, aunque el fallo haya sido de red.
       *
       * El de acceso dura quince minutos: si el de refresco no está, esa sesión
       * está muerta y dejar entrar solo consigue una app que parece funcionar y
       * no carga nada. Se comprueban los dos, no solo el de acceso.
       */
      const [acceso, refresco] = await Promise.all([
        SecureStore.getItemAsync('accessToken').catch(() => null),
        SecureStore.getItemAsync('refreshToken').catch(() => null),
      ])

      if (!refresco) {
        await SecureStore.deleteItemAsync('accessToken').catch(() => {})
        set({ isLoading: false, isAuthenticated: false, user: null, accessToken: null })
        return
      }

      console.warn('[auth] arranque sin red: la sesión se conserva', (e as Error)?.message)
      set({
        isLoading: false,
        // Con las dos credenciales se entra igual: sin conexión la app funciona
        // con lo que tiene en el teléfono y sincroniza cuando vuelva la red.
        isAuthenticated: !!acceso,
        accessToken: acceso,
      })
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

  register: async (email, password, fullName, username?, profileData?) => {
    await api.post('/auth/register', { email, password, fullName, username, profileData })
    set({ needsVerification: true, pendingEmail: email, pendingProfileData: profileData ?? null })
  },

  verifyEmail: async (email, code) => {
    const { data } = await api.post('/auth/verify-email', { email, code })
    const { accessToken, refreshToken } = data.data
    await SecureStore.setItemAsync('accessToken', accessToken, SECURE_OPTS)
    await SecureStore.setItemAsync('refreshToken', refreshToken, SECURE_OPTS)
    const profileRes = await api.get('/users/profile')
    const pendingProfile = get().pendingProfileData
    set({
      user: profileRes.data.data,
      accessToken,
      isAuthenticated: true,
      needsVerification: false,
      pendingEmail: null,
      pendingProfileData: null,
    })
    // Auto-save profile data if collected during onboarding
    if (pendingProfile) {
      try {
        await api.post('/users/me/onboarding', pendingProfile)
      } catch {}
    }
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
    // Antes de soltar la sesión, porque hace falta el token para borrarlo: si
    // no, este teléfono seguiría recibiendo los avisos —y los nombres— de quien
    // acaba de salir.
    await unregisterPush()
    try {
      await api.post('/auth/logout')
    } catch {}
    await SecureStore.deleteItemAsync('accessToken').catch(() => {})
    await SecureStore.deleteItemAsync('refreshToken').catch(() => {})

    // La comunidad vive en memoria y hay que vaciarla a mano. Sin esto, quien
    // entrara después en el mismo teléfono vería un instante el muro, los chats
    // y los avisos de la persona anterior mientras cargan los suyos.
    useSocialStore.getState().reset()

    set({ user: null, accessToken: null, isAuthenticated: false })
  },

  setUser: (user) => set({ user }),
}))

/**
 * Cuando el servidor rechaza definitivamente las credenciales, la app tiene que
 * ENTERARSE, no solo quedarse sin poder cargar nada.
 *
 * Va aquí —al cargarse el módulo, no dentro de `initialize()`— a propósito: si
 * se registrara en `initialize`, una app que arranca sin conexión no llegaría a
 * registrarlo nunca y el limbo volvería justo en el caso que se quiere evitar.
 *
 * No cierra sesión ni borra nada: de eso ya se encargó el interceptor. Aquí
 * solo se pone el estado al día para que la app lleve al login en vez de seguir
 * pintando pantallas privadas que ya no puede cargar.
 */
alCaducarLaSesion(() => {
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    isLoading: false,
  })
})
