/**
 * EL MARCADOR DE SALUD DEL DÍA
 * ════════════════════════════
 * Cuánto de lo que te propusiste hoy ha pasado: comer, entrenar, beber, dormir
 * y cómo te sientes. No confundir con el score de RECUPERACIÓN, que responde a
 * otra pregunta —«¿está el cuerpo para entrenar?»— y vive en `recoveryStore`.
 *
 * ── Este archivo tenía su propio check-in, y de ahí salían datos inventados ──
 * Guardaba un `todayCheckIn` que, sin que nadie hubiera contestado nada, valía
 * `{ sleep: 7, energy: 7, mood: 7, stress: 3 }`. Esos valores no eran un hueco
 * a la espera de rellenarse: entraban tal cual en el cálculo del marcador y
 * regalaban ~25 de los 100 puntos a quien acababa de instalar la app. Es el
 * mismo pecado que el pulso de 65 que documenta `scoreRecuperacion`, y estaba
 * a dos pantallas de distancia.
 *
 * Y había un segundo check-in, el de Salud, preguntando la energía y el estrés
 * otra vez en otra escala. Ahora el check-in es UNO y vive en `recoveryStore`.
 * Aquí solo queda el marcador, que es lo que de verdad era propio.
 *
 * ── El marcador puede ser parcial, y lo dice ────────────────────────────────
 * Si no hay check-in ni registro de sueño, esos puntos no se dan por perdidos
 * ni se regalan: se sacan del cálculo, y el total se escala sobre lo que sí se
 * pudo medir. Sacar 70 de 70 posibles es un 100, no un 70. `medido` cuenta qué
 * piezas entraron para que la pantalla no presente como veredicto completo lo
 * que se calculó con la mitad de las señales.
 */

import { hoyLocal, haceDias } from '@/utils/fechas'
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRecoveryStore } from './recoveryStore'
import { useHealthTrackerStore } from './healthTrackerStore'

/**
 * El check-in que se guardaba aquí antes de la unión, en escala 1-10.
 *
 * No se migra a `recoveryStore` y no es un descuido. Convertir energía, ánimo y
 * estrés sería trivial, pero estas entradas no traen el dolor muscular que el
 * score de recuperación necesita, y su `sleep` era un 1-10 «qué tal dormiste»
 * sin horas ni calidad: convertirlo en un registro de sueño exigiría inventar a
 * qué hora se acostó alguien hace tres meses. Se conserva como archivo de solo
 * lectura —no se pierde nada— y el check-in nuevo escribe en `recoveryStore`.
 */
export interface DailyCheckIn {
  date: string
  sleep: number
  energy: number
  mood: number
  stress: number
  intention: string
  completed: boolean
}

export interface HealthScore {
  date: string
  /** 0-100, escalado sobre las piezas que sí se pudieron medir. */
  total: number
  nutrition: number     // 0-25
  workout: number       // 0-25
  hydration: number     // 0-20
  /** null = esa noche no se registró el sueño; no cuenta ni a favor ni en contra. */
  sleep: number | null  // 0-15
  /** null = hoy no hay check-in. */
  mood: number | null   // 0-15
  /** Qué piezas entraron en el total. */
  medido: { sueno: boolean; animo: boolean }
}

const SLEEP_QUALITY_PUNTOS: Record<string, number> = {
  poor: 3, fair: 8, good: 12, excellent: 15,
}

interface HealthState {
  /** Check-in anterior a la unión. Solo lectura: ya nadie escribe aquí. */
  checkInHistory: DailyCheckIn[]
  scoreHistory: HealthScore[]

  loadToday: () => Promise<void>
  computeAndSaveScore: (params: {
    caloriesConsumed: number
    caloriesTarget: number
    waterGlasses: number
    waterTarget: number
    workedOut: boolean
  }) => Promise<HealthScore>
  getScoreForDate: (date: string) => HealthScore | undefined
  /** null = no hay ni un marcador esta semana. Cero sería una nota, no un hueco. */
  getWeekAvg: () => number | null
}

function todayKey() { return hoyLocal() }

export const useHealthStore = create<HealthState>((set, get) => ({
  checkInHistory: [],
  scoreHistory: [],

  loadToday: async () => {
    try {
      const [shRaw, chRaw] = await Promise.all([
        AsyncStorage.getItem('score_history'),
        AsyncStorage.getItem('checkin_history'),
      ])
      set({
        scoreHistory: shRaw ? JSON.parse(shRaw) : [],
        checkInHistory: chRaw ? JSON.parse(chRaw) : [],
      })
    } catch {
      set({ scoreHistory: [], checkInHistory: [] })
    }
  },

  computeAndSaveScore: async ({ caloriesConsumed, caloriesTarget, waterGlasses, waterTarget, workedOut }) => {
    const date = todayKey()

    // Nutrición: 0-25 pts (basado en % de objetivo cumplido, penaliza exceso)
    const calPct = caloriesTarget > 0 ? caloriesConsumed / caloriesTarget : 0
    const nutrition = Math.round(
      calPct >= 0.85 && calPct <= 1.15 ? 25 :
      calPct >= 0.70 && calPct <= 1.30 ? 18 :
      calPct >= 0.50 ? 10 : 5
    )

    // Hidratación: 0-20 pts
    const hydration = Math.round(Math.min((waterGlasses / Math.max(waterTarget, 8)) * 20, 20))

    // Entrenamiento: 0-25 pts
    const workout = workedOut ? 25 : 0

    /* Sueño: 0-15 pts, de la calidad REALMENTE registrada esa noche. Antes salía
       de un «7 sobre 10» que nadie había escrito. */
    const calidad = useHealthTrackerStore.getState().getTodaySummary().sleepQuality
    const sleep = calidad ? SLEEP_QUALITY_PUNTOS[calidad] : null

    /* Bienestar: 0-15 pts, del check-in único. `stress` ya viene en «más alto =
       más relajado», así que no hay que invertirlo como en la versión vieja. */
    const checkIn = useRecoveryStore.getState().getToday()
    const mood = checkIn
      ? Math.round((((checkIn.mood ?? checkIn.energy) + checkIn.stress) / 2 / 5) * 15)
      : null

    /* El total se escala sobre lo medible. Sin esto, no registrar el sueño se
       castigaba igual que dormir fatal. */
    const obtenido = nutrition + hydration + workout + (sleep ?? 0) + (mood ?? 0)
    const posible = 25 + 20 + 25 + (sleep == null ? 0 : 15) + (mood == null ? 0 : 15)
    const total = posible > 0 ? Math.round((obtenido / posible) * 100) : 0

    const score: HealthScore = {
      date, total, nutrition, workout, hydration, sleep, mood,
      medido: { sueno: sleep != null, animo: mood != null },
    }

    const history = get().scoreHistory.filter(s => s.date !== date)
    const newHistory = [...history, score].slice(-90)
    set({ scoreHistory: newHistory })
    await AsyncStorage.setItem('score_history', JSON.stringify(newHistory))
    return score
  },

  getScoreForDate: (date) => get().scoreHistory.find(s => s.date === date),

  getWeekAvg: () => {
    const scores = get().scoreHistory
    const week = Array.from({ length: 7 }, (_, i) => haceDias(i))
    const weekScores = scores.filter(s => week.includes(s.date))
    if (!weekScores.length) return null
    return Math.round(weekScores.reduce((a, s) => a + s.total, 0) / weekScores.length)
  },
}))
