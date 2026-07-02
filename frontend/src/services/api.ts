import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'
import NetInfo from '@react-native-community/netinfo'

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:5000/api'

// ── Circuit Breaker ───────────────────────────────────────────────────────────

type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

class CircuitBreaker {
  private failures = 0
  private state: CBState = 'CLOSED'
  private nextAttempt = 0
  private readonly threshold = 5
  private readonly resetTimeout = 30_000

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN'
        return false
      }
      return true
    }
    return false
  }

  onSuccess(): void {
    this.failures = 0
    this.state = 'CLOSED'
  }

  onFailure(): void {
    this.failures++
    if (this.failures >= this.threshold) {
      this.state = 'OPEN'
      this.nextAttempt = Date.now() + this.resetTimeout
    }
  }

  getState(): CBState { return this.state }
}

const circuitBreaker = new CircuitBreaker()

// ── Exponential backoff retry ─────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err
      const status = err?.response?.status
      // No reintentar en 4xx (error del cliente)
      if (status && status >= 400 && status < 500) throw err
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}

// ── Axios instance ────────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor ───────────────────────────────────────────────────────

api.interceptors.request.use(
  async (config) => {
    // Verificar conectividad antes de cada request
    const net = await NetInfo.fetch()
    if (!net.isConnected) {
      return Promise.reject(Object.assign(new Error('Sin conexión a internet'), { isOffline: true }))
    }

    // Circuit breaker: si está OPEN, rechazar inmediatamente
    if (circuitBreaker.isOpen()) {
      return Promise.reject(
        Object.assign(new Error('Servicio temporalmente no disponible. Intenta en unos momentos.'), {
          isCircuitOpen: true,
        })
      )
    }

    const token = await SecureStore.getItemAsync('accessToken')
    if (token) config.headers.Authorization = `Bearer ${token}`

    const fingerprint = await SecureStore.getItemAsync('deviceFingerprint')
    if (fingerprint) config.headers['x-device-fingerprint'] = fingerprint

    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor — refresh tokens + circuit breaker ──────────────────

let isRefreshing = false
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (r: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)))
  failedQueue = []
}

api.interceptors.response.use(
  (response) => {
    circuitBreaker.onSuccess()
    return response
  },
  async (error: AxiosError) => {
    const status = error.response?.status
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    // Registrar falla en circuit breaker (solo en 5xx y errores de red)
    if (!status || status >= 500) {
      circuitBreaker.onFailure()
    }

    // Auto-refresh en 401 (nunca en endpoints de auth)
    const url = originalRequest.url ?? ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh')
    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` }
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken')
        if (!refreshToken) throw new Error('No refresh token')

        const SECURE_OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: 10_000 })
        const { accessToken, refreshToken: newRT } = data.data

        await SecureStore.setItemAsync('accessToken', accessToken, SECURE_OPTS)
        await SecureStore.setItemAsync('refreshToken', newRT, SECURE_OPTS)

        processQueue(null, accessToken)
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${accessToken}` }
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        await SecureStore.deleteItemAsync('accessToken').catch(() => {})
        await SecureStore.deleteItemAsync('refreshToken').catch(() => {})
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// ── API con retry automático para operaciones idempotentes ────────────────────

export const apiGet = <T>(url: string, config?: AxiosRequestConfig) =>
  withRetry(() => api.get<T>(url, config))

export const apiPost = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  api.post<T>(url, data, config)  // POST no se reintenta (no idempotente por defecto)

export const apiPut = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  withRetry(() => api.put<T>(url, data, config))

export const apiPatch = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  withRetry(() => api.patch<T>(url, data, config))

export const apiDelete = <T>(url: string, config?: AxiosRequestConfig) =>
  withRetry(() => api.delete<T>(url, config))

export { circuitBreaker }
export default api
