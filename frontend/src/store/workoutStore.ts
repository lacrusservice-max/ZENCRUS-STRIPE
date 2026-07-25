import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { checkForPR, PersonalRecord, SetEntry } from '@/utils/oneRepMax'

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

// Series realmente registradas por ejercicio en una sesión (peso/reps numéricos reales)
export interface ExerciseLog {
  exerciseId: string
  exerciseName: string
  sets: SetEntry[]
}

export interface WorkoutLog {
  id: string
  date: string        // YYYY-MM-DD
  routineId?: string
  routineName: string
  exercises: Exercise[]
  exerciseLogs?: ExerciseLog[]  // series reales (peso/reps) — puede faltar en logs antiguos
  durationMinutes?: number
  notes?: string
  completedAt: number
}

const STORAGE_ROUTINES = 'workout_routines'
const STORAGE_LOG      = 'workout_log'
const STORAGE_PRS      = 'workout_prs'

interface WorkoutState {
  routines: Routine[]
  logs: WorkoutLog[]
  personalRecords: PersonalRecord[]

  loadAll: () => Promise<void>
  saveRoutine: (r: Routine) => Promise<void>
  deleteRoutine: (id: string) => Promise<void>
  addLog: (log: WorkoutLog) => Promise<void>
  /** Registra una serie completada; devuelve si fue un nuevo PR y el 1RM estimado. */
  recordSet: (exerciseName: string, set: SetEntry) => Promise<{ isPR: boolean; est1RM: number }>
  bestForExercise: (exerciseName: string) => PersonalRecord | null
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  routines: [],
  logs: [],
  personalRecords: [],

  loadAll: async () => {
    try {
      const [rRaw, lRaw, pRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_ROUTINES),
        AsyncStorage.getItem(STORAGE_LOG),
        AsyncStorage.getItem(STORAGE_PRS),
      ])
      set({
        routines: rRaw ? JSON.parse(rRaw) : [],
        logs:     lRaw ? JSON.parse(lRaw) : [],
        personalRecords: pRaw ? JSON.parse(pRaw) : [],
      })
    } catch {
      set({ routines: [], logs: [], personalRecords: [] })
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

  recordSet: async (exerciseName, entry) => {
    const { personalRecords } = get()
    const { isPR, est1RM } = checkForPR(entry, exerciseName, personalRecords)
    if (isPR) {
      const next = [
        ...personalRecords.filter(r => r.exerciseName !== exerciseName),
        { exerciseName, est1RM, weightKg: entry.weightKg, reps: entry.reps, date: new Date().toISOString() },
      ]
      set({ personalRecords: next })
      await AsyncStorage.setItem(STORAGE_PRS, JSON.stringify(next))
    }
    return { isPR, est1RM }
  },

  bestForExercise: (exerciseName) => {
    return get().personalRecords.find(r => r.exerciseName === exerciseName) ?? null
  },
}))
