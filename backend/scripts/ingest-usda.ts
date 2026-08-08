/**
 * Ingesta de USDA FoodData Central.
 *
 *   npx tsx scripts/ingest-usda.ts <carpeta-del-dataset> [--source usda_sr] [--dry]
 *
 * Lee los CSV oficiales tal como se descargan de fdc.nal.usda.gov y los carga en
 * el esquema de `006_food_database.sql`. Ningún valor se estima ni se completa:
 * lo que no está en el CSV no entra en la base.
 *
 * Es idempotente. `foods` tiene una restricción única sobre (source_id,
 * source_food_id), así que reejecutarlo actualiza lo ya cargado en vez de
 * duplicarlo — que es lo que exige el control de calidad.
 *
 * Necesita SUPABASE_SERVICE_ROLE_KEY: la clave anónima está sujeta a RLS y el
 * catálogo es de solo lectura para el cliente.
 */

import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

// Script independiente: no pasa por src/config/env.ts, así que carga el .env
// del backend por su cuenta.
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// ── Lectura de CSV ────────────────────────────────────────────────────────────

/**
 * Analizador de CSV suficiente para el formato de USDA: campos entrecomillados,
 * comas dentro de comillas y comillas escapadas por duplicación. Se evita una
 * dependencia externa porque el formato es fijo y está bajo nuestro control.
 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }

  const header = rows.shift()
  if (!header) return []
  return rows
    .filter(r => r.length === header.length)
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}

function readCsv(dir: string, file: string): Record<string, string>[] {
  const full = path.join(dir, file)
  if (!fs.existsSync(full)) throw new Error(`Falta ${file} en ${dir}`)
  return parseCsv(fs.readFileSync(full, 'utf8'))
}

// ── Correspondencias ──────────────────────────────────────────────────────────

/**
 * Nutrientes de USDA que la app entiende, indexados por su número oficial.
 *
 * Se usa `nutrient_nbr` y no el `id` interno porque el número es estable entre
 * versiones y entre datasets (SR Legacy, Foundation, Branded), mientras que el
 * identificador interno cambia de uno a otro.
 */
const NUTRIENT_BY_NBR: Record<string, string> = {
  '208': 'energy',
  '203': 'protein',
  '205': 'carbs',
  '204': 'fat',
  '606': 'fat_saturated',
  '605': 'fat_trans',
  '291': 'fiber',
  '269': 'sugars',
  '307': 'sodium',
  '306': 'potassium',
  '601': 'cholesterol',
  '301': 'calcium',
  '303': 'iron',
  '304': 'magnesium',
  '305': 'phosphorus',
  '309': 'zinc',
  '320': 'vitamin_a',
  '401': 'vitamin_c',
  '328': 'vitamin_d',
  '323': 'vitamin_e',
  '430': 'vitamin_k',
  '404': 'vitamin_b1',
  '405': 'vitamin_b2',
  '406': 'vitamin_b3',
  '415': 'vitamin_b6',
  '417': 'vitamin_b9',
  '418': 'vitamin_b12',
  '255': 'water',
  '262': 'caffeine',
}

/** Categoría de USDA → categoría de ZENCRUS. */
const CATEGORY_MAP: Record<string, string> = {
  '1': 'lacteos', '2': 'especias', '3': 'preparados', '4': 'aceites',
  '5': 'aves', '6': 'preparados', '7': 'carnes', '8': 'cereales',
  '9': 'frutas', '10': 'carnes', '11': 'verduras', '12': 'frutos_secos',
  '13': 'carnes', '14': 'bebidas', '15': 'pescados', '16': 'legumbres',
  '17': 'carnes', '18': 'cereales', '19': 'dulces', '20': 'cereales',
  '21': 'restaurante', '22': 'preparados', '23': 'dulces', '24': 'preparados',
  '25': 'restaurante', '26': 'otros', '27': 'otros', '28': 'bebidas',
}

/** Categorías cuyo contenido no es un alimento natural. */
const KIND_MAP: Record<string, string> = {
  '7': 'procesado', '8': 'procesado', '18': 'procesado', '19': 'ultraprocesado',
  '21': 'restaurante', '22': 'procesado', '23': 'ultraprocesado', '25': 'restaurante',
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

const argValue = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

// ── Acceso a la base ──────────────────────────────────────────────────────────

/**
 * Cliente REST mínimo contra PostgREST.
 *
 * No se usa `@supabase/supabase-js` a propósito: bajo Node 20 su cliente
 * arrastra el módulo de realtime, que no encuentra un WebSocket nativo y mata
 * el proceso dentro de `createClient()` sin lanzar ningún error —el script
 * terminaba con código 0 y la base vacía—. Aquí solo hacen falta lecturas y
 * escrituras de tabla, que es exactamente lo que expone PostgREST por HTTP.
 */
function makeDb(url: string, key: string) {
  const base = `${url.replace(/\/$/, '')}/rest/v1`
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }

  async function request(pathAndQuery: string, init: RequestInit & { prefer?: string } = {}) {
    const { prefer, ...rest } = init
    const res = await fetch(`${base}/${pathAndQuery}`, {
      ...rest,
      headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}), ...(rest.headers ?? {}) },
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`)
    return text ? JSON.parse(text) : null
  }

  return {
    select: (table: string, query: string) => request(`${table}?${query}`),

    insert: (table: string, rows: any[], returning = false) =>
      request(table, {
        method: 'POST',
        body: JSON.stringify(rows),
        prefer: returning ? 'return=representation' : 'return=minimal',
      }),

    /** Inserta o actualiza según la restricción única indicada. */
    upsert: (table: string, rows: any[], onConflict: string, returning = false) =>
      request(`${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        body: JSON.stringify(rows),
        prefer: `resolution=merge-duplicates,${returning ? 'return=representation' : 'return=minimal'}`,
      }),

    patch: (table: string, query: string, body: any) =>
      request(`${table}?${query}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        prefer: 'return=minimal',
      }),

    remove: (table: string, query: string) =>
      request(`${table}?${query}`, { method: 'DELETE', prefer: 'return=minimal' }),
  }
}

/** Trocea un array: PostgREST no acepta cuerpos ilimitados. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Ingesta ───────────────────────────────────────────────────────────────────

async function main() {
  const dir = process.argv[2]
  const sourceCode = argValue('--source') ?? 'usda_sr'
  const dryRun = process.argv.includes('--dry')

  if (!dir) {
    console.error('Uso: npx tsx scripts/ingest-usda.ts <carpeta> [--source usda_sr] [--dry]')
    process.exit(1)
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!dryRun && (!url || !key)) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
    console.error('La clave anónima no puede escribir en el catálogo: está protegido por RLS.')
    process.exit(1)
  }

  console.log(`Leyendo ${dir}…`)
  const foods = readCsv(dir, 'food.csv')
  const nutrientDefs = readCsv(dir, 'nutrient.csv')
  const foodNutrients = readCsv(dir, 'food_nutrient.csv')
  const portions = fs.existsSync(path.join(dir, 'food_portion.csv'))
    ? readCsv(dir, 'food_portion.csv')
    : []

  console.log(`  ${foods.length} alimentos · ${foodNutrients.length} valores · ${portions.length} porciones`)

  const nutrientCodeById = new Map<string, string>()
  for (const n of nutrientDefs) {
    const code = NUTRIENT_BY_NBR[n.nutrient_nbr]
    if (code) nutrientCodeById.set(n.id, code)
  }
  console.log(`  ${nutrientCodeById.size} nutrientes reconocidos de ${nutrientDefs.length}`)

  const valuesByFood = new Map<string, Map<string, number>>()
  for (const r of foodNutrients) {
    const code = nutrientCodeById.get(r.nutrient_id)
    if (!code || !r.amount) continue
    const amount = Number(r.amount)
    if (!Number.isFinite(amount) || amount < 0) continue
    let m = valuesByFood.get(r.fdc_id)
    if (!m) { m = new Map(); valuesByFood.set(r.fdc_id, m) }
    m.set(code, amount)
  }

  const portionsByFood = new Map<string, { description: string; gram_weight: number; seq: number }[]>()
  for (const p of portions) {
    const grams = Number(p.gram_weight)
    if (!Number.isFinite(grams) || grams <= 0) continue
    const desc = (p.portion_description || p.modifier || '').trim()
    if (!desc) continue
    const list = portionsByFood.get(p.fdc_id) ?? []
    list.push({ description: desc, gram_weight: grams, seq: Number(p.seq_num) || list.length })
    portionsByFood.set(p.fdc_id, list)
  }

  // Sin energía declarada no se puede registrar una comida, así que ese alimento
  // no entra: es preferible que falte a que aparezca con calorías inventadas.
  const usable = foods.filter(f => (valuesByFood.get(f.fdc_id)?.get('energy') ?? 0) > 0)
  console.log(`  ${usable.length} con energía declarada (se descartan ${foods.length - usable.length})`)

  if (dryRun) {
    console.log('\n--dry · no se escribe nada. Muestra:\n')
    for (const f of usable.slice(0, 3)) {
      const v = valuesByFood.get(f.fdc_id)!
      console.log(`· ${f.description}`)
      console.log(`  categoría=${CATEGORY_MAP[f.food_category_id] ?? 'otros'} · ${v.size} nutrientes · ${portionsByFood.get(f.fdc_id)?.length ?? 0} porciones`)
      console.log(`  energía=${v.get('energy')} proteína=${v.get('protein')} carbos=${v.get('carbs')} grasa=${v.get('fat')}`)
    }
    const total = usable.reduce((a, f) => a + (valuesByFood.get(f.fdc_id)?.size ?? 0), 0)
    console.log(`\nSe cargarían ${usable.length} alimentos y ${total} valores nutricionales.`)
    return
  }

  const db = makeDb(url!, key!)

  const sources = await db.select('food_sources', `code=eq.${sourceCode}&select=id`)
  if (!sources?.length) throw new Error(`La fuente "${sourceCode}" no existe. ¿Se ejecutó la migración 006?`)
  const sourceId = sources[0].id

  const cats = await db.select('food_categories', 'select=id,code')
  const catId = new Map<string, number>((cats ?? []).map((c: any) => [c.code, c.id]))

  const nuts = await db.select('nutrients', 'select=id,code')
  const nutId = new Map<string, number>((nuts ?? []).map((n: any) => [n.code, n.id]))

  const imp = await db.insert('food_imports', [{
    source_id: sourceId,
    dataset: path.basename(dir),
    notes: `${usable.length} candidatos`,
  }], true)
  const importId = imp?.[0]?.id

  let done = 0
  const BATCH = 300

  for (const slice of chunk(usable, BATCH)) {
    const rows = slice.map(f => ({
      source_id: sourceId,
      source_food_id: f.fdc_id,
      name: f.description,
      name_normalized: normalize(f.description),
      lang: 'en',
      country: 'US',
      category_id: catId.get(CATEGORY_MAP[f.food_category_id] ?? 'otros') ?? null,
      kind: KIND_MAP[f.food_category_id] ?? 'natural',
      base_unit: 'g',
      verified: true,
      published_at: f.publication_date || null,
    }))

    const saved = await db.upsert('foods', rows, 'source_id,source_food_id', true)
    const idByFdc = new Map<string, string>((saved ?? []).map((r: any) => [r.source_food_id, r.id]))

    const nutrientRows: any[] = []
    const portionRows: any[] = []
    for (const f of slice) {
      const foodId = idByFdc.get(f.fdc_id)
      if (!foodId) continue
      for (const [code, amount] of valuesByFood.get(f.fdc_id) ?? []) {
        const nid = nutId.get(code)
        if (nid) nutrientRows.push({ food_id: foodId, nutrient_id: nid, amount })
      }
      for (const p of portionsByFood.get(f.fdc_id) ?? []) {
        portionRows.push({ food_id: foodId, description: p.description, gram_weight: p.gram_weight, seq: p.seq })
      }
    }

    for (const part of chunk(nutrientRows, 2000)) {
      await db.upsert('food_nutrients', part, 'food_id,nutrient_id')
    }

    if (portionRows.length) {
      // Las porciones no tienen clave natural estable, así que se reemplazan
      // enteras en cada carga en lugar de intentar casarlas una a una.
      const ids = [...idByFdc.values()]
      for (const part of chunk(ids, 150)) {
        await db.remove('food_portions', `food_id=in.(${part.join(',')})`)
      }
      for (const part of chunk(portionRows, 2000)) {
        await db.insert('food_portions', part)
      }
    }

    done += slice.length
    process.stdout.write(`\r  cargados ${done}/${usable.length}`)
  }

  console.log('')
  if (importId) {
    await db.patch('food_imports', `id=eq.${importId}`, {
      foods_inserted: done,
      finished_at: new Date().toISOString(),
    })
  }
  console.log(`Listo · ${done} alimentos de ${sourceCode}.`)
}

main().catch(err => { console.error('\n' + err.message); process.exit(1) })
