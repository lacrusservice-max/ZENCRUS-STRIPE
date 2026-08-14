/**
 * HÁBITOS
 * ───────
 * La lista de hábitos y el cumplimiento de cada día, ahora en
 * `habit_definitions` y `habit_logs`. AsyncStorage se queda como caché para que
 * la rejilla de la semana aparezca al instante y siga estando sin señal.
 *
 * ── Los cinco de fábrica los siembra el servidor ────────────────────────────
 * `DEFAULT_HABITS` sigue aquí, pero ya solo como lo que se pinta mientras llega
 * la primera respuesta. Las llaves son las mismas —`sleep`, `water`…— así que
 * cuando el servidor contesta, lo que había en pantalla y lo que llega son el
 * mismo hábito y no hay parpadeo ni duplicados.
 *
 * ── Borrar es desactivar ────────────────────────────────────────────────────
 * Desaparece de la lista igual que antes, pero la fila se queda: si se borrara
 * de verdad, el usuario tendría cero definiciones y la siembra del servidor le
 * devolvería los cinco de fábrica en la siguiente lectura.
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { sincronizarHabito, traerHabitos } from './trackingSync'
import { crearHabito, borrarHabito } from '@/services/trackingService'
import { haceDias, hoyLocal } from '@/utils/fechas'

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

function today() { return hoyLocal() }

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

  /**
   * Primero la caché, para que la pantalla no espere a la red; después el
   * servidor, que pisa lo anterior. Sin señal se queda lo de la caché, que es
   * exactamente lo que había antes de todo esto.
   */
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

    const delServidor = await traerHabitos(haceDias(MAX_LOG_DAYS), today())
    if (!delServidor) return

    // Los desactivados no se pintan. Siguen existiendo en la tabla para que su
    // histórico de cumplimiento tenga nombre.
    const habits = delServidor.habits
      .filter(h => h.activo)
      .map(h => ({ id: h.habitKey, label: h.label, icon: h.icon }))

    set({ habits, logs: delServidor.logs })
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits))
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(delServidor.logs))
  },

  addHabit: async (label, icon) => {
    const habit: Habit = { id: `custom_${Date.now()}`, label, icon }
    const habits = [...get().habits, habit]
    set({ habits })
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits))
    // La llave la pone la app: se puede marcar como cumplido antes de que el
    // servidor conteste.
    void crearHabito(habit.id, label, icon, habits.length).catch(() => {})
  },

  removeHabit: async (id) => {
    const habits = get().habits.filter(h => h.id !== id)
    set({ habits })
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits))
    void borrarHabito(id).catch(() => {})
  },

  toggleToday: async (habitId) => {
    const date = today()
    const logs = trimLogs({ ...get().logs })
    const day = { ...(logs[date] ?? {}) }
    day[habitId] = !day[habitId]
    logs[date] = day
    set({ logs })
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs))
    // Optimista, con caída a la cola: marcar un hábito en el gimnasio sin
    // cobertura tiene que responder igual de rápido que con ella.
    void sincronizarHabito(habitId, date, day[habitId])
  },

  getTodayStatus: () => get().logs[today()] ?? {},

  getStreakForHabit: (habitId) => {
    const { logs } = get()
    let streak = 0
    for (let i = 0; i < MAX_LOG_DAYS; i++) {
      if (logs[haceDias(i)]?.[habitId]) streak++
      else break
    }
    return streak
  },

  getWeekGrid: () => {
    const { logs } = get()
    return Array.from({ length: 7 }, (_, i) => {
      const key = haceDias(6 - i)
      return { date: key, log: logs[key] ?? {} }
    })
  },
}))
