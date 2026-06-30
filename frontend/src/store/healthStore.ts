import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface DailyCheckIn {
  date: string          // YYYY-MM-DD
  sleep: number         // 1-10
  energy: number        // 1-10
  mood: number          // 1-10
  stress: number        // 1-10 (10 = mucho estrés)
  intention: string     // compromiso del día
  completed: boolean
}

export interface HealthScore {
  date: string
  total: number         // 0-100
  nutrition: number     // 0-25
  workout: number       // 0-25
  hydration: number     // 0-20
  sleep: number         // 0-15
  mood: number          // 0-15
}

const defaultCheckIn = (date: string): DailyCheckIn => ({
  date, sleep: 7, energy: 7, mood: 7, stress: 3, intention: '', completed: false,
})

interface HealthState {
  todayCheckIn: DailyCheckIn
  checkInHistory: DailyCheckIn[]
  scoreHistory: HealthScore[]
  checkInDone: boolean

  loadToday: () => Promise<void>
  saveCheckIn: (data: Partial<DailyCheckIn>) => Promise<void>
  computeAndSaveScore: (params: {
    caloriesConsumed: number
    caloriesTarget: number
    waterGlasses: number
    waterTarget: number
    workedOut: boolean
  }) => Promise<HealthScore>
  getScoreForDate: (date: string) => HealthScore | undefined
  getWeekAvg: () => number
}

function todayKey() { return new Date().toISOString().slice(0, 10) }

export const useHealthStore = create<HealthState>((set, get) => ({
  todayCheckIn: defaultCheckIn(todayKey()),
  checkInHistory: [],
  scoreHistory: [],
  checkInDone: false,

  loadToday: async () => {
    const date = todayKey()
    try {
      const [ciRaw, shRaw, chRaw] = await Promise.all([
        AsyncStorage.getItem(`checkin_${date}`),
        AsyncStorage.getItem('score_history'),
        AsyncStorage.getItem('checkin_history'),
      ])
      set({
        todayCheckIn: ciRaw ? JSON.parse(ciRaw) : defaultCheckIn(date),
        checkInDone: ciRaw ? JSON.parse(ciRaw).completed : false,
        scoreHistory: shRaw ? JSON.parse(shRaw) : [],
        checkInHistory: chRaw ? JSON.parse(chRaw) : [],
      })
    } catch {
      set({ todayCheckIn: defaultCheckIn(date), checkInDone: false })
    }
  },

  saveCheckIn: async (data) => {
    const date = todayKey()
    const current = get().todayCheckIn
    const updated = { ...current, ...data, date, completed: true }
    set({ todayCheckIn: updated, checkInDone: true })

    const history = get().checkInHistory.filter(c => c.date !== date)
    const newHistory = [...history, updated].slice(-90)
    set({ checkInHistory: newHistory })

    await Promise.all([
      AsyncStorage.setItem(`checkin_${date}`, JSON.stringify(updated)),
      AsyncStorage.setItem('checkin_history', JSON.stringify(newHistory)),
    ])
  },

  computeAndSaveScore: async ({ caloriesConsumed, caloriesTarget, waterGlasses, waterTarget, workedOut }) => {
    const date = todayKey()
    const { todayCheckIn } = get()

    // Nutrición: 0-25 pts (basado en % de objetivo cumplido, penaliza exceso)
    const calPct = caloriesTarget > 0 ? caloriesConsumed / caloriesTarget : 0
    const nutritionScore = Math.round(
      calPct >= 0.85 && calPct <= 1.15 ? 25 :
      calPct >= 0.70 && calPct <= 1.30 ? 18 :
      calPct >= 0.50 ? 10 : 5
    )

    // Hidratación: 0-20 pts
    const hydrationScore = Math.round(Math.min((waterGlasses / Math.max(waterTarget, 8)) * 20, 20))

    // Entrenamiento: 0-25 pts
    const workoutScore = workedOut ? 25 : 0

    // Sueño: 0-15 pts
    const sleepScore = Math.round(Math.min((todayCheckIn.sleep / 10) * 15, 15))

    // Bienestar (mood - stress): 0-15 pts
    const wellnessRaw = (todayCheckIn.mood + (10 - todayCheckIn.stress)) / 2
    const moodScore = Math.round((wellnessRaw / 10) * 15)

    const total = nutritionScore + workoutScore + hydrationScore + sleepScore + moodScore

    const score: HealthScore = {
      date, total,
      nutrition: nutritionScore,
      workout: workoutScore,
      hydration: hydrationScore,
      sleep: sleepScore,
      mood: moodScore,
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
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i)
      return d.toISOString().slice(0, 10)
    })
    const weekScores = scores.filter(s => week.includes(s.date))
    if (!weekScores.length) return 0
    return Math.round(weekScores.reduce((a, s) => a + s.total, 0) / weekScores.length)
  },
}))
