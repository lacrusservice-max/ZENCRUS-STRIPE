/**
 * MEDIDAS REALES · ZENCRUS
 * ════════════════════════
 *
 * Escalar una receta produce números que nadie puede cocinar: «2.67 huevos»,
 * «1.33 tazas de arroz». Este módulo traduce la cantidad matemática a la medida
 * que de verdad se usa en una cocina y en un supermercado.
 *
 * Dos reglas, según la unidad:
 *
 *   CONTABLES (pieza, rebanada, diente)  se redondean al entero superior. Media
 *   pieza de pollo no se compra, y quedarse corto arruina el plato; sobra mejor
 *   que falta.
 *
 *   FRACCIONABLES (taza, cucharada)      se ajustan al cuarto más cercano, que
 *   es la precisión real de un juego de medidores doméstico.
 *
 * El peso en gramos o mililitros no se toca más allá de redondear: una báscula
 * sí distingue 187 g, y forzarlo a 200 g introduciría un error mayor que el que
 * corrige.
 */

/** Unidades que solo existen en enteros. */
const COUNTABLE = ['pza', 'pieza', 'piezas', 'rebanada', 'rebanadas', 'diente', 'dientes', 'unidad']

/** Unidades de cocina que se manejan en cuartos. */
const FRACTIONAL = ['taza', 'tazas', 'cda', 'cucharada', 'cdta', 'cucharadita']

export interface RealMeasure {
  /** Cantidad ya ajustada, para calcular con ella. */
  amount: number
  /** Cómo se escribe: «3», «1½», «280». */
  label: string
  unit: string
  /** Cantidad exacta antes de ajustar, si hubo ajuste. */
  exact?: number
}

const VULGAR: Record<string, string> = {
  '0.25': '¼', '0.5': '½', '0.75': '¾',
}

/** Convierte 1.5 en «1½» y 0.5 en «½». */
function pretty(n: number): string {
  const whole = Math.floor(n)
  const frac = Math.round((n - whole) * 100) / 100
  const glyph = VULGAR[String(frac)]
  if (!glyph) return String(Math.round(n * 100) / 100)
  return whole === 0 ? glyph : `${whole}${glyph}`
}

export function toRealMeasure(rawAmount: number, unit: string): RealMeasure {
  const u = (unit || '').trim().toLowerCase()
  const exact = Math.round(rawAmount * 100) / 100

  if (COUNTABLE.includes(u)) {
    // Hacia arriba: es preferible que sobre a quedarse sin ingrediente.
    const amount = Math.max(1, Math.ceil(exact))
    return {
      amount,
      label: String(amount),
      unit,
      exact: amount !== exact ? exact : undefined,
    }
  }

  if (FRACTIONAL.includes(u)) {
    const amount = Math.max(0.25, Math.round(exact * 4) / 4)
    return {
      amount,
      label: pretty(amount),
      unit,
      exact: amount !== exact ? exact : undefined,
    }
  }

  // Peso y volumen: la báscula sí tiene esa precisión.
  const amount = Math.round(exact)
  return { amount, label: String(amount), unit }
}

/**
 * Escala una lista de ingredientes a un número de raciones y devuelve cada uno
 * con su medida cocinable. `baseServings` es para cuántas raciones está escrita
 * la receta original.
 */
export function scaleIngredients<T extends { amount: number; unit: string }>(
  ingredients: T[],
  baseServings: number,
  targetServings: number,
): (T & { real: RealMeasure })[] {
  const factor = baseServings > 0 ? targetServings / baseServings : 1
  return ingredients.map(ing => ({
    ...ing,
    real: toRealMeasure(ing.amount * factor, ing.unit),
  }))
}
