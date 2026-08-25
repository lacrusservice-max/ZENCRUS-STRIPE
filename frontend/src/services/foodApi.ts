// Catálogo de alimentos de ZENCRUS.
//
// Fuente: el backend combina el catálogo propio (USDA FoodData Central y las
// demás fuentes oficiales cargadas en Supabase — ver `006_food_database.sql`)
// con FatSecret como relleno cuando el catálogo propio no alcanza.
//
// Open Food Facts está FUERA de la búsqueda por texto —es colaborativo y sin
// curar, y devolvía productos de cualquier país sin relación con lo buscado—
// pero es la fuente del escáner: un código de barras es una clave exacta y ahí
// no hay relevancia que acertar.
//
// La base local sigue existiendo como red de seguridad: si no hay conexión, la
// búsqueda sigue devolviendo los básicos en lugar de quedarse en blanco.

import api from '@/services/api'
import { GENERIC_FOODS, GrupoAlimento } from '@/data/genericFoods'
import { emojiForFood } from '@/data/foodEmoji'
import { Per100 } from '@/utils/units'

export interface Food {
  id: string
  name: string
  brand?: string
  emoji: string
  /** Macros por 100 g — formato canónico, ver `@/utils/units`. */
  per100: Per100
  /** Unidad con la que se registra por defecto. */
  defaultUnit: string
  /** Cantidad inicial sugerida en esa unidad. */
  defaultAmount: number
  /** Peso de una pieza o porción, si la fuente lo indica. */
  gramsPerPiece?: number
  imageUrl?: string
  /** true solo si viene de una fuente oficial integrada (USDA, BEDCA…). */
  verified: boolean
  /** Nombre de la fuente, para el distintivo "Verificado · …". */
  sourceLabel?: string
  source: 'local' | 'catalog' | 'fatsecret' | 'off'
}

// ── Catálogo del backend (USDA + FatSecret, ya combinados y ordenados) ────────

interface ApiFood {
  id: string
  name: string
  brand?: string
  generic: boolean
  verified: boolean
  sourceLabel?: string
  /** Foto del envase. Solo la traen los productos de Open Food Facts. */
  imageUrl?: string
  per100: Per100
  servings: { description: string; grams?: number; calories: number }[]
}

function fromApi(f: ApiFood): Food | null {
  if (!f?.name || !f.per100 || f.per100.calories <= 0) return null

  // Una ración con peso conocido da la porción inicial: registrar "1 taza" es
  // más natural que teclear los gramos que pesa una taza.
  const weighed = f.servings?.find(s => s.grams && s.grams > 0)

  return {
    id: f.id,
    name: f.name,
    brand: f.brand,
    emoji: emojiForFood(f.name, f.brand),
    per100: f.per100,
    defaultUnit: 'g',
    defaultAmount: weighed?.grams ? Math.round(weighed.grams) : 100,
    gramsPerPiece: weighed?.grams,
    imageUrl: f.imageUrl,
    verified: f.verified,
    sourceLabel: f.sourceLabel,
    /* El prefijo del id dice de dónde viene. Antes se deducía de `verified`, y
       eso mandaba a Open Food Facts al cajón de FatSecret: los dos son «no
       verificado» y ahí se acababa la distinción. */
    source: f.id.startsWith('off:') ? 'off' : f.verified ? 'catalog' : 'fatsecret',
  }
}

/** Consulta el catálogo del backend. Devuelve null si no está disponible. */
async function fromBackend(path: string, params?: Record<string, string>): Promise<any | null> {
  try {
    const { data } = await api.get(path, { params })
    return data?.success ? data.data : null
  } catch {
    // Sin sesión, sin red o el catálogo caído: quien llama usa el respaldo.
    return null
  }
}

// ── Base genérica (siempre disponible, con o sin red) ─────────────────────────

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

interface LocalFood extends Food { haystack: string; pri: number; grp: GrupoAlimento }

const LOCAL: LocalFood[] = GENERIC_FOODS.map((g, i) => ({
  id: `gen:${i}`,
  name: g.name,
  emoji: emojiForFood(g.name),
  per100: { calories: g.k, protein: g.p, carbs: g.c, fat: g.f, fiber: g.fi },
  defaultUnit: g.u ?? 'g',
  defaultAmount: g.a ?? 100,
  gramsPerPiece: g.g,
  verified: false,
  source: 'local' as const,
  haystack: norm([g.name, ...(g.alt ?? [])].join(' ')),
  pri: g.pri ?? 0,
  grp: g.grp,
}))

/**
 * EL ORDEN EN QUE SE MONTA UN PLATO
 *
 * Manda el reparto de la lista de arranque: primero la ronda completa —uno de
 * cada grupo, en este orden— y luego una segunda vuelta por los de arriba.
 */
const ORDEN_GRUPOS: GrupoAlimento[] = [
  'proteina', 'cereal', 'verdura', 'fruta', 'huevo', 'lacteo',
  'legumbre', 'grasa', 'platillo', 'bebida', 'snack',
]

/** Cuántos alimentos enseña el buscador antes de que se escriba nada. */
const ARRANQUE = 16

/**
 * LA LISTA DE ARRANQUE, REPARTIDA POR GRUPOS
 * ══════════════════════════════════════════
 * Lo que había aquí era `sort(por prioridad).slice(0, 14)`, y salían catorce
 * proteínas animales: pollo, pavo, res, cerdo, salmón, atún, huevo, clara y
 * cinco lácteos. Ni un cereal, ni una fruta, ni una verdura, ni una legumbre.
 *
 * No era que faltaran: hay CUARENTA Y UN alimentos con prioridad 3, y entre
 * ellos están el arroz, la avena, la tortilla, los frijoles y el plátano. Pero
 * los cuarenta y uno empatan, `Array.sort` en JavaScript es estable, y la tabla
 * está escrita por categorías con las carnes arriba. El corte en catorce caía
 * justo antes de los cereales.
 *
 * El efecto visible es que la primera pantalla del buscador —la que se ve al
 * abrir a registrar cualquier comida— no ofrecía carbohidratos. Ninguno.
 *
 * Se arregla repartiendo en vez de cortando: una ronda por grupo, y dentro de
 * cada grupo el de más prioridad. Así la primera pantalla se parece a un plato
 * y no a una carnicería.
 */
function arranque(): Food[] {
  const porGrupo = new Map<GrupoAlimento, LocalFood[]>()
  for (const g of ORDEN_GRUPOS) porGrupo.set(g, [])
  for (const f of LOCAL) porGrupo.get(f.grp)?.push(f)
  /* Solo por prioridad. Al empatar manda el orden de la tabla, que es
     deliberado: dentro de cada grupo está primero lo que más se registra —la
     pechuga antes que el atún, el arroz antes que la papa—. Desempatar por
     nombre más corto lo tiraba justo al revés. */
  for (const lista of porGrupo.values()) lista.sort((a, b) => b.pri - a.pri)

  const out: Food[] = []
  for (let vuelta = 0; out.length < ARRANQUE; vuelta++) {
    let repartio = false
    for (const g of ORDEN_GRUPOS) {
      const f = porGrupo.get(g)![vuelta]
      if (!f) continue
      repartio = true
      out.push(f)
      if (out.length === ARRANQUE) break
    }
    // Ningún grupo tenía nada en esta vuelta: la tabla se acabó.
    if (!repartio) break
  }
  return out
}

/**
 * Busca en la base genérica.
 *
 * Manda la prioridad: al buscar "arroz" primero va el arroz blanco y no el
 * arroz con pollo. A igualdad, gana el que empieza antes por lo buscado y,
 * en último término, el nombre más corto por ser el más canónico.
 */
export function searchLocal(q: string): Food[] {
  const n = norm(q)
  if (!n) return arranque()
  // Coincidir con el principio de una palabra vale más que caer en mitad de
  // otra: buscando "pan" interesa el pan, no el queso "panela".
  const word = new RegExp(`(^|\\s)${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  return LOCAL
    .map(f => ({ f, at: f.haystack.indexOf(n), w: word.test(f.haystack) ? 0 : 1 }))
    .filter(x => x.at >= 0)
    .sort((a, b) =>
      a.w - b.w ||
      b.f.pri - a.f.pri ||
      a.at - b.at ||
      a.f.name.length - b.f.name.length)
    .map(x => x.f)
}

// ── API pública ───────────────────────────────────────────────────────────────

export interface SearchResult {
  foods: Food[]
  /** true cuando la respuesta salió del respaldo local por fallo de red. */
  offline: boolean
}

/**
 * Caché de búsquedas y códigos.
 *
 * Evita repetir contra el backend una consulta ya hecha (volver atrás,
 * corregir una letra, reabrir el panel).
 */
const searchCache = new Map<string, Food[]>()
const barcodeCache = new Map<string, Food | null>()
const CACHE_MAX = 60

function remember<K, V>(map: Map<K, V>, key: K, value: V) {
  if (map.size >= CACHE_MAX) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
  map.set(key, value)
}

/** Busca alimentos por texto. El catálogo oficial va primero, siempre. */
export async function searchFoods(query: string, _signal?: AbortSignal): Promise<SearchResult> {
  const q = query.trim()
  if (q.length < 2) return { foods: searchLocal(q), offline: false }

  const key = q.toLowerCase()
  const cached = searchCache.get(key)
  if (cached) return { foods: cached, offline: false }

  const local = searchLocal(q)

  const remoteRaw = await fromBackend('/foods/search', { q })

  /**
   * Contestar con nada NO es lo mismo que no contestar.
   *
   * Aquí se daba por caída la búsqueda en cuanto la lista remota venía vacía,
   * y entonces el panel decía «sin conexión» y enseñaba los básicos locales.
   * Pero el catálogo tiene miles de alimentos y no tiene todos: que no esté la
   * cochinita es una respuesta correcta, no un fallo de red. El usuario veía
   * un aviso de avería y «lo más parecido» a algo que sí había preguntado bien.
   *
   * `null` es lo único que significa que no se pudo preguntar.
   */
  const contesto = Array.isArray(remoteRaw)
  const remote: Food[] = contesto
    ? remoteRaw.map(fromApi).filter((f): f is Food => f !== null)
    : []

  if (!contesto) {
    return { foods: local, offline: local.length === 0 }
  }

  // El catálogo oficial ya viene ordenado por relevancia desde el backend; los
  // básicos locales encabezan porque son justo lo que se registra a diario.
  const merged = dedupe([...local, ...clean(remote, q)]).slice(0, 40)

  // Lo vacío no se cachea. En cuanto ZENA dé de alta ese alimento —que es lo
  // que hace el §4 cuando alguien pide algo que no está— la siguiente búsqueda
  // tiene que encontrarlo, no repetir el «no hay» que guardamos hace un rato.
  if (merged.length > 0) remember(searchCache, key, merged)

  return { foods: merged, offline: false }
}

// ── Limpieza y combinación ─────────────────────────────────────────────────────

function identity(f: Food): string {
  return norm(f.name).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Puntúa lo completo que está un registro, para quedarse con el mejor duplicado. */
function completeness(f: Food): number {
  let n = 0
  if (f.imageUrl) n += 2
  if (f.verified) n += 3
  if (f.brand) n += 1
  if (f.per100.protein > 0 || f.per100.carbs > 0 || f.per100.fat > 0) n += 2
  if (f.gramsPerPiece) n += 1
  return n
}

/** Quita repetidos conservando, de cada grupo, el registro más completo. */
function dedupe(list: Food[]): Food[] {
  const best = new Map<string, Food>()
  const order: string[] = []
  for (const f of list) {
    const k = identity(f)
    if (!k) continue
    const prev = best.get(k)
    if (!prev) { best.set(k, f); order.push(k); continue }
    if (prev.source === 'local') continue
    if (f.source === 'local' || completeness(f) > completeness(prev)) best.set(k, f)
  }
  return order.map(k => best.get(k)!)
}

/** Descarta resultados sin sentido y ordena por cercanía a lo buscado. */
function clean(list: Food[], query: string): Food[] {
  const q = norm(query)
  return list
    .filter(f => {
      const n = norm(f.name)
      if (n.length < 2 || n.length > 90) return false
      if (!/[a-z]{3}/.test(n)) return false
      if (f.per100.calories > 900) return false
      return true
    })
    .sort((a, b) => {
      // Lo verificado manda; dentro de cada grupo, el orden que ya trae el
      // backend (por relevancia) se respeta tal cual.
      if (a.verified !== b.verified) return a.verified ? -1 : 1
      const an = norm(a.name), bn = norm(b.name)
      const ai = an.startsWith(q) ? 0 : an.includes(q) ? 1 : 2
      const bi = bn.startsWith(q) ? 0 : bn.includes(q) ? 1 : 2
      return ai - bi
    })
}

/** Busca un producto por su código de barras. */
export async function getFoodByBarcode(barcode: string, _signal?: AbortSignal): Promise<Food | null> {
  const code = barcode.replace(/\D/g, '')
  if (!code) return null

  if (barcodeCache.has(code)) return barcodeCache.get(code) ?? null

  const raw = await fromBackend(`/foods/barcode/${code}`)
  const food = raw ? fromApi(raw) : null
  remember(barcodeCache, code, food)
  return food
}

// ── Aportar un producto que no está ───────────────────────────────────────────

export interface AporteAlimento {
  barcode: string
  name: string
  brand?: string
  per100: Per100
  serving?: { description: string; grams: number }
}

/**
 * TAPAR EL HUECO PARA TODOS, NO SOLO PARA UNO
 * ═══════════════════════════════════════════
 * Da de alta un producto que ninguna fuente tiene, con lo que la persona lee de
 * la etiqueta que tiene en la mano.
 *
 * Open Food Facts cubre unos diecisiete mil productos vendidos en México. Un
 * súper tiene bastantes más, y las marcas locales no están casi ninguna. Sin
 * esta puerta, la respuesta a lo que falta es «no lo tenemos» y el catálogo no
 * crece nunca; con ella, el primero que se topa con el hueco lo tapa en medio
 * minuto y el siguiente ya lo encuentra hecho.
 *
 * Devuelve el alimento tal y como quedó GUARDADO, no una copia de lo que se
 * mandó: si el servidor corrigió o completó algo, es eso lo que hay que
 * enseñar. En caso de error devuelve el motivo en castellano — los rechazos de
 * coherencia («los macros dan 780 kcal y la etiqueta dice 190») son
 * instrucciones para el usuario, no fallos que ocultar.
 */
export async function aportarAlimento(
  datos: AporteAlimento,
): Promise<{ food: Food } | { error: string }> {
  try {
    const { data } = await api.post('/foods/aportar', datos)
    const food = data?.success ? fromApi(data.data) : null
    if (!food) return { error: 'El producto se guardó pero llegó incompleto.' }

    /* La caché de códigos guardó el «no está» de hace un momento. Si no se
       borra, volver a escanear el mismo envase seguiría diciendo que no existe
       el producto que la persona acaba de dar de alta. */
    barcodeCache.delete(datos.barcode.replace(/\D/g, ''))
    searchCache.clear()

    return { food }
  } catch (err: any) {
    const msg = err?.response?.data?.message
    return { error: typeof msg === 'string' ? msg : 'No se pudo guardar. Revisa tu conexión.' }
  }
}
