/**
 * Presupuesto calórico por comida.
 *
 * Fitia y compañía solo muestran el total del día. Aquí cada comida tiene su
 * propio presupuesto, y cuando te pasas en una, el sobrante se descuenta de las
 * que faltan — que es lo que un nutriólogo haría de verdad.
 *
 * Lógica pura, sin dependencias de React: se puede testear y se reusa igual en
 * la app móvil y en la web.
 */

export type MealStatus = 'ok' | 'under' | 'over' | 'pending'

export interface MealInput {
  id: string
  label: string
  /** Calorías realmente consumidas. 0 = aún no registrada. */
  consumed: number
  /** Cuántas entradas tiene. 0 => la comida sigue pendiente. */
  entryCount: number
}

export interface MealBudget {
  id: string
  label: string
  consumed: number
  /** Presupuesto ya ajustado por lo que pasó en comidas anteriores. */
  budget: number
  /** Presupuesto original antes de cualquier ajuste. */
  baseBudget: number
  status: MealStatus
  /** consumed - budget. Positivo = te pasaste. */
  delta: number
  /** 0..1 para pintar la barra. Se satura en 1. */
  fill: number
}

/**
 * Reparto por defecto del día. Suma 1.
 * Las claves son prefijos de id: 'breakfast', 'lunch', 'dinner', 'snack'.
 */
const DEFAULT_SHARE: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.27,
  snack: 0.13,
}

function shareFor(id: string): number {
  if (id.startsWith('snack')) return DEFAULT_SHARE.snack
  return DEFAULT_SHARE[id] ?? DEFAULT_SHARE.snack
}

/** Umbral bajo el cual consideramos que una comida se quedó corta de verdad. */
const UNDER_TOLERANCE = 0.85

/**
 * Reparte el objetivo calórico entre las comidas y ajusta las pendientes
 * según lo que ya se consumió.
 *
 * @param meals  comidas del día, en el orden en que se comen
 * @param targetCalories  meta calórica del día
 */
export function computeMealBudgets(
  meals: MealInput[],
  targetCalories: number,
): MealBudget[] {
  if (meals.length === 0) return []

  const target = Math.max(0, targetCalories)

  // 1. Reparto base — normalizado para que siempre sume el objetivo completo,
  //    da igual cuántos slots de snack tenga configurados el usuario.
  const rawShares = meals.map(m => shareFor(m.id))
  const shareSum = rawShares.reduce((a, b) => a + b, 0) || 1
  const baseBudgets = rawShares.map(s => Math.round((s / shareSum) * target))

  // 2. Cuánto se lleva consumido y cuánto presupuesto queda por repartir
  //    entre las comidas que siguen pendientes.
  const isPending = (m: MealInput) => m.entryCount === 0
  const consumedTotal = meals.reduce((a, m) => a + m.consumed, 0)
  const pendingIdx = meals.map((m, i) => (isPending(m) ? i : -1)).filter(i => i >= 0)

  const remainingForDay = Math.max(0, target - consumedTotal)
  const pendingBaseSum = pendingIdx.reduce((a, i) => a + baseBudgets[i], 0)

  return meals.map((m, i) => {
    const baseBudget = baseBudgets[i]
    let budget = baseBudget

    if (isPending(m) && pendingIdx.length > 0) {
      // Repartimos lo que realmente queda del día, en proporción al peso
      // original de cada comida pendiente.
      budget = pendingBaseSum > 0
        ? Math.round((baseBudget / pendingBaseSum) * remainingForDay)
        : Math.round(remainingForDay / pendingIdx.length)
    }

    const delta = m.consumed - budget
    let status: MealStatus
    if (isPending(m)) status = 'pending'
    else if (m.consumed > budget) status = 'over'
    else if (budget > 0 && m.consumed < budget * UNDER_TOLERANCE) status = 'under'
    else status = 'ok'

    const fill = budget > 0 ? Math.min(m.consumed / budget, 1) : 0

    return { id: m.id, label: m.label, consumed: m.consumed, budget, baseBudget, status, delta, fill }
  })
}

/**
 * Frase corta para la etiqueta de estado de una comida.
 * Devuelve null cuando no hay nada que decir.
 */
export function describeMealStatus(b: MealBudget): string | null {
  switch (b.status) {
    case 'over':
      return `${Math.abs(b.delta)} kcal por encima`
    case 'under':
      return `Te sobraron ${Math.abs(b.delta)} kcal`
    case 'ok':
      return b.delta === 0 ? 'Exacto' : `Dentro · te sobraron ${Math.abs(b.delta)} kcal`
    case 'pending':
      return b.budget > 0 ? `Presupuesto de ${b.budget} kcal` : null
    default:
      return null
  }
}

/**
 * Mensaje de ZENA sobre el ajuste del día. Solo habla cuando hay algo
 * accionable: una comida se pasó y quedan comidas por registrar.
 */
export function buildCoachNote(
  budgets: MealBudget[],
  proteinGap: number,
): string | null {
  const over = budgets.find(b => b.status === 'over')
  const pending = budgets.filter(b => b.status === 'pending')

  if (pending.length === 0) {
    return 'Cerraste todas tus comidas del día. Buen trabajo.'
  }

  // Cuando hay exceso, el ajuste lo absorbe la comida pendiente con más
  // presupuesto: es donde el recorte se nota de verdad.
  if (over) {
    const absorber = [...pending].sort((a, b) => b.budget - a.budget)[0]
    return `${over.label} se te fue ${Math.abs(over.delta)} kcal, así que ajusté ` +
      `${absorber.label.toLowerCase()} a ${absorber.budget} kcal. Sigues dentro de meta.`
  }

  // Sin exceso, hablamos de la SIGUIENTE comida por registrar (orden del día),
  // no de la más grande — es la que el usuario va a resolver ahora y la misma
  // que ofrece el botón de acción.
  const next = pending[0]
  if (proteinGap > 0) {
    // La proteína que toca a esa comida es su parte proporcional del hueco
    // restante, no la meta del día entero.
    const pendingBudgetSum = pending.reduce((a, b) => a + b.budget, 0)
    const share = pendingBudgetSum > 0 ? next.budget / pendingBudgetSum : 1 / pending.length
    const mealProtein = Math.round(proteinGap * share)
    if (mealProtein > 0) {
      return `Te quedan ${next.budget} kcal para ${next.label.toLowerCase()}. ` +
        `Apunta a unos ${mealProtein} g de proteína ahí para ir al día.`
    }
  }
  return `Te quedan ${next.budget} kcal para ${next.label.toLowerCase()}.`
}
