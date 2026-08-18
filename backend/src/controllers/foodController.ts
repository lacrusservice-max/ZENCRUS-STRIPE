import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import {
  searchFoods, findByBarcode, getFoodById, isConfigured, FatSecretFood,
} from '../services/fatsecretService'
import { searchCatalog, getCatalogFoodById, CatalogFood } from '../services/catalogService'

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
 * Open Food Facts se retiró por completo: es un catálogo colaborativo sin
 * curar y devolvía productos de cualquier país sin relación con la búsqueda.
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

export async function barcode(req: Request, res: Response) {
  const code = String(req.params.code)
  // La consulta admite `region`, pero el catálogo todavía no distingue por
  // país: se deja de leer hasta que haya datos regionales que devolver.

  // El catálogo propio hoy solo tiene SR Legacy (sin códigos de barras: son
  // alimentos genéricos, no productos envasados) y FatSecret no incluye el
  // scope 'barcode' en el plan gratuito. Se responde "no encontrado" de forma
  // honesta en vez de simular una fuente que no está disponible.
  try {
    if (isConfigured()) {
      const food = await findByBarcode(code)
      if (food) {
        return res.json({ success: true, data: presentFatSecret(food) } satisfies ApiResponse)
      }
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
