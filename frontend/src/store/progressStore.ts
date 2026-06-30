import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface WeightEntry {
  id: string
  date: string       // YYYY-MM-DD
  weight: number     // kg
  note?: string
}

export interface Measurements {
  id: string
  date: string
  neck?: number
  chest?: number
  waist?: number
  hips?: number
  leftArm?: number
  rightArm?: number
  leftThigh?: number
  rightThigh?: number
  bodyFat?: number   // %
}

export interface Achievement {
  id: string
  title: string
  description: string
  emoji: string
  unlockedAt: number   // timestamp
  xp: number
}

interface ProgressState {
  weightHistory: WeightEntry[]
  measurementHistory: Measurements[]
  achievements: Achievement[]
  totalXP: number
  level: number

  load: () => Promise<void>
  addWeight: (weight: number, note?: string) => Promise<void>
  addMeasurements: (m: Omit<Measurements, 'id' | 'date'>) => Promise<void>
  unlockAchievement: (a: Omit<Achievement, 'unlockedAt'>) => Promise<void>
  getLatestWeight: () => WeightEntry | undefined
  getWeightChange: () => number   // kg desde primera entrada
  getLevelInfo: () => { level: number; title: string; nextLevelXP: number; currentLevelXP: number }
}

const LEVEL_TITLES = [
  'Principiante', 'Comprometido', 'Constante', 'Disciplinado',
  'Enfocado', 'Atleta', 'Guerrero', 'Élite', 'Leyenda',
]

const XP_PER_LEVEL = 500

function computeLevel(xp: number): number {
  return Math.min(Math.floor(xp / XP_PER_LEVEL), LEVEL_TITLES.length - 1)
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  weightHistory: [],
  measurementHistory: [],
  achievements: [],
  totalXP: 0,
  level: 0,

  load: async () => {
    try {
      const [wRaw, mRaw, aRaw, xpRaw] = await Promise.all([
        AsyncStorage.getItem('weight_history'),
        AsyncStorage.getItem('measurement_history'),
        AsyncStorage.getItem('achievements'),
        AsyncStorage.getItem('total_xp'),
      ])
      const xp = xpRaw ? parseInt(xpRaw) : 0
      set({
        weightHistory: wRaw ? JSON.parse(wRaw) : [],
        measurementHistory: mRaw ? JSON.parse(mRaw) : [],
        achievements: aRaw ? JSON.parse(aRaw) : [],
        totalXP: xp,
        level: computeLevel(xp),
      })
    } catch {}
  },

  addWeight: async (weight, note) => {
    const entry: WeightEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10),
      weight, note,
    }
    const history = [...get().weightHistory, entry].sort((a, b) => a.date.localeCompare(b.date))
    set({ weightHistory: history })
    await AsyncStorage.setItem('weight_history', JSON.stringify(history))

    // XP por registrar peso
    const newXP = get().totalXP + 10
    set({ totalXP: newXP, level: computeLevel(newXP) })
    await AsyncStorage.setItem('total_xp', String(newXP))
  },

  addMeasurements: async (m) => {
    const entry: Measurements = {
      ...m, id: Date.now().toString(), date: new Date().toISOString().slice(0, 10),
    }
    const history = [...get().measurementHistory, entry]
    set({ measurementHistory: history })
    await AsyncStorage.setItem('measurement_history', JSON.stringify(history))

    const newXP = get().totalXP + 20
    set({ totalXP: newXP, level: computeLevel(newXP) })
    await AsyncStorage.setItem('total_xp', String(newXP))
  },

  unlockAchievement: async (a) => {
    const already = get().achievements.find(x => x.id === a.id)
    if (already) return
    const achievement: Achievement = { ...a, unlockedAt: Date.now() }
    const achievements = [...get().achievements, achievement]
    set({ achievements })
    await AsyncStorage.setItem('achievements', JSON.stringify(achievements))

    const newXP = get().totalXP + a.xp
    set({ totalXP: newXP, level: computeLevel(newXP) })
    await AsyncStorage.setItem('total_xp', String(newXP))
  },

  getLatestWeight: () => {
    const h = get().weightHistory
    return h.length ? h[h.length - 1] : undefined
  },

  getWeightChange: () => {
    const h = get().weightHistory
    if (h.length < 2) return 0
    return Math.round((h[h.length - 1].weight - h[0].weight) * 10) / 10
  },

  getLevelInfo: () => {
    const { totalXP, level } = get()
    const currentLevelXP = totalXP % XP_PER_LEVEL
    return {
      level,
      title: LEVEL_TITLES[level] ?? 'Leyenda',
      nextLevelXP: XP_PER_LEVEL,
      currentLevelXP,
    }
  },
}))
