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
 * Es la fuente PRIMARIA de búsqueda. Reemplazó a la BÚSQUEDA POR TEXTO de Open
 * Food Facts, que devolvía marcas regionales de cualquier país antes que el
 * alimento genérico que la persona esperaba.
 *
 * ── Y desde el escáner, la tabla ya no es solo oficial ──────────────────────
 * Cada código de barras que alguien lee entra en `foods` con la fuente `off`
 * (ver `altaAlimento.ts`). Es lo que hace que la base crezca sola y que el
 * segundo que escanee ese yogur no dependa de que Open Food Facts conteste.
 *
 * Pero significa que aquí conviven tablas oficiales de composición con fichas
 * que escribe cualquiera, y eso obliga a dos cosas que antes no hacían falta:
 * `verified` sale de la FUENTE y no de la columna, y el orden hunde lo no
 * oficial por debajo de lo oficial. Un producto escaneado tiene que poder
 * encontrarse por su nombre; lo que no puede es adelantar al SMAE.
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
  /**
   * Ya NO es siempre `true`.
   *
   * Lo era mientras la tabla `foods` solo tuviera USDA, SMAE e INCMNSZ. Desde
   * que el escáner da de alta lo que encuentra en Open Food Facts, en la misma
   * tabla conviven tablas oficiales de composición y fichas que escribe
   * cualquiera con el móvil en el súper. Devolver `true` para las dos cosas
   * ponía el distintivo de verificado sobre datos sin curar.
   */
  verified: boolean
  sourceLabel: string
  /** El código del envase, cuando el alimento es un producto de marca. */
  barcode?: string
  /** Foto del envase. Hoy solo la traen las fichas de Open Food Facts. */
  imageUrl?: string
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
  // Base comunitaria: se etiqueta como tal para que se distinga de las
  // tablas oficiales de composición.
  fatsecret: 'Base comunitaria',
  off: 'Open Food Facts',
  // Lo que aporta la gente leyendo etiquetas. Se nombra para que se vea que no
  // sale de ninguna tabla de composición.
  usuario: 'Aportado por la comunidad',
}

/**
 * Las fuentes que son tablas oficiales de composición.
 *
 * Solo estas llevan el distintivo de verificado. Open Food Facts es utilísimo
 * —es la única fuente gratuita que sabe qué hay dentro de un envase— y no es lo
 * mismo: lo escribe la gente, sin revisión. El usuario tiene que poder
 * distinguirlo de un vistazo.
 */
const FUENTES_OFICIALES = new Set([
  'usda_sr', 'usda_fnd', 'usda_brand', 'smae_5ed', 'incmnsz_2015',
])

interface SearchHit { food_id: string; score: number }

async function rpcSearch(q: string, limit: number): Promise<SearchHit[]> {
  const { data, error } = await supabase.rpc('search_foods', { q, max_rows: limit })
  if (error) {
    logger.error(`Catálogo · búsqueda "${q}": ${error.message}`)
    return []
  }
  return (data ?? []) as SearchHit[]
}

/** Fuentes con los alimentos como se comen y se nombran en México. */
const FUENTES_ES = new Set(['smae_5ed', 'incmnsz_2015'])

/**
 * LO MEXICANO DELANTE, A IGUALDAD DE CONSULTA
 * ═══════════════════════════════════════════
 * `search_foods()` ordena por parecido con lo tecleado y no sabe en qué idioma
 * está escrito lo que devuelve. Buscando «tortilla», eso daba esto:
 *
 *     1. Tortillas, ready-to-bake or -fry, flour, refrigerated   (USDA)
 *     2. Tortilla                                                (SMAE)
 *     3. Tortilla, blue corn, Sakwavikaviki (Hopi)               (USDA)
 *     4. Tortilla, includes plain and from mutton sandwich (Navajo)
 *
 * Una tortilla hopi de maíz azul y otra de cordero navajo por delante de la
 * tortilla, en una app que se usa en México. No es un fallo de la búsqueda: los
 * cuatro nombres empiezan igual y el sistema hace lo que le pidieron.
 *
 * Se estabiliza el orden metiendo el criterio que faltaba: entre dos alimentos
 * que casan parecido, gana el de la tabla mexicana — que además es la que trae
 * las medidas caseras («1 pieza», «½ taza») en lugar de gramos sueltos.
 *
 * Solo se aplica a la consulta EN ESPAÑOL. La de reserva en inglés se concatena
 * después y ya va detrás por construcción; reordenarla sería empujar hacia
 * arriba fichas estadounidenses justo cuando se pidieron a propósito.
 *
 * Dentro de cada grupo se respeta el orden que trae la búsqueda: `sort` en
 * JavaScript es estable, así que devolver 0 en el empate conserva la relevancia.
 */
async function enEspañolPrimero(hits: SearchHit[]): Promise<SearchHit[]> {
  if (hits.length < 2) return hits

  const { data, error } = await supabase
    .from('foods')
    .select('id, source:food_sources ( code )')
    .in('id', hits.map(h => h.food_id))

  // Si no se puede saber la fuente, se deja el orden tal cual: peor sería
  // inventarse uno.
  if (error || !data) return hits

  /**
   * Tres escalones, no dos.
   *
   *   0. Tablas mexicanas — SMAE e INCMNSZ. Los alimentos como se comen y se
   *      llaman aquí, y con medidas caseras.
   *   1. Las demás tablas oficiales — USDA. Datos buenos, nombres en inglés.
   *   2. Todo lo no oficial — Open Food Facts, FatSecret. Útil, sin revisar.
   *
   * El tercer escalón entró con el escáner. Sin él, los miles de productos de
   * marca que se van dando de alta competirían de tú a tú con el SMAE: buscar
   * «leche» devolvería catorce cartones de supermercado antes que la leche
   * entera de la tabla de composición.
   */
  const escalon = new Map<string, number>(
    data.map((r: any) => {
      const code = r.source?.code ?? ''
      return [r.id, FUENTES_ES.has(code) ? 0 : FUENTES_OFICIALES.has(code) ? 1 : 2]
    }),
  )
  return [...hits].sort((a, b) =>
    (escalon.get(a.food_id) ?? 2) - (escalon.get(b.food_id) ?? 2))
}

/**
 * MIRAR EN CASA ANTES DE SALIR A LA CALLE
 * ═══════════════════════════════════════
 * Busca un producto por su código de barras en el catálogo propio.
 *
 * Es el primer escalón del escáner, y el que hace que la base sea de verdad una
 * base: sin esto, leer el mismo yogur cada mañana salía a internet cada mañana.
 * Con esto, sale una vez en la vida —la primera que alguien, cualquiera, lo
 * escanea— y a partir de ahí contesta Supabase en un viaje.
 *
 * ── Se prueban todas las formas del código ──────────────────────────────────
 * Recibe la lista ya expandida por `variantesDe`, no un código suelto. Un
 * producto americano puede estar guardado con sus doce dígitos de UPC-A y el
 * lector de iOS entrega siempre trece: buscar solo lo escaneado no encontraría
 * lo que está ahí al lado. `.in()` las mira todas en una sola consulta, que
 * además es la que aprovecha `idx_foods_barcode`.
 */
export async function catalogoPorCodigo(variantes: string[]): Promise<CatalogFood | null> {
  if (variantes.length === 0) return null

  const { data, error } = await supabase
    .from('foods')
    .select(`
      id, name, brand, verified, barcode, image_url,
      source:food_sources ( code ),
      food_nutrients ( amount, nutrient:nutrients ( code ) ),
      food_portions ( description, gram_weight )
    `)
    .in('barcode', variantes)
    .limit(1)

  if (error) {
    // Que la consulta local falle no puede costar el escaneo: quien llama
    // sigue con las fuentes externas.
    logger.error(`Catálogo · código ${variantes[0]}: ${error.message}`)
    return null
  }

  const r: any = data?.[0]
  if (!r) return null

  const amt: Record<string, number> = {}
  for (const fn of r.food_nutrients ?? []) {
    const code = fn.nutrient?.code
    if (code) amt[code] = Number(fn.amount)
  }
  // La misma regla de siempre: sin energía no sirve para registrar. Una ficha
  // muda guardada por error no puede convertirse en un cero en el diario.
  if (!amt.energy) return null

  const sourceCode = r.source?.code ?? ''
  return {
    id: r.id,
    name: r.name,
    brand: r.brand ?? undefined,
    verified: FUENTES_OFICIALES.has(sourceCode),
    sourceLabel: SOURCE_LABELS[sourceCode] ?? sourceCode,
    barcode: r.barcode ?? undefined,
    imageUrl: r.image_url ?? undefined,
    per100: {
      calories: Math.round(amt.energy),
      protein: round1(amt.protein ?? 0),
      carbs: round1(amt.carbs ?? 0),
      fat: round1(amt.fat ?? 0),
      fiber: round1(amt.fiber ?? 0),
    },
    servings: (r.food_portions ?? [])
      .map((p: any) => ({ description: p.description, grams: Number(p.gram_weight) }))
      .filter((x: CatalogServing) => x.grams > 0),
  }
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

  let ordered = await enEspañolPrimero(await rpcSearch(q, limit))

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
      id, name, brand, verified, barcode, image_url,
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
      /* Manda la FUENTE, no la columna. `verified` de la fila es un dato de la
         ingesta y podría venir a true en algo que no lo es; la lista de tablas
         oficiales es la que decide quién lleva el sello. */
      verified: FUENTES_OFICIALES.has(sourceCode),
      sourceLabel: SOURCE_LABELS[sourceCode] ?? sourceCode,
      barcode: r.barcode ?? undefined,
      imageUrl: r.image_url ?? undefined,
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
      id, name, brand, verified, barcode, image_url,
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
    verified: FUENTES_OFICIALES.has(sourceCode),
    sourceLabel: SOURCE_LABELS[sourceCode] ?? sourceCode,
    barcode: r.barcode ?? undefined,
    imageUrl: r.image_url ?? undefined,
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
