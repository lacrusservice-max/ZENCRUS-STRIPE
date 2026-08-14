import { hoyLocal, haceDias } from '@/utils/fechas'
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  aNuevaEntrada, repartirEnComidas, sincronizarEntradas, sincronizarDia,
  traerDia, vaciarCola, migrarHistorico, olvidarPendiente,
} from './nutritionSync'
import { actualizar as actualizarEnServidor, eliminar as eliminarEnServidor } from '@/services/nutritionService'
import type { MealSlotId } from '@/services/nutritionService'

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
  /** Si es false, el alimento se queda visible pero sale de los totales. Default true. */
  active?: boolean
  /**
   * Emoji del alimento, resuelto al registrarlo.
   *
   * Se guarda con la entrada en vez de recalcularlo en cada pantalla: así el
   * icono es el mismo en la búsqueda, en la revisión y en el diario del día,
   * y no depende de que cada vista recuerde pedirlo.
   */
  emoji?: string
  /**
   * Id de la fila en Supabase. Lo rellena la sincronización al leer del
   * servidor; en una entrada recién creada sin red todavía no existe, y por
   * eso las escrituras se identifican por `id` (que viaja como `clientId`) y
   * no por este campo.
   */
  serverId?: string
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
  /** Agrega varias entradas a la vez, repartidas por comida — usado por Confirmar alimentos. */
  addEntries: (entriesByMeal: Record<string, FoodEntry[]>) => void
  removeEntry: (mealId: string, entryId: string) => void
  toggleEntryActive: (mealId: string, entryId: string) => void
  addWater: () => void
  removeWater: () => void
  save: () => Promise<void>
  /** Trae el día del servidor y pisa lo local. Silencioso si no hay red. */
  sincronizar: () => Promise<void>
  /** Sube el histórico del teléfono a Supabase. Una vez por instalación. */
  migrar: () => Promise<{ dias: number; entradas: number; fallos: number }>
}

function todayKey() {
  return hoyLocal()
}

function computeTotals(meals: MealSlot[]) {
  let cal = 0, prot = 0, carbs = 0, fat = 0, fiber = 0
  meals.forEach(m => m.entries.forEach(e => {
    if (e.active === false) return
    cal += e.calories; prot += e.protein; carbs += e.carbs; fat += e.fat; fiber += e.fiber
  }))
  return {
    totalCalories: Math.round(cal),
    totalProtein: Math.round(prot),
    totalCarbs: Math.round(carbs),
    totalFat: Math.round(fat),
    totalFiber: Math.round(fiber) }
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

  /**
   * Carga el día. El servidor manda; la caché es el plan B.
   *
   * Se pinta primero lo que haya en local —para que la pantalla no parpadee ni
   * espere a la red— y luego se pisa con lo del servidor si contesta. Si no
   * contesta, el usuario se queda con su registro en vez de con una pantalla
   * vacía, que es lo que pasaba cuando esto solo miraba a AsyncStorage.
   */
  sincronizar: async () => {
    const key = get().date || todayKey()
    // Lo pendiente de días anteriores se manda antes de leer, para no traer del
    // servidor un día al que todavía le faltan entradas por subir.
    await vaciarCola()
    const dia = await traerDia(key)
    if (!dia) return
    const meals = repartirEnComidas(MEAL_DEFAULTS, dia.entries)
    set({
      meals,
      waterGlasses: dia.waterGlasses,
      streak: dia.streak,
      ...computeTotals(meals) })
    await AsyncStorage.setItem(
      `nutrition_${key}`,
      JSON.stringify({ meals, waterGlasses: dia.waterGlasses, streak: dia.streak }),
    )
  },

  /**
   * Sube a Supabase el histórico que ya esté en el teléfono. Una sola vez por
   * instalación; el `clientId` hace que reintentarla no duplique nada.
   */
  migrar: async () => migrarHistorico(),

  loadToday: async () => {
    const key = todayKey()
    try {
      const raw = await AsyncStorage.getItem(`nutrition_${key}`)
      if (raw) {
        const saved = JSON.parse(raw)
        set({ ...saved, date: key, ...computeTotals(saved.meals ?? MEAL_DEFAULTS) })
        void get().sincronizar()
      } else {
        // Check streak from yesterday
        const yRaw = await AsyncStorage.getItem(`nutrition_${haceDias(1)}`)
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
    // Optimista: la pantalla ya respondió. Si no hay red, esto cae a la cola.
    void sincronizarEntradas(get().date, [aNuevaEntrada(mealId as MealSlotId, entry)])
  },

  addEntries: (entriesByMeal) => {
    const meals = get().meals.map(m => {
      const toAdd = entriesByMeal[m.id]
      return toAdd?.length ? { ...m, entries: [...m.entries, ...toAdd] } : m
    })
    set({ meals, ...computeTotals(meals) })
    get().save()
    const lote = Object.entries(entriesByMeal).flatMap(([slot, es]) =>
      (es ?? []).map(e => aNuevaEntrada(slot as MealSlotId, e)),
    )
    void sincronizarEntradas(get().date, lote)
  },

  removeEntry: (mealId, entryId) => {
    const previa = get().meals.find(m => m.id === mealId)?.entries.find(e => e.id === entryId)
    const meals = get().meals.map(m =>
      m.id === mealId ? { ...m, entries: m.entries.filter(e => e.id !== entryId) } : m
    )
    set({ meals, ...computeTotals(meals) })
    get().save()
    if (previa?.serverId) {
      void eliminarEnServidor(previa.serverId).catch(() => {})
    } else {
      // Nunca llegó al servidor: puede seguir en la cola esperando red. Si no
      // se saca de ahí, se subiría luego y reaparecería al sincronizar.
      void olvidarPendiente(entryId)
    }
  },

  toggleEntryActive: (mealId, entryId) => {
    const meals = get().meals.map(m =>
      m.id === mealId
        ? { ...m, entries: m.entries.map(e => e.id === entryId ? { ...e, active: e.active === false } : e) }
        : m
    )
    set({ meals, ...computeTotals(meals) })
    get().save()
    const tras = meals.find(m => m.id === mealId)?.entries.find(e => e.id === entryId)
    if (tras?.serverId) {
      void actualizarEnServidor(tras.serverId, { active: tras.active !== false }).catch(() => {})
    }
  },

  addWater: () => {
    const w = get().waterGlasses + 1
    set({ waterGlasses: w })
    get().save()
    void sincronizarDia(get().date, { waterGlasses: w })
  },

  removeWater: () => {
    const w = Math.max(0, get().waterGlasses - 1)
    set({ waterGlasses: w })
    get().save()
    void sincronizarDia(get().date, { waterGlasses: w })
  },

  save: async () => {
    const { date, meals, waterGlasses, streak } = get()
    const newStreak = get().totalCalories > 0 ? 1 : 0
    await AsyncStorage.setItem(`nutrition_${date}`, JSON.stringify({ meals, waterGlasses, streak: newStreak }))
  } }))
