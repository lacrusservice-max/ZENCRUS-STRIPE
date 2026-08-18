/**
 * BANCO DE PRUEBAS DE PUNTA A PUNTA
 * ═════════════════════════════════
 * Monta express solo con el router que se prueba y firma un token de verdad,
 * así que se recorre la cadena entera —autenticación, validate, controlador,
 * Supabase— y no una imitación que estaría de acuerdo conmigo.
 *
 * ⚠️ ESTO ESCRIBE EN LA BASE DE PRODUCCIÓN ⚠️
 *
 * No hay base de pruebas: `SUPABASE_URL` apunta a la real y el usuario de
 * abajo es una CUENTA DE VERDAD, con la app instalada en un teléfono que
 * escribe en estas mismas tablas. Por eso estas pruebas no cuelgan de
 * `npm test` —donde se ejecutarían sin querer— sino de `npm run test:e2e`.
 *
 * Lo que hace que sea seguro correrlas es una sola regla, y hay que respetarla
 * al añadir cualquier caso nuevo:
 *
 *   TODO lo que escriban las pruebas lleva fecha centinela de 2098/2099 o
 *   llave con prefijo `t_`, y SOLO eso se borra al terminar.
 *
 * Una versión anterior de este archivo hacía `delete().eq('user_id', …)` sin
 * más sobre `habit_definitions`, `habit_logs` y `macro_cycles`. Eso se lleva
 * por delante los hábitos y el ciclado reales del usuario, y no se nota hasta
 * que alguien abre la app y no están.
 *
 * Si una tabla no tiene por dónde acotar —`macro_cycles` es una fila por
 * usuario— no se borra: se guarda antes y se devuelve después.
 */

import 'dotenv/config'
import express, { Router } from 'express'
import { signAccessToken } from '../src/utils/jwt'
import { supabase } from '../src/config/supabase'

/** caleblacrus@gmail.com — cuenta real, no desechable. */
export const USUARIO = '4dbbdc3f-f3c0-4ca5-b76b-486126a93e8e'

/**
 * Un desconocido, para probar el aislamiento entre cuentas. No existe en
 * `users` y no hace falta que exista: solo se usa para intentar leer y tocar
 * filas ajenas, que es justo lo que debe fallar.
 */
export const INTRUSO = '00000000-0000-4000-8000-0000000000ff'

export const SEMANA = '2098-W01'
export const PREFIJO = 't_'
/** Nada anterior a esta fecha es de las pruebas. */
export const CENTINELA = '2098-01-01'

export function montar(prefijo: string, router: Router) {
  const app = express()
  app.use(express.json())
  app.use(prefijo, router)
  return app
}

export function token(userId: string): string {
  return signAccessToken({
    userId,
    email: `pruebas-${userId.slice(0, 8)}@zencrus.test`,
    role: 'user',
    subscriptionTier: 'monthly',
  })
}

// ── Aserciones ───────────────────────────────────────────────────────────────

let pasadas = 0
let fallidas = 0
const fallos: string[] = []

export function ok(condicion: boolean, nombre: string, detalle?: unknown): void {
  if (condicion) {
    pasadas++
    console.log(`  ✓ ${nombre}`)
  } else {
    fallidas++
    fallos.push(nombre)
    console.log(`  ✗ ${nombre}${detalle !== undefined ? ` → ${JSON.stringify(detalle)}` : ''}`)
  }
}

export function igual(actual: unknown, esperado: unknown, nombre: string): void {
  const bien = JSON.stringify(actual) === JSON.stringify(esperado)
  ok(bien, nombre, bien ? undefined : { actual, esperado })
}

export function seccion(nombre: string): void {
  console.log(`\n── ${nombre} ${'─'.repeat(Math.max(0, 58 - nombre.length))}`)
}

export function resumen(): number {
  console.log(`\n${'═'.repeat(64)}`)
  console.log(`${pasadas + fallidas} pruebas · ${pasadas} bien · ${fallidas} mal`)
  if (fallos.length) console.log('Fallaron:\n  - ' + fallos.join('\n  - '))
  return fallidas
}

/** Para encadenar suites sin que el marcador se reinicie. */
export const marcador = () => ({ pasadas, fallidas })

/**
 * Cuándo empezó todo esto.
 *
 * `acciones_pendientes`, `plan_versions` y `audit_logs` no tienen fecha
 * centinela por donde agarrarlas: sus filas llevan la de verdad, la de ahora
 * mismo. Lo que sí se puede afirmar es que nada anterior a este instante lo
 * escribieron las pruebas, y eso basta para borrar solo lo suyo.
 *
 * El margen es de segundos, así que el riesgo real es que el usuario confirme
 * un cambio de ZENA desde su teléfono justo mientras corre el banco. Si eso
 * llega a preocupar, la alternativa es apuntar los ids de cada fila creada —
 * más código y más frágil, porque basta olvidarse de uno.
 */
export const ARRANQUE = new Date().toISOString()

// ── El ciclado de macros: guardar y devolver ─────────────────────────────────
// Es una fila por usuario y las pruebas la sobrescriben. Sin esto, correr el
// banco le cambiaría a alguien su ciclado de verdad.

let cicloPrevio: Record<string, unknown> | null = null
let cicloGuardado = false

export async function guardarCiclo(): Promise<void> {
  const { data } = await supabase.from('macro_cycles').select('*').eq('user_id', USUARIO).maybeSingle()
  cicloPrevio = data ?? null
  cicloGuardado = true
}

async function restaurarCiclo(): Promise<void> {
  if (!cicloGuardado) return
  if (cicloPrevio) {
    await supabase.from('macro_cycles').upsert(cicloPrevio, { onConflict: 'user_id' })
  } else {
    await supabase.from('macro_cycles').delete().eq('user_id', USUARIO)
  }
}

// ── Los objetivos del usuario: guardar y devolver ────────────────────────────
// `users.goals` es una columna de una fila, igual que el ciclado, y las
// confirmaciones la escriben. Aquí no vale borrar: hay que dejarla como estaba
// o el usuario abre la app y sus calorías son otras.

let goalsPrevios: Record<string, unknown> | null = null
let goalsGuardados = false

export async function guardarGoals(): Promise<void> {
  const { data } = await supabase.from('users').select('goals').eq('id', USUARIO).maybeSingle()
  goalsPrevios = (data?.goals ?? null) as Record<string, unknown> | null
  goalsGuardados = true
}

async function restaurarGoals(): Promise<void> {
  if (!goalsGuardados) return
  await supabase.from('users').update({ goals: goalsPrevios }).eq('id', USUARIO)
}

// ── Limpieza ─────────────────────────────────────────────────────────────────

/**
 * Borra únicamente lo que estas pruebas escriben.
 *
 * Las metas se limpian por FECHA y no por prefijo de `clientId`: las de la
 * migración nacen con `g_…` y las de los endpoints con `t_…`, y la fecha
 * centinela las cubre todas sin depender de recordar cada prefijo — que es
 * exactamente el fallo que hizo que una suite heredara la basura de otra.
 */
export async function limpiar(): Promise<void> {
  await Promise.all([
    supabase.from('body_metrics').delete().eq('user_id', USUARIO).gte('measured_on', CENTINELA),
    supabase.from('activity_days').delete().eq('user_id', USUARIO).gte('activity_date', CENTINELA),
    supabase.from('meal_plans').delete().eq('user_id', USUARIO).eq('week', SEMANA),
    supabase.from('user_goals').delete().eq('user_id', USUARIO).gte('start_date', CENTINELA),
    supabase.from('habit_logs').delete().eq('user_id', USUARIO).gte('log_date', CENTINELA),
    // Solo los hábitos que inventan las pruebas. Los cinco de fábrica que
    // siembra el servidor NO se tocan: son los del usuario.
    supabase.from('habit_definitions').delete().eq('user_id', USUARIO).like('habit_key', `${PREFIJO}%`),
    supabase.from('meal_logs').delete().eq('user_id', USUARIO).gte('log_date', CENTINELA),
    // Las tres del flujo de confirmación, acotadas por el arranque del banco.
    supabase.from('acciones_pendientes').delete().eq('user_id', USUARIO).gte('created_at', ARRANQUE),
    supabase.from('plan_versions').delete().eq('user_id', USUARIO).gte('created_at', ARRANQUE),
    supabase.from('audit_logs').delete().eq('user_id', USUARIO).gte('created_at', ARRANQUE)
      .like('action', 'ia_accion_%'),
    // §12. Las alertas de contención y los avisos de nivel 2/3 que levanten
    // las pruebas: nunca son de una persona, siempre de un caso inventado.
    supabase.from('audit_logs').delete().eq('user_id', USUARIO).gte('created_at', ARRANQUE)
      .in('action', ['contencion_activada', 'tca_nivel_2', 'tca_nivel_3']),
    supabase.from('senales_tca').delete().eq('user_id', USUARIO).gte('detectada_at', ARRANQUE),
  ])
  await restaurarCiclo()
  await restaurarGoals()
  await limpiarCatalogo()
}

/**
 * Los platillos de prueba del catálogo COMÚN.
 *
 * `foods` no tiene `user_id`: lo que se cree ahí lo ve todo el mundo en el
 * buscador, así que no vale la fecha centinela. La red es el nombre: todo lo
 * que crean las pruebas empieza por `t_`, y esto barre lo que sobreviva a un
 * fallo a mitad. Va después de las demás porque las recetas apuntan a
 * ingredientes reales y hay que soltarlas antes de borrar la ficha.
 */
async function limpiarCatalogo(): Promise<void> {
  const { data } = await supabase.from('foods').select('id').like('name', 't\\_%')
  for (const f of data ?? []) {
    await supabase.from('food_recipes').delete().eq('food_id', f.id)
    await supabase.from('food_nutrients').delete().eq('food_id', f.id)
    await supabase.from('food_portions').delete().eq('food_id', f.id)
    await supabase.from('foods').delete().eq('id', f.id)
  }
}
