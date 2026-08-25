import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import {
  searchFoods, findByBarcode, getFoodById, isConfigured, FatSecretFood,
} from '../services/fatsecretService'
import {
  searchCatalog, getCatalogFoodById, catalogoPorCodigo, CatalogFood,
} from '../services/catalogService'
import {
  buscarPorCodigo, variantesDe, digitoDeControlValido, ProductoOFF,
} from '../services/openFoodFacts'
import {
  darDeAltaProductoOFF, darDeAltaAporte, aporteCoherente,
} from '../services/altaAlimento'

/**
 * Catálogo de alimentos de ZENCRUS.
 *
 * Dos fuentes, en orden estricto de confianza:
 *
 *   1. Catálogo propio (`catalogService`) — USDA FoodData Central y las demás
 *      fuentes oficiales de la migración 006. Es lo único que lleva el
 *      distintivo "Verificado".
 *   2. FatSecret, vía proxy — rellena cuando el catálogo propio no tiene
 *      suficientes resultados (solo cubre SR Legacy por ahora, ~7.800
 *      alimentos genéricos, sin marcas).
 *
 * Open Food Facts sigue fuera de la BÚSQUEDA POR TEXTO —es colaborativo y sin
 * curar, y devolvía productos de cualquier país sin relación con lo pedido—,
 * pero es la fuente de `/barcode`: ahí el código es una clave exacta y no hay
 * relevancia que acertar. Ver `openFoodFacts.ts`.
 */

export const searchFoodsSchema = z.object({
  query: z.object({
    q: z.string().min(2).max(80),
    region: z.string().length(2).optional(),
  }),
})

export const barcodeSchema = z.object({
  params: z.object({
    code: z.string().regex(/^\d{6,14}$/, 'El código de barras debe tener entre 6 y 14 dígitos'),
  }),
})

export const foodIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
})

/**
 * Lo que la app manda al dar de alta un producto leyendo su etiqueta.
 *
 * Los topes son los del mundo físico, no preferencias: 900 kcal/100 g es más
 * que la grasa pura, y 100 g de un macro dentro de 100 g de producto es el
 * límite aritmético. El cuadre entre energía y macros lo comprueba después
 * `aporteCoherente`, que es donde se puede explicar el porqué al usuario.
 */
export const aporteSchema = z.object({
  body: z.object({
    barcode: z.string().regex(/^\d{6,14}$/, 'El código de barras debe tener entre 6 y 14 dígitos'),
    name: z.string().trim().min(2, 'Ponle un nombre').max(120),
    brand: z.string().trim().max(80).optional(),
    per100: z.object({
      calories: z.number().min(0).max(900),
      protein: z.number().min(0).max(100),
      carbs: z.number().min(0).max(100),
      fat: z.number().min(0).max(100),
      fiber: z.number().min(0).max(100),
    }),
    serving: z.object({
      description: z.string().trim().max(120),
      grams: z.number().min(0).max(5000),
    }).optional(),
  }),
})

/** Umbral por debajo del cual se completa con FatSecret. */
const FILL_THRESHOLD = 8

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

function presentCatalog(f: CatalogFood) {
  return {
    id: `usda:${f.id}`,
    name: f.name,
    brand: f.brand,
    generic: true,
    verified: true,
    sourceLabel: f.sourceLabel,
    per100: f.per100,
    servings: f.servings.map(s => ({ description: s.description, grams: s.grams, calories: 0 })),
  }
}

function presentFatSecret(f: FatSecretFood) {
  return {
    id: `fs:${f.id}`,
    name: f.name,
    brand: f.brand,
    generic: f.type === 'Generic',
    verified: false,
    sourceLabel: undefined,
    per100: f.per100,
    servings: f.servings,
  }
}

/**
 * Un producto de Open Food Facts, en la forma que espera la app.
 *
 * `verified: false` a propósito: el distintivo es para las tablas oficiales de
 * composición, y esto lo escribe quien quiera con el móvil en el súper. Lleva
 * `sourceLabel` para que se vea de dónde sale — que además es lo que pide su
 * licencia ODbL.
 */
function presentOFF(p: ProductoOFF) {
  return {
    id: `off:${p.codigo}`,
    name: p.nombre,
    brand: p.marca,
    generic: false,
    verified: false,
    sourceLabel: 'Open Food Facts',
    imageUrl: p.imagenUrl,
    per100: p.per100,
    // La ración del envase, si la declara: registrar «1 botella» es más
    // natural que teclear los mililitros que trae.
    servings: p.racion ? [{ ...p.racion, calories: 0 }] : [],
  }
}

function fail(res: Response, err: unknown, context: string) {
  const msg = err instanceof Error ? err.message : String(err)

  if (msg === 'FATSECRET_IP_NOT_ALLOWED') {
    logger.error(`${context}: la IP de este servidor no está autorizada en FatSecret`)
    return res.status(503).json({
      success: false,
      message: 'El catálogo de alimentos no está disponible: falta autorizar la IP de este servidor en FatSecret.',
    } satisfies ApiResponse)
  }

  logger.error(`${context}: ${msg}`)
  return res.status(502).json({
    success: false,
    message: 'No se pudo consultar el catálogo de alimentos.',
  } satisfies ApiResponse)
}

export async function search(req: Request, res: Response) {
  const q = String(req.query.q ?? '')
  const region = typeof req.query.region === 'string' ? req.query.region.toUpperCase() : 'MX'

  let catalog: CatalogFood[] = []
  // Se distingue «el catálogo dijo que no hay nada» de «el catálogo no
  // contestó». Son la misma lista vacía y significan lo contrario.
  let catalogoContesto = true
  try {
    catalog = await searchCatalog(q)
  } catch (err) {
    catalogoContesto = false
    logger.error(`Catálogo "${q}": ${err instanceof Error ? err.message : err}`)
  }

  let extra: FatSecretFood[] = []
  if (catalog.length < FILL_THRESHOLD && isConfigured()) {
    try {
      const fs = await searchFoods(q, region)
      const seen = new Set(catalog.map(c => normalize(c.name)))
      extra = fs.filter(f => !seen.has(normalize(f.name)))
    } catch (err) {
      // FatSecret es el relleno, no la fuente principal: si falla, se responde
      // igual con lo que sí dio el catálogo propio en vez de tumbar la búsqueda.
      logger.error(`FatSecret (relleno) "${q}": ${err instanceof Error ? err.message : err}`)
    }
  }

  const data = [...catalog.map(presentCatalog), ...extra.map(presentFatSecret)]

  /**
   * Un 503 solo cuando de verdad no se pudo buscar.
   *
   * Antes esto respondía «el catálogo no está disponible» a CUALQUIER búsqueda
   * sin resultados mientras no hubiera fuente externa configurada — y como en
   * producción no la hay, se lo decía hasta a un `zzzqqxx` que no existe en
   * ninguna base del mundo. Dos consecuencias, las dos malas:
   *
   *   · La app lo trataba como caída, se iba a su lista local de básicos y
   *     enseñaba «lo más parecido». El usuario pedía cochinita y le salía otra
   *     cosa con un aviso de que el catálogo estaba roto. No lo estaba: 2.855
   *     alimentos contestando, simplemente sin ese.
   *   · Y ZENA se quedaba sin el camino del §4: al no llegar la lista, no había
   *     candidato externo que dar de alta, así que el alimento nuevo nunca
   *     entraba al catálogo.
   *
   * Una lista vacía es una respuesta legítima: buscamos y no está. Lo que sí
   * es una caída es que el catálogo propio no conteste, y eso es lo que se
   * mide ahora.
   */
  if (!catalogoContesto && extra.length === 0) {
    return res.status(503).json({
      success: false,
      message: 'El catálogo de alimentos no está disponible en este momento.',
    } satisfies ApiResponse)
  }

  return res.json({ success: true, data } satisfies ApiResponse)
}

/**
 * GET /foods/barcode/:code — qué hay dentro de este envase.
 *
 * ── La cadena, y por qué en este orden ──────────────────────────────────────
 *
 *   1. Catálogo propio      un viaje a Supabase; lo que ya sabemos
 *   2. FatSecret            hoy no contesta nunca (scope de pago)
 *   3. Open Food Facts      la única fuente gratuita que sabe de envases
 *   4. 404
 *
 * El escalón 1 es el que convierte esto en una base de datos en vez de en un
 * proxy. Antes no existía: leer el mismo yogur cada mañana salía a internet
 * cada mañana, y el segundo usuario que escaneara un producto dependía de que
 * la API de OFF estuviera despierta. Ahora un producto se pregunta fuera UNA
 * vez en la vida de la app, y lo que se aprende queda para todos — de eso se
 * encarga `darDeAltaProductoOFF`.
 *
 * ── Lo que había aquí antes de todo esto ────────────────────────────────────
 * Un 404 garantizado. El catálogo no tenía ni un código —los 10.611 alimentos
 * de USDA y del SMAE son genéricos, no productos de marca— y `findByBarcode`
 * devuelve null sin llegar a llamar, porque el scope 'barcode' de FatSecret no
 * entra en la edición gratuita. El escáner leía bien y contestaba siempre lo
 * mismo.
 */
export async function barcode(req: Request, res: Response) {
  const code = String(req.params.code)
  // La consulta admite `region`, pero el catálogo todavía no distingue por
  // país: se deja de leer hasta que haya datos regionales que devolver.

  /*
   * EL DÍGITO DE CONTROL, ANTES DE MOVER UN DEDO
   *
   * Open Food Facts tiene productos de PRUEBA en su base de producción:
   * `9999999999999` no devuelve «no encontrado», devuelve una «Salatgurke» de
   * la marca «TestMarke» con doce kilocalorías. Una ficha falsa pero plausible
   * es justo lo que no puede acabar en el diario de nadie.
   *
   * Ese código falla su suma de verificación —sus doce primeros dígitos exigen
   * un 4 al final, no un 9— y ningún envase real la falla, porque el dígito lo
   * calcula quien imprime la etiqueta. Así que la comprobación descarta lo
   * inventado sin tocar lo legítimo, y encima ahorra la consulta.
   */
  if (!digitoDeControlValido(code)) {
    return res.status(404).json({
      success: false,
      message: 'Ese código no es válido: revisa los dígitos.',
    } satisfies ApiResponse)
  }

  const variantes = variantesDe(code)

  try {
    // 1 · En casa.
    const propio = await catalogoPorCodigo(variantes)
    if (propio) {
      return res.json({ success: true, data: presentCatalog(propio) } satisfies ApiResponse)
    }

    // 2 · FatSecret, por si algún día sube de plan.
    if (isConfigured()) {
      const food = await findByBarcode(code)
      if (food) {
        return res.json({ success: true, data: presentFatSecret(food) } satisfies ApiResponse)
      }
    }

    // 3 · Open Food Facts.
    const off = await buscarPorCodigo(code)
    if (off) {
      /* Sin `await`: la persona ya tiene su producto y no le corresponde
         esperar dos escrituras en Supabase para que quede guardado para los
         demás. Si falla, se apunta y ya — la respuesta no cambia. */
      void darDeAltaProductoOFF(off).catch(err =>
        logger.error(`Alta desde escáner (${off.codigo}): ${err?.message ?? err}`))

      return res.json({ success: true, data: presentOFF(off) } satisfies ApiResponse)
    }

    return res.status(404).json({
      success: false,
      message: 'Ese código de barras no está en el catálogo todavía.',
    } satisfies ApiResponse)
  } catch (err) {
    return fail(res, err, `Código de barras ${code}`)
  }
}


export async function detail(req: Request, res: Response) {
  const id = String(req.params.id)

  try {
    if (id.startsWith('usda:')) {
      const food = await getCatalogFoodById(id.slice(5))
      if (!food) {
        return res.status(404).json({ success: false, message: 'Alimento no encontrado.' } satisfies ApiResponse)
      }
      return res.json({ success: true, data: presentCatalog(food) } satisfies ApiResponse)
    }

    const rawId = id.startsWith('fs:') ? id.slice(3) : id
    const food = await getFoodById(rawId)
    if (!food) {
      return res.status(404).json({ success: false, message: 'Alimento no encontrado.' } satisfies ApiResponse)
    }
    return res.json({ success: true, data: presentFatSecret(food) } satisfies ApiResponse)
  } catch (err) {
    return fail(res, err, `Detalle del alimento ${id}`)
  }
}

/**
 * POST /foods/aportar — dar de alta un producto que no está en ninguna fuente.
 *
 * Es la salida del callejón. Cuando el escáner devuelve 404, la persona que
 * tiene el envase en la mano puede leer su tabla nutricional y dejarlo fichado
 * para todos los demás. Ver `darDeAltaAporte` para el porqué.
 *
 * ── Lo que se comprueba antes de escribir ───────────────────────────────────
 * El dígito de control del código —para que un dedo torpe no cree una ficha
 * bajo un código que no existe— y la coherencia de los números. Las dos cosas
 * protegen a los DEMÁS: lo que entra aquí lo va a registrar gente que no ha
 * visto ese envase en su vida.
 *
 * ── Y lo que NO cuesta ──────────────────────────────────────────────────────
 * Nada de la cuota de IA. Quien tapa un hueco del catálogo está trabajando para
 * la app; cobrarle por hacerlo sería exactamente al revés.
 */
export async function aportar(req: Request, res: Response) {
  const usuarioId = req.user!.userId
  const { barcode, name, brand, per100, serving } = req.body

  if (!digitoDeControlValido(barcode)) {
    return res.status(400).json({
      success: false,
      message: 'Ese código no es válido: revisa los dígitos.',
    } satisfies ApiResponse)
  }

  const coherente = aporteCoherente(per100)
  if (!coherente.ok) {
    return res.status(400).json({ success: false, message: coherente.motivo } satisfies ApiResponse)
  }

  try {
    const alta = await darDeAltaAporte(
      { codigo: barcode, nombre: name, marca: brand, per100, racion: serving },
      usuarioId,
    )
    if (!alta) {
      return res.status(500).json({
        success: false,
        message: 'No se pudo guardar el producto. Inténtalo de nuevo.',
      } satisfies ApiResponse)
    }

    /* Se devuelve la ficha ya leída del catálogo, no lo que mandó la app: así
       el escáner enseña EXACTAMENTE lo que quedó guardado —con su fuente y su
       id interno— y no una copia optimista de lo que se pretendía guardar. */
    const guardado = await getCatalogFoodById(alta.foodId)
    if (!guardado) {
      return res.status(500).json({
        success: false,
        message: 'El producto se guardó pero no se pudo releer.',
      } satisfies ApiResponse)
    }

    return res.status(alta.creado ? 201 : 200).json({
      success: true,
      data: { ...presentCatalog(guardado), creado: alta.creado },
    } satisfies ApiResponse)
  } catch (err) {
    return fail(res, err, `Aporte del código ${barcode}`)
  }
}
