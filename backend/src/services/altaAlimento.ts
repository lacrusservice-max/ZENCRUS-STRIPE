/**
 * DAR DE ALTA UN ALIMENTO QUE NO ESTÁ EN EL CATÁLOGO
 * ──────────────────────────────────────────────────
 * Cuando alguien pide registrar algo que el catálogo propio no tiene, se busca
 * en una fuente verificada y, si aparece, se guarda aquí para siempre.
 *
 * ── Por qué se guarda, y no solo se usa ─────────────────────────────────────
 * Es el efecto red del §4: cada alimento se da de alta UNA vez, para todos. El
 * segundo usuario que busque «cochinita pibil» ya no depende de que la fuente
 * externa esté disponible, ni de que responda igual, ni de que siga
 * existiendo. El catálogo propio es el activo; la fuente externa es de dónde se
 * llenó.
 *
 * Hasta ahora un alimento de FatSecret se usaba y se tiraba: el usuario lo
 * registraba, los valores quedaban copiados en su diario y el alimento no
 * entraba en ninguna parte. El siguiente que lo buscara volvía a preguntarle a
 * FatSecret.
 *
 * ── El duplicado es el riesgo real ──────────────────────────────────────────
 * Sin comprobación, en seis meses el buscador tiene «Chilaquiles verdes»,
 * «chilaquiles con salsa verde» y «Chilaquiles Verdes con Pollo» como tres
 * alimentos distintos y deja de servir. Aquí se aplica la primera capa del §4
 * —nombre normalizado— antes de insertar nada: si ya existe, se devuelve el que
 * hay en vez de crear otro.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import type { FatSecretFood } from './fatsecretService'

/** Los cinco nutrientes que la app usa para todo. Los ids son de `nutrients`. */
const NUTRIENTE = { energy: 1, protein: 2, carbs: 3, fat: 4, fiber: 7 } as const

/** Código de la fuente en `food_sources`. Se crea sola la primera vez. */
const FUENTE_CODIGO = 'fatsecret'

/**
 * Normalización del §4, capa 1: minúsculas, sin acentos, sin espacios de más.
 *
 * Es lo mínimo que evita que «Chilaquiles Verdes» y «chilaquiles  verdes»
 * entren como dos alimentos.
 */
export const normalizarNombre = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

let idFuente: number | null = null

/** La fila de `food_sources` para FatSecret, creándola si aún no existe. */
async function fuenteFatSecret(): Promise<number | null> {
  if (idFuente !== null) return idFuente

  const { data } = await supabase
    .from('food_sources').select('id').eq('code', FUENTE_CODIGO).maybeSingle()

  if (data?.id) { idFuente = data.id; return idFuente }

  const { data: nueva, error } = await supabase
    .from('food_sources')
    .insert({
      code: FUENTE_CODIGO,
      name: 'FatSecret Platform API',
      url: 'https://platform.fatsecret.com',
      license: 'Uso bajo licencia de la API',
      attribution: 'FatSecret Platform API',
      // No es una tabla oficial de composición como el SMAE o el USDA: es una
      // base comunitaria. Se marca como no oficial y con la prioridad más baja
      // para que el buscador prefiera siempre las verificadas.
      official: false,
      priority: 90,
    })
    .select('id').single()

  if (error) { logger.error('fuenteFatSecret:', error.message); return null }
  idFuente = nueva.id
  return idFuente
}

export interface AltaResultado {
  /** El id interno del alimento, listo para registrar. */
  foodId: string
  nombre: string
  /** true si se creó ahora; false si ya estaba y se reutilizó. */
  creado: boolean
}

/**
 * Deja el alimento en el catálogo propio y devuelve su id interno.
 *
 * Si ya existe uno con el mismo nombre normalizado, NO crea otro: devuelve el
 * que hay. Es la diferencia entre un catálogo que crece y uno que se ensucia.
 */
export async function darDeAltaAlimento(f: FatSecretFood): Promise<AltaResultado | null> {
  const nombre = f.brand ? `${f.name} (${f.brand})` : f.name
  const normalizado = normalizarNombre(nombre)

  const { data: existente } = await supabase
    .from('foods').select('id, name').eq('name_normalized', normalizado).maybeSingle()

  if (existente) {
    return { foodId: existente.id, nombre: existente.name, creado: false }
  }

  const sourceId = await fuenteFatSecret()
  if (sourceId === null) return null

  const { data: creado, error } = await supabase
    .from('foods')
    .insert({
      source_id: sourceId,
      source_food_id: f.id,
      name: nombre,
      name_normalized: normalizado,
      lang: 'es',
      country: 'MX',
      brand: f.brand ?? null,
      /**
       * `kind` alimenta la métrica de ultraprocesados del §2 y aquí no hay con
       * qué decidirlo: la fuente externa no clasifica por grado de procesado.
       *
       * La columna es NOT NULL y su enum solo admite natural, procesado,
       * ultraprocesado y restaurante — no hay «desconocido» y añadirlo pide una
       * migración. Se pone `procesado`, que es el valor del medio: no regala un
       * «natural» que haría parecer mejor la dieta de quien lo registre, ni
       * acusa con un «ultraprocesado» sin haberlo comprobado.
       *
       * Y para que esa etiqueta de relleno no ensucie la métrica, estos
       * alimentos quedan con `verified: false` y `consultar_progreso` los deja
       * fuera del cálculo. La marca es fiable: los 10.611 alimentos que ya
       * había son todos verificados.
       */
      kind: 'procesado',
      base_unit: 'g',
      verified: false,
    })
    .select('id, name').single()

  if (error) {
    logger.error(`darDeAltaAlimento("${nombre}"):`, error.message)
    return null
  }

  const filas = [
    { food_id: creado.id, nutrient_id: NUTRIENTE.energy, amount: f.per100.calories },
    { food_id: creado.id, nutrient_id: NUTRIENTE.protein, amount: f.per100.protein },
    { food_id: creado.id, nutrient_id: NUTRIENTE.carbs, amount: f.per100.carbs },
    { food_id: creado.id, nutrient_id: NUTRIENTE.fat, amount: f.per100.fat },
    { food_id: creado.id, nutrient_id: NUTRIENTE.fiber, amount: f.per100.fiber },
  ]

  const { error: eNut } = await supabase.from('food_nutrients').insert(filas)
  if (eNut) {
    // Un alimento sin energía no sirve para registrar y además desaparece del
    // buscador, que lo descarta. Mejor deshacerlo que dejar una ficha muda.
    logger.error(`darDeAltaAlimento nutrientes("${nombre}"):`, eNut.message)
    await supabase.from('foods').delete().eq('id', creado.id)
    return null
  }

  // Las raciones que declare la fuente («1 taza», «1 pieza»): son lo que
  // permite que alguien apunte en piezas sin tener que pesar nada.
  const porciones = (f.servings ?? [])
    .filter(s => Number(s.grams) > 0)
    .slice(0, 8)
    .map((s, i) => ({
      food_id: creado.id,
      description: String(s.description ?? 'porción').slice(0, 120),
      amount: 1,
      gram_weight: Number(s.grams),
      seq: i + 1,
      is_derived: false,
    }))

  if (porciones.length) {
    const { error: ePor } = await supabase.from('food_portions').insert(porciones)
    // Las porciones son un extra: sin ellas el alimento sigue sirviendo.
    if (ePor) logger.error(`darDeAltaAlimento porciones("${nombre}"):`, ePor.message)
  }

  logger.info(`Catálogo: alta de "${nombre}" desde FatSecret (${f.id})`)
  return { foodId: creado.id, nombre: creado.name, creado: true }
}
