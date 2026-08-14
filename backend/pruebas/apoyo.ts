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
  ])
  await restaurarCiclo()
}
