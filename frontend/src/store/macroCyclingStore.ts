import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type DayType = 'high' | 'moderate' | 'low' | 'rest'

export interface MacroDay {
  type: DayType
  carbMultiplier: number       // × base carbs
  proteinMultiplier: number    // × base protein
  fatMultiplier: number        // × base fat
  calAdjust: number            // kcal +/- from target
}

export const DAY_TYPE_CONFIG: Record<DayType, MacroDay> = {
  high: {
    type: 'high',
    carbMultiplier: 1.4,
    proteinMultiplier: 1.1,
    fatMultiplier: 0.8,
    calAdjust: +200,
  },
  moderate: {
    type: 'moderate',
    carbMultiplier: 1.0,
    proteinMultiplier: 1.0,
    fatMultiplier: 1.0,
    calAdjust: 0,
  },
  low: {
    type: 'low',
    carbMultiplier: 0.5,
    proteinMultiplier: 1.2,
    fatMultiplier: 1.3,
    calAdjust: -200,
  },
  rest: {
    type: 'rest',
    carbMultiplier: 0.4,
    proteinMultiplier: 1.0,
    fatMultiplier: 1.4,
    calAdjust: -300,
  },
}

export const DAY_TYPE_LABELS: Record<DayType, { emoji: string; label: string; color: string; description: string }> = {
  high: {
    emoji: '🔥',
    label: 'Alto en carbs',
    color: '#FF6B35',
    description: 'Días de entreno intenso. Más energía para rendir al máximo.',
  },
  moderate: {
    emoji: '⚡',
    label: 'Moderado',
    color: '#4CAF50',
    description: 'Balance ideal. Entrenamiento de intensidad media.',
  },
  low: {
    emoji: '🌿',
    label: 'Bajo en carbs',
    color: '#2196F3',
    description: 'Días de cardio suave. Favorece la quema de grasa.',
  },
  rest: {
    emoji: '😴',
    label: 'Día de descanso',
    color: '#9E9E9E',
    description: 'Sin entreno. Mínimos carbos, más grasas para recuperación.',
  },
}

export type WeekCycle = [DayType, DayType, DayType, DayType, DayType, DayType, DayType]

export const PRESET_CYCLES: Record<string, { label: string; description: string; cycle: WeekCycle }> = {
  classic: {
    label: 'Clásico (3/2/2)',
    description: '3 días altos, 2 moderados, 2 bajos. Para pérdida de grasa con rendimiento.',
    cycle: ['high', 'moderate', 'high', 'moderate', 'high', 'low', 'rest'],
  },
  aggressive_cut: {
    label: 'Corte agresivo',
    description: '2 días altos, 3 bajos, 2 descanso. Para pérdida de grasa rápida.',
    cycle: ['high', 'low', 'low', 'high', 'low', 'low', 'rest'],
  },
  lean_bulk: {
    label: 'Volumen limpio',
    description: '4 días altos, 2 moderados, 1 bajo. Para ganar músculo sin mucha grasa.',
    cycle: ['high', 'high', 'moderate', 'high', 'high', 'moderate', 'low'],
  },
  maintenance: {
    label: 'Mantenimiento',
    description: 'Todos los días moderados. Para mantener composición corporal.',
    cycle: ['moderate', 'moderate', 'moderate', 'moderate', 'moderate', 'low', 'rest'],
  },
}

interface MacroCyclingState {
  enabled: boolean
  weekCycle: WeekCycle
  currentPreset: string | null
  baseCalories: number
  baseProtein: number
  baseCarbs: number
  baseFat: number

  load: () => Promise<void>
  save: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
  setPreset: (presetKey: string) => Promise<void>
  setDayType: (dayIndex: number, type: DayType) => Promise<void>
  setBaseTargets: (calories: number, protein: number, carbs: number, fat: number) => Promise<void>

  getTodayPlan: () => { dayType: DayType; calories: number; protein: number; carbs: number; fat: number }
  getDayPlan: (dayIndex: number) => { dayType: DayType; calories: number; protein: number; carbs: number; fat: number }
}

const DEFAULT_CYCLE: WeekCycle = ['high', 'moderate', 'high', 'moderate', 'high', 'low', 'rest']

export const useMacroCyclingStore = create<MacroCyclingState>((set, get) => ({
  enabled: false,
  weekCycle: DEFAULT_CYCLE,
  currentPreset: 'classic',
  baseCalories: 2000,
  baseProtein: 150,
  baseCarbs: 200,
  baseFat: 65,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem('macro_cycling')
      if (raw) {
        const data = JSON.parse(raw)
        set({
          enabled: data.enabled ?? false,
          weekCycle: data.weekCycle ?? DEFAULT_CYCLE,
          currentPreset: data.currentPreset ?? 'classic',
          baseCalories: data.baseCalories ?? 2000,
          baseProtein: data.baseProtein ?? 150,
          baseCarbs: data.baseCarbs ?? 200,
          baseFat: data.baseFat ?? 65,
        })
      }
    } catch {}
  },

  save: async () => {
    const { enabled, weekCycle, currentPreset, baseCalories, baseProtein, baseCarbs, baseFat } = get()
    try {
      await AsyncStorage.setItem('macro_cycling', JSON.stringify({
        enabled, weekCycle, currentPreset, baseCalories, baseProtein, baseCarbs, baseFat,
      }))
    } catch {}
  },

  setEnabled: async (enabled) => {
    set({ enabled })
    await get().save()
  },

  setPreset: async (presetKey) => {
    const preset = PRESET_CYCLES[presetKey]
    if (!preset) return
    set({ weekCycle: preset.cycle, currentPreset: presetKey })
    await get().save()
  },

  setDayType: async (dayIndex, type) => {
    const cycle = [...get().weekCycle] as WeekCycle
    cycle[dayIndex] = type
    set({ weekCycle: cycle, currentPreset: null })
    await get().save()
  },

  setBaseTargets: async (calories, protein, carbs, fat) => {
    set({ baseCalories: calories, baseProtein: protein, baseCarbs: carbs, baseFat: fat })
    await get().save()
  },

  getTodayPlan: () => {
    const dayIndex = ((new Date().getDay() + 6) % 7)
    return get().getDayPlan(dayIndex)
  },

  getDayPlan: (dayIndex) => {
    const { weekCycle, baseCalories, baseProtein, baseCarbs, baseFat } = get()
    const dayType = weekCycle[dayIndex] ?? 'moderate'
    const config = DAY_TYPE_CONFIG[dayType]
    return {
      dayType,
      calories: Math.round(baseCalories + config.calAdjust),
      protein: Math.round(baseProtein * config.proteinMultiplier),
      carbs: Math.round(baseCarbs * config.carbMultiplier),
      fat: Math.round(baseFat * config.fatMultiplier),
    }
  },
}))
