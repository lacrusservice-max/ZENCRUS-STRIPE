/**
 * Escalado de porciones e impacto sobre el presupuesto de la comida.
 *
 * Espejo exacto de `frontend/src/utils/portionScale.ts` — la app y la web
 * tienen que dar el mismo número al ajustar una porción. Los tests viven en
 * el proyecto móvil; cualquier cambio aquí debe replicarse allá.
 */

export interface FoodBase {
  name: string
  /** Valores nutricionales para `amount` unidades. */
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  amount: number
  unit: string
}

export interface ScaledFood {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  amount: number
  unit: string
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Escala un alimento a la cantidad indicada.
 * `targetAmount` va en las mismas unidades que `base.amount`.
 */
export function scaleFood(base: FoodBase, targetAmount: number): ScaledFood {
  const amount = Math.max(0, targetAmount)
  const factor = base.amount > 0 ? amount / base.amount : 0
  return {
    calories: Math.round(base.calories * factor),
    protein: r1(base.protein * factor),
    carbs: r1(base.carbs * factor),
    fat: r1(base.fat * factor),
    fiber: r1((base.fiber ?? 0) * factor),
    amount: Math.round(amount),
    unit: base.unit,
  }
}

export interface AddImpact {
  /** Total de la comida si se agrega. */
  total: number
  /** Presupuesto de la comida. */
  budget: number
  /** Cuánto se pasa del presupuesto (0 si cabe). */
  over: number
  /** Cuánto queda libre (0 si se pasa). */
  remaining: number
  /** Proporción del presupuesto ocupada por lo ya registrado, 0..1. */
  currentPct: number
  /** Proporción que aporta lo que se va a agregar, 0..1 sobre el total. */
  addingPct: number
  /** true si el total supera el presupuesto. */
  exceeds: boolean
}

/**
 * Cómo queda el presupuesto de la comida al agregar cierta cantidad de kcal.
 */
export function computeAddImpact(
  currentMealKcal: number,
  budget: number,
  addingKcal: number,
): AddImpact {
  const current = Math.max(0, currentMealKcal)
  const adding = Math.max(0, addingKcal)
  const b = Math.max(0, budget)
  const total = current + adding

  const over = Math.max(0, total - b)
  const remaining = Math.max(0, b - total)
  const denom = Math.max(total, b, 1)

  return {
    total,
    budget: b,
    over,
    remaining,
    currentPct: current / denom,
    addingPct: adding / denom,
    exceeds: total > b,
  }
}

/**
 * Cantidad exacta que haría caber el alimento sin pasarse del presupuesto.
 *
 * Se compara contra la porción que el usuario tiene puesta ahora mismo
 * (`currentAmount`), no contra la porción base del catálogo: si subió el dial
 * a 160 g y se pasa, hay que proponerle bajar aunque los 100 g de base sí
 * cupieran. Devuelve null cuando la porción actual ya cabe o cuando no cabe
 * ni la unidad mínima.
 */
export function suggestPortionFix(
  base: FoodBase,
  currentMealKcal: number,
  budget: number,
  currentAmount?: number,
): number | null {
  const room = budget - currentMealKcal
  if (room <= 0) return null
  if (base.amount <= 0 || base.calories <= 0) return null

  const kcalPerUnit = base.calories / base.amount
  const fits = Math.floor(room / kcalPerUnit)
  if (fits <= 0) return null

  const amount = currentAmount ?? base.amount
  // Si lo que hay puesto ya cabe, no hay nada que sugerir.
  if (fits >= amount) return null
  return fits
}

/**
 * Rango del dial de gramos: arranca en la porción base y da margen para
 * duplicarla, redondeando a una escala legible.
 */
export function dialRange(base: FoodBase): { min: number; max: number; step: number } {
  const a = base.amount > 0 ? base.amount : 100
  const max = Math.max(a * 2, a + 50)
  const step = a >= 100 ? 5 : a >= 20 ? 1 : 0.5
  return { min: 0, max: Math.round(max), step }
}
