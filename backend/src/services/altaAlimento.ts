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
 *
 * ── Dos entradas, dos maneras de no duplicar ────────────────────────────────
 * Desde el escáner entra también lo que devuelve Open Food Facts, y ahí la
 * regla del nombre NO sirve: dos presentaciones del mismo refresco se llaman
 * igual y son productos distintos, con códigos, pesos y fichas distintas.
 * Deduplicar por nombre fundiría la lata de 355 ml con la botella de 600 y
 * dejaría a la mitad de la gente apuntando la cantidad que no es.
 *
 * Un código de barras identifica un producto sin ambigüedad, así que ese es el
 * criterio para lo que llega escaneado. Cada función usa el suyo:
 *
 *   darDeAltaAlimento      (FatSecret)         → por nombre normalizado
 *   darDeAltaProductoOFF   (Open Food Facts)   → por código de barras
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import type { FatSecretFood } from './fatsecretService'
import { variantesDe, type ProductoOFF } from './openFoodFacts'

/** Los cinco nutrientes que la app usa para todo. Los ids son de `nutrients`. */
const NUTRIENTE = { energy: 1, protein: 2, carbs: 3, fat: 4, fiber: 7 } as const

/** Códigos de fuente en `food_sources`. Se crean solas la primera vez. */
const FUENTE_FATSECRET = 'fatsecret'
const FUENTE_OFF = 'off'
const FUENTE_USUARIO = 'usuario'

/**
 * Normalización del §4, capa 1: minúsculas, sin acentos, sin espacios de más.
 *
 * Es lo mínimo que evita que «Chilaquiles Verdes» y «chilaquiles  verdes»
 * entren como dos alimentos.
 */
export const normalizarNombre = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Los ids de `food_sources`, resueltos una vez por proceso.
 *
 * Era una variable suelta para FatSecret; con dos fuentes pasa a mapa. Si la
 * fila no existe se crea con su licencia y su atribución: la ODbL de Open Food
 * Facts obliga a citar de dónde salen los datos, y tenerlo en la fila de la
 * fuente —y no repetido en cada alimento— es lo que permite separar después lo
 * de OFF de lo del SMAE sin adivinar nada.
 */
const idsDeFuente = new Map<string, number>()

const PLANTILLAS: Record<string, Record<string, unknown>> = {
  [FUENTE_FATSECRET]: {
    name: 'FatSecret Platform API',
    url: 'https://platform.fatsecret.com',
    license: 'Uso bajo licencia de la API',
    attribution: 'FatSecret Platform API',
    // No es una tabla oficial de composición como el SMAE o el USDA: es una
    // base comunitaria. Se marca como no oficial y con la prioridad más baja
    // para que el buscador prefiera siempre las verificadas.
    official: false,
    priority: 90,
  },
  [FUENTE_OFF]: {
    name: 'Open Food Facts',
    url: 'https://world.openfoodfacts.org',
    license: 'ODbL 1.0',
    attribution: 'Open Food Facts contributors — ODbL',
    official: false,
    priority: 95,
  },
  /* Separada de 'off' a propósito: la licencia ODbL cubre lo que viene de Open
     Food Facts, no lo que escribe un usuario nuestro leyendo una etiqueta. Sin
     dos filas distintas no se podrían separar después. */
  [FUENTE_USUARIO]: {
    name: 'Aportado por la comunidad ZENCRUS',
    url: null,
    license: 'Uso interno',
    attribution: 'Comunidad ZENCRUS',
    official: false,
    priority: 99,
  },
}

async function idDeFuente(codigo: string): Promise<number | null> {
  const guardado = idsDeFuente.get(codigo)
  if (guardado !== undefined) return guardado

  const { data } = await supabase
    .from('food_sources').select('id').eq('code', codigo).maybeSingle()

  if (data?.id) { idsDeFuente.set(codigo, data.id); return data.id }

  const { data: nueva, error } = await supabase
    .from('food_sources')
    .insert({ code: codigo, ...PLANTILLAS[codigo] })
    .select('id').single()

  if (error) { logger.error(`idDeFuente(${codigo}):`, error.message); return null }
  idsDeFuente.set(codigo, nueva.id)
  return nueva.id
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

  const sourceId = await idDeFuente(FUENTE_FATSECRET)
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

// ── Open Food Facts ───────────────────────────────────────────────────────────

/**
 * «Nutella (Nutella)».
 *
 * Eso es lo que salía al pegar la marca detrás del nombre sin mirar: en Open
 * Food Facts hay miles de productos cuyo `product_name` YA empieza por la
 * marca —Nutella, Coca-Cola, Nesquik— porque es como se llaman. La marca se
 * añade solo cuando aporta algo que el nombre no dice.
 */
function nombreConMarca(nombre: string, marca?: string): string {
  if (!marca) return nombre
  const n = normalizarNombre(nombre)
  const m = normalizarNombre(marca)
  if (!m || n.includes(m)) return nombre
  return `${nombre} (${marca})`
}

/**
 * DEJAR EN CASA LO QUE SE TRAJO DE LA CALLE
 * ═════════════════════════════════════════
 * Guarda en el catálogo propio un producto que devolvió Open Food Facts.
 *
 * Es la mitad que le faltaba al escáner. Sin esto, cada lectura salía a
 * internet, se copiaba en el diario de esa persona y se tiraba: el mismo yogur,
 * el mismo código y la misma consulta otra vez al día siguiente, y el segundo
 * usuario dependiendo de que la API de OFF estuviera despierta.
 *
 * Con esto, un producto se consulta fuera UNA vez —la primera que alguien,
 * quien sea, lo escanea— y a partir de ahí vive en Supabase. Es el mismo efecto
 * red del §4 que ya explica la cabecera de este fichero, pero con un disparador
 * mucho más frecuente: escanear es un gesto de todos los días.
 *
 * ── Lo que NO se hereda de la fuente ────────────────────────────────────────
 * El sello de verificado. Open Food Facts es la única fuente gratuita que sabe
 * qué hay dentro de un envase y por eso está aquí, pero sus fichas las escribe
 * cualquiera con el móvil en el súper, sin revisión. Entra con `verified:
 * false`, con prioridad por debajo del SMAE y del USDA, y con su atribución en
 * la fila de la fuente. El usuario tiene que poder distinguirlo.
 *
 * ── Por qué no bloquea la respuesta ─────────────────────────────────────────
 * Quien la llama no espera el resultado. La persona ya tiene su producto en
 * pantalla; que además quede guardado para los demás es trabajo de fondo, y
 * hacerle esperar dos escrituras en Supabase para eso sería cobrarle a él la
 * factura del bien común.
 */
export async function darDeAltaProductoOFF(
  p: ProductoOFF,
  opciones: { pais?: string } = {},
): Promise<AltaResultado | null> {
  const codigo = p.codigo.replace(/\D/g, '')
  if (!codigo) return null

  /* El duplicado se mira por CÓDIGO, no por nombre. La lata de 355 ml y la
     botella de 600 se llaman las dos «Coca-Cola» y son productos distintos:
     fundirlas dejaría a la mitad de la gente apuntando la cantidad que no es.
     Se comprueban todas las formas del código por lo mismo que en la lectura
     —UPC-A de doce contra EAN-13 de trece—. */
  const variantes = variantesDe(codigo)
  const { data: existente } = await supabase
    .from('foods').select('id, name').in('barcode', variantes).limit(1)

  if (existente?.[0]) {
    return { foodId: existente[0].id, nombre: existente[0].name, creado: false }
  }

  const sourceId = await idDeFuente(FUENTE_OFF)
  if (sourceId === null) return null

  const nombre = nombreConMarca(p.nombre, p.marca)

  const { data: creado, error } = await supabase
    .from('foods')
    .insert({
      source_id: sourceId,
      // El código ES el identificador en el origen: así `foods_source_unique`
      // (source_id, source_food_id) impide por sí sola una segunda fila para
      // el mismo producto, aunque dos peticiones lleguen a la vez.
      source_food_id: codigo,
      barcode: codigo,
      name: nombre,
      name_normalized: normalizarNombre(nombre),
      lang: 'es',
      country: opciones.pais ?? null,
      brand: p.marca ?? null,
      image_url: p.imagenUrl ?? null,
      /* Todo lo que lleva código de barras viene en un envase. `procesado` es
         el valor honesto del medio: no regala un «natural» que mejoraría la
         métrica del §2 de quien lo registre, ni acusa de «ultraprocesado» sin
         haberlo comprobado. Al ir con `verified: false`, el cálculo de
         progreso lo deja fuera igualmente. */
      kind: 'procesado',
      base_unit: 'g',
      verified: false,
    })
    .select('id, name').single()

  if (error) {
    /* 23505 es la violación de clave única: otro escaneo del mismo producto se
       adelantó por milisegundos. No es un fallo — es exactamente lo que la
       restricción tenía que impedir. Se devuelve el que ganó. */
    if ((error as any).code === '23505') {
      const { data: ganador } = await supabase
        .from('foods').select('id, name').in('barcode', variantes).limit(1)
      if (ganador?.[0]) {
        return { foodId: ganador[0].id, nombre: ganador[0].name, creado: false }
      }
    }
    logger.error(`darDeAltaProductoOFF("${nombre}"):`, error.message)
    return null
  }

  const ok = await guardarNutrientes(creado.id, p.per100, nombre)
  if (!ok) return null

  if (p.racion) {
    const { error: ePor } = await supabase.from('food_portions').insert({
      food_id: creado.id,
      description: p.racion.description.slice(0, 120),
      amount: 1,
      gram_weight: p.racion.grams,
      seq: 1,
      is_derived: false,
    })
    // La ración es un extra: sin ella el alimento se registra igual en gramos.
    if (ePor) logger.error(`darDeAltaProductoOFF ración("${nombre}"):`, ePor.message)
  }

  logger.info(`Catálogo: alta de "${nombre}" desde Open Food Facts (${codigo})`)
  return { foodId: creado.id, nombre: creado.name, creado: true }
}

/**
 * Los cinco nutrientes de un alimento recién creado.
 *
 * Si fallan se DESHACE el alta: un alimento sin energía no sirve para registrar
 * y además desaparece del buscador, que lo descarta. Mejor no dejar la ficha
 * muda que dejarla y que alguien se tropiece con ella.
 */
async function guardarNutrientes(
  foodId: string,
  per100: { calories: number; protein: number; carbs: number; fat: number; fiber: number },
  nombre: string,
): Promise<boolean> {
  const { error } = await supabase.from('food_nutrients').insert([
    { food_id: foodId, nutrient_id: NUTRIENTE.energy, amount: per100.calories },
    { food_id: foodId, nutrient_id: NUTRIENTE.protein, amount: per100.protein },
    { food_id: foodId, nutrient_id: NUTRIENTE.carbs, amount: per100.carbs },
    { food_id: foodId, nutrient_id: NUTRIENTE.fat, amount: per100.fat },
    { food_id: foodId, nutrient_id: NUTRIENTE.fiber, amount: per100.fiber },
  ])

  if (error) {
    logger.error(`nutrientes("${nombre}"):`, error.message)
    await supabase.from('foods').delete().eq('id', foodId)
    return false
  }
  return true
}

// ── Aportado por quien lo tiene en la mano ────────────────────────────────────

/** Lo que una persona teclea leyendo la etiqueta de un envase. */
export interface AporteDeUsuario {
  codigo: string
  nombre: string
  marca?: string
  per100: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  racion?: { description: string; grams: number }
}

/**
 * EL HUECO QUE RELLENA UNO LO RELLENA PARA TODOS
 * ══════════════════════════════════════════════
 * Da de alta un producto que no está en ninguna fuente, con los valores que ha
 * leído de la etiqueta la persona que lo tiene delante.
 *
 * ── Por qué esto es lo importante de todo el escáner ────────────────────────
 * Open Food Facts tiene 17.469 productos que se venden en México. Un Walmart
 * tiene bastantes más, y las marcas locales no están casi ninguna. Sin esta
 * puerta, la respuesta a lo que falta es «no lo tenemos» y ahí se acaba: el
 * catálogo no crece nunca y cada usuario se topa con el mismo hueco.
 *
 * Con ella, el primero que escanea un producto que falta lo da de alta en
 * treinta segundos —tiene el envase en la mano y la tabla nutricional a la
 * vista— y el segundo ya lo encuentra hecho. Es el mismo efecto red del §4 que
 * explica la cabecera de este fichero, pero con el disparador más frecuente que
 * hay: el hueco aparece justo cuando alguien puede taparlo.
 *
 * ── Lo que NO se hace ───────────────────────────────────────────────────────
 * Fiarse. Entra con `verified: false`, con la prioridad más baja de todas y con
 * `created_by`, para que el día que haya que limpiar se sepa a quién preguntar
 * y se pueda retirar de golpe todo lo de una cuenta que resultara ser un
 * problema. Y los valores se comprueban antes: ver `aporteCoherente`.
 */
export async function darDeAltaAporte(
  a: AporteDeUsuario,
  usuarioId: string,
): Promise<AltaResultado | null> {
  const codigo = a.codigo.replace(/\D/g, '')
  if (!codigo) return null

  // Que no se cuele algo que otro acaba de dar de alta, o que llegó de OFF
  // entre que se abrió el formulario y se envió.
  const variantes = variantesDe(codigo)
  const { data: existente } = await supabase
    .from('foods').select('id, name').in('barcode', variantes).limit(1)

  if (existente?.[0]) {
    return { foodId: existente[0].id, nombre: existente[0].name, creado: false }
  }

  const sourceId = await idDeFuente(FUENTE_USUARIO)
  if (sourceId === null) return null

  const nombre = nombreConMarca(a.nombre.trim(), a.marca?.trim())

  const { data: creado, error } = await supabase
    .from('foods')
    .insert({
      source_id: sourceId,
      source_food_id: codigo,
      barcode: codigo,
      name: nombre,
      name_normalized: normalizarNombre(nombre),
      lang: 'es',
      country: 'MX',
      brand: a.marca?.trim() || null,
      kind: 'procesado',
      base_unit: 'g',
      verified: false,
      created_by: usuarioId,
    })
    .select('id, name').single()

  if (error) {
    if ((error as any).code === '23505') {
      const { data: ganador } = await supabase
        .from('foods').select('id, name').in('barcode', variantes).limit(1)
      if (ganador?.[0]) {
        return { foodId: ganador[0].id, nombre: ganador[0].name, creado: false }
      }
    }
    logger.error(`darDeAltaAporte("${nombre}"):`, error.message)
    return null
  }

  const ok = await guardarNutrientes(creado.id, a.per100, nombre)
  if (!ok) return null

  if (a.racion && a.racion.grams > 0) {
    const { error: ePor } = await supabase.from('food_portions').insert({
      food_id: creado.id,
      description: a.racion.description.slice(0, 120),
      amount: 1,
      gram_weight: a.racion.grams,
      seq: 1,
      is_derived: false,
    })
    if (ePor) logger.error(`darDeAltaAporte ración("${nombre}"):`, ePor.message)
  }

  logger.info(`Catálogo: "${nombre}" (${codigo}) aportado por ${usuarioId}`)
  return { foodId: creado.id, nombre: creado.name, creado: true }
}

/**
 * ¿Se sostienen estos números?
 *
 * No es desconfianza del usuario: es que un dedo resbala. Teclear 5390 donde
 * ponía 539 mete en el catálogo de TODOS una ficha que dice que cien gramos de
 * crema de avellanas son cinco mil kilocalorías, y quien la registre después se
 * comerá el error sin saber de dónde vino.
 *
 * Dos comprobaciones, las dos con margen ancho — la idea es cazar el dedo
 * resbalado, no discutirle a nadie su etiqueta:
 *
 *   · Techo físico. Ni la grasa pura llega a 900 kcal/100 g. Y los macros no
 *     pueden sumar más de 100 g dentro de 100 g de producto.
 *   · Que la energía cuadre con los macros. Proteína y carbohidratos aportan 4
 *     kcal/g y la grasa 9. Se admite un 30 % de desviación, que cubre de sobra
 *     el alcohol, los polialcoholes, la fibra y los redondeos de la etiqueta.
 */
export function aporteCoherente(
  per100: { calories: number; protein: number; carbs: number; fat: number; fiber: number },
): { ok: true } | { ok: false; motivo: string } {
  const { calories, protein, carbs, fat, fiber } = per100

  if (!(calories > 0)) return { ok: false, motivo: 'Falta la energía por 100 g.' }
  if (calories > 900) return { ok: false, motivo: 'Más de 900 kcal por 100 g no es posible: revisa si ese valor es por ración.' }
  if ([protein, carbs, fat, fiber].some(v => v < 0)) return { ok: false, motivo: 'Ningún macronutriente puede ser negativo.' }

  const gramos = protein + carbs + fat
  if (gramos > 100) return { ok: false, motivo: 'Los macros suman más de 100 g dentro de 100 g de producto.' }

  const deMacros = protein * 4 + carbs * 4 + fat * 9
  // Con muy pocas kcal, cualquier redondeo es un porcentaje enorme. Se exige
  // el cuadre solo cuando hay energía suficiente para que signifique algo.
  if (calories >= 40 && deMacros > 0) {
    const desvio = Math.abs(deMacros - calories) / calories
    if (desvio > 0.3) {
      return {
        ok: false,
        motivo: `Los macros dan ${Math.round(deMacros)} kcal y la etiqueta dice ${Math.round(calories)}. Revisa los valores.`,
      }
    }
  }

  return { ok: true }
}
