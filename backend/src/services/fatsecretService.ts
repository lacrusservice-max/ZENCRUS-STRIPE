/**
 * FatSecret Platform API — catálogo de alimentos de ZENCRUS.
 *
 * 2,3 millones de alimentos verificados: genéricos, de marca, de restaurante y
 * platos compuestos, con raciones reales y códigos de barras.
 *
 * ── Por qué vive en el backend y no en la app ────────────────────────────────
 * FatSecret rechaza toda petición cuya IP de origen no esté en su lista blanca
 * (máximo 15 direcciones). Un teléfono tiene una IP distinta por usuario y por
 * red, así que llamarla desde la app es imposible por diseño. Además el
 * `client_secret` incrustado en un binario sería público. La app habla con
 * `/api/foods/*` y este servicio es el único que conoce las credenciales.
 */

import { env } from '../config/env'
import { logger } from '../config/logger'
import { toEnglish } from './foodTranslate'

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token'
const API_URL = 'https://platform.fatsecret.com/rest/server.api'
const TIMEOUT = 12000

export interface FatSecretServing {
  description: string
  /** Gramos (o mililitros) que pesa esta ración, si la API lo indica. */
  grams?: number
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface FatSecretFood {
  id: string
  name: string
  brand?: string
  /** 'Generic' | 'Brand' — permite priorizar lo genérico en la búsqueda. */
  type: string
  /** Macros por 100 g, formato canónico de la app. */
  per100: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  /** Raciones que declara el propio alimento ("1 taza", "1 pieza mediana"). */
  servings: FatSecretServing[]
}

export function isConfigured(): boolean {
  return Boolean(env.FATSECRET_CLIENT_ID && env.FATSECRET_CLIENT_SECRET)
}

// ── Token ─────────────────────────────────────────────────────────────────────

let cachedToken: { value: string; expiresAt: number } | null = null
let inFlight: Promise<string> | null = null

/**
 * Token de acceso, cacheado en memoria.
 *
 * Dura 24 h. Se renueva un minuto antes de caducar y las peticiones simultáneas
 * comparten la misma promesa, para no pedir cinco tokens a la vez en un arranque
 * con varias búsquedas en paralelo.
 */
async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value
  if (inFlight) return inFlight

  inFlight = (async () => {
    const basic = Buffer
      .from(`${env.FATSECRET_CLIENT_ID}:${env.FATSECRET_CLIENT_SECRET}`)
      .toString('base64')

    const res = await fetchWithTimeout(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=basic',
    })

    if (!res.ok) throw new Error(`FatSecret: token HTTP ${res.status}`)
    const data: any = await res.json()
    if (!data.access_token) throw new Error('FatSecret: respuesta de token sin access_token')

    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in ?? 86400) - 60) * 1000,
    }
    return cachedToken.value
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT)
  try {
    return await fetch(url, { ...init, signal: ctl.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Llama a un método de la API y devuelve el JSON ya validado. */
async function call(params: Record<string, string>): Promise<any> {
  const token = await getToken()
  const qs = new URLSearchParams({ ...params, format: 'json' })
  const res = await fetchWithTimeout(`${API_URL}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`FatSecret: HTTP ${res.status}`)
  const data: any = await res.json()

  if (data?.error) {
    // El código 21 es el aviso de que falta autorizar la IP de este servidor.
    // Se registra con su propio mensaje porque es un fallo de configuración,
    // no de programación, y sin explicarlo se confunde con "no hay resultados".
    if (data.error.code === 21) {
      logger.error(
        `FatSecret rechazó la IP del servidor. Añádela en Manage Keys → IP Restrictions. Detalle: ${data.error.message}`,
      )
      throw new Error('FATSECRET_IP_NOT_ALLOWED')
    }
    throw new Error(`FatSecret: ${data.error.message ?? 'error desconocido'}`)
  }
  return data
}

// ── Interpretación de las raciones ────────────────────────────────────────────

const num = (v: any): number => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n) && n >= 0 ? n : 0
}
const r1 = (n: number) => Math.round(n * 10) / 10

function toServing(s: any): FatSecretServing {
  const unit = String(s.metric_serving_unit ?? '').toLowerCase()
  const amount = num(s.metric_serving_amount)
  return {
    description: String(s.serving_description ?? '').trim(),
    // 'g' y 'ml' se tratan igual: la app trabaja en gramos asumiendo densidad 1.
    grams: amount > 0 && (unit === 'g' || unit === 'ml') ? amount : undefined,
    calories: Math.round(num(s.calories)),
    protein: r1(num(s.protein)),
    carbs: r1(num(s.carbohydrate)),
    fat: r1(num(s.fat)),
    fiber: r1(num(s.fiber)),
  }
}

/**
 * Lee la ración que `foods.search` devuelve como texto.
 *
 * La edición gratuita solo permite la versión 1 del buscador, que no entrega
 * las raciones estructuradas sino una línea del tipo:
 *
 *   "Per 100g - Calories: 165kcal | Fat: 3.57g | Carbs: 0.00g | Protein: 31.02g"
 *
 * Solo se acepta cuando la ración viene pesada en gramos o mililitros: con
 * "Per 1 cup" no hay forma de normalizar a 100 g sin inventar el peso de una
 * taza de ese alimento concreto. La fibra no aparece en esta línea y queda en 0
 * hasta que se consulte el detalle del alimento.
 */
function parseDescription(desc: string): FatSecretServing | null {
  const text = String(desc ?? '')
  const per = text.match(/Per\s+([\d.]+)\s*(g|ml)\b/i)
  if (!per) return null

  const grams = parseFloat(per[1])
  if (!Number.isFinite(grams) || grams <= 0) return null

  const pick = (label: string): number => {
    const m = text.match(new RegExp(`${label}:\\s*([\\d.]+)\\s*(?:kcal|g)`, 'i'))
    return m ? parseFloat(m[1]) : 0
  }

  const calories = pick('Calories')
  if (!calories) return null

  return {
    description: `${grams} ${per[2].toLowerCase()}`,
    grams,
    calories: Math.round(calories),
    protein: r1(pick('Protein')),
    carbs: r1(pick('Carbs')),
    fat: r1(pick('Fat')),
    fiber: 0,
  }
}

/**
 * Deriva los macros por 100 g.
 *
 * FatSecret no publica un campo "por 100 g": publica raciones. Se busca la que
 * declare su peso métrico y se reescala. Sin ninguna ración pesada no hay forma
 * fiable de normalizar, y el alimento se descarta antes que inventar cifras.
 */
function per100From(servings: FatSecretServing[]): FatSecretFood['per100'] | null {
  const weighed = servings.find(s => s.grams && s.grams > 0)
  if (!weighed || !weighed.grams) return null
  const k = 100 / weighed.grams
  if (!Number.isFinite(k)) return null
  return {
    calories: Math.round(weighed.calories * k),
    protein: r1(weighed.protein * k),
    carbs: r1(weighed.carbs * k),
    fat: r1(weighed.fat * k),
    fiber: r1(weighed.fiber * k),
  }
}

function toFood(raw: any): FatSecretFood | null {
  const name = String(raw.food_name ?? '').trim()
  if (!name) return null

  const list = raw.servings?.serving
  let servings = (Array.isArray(list) ? list : list ? [list] : []).map(toServing)

  // `foods.search` (v1) no trae raciones estructuradas, solo la línea de texto.
  if (servings.length === 0 && raw.food_description) {
    const parsed = parseDescription(raw.food_description)
    if (parsed) servings = [parsed]
  }

  const per100 = per100From(servings)
  if (!per100 || per100.calories <= 0) return null

  return {
    id: String(raw.food_id),
    name,
    brand: raw.brand_name ? String(raw.brand_name).trim() : undefined,
    type: String(raw.food_type ?? 'Generic'),
    per100,
    servings: servings.filter(s => s.description),
  }
}

// ── Caché de resultados ───────────────────────────────────────────────────────

const CACHE_TTL = 60 * 60 * 1000 // 1 h
const CACHE_MAX = 300
const cache = new Map<string, { at: number; value: any }>()

function readCache<T>(key: string): T | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL) { cache.delete(key); return null }
  return hit.value as T
}

function writeCache(key: string, value: any) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { at: Date.now(), value })
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Busca alimentos por texto. Los genéricos van primero. */
/**
 * `_region` se acepta y no se usa: la edición gratuita de FatSecret no admite
 * el parámetro (ver la nota de abajo). Se mantiene en la firma porque
 * `foodController` ya lo manda y porque el día que se suba de nivel el cambio
 * es de una línea; el guion bajo es lo que dice que la omisión es a propósito
 * y no un olvido.
 */
export async function searchFoods(query: string, _region = 'MX'): Promise<FatSecretFood[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const key = `s:${q.toLowerCase()}`
  const cached = readCache<FatSecretFood[]>(key)
  if (cached) return cached

  // La edición gratuita solo admite `foods.search` (v1): las versiones 2 y 3
  // exigen el nivel premier, igual que los parámetros `region` e `language`.
  const run = (expression: string) =>
    call({ method: 'foods.search', search_expression: expression, max_results: '30' })

  const rows = (data: any): any[] => {
    const list = data?.foods?.food
    return Array.isArray(list) ? list : list ? [list] : []
  }

  // Cuando hay traducción se consultan las dos y manda la inglesa: buscar
  // "pollo" en español devuelve guisos regionales, mientras que "chicken"
  // devuelve la ficha genérica verificada, que es lo que se quiere registrar.
  const en = toEnglish(q)
  const [esRes, enRes] = await Promise.all([run(q), en ? run(en) : Promise.resolve(null)])

  const esArr = rows(esRes)
  const enArr = enRes ? rows(enRes) : []
  const seen = new Set(enArr.map((f: any) => String(f.food_id)))
  const arr = [...enArr, ...esArr.filter((f: any) => !seen.has(String(f.food_id)))]

  const foods = arr
    .map(toFood)
    .filter((f: FatSecretFood | null): f is FatSecretFood => f !== null)
    // Lo genérico ("Pechuga de pollo") es lo que la gente registra a diario;
    // los productos de marca quedan detrás.
    .sort((a: FatSecretFood, b: FatSecretFood) => {
      const ag = a.type === 'Generic' ? 0 : 1
      const bg = b.type === 'Generic' ? 0 : 1
      return ag - bg || a.name.length - b.name.length
    })

  writeCache(key, foods)
  return foods
}

/**
 * Busca un alimento por código de barras.
 *
 * `food.find_id_for_barcode` pertenece al scope 'barcode', que la edición
 * gratuita no incluye —comprobado: responde "Missing scope: scope 'barcode'"—.
 * Se devuelve null sin llamar a la API para no gastar peticiones en algo que
 * siempre va a fallar; el escáner de la app resuelve por Open Food Facts, que
 * sí cubre códigos de barras sin coste.
 */
export async function findByBarcode(_barcode: string): Promise<FatSecretFood | null> {
  return null
}

/** Detalle completo de un alimento por su identificador. */
export async function getFoodById(foodId: string): Promise<FatSecretFood | null> {
  const key = `f:${foodId}`
  const cached = readCache<FatSecretFood | null>(key)
  if (cached !== null) return cached

  const data = await call({ method: 'food.get.v4', food_id: foodId })
  const food = data?.food ? toFood(data.food) : null
  writeCache(key, food)
  return food
}
