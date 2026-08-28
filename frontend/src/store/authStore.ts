import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import api, { alCaducarLaSesion, nuevaGeneracionDeSesion } from '../services/api'
import { useSocialStore } from './socialStore'
import { unregisterPush } from '../services/pushService'
import { olvidarRecordatorios } from '../features/salud/recordatorios'
import { olvidarAvisos } from '../features/salud/ciclo/avisos'

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
  /**
   * Llave del módulo de ciclo menstrual.
   *
   * Preferencia propia y revocable, ofrecida en el registro a quien declara
   * género femenino u otro. Es una llave aparte de `gender` a propósito: ese
   * campo se pide para el cálculo metabólico, y usarlo también como permiso
   * acoplaría dos cosas que deben poder cambiar por separado.
   * Ver src/features/salud/acceso.ts
   */
  cycleEnabled?: boolean
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
    calories_max?: number
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
  refrescarPerfil: () => Promise<void>
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
      /**
       * MANDA EL TOKEN DE REFRESCO, NO EL DE ACCESO.
       *
       * Antes se leía solo el de acceso y, si no estaba, se iba al login sin
       * intentar nada más. Es la decisión al revés: el de acceso dura QUINCE
       * MINUTOS y el de refresco TREINTA DÍAS, así que estar sin el corto es lo
       * normal y no dice absolutamente nada sobre si la sesión sigue viva.
       *
       * El síntoma era desconcertante y costó encontrarlo porque parecía lo
       * contrario de lo que era: la app enseñaba la pantalla de entrar mientras
       * el token de refresco seguía guardado y ROTANDO contra el servidor —se
       * veía en la base, `updated_at` moviéndose cada pocos minutos con la
       * pantalla de login delante—. O sea, sesión perfectamente válida y una
       * app diciéndote que no habías entrado.
       *
       * Ahora, sin el de acceso pero con el de refresco, se pide uno nuevo y se
       * entra. Solo se va al login cuando NO hay token de refresco, que es la
       * única señal que de verdad significa «esta sesión se acabó».
       */
      const [acceso, refresco] = await Promise.all([
        SecureStore.getItemAsync('accessToken').catch(() => null),
        SecureStore.getItemAsync('refreshToken').catch(() => null),
      ])

      if (!refresco) {
        // Sin el largo no hay sesión que recuperar. Y se limpia el corto, que
        // solo, no sirve para nada y confundiría al siguiente arranque.
        if (acceso) await SecureStore.deleteItemAsync('accessToken').catch(() => {})
        set({ isLoading: false, isAuthenticated: false, user: null, accessToken: null })
        return
      }

      /**
       * Se valida pidiendo el perfil, y da igual que el de acceso falte o esté
       * caducado: el interceptor lo refresca solo y esto ni se entera. Por eso
       * la llamada va IGUAL aunque `acceso` sea null — es justamente el caso
       * que antes no se intentaba.
       */
      const { data } = await api.get('/users/profile')
      const vigente = await SecureStore.getItemAsync('accessToken').catch(() => acceso)
      set({ user: data.data, accessToken: vigente ?? acceso, isAuthenticated: true, isLoading: false })
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
        nuevaGeneracionDeSesion()
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
        /**
         * Con token de refresco se ENTRA, tenga o no el de acceso.
         *
         * Aquí estaba `!!acceso`, y era el mismo error que arriba: hacía
         * depender «¿estoy dentro?» del token que dura quince minutos en vez
         * del que dura treinta días. Quien abriera la app sin cobertura y con
         * el de acceso ya caducado veía la pantalla de entrar teniendo la
         * sesión intacta.
         *
         * Sin red la app funciona con lo que tiene en el teléfono y sincroniza
         * cuando vuelva; con red, el interceptor consigue un token nuevo en la
         * primera petición. En los dos casos, dentro.
         */
        isAuthenticated: true,
        accessToken: acceso,
      })
    }
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    const { accessToken, refreshToken } = data.data
    await SecureStore.setItemAsync('accessToken', accessToken, SECURE_OPTS)
    await SecureStore.setItemAsync('refreshToken', refreshToken, SECURE_OPTS)
    // Desde aquí, cualquier refresco que viniera de antes queda invalidado:
    // no puede machacar estos tokens, que son los buenos.
    nuevaGeneracionDeSesion()
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
    // Desde aquí, cualquier refresco que viniera de antes queda invalidado:
    // no puede machacar estos tokens, que son los buenos.
    nuevaGeneracionDeSesion()
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
    // Y los recordatorios de hábitos, por lo mismo: son avisos LOCALES, así que
    // sobrevivirían al cierre de sesión sonando con los hábitos de otra persona.
    await olvidarRecordatorios()
    /* Los del ciclo aparte: llevan otro prefijo, y son justo los que no
       pueden seguir sonando en el teléfono de quien ya cerró sesión. */
    await olvidarAvisos()
    try {
      await api.post('/auth/logout')
    } catch {}
    await SecureStore.deleteItemAsync('accessToken').catch(() => {})
    await SecureStore.deleteItemAsync('refreshToken').catch(() => {})
    nuevaGeneracionDeSesion()

    // La comunidad vive en memoria y hay que vaciarla a mano. Sin esto, quien
    // entrara después en el mismo teléfono vería un instante el muro, los chats
    // y los avisos de la persona anterior mientras cargan los suyos.
    useSocialStore.getState().reset()

    set({ user: null, accessToken: null, isAuthenticated: false })
  },

  setUser: (user) => set({ user }),

  /**
   * Vuelve a pedir el perfil y actualiza el store.
   *
   * Guardar desde una pantalla ya refresca el store con lo que devuelve el
   * servidor, así que lo inmediato está cubierto. Esto es para lo OTRO: las
   * metas también se cambian desde el chat —ZENA puede proponerlas y aplicarlas—
   * y desde el ajuste semanal. Sin esto, cambiabas tu meta hablando con ZENA y
   * Nutrición seguía enseñando la vieja hasta cerrar la app.
   *
   * Si falla, no toca nada. Es un refresco de cortesía: perder la conexión un
   * momento no puede vaciar el perfil que ya está en pantalla.
   */
  refrescarPerfil: async () => {
    try {
      const { data } = await api.get('/users/profile')
      if (data?.data) set({ user: data.data })
    } catch { /* lo que hay en pantalla sigue valiendo */ }
  },
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
