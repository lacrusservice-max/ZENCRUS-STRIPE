/**
 * Presupuesto calórico por comida — espejo exacto de
 * `frontend/src/utils/mealBudget.ts`.
 *
 * La app móvil y la web deben calcular idéntico: si el usuario ve 560 kcal de
 * presupuesto para la cena en el teléfono, la web tiene que decir 560.
 * Cualquier cambio aquí debe replicarse allá.
 */

export type MealStatus = "ok" | "under" | "over" | "pending"

export interface MealInput {
  id: string
  label: string
  consumed: number
  entryCount: number
}

export interface MealBudget {
  id: string
  label: string
  consumed: number
  budget: number
  baseBudget: number
  status: MealStatus
  delta: number
  fill: number
}

const DEFAULT_SHARE: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.27,
  snack: 0.13,
}

function shareFor(id: string): number {
  if (id.startsWith("snack")) return DEFAULT_SHARE.snack
  return DEFAULT_SHARE[id] ?? DEFAULT_SHARE.snack
}

const UNDER_TOLERANCE = 0.85

export function computeMealBudgets(
  meals: MealInput[],
  targetCalories: number,
): MealBudget[] {
  if (meals.length === 0) return []

  const target = Math.max(0, targetCalories)

  const rawShares = meals.map((m) => shareFor(m.id))
  const shareSum = rawShares.reduce((a, b) => a + b, 0) || 1
  const baseBudgets = rawShares.map((s) => Math.round((s / shareSum) * target))

  const isPending = (m: MealInput) => m.entryCount === 0
  const consumedTotal = meals.reduce((a, m) => a + m.consumed, 0)
  const pendingIdx = meals.map((m, i) => (isPending(m) ? i : -1)).filter((i) => i >= 0)

  const remainingForDay = Math.max(0, target - consumedTotal)
  const pendingBaseSum = pendingIdx.reduce((a, i) => a + baseBudgets[i], 0)

  return meals.map((m, i) => {
    const baseBudget = baseBudgets[i]
    let budget = baseBudget

    if (isPending(m) && pendingIdx.length > 0) {
      budget =
        pendingBaseSum > 0
          ? Math.round((baseBudget / pendingBaseSum) * remainingForDay)
          : Math.round(remainingForDay / pendingIdx.length)
    }

    const delta = m.consumed - budget
    let status: MealStatus
    if (isPending(m)) status = "pending"
    else if (m.consumed > budget) status = "over"
    else if (budget > 0 && m.consumed < budget * UNDER_TOLERANCE) status = "under"
    else status = "ok"

    const fill = budget > 0 ? Math.min(m.consumed / budget, 1) : 0

    return { id: m.id, label: m.label, consumed: m.consumed, budget, baseBudget, status, delta, fill }
  })
}

export function describeMealStatus(b: MealBudget): string | null {
  switch (b.status) {
    case "over":
      return `${Math.abs(b.delta)} kcal por encima`
    case "under":
      return `Te sobraron ${Math.abs(b.delta)} kcal`
    case "ok":
      return b.delta === 0 ? "Exacto" : `Dentro · te sobraron ${Math.abs(b.delta)} kcal`
    case "pending":
      return b.budget > 0 ? `Presupuesto de ${b.budget} kcal` : null
    default:
      return null
  }
}

export function buildCoachNote(budgets: MealBudget[], proteinGap: number): string | null {
  const over = budgets.find((b) => b.status === "over")
  const pending = budgets.filter((b) => b.status === "pending")

  if (pending.length === 0) {
    return "Cerraste todas tus comidas del día. Buen trabajo."
  }

  if (over) {
    const absorber = [...pending].sort((a, b) => b.budget - a.budget)[0]
    return (
      `${over.label} se te fue ${Math.abs(over.delta)} kcal, así que ajusté ` +
      `${absorber.label.toLowerCase()} a ${absorber.budget} kcal. Sigues dentro de meta.`
    )
  }

  const next = pending[0]
  if (proteinGap > 0) {
    const pendingBudgetSum = pending.reduce((a, b) => a + b.budget, 0)
    const share = pendingBudgetSum > 0 ? next.budget / pendingBudgetSum : 1 / pending.length
    const mealProtein = Math.round(proteinGap * share)
    if (mealProtein > 0) {
      return (
        `Te quedan ${next.budget} kcal para ${next.label.toLowerCase()}. ` +
        `Apunta a unos ${mealProtein} g de proteína ahí para ir al día.`
      )
    }
  }
  return `Te quedan ${next.budget} kcal para ${next.label.toLowerCase()}.`
}
