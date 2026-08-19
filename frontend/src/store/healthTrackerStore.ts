import { hoyLocal, haceDias } from '@/utils/fechas'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface StepEntry {
  date: string
  steps: number
  caloriesBurned: number
  distanceKm: number
  activeMinutes: number
}

export interface HeartRateEntry {
  timestamp: string
  bpm: number
  type: 'resting' | 'active' | 'peak'
}

export interface SleepEntry {
  date: string
  bedtime: string
  wakeTime: string
  totalHours: number
  quality: 'poor' | 'fair' | 'good' | 'excellent'
  deepSleepHours: number
  remSleepHours: number
}

export interface DailyHealthSummary {
  date: string
  steps: number
  caloriesBurned: number
  distanceKm: number
  activeMinutes: number
  avgHeartRate: number
  restingHeartRate: number
  sleepHours: number
  sleepQuality: SleepEntry['quality'] | null
}

const STEPS_PER_CALORIE = 0.04
const STEPS_PER_KM = 1312

function stepsToCalories(steps: number): number {
  return Math.round(steps * STEPS_PER_CALORIE)
}

function stepsToKm(steps: number): number {
  return Math.round((steps / STEPS_PER_KM) * 10) / 10
}

const today = () => hoyLocal()

/**
 * AQUÍ HABÍA SIETE DÍAS DE PASOS Y DE SUEÑO INVENTADOS
 * ═══════════════════════════════════════════════════
 * `DEMO_STEPS` y `DEMO_SLEEP` generaban una semana entera con `Math.random()`,
 * y `todaySteps` arrancaba con un número al azar entre 2.000 y 5.000. No eran
 * un ejemplo de una pantalla de bienvenida: eran el ESTADO INICIAL del store, y
 * el store persiste. O sea que se inventaban una vez, se guardaban en el
 * teléfono y a partir de ahí pasaban por datos del usuario.
 *
 * El síntoma se veía en la app: abrir Salud enseñaba 2.519 pasos, y al volver
 * un rato después 3.458. Nadie había andado. Y el «Score de recuperación» se
 * calculaba con ese sueño falso, así que el número que la app da como
 * indicación de cómo estás salía de un dado.
 *
 * No hay dato hasta que alguien lo registra. Un cero honesto se puede rellenar;
 * un número inventado no se puede distinguir de uno real.
 */

interface HealthTrackerState {
  stepHistory: StepEntry[]
  heartRateHistory: HeartRateEntry[]
  sleepHistory: SleepEntry[]
  todaySteps: number
  isTrackingSteps: boolean
  stepGoal: number
  sleepGoal: number
  hrGoal: { min: number; max: number }
  load: () => Promise<void>
  addSteps: (steps: number) => void
  setTodaySteps: (steps: number) => void
  logHeartRate: (bpm: number, type: HeartRateEntry['type']) => void
  logSleep: (entry: Omit<SleepEntry, 'totalHours' | 'quality'>) => void
  startStepTracking: () => void
  stopStepTracking: () => void
  getTodaySummary: () => DailyHealthSummary
  getWeeklySummary: () => DailyHealthSummary[]
  getAvgHeartRate: (date?: string) => number
  getRestingHeartRate: () => number
  getSleepForDate: (date: string) => SleepEntry | null
  getStepsForDate: (date: string) => StepEntry | null
  getTodayProgress: () => { registrado: boolean; steps: number; pct: number; calories: number; km: number; activeMin: number }
}

export const useHealthTrackerStore = create<HealthTrackerState>()(
  persist(
    (set, get) => ({
      stepHistory: [],
      heartRateHistory: [],
      sleepHistory: [],
      todaySteps: 0,
      isTrackingSteps: false,
      stepGoal: 10000,
      sleepGoal: 8,
      hrGoal: { min: 50, max: 90 },

      load: async () => {},

      addSteps: (steps) => {
        const newTotal = get().todaySteps + steps
        get().setTodaySteps(newTotal)
      },

      setTodaySteps: (steps) => {
        const date = today()
        const entry: StepEntry = {
          date,
          steps,
          caloriesBurned: stepsToCalories(steps),
          distanceKm: stepsToKm(steps),
          activeMinutes: Math.floor(steps / 100),
        }
        set(s => ({
          todaySteps: steps,
          stepHistory: [
            entry,
            ...s.stepHistory.filter(e => e.date !== date),
          ].slice(0, 90),
        }))
      },

      logHeartRate: (bpm, type) => {
        const entry: HeartRateEntry = {
          timestamp: new Date().toISOString(),
          bpm,
          type,
        }
        set(s => ({
          heartRateHistory: [entry, ...s.heartRateHistory].slice(0, 500),
        }))
      },

      logSleep: (sleepData) => {
        const bedH = parseInt(sleepData.bedtime.split(':')[0])
        const bedM = parseInt(sleepData.bedtime.split(':')[1])
        const wakeH = parseInt(sleepData.wakeTime.split(':')[0])
        const wakeM = parseInt(sleepData.wakeTime.split(':')[1])
        let totalMins = (wakeH * 60 + wakeM) - (bedH * 60 + bedM)
        if (totalMins < 0) totalMins += 1440
        const totalHours = Math.round((totalMins / 60) * 10) / 10
        const quality: SleepEntry['quality'] =
          totalHours >= 7.5 ? 'excellent' :
          totalHours >= 6.5 ? 'good' :
          totalHours >= 5.5 ? 'fair' : 'poor'

        const entry: SleepEntry = {
          ...sleepData,
          totalHours,
          quality,
          deepSleepHours: Math.round(totalHours * 0.2 * 10) / 10,
          remSleepHours: Math.round(totalHours * 0.25 * 10) / 10,
        }
        set(s => ({
          sleepHistory: [entry, ...s.sleepHistory.filter(e => e.date !== sleepData.date)].slice(0, 90),
        }))
      },

      startStepTracking: () => set({ isTrackingSteps: true }),
      stopStepTracking: () => set({ isTrackingSteps: false }),

      getTodaySummary: () => {
        const { todaySteps } = get()
        const todaySleep = get().getSleepForDate(today())
        const avgHR = get().getAvgHeartRate(today())
        const restHR = get().getRestingHeartRate()
        return {
          date: today(),
          steps: todaySteps,
          caloriesBurned: stepsToCalories(todaySteps),
          distanceKm: stepsToKm(todaySteps),
          activeMinutes: Math.floor(todaySteps / 100),
          avgHeartRate: avgHR,
          restingHeartRate: restHR,
          sleepHours: todaySleep?.totalHours ?? 0,
          sleepQuality: todaySleep?.quality ?? null,
        }
      },

      getWeeklySummary: () => {
        const { stepHistory, sleepHistory } = get()
        return Array.from({ length: 7 }, (_, i) => {
          const date = haceDias(i)
          const step = date === today()
            ? { steps: get().todaySteps, caloriesBurned: stepsToCalories(get().todaySteps), distanceKm: stepsToKm(get().todaySteps), activeMinutes: Math.floor(get().todaySteps / 100) }
            : stepHistory.find(e => e.date === date)
          const sleep = sleepHistory.find(e => e.date === date)
          return {
            date,
            steps: step?.steps ?? 0,
            caloriesBurned: step?.caloriesBurned ?? 0,
            distanceKm: step?.distanceKm ?? 0,
            activeMinutes: step?.activeMinutes ?? 0,
            avgHeartRate: get().getAvgHeartRate(date),
            restingHeartRate: get().getRestingHeartRate(),
            sleepHours: sleep?.totalHours ?? 0,
            sleepQuality: sleep?.quality ?? null,
          }
        })
      },

      getAvgHeartRate: (date) => {
        const { heartRateHistory } = get()
        const entries = date
          ? heartRateHistory.filter(e => e.timestamp.startsWith(date))
          : heartRateHistory.slice(0, 10)
        if (!entries.length) return 72
        return Math.round(entries.reduce((sum, e) => sum + e.bpm, 0) / entries.length)
      },

      getRestingHeartRate: () => {
        const { heartRateHistory } = get()
        const resting = heartRateHistory.filter(e => e.type === 'resting')
        if (!resting.length) return 65
        return Math.round(resting.slice(0, 7).reduce((s, e) => s + e.bpm, 0) / Math.min(resting.length, 7))
      },

      getSleepForDate: (date) => {
        return get().sleepHistory.find(e => e.date === date) ?? null
      },

      /**
       * `null` significa SIN REGISTRAR, y no es lo mismo que cero.
       *
       * Antes, para hoy devolvía siempre un objeto —aunque nadie hubiera
       * apuntado nada— así que quien lo pintaba no tenía forma de distinguir
       * «no hay dato» de «anduve 0 pasos». Con datos inventados de fondo daba
       * igual; ahora que el historial arranca vacío, es la diferencia entre una
       * gráfica honesta y una llena de ceros que parecen medidos.
       */
      getStepsForDate: (date) => get().stepHistory.find(e => e.date === date) ?? null,

      getTodayProgress: () => {
        const { todaySteps, stepGoal } = get()
        return {
          /** Si nadie lo ha apuntado hoy, no hay progreso que enseñar. */
          registrado: get().stepHistory.some(e => e.date === today()),
          steps: todaySteps,
          pct: Math.min(100, Math.round((todaySteps / stepGoal) * 100)),
          calories: stepsToCalories(todaySteps),
          km: stepsToKm(todaySteps),
          activeMin: Math.floor(todaySteps / 100),
        }
      },
    }),
    {
      name: 'zencrus-health-tracker',
      storage: createJSONStorage(() => AsyncStorage),
      /**
       * Versión 1: se tira lo que había guardado.
       *
       * Sin esto el arreglo no llegaría a nadie que ya tenga la app: el estado
       * inicial solo se usa la PRIMERA vez, y a partir de ahí manda lo que hay
       * en disco — que es justamente la semana inventada. Cambiar el código sin
       * migrar habría dejado los números falsos exactamente donde estaban.
       *
       * Se descarta todo el historial en vez de intentar salvar algo: no hay
       * forma de saber qué entradas eran inventadas y cuáles se registraron a
       * mano después, y conservar un dato dudoso es peor que empezar limpio.
       * Los objetivos sí se conservan, que esos sí los eligió el usuario.
       */
      version: 1,
      migrate: (guardado: any, versionPrevia: number) => {
        if (versionPrevia >= 1) return guardado
        return {
          ...guardado,
          stepHistory: [],
          heartRateHistory: [],
          sleepHistory: [],
          todaySteps: 0,
        }
      },
    }
  )
)
