/**
 * SESIONES DE ENTRENAMIENTO
 * ─────────────────────────
 * Lo que de verdad se hizo, serie a serie. `workoutController` guarda el PLAN
 * (la rutina); esto guarda lo REALIZADO, que casi nunca coincide con el plan y
 * que es lo único de lo que se puede sacar una estadística o una progresión.
 *
 * ── Una sesión abierta, y solo una ──────────────────────────────────────────
 * Lo garantiza un índice único parcial en la base, no una comprobación aquí:
 * dos peticiones a la vez desde el mismo móvil —que es lo que pasa cuando la
 * red va y viene— pasarían las dos por cualquier `if` que escribiéramos. Por
 * eso abrir una sesión cuando ya hay otra NO es un error: devuelve la que hay,
 * marcada como reanudada, y que decida la app si continuarla o cerrarla.
 *
 * ── Registrar una serie no puede fallar dos veces ───────────────────────────
 * Cada serie llega con un `clientId` que pone el teléfono. Si la respuesta se
 * pierde y la app reintenta, la segunda petición devuelve la serie que ya
 * existe en vez de duplicarla. En un gimnasio en un sótano esto no es un caso
 * raro: es el caso normal.
 *
 * ── Nada de esto lo ve nadie más ────────────────────────────────────────────
 * Un entrenamiento es de quien lo hizo. No hay cuentas privadas que resolver ni
 * `socialAccess` que consultar: cada consulta lleva su `eq('user_id', …)` y con
 * eso está todo dicho. Si algún día se comparte un entrenamiento en el muro,
 * será la comunidad quien decida quién lo ve, no esto.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import {
  claveEjercicio, musculoDe, posterDe, completarEsfuerzo, estimar1RM,
  refrescarTotales, registrarRecords, rehacerRecords, calcularTotales,
  estimarGastoDeSesion, SerieGuardada,
} from '../services/workoutSessions'
import { readUrls, mediaReady } from '../services/media'
import { avanzarPrograma } from './programController'

const fail = (res: Response, code: number, message: string) => {
  res.status(code).json({ success: false, message } satisfies ApiResponse)
}

const ok = <T>(res: Response, data: T, code = 200) => {
  res.status(code).json({ success: true, data } satisfies ApiResponse)
}

/** Columnas de una serie. En un sitio, porque se leen en cinco consultas. */
const COLS_SERIE =
  'id, session_id, exercise_slug, exercise_name, exercise_key, muscle, ' +
  'order_index, set_index, kind, load_type, weight_kg, band_color, ' +
  'reps, duration_seconds, distance_m, rir, rpe, rest_taken_seconds, ' +
  'est_1rm, notes, client_id, performed_at'

// ── Esquemas ─────────────────────────────────────────────────────────────────

const MODOS = ['gym', 'home', 'outdoor', 'class'] as const
const ORIGENES = ['routine', 'program', 'class', 'freestyle'] as const

export const abrirSchema = z.object({
  body: z.object({
    clientId: z.string().min(6).max(64),
    mode: z.enum(MODOS).default('gym'),
    source: z.enum(ORIGENES).default('freestyle'),
    title: z.string().min(1).max(120),
    routineId: z.string().uuid().optional(),
    programId: z.string().uuid().optional(),
    programWeek: z.number().int().min(1).max(104).optional(),
    programDay: z.number().int().min(1).max(7).optional(),
  }),
})

/**
 * Una serie.
 *
 * `reps`, `durationSeconds` y `distanceM` son las tres opcionales, y el
 * `superRefine` de abajo exige que llegue AL MENOS UNA. Es la misma regla que
 * la restricción `set_has_a_measure` de la base, escrita aquí también para que
 * el error sea «falta la medida» y no un 500 de Postgres.
 */
export const serieSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    clientId: z.string().min(6).max(64),
    exerciseSlug: z.string().max(120).optional(),
    exerciseName: z.string().min(1).max(120),
    orderIndex: z.number().int().min(0).max(200).default(0),
    setIndex: z.number().int().min(0).max(200).default(0),
    kind: z.enum(['warmup', 'normal', 'dropset', 'failure', 'amrap', 'superset']).default('normal'),
    loadType: z.enum(['weight', 'bodyweight', 'band', 'assisted', 'none']).default('weight'),
    weightKg: z.number().min(-300).max(1000).nullish(),
    bandColor: z.string().max(24).nullish(),
    reps: z.number().int().min(0).max(1000).nullish(),
    durationSeconds: z.number().int().min(0).max(86400).nullish(),
    distanceM: z.number().int().min(0).max(1_000_000).nullish(),
    rir: z.number().int().min(0).max(10).nullish(),
    rpe: z.number().min(1).max(10).nullish(),
    restTakenSeconds: z.number().int().min(0).max(7200).nullish(),
    notes: z.string().max(300).nullish(),
  }).superRefine((b, ctx) => {
    if (b.reps == null && b.durationSeconds == null && b.distanceM == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reps'],
        message: 'Una serie necesita repeticiones, tiempo o distancia.',
      })
    }
  }),
})

export const cerrarSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    durationSeconds: z.number().int().min(0).max(86400).optional(),
    perceivedEffort: z.number().int().min(1).max(10).nullish(),
    notes: z.string().max(1000).nullish(),
    distanceM: z.number().int().min(0).max(1_000_000).nullish(),
    elevationM: z.number().int().min(0).max(20000).nullish(),
    caloriesKcal: z.number().int().min(0).max(20000).nullish(),
    avgHr: z.number().int().min(20).max(250).nullish(),
    maxHr: z.number().int().min(20).max(250).nullish(),
    metrics: z.record(z.unknown()).optional(),
  }),
})

export const listarSchema = z.object({
  query: z.object({
    mode: z.enum(MODOS).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
})

export const historialEjercicioSchema = z.object({
  params: z.object({ key: z.string().min(1).max(160) }),
  query: z.object({ limit: z.coerce.number().int().min(1).max(50).optional() }),
})

// ── Abrir ────────────────────────────────────────────────────────────────────

/**
 * Abre una sesión, o devuelve la que ya estaba abierta.
 *
 * Tres caminos y ninguno es un error:
 *   · Mismo `clientId` que una sesión que ya existe → esa misma (el reintento).
 *   · Hay otra sesión abierta → esa, con `resumed: true`.
 *   · No hay nada → una nueva.
 */
export async function abrirSesion(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { clientId, mode, source, title, routineId, programId, programWeek, programDay } = req.body

  const { data: repetida } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (repetida) {
    ok(res, { session: repetida, sets: await leerSeries(repetida.id), resumed: repetida.status === 'active' })
    return
  }

  const { data: abierta } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (abierta) {
    ok(res, { session: abierta, sets: await leerSeries(abierta.id), resumed: true })
    return
  }

  const { data: creada, error } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: userId,
      client_id: clientId,
      mode, source, title,
      routine_id: routineId ?? null,
      program_id: programId ?? null,
      program_week: programWeek ?? null,
      program_day: programDay ?? null,
    })
    .select()
    .single()

  if (error || !creada) {
    logger.error('No se pudo abrir la sesión de entrenamiento:', error?.message)
    fail(res, 500, 'No se pudo empezar el entrenamiento')
    return
  }

  ok(res, { session: creada, sets: [], resumed: false }, 201)
}

// ── Leer ─────────────────────────────────────────────────────────────────────

async function leerSeries(sessionId: string) {
  const { data } = await supabase
    .from('workout_sets')
    .select(COLS_SERIE)
    .eq('session_id', sessionId)
    .order('order_index', { ascending: true })
    .order('set_index', { ascending: true })
  return data ?? []
}

/**
 * La sesión abierta, con sus series.
 *
 * Es lo primero que pide la app al arrancar. Sin esto, cerrar la aplicación a
 * mitad de un entrenamiento —o que la mate el sistema por quedarse sin
 * memoria— perdería todo lo registrado hasta ahí.
 */
export async function sesionActiva(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: sesion } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (!sesion) { ok(res, null); return }

  ok(res, { session: sesion, sets: await leerSeries(sesion.id) })
}

export async function listarSesiones(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const limit = Number(req.query.limit ?? 20)
  const offset = Number(req.query.offset ?? 0)
  const mode = req.query.mode as string | undefined

  // El historial NO trae las series. Veinte sesiones con cuarenta series cada
  // una son ochocientas filas para pintar una lista que enseña el título, la
  // duración y los kilos — que es justo lo que los totales ya guardan.
  let q = supabase
    .from('workout_sessions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (mode) q = q.eq('mode', mode)

  const { data, count, error } = await q

  if (error) { fail(res, 500, 'No se pudo leer el historial'); return }

  const sesiones = data ?? []

  ok(res, {
    total: count ?? 0,
    offset,
    limit,
    sessions: await conPosters(sesiones),
  })
}

/**
 * Las miniaturas de cada sesión: hasta cuatro pósters de los ejercicios que se
 * hicieron.
 *
 * ── Por qué merece una consulta más ─────────────────────────────────────────
 * Una lista de entrenamientos donde todas las filas llevan el mismo icono de
 * mancuerna obliga a LEER el título para distinguir el día de pierna del de
 * espalda. Con las imágenes se reconocen de un vistazo, que es como se recuerda
 * lo que uno hizo.
 *
 * ── Y por qué no rompe la regla de arriba ───────────────────────────────────
 * El comentario de `listarSesiones` dice que el historial no trae las series, y
 * sigue siendo cierto: esto pide TRES columnas pequeñas —la sesión, el hueco y
 * la clave del ejercicio—, no las filas enteras con sus pesos, sus RIR y sus
 * notas. Va por el índice `wset_session_order`, y de las claves que salen solo
 * se firman las cuatro primeras de cada sesión.
 */
async function conPosters<T extends { id: string }>(
  sesiones: T[],
): Promise<(T & { posters: string[] })[]> {
  if (sesiones.length === 0) return []

  const { data: series } = await supabase
    .from('workout_sets')
    .select('session_id, order_index, exercise_key')
    // Los ocho primeros huecos bastan para sacar cuatro ejercicios distintos, y
    // acotan la consulta por arriba: sin esto, una sesión de treinta huecos
    // traería treinta veces lo que se va a usar.
    .lte('order_index', 7)
    .in('session_id', sesiones.map(s => s.id))
    .order('order_index', { ascending: true })
    // Explícito para no depender del tope invisible del cliente: si algún día
    // se recortara por dentro, las últimas sesiones se quedarían sin miniatura
    // y nadie sabría por qué.
    .limit(3000)

  // Por sesión, las claves distintas en el orden en que se entrenaron. El orden
  // importa: los cuatro primeros ejercicios son los que definen la sesión.
  const clavesPorSesion = new Map<string, string[]>()
  for (const s of series ?? []) {
    let acc = clavesPorSesion.get(s.session_id)
    if (!acc) { acc = []; clavesPorSesion.set(s.session_id, acc) }
    if (acc.length < 4 && !acc.includes(s.exercise_key)) acc.push(s.exercise_key)
  }

  const archivos = [...new Set(
    [...clavesPorSesion.values()].flat()
      .map(posterDe)
      .filter((p): p is string => !!p),
  )]

  const firmadas = mediaReady() && archivos.length
    ? await readUrls(archivos.map(p => `library/poster/${p}`))
    : new Map<string, string>()

  return sesiones.map(s => ({
    ...s,
    posters: (clavesPorSesion.get(s.id) ?? [])
      .map(k => {
        const p = posterDe(k)
        return p ? firmadas.get(`library/poster/${p}`) ?? null : null
      })
      .filter((u): u is string => !!u),
  }))
}

export async function detalleSesion(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: sesion } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!sesion) { fail(res, 404, 'Entrenamiento no encontrado'); return }

  ok(res, { session: sesion, sets: await leerSeries(sesion.id) })
}

// ── Registrar una serie ──────────────────────────────────────────────────────

/**
 * Guarda una serie realizada y devuelve los récords que haya batido.
 *
 * El 1RM estimado, el músculo y la conversión RIR↔RPE los pone el SERVIDOR, no
 * la app. Si los calculara el teléfono, cambiar la fórmula obligaría a que todo
 * el mundo actualizara la app para que sus datos nuevos fueran comparables con
 * los viejos.
 */
export async function registrarSerie(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const sessionId = req.params.id
  const b = req.body

  const { data: sesion } = await supabase
    .from('workout_sessions')
    .select('id, status')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!sesion) { fail(res, 404, 'Entrenamiento no encontrado'); return }
  if (sesion.status !== 'active') { fail(res, 409, 'Este entrenamiento ya está cerrado'); return }

  // Las series que ya tiene la sesión. Una sola consulta que sirve para dos
  // cosas: descartar el reintento y saber qué ejercicio ocupa cada hueco.
  // Una sesión son unas decenas de filas, así que traerlas enteras sale más
  // barato que dos viajes a la base por cada serie registrada.
  // El `select` va con una constante, así que el cliente de Supabase no puede
  // deducir la forma de la fila y devuelve una unión con su tipo de error. Se
  // afirma aquí, en un sitio, en vez de repartir `any` por las cinco líneas
  // que la usan.
  const { data: crudas } = await supabase
    .from('workout_sets')
    .select(COLS_SERIE)
    .eq('session_id', sessionId)

  const previas = (crudas ?? []) as unknown as SerieGuardada[]

  const yaEstaba = previas.find(s => s.client_id === b.clientId)
  if (yaEstaba) { ok(res, { set: yaEstaba, records: [] }); return }

  /**
   * EL HUECO MANDA SOBRE EL NOMBRE.
   *
   * Dentro de una sesión, `order_index` identifica al ejercicio: el hueco 0 es
   * el press de banca de hoy, sus cuatro series incluidas. Si una serie llega
   * sin el slug del catálogo —la app lo pierde en un reintento, o el usuario
   * editó el nombre a media sesión— la clave saldría del nombre escrito y el
   * historial de ese ejercicio se PARTIRÍA EN DOS sin que nadie se entere: las
   * primeras series bajo el slug, las siguientes bajo el nombre. El récord se
   * calcularía sobre la mitad de los datos y «la última vez» mentiría.
   *
   * Así que la primera serie de un hueco fija el ejercicio y las demás lo
   * heredan. Una superserie no se ve afectada: alterna huecos distintos.
   */
  const delHueco = previas.find(s => s.order_index === b.orderIndex)

  const esfuerzo = completarEsfuerzo(b.rir, b.rpe)
  const fila = {
    session_id: sessionId,
    user_id: userId,
    exercise_slug: delHueco?.exercise_slug ?? b.exerciseSlug ?? null,
    exercise_name: delHueco?.exercise_name ?? b.exerciseName,
    exercise_key: delHueco?.exercise_key ?? claveEjercicio(b.exerciseSlug, b.exerciseName),
    muscle: delHueco?.muscle ?? musculoDe(b.exerciseSlug),
    order_index: b.orderIndex,
    set_index: b.setIndex,
    kind: b.kind,
    load_type: b.loadType,
    weight_kg: b.weightKg ?? null,
    band_color: b.bandColor ?? null,
    reps: b.reps ?? null,
    duration_seconds: b.durationSeconds ?? null,
    distance_m: b.distanceM ?? null,
    rir: esfuerzo.rir,
    rpe: esfuerzo.rpe,
    rest_taken_seconds: b.restTakenSeconds ?? null,
    est_1rm: estimar1RM(b.loadType, b.kind, b.weightKg, b.reps),
    notes: b.notes ?? null,
    client_id: b.clientId,
  }

  const { data: creada, error } = await supabase
    .from('workout_sets')
    .insert(fila)
    .select(COLS_SERIE)
    .single()

  if (error || !creada) {
    logger.error('No se pudo registrar la serie:', error?.message)
    fail(res, 500, 'No se pudo registrar la serie')
    return
  }

  const records = await registrarRecords(userId, sessionId, creada as unknown as SerieGuardada)
  await refrescarTotales(sessionId)

  ok(res, { set: creada, records }, 201)
}

/**
 * Borra una serie mal metida.
 *
 * Tras borrarla hay que REHACER los récords de ese ejercicio: si el récord
 * salía de esta serie, se va con ella en cascada, y el anterior no está
 * guardado en ninguna parte. Sin este paso, corregir un «100» que eran «10»
 * dejaría a esa persona sin récord de ese ejercicio para siempre.
 */
export async function borrarSerie(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { id: sessionId, setId } = req.params

  const { data: serie } = await supabase
    .from('workout_sets')
    .select('id, exercise_key')
    .eq('id', setId)
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!serie) { fail(res, 404, 'Serie no encontrada'); return }

  await supabase.from('workout_sets').delete().eq('id', setId).eq('user_id', userId)
  await rehacerRecords(userId, serie.exercise_key)
  await refrescarTotales(sessionId)

  ok(res, { deleted: setId })
}

// ── Cerrar ───────────────────────────────────────────────────────────────────

/**
 * Cierra la sesión.
 *
 * La duración la manda la APP, no se calcula por resta: una sesión se pausa
 * —se deja el móvil, se contesta una llamada— y el tiempo de reloj mentiría
 * sobre lo que se entrenó. Si no llega, se usa la resta, que es mejor que nada.
 */
export async function cerrarSesion(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const b = req.body

  const { data: sesion } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!sesion) { fail(res, 404, 'Entrenamiento no encontrado'); return }
  if (sesion.status !== 'active') { ok(res, { session: sesion, sets: await leerSeries(sesion.id) }); return }

  const series = await leerSeries(sesion.id)
  const ahora = new Date()
  const porReloj = Math.round((ahora.getTime() - new Date(sesion.started_at).getTime()) / 1000)
  const duracion = b.durationSeconds ?? porReloj

  /**
   * El gasto del entrenamiento se estima AQUÍ, al cerrar.
   *
   * Al cerrar y no al leer porque depende del peso corporal del día: recalcular
   * una sesión de hace ocho meses con el peso de hoy cambiaría el pasado cada
   * vez que alguien se pesa. La cifra que se guarda es la del día que se hizo.
   *
   * Lo que manda la app GANA. Un pulsómetro mide y esto solo estima, y la
   * filosofía de la app es que cualquier valor se pueda corregir a mano. Por
   * eso `origen` viaja en `metrics`: una medición y una suposición no pueden
   * parecer lo mismo cuando alguien las lea dentro de un año.
   */
  const gasto = b.caloriesKcal == null
    ? await estimarGastoDeSesion(
        userId,
        { mode: sesion.mode, duration_seconds: duracion },
        series as unknown as SerieGuardada[],
      )
    : null

  const metrics = {
    ...(b.metrics ?? {}),
    ...(b.caloriesKcal != null
      ? { gasto: { origen: 'manual' } }
      : gasto
        ? { gasto: { origen: gasto.origen, met: gasto.met, minutos: gasto.minutos } }
        : {}),
  }

  const { data: cerrada, error } = await supabase
    .from('workout_sessions')
    .update({
      status: 'completed',
      ended_at: ahora.toISOString(),
      duration_seconds: duracion,
      perceived_effort: b.perceivedEffort ?? null,
      notes: b.notes ?? null,
      distance_m: b.distanceM ?? null,
      elevation_m: b.elevationM ?? null,
      calories_kcal: b.caloriesKcal ?? gasto?.kcal ?? null,
      avg_hr: b.avgHr ?? null,
      max_hr: b.maxHr ?? null,
      metrics,
      ...calcularTotales(series as unknown as SerieGuardada[]),
    })
    .eq('id', sesion.id)
    .select()
    .single()

  if (error || !cerrada) {
    logger.error('No se pudo cerrar la sesión:', error?.message)
    fail(res, 500, 'No se pudo guardar el entrenamiento')
    return
  }

  logger.info(`Entrenamiento cerrado (${cerrada.mode}) para usuario: ${userId}`)

  /**
   * Si la sesión era de un programa, el programa avanza AQUÍ.
   *
   * Va después de cerrar y nunca antes: el programa se mueve por lo entrenado,
   * no por lo prometido. Y no puede tumbar el cierre —tiene su propio
   * try/catch— porque perder un entrenamiento por no poder mover un contador
   * sería un intercambio pésimo; el contador se recoloca solo al día siguiente.
   */
  const avance = await avanzarPrograma(userId, cerrada)

  ok(res, { session: cerrada, sets: series, programa: avance })
}

/**
 * Descarta la sesión: se borra, con sus series y con los récords que salieran
 * de ellas.
 *
 * Descartar significa «esto no pasó». Dejar la fila marcada como descartada
 * sería guardar algo que ninguna consulta va a leer nunca, y encima seguiría
 * apareciendo en cualquier recuento que se olvidara de filtrarla.
 */
export async function descartarSesion(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: sesion } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!sesion) { fail(res, 404, 'Entrenamiento no encontrado'); return }

  // Qué ejercicios tocaba, ANTES de borrar: después no hay a quién preguntar.
  const { data: series } = await supabase
    .from('workout_sets')
    .select('exercise_key')
    .eq('session_id', sesion.id)

  const afectados = [...new Set((series ?? []).map(s => s.exercise_key))]

  await supabase.from('workout_sessions').delete().eq('id', sesion.id).eq('user_id', userId)

  for (const key of afectados) await rehacerRecords(userId, key)

  ok(res, { discarded: sesion.id })
}

// ── Récords e historial por ejercicio ────────────────────────────────────────

export async function listarRecords(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', userId)
    .order('achieved_at', { ascending: false })

  if (error) { fail(res, 500, 'No se pudieron leer tus récords'); return }

  const marcas = data ?? []
  const claves = [...new Set(marcas.map(m => posterDe(m.exercise_key)).filter((p): p is string => !!p))]
  const firmadas = mediaReady() && claves.length
    ? await readUrls(claves.map(p => `library/poster/${p}`))
    : new Map<string, string>()

  ok(res, marcas.map(m => {
    const poster = posterDe(m.exercise_key)
    return { ...m, poster: poster ? firmadas.get(`library/poster/${poster}`) ?? null : null }
  }))
}

/**
 * Las últimas series de un ejercicio.
 *
 * Es lo que la app enseña al empezar un ejercicio: «la última vez, 80 kg × 8».
 * Sin ese dato delante, quien entrena tiene que acordarse de lo que hizo hace
 * cinco días o abrir el historial a mano, y acaba repitiendo el mismo peso
 * durante meses sin darse cuenta.
 */
export async function historialEjercicio(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const limit = Number(req.query.limit ?? 12)

  const { data, error } = await supabase
    .from('workout_sets')
    .select(COLS_SERIE)
    .eq('user_id', userId)
    .eq('exercise_key', req.params.key)
    .neq('kind', 'warmup')
    .order('performed_at', { ascending: false })
    .limit(limit)

  if (error) { fail(res, 500, 'No se pudo leer el historial del ejercicio'); return }

  const { data: records } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', userId)
    .eq('exercise_key', req.params.key)

  ok(res, { sets: data ?? [], records: records ?? [] })
}
