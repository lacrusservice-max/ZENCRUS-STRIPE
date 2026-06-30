import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface DailyActivity {
  date: string
  loggedFood: boolean
  loggedWorkout: boolean
  checkInDone: boolean
  drank8Glasses: boolean
}

interface StreakState {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  weekActivity: DailyActivity[]   // últimos 7 días
  totalDaysActive: number

  load: () => Promise<void>
  markActivity: (date: string, updates: Partial<Omit<DailyActivity, 'date'>>) => Promise<void>
  isActive: (date: string) => boolean
  getTodayActivity: () => DailyActivity
  getStreakMessage: () => string
}

function todayKey() { return new Date().toISOString().slice(0, 10) }

function isConsecutive(a: string, b: string): boolean {
  const da = new Date(a), db = new Date(b)
  const diff = Math.abs(da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24)
  return diff <= 1
}

function isDayComplete(d: DailyActivity): boolean {
  return d.loggedFood || d.loggedWorkout || d.checkInDone
}

const emptyDay = (date: string): DailyActivity => ({
  date, loggedFood: false, loggedWorkout: false, checkInDone: false, drank8Glasses: false,
})

const STREAK_MESSAGES = [
  { min: 0,   msg: 'Hoy es el primer día de tu mejor versión.' },
  { min: 1,   msg: '¡1 día! Todo viaje empieza con un paso.' },
  { min: 3,   msg: '3 días seguidos. La constancia está naciendo.' },
  { min: 7,   msg: '¡1 semana! Los hábitos se forman en 21 días.' },
  { min: 14,  msg: '2 semanas de disciplina pura. Sigue.' },
  { min: 21,  msg: '21 días — el hábito ya es tuyo. Imparable.' },
  { min: 30,  msg: '1 mes completo. Eres de los pocos que llegan aquí.' },
  { min: 60,  msg: '2 meses. Esto ya es tu estilo de vida.' },
  { min: 90,  msg: '90 días. Transformación REAL. Élite total.' },
  { min: 180, msg: '6 meses. Leyenda. ZENCRUS te pertenece.' },
  { min: 365, msg: '1 AÑO. Esto es lo que separa a los mejores del mundo.' },
]

export const useStreakStore = create<StreakState>((set, get) => ({
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  weekActivity: [],
  totalDaysActive: 0,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem('streak_data')
      if (raw) {
        const data = JSON.parse(raw)
        // Re-verificar racha (puede haberse roto si no entró ayer)
        const today = todayKey()
        const last = data.lastActiveDate
        if (last && last !== today) {
          const da = new Date(last), db = new Date(today)
          const diff = (db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24)
          if (diff > 1) {
            data.currentStreak = 0  // Racha rota
          }
        }
        set(data)
      }

      // Cargar actividad de la semana
      const week: DailyActivity[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        const raw = await AsyncStorage.getItem(`activity_${key}`)
        week.push(raw ? JSON.parse(raw) : emptyDay(key))
      }
      set({ weekActivity: week })
    } catch {}
  },

  markActivity: async (date, updates) => {
    const stored = await AsyncStorage.getItem(`activity_${date}`)
    const current = stored ? JSON.parse(stored) : emptyDay(date)
    const updated = { ...current, ...updates }
    await AsyncStorage.setItem(`activity_${date}`, JSON.stringify(updated))

    // Actualizar semana
    const week = get().weekActivity.map(d => d.date === date ? updated : d)
    set({ weekActivity: week })

    if (!isDayComplete(updated)) return

    const { lastActiveDate, currentStreak, longestStreak, totalDaysActive } = get()
    const today = todayKey()
    if (date !== today) return   // Solo actualizar racha para hoy

    let newStreak = currentStreak
    if (lastActiveDate === null) {
      newStreak = 1
    } else if (lastActiveDate === today) {
      // Ya registrado hoy, no cambiar racha
    } else if (isConsecutive(lastActiveDate, today)) {
      newStreak = currentStreak + 1
    } else {
      newStreak = 1
    }

    const newLongest = Math.max(longestStreak, newStreak)
    const newTotal = lastActiveDate === today ? totalDaysActive : totalDaysActive + 1

    const streakData = {
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
      totalDaysActive: newTotal,
    }
    set(streakData)
    await AsyncStorage.setItem('streak_data', JSON.stringify(streakData))
  },

  isActive: (date) => {
    const day = get().weekActivity.find(d => d.date === date)
    return day ? isDayComplete(day) : false
  },

  getTodayActivity: () => {
    const today = todayKey()
    return get().weekActivity.find(d => d.date === today) ?? emptyDay(today)
  },

  getStreakMessage: () => {
    const s = get().currentStreak
    const match = [...STREAK_MESSAGES].reverse().find(m => s >= m.min)
    return match?.msg ?? STREAK_MESSAGES[0].msg
  },
}))
