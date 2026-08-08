import { create } from "zustand";

// Espejo de frontend/src/store/nutritionStore.ts — misma forma de datos,
// misma lógica de totales y de activar/desactivar sin borrar.

export interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  amount: number;
  unit: string;
  timestamp: number;
  /** Si es false, el alimento se queda visible pero sale de los totales. Default true. */
  active?: boolean;
}

export interface MealSlot {
  id: "breakfast" | "lunch" | "dinner" | "snack1" | "snack2" | "snack3";
  label: string;
  emoji: string;
  entries: FoodEntry[];
}

const MEAL_DEFAULTS: MealSlot[] = [
  { id: "breakfast", label: "Desayuno", emoji: "🥣", entries: [] },
  { id: "lunch",     label: "Almuerzo", emoji: "🍗", entries: [] },
  { id: "dinner",    label: "Cena",     emoji: "🌙", entries: [] },
  { id: "snack1",    label: "Snack",    emoji: "🥜", entries: [] },
];

interface NutritionState {
  date: string;
  meals: MealSlot[];

  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;

  loadToday: () => void;
  setMeals: (meals: MealSlot[]) => void;
  addEntry: (mealId: string, entry: FoodEntry) => void;
  addEntries: (entriesByMeal: Record<string, FoodEntry[]>) => void;
  removeEntry: (mealId: string, entryId: string) => void;
  toggleEntryActive: (mealId: string, entryId: string) => void;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function computeTotals(meals: MealSlot[]) {
  let cal = 0, prot = 0, carbs = 0, fat = 0, fiber = 0;
  meals.forEach((m) => m.entries.forEach((e) => {
    if (e.active === false) return;
    cal += e.calories; prot += e.protein; carbs += e.carbs; fat += e.fat; fiber += e.fiber;
  }));
  return {
    totalCalories: Math.round(cal),
    totalProtein: Math.round(prot),
    totalCarbs: Math.round(carbs),
    totalFat: Math.round(fat),
    totalFiber: Math.round(fiber),
  };
}

function save(date: string, meals: MealSlot[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`zencrus_nutrition_${date}`, JSON.stringify({ meals }));
  } catch {}
}

export const useNutritionStore = create<NutritionState>((set, get) => ({
  date: todayKey(),
  meals: MEAL_DEFAULTS,
  totalCalories: 0,
  totalProtein: 0,
  totalCarbs: 0,
  totalFat: 0,
  totalFiber: 0,

  loadToday: () => {
    if (typeof window === "undefined") return;
    const key = todayKey();
    try {
      const raw = localStorage.getItem(`zencrus_nutrition_${key}`);
      const meals: MealSlot[] = raw ? JSON.parse(raw).meals : MEAL_DEFAULTS;
      set({ date: key, meals, ...computeTotals(meals) });
    } catch {
      set({ date: key, meals: MEAL_DEFAULTS, ...computeTotals(MEAL_DEFAULTS) });
    }
  },

  /** Reemplaza las comidas del día — usado al cargar el plan generado por IA. */
  setMeals: (meals) => {
    set({ meals, ...computeTotals(meals) });
    save(get().date, meals);
  },

  addEntry: (mealId, entry) => {
    const meals = get().meals.map((m) =>
      m.id === mealId ? { ...m, entries: [...m.entries, entry] } : m);
    set({ meals, ...computeTotals(meals) });
    save(get().date, meals);
  },

  addEntries: (entriesByMeal) => {
    const meals = get().meals.map((m) => {
      const toAdd = entriesByMeal[m.id];
      return toAdd?.length ? { ...m, entries: [...m.entries, ...toAdd] } : m;
    });
    set({ meals, ...computeTotals(meals) });
    save(get().date, meals);
  },

  removeEntry: (mealId, entryId) => {
    const meals = get().meals.map((m) =>
      m.id === mealId ? { ...m, entries: m.entries.filter((e) => e.id !== entryId) } : m);
    set({ meals, ...computeTotals(meals) });
    save(get().date, meals);
  },

  toggleEntryActive: (mealId, entryId) => {
    const meals = get().meals.map((m) =>
      m.id === mealId
        ? { ...m, entries: m.entries.map((e) => e.id === entryId ? { ...e, active: e.active === false } : e) }
        : m);
    set({ meals, ...computeTotals(meals) });
    save(get().date, meals);
  },
}));
