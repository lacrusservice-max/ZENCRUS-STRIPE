/**
 * PLAN DE COMIDAS
 * ───────────────
 * La semana planeada vive en `meal_plans`, un documento por semana. Se lee y se
 * escribe entera: la pantalla pinta los siete días de golpe y nadie pregunta
 * «¿en cuántas semanas puse pollo el martes?».
 *
 * ── La llave de la semana no se toca ────────────────────────────────────────
 * `currentWeekKey()` no calcula la semana ISO de verdad —divide entre siete
 * desde el 1 de enero— pero es la llave con la que ya están guardados los
 * planes en los teléfonos. Cambiar el cálculo ahora los dejaría huérfanos: el
 * plan de esta semana pasaría a llamarse de otra manera y la pantalla
 * aparecería vacía.
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { leerPlanSemana, guardarPlanSemana } from '@/services/trackingService'

export interface PlannedMeal {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  emoji?: string
}

export type MealSlotId = 'breakfast' | 'lunch' | 'dinner' | 'snack1' | 'snack2'
export type DayKey = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom'

export const DAYS: DayKey[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
export const DAY_LABELS: Record<DayKey, string> = {
  lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves',
  vie: 'Viernes', sab: 'Sábado', dom: 'Domingo',
}
export const MEAL_SLOTS: Array<{ id: MealSlotId; label: string; emoji: string }> = [
  { id: 'breakfast', label: 'Desayuno', emoji: '🌅' },
  { id: 'lunch',     label: 'Almuerzo', emoji: '☀️' },
  { id: 'dinner',    label: 'Cena',     emoji: '🌙' },
  { id: 'snack1',    label: 'Snack 1',  emoji: '🍎' },
  { id: 'snack2',    label: 'Snack 2',  emoji: '🥜' },
]

export type WeekPlan = Partial<Record<DayKey, Partial<Record<MealSlotId, PlannedMeal[]>>>>

interface MealPlanState {
  weekPlan: WeekPlan
  activeWeek: string          // YYYY-WNN (ISO week identifier)

  load: () => Promise<void>
  setMeal: (day: DayKey, slot: MealSlotId, meal: PlannedMeal) => Promise<void>
  removeMeal: (day: DayKey, slot: MealSlotId, mealId: string) => Promise<void>
  clearSlot: (day: DayKey, slot: MealSlotId) => Promise<void>
  copyDay: (from: DayKey, to: DayKey) => Promise<void>
  getDayMacros: (day: DayKey) => { calories: number; protein: number; carbs: number; fat: number }
  getShoppingList: () => Array<{ name: string; count: number }>
}

function currentWeekKey(): string {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Guarda en el teléfono y manda al servidor.
 *
 * No encola si falla: el plan viaja entero en cada cambio, así que el siguiente
 * toque sube también lo que este no llegara a subir. Una cola aquí solo añadiría
 * la posibilidad de que un plan viejo pise a uno nuevo al vaciarse tarde.
 */
async function persistir(week: string, plan: WeekPlan): Promise<void> {
  await AsyncStorage.setItem(`meal_plan_${week}`, JSON.stringify(plan))
  void guardarPlanSemana(week, plan).catch(() => {})
}

export const useMealPlanStore = create<MealPlanState>((set, get) => ({
  weekPlan: {},
  activeWeek: currentWeekKey(),

  load: async () => {
    const week = currentWeekKey()
    try {
      const raw = await AsyncStorage.getItem(`meal_plan_${week}`)
      set({ weekPlan: raw ? JSON.parse(raw) : {}, activeWeek: week })
    } catch {}

    try {
      const { plan } = await leerPlanSemana<WeekPlan>(week)
      set({ weekPlan: plan ?? {}, activeWeek: week })
      await AsyncStorage.setItem(`meal_plan_${week}`, JSON.stringify(plan ?? {}))
    } catch {
      // Sin red se queda el plan de la caché, que es el mismo que había antes.
    }
  },

  setMeal: async (day, slot, meal) => {
    const plan = get().weekPlan
    const dayPlan = plan[day] ?? {}
    const slotMeals = dayPlan[slot] ?? []
    const updated: WeekPlan = {
      ...plan,
      [day]: { ...dayPlan, [slot]: [...slotMeals, meal] },
    }
    set({ weekPlan: updated })
    await persistir(get().activeWeek, updated)
  },

  removeMeal: async (day, slot, mealId) => {
    const plan = get().weekPlan
    const dayPlan = plan[day] ?? {}
    const slotMeals = (dayPlan[slot] ?? []).filter(m => m.id !== mealId)
    const updated: WeekPlan = {
      ...plan,
      [day]: { ...dayPlan, [slot]: slotMeals },
    }
    set({ weekPlan: updated })
    await persistir(get().activeWeek, updated)
  },

  clearSlot: async (day, slot) => {
    const plan = get().weekPlan
    const dayPlan = plan[day] ?? {}
    const updated: WeekPlan = {
      ...plan,
      [day]: { ...dayPlan, [slot]: [] },
    }
    set({ weekPlan: updated })
    await persistir(get().activeWeek, updated)
  },

  copyDay: async (from, to) => {
    const plan = get().weekPlan
    const fromDay = plan[from] ?? {}
    const updated: WeekPlan = { ...plan, [to]: { ...fromDay } }
    set({ weekPlan: updated })
    await persistir(get().activeWeek, updated)
  },

  getDayMacros: (day) => {
    const dayPlan = get().weekPlan[day] ?? {}
    let calories = 0, protein = 0, carbs = 0, fat = 0
    Object.values(dayPlan).forEach(meals => {
      meals?.forEach(m => {
        calories += m.calories; protein += m.protein; carbs += m.carbs; fat += m.fat
      })
    })
    return { calories: Math.round(calories), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) }
  },

  getShoppingList: () => {
    const counts: Record<string, number> = {}
    Object.values(get().weekPlan).forEach(dayPlan => {
      Object.values(dayPlan ?? {}).forEach(meals => {
        meals?.forEach(m => {
          counts[m.name] = (counts[m.name] ?? 0) + 1
        })
      })
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  },
}))
