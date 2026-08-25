/**
 * OPEN FOOD FACTS · SOLO CÓDIGOS DE BARRAS
 * ════════════════════════════════════════
 *
 * La única fuente gratuita que sabe qué hay dentro de un envase.
 *
 * ── Por qué vuelve, si se había retirado ────────────────────────────────────
 * Open Food Facts salió del proyecto por su BÚSQUEDA POR TEXTO: es un catálogo
 * colaborativo sin curar, y al pedirle «pollo» devolvía marcas regionales de
 * cualquier país antes que una pechuga. Ese reproche era correcto y sigue
 * siéndolo — la búsqueda por texto no vuelve.
 *
 * Pero un código de barras no es una búsqueda: es una CLAVE EXACTA. Pedir
 * 3017620422003 devuelve ese bote de Nutella y nada más. Ahí no hay relevancia
 * que acertar ni ordenación que discutir, y el problema que motivó la retirada
 * no existe.
 *
 * ── Por qué hacía falta algo ────────────────────────────────────────────────
 * `/foods/barcode/:code` devolvía 404 SIEMPRE, y no por un fallo:
 *
 *   · El catálogo propio (USDA SR Legacy + SMAE) no tiene códigos. Son
 *     alimentos genéricos —«arroz blanco cocido»—, no productos envasados.
 *   · `findByBarcode` de FatSecret devuelve null sin llegar a llamar: el scope
 *     'barcode' no entra en la edición gratuita.
 *
 * Con lo cual el escáner podía leer el código a la perfección y contestar
 * siempre lo mismo. Esto es lo que le da algo que contestar.
 *
 * ── Lo que cuesta ───────────────────────────────────────────────────────────
 * Nada. Sin clave, sin cuenta y sin cuota de pago. A cambio piden dos cosas y
 * las dos se cumplen aquí: identificarse con un `User-Agent` propio, y citar la
 * fuente —de ahí que estos alimentos lleguen con `sourceLabel` y SIN el
 * distintivo de verificado, que se reserva a las tablas oficiales.
 */

import { logger } from '../config/logger'

const BASE = 'https://world.openfoodfacts.org/api/v2/product'

/** Se identifican las peticiones, que es lo que pide su política de uso. */
const USER_AGENT = 'ZENCRUS/1.0 (https://zencrus.com)'

/** Campos que se piden. Traer el producto entero son cientos de kB por consulta. */
const CAMPOS = [
  'product_name', 'product_name_es', 'generic_name', 'generic_name_es',
  'abbreviated_product_name', 'brands', 'quantity',
  'nutriments', 'serving_quantity', 'serving_size',
  'image_front_small_url',
].join(',')

const TIMEOUT_MS = 8_000

export interface ProductoOFF {
  codigo: string
  nombre: string
  marca?: string
  imagenUrl?: string
  per100: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  /** La ración que declara el envase, cuando la trae y pesa algo. */
  racion?: { description: string; grams: number }
}

// ── Caché ─────────────────────────────────────────────────────────────────────

/**
 * Un día entero: la ficha de un producto envasado no cambia de una hora para
 * otra, y quien escanea la misma barrita cada mañana no debería salir a la red
 * por ella. Se guarda también el «no existe», que es el caso más repetido.
 */
const TTL = 24 * 60 * 60 * 1000
const MAX = 500
const cache = new Map<string, { at: number; value: ProductoOFF | null }>()

function leerCache(codigo: string): { hay: boolean; value: ProductoOFF | null } {
  const hit = cache.get(codigo)
  if (!hit) return { hay: false, value: null }
  if (Date.now() - hit.at > TTL) { cache.delete(codigo); return { hay: false, value: null } }
  return { hay: true, value: hit.value }
}

function escribirCache(codigo: string, value: ProductoOFF | null) {
  if (cache.size >= MAX) {
    const viejo = cache.keys().next().value
    if (viejo !== undefined) cache.delete(viejo)
  }
  cache.set(codigo, { at: Date.now(), value })
}

// ── Normalización del código ──────────────────────────────────────────────────

/**
 * EL DÍGITO DE CONTROL
 * ════════════════════
 * El último dígito de un código de barras no es parte del identificador: es una
 * suma de verificación de los anteriores. La regla es la misma para EAN-8,
 * UPC-A, EAN-13 y GTIN-14 —pesos alternos 3 y 1 de derecha a izquierda— y el
 * resultado tiene que cerrar en múltiplo de diez.
 *
 * ── Por qué esto está aquí y no es un adorno ────────────────────────────────
 * Open Food Facts tiene productos de PRUEBA dentro de su base de producción.
 * Consultar `9999999999999` no devuelve «no encontrado»: devuelve una
 * «Salatgurke» de la marca «TestMarke» con doce kilocalorías. Comprobado.
 *
 * Un pepino alemán de mentira es exactamente el tipo de ficha que no puede
 * entrar al diario: es plausible, tiene macros, y una vez dentro no se
 * distingue de las buenas. Y llegar a él es fácil —basta un dedo torpe
 * tecleando el código a mano—.
 *
 * Ese código falla la comprobación: sus doce primeros dígitos exigen un 4 al
 * final, no un 9. Ningún envase real falla, porque el dígito lo calcula quien
 * imprime la etiqueta. Así que la regla descarta lo inventado sin tocar lo
 * legítimo, y sin gastar una consulta en preguntarlo.
 */
export function digitoDeControlValido(codigo: string): boolean {
  // Solo las longitudes que usan este esquema. Un Code-128 puede llevar
  // cualquier cosa dentro y no hay nada que comprobar.
  if (![8, 12, 13, 14].includes(codigo.length)) return true

  const digitos = [...codigo].map(Number)
  if (digitos.some(Number.isNaN)) return false

  const control = digitos.pop()!
  // De derecha a izquierda, el primero pesa 3 y luego se alterna.
  const suma = digitos
    .reverse()
    .reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0)

  return (10 - (suma % 10)) % 10 === control
}

/**
 * LAS DOS CARAS DEL MISMO CÓDIGO
 * ══════════════════════════════
 * Los productos de América se marcan con UPC-A, que tiene 12 dígitos. Pero
 * UPC-A es, formalmente, un EAN-13 con un cero delante, y el lector de iOS los
 * entrega SIEMPRE como EAN-13: escanear un bote mexicano de 12 dígitos devuelve
 * 13, con ese cero de más.
 *
 * Open Food Facts guarda unos productos en una forma y otros en la otra, según
 * quién los diera de alta. Buscar solo la forma escaneada deja fuera la mitad
 * de los envases americanos y el usuario ve «no encontrado» sobre un producto
 * que sí está en la base.
 *
 * Así que se prueban las dos, en el orden en que es más probable acertar.
 */
export function variantesDe(codigo: string): string[] {
  const c = codigo.replace(/\D/g, '')
  if (!c) return []
  const fuera = new Set<string>([c])

  // EAN-13 con cero de relleno → el UPC-A de 12 que hay debajo.
  if (c.length === 13 && c.startsWith('0')) fuera.add(c.slice(1))
  // UPC-A de 12 → su forma EAN-13.
  if (c.length === 12) fuera.add(`0${c}`)
  // UPC-E comprimido: no se expande aquí porque el algoritmo depende del
  // último dígito y equivocarse devolvería la ficha de OTRO producto.

  return [...fuera]
}

// ── Lectura de la ficha ───────────────────────────────────────────────────────

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : 0
}
const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Las kilocalorías por 100 g.
 *
 * Si solo viene en kilojulios se convierte —eso es un cambio de unidad, no una
 * estimación—. Lo que NO se hace es deducirlas de los macros con la regla 4-4-9
 * cuando el producto no declara energía: eso sería inventar el dato principal
 * del alimento, y un número creíble puesto a mano corrompe todo lo que se
 * calcule encima.
 */
function kcalPor100(n: Record<string, unknown>): number {
  const kcal = num(n['energy-kcal_100g'])
  if (kcal > 0) return Math.round(kcal)
  const kj = num(n['energy-kj_100g']) || num(n['energy_100g'])
  if (kj > 0) return Math.round(kj / 4.184)
  return 0
}

/**
 * De la ficha cruda de Open Food Facts al producto que la app entiende.
 *
 * Se exporta para que la sincronización del catálogo mexicano aplique EXACTAMENTE
 * las mismas reglas que una lectura en vivo. Si el precargado filtrara distinto,
 * la base acabaría con miles de fichas que el escáner habría rechazado.
 */
export function aProducto(codigo: string, p: any): ProductoOFF | null {
  const nombre = String(
    p?.product_name_es || p?.product_name ||
    p?.generic_name_es || p?.generic_name ||
    p?.abbreviated_product_name || '',
  ).trim()
  // Una ficha sin nombre no se puede registrar ni reconocer en el diario.
  if (nombre.length < 2) return null

  const n = (p?.nutriments ?? {}) as Record<string, unknown>
  const calories = kcalPor100(n)
  // Sin energía no sirve para apuntar una comida. Se dice que no está, que es
  // la verdad útil, en vez de devolver una ficha a cero.
  if (calories <= 0) return null
  // Fichas con la energía mal metida —el error típico es dar el valor por
  // ración en la casilla de los 100 g—. Ni el aceite puro pasa de 900.
  if (calories > 900) return null

  const gramosRacion = num(p?.serving_quantity)
  const textoRacion = String(p?.serving_size ?? '').trim()

  return {
    codigo,
    nombre,
    marca: String(p?.brands ?? '').split(',')[0].trim() || undefined,
    imagenUrl: typeof p?.image_front_small_url === 'string' ? p.image_front_small_url : undefined,
    per100: {
      calories,
      protein: r1(num(n['proteins_100g'])),
      carbs: r1(num(n['carbohydrates_100g'])),
      fat: r1(num(n['fat_100g'])),
      fiber: r1(num(n['fiber_100g'])),
    },
    racion: gramosRacion > 0
      ? { description: textoRacion || `${gramosRacion} g`, grams: Math.round(gramosRacion) }
      : undefined,
  }
}

/** Una consulta a Open Food Facts. `null` es «no está»; lanza si la red falla. */
async function pedir(codigo: string): Promise<ProductoOFF | null> {
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}/${codigo}.json?fields=${CAMPOS}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: control.signal,
    })
    // 404 es su forma de decir que ese código no existe. No es una avería.
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: any = await res.json()
    if (data?.status !== 1 || !data?.product) return null
    return aProducto(codigo, data.product)
  } finally {
    clearTimeout(reloj)
  }
}

/**
 * Busca un producto envasado por su código de barras.
 *
 * Devuelve `null` cuando el producto no está o cuando su ficha no sirve para
 * registrar —sin nombre o sin energía—. Si la red falla, también `null`: quien
 * llama enseña «no encontrado» y ofrece la salida manual, que es mejor
 * respuesta que un error rojo delante de la cámara.
 */
export async function buscarPorCodigo(codigo: string): Promise<ProductoOFF | null> {
  const variantes = variantesDe(codigo)
  if (variantes.length === 0) return null

  const enCache = leerCache(variantes[0])
  if (enCache.hay) return enCache.value

  for (const v of variantes) {
    try {
      const p = await pedir(v)
      if (p) {
        escribirCache(variantes[0], p)
        return p
      }
    } catch (err) {
      // Se apunta y se sigue con la otra variante: que falle una consulta no
      // tiene por qué costar la segunda oportunidad.
      logger.warn(`Open Food Facts · ${v}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  escribirCache(variantes[0], null)
  return null
}
