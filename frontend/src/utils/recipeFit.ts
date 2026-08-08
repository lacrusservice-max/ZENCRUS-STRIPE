/**
 * ENCAJE DE RECETA · ZENCRUS
 * ══════════════════════════
 *
 * Responde «¿qué cocino ahora?» en vez de «¿qué recetas tengo?». Puntúa cada
 * receta contra lo que queda del día —kilocalorías libres y macros pendientes—
 * y devuelve además la razón en palabras, porque un número de encaje sin
 * explicación no ayuda a decidir.
 *
 * ── Criterio ────────────────────────────────────────────────────────────────
 * Pesa más cubrir el macro que va corto que llenar las kcal: si faltan 48 g de
 * proteína, una receta de 480 kcal con 38 g gana a otra de 620 kcal con 12 g,
 * aunque la segunda aproveche mejor el margen. Pasarse del margen penaliza,
 * pero no descalifica: el día se cierra con lo que hay, no con lo ideal.
 */

export interface DayRemaining {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface FitInput {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface FitResult {
  /** 0 a 100. Por encima de 60 se considera que encaja. */
  score: number
  fits: boolean
  /** Frase corta que explica el porqué, para imprimir sobre la tarjeta. */
  reason: string
  /** Fracción del déficit de proteína que cubre la receta (0 a 1). */
  proteinCover: number
  /** Kcal que se pasarían del margen; 0 si cabe. */
  overBy: number
}

/** Recorta a [0, 1]. */
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)

export function scoreFit(recipe: FitInput, left: DayRemaining): FitResult {
  const overBy = Math.max(0, recipe.calories - left.kcal)

  // Cuánto del hueco de proteína cierra.
  const proteinCover = left.protein > 0 ? clamp01(recipe.protein / left.protein) : 1

  // Cuánto del margen calórico aprovecha sin pasarse. Llenarlo del todo puntúa
  // más que dejarlo a medias, pero pasarse resta.
  const kcalUse = left.kcal > 0 ? clamp01(recipe.calories / left.kcal) : 0
  const overPenalty = left.kcal > 0 ? clamp01(overBy / left.kcal) : 0

  const score = Math.round(
    100 * clamp01(proteinCover * 0.55 + kcalUse * 0.45 - overPenalty * 0.5),
  )

  let reason: string
  if (overBy > 0) {
    reason = `Se pasa ${Math.round(overBy)} kcal de lo que te queda`
  } else if (proteinCover >= 0.6) {
    reason = `Cubre el ${Math.round(proteinCover * 100)} % de la proteína que te falta`
  } else if (kcalUse >= 0.6) {
    reason = `Aprovecha ${Math.round(recipe.calories)} de tus ${Math.round(left.kcal)} kcal libres`
  } else {
    reason = `Ligera: ${Math.round(recipe.calories)} kcal, te deja margen`
  }

  return { score, fits: score >= 60 && overBy === 0, reason, proteinCover, overBy }
}

/**
 * Ingredientes de la receta que no están en la despensa.
 *
 * El cotejo es laxo a propósito —basta que una contenga a la otra— porque la
 * despensa guarda «brócoli» y la receta pide «brócoli al vapor». Exigir
 * igualdad exacta marcaría como faltante casi todo.
 */
export function missingIngredients(
  ingredients: { name: string }[],
  pantry: string[],
): string[] {
  const have = pantry.map(p => p.trim().toLowerCase()).filter(Boolean)
  return ingredients
    .filter(ing => {
      const n = ing.name.trim().toLowerCase()
      return !have.some(h => n.includes(h) || h.includes(n))
    })
    .map(ing => ing.name)
}
