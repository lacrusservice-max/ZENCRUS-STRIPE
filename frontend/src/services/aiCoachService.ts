import AsyncStorage from '@react-native-async-storage/async-storage'
import api from './api'
import type { Confirmacion } from './confirmacionesService'

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
  /**
   * Lo que ZENA propuso en este mensaje y aún no está aplicado (§10).
   *
   * Va colgado del mensaje y no en una lista aparte porque la tarjeta tiene
   * que salir DEBAJO de lo que ZENA acaba de decir. Separadas, el texto
   * («te bajo 150 kcal, ¿lo confirmas?») y el botón acaban a distinta altura
   * en cuanto la conversación sigue.
   */
  confirmaciones?: Confirmacion[]
}

/** Lo que contesta el servidor a un mensaje: el texto y lo que haya propuesto. */
export interface RespuestaCoach {
  texto: string
  confirmaciones: Confirmacion[]
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
): Promise<RespuestaCoach> {
  const sessionId = await getOrCreateSession()

  try {
    const { data } = await api.post(`/chat/sessions/${sessionId}/messages`, {
      content: message,
      context,
      history: history.slice(-10),
    }, { timeout: ESPERA_CHAT_MS, headers: cabeceraFecha() })
    return leerRespuesta(data)
  } catch (err: any) {
    if (err?.response?.status === 404) {
      await AsyncStorage.removeItem(SESSION_KEY)
      const newSessionId = await getOrCreateSession()
      const { data } = await api.post(`/chat/sessions/${newSessionId}/messages`, {
        content: message,
      }, { timeout: ESPERA_CHAT_MS, headers: cabeceraFecha() })
      return leerRespuesta(data)
    }
    throw err
  }
}

function leerRespuesta(data: any): RespuestaCoach {
  return {
    texto: data?.data?.aiMessage?.content ?? 'No pude generar una respuesta. Intenta de nuevo.',
    confirmaciones: data?.data?.confirmaciones ?? [],
  }
}

export function createMessage(
  role: 'user' | 'assistant',
  content: string,
  confirmaciones?: Confirmacion[],
): CoachMessage {
  return { id: Date.now().toString() + Math.random(), role, content, timestamp: Date.now(), confirmaciones }
}
