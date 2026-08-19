import { hoyLocal, haceDias } from '@/utils/fechas'
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useHealthTrackerStore } from './healthTrackerStore'
import {
  puntuarRecuperacion, fuentesDeRecuperacion, SenalesRecuperacion,
} from '@/utils/scoreRecuperacion'

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
  /** null = no hay ni una señal con la que puntuar. */
  getRecoveryScore: () => number | null
  /** Qué señales sostienen el score de hoy. */
  getRecoverySources: () => { checkIn: boolean; sueno: boolean; pulso: boolean }
}

function today() { return hoyLocal() }

/**
 * De dónde sale cada señal.
 *
 * `sleepQuality` y el pulso pueden ser null, y esa es la información importante:
 * significan «no registrado», no «cero». Antes el pulso nunca llegaba null
 * porque el store fabricaba un 65, y de ahí venía el score fantasma.
 */
function senalesDeHoy(get: () => RecoveryState): SenalesRecuperacion {
  const salud = useHealthTrackerStore.getState()
  const calidad = salud.getTodaySummary().sleepQuality
  const hoy = get().getToday()
  return {
    checkIn: hoy ? { energy: hoy.energy, soreness: hoy.soreness, stress: hoy.stress } : null,
    sueno: calidad ? SLEEP_QUALITY_SCORE[calidad] : null,
    pulso: salud.getRestingHeartRate(),
  }
}

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
      const key = haceDias(i)
      if (entries[key]) list.push(entries[key])
    }
    return avgOf(list)
  },

  getTrend: () => {
    const { entries } = get()
    const thisWeek: RecoveryEntry[] = []
    const lastWeek: RecoveryEntry[] = []
    for (let i = 0; i < 14; i++) {
      const key = haceDias(i)
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

  /**
   * El cálculo vive en `@/utils/scoreRecuperacion`, no aquí.
   *
   * Este método daba 70 a cualquiera que abriera la app por primera vez, y el
   * fallo sobrevivió meses porque estaba enredado con zustand, AsyncStorage y
   * otro store: no había forma de preguntarle «¿qué contestas sin datos?» sin
   * montar media app. Sacada la lógica a una función pura, esa pregunta es una
   * línea de prueba — y es exactamente la primera que hay escrita allí.
   *
   * Aquí solo queda recoger las tres señales de donde viven.
   */
  getRecoveryScore: () => puntuarRecuperacion(senalesDeHoy(get)),

  /** Qué señales sostienen el score, para que la pantalla no invente su origen. */
  getRecoverySources: () => fuentesDeRecuperacion(senalesDeHoy(get)),
}))
