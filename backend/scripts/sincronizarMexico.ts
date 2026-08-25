/**
 * PRECARGA DEL CATÁLOGO MEXICANO DE OPEN FOOD FACTS
 * ═════════════════════════════════════════════════
 *
 * Trae de golpe los productos que se venden en México y los deja en `foods`,
 * para que el escáner los encuentre en casa desde el primer día en lugar de ir
 * aprendiéndolos de uno en uno según los vaya leyendo la gente.
 *
 *     npx tsx scripts/sincronizarMexico.ts            # continúa donde iba
 *     npx tsx scripts/sincronizarMexico.ts --desde 1  # empieza de cero
 *     npx tsx scripts/sincronizarMexico.ts --prueba   # 3 páginas, sin escribir
 *
 * ── Por qué la API paginada y no el volcado ─────────────────────────────────
 * Open Food Facts publica su base entera, pero son 1,2 GB comprimidos en CSV y
 * casi 12 GB en JSONL — para quedarnos con diecisiete mil productos. La API de
 * búsqueda devuelve justo lo que hace falta.
 *
 * ── Por qué `countries_tags` y no el prefijo 750 ────────────────────────────
 * El prefijo 750 identifica lo REGISTRADO en México, y eso deja fuera el
 * ketchup de Heinz, la Coca importada y media estantería del súper — que es
 * justo lo que la gente escanea. `countries_tags=mexico` es «se vende aquí»,
 * que es la pregunta correcta.
 *
 * ── Los límites, y de dónde sale el ritmo ───────────────────────────────────
 * Su política son 10 peticiones por minuto en BÚSQUEDAS (100/min al pedir un
 * código suelto). `page_size` está topado en 100 aunque se pida más. Con unos
 * 17.500 productos son ~175 páginas, y a seis segundos por página salen unos
 * dieciocho minutos. No se corre más: es una fuente gratuita y aguantarles el
 * ritmo es parte del trato.
 *
 * ── Su API se cae ───────────────────────────────────────────────────────────
 * Durante las mediciones devolvió 503 CONSTANTEMENTE: en una tanda de nueve
 * páginas hubo once reintentos, y la novena no salió ni tras noventa y ocho
 * segundos de espera. No es una anécdota, es el estado normal de su servicio.
 *
 * De ahí las dos defensas: ocho reintentos con espera creciente hasta un tope
 * de dos minutos, y un fichero de avance que permite retomar. Un fallo en la
 * página 140 no puede obligar a empezar de cero — ni por el tiempo perdido ni
 * por las peticiones que se le regalarían de más.
 *
 * ── Las mismas reglas que en vivo ───────────────────────────────────────────
 * Cada ficha pasa por `aProducto()`, que es exactamente la función que filtra
 * una lectura del escáner: fuera lo que no declara energía, fuera lo que pasa
 * de 900 kcal/100 g y fuera lo que no tiene nombre. Si el precargado filtrara
 * distinto, la base acabaría llena de fichas que el escáner habría rechazado.
 */

import { supabase } from '../src/config/supabase'
import { aProducto, type ProductoOFF } from '../src/services/openFoodFacts'
import { normalizarNombre } from '../src/services/altaAlimento'
import fs from 'fs/promises'
import path from 'path'

const BUSQUEDA = 'https://world.openfoodfacts.org/api/v2/search'
const USER_AGENT = 'ZENCRUS/1.0 (https://zencrus.com)'

const CAMPOS = [
  'code', 'product_name', 'product_name_es', 'generic_name', 'generic_name_es',
  'abbreviated_product_name', 'brands', 'quantity',
  'nutriments', 'serving_quantity', 'serving_size', 'image_front_small_url',
].join(',')

const POR_PAGINA = 100          // su tope, aunque se pida más
const ESPERA_MS = 8_000         // 10 búsquedas/min, con margen de sobra
const REINTENTOS = 8
/**
 * Tope de la espera entre reintentos.
 *
 * Sin tope, ocho reintentos doblando llegan a esperas de veinte minutos por una
 * sola página. Su servicio se recupera en un par de minutos o no se recupera:
 * pasado ese punto, insistir más lento no ayuda, solo alarga la agonía.
 */
const ESPERA_MAX_MS = 120_000
const LOTE_ESCRITURA = 200
const AVANCE = path.join(__dirname, '.mexico-avance.json')

/** Los cinco nutrientes que la app usa. Ids de la tabla `nutrients`. */
const NUTRIENTE = { energy: 1, protein: 2, carbs: 3, fat: 4, fiber: 7 } as const

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Avance ────────────────────────────────────────────────────────────────────

interface Avance {
  ultimaPagina: number
  totalPaginas: number
  vistos: number
  guardados: number
  descartados: number
}

async function leerAvance(): Promise<Avance | null> {
  try { return JSON.parse(await fs.readFile(AVANCE, 'utf8')) } catch { return null }
}

async function guardarAvance(a: Avance): Promise<void> {
  await fs.writeFile(AVANCE, JSON.stringify(a, null, 2))
}

// ── Lectura ───────────────────────────────────────────────────────────────────

interface Pagina { productos: any[]; total: number }

/**
 * Una página, con reintentos.
 *
 * La espera crece al doble en cada intento —8, 16, 32, 64 segundos, con tope
 * en dos minutos— porque un 503 casi siempre significa que están saturados,
 * y volver a insistir al segundo es empujar a alguien que ya se cae.
 */
async function traerPagina(pagina: number): Promise<Pagina> {
  const url = `${BUSQUEDA}?countries_tags=mexico&fields=${CAMPOS}` +
    `&page_size=${POR_PAGINA}&page=${pagina}`

  let espera = ESPERA_MS
  let ultimo = ''

  for (let intento = 1; intento <= REINTENTOS; intento++) {
    try {
      const control = new AbortController()
      const reloj = setTimeout(() => control.abort(), 60_000)
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: control.signal,
      })
      clearTimeout(reloj)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: any = await res.json()
      return { productos: data?.products ?? [], total: Number(data?.count ?? 0) }
    } catch (err) {
      ultimo = err instanceof Error ? err.message : String(err)
      if (intento === REINTENTOS) break
      console.log(`      ↻ ${ultimo} — reintento ${intento}/${REINTENTOS} en ${Math.round(espera / 1000)} s`)
      await dormir(espera)
      espera = Math.min(espera * 2, ESPERA_MAX_MS)
    }
  }
  throw new Error(`La página ${pagina} no se pudo traer: ${ultimo}`)
}

// ── Escritura ─────────────────────────────────────────────────────────────────

/**
 * Un lote de productos a la base, en tres viajes en vez de en trescientos.
 *
 * `upsert` sobre las claves que ya existen —(source_id, source_food_id) en
 * `foods` y (food_id, nutrient_id) en `food_nutrients`— hace que volver a
 * ejecutar esto no duplique nada. Es lo que permite lanzarlo cada semana sin
 * pensar, y lo que permite retomar una sincronización a medias sin comprobar
 * antes qué se había guardado.
 */
async function guardarLote(sourceId: number, lote: ProductoOFF[]): Promise<number> {
  if (lote.length === 0) return 0

  const filas = lote.map(p => ({
    source_id: sourceId,
    source_food_id: p.codigo,
    barcode: p.codigo,
    name: nombreConMarca(p.nombre, p.marca),
    name_normalized: normalizarNombre(nombreConMarca(p.nombre, p.marca)),
    lang: 'es',
    country: 'MX',
    brand: p.marca ?? null,
    image_url: p.imagenUrl ?? null,
    kind: 'procesado',
    base_unit: 'g',
    verified: false,
  }))

  const { data: guardados, error } = await supabase
    .from('foods')
    .upsert(filas, { onConflict: 'source_id,source_food_id' })
    .select('id, barcode')

  if (error) throw new Error(`foods: ${error.message}`)

  const porCodigo = new Map((guardados ?? []).map((r: any) => [r.barcode, r.id]))

  const nutrientes = lote.flatMap(p => {
    const id = porCodigo.get(p.codigo)
    if (!id) return []
    return [
      { food_id: id, nutrient_id: NUTRIENTE.energy, amount: p.per100.calories },
      { food_id: id, nutrient_id: NUTRIENTE.protein, amount: p.per100.protein },
      { food_id: id, nutrient_id: NUTRIENTE.carbs, amount: p.per100.carbs },
      { food_id: id, nutrient_id: NUTRIENTE.fat, amount: p.per100.fat },
      { food_id: id, nutrient_id: NUTRIENTE.fiber, amount: p.per100.fiber },
    ]
  })

  const { error: eNut } = await supabase
    .from('food_nutrients')
    .upsert(nutrientes, { onConflict: 'food_id,nutrient_id' })
  if (eNut) throw new Error(`food_nutrients: ${eNut.message}`)

  const porciones = lote.flatMap(p => {
    const id = porCodigo.get(p.codigo)
    if (!id || !p.racion) return []
    return [{
      food_id: id,
      description: p.racion.description.slice(0, 120),
      amount: 1,
      gram_weight: p.racion.grams,
      seq: 1,
      is_derived: false,
    }]
  })

  if (porciones.length) {
    const { error: ePor } = await supabase
      .from('food_portions')
      .upsert(porciones, { onConflict: 'food_id,seq' })
    // Las raciones son un extra: sin ellas el producto se registra en gramos.
    if (ePor) console.log(`      ⚠ raciones: ${ePor.message}`)
  }

  return guardados?.length ?? 0
}

/** «Nutella (Nutella)» no. La marca solo se añade cuando el nombre no la dice. */
function nombreConMarca(nombre: string, marca?: string): string {
  if (!marca) return nombre
  const n = normalizarNombre(nombre)
  const m = normalizarNombre(marca)
  if (!m || n.includes(m)) return nombre
  return `${nombre} (${marca})`
}

async function idFuenteOFF(): Promise<number> {
  const { data } = await supabase
    .from('food_sources').select('id').eq('code', 'off').maybeSingle()
  if (!data?.id) throw new Error("No existe la fuente 'off' en food_sources")
  return data.id
}

// ── Principal ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const prueba = args.includes('--prueba')
  const iDesde = args.indexOf('--desde')
  const desdeArg = iDesde >= 0 ? Number(args[iDesde + 1]) : null

  const previo = await leerAvance()
  const desde = desdeArg ?? (previo ? previo.ultimaPagina + 1 : 1)

  console.log('\n═══ Catálogo mexicano · Open Food Facts ═══')
  if (prueba) console.log('MODO PRUEBA: 3 páginas y no se escribe nada.\n')
  else if (previo && !desdeArg) {
    console.log(`Se retoma en la página ${desde} (la anterior llegó a la ${previo.ultimaPagina}).\n`)
  }

  const sourceId = prueba ? -1 : await idFuenteOFF()

  const cuenta: Avance = previo && !desdeArg
    ? { ...previo }
    : { ultimaPagina: 0, totalPaginas: 0, vistos: 0, guardados: 0, descartados: 0 }

  let pagina = desde
  let totalPaginas = cuenta.totalPaginas || Infinity

  try {
    while (pagina <= totalPaginas) {
      if (prueba && pagina > desde + 2) break

      const { productos, total } = await traerPagina(pagina)

      if (totalPaginas === Infinity) {
        totalPaginas = Math.ceil(total / POR_PAGINA)
        cuenta.totalPaginas = totalPaginas
        console.log(`${total.toLocaleString('es-MX')} productos en ${totalPaginas} páginas.`)
        console.log(`A ${ESPERA_MS / 1000} s por página son unos ${Math.ceil(totalPaginas * ESPERA_MS / 60000)} minutos.\n`)
      }

      if (productos.length === 0) {
        console.log(`  · página ${pagina}: vacía — se acabó antes de lo previsto`)
        break
      }

      // Las mismas reglas que aplica el escáner en vivo.
      const buenos: ProductoOFF[] = []
      for (const crudo of productos) {
        const codigo = String(crudo?.code ?? '').replace(/\D/g, '')
        if (!codigo) { cuenta.descartados++; continue }
        const p = aProducto(codigo, crudo)
        if (p) buenos.push(p)
        else cuenta.descartados++
      }
      cuenta.vistos += productos.length

      if (!prueba) {
        for (let i = 0; i < buenos.length; i += LOTE_ESCRITURA) {
          cuenta.guardados += await guardarLote(sourceId, buenos.slice(i, i + LOTE_ESCRITURA))
        }
      }

      cuenta.ultimaPagina = pagina
      if (!prueba) await guardarAvance(cuenta)

      const pct = Math.round((pagina / totalPaginas) * 100)
      console.log(
        `  · página ${String(pagina).padStart(3)}/${totalPaginas}  ${String(pct).padStart(3)}%  ` +
        `+${String(buenos.length).padStart(3)} útiles  ` +
        `(${cuenta.guardados.toLocaleString('es-MX')} guardados, ${cuenta.descartados.toLocaleString('es-MX')} descartados)`,
      )

      pagina++
      if (pagina <= totalPaginas) await dormir(ESPERA_MS)
    }
  } catch (err) {
    /* Se dice dónde se cortó y se sale con error. Lo que NO se hace es redondear
       el resultado hacia arriba ni presentar una sincronización a medias como
       terminada: la siguiente ejecución retoma en esta misma página. */
    console.error(`\n❌ Se cortó en la página ${pagina}: ${err instanceof Error ? err.message : err}`)
    console.error(`   Guardados hasta aquí: ${cuenta.guardados.toLocaleString('es-MX')}`)
    console.error('   Vuelve a lanzarlo y continúa por donde iba.')
    process.exit(1)
  }

  console.log('\n═══ Resumen ═══')
  console.log(`  Fichas vistas:      ${cuenta.vistos.toLocaleString('es-MX')}`)
  console.log(`  Guardadas:          ${cuenta.guardados.toLocaleString('es-MX')}`)
  console.log(`  Descartadas:        ${cuenta.descartados.toLocaleString('es-MX')}  (sin energía, sin nombre o con cifras imposibles)`)
  console.log(`  Última página:      ${cuenta.ultimaPagina} de ${cuenta.totalPaginas}`)

  if (!prueba && cuenta.ultimaPagina < cuenta.totalPaginas) {
    console.log('\n⚠ La sincronización NO llegó al final. Vuelve a lanzarla para continuar.')
  }
  process.exit(0)
}

main()
