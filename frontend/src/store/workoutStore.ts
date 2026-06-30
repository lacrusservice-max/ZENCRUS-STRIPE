import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface Exercise {
  id: string
  name: string
  sets: number
  reps: string        // "8-12", "15", "max", "60s"
  weight: string      // "bodyweight", "60", "banda"
  rest: number        // seconds
  notes?: string
}

export interface Routine {
  id: string
  name: string
  trainingType: string
  emoji: string
  exercises: Exercise[]
  estimatedMinutes: number
  notes?: string
  createdAt: number
}

export interface WorkoutLog {
  id: string
  date: string        // YYYY-MM-DD
  routineId?: string
  routineName: string
  exercises: Exercise[]
  durationMinutes?: number
  notes?: string
  completedAt: number
}

const STORAGE_ROUTINES = 'workout_routines'
const STORAGE_LOG      = 'workout_log'

interface WorkoutState {
  routines: Routine[]
  logs: WorkoutLog[]

  loadAll: () => Promise<void>
  saveRoutine: (r: Routine) => Promise<void>
  deleteRoutine: (id: string) => Promise<void>
  addLog: (log: WorkoutLog) => Promise<void>
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  routines: [],
  logs: [],

  loadAll: async () => {
    try {
      const [rRaw, lRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_ROUTINES),
        AsyncStorage.getItem(STORAGE_LOG),
      ])
      set({
        routines: rRaw ? JSON.parse(rRaw) : [],
        logs:     lRaw ? JSON.parse(lRaw) : [],
      })
    } catch {
      set({ routines: [], logs: [] })
    }
  },

  saveRoutine: async (r) => {
    const existing = get().routines.filter(x => x.id !== r.id)
    const routines = [...existing, r]
    set({ routines })
    await AsyncStorage.setItem(STORAGE_ROUTINES, JSON.stringify(routines))
  },

  deleteRoutine: async (id) => {
    const routines = get().routines.filter(r => r.id !== id)
    set({ routines })
    await AsyncStorage.setItem(STORAGE_ROUTINES, JSON.stringify(routines))
  },

  addLog: async (log) => {
    const logs = [...get().logs, log]
    set({ logs })
    await AsyncStorage.setItem(STORAGE_LOG, JSON.stringify(logs))
  },
}))
