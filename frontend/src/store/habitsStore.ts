import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface Habit {
  id: string
  label: string
  icon: string // nombre de Ionicon
}

export type DayLog = Record<string, boolean> // habitId -> hecho

const DEFAULT_HABITS: Habit[] = [
  { id: 'sleep',   label: 'Dormir 7h o más',           icon: 'moon' },
  { id: 'water',   label: '8 vasos de agua',            icon: 'water' },
  { id: 'workout', label: 'Entrenar',                    icon: 'barbell' },
  { id: 'protein', label: 'Proteína objetivo',           icon: 'restaurant' },
  { id: 'mind',    label: 'Respirar / meditar 5 min',    icon: 'leaf' },
]

const HABITS_KEY = 'habits_list'
const LOGS_KEY = 'habits_logs'
const MAX_LOG_DAYS = 120

interface HabitsState {
  habits: Habit[]
  logs: Record<string, DayLog> // date (YYYY-MM-DD) -> DayLog

  load: () => Promise<void>
  addHabit: (label: string, icon: string) => Promise<void>
  removeHabit: (id: string) => Promise<void>
  toggleToday: (habitId: string) => Promise<void>
  getTodayStatus: () => DayLog
  getStreakForHabit: (habitId: string) => number
  getWeekGrid: () => { date: string; log: DayLog }[]
}

function today() { return new Date().toISOString().slice(0, 10) }

function trimLogs(logs: Record<string, DayLog>): Record<string, DayLog> {
  const keys = Object.keys(logs).sort()
  if (keys.length <= MAX_LOG_DAYS) return logs
  const trimmed = { ...logs }
  for (const k of keys.slice(0, keys.length - MAX_LOG_DAYS)) delete trimmed[k]
  return trimmed
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: DEFAULT_HABITS,
  logs: {},

  load: async () => {
    try {
      const [habitsRaw, logsRaw] = await Promise.all([
        AsyncStorage.getItem(HABITS_KEY),
        AsyncStorage.getItem(LOGS_KEY),
      ])
      set({
        habits: habitsRaw ? JSON.parse(habitsRaw) : DEFAULT_HABITS,
        logs: logsRaw ? JSON.parse(logsRaw) : {},
      })
    } catch {}
  },

  addHabit: async (label, icon) => {
    const habit: Habit = { id: `custom_${Date.now()}`, label, icon }
    const habits = [...get().habits, habit]
    set({ habits })
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits))
  },

  removeHabit: async (id) => {
    const habits = get().habits.filter(h => h.id !== id)
    set({ habits })
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits))
  },

  toggleToday: async (habitId) => {
    const date = today()
    const logs = trimLogs({ ...get().logs })
    const day = { ...(logs[date] ?? {}) }
    day[habitId] = !day[habitId]
    logs[date] = day
    set({ logs })
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs))
  },

  getTodayStatus: () => get().logs[today()] ?? {},

  getStreakForHabit: (habitId) => {
    const { logs } = get()
    let streak = 0
    for (let i = 0; i < MAX_LOG_DAYS; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      if (logs[key]?.[habitId]) streak++
      else break
    }
    return streak
  },

  getWeekGrid: () => {
    const { logs } = get()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const key = d.toISOString().slice(0, 10)
      return { date: key, log: logs[key] ?? {} }
    })
  },
}))
