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
    })
    const aiMessage = data?.data?.aiMessage
    return aiMessage?.content ?? 'No pude generar una respuesta. Intenta de nuevo.'
  } catch (err: any) {
    if (err?.response?.status === 404) {
      await AsyncStorage.removeItem(SESSION_KEY)
      const newSessionId = await getOrCreateSession()
      const { data } = await api.post(`/chat/sessions/${newSessionId}/messages`, {
        content: message,
      })
      return data?.data?.aiMessage?.content ?? 'No pude generar una respuesta. Intenta de nuevo.'
    }
    throw err
  }
}

export function createMessage(role: 'user' | 'assistant', content: string): CoachMessage {
  return { id: Date.now().toString() + Math.random(), role, content, timestamp: Date.now() }
}
