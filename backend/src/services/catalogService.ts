/**
 * Catálogo propio de ZENCRUS — fuentes oficiales verificadas.
 *
 * Consulta directamente la base cargada en `006_food_database.sql` y ampliada
 * después por `data-pipeline/load_supabase.py`: 10.611 alimentos en total —
 * 7.756 de USDA FoodData Central SR Legacy y 2.855 del Sistema Mexicano de
 * Alimentos Equivalentes, estos últimos con los micronutrientes del INCMNSZ
 * añadidos donde el cruce entre ambas fuentes resultó verificable. Todos con su
 * fuente y su identificador de origen. Ningún valor se calcula ni se estima
 * aquí: se lee tal cual quedó en la ingesta.
 *
 * Es la fuente PRIMARIA de búsqueda. Reemplaza a Open Food Facts, que se
 * retiró por completo: su catálogo es colaborativo y sin curar, y devolvía
 * productos irrelevantes (marcas regionales de cualquier país) antes que el
 * alimento genérico que la persona esperaba.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import { toEnglish } from './foodTranslate'

export interface CatalogServing {
  description: string
  grams: number
}

export interface CatalogFood {
  id: string
  name: string
  brand?: string
  /** Siempre true: todo lo que sale de aquí viene de una fuente oficial. */
  verified: true
  sourceLabel: string
  per100: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  servings: CatalogServing[]
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Nombre visible de cada fuente, para el distintivo "Verificado · …". */
const SOURCE_LABELS: Record<string, string> = {
  usda_sr: 'USDA FoodData Central',
  usda_fnd: 'USDA FoodData Central',
  usda_brand: 'USDA FoodData Central',
  smae_5ed: 'SMAE · 5.ª edición',
  incmnsz_2015: 'INCMNSZ',
}

interface SearchHit { food_id: string; score: number }

async function rpcSearch(q: string, limit: number): Promise<SearchHit[]> {
  const { data, error } = await supabase.rpc('search_foods', { q, max_rows: limit })
  if (error) {
    logger.error(`Catálogo · búsqueda "${q}": ${error.message}`)
    return []
  }
  return (data ?? []) as SearchHit[]
}

/**
 * Busca en el catálogo propio.
 *
 * Se consulta EN ESPAÑOL primero. Antes se traducía al inglés de entrada,
 * porque el catálogo solo tenía nombres de USDA; desde que están dentro los
 * 2.855 alimentos del SMAE eso quedó al revés: «espinaca» se convertía en
 * «spinach» y devolvía la ficha estadounidense en lugar de la mexicana, que es
 * la que trae las medidas caseras que la persona reconoce («1/2 taza»,
 * «1 pieza»). La traducción sigue ahí como reserva para lo que el SMAE no
 * cubre, que es casi todo el producto de marca.
 *
 * El orden importa y por eso no se mezclan las dos listas de cualquier manera:
 * `search_foods()` ordena por relevancia dentro de UNA llamada, así que
 * concatenar dos deja el segundo bloque siempre detrás por mucho que encaje
 * mejor. Se acepta ese coste solo cuando la primera consulta se queda corta.
 */
export async function searchCatalog(query: string, limit = 30): Promise<CatalogFood[]> {
  const q = query.trim()
  if (q.length < 2) return []

  let ordered = await rpcSearch(q, limit)

  const en = toEnglish(q)
  if (ordered.length < 5 && en && en !== q) {
    const alt = await rpcSearch(en, limit)
    const seen = new Set(ordered.map(h => h.food_id))
    ordered = [...ordered, ...alt.filter(h => !seen.has(h.food_id))].slice(0, limit)
  }
  if (ordered.length === 0) return []

  const ids = ordered.map(h => h.food_id)
  const { data: rows, error } = await supabase
    .from('foods')
    .select(`
      id, name, brand, verified,
      source:food_sources ( code ),
      food_nutrients ( amount, nutrient:nutrients ( code ) ),
      food_portions ( description, gram_weight )
    `)
    .in('id', ids)

  if (error) {
    logger.error(`Catálogo · detalle: ${error.message}`)
    return []
  }

  const byId = new Map((rows ?? []).map((r: any) => [r.id, r]))
  const out: CatalogFood[] = []

  for (const hit of ordered) {
    const r: any = byId.get(hit.food_id)
    if (!r) continue

    const amt: Record<string, number> = {}
    for (const fn of r.food_nutrients ?? []) {
      const code = fn.nutrient?.code
      if (code) amt[code] = Number(fn.amount)
    }
    // Sin energía no sirve para registrar una comida — no se inventa un valor.
    if (!amt.energy) continue

    const sourceCode = r.source?.code ?? ''
    out.push({
      id: r.id,
      name: r.name,
      brand: r.brand ?? undefined,
      verified: true,
      sourceLabel: SOURCE_LABELS[sourceCode] ?? sourceCode,
      per100: {
        calories: Math.round(amt.energy),
        protein: round1(amt.protein ?? 0),
        carbs: round1(amt.carbs ?? 0),
        fat: round1(amt.fat ?? 0),
        fiber: round1(amt.fiber ?? 0),
      },
      servings: (r.food_portions ?? [])
        .map((p: any) => ({ description: p.description, grams: Number(p.gram_weight) }))
        .filter((s: CatalogServing) => s.grams > 0),
    })
  }

  return out
}

/** Detalle de un alimento del catálogo por su id interno (uuid). */
export async function getCatalogFoodById(id: string): Promise<CatalogFood | null> {
  const { data, error } = await supabase
    .from('foods')
    .select(`
      id, name, brand, verified,
      source:food_sources ( code ),
      food_nutrients ( amount, nutrient:nutrients ( code ) ),
      food_portions ( description, gram_weight )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null

  const r: any = data
  const amt: Record<string, number> = {}
  for (const fn of r.food_nutrients ?? []) {
    const code = fn.nutrient?.code
    if (code) amt[code] = Number(fn.amount)
  }
  if (!amt.energy) return null

  const sourceCode = r.source?.code ?? ''
  return {
    id: r.id,
    name: r.name,
    brand: r.brand ?? undefined,
    verified: true,
    sourceLabel: SOURCE_LABELS[sourceCode] ?? sourceCode,
    per100: {
      calories: Math.round(amt.energy),
      protein: round1(amt.protein ?? 0),
      carbs: round1(amt.carbs ?? 0),
      fat: round1(amt.fat ?? 0),
      fiber: round1(amt.fiber ?? 0),
    },
    servings: (r.food_portions ?? [])
      .map((p: any) => ({ description: p.description, grams: Number(p.gram_weight) }))
      .filter((s: CatalogServing) => s.grams > 0),
  }
}
