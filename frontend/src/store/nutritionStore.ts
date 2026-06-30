import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface FoodEntry {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  amount: number
  unit: string
  timestamp: number
}

export interface MealSlot {
  id: 'breakfast' | 'lunch' | 'dinner' | 'snack1' | 'snack2' | 'snack3'
  label: string
  emoji: string
  entries: FoodEntry[]
}

const MEAL_DEFAULTS: MealSlot[] = [
  { id: 'breakfast', label: 'Desayuno',        emoji: '🌅', entries: [] },
  { id: 'lunch',     label: 'Almuerzo',         emoji: '☀️', entries: [] },
  { id: 'dinner',    label: 'Cena',             emoji: '🌙', entries: [] },
  { id: 'snack1',    label: 'Snack 1',          emoji: '🍎', entries: [] },
  { id: 'snack2',    label: 'Snack 2',          emoji: '🥜', entries: [] },
  { id: 'snack3',    label: 'Snack 3',          emoji: '🍫', entries: [] },
]

interface NutritionState {
  date: string   // 'YYYY-MM-DD'
  meals: MealSlot[]
  waterGlasses: number
  streak: number

  // Derived
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  totalFiber: number

  loadToday: () => Promise<void>
  addEntry: (mealId: string, entry: FoodEntry) => void
  removeEntry: (mealId: string, entryId: string) => void
  addWater: () => void
  removeWater: () => void
  save: () => Promise<void>
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function computeTotals(meals: MealSlot[]) {
  let cal = 0, prot = 0, carbs = 0, fat = 0, fiber = 0
  meals.forEach(m => m.entries.forEach(e => {
    cal += e.calories; prot += e.protein; carbs += e.carbs; fat += e.fat; fiber += e.fiber
  }))
  return {
    totalCalories: Math.round(cal),
    totalProtein: Math.round(prot),
    totalCarbs: Math.round(carbs),
    totalFat: Math.round(fat),
    totalFiber: Math.round(fiber),
  }
}

export const useNutritionStore = create<NutritionState>((set, get) => ({
  date: todayKey(),
  meals: MEAL_DEFAULTS,
  waterGlasses: 0,
  streak: 0,
  totalCalories: 0,
  totalProtein: 0,
  totalCarbs: 0,
  totalFat: 0,
  totalFiber: 0,

  loadToday: async () => {
    const key = todayKey()
    try {
      const raw = await AsyncStorage.getItem(`nutrition_${key}`)
      if (raw) {
        const saved = JSON.parse(raw)
        set({ ...saved, date: key, ...computeTotals(saved.meals ?? MEAL_DEFAULTS) })
      } else {
        // Check streak from yesterday
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yk = yesterday.toISOString().slice(0, 10)
        const yRaw = await AsyncStorage.getItem(`nutrition_${yk}`)
        const prevStreak = yRaw ? (JSON.parse(yRaw).streak ?? 0) : 0
        set({ date: key, meals: MEAL_DEFAULTS, waterGlasses: 0, streak: prevStreak, ...computeTotals(MEAL_DEFAULTS) })
      }
    } catch {
      set({ date: key, meals: MEAL_DEFAULTS, waterGlasses: 0, streak: 0, ...computeTotals(MEAL_DEFAULTS) })
    }
  },

  addEntry: (mealId, entry) => {
    const meals = get().meals.map(m =>
      m.id === mealId ? { ...m, entries: [...m.entries, entry] } : m
    )
    set({ meals, ...computeTotals(meals) })
    get().save()
  },

  removeEntry: (mealId, entryId) => {
    const meals = get().meals.map(m =>
      m.id === mealId ? { ...m, entries: m.entries.filter(e => e.id !== entryId) } : m
    )
    set({ meals, ...computeTotals(meals) })
    get().save()
  },

  addWater: () => {
    const w = get().waterGlasses + 1
    set({ waterGlasses: w })
    get().save()
  },

  removeWater: () => {
    const w = Math.max(0, get().waterGlasses - 1)
    set({ waterGlasses: w })
    get().save()
  },

  save: async () => {
    const { date, meals, waterGlasses, streak } = get()
    const newStreak = streak + (get().totalCalories > 0 ? 0 : 0) // increment on day complete
    await AsyncStorage.setItem(`nutrition_${date}`, JSON.stringify({ meals, waterGlasses, streak: newStreak }))
  },
}))
