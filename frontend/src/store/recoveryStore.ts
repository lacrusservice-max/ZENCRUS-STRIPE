import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useHealthTrackerStore } from './healthTrackerStore'

/**
 * Escala 1-5 en las tres, siempre "más alto = mejor" para que promediar
 * sea directo: energy = nivel de energía, soreness = qué tan poco dolor
 * muscular hay, stress = qué tan relajado se siente.
 */
export interface RecoveryEntry {
  date: string
  energy: number
  soreness: number
  stress: number
  note?: string
}

const ENTRIES_KEY = 'recovery_entries'
const MAX_ENTRIES_DAYS = 120

interface RecoveryState {
  entries: Record<string, RecoveryEntry>

  load: () => Promise<void>
  logToday: (entry: Omit<RecoveryEntry, 'date'>) => Promise<void>
  getToday: () => RecoveryEntry | null
  getWeeklyAverage: () => { energy: number; soreness: number; stress: number } | null
  getTrend: () => 'up' | 'down' | 'flat' | 'none'
  getRecoveryScore: () => number
}

function today() { return new Date().toISOString().slice(0, 10) }

function trimEntries(entries: Record<string, RecoveryEntry>): Record<string, RecoveryEntry> {
  const keys = Object.keys(entries).sort()
  if (keys.length <= MAX_ENTRIES_DAYS) return entries
  const trimmed = { ...entries }
  for (const k of keys.slice(0, keys.length - MAX_ENTRIES_DAYS)) delete trimmed[k]
  return trimmed
}

function avgOf(list: RecoveryEntry[]) {
  if (!list.length) return null
  return {
    energy: list.reduce((s, e) => s + e.energy, 0) / list.length,
    soreness: list.reduce((s, e) => s + e.soreness, 0) / list.length,
    stress: list.reduce((s, e) => s + e.stress, 0) / list.length,
  }
}

const SLEEP_QUALITY_SCORE: Record<string, number> = {
  poor: 25, fair: 50, good: 75, excellent: 100,
}

export const useRecoveryStore = create<RecoveryState>((set, get) => ({
  entries: {},

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(ENTRIES_KEY)
      set({ entries: raw ? JSON.parse(raw) : {} })
    } catch {}
  },

  logToday: async (entry) => {
    const date = today()
    const entries = trimEntries({ ...get().entries, [date]: { date, ...entry } })
    set({ entries })
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
  },

  getToday: () => get().entries[today()] ?? null,

  getWeeklyAverage: () => {
    const { entries } = get()
    const list: RecoveryEntry[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      if (entries[key]) list.push(entries[key])
    }
    return avgOf(list)
  },

  getTrend: () => {
    const { entries } = get()
    const thisWeek: RecoveryEntry[] = []
    const lastWeek: RecoveryEntry[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      if (!entries[key]) continue
      if (i < 7) thisWeek.push(entries[key])
      else lastWeek.push(entries[key])
    }
    const a = avgOf(thisWeek)
    const b = avgOf(lastWeek)
    if (!a || !b) return 'none'
    const scoreA = a.energy + a.soreness + a.stress
    const scoreB = b.energy + b.soreness + b.stress
    if (scoreA - scoreB > 0.5) return 'up'
    if (scoreB - scoreA > 0.5) return 'down'
    return 'flat'
  },

  getRecoveryScore: () => {
    const today_ = get().getToday()
    const summary = useHealthTrackerStore.getState().getTodaySummary()
    const sleepScore = summary.sleepQuality ? SLEEP_QUALITY_SCORE[summary.sleepQuality] : null
    const restingHR = useHealthTrackerStore.getState().getRestingHeartRate()
    const hrScore = Math.max(0, Math.min(100, 100 - (restingHR - 50) * 2))

    if (!today_) {
      // Sin check-in subjetivo hoy: usar solo señales objetivas.
      const parts = [sleepScore, hrScore].filter((v): v is number => v != null)
      if (!parts.length) return 0
      return Math.round(parts.reduce((s, v) => s + v, 0) / parts.length)
    }

    const subjectiveAvg = (today_.energy + today_.soreness + today_.stress) / 3
    const subjectiveScore = (subjectiveAvg / 5) * 100

    const objective = [sleepScore, hrScore].filter((v): v is number => v != null)
    const objectiveScore = objective.length
      ? objective.reduce((s, v) => s + v, 0) / objective.length
      : subjectiveScore

    return Math.round(subjectiveScore * 0.5 + objectiveScore * 0.5)
  },
}))
