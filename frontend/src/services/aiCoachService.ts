import AsyncStorage from '@react-native-async-storage/async-storage'
import api from './api'

export interface CoachContext {
  totalCalories: number
  caloriesTarget: number
  totalProtein: number
  proteinTarget: number
  waterGlasses: number
  currentStreak: number
  healthScore: number
  workedOut: boolean
  checkInDone: boolean
  mood?: number
  sleep?: number
  intention?: string
}

export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const SESSION_KEY = 'coach_session_id'

async function getOrCreateSession(): Promise<string> {
  const cached = await AsyncStorage.getItem(SESSION_KEY)
  if (cached) return cached

  const title = `Coach ${new Date().toLocaleDateString('es-MX')}`
  const { data } = await api.post('/chat/sessions', { title })
  const sessionId: string = data?.data?.session?.id
  if (!sessionId) throw new Error('No se pudo crear la sesión de chat')
  await AsyncStorage.setItem(SESSION_KEY, sessionId)
  return sessionId
}

export async function resetSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY)
}

/**
 * Cuánto se espera a ZENA.
 *
 * Los 15 s del resto de la app se le quedan cortos y eso rompía el chat de la
 * peor manera posible: el servidor terminaba —a veces en 15,4 s— guardaba la
 * respuesta, y el móvil ya se había rendido. El usuario veía «Ocurrió un
 * error» mientras la contestación estaba escrita en la base de datos.
 *
 * Con herramientas es peor: cada ronda es otra llamada al modelo, y pedirle que
 * busque un alimento y lo apunte son dos como mínimo.
 *
 * El número no es al azar: el servidor corta su bucle a los 55 s, así que aquí
 * se espera un poco más. Al revés —cliente por debajo del servidor— es
 * precisamente lo que producía el error fantasma.
 */
const ESPERA_CHAT_MS = 70_000

/** La fecha del usuario, para que el día en que ZENA apunte sea el suyo. */
const cabeceraFecha = () => ({
  'X-Zona-Fecha': new Date().toLocaleDateString('en-CA'),
})

export async function sendMessage(
  message: string,
  history: CoachMessage[],
  context: CoachContext
): Promise<string> {
  const sessionId = await getOrCreateSession()

  try {
    const { data } = await api.post(`/chat/sessions/${sessionId}/messages`, {
      content: message,
      context,
      history: history.slice(-10),
    }, { timeout: ESPERA_CHAT_MS, headers: cabeceraFecha() })
    const aiMessage = data?.data?.aiMessage
    return aiMessage?.content ?? 'No pude generar una respuesta. Intenta de nuevo.'
  } catch (err: any) {
    if (err?.response?.status === 404) {
      await AsyncStorage.removeItem(SESSION_KEY)
      const newSessionId = await getOrCreateSession()
      const { data } = await api.post(`/chat/sessions/${newSessionId}/messages`, {
        content: message,
      }, { timeout: ESPERA_CHAT_MS, headers: cabeceraFecha() })
      return data?.data?.aiMessage?.content ?? 'No pude generar una respuesta. Intenta de nuevo.'
    }
    throw err
  }
}

export function createMessage(role: 'user' | 'assistant', content: string): CoachMessage {
  return { id: Date.now().toString() + Math.random(), role, content, timestamp: Date.now() }
}
