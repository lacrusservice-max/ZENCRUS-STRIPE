import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'

export interface CycleEntry {
  id: string
  startDate: string    // YYYY-MM-DD
  endDate?: string     // YYYY-MM-DD (filled when period ends)
  duration?: number    // days
  symptoms: Symptom[]
  mood: MoodLevel
  flow: FlowLevel
  notes?: string
}

export interface DailyLog {
  date: string         // YYYY-MM-DD
  symptoms: Symptom[]
  mood: MoodLevel
  flow?: FlowLevel
  notes?: string
}

export type Symptom =
  | 'cramps' | 'headache' | 'bloating' | 'fatigue' | 'backache'
  | 'nausea' | 'spotting' | 'tender_breasts' | 'acne' | 'insomnia'
  | 'increased_appetite' | 'food_cravings' | 'irritability'

export type MoodLevel = 'great' | 'good' | 'neutral' | 'bad' | 'terrible' | ''
export type FlowLevel = 'none' | 'light' | 'medium' | 'heavy' | ''

export const SYMPTOM_LABELS: Record<Symptom, string> = {
  cramps: '🌀 Cólicos',
  headache: '🤕 Dolor de cabeza',
  bloating: '💨 Hinchazón',
  fatigue: '😴 Fatiga',
  backache: '🔙 Dolor de espalda',
  nausea: '🤢 Náuseas',
  spotting: '🩸 Manchado',
  tender_breasts: '😣 Sensibilidad',
  acne: '😖 Acné',
  insomnia: '🌙 Insomnio',
  increased_appetite: '🍽️ Más apetito',
  food_cravings: '🍫 Antojos',
  irritability: '😤 Irritabilidad',
}

export const MOOD_LABELS: Record<MoodLevel, string> = {
  great: '😄 Genial',
  good: '😊 Bien',
  neutral: '😐 Neutral',
  bad: '😟 Mal',
  terrible: '😢 Terrible',
  '': '—',
}

export const FLOW_LABELS: Record<FlowLevel, string> = {
  none: '⚪ Sin flujo',
  light: '🩸 Leve',
  medium: '🩸🩸 Medio',
  heavy: '🩸🩸🩸 Abundante',
  '': '—',
}

export interface CyclePrediction {
  nextPeriodDate: string
  ovulationDate: string
  fertileStart: string
  fertileEnd: string
  currentPhase: CyclePhase
  daysUntilPeriod: number
  dayOfCycle: number
  phaseNutrition: PhaseNutrition
}

export interface PhaseNutrition {
  phase: CyclePhase
  emoji: string
  title: string
  description: string
  tips: string[]
  carbAdjust: number   // % adjustment (-20 to +20)
  ironFocus: boolean
  magnesiumFocus: boolean
}

const PHASE_NUTRITION: Record<CyclePhase, PhaseNutrition> = {
  menstrual: {
    phase: 'menstrual',
    emoji: '🩸',
    title: 'Fase Menstrual',
    description: 'Tu cuerpo necesita apoyo extra. Prioriza hierro y descanso.',
    tips: [
      'Aumenta hierro: carnes rojas, espinacas, legumbres',
      'Vitamina C para absorber mejor el hierro',
      'Reduce sodio para minimizar hinchazón',
      'Magnesio para aliviar cólicos (chocolate negro 85%)',
      'Caldos calientes y té de jengibre',
    ],
    carbAdjust: 0,
    ironFocus: true,
    magnesiumFocus: true,
  },
  follicular: {
    phase: 'follicular',
    emoji: '🌱',
    title: 'Fase Folicular',
    description: 'Energía en aumento. Es el mejor momento para entrenar fuerte.',
    tips: [
      'Proteína alta para aprovechar el anabolismo',
      'Carbos complejos para energía sostenida',
      'Fermentados para estrógeno equilibrado',
      'Semillas de linaza y calabaza',
      'Ideal para entrenamientos de fuerza intensos',
    ],
    carbAdjust: 10,
    ironFocus: false,
    magnesiumFocus: false,
  },
  ovulation: {
    phase: 'ovulation',
    emoji: '✨',
    title: 'Fase de Ovulación',
    description: 'Pico de energía y fuerza. Máximo rendimiento atlético.',
    tips: [
      'Proteína alta: mayor síntesis muscular',
      'Antioxidantes: frutas del bosque, cúrcuma',
      'Fibra para metabolizar estrógenos',
      'Hidratación extra — temperatura basal alta',
      'Aprovechar para PRs y entrenamientos máximos',
    ],
    carbAdjust: 15,
    ironFocus: false,
    magnesiumFocus: false,
  },
  luteal: {
    phase: 'luteal',
    emoji: '🌙',
    title: 'Fase Lútea',
    description: 'Metabolismo acelerado ~+300 kcal. Cuida los antojos.',
    tips: [
      'Calorías +150-300 kcal extra es normal',
      'Magnesio para reducir PMS y antojos',
      'Reduce cafeína y azúcar procesada',
      'B6: salmón, plátano, pollo',
      'Carbos complejos para estabilizar ánimo',
      'Sesiones más suaves de entrenamiento',
    ],
    carbAdjust: 20,
    ironFocus: false,
    magnesiumFocus: true,
  },
}

interface MenstrualState {
  cycles: CycleEntry[]
  dailyLogs: DailyLog[]
  cycleLength: number          // avg days (default 28)
  periodLength: number         // avg days (default 5)
  isTracking: boolean          // female users only
  lastUpdated: number

  load: () => Promise<void>
  save: () => Promise<void>
  logPeriodStart: (date?: string) => Promise<void>
  logPeriodEnd: (date?: string) => Promise<void>
  logDaily: (log: Omit<DailyLog, 'date'>, date?: string) => Promise<void>
  updateCycleLength: (days: number) => Promise<void>
  updatePeriodLength: (days: number) => Promise<void>
  setTracking: (enabled: boolean) => Promise<void>

  getCurrentCycle: () => CycleEntry | null
  getPrediction: () => CyclePrediction | null
  getPhaseNutrition: () => PhaseNutrition | null
  getLogForDate: (date: string) => DailyLog | null
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function daysDiff(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export const useMenstrualStore = create<MenstrualState>((set, get) => ({
  cycles: [],
  dailyLogs: [],
  cycleLength: 28,
  periodLength: 5,
  isTracking: false,
  lastUpdated: 0,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem('menstrual_data')
      if (raw) {
        const data = JSON.parse(raw)
        set({
          cycles: data.cycles ?? [],
          dailyLogs: data.dailyLogs ?? [],
          cycleLength: data.cycleLength ?? 28,
          periodLength: data.periodLength ?? 5,
          isTracking: data.isTracking ?? false,
          lastUpdated: data.lastUpdated ?? 0,
        })
      }
    } catch {}
  },

  save: async () => {
    const { cycles, dailyLogs, cycleLength, periodLength, isTracking } = get()
    try {
      await AsyncStorage.setItem('menstrual_data', JSON.stringify({
        cycles, dailyLogs, cycleLength, periodLength, isTracking, lastUpdated: Date.now()
      }))
    } catch {}
  },

  logPeriodStart: async (date = today()) => {
    const newCycle: CycleEntry = {
      id: `cycle_${Date.now()}`,
      startDate: date,
      symptoms: [],
      mood: '',
      flow: 'medium',
    }
    const cycles = [...get().cycles, newCycle]
    set({ cycles, lastUpdated: Date.now() })
    await get().save()
  },

  logPeriodEnd: async (date = today()) => {
    const cycles = get().cycles.map((c, i) => {
      if (i === get().cycles.length - 1 && !c.endDate) {
        const duration = daysDiff(c.startDate, date) + 1
        return { ...c, endDate: date, duration }
      }
      return c
    })
    set({ cycles, lastUpdated: Date.now() })
    // Update average cycle length from last 3 cycles
    const completed = cycles.filter(c => c.endDate && c.duration)
    if (completed.length >= 2) {
      const pairs = completed.slice(-3)
      const avgLength = Math.round(
        pairs.slice(1).reduce((sum, c, i) => sum + daysDiff(pairs[i].startDate, c.startDate), 0) / (pairs.length - 1)
      )
      if (avgLength >= 21 && avgLength <= 40) {
        set({ cycleLength: avgLength })
      }
    }
    await get().save()
  },

  logDaily: async (log, date = today()) => {
    const existing = get().dailyLogs.findIndex(l => l.date === date)
    const newLog: DailyLog = { ...log, date }
    const dailyLogs = existing >= 0
      ? get().dailyLogs.map((l, i) => i === existing ? newLog : l)
      : [...get().dailyLogs, newLog]
    set({ dailyLogs, lastUpdated: Date.now() })
    await get().save()
  },

  updateCycleLength: async (days) => {
    set({ cycleLength: Math.max(21, Math.min(40, days)) })
    await get().save()
  },

  updatePeriodLength: async (days) => {
    set({ periodLength: Math.max(2, Math.min(10, days)) })
    await get().save()
  },

  setTracking: async (enabled) => {
    set({ isTracking: enabled })
    await get().save()
  },

  getCurrentCycle: () => {
    const cycles = get().cycles
    if (cycles.length === 0) return null
    const last = cycles[cycles.length - 1]
    return last
  },

  getPrediction: () => {
    const { cycles, cycleLength, periodLength } = get()
    if (cycles.length === 0) return null

    const lastCycle = cycles[cycles.length - 1]
    const lastStart = lastCycle.startDate
    const t = today()

    const dayOfCycle = daysDiff(lastStart, t) + 1
    const adjustedDay = ((dayOfCycle - 1) % cycleLength) + 1

    const nextPeriodDate = addDays(lastStart, cycleLength)
    const ovulationDate = addDays(lastStart, cycleLength - 14)
    const fertileStart = addDays(ovulationDate, -5)
    const fertileEnd = addDays(ovulationDate, 1)
    const daysUntilPeriod = daysDiff(t, nextPeriodDate)

    let currentPhase: CyclePhase
    if (adjustedDay <= periodLength) {
      currentPhase = 'menstrual'
    } else if (adjustedDay <= 13) {
      currentPhase = 'follicular'
    } else if (adjustedDay <= 16) {
      currentPhase = 'ovulation'
    } else {
      currentPhase = 'luteal'
    }

    return {
      nextPeriodDate,
      ovulationDate,
      fertileStart,
      fertileEnd,
      currentPhase,
      daysUntilPeriod,
      dayOfCycle: adjustedDay,
      phaseNutrition: PHASE_NUTRITION[currentPhase],
    }
  },

  getPhaseNutrition: () => {
    const pred = get().getPrediction()
    return pred ? pred.phaseNutrition : null
  },

  getLogForDate: (date) => {
    return get().dailyLogs.find(l => l.date === date) ?? null
  },
}))
