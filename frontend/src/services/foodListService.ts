import api from './api'
import { searchLocal } from './foodApi'
import { scaleMacros, resolveUnit, esUnidad } from '@/utils/units'

export interface ParsedFood {
  name: string
  amount: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  emoji: string
}

export type MealTextInput = Partial<Record<'breakfast' | 'lunch' | 'dinner' | 'snack1' | 'snack2' | 'snack3', string>>
export type ParsedFoodsByMeal = Record<string, ParsedFood[]>

const EMOJI_BY_KEYWORD: [RegExp, string][] = [
  [/huevo/i, '🥚'], [/pollo/i, '🍗'], [/carne|res|bistec/i, '🥩'], [/pescado|salm[oó]n|at[uú]n/i, '🐟'],
  [/arroz/i, '🍚'], [/pasta|spaghetti|espagueti/i, '🍝'], [/pan|tortilla/i, '🍞'], [/avena/i, '🥣'],
  [/pl[aá]tano|banana/i, '🍌'], [/manzana/i, '🍎'], [/fruta/i, '🍓'], [/leche|yogur/i, '🥛'],
  [/queso/i, '🧀'], [/frijol|leguminosa/i, '🫘'], [/verdura|ensalada|br[oó]coli|espinaca/i, '🥦'],
  [/aguacate/i, '🥑'], [/almendra|nuez|cacahuate|man[ií]/i, '🥜'], [/agua/i, '💧'], [/caf[eé]/i, '☕'],
]

function guessEmoji(name: string): string {
  const hit = EMOJI_BY_KEYWORD.find(([re]) => re.test(name))
  return hit?.[1] ?? '🍽️'
}

/**
 * LA CANTIDAD QUE VA DELANTE
 * ══════════════════════════
 * «3 huevos», «200 g de arroz», «2 tazas de leche», «1.5 tazas de avena».
 *
 * Antes esto no se leía en absoluto: la línea se buscaba entera en la tabla y
 * se devolvía la porción de catálogo tal cual, así que «3 huevos» y «un huevo»
 * apuntaban exactamente lo mismo. El número que la persona se había molestado
 * en escribir se tiraba a la basura sin decírselo.
 *
 * Devuelve también el resto de la línea, que es lo que se busca en la tabla:
 * dejar dentro el «200 g de» hace que la comparación falle contra un nombre que
 * sí está.
 */
function leerCantidad(linea: string): { cantidad?: number; unidad?: string; resto: string } {
  const m = linea.match(/^\s*(\d+(?:[.,]\d+)?)\s*([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)?\s*(?:de\s+)?(.*)$/)
  if (!m) return { resto: linea }

  const cantidad = parseFloat(m[1].replace(',', '.'))
  if (!Number.isFinite(cantidad) || cantidad <= 0) return { resto: linea }

  /* Si la palabra de después del número NO es una unidad conocida, forma parte
     del nombre: en «3 huevos» el «huevos» es el alimento, no una medida. Se
     devuelve al resto para no perderlo en la búsqueda. */
  const palabra = (m[2] ?? '').toLowerCase()
  const medida = esUnidad(palabra)
  return {
    cantidad,
    unidad: medida ? resolveUnit(palabra).id : undefined,
    resto: medida ? m[3] : `${m[2] ?? ''} ${m[3]}`.trim(),
  }
}

/**
 * Fuzzy-match contra la base local.
 *
 * Tiene dos usos: respaldo cuando falla la llamada al backend, y vista previa
 * inmediata mientras se escribe. Al ser síncrono y sin red, sirve para mostrar
 * qué se está entendiendo antes de confirmar; el backend luego lo refina.
 * Lo que no reconoce vuelve con macros en 0, marcado para completar en revisión
 * —donde ahora sí hay campos para completarlo, ver `ReviewStage`—.
 *
 * ── Por qué ya no mira a `FOOD_DB` ──────────────────────────────────────────
 * Porque había DOS tablas de alimentos en el proyecto y esta función usaba la
 * mala. `FOOD_DB` tenía 25 entradas, sin sinónimos, y con cifras que ni
 * siquiera coincidían con las de la otra: su atún en agua eran 84 kcal y 20 g
 * de proteína, y el de `GENERIC_FOODS` 116 y 26. El mismo alimento con dos
 * respuestas según por dónde entraras a la app.
 *
 * `GENERIC_FOODS` tiene 138 alimentos, sus nombres alternativos y su orden de
 * prioridad, y es la que ya alimentaba el buscador. `FOOD_DB` se ha borrado:
 * esta era su única llamada.
 */
export function localParseFoodList(mealsText: MealTextInput): ParsedFoodsByMeal {
  const out: ParsedFoodsByMeal = {}
  for (const [mealId, text] of Object.entries(mealsText)) {
    if (!text?.trim()) { out[mealId] = []; continue }
    out[mealId] = text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const limpia = line.replace(/^[-•]\s*/, '')
      const { cantidad, unidad, resto } = leerCantidad(limpia)

      const hit = searchLocal(resto || limpia)[0]
      if (hit) {
        // Lo que escribió la persona manda; el catálogo solo pone lo que falta.
        const amount = cantidad ?? hit.defaultAmount
        const unit = unidad ?? hit.defaultUnit
        const m = scaleMacros(hit.per100, amount, unit, hit.gramsPerPiece)
        return {
          name: hit.name,
          amount,
          unit,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          fiber: m.fiber,
          emoji: hit.emoji || guessEmoji(hit.name),
        }
      }

      // Sin coincidencia: entra con los macros en 0 y marcado para completar.
      // La cantidad que sí se entendió se conserva — es dato de la persona.
      return {
        name: limpia.charAt(0).toUpperCase() + limpia.slice(1),
        amount: cantidad ?? 100,
        unit: unidad ?? 'g',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        emoji: guessEmoji(limpia),
      }
    })
  }
  return out
}

/**
 * Convierte texto libre (un alimento por línea, por comida) a alimentos
 * estructurados vía IA. Si falla la red o el backend, nunca rompe el flujo:
 * cae a un fuzzy-match local contra el catálogo de alimentos.
 */
export async function parseFoodList(mealsText: MealTextInput): Promise<ParsedFoodsByMeal> {
  try {
    const { data } = await api.post('/diet/parse-food-list', mealsText)
    if (data?.success && data.data) return data.data as ParsedFoodsByMeal
    throw new Error('Respuesta inválida')
  } catch {
    return localParseFoodList(mealsText)
  }
}
