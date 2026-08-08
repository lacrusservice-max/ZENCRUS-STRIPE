import api from './api'
import { FOOD_DB } from '@/data/foodDb'

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
 * Fuzzy-match simple contra el catálogo local.
 *
 * Tiene dos usos: respaldo cuando falla la llamada al backend, y vista previa
 * inmediata mientras se escribe. Al ser síncrono y sin red, sirve para mostrar
 * qué se está entendiendo antes de confirmar; el backend luego lo refina.
 * Lo que no reconoce vuelve con macros en 0, marcado para completar en revisión.
 */
export function localParseFoodList(mealsText: MealTextInput): ParsedFoodsByMeal {
  const out: ParsedFoodsByMeal = {}
  for (const [mealId, text] of Object.entries(mealsText)) {
    if (!text?.trim()) { out[mealId] = []; continue }
    out[mealId] = text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const clean = line.replace(/^[-•]\s*/, '')
      const lower = clean.toLowerCase()
      const match = FOOD_DB.find(f => lower.includes(f.name.toLowerCase().split(' (')[0]))
      if (match) {
        return {
          name: match.name.split(' (')[0],
          amount: match.amount,
          unit: match.unit,
          calories: match.calories,
          protein: match.protein,
          carbs: match.carbs,
          fat: match.fat,
          fiber: match.fiber,
          emoji: guessEmoji(match.name),
        }
      }
      // No match — se agrega tal cual con macros en 0 para que el usuario los complete en la confirmación.
      return {
        name: clean.charAt(0).toUpperCase() + clean.slice(1),
        amount: 100,
        unit: 'g',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        emoji: guessEmoji(clean),
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
