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

// ── Aviso de sesión caducada ─────────────────────────────────────────────────

/**
 * A quién avisar cuando el servidor rechaza definitivamente las credenciales.
 *
 * Es un callback y no un `import` del store porque el store ya importa esto:
 * importarlo de vuelta sería un ciclo. Lo registra `authStore` al arrancar.
 *
 * ── Por qué hace falta ──────────────────────────────────────────────────────
 * Sin este aviso, perder la sesión a mitad de uso dejaba la app en un LIMBO:
 * `initialize()` solo corre al arrancar, así que nadie se enteraba de que ya no
 * había credenciales. La app seguía enseñando las pantallas privadas —parecías
 * estar dentro— pero cada petición fallaba en silencio y todo salía vacío o
 * «sin conexión», sin llevarte nunca al login. Es el peor fallo posible: no
 * parece un fallo de sesión, parece que la app está rota.
 */
type AvisoSesion = () => void
let avisarSesionCaducada: AvisoSesion | null = null

export function alCaducarLaSesion(cb: AvisoSesion): void {
  avisarSesionCaducada = cb
}

// ── Response interceptor — refresh tokens + circuit breaker ──────────────────

let isRefreshing = false
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (r: unknown) => void }> = []

/**
 * QUÉ SESIÓN ES LA BUENA AHORA MISMO.
 *
 * Sube cada vez que se entra o se sale. Sirve para una cosa concreta: que un
 * refresco lanzado ANTES de un login no escriba su resultado DESPUÉS.
 *
 * Ese es el escenario que dejaba a la app con un token de otra vida. Una
 * petición cualquiera recibe un 401, el interceptor arranca a refrescar, y
 * mientras tanto el usuario entra con su contraseña —lo que guarda tokens
 * nuevos y buenos—. El refresco viejo termina uno o dos segundos después, y
 * como no sabía nada del login, machaca el token bueno con el suyo, que ya no
 * vale. A partir de ahí cada refresco llega con una familia que el servidor no
 * reconoce, y antes eso además te cerraba la sesión.
 *
 * Con el contador, quien termina tarde compara y se calla.
 */
let generacionSesion = 0

/** La llama el store al entrar y al salir. */
export function nuevaGeneracionDeSesion(): void {
  generacionSesion += 1
}

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

    /**
     * `error.config` FALTA cuando el error no nació de una peticion.
     *
     * Los dos rechazos del interceptor de arriba -sin cobertura y circuito
     * abierto- son `Error` planos: nunca llegaron a tener config. Sin esta
     * guarda, la linea del `url` de abajo reventaba con «Cannot read property
     * 'url' of undefined», y ese TypeError SUSTITUIA al error de verdad. Tres
     * consecuencias, todas vistas en el log de arranque:
     *
     *   - la pantalla ensenaba esa jerga en vez de «Sin conexion a internet»;
     *   - se perdian las banderas `isOffline` / `isCircuitOpen`, asi que quien
     *     las comprueba dejaba de distinguir un caso del otro;
     *   - y el arranque de sesion lo tomaba por un fallo de red cualquiera,
     *     que es como se llegaba a la app abierta y sin datos.
     */
    const originalRequest = (error.config ?? {}) as AxiosRequestConfig & { _retry?: boolean }

    /**
     * El circuito mide si el SERVIDOR esta caido. No todo fallo dice eso.
     *
     * Que este movil se quede sin cobertura no significa que el servidor este
     * mal, y un rechazo del circuito ya abierto no es informacion nueva: es su
     * propio eco. Contarlos hacia que SE MANTUVIERA ABIERTO SOLO -cada
     * pantalla que intentaba cargar sumaba un fallo mas y volvia a empujar los
     * treinta segundos hacia adelante-, asi que el corte no se acababa
     * mientras la app siguiera abierta. Justo lo contrario de lo que hace
     * falta: cortar un rato y volver a probar.
     */
    const propio = error as { isOffline?: boolean; isCircuitOpen?: boolean }
    const loDiceElServidor = !propio.isOffline && !propio.isCircuitOpen
    if (loDiceElServidor && (!status || status >= 500)) {
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

      // Se anota con qué sesión se empezó. Si al volver ya es otra, este
      // refresco es de una vida anterior y no puede tocar nada: ni escribir su
      // token, ni —sobre todo— borrar los de la sesión nueva. Va FUERA del
      // `try` porque el `catch` lo necesita tanto como el camino feliz.
      const generacionAlEmpezar = generacionSesion

      // Fuera del `try` por lo mismo que el contador: el `catch` necesita saber
      // QUÉ token se mandó para decidir si el 401 era de este o de uno ya caduco.
      let tokenEnviado: string | null = null

      try {
        tokenEnviado = await SecureStore.getItemAsync('refreshToken')
        const refreshToken = tokenEnviado
        if (!refreshToken) throw new Error('No refresh token')

        const SECURE_OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: 10_000 })
        const { accessToken, refreshToken: newRT } = data.data

        if (generacionAlEmpezar !== generacionSesion) {
          /**
           * Hubo un login (o un logout) mientras esto viajaba.
           *
           * Lo que hay guardado ahora es más nuevo que esto, así que NO se
           * escribe: machacar el token bueno con este dejaría a la app con uno
           * que el servidor ya no reconoce. Se avisa a la cola con el token que
           * de verdad vale y se deja como está.
           */
          console.warn('[auth] refresco de una sesión anterior: se descarta sin escribir')
          const vigente = await SecureStore.getItemAsync('accessToken').catch(() => null)
          processQueue(null, vigente)
          originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${vigente ?? ''}` }
          return api(originalRequest)
        }

        await SecureStore.setItemAsync('accessToken', accessToken, SECURE_OPTS)
        await SecureStore.setItemAsync('refreshToken', newRT, SECURE_OPTS)

        processQueue(null, accessToken)
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${accessToken}` }
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)

        /**
         * SI HUBO UN LOGIN MIENTRAS ESTO VIAJABA, EL 401 NO ES DE NADIE.
         *
         * Es el segundo tiempo del mismo problema, y costó verlo porque la
         * primera mitad ya estaba puesta. El contador impedía que un refresco
         * tardío ESCRIBIERA su token viejo —bien— pero ese refresco seguía
         * saliendo con el token de antes, el servidor lo rechazaba con un 401
         * perfectamente legítimo, y el borrado de aquí abajo se llevaba las
         * credenciales... que para entonces ya eran las NUEVAS, las del login
         * que acababa de ocurrir.
         *
         * O sea: entrabas con tu contraseña y un segundo después la app te
         * echaba con un 401 de una sesión que ya no existía. En el registro del
         * servidor se veía clavado:
         *
         *     19:38:38  login                      → 200
         *     19:39:04  POST /auth/refresh → 401 · familia desconocida
         *
         * Un 401 solo significa «esta sesión se acabó» si es de LA SESIÓN
         * ACTUAL. Si la generación cambió, este error es de un muerto.
         */
        if (generacionAlEmpezar !== generacionSesion) {
          console.warn('[auth] 401 de un refresco anterior al login: se ignora, la sesión nueva sigue')
          return Promise.reject(refreshError)
        }

        /**
         * Las credenciales SOLO se borran si el servidor las ha rechazado.
         *
         * Antes se borraban ante cualquier fallo, y eso incluía quedarse sin
         * cobertura un segundo, un backend lento —el `timeout` son 10 s— o un
         * despliegue a mitad de petición. Como el token de refresco es de un
         * solo uso y no hay copia, perderlo así deja la app en un limbo del que
         * no se sale: sigue enseñando las pantallas privadas porque
         * `initialize()` solo corre al arrancar, pero cada petición falla en
         * silencio y todo se ve vacío o «sin conexión».
         *
         * Un fallo de red es TEMPORAL y la sesión tiene que sobrevivirlo: la
         * siguiente petición volverá a intentarlo. Solo un 401 del propio
         * `/auth/refresh` significa de verdad «esta sesión ya no vale».
         */
        const st = (refreshError as AxiosError)?.response?.status
        /**
         * Sin token de refresco guardado no hay nada que reintentar NUNCA.
         *
         * Es distinto de un fallo de red: la red vuelve, pero un token que no
         * está no va a aparecer. Conservar la sesión en este caso deja la app
         * en el mismo limbo que se quería evitar —dentro, pero sin poder cargar
         * nada— y encima para siempre. Aquí la única salida honesta es pedir
         * que se vuelva a entrar.
         */
        const sinTokenGuardado = (refreshError as Error)?.message === 'No refresh token'
        const rechazadoPorElServidor = st === 401 || st === 403 || sinTokenGuardado

        /**
         * ¿EL 401 ES DEL TOKEN QUE HAY GUARDADO AHORA, O DE UNO YA CADUCO?
         *
         * Es la tercera capa del mismo problema, y la que faltaba. Las otras dos
         * cubren el login (el contador de generación) y los fallos de red. Esta
         * cubre la carrera entre dos refrescos.
         *
         * Al arrancar la app salen varias peticiones a la vez. Si el token de
         * acceso está caducado, TODAS fallan con 401 y todas quieren refrescar.
         * La cola de aquí arriba deja pasar una sola... pero `initialize()` corre
         * por su cuenta y puede colarse en paralelo. La primera rota el token y
         * guarda el nuevo; la segunda llega con el viejo, y el servidor lo
         * rechaza —con razón— como «familia desconocida».
         *
         * Y ahí estaba el daño: ese 401 borraba las credenciales, que para
         * entonces ya eran las BUENAS, las que la otra petición acababa de
         * guardar. Recargar la app te echaba, y por eso pasaba solo al recargar
         * y no mientras la usabas.
         *
         * El propio servidor lo dice en su registro: «un token viejo no prueba
         * nada y no puede costarle la sesión a nadie». Aquí se le hace caso: si
         * lo guardado ya no es lo que mandamos, otro lo rotó y esta sesión vive.
         */
        const guardadoAhora = await SecureStore.getItemAsync('refreshToken').catch(() => null)
        const eraElVigente = !guardadoAhora || guardadoAhora === tokenEnviado

        if (rechazadoPorElServidor && !eraElVigente) {
          console.warn('[auth] 401 de un token que otra petición ya rotó: la sesión sigue')
          return Promise.reject(refreshError)
        }

        if (rechazadoPorElServidor) {
          await SecureStore.deleteItemAsync('accessToken').catch(() => {})
          await SecureStore.deleteItemAsync('refreshToken').catch(() => {})
          // Y se avisa, para que la app vaya al login en vez de quedarse
          // enseñando pantallas privadas que ya no puede cargar.
          avisarSesionCaducada?.()
        } else {
          // Sin este aviso, el síntoma —pantallas vacías— parece un fallo de
          // los datos y se busca en el sitio equivocado. Costó media sesión.
          console.warn(
            '[auth] no se pudo refrescar la sesión, pero se CONSERVA para reintentar:',
            (refreshError as Error)?.message ?? refreshError,
          )
        }

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
