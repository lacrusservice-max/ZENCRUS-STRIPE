/**
 * ALTA DE PLATILLOS POR DESCOMPOSICIÓN — §4, nivel 4
 * ══════════════════════════════════════════════════
 *
 * El catálogo tiene ingredientes y le faltan platillos. Alguien pide
 * «cochinita pibil», no está, y hasta ahora ahí se acababa todo: ZENA decía
 * que no lo encontraba y el catálogo seguía sin tenerlo mañana.
 *
 *
 * DE DÓNDE SALEN LOS NÚMEROS — lo único importante de este archivo
 * ───────────────────────────────────────────────────────────────
 * NO se le pregunta al modelo cuántas calorías tiene la cochinita. El §4 es
 * tajante: «la IA no verifica, estima» — devolvería un número que suena bien y
 * que no tiene fuente.
 *
 * Se le pregunta DE QUÉ ESTÁ HECHA. Eso sí lo sabe, y es verificable a ojo por
 * cualquiera. Los ingredientes se buscan en el catálogo, con sus valores
 * medidos de SMAE o USDA, y las calorías salen de sumar. El modelo aporta la
 * receta y ni un solo número.
 *
 * De ahí que `componerPlatillo` NO acepte macros como parámetro. No es un
 * descuido: si los aceptara, bastaría un día flojo del modelo para meter en el
 * catálogo —para todos los usuarios, permanentemente— unas calorías inventadas.
 * La única forma de que eso no pase es que no exista el hueco por donde
 * entrarían. Es el principio rector del §1 aplicado a una firma de función.
 *
 *
 * QUÉ HEREDA EL PLATILLO
 * ──────────────────────
 * Su credibilidad es la de sus ingredientes: nivel 4 del §4, «Calculado», por
 * debajo de una tabla oficial y por encima de una estimación. Nace con
 * `verified: false` y entra en la cola de revisión — el §4 lo quiere así hasta
 * que se confirme con registros reales o lo firme la nutrióloga.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import { getCatalogFoodById, type CatalogFood } from './catalogService'
import { normalizarNombre } from './altaAlimento'

/** Los cinco nutrientes que la app usa para todo. Ids de `nutrients`. */
const NUTRIENTE = { energy: 1, protein: 2, carbs: 3, fat: 4, fiber: 7 } as const

const FUENTE_CODIGO = 'calculado'

// ── Límites de cordura ────────────────────────────────────────────────────────
// No son burocracia: son lo que separa una receta de un dedazo. Un platillo
// con un ingrediente no es un platillo; uno con 4 kg no es una ración.

const MIN_INGREDIENTES = 2
const MAX_INGREDIENTES = 15
const MAX_GRAMOS_INGREDIENTE = 3000
const MIN_GRAMOS_TOTAL = 20
const MAX_GRAMOS_TOTAL = 5000

/**
 * Un platillo de comida de verdad cae entre estos dos números por 100 g.
 *
 * Por debajo de 15 kcal/100 g solo hay caldo y verdura hervida; por encima de
 * 800 solo hay aceite y frutos secos. Si el cálculo se sale, lo que falla no es
 * el platillo: son los gramos que dio el modelo —confundir la ración entera con
 * los 100 g es el error clásico— y meterlo así contaminaría el catálogo de
 * todos.
 */
const KCAL_MIN_100 = 15
const KCAL_MAX_100 = 800

export interface IngredienteReceta {
  food_id: string
  gramos: number
}

export interface PlatilloCompuesto {
  foodId: string
  nombre: string
  /** false cuando ya existía y se reutilizó, que es lo normal a partir del segundo. */
  creado: boolean
  per100: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  porcionG: number
  receta: Array<{ nombre: string; gramos: number }>
}

/** Lo que salió mal, en palabras que ZENA pueda repetirle al usuario. */
export interface Fallo { error: string }

const esFallo = (r: unknown): r is Fallo =>
  typeof r === 'object' && r !== null && 'error' in r

const round1 = (n: number) => Math.round(n * 10) / 10

let idFuente: number | null = null

async function fuenteCalculado(): Promise<number | null> {
  if (idFuente !== null) return idFuente
  const { data, error } = await supabase
    .from('food_sources').select('id').eq('code', FUENTE_CODIGO).maybeSingle()
  if (error || !data) {
    logger.error(`No existe la fuente «${FUENTE_CODIGO}»: falta la migración 015`)
    return null
  }
  idFuente = data.id
  return idFuente
}

/**
 * El grado de procesado del platillo es el de su ingrediente más procesado.
 *
 * Unos chilaquiles con totopos de bolsa no son «naturales» porque el pollo lo
 * sea. Se coge el peor porque la métrica de ultraprocesados del §2 tiene que
 * pecar de prudente: inflarla a la baja haría parecer mejor la dieta de quien
 * lo registre, que es justo lo contrario de para lo que existe.
 */
const ESCALA: Record<string, number> = {
  natural: 0, receta: 1, procesado: 2, marca: 3, restaurante: 3, ultraprocesado: 4,
}
const DESDE_ESCALA = ['natural', 'receta', 'procesado', 'ultraprocesado', 'ultraprocesado']

async function tipoDelPlatillo(ids: string[]): Promise<string> {
  const { data } = await supabase.from('foods').select('kind').in('id', ids)
  const peor = Math.max(0, ...(data ?? []).map(f => ESCALA[f.kind as string] ?? 1))
  // Un compuesto de cosas naturales sigue siendo una receta, no un ingrediente.
  return peor <= 1 ? 'receta' : (DESDE_ESCALA[peor] ?? 'procesado')
}

/**
 * Crea el platillo en el catálogo a partir de su receta, o devuelve el que ya
 * estaba.
 *
 * `ingredientes` son ids del catálogo propio: los que devuelve `buscar_alimento`.
 * No se aceptan nombres sueltos a propósito — resolver «pollo» aquí dentro
 * sería volver a elegir por el usuario sin que nadie lo vea.
 */
export async function componerPlatillo(
  nombre: string,
  ingredientes: IngredienteReceta[],
  porcionG?: number,
): Promise<PlatilloCompuesto | Fallo> {
  const limpio = String(nombre ?? '').trim()
  if (limpio.length < 3 || limpio.length > 120) {
    return { error: 'El nombre del platillo no es válido.' }
  }

  if (!Array.isArray(ingredientes) || ingredientes.length < MIN_INGREDIENTES) {
    return {
      error: `Para dar de alta un platillo hacen falta al menos ${MIN_INGREDIENTES} ingredientes. ` +
        'Si es un alimento simple, búscalo en el catálogo en vez de crearlo.',
    }
  }
  if (ingredientes.length > MAX_INGREDIENTES) {
    return { error: `Son demasiados ingredientes: como mucho ${MAX_INGREDIENTES}. Quédate con los que aportan.` }
  }

  // ── Capa 1 y 2 del §4: normalizar y mirar si ya está ──────────────────────
  // Antes de calcular nada. Crear el segundo «chilaquiles verdes» es más caro
  // de arreglar que no crearlo.
  const normalizado = normalizarNombre(limpio)
  const { data: existente } = await supabase
    .from('foods').select('id, name').eq('name_normalized', normalizado).maybeSingle()

  if (existente) {
    const ficha = await getCatalogFoodById(existente.id)
    return {
      foodId: existente.id,
      nombre: existente.name,
      creado: false,
      per100: ficha?.per100 ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      porcionG: ficha?.servings?.[0]?.grams ?? 100,
      receta: [],
    }
  }

  // ── Los ingredientes tienen que existir de verdad ─────────────────────────
  const fichas: Array<{ ficha: CatalogFood; gramos: number }> = []
  for (const ing of ingredientes) {
    const gramos = Number(ing?.gramos)
    if (!Number.isFinite(gramos) || gramos <= 0 || gramos > MAX_GRAMOS_INGREDIENTE) {
      return { error: `La cantidad de uno de los ingredientes no es válida (${ing?.gramos}).` }
    }
    const ficha = await getCatalogFoodById(String(ing?.food_id ?? ''))
    if (!ficha) {
      return {
        error: `No encuentro en el catálogo el ingrediente con id ${ing?.food_id}. ` +
          'Búscalo primero con buscar_alimento y usa el id que devuelva.',
      }
    }
    fichas.push({ ficha, gramos })
  }

  // Dos veces el mismo ingrediente rompe la restricción de la base y además es
  // señal de que la receta está mal contada.
  const vistos = new Set(fichas.map(f => f.ficha.id))
  if (vistos.size !== fichas.length) {
    return { error: 'Hay un ingrediente repetido en la receta. Súmalo en una sola línea.' }
  }

  const gramosTotal = fichas.reduce((a, f) => a + f.gramos, 0)
  if (gramosTotal < MIN_GRAMOS_TOTAL || gramosTotal > MAX_GRAMOS_TOTAL) {
    return { error: `La receta suma ${Math.round(gramosTotal)} g, que no es una cantidad razonable para un platillo.` }
  }

  // ── La suma ───────────────────────────────────────────────────────────────
  const total = fichas.reduce((a, { ficha, gramos }) => {
    const factor = gramos / 100
    return {
      calories: a.calories + ficha.per100.calories * factor,
      protein: a.protein + ficha.per100.protein * factor,
      carbs: a.carbs + ficha.per100.carbs * factor,
      fat: a.fat + ficha.per100.fat * factor,
      fiber: a.fiber + ficha.per100.fiber * factor,
    }
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })

  const p = 100 / gramosTotal
  const per100 = {
    calories: Math.round(total.calories * p),
    protein: round1(total.protein * p),
    carbs: round1(total.carbs * p),
    fat: round1(total.fat * p),
    fiber: round1(total.fiber * p),
  }

  if (per100.calories < KCAL_MIN_100 || per100.calories > KCAL_MAX_100) {
    return {
      error: `El cálculo da ${per100.calories} kcal por 100 g, que no cuadra para un platillo. ` +
        'Revisa los gramos de cada ingrediente: tienen que ser los de la receta completa, no los de una ración.',
    }
  }

  const sourceId = await fuenteCalculado()
  if (sourceId === null) return { error: 'No puedo dar de alta alimentos ahora mismo.' }

  const kind = await tipoDelPlatillo(fichas.map(f => f.ficha.id))

  // Una ración razonable. Si no la dan, la receta entera es la ración: es lo
  // que el usuario acaba de describir que se comió.
  const racion = Number.isFinite(Number(porcionG)) && Number(porcionG) > 0
    ? Math.min(Number(porcionG), MAX_GRAMOS_TOTAL)
    : Math.round(gramosTotal)

  const { data: creado, error } = await supabase
    .from('foods')
    .insert({
      source_id: sourceId,
      // Sin id en la fuente original porque no hay fuente original: lo
      // identifica su propio nombre normalizado, que además es único.
      source_food_id: normalizado.slice(0, 120),
      name: limpio,
      name_normalized: normalizado,
      lang: 'es',
      country: 'MX',
      kind,
      base_unit: 'g',
      // Nace sin verificar y con su etiqueta «Calculado» a la vista. El §4 no
      // deja que un platillo calculado se presente como uno medido.
      verified: false,
    })
    .select('id, name').single()

  if (error) {
    logger.error(`componerPlatillo("${limpio}"):`, error.message)
    return { error: 'No se pudo dar de alta el platillo.' }
  }

  const { error: eNut } = await supabase.from('food_nutrients').insert([
    { food_id: creado.id, nutrient_id: NUTRIENTE.energy, amount: per100.calories },
    { food_id: creado.id, nutrient_id: NUTRIENTE.protein, amount: per100.protein },
    { food_id: creado.id, nutrient_id: NUTRIENTE.carbs, amount: per100.carbs },
    { food_id: creado.id, nutrient_id: NUTRIENTE.fat, amount: per100.fat },
    { food_id: creado.id, nutrient_id: NUTRIENTE.fiber, amount: per100.fiber },
  ])
  if (eNut) {
    // Sin energía el alimento no sirve para registrar y el buscador lo
    // descarta. Mejor deshacerlo que dejar una ficha muda en el catálogo.
    logger.error(`componerPlatillo nutrientes("${limpio}"):`, eNut.message)
    await supabase.from('foods').delete().eq('id', creado.id)
    return { error: 'No se pudo dar de alta el platillo.' }
  }

  // ── La receta, que es lo que hace auditable el número ─────────────────────
  const { error: eRec } = await supabase.from('food_recipes').insert(
    fichas.map((f, i) => ({
      food_id: creado.id,
      ingrediente_id: f.ficha.id,
      gramos: f.gramos,
      seq: i + 1,
    })),
  )
  if (eRec) {
    // Un platillo sin receta es exactamente lo que el §4 no quiere: un número
    // del que ya no se puede saber de dónde salió. Se deshace entero.
    logger.error(`componerPlatillo receta("${limpio}"):`, eRec.message)
    await supabase.from('food_nutrients').delete().eq('food_id', creado.id)
    await supabase.from('foods').delete().eq('id', creado.id)
    return { error: 'No se pudo dar de alta el platillo.' }
  }

  const { error: ePor } = await supabase.from('food_portions').insert({
    food_id: creado.id,
    description: '1 porción',
    amount: 1,
    gram_weight: racion,
    seq: 1,
    is_derived: true,
  })
  // La porción es un extra: sin ella el alimento se registra igual, en gramos.
  if (ePor) logger.error(`componerPlatillo porción("${limpio}"):`, ePor.message)

  logger.info(
    `Catálogo: alta de "${limpio}" por descomposición ` +
    `(${fichas.length} ingredientes, ${per100.calories} kcal/100 g)`,
  )

  return {
    foodId: creado.id,
    nombre: creado.name,
    creado: true,
    per100,
    porcionG: racion,
    receta: fichas.map(f => ({ nombre: f.ficha.name, gramos: f.gramos })),
  }
}

export { esFallo }
