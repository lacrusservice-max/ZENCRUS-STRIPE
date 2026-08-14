/**
 * ACTIVIDAD DIARIA Y RACHAS
 * ─────────────────────────
 * Lo que se hizo cada día: comer, entrenar, el check-in, el agua. Y el día
 * salvado con un protector, que es el único de los cinco que no se puede
 * deducir de nada — hay que guardarlo.
 *
 * ── Las rachas no están en la tabla ─────────────────────────────────────────
 * `streakStore` guardaba `currentStreak`, `longestStreak` y `totalDaysActive`
 * en AsyncStorage. Aquí no hay columnas para eso: salen de la serie al leer.
 * El cálculo vive en `services/streaks.ts`, aparte y sin base de datos, para
 * poder probarlo con series escritas a mano.
 *
 * ── El día de hoy lo dice el cliente ────────────────────────────────────────
 * Railway corre en UTC. A las 19:00 de Ciudad de México el servidor ya cree que
 * es mañana, y una racha calculada con SU fecha se rompería sola cada tarde a
 * quien todavía no ha cenado. Por eso `hoy` es un parámetro. Cuando no llega
 * —ZENA no tiene teléfono— se usa la del servidor, que para leer el histórico
 * de alguien es suficiente.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import { calcularRachas, DiaActividad } from '../services/streaks'

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser YYYY-MM-DD')

/** Ocho años de días. Más allá el `longest` da igual y la app no existía. */
const TOPE_FILAS = 3000

// ── Esquemas ─────────────────────────────────────────────────────────────────

export const rangoActividadSchema = z.object({
  query: z.object({
    desde: FECHA.optional(),
    hasta: FECHA.optional(),
    hoy: FECHA.optional(),
  }).refine(q => !q.desde || !q.hasta || q.desde <= q.hasta, 'El rango está invertido'),
})

const banderas = {
  loggedFood: z.boolean().optional(),
  loggedWorkout: z.boolean().optional(),
  checkInDone: z.boolean().optional(),
  drankWater: z.boolean().optional(),
  protegido: z.boolean().optional(),
}

export const marcarActividadSchema = z.object({
  params: z.object({ fecha: FECHA }),
  body: z.object(banderas).refine(b => Object.keys(b).length > 0, 'Nada que marcar'),
})

export const registrarLoteActividadSchema = z.object({
  body: z.object({
    days: z.array(z.object({ date: FECHA, ...banderas })).min(1).max(1000),
  }),
})

// ── Traducción ───────────────────────────────────────────────────────────────

function aDia(f: any): DiaActividad {
  return {
    date: f.activity_date,
    loggedFood: f.logged_food,
    loggedWorkout: f.logged_workout,
    checkInDone: f.check_in_done,
    drankWater: f.drank_water,
    protegido: f.protegido,
  }
}

const COLUMNAS: Record<string, string> = {
  loggedFood: 'logged_food',
  loggedWorkout: 'logged_workout',
  checkInDone: 'check_in_done',
  drankWater: 'drank_water',
  protegido: 'protegido',
}

/** El día del servidor, en UTC. Solo se usa cuando el cliente no manda el suyo. */
const hoyUTC = () => new Date().toISOString().slice(0, 10)

// ── Endpoints ────────────────────────────────────────────────────────────────

/**
 * GET /tracking/activity — los días y las rachas.
 *
 * Se lee el histórico ENTERO aunque se pidan doce semanas, y luego se recorta.
 * Es a propósito: la mejor racha de alguien puede estar en marzo, y calcularla
 * solo sobre la ventana que pinta el calendario le bajaría el récord por el
 * simple hecho de mirarlo. Es una fila por día — un usuario de tres años son
 * mil filas — así que sale más barato que la segunda consulta que haría falta
 * para calcularlo aparte.
 */
export async function obtenerActividad(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { desde, hasta, hoy } = req.query as { desde?: string; hasta?: string; hoy?: string }

  const { data, error } = await supabase
    .from('activity_days')
    .select('*')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false })
    .limit(TOPE_FILAS)

  if (error) {
    logger.error('obtenerActividad:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo leer la actividad' } satisfies ApiResponse)
    return
  }

  const todos = (data || []).map(aDia)
  const ventana = todos
    .filter(d => (!desde || d.date >= desde) && (!hasta || d.date <= hasta))
    .sort((a, b) => a.date.localeCompare(b.date))

  res.status(200).json({
    success: true,
    data: {
      days: ventana,
      streak: calcularRachas(todos, hoy ?? hoyUTC()),
    },
  } satisfies ApiResponse)
}

/**
 * PUT /tracking/activity/:fecha — marcar lo que se hizo.
 *
 * Solo viajan las banderas que cambian. El `upsert` de PostgREST actualiza
 * únicamente las columnas que van en el cuerpo, así que apuntar el entrenamiento
 * no borra que ya se había comido — que es exactamente lo que hacía
 * `markActivity` en el móvil con su `{ ...current, ...updates }`.
 */
export async function marcarActividad(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { fecha } = req.params
  const b = req.body as Record<string, boolean>

  const fila: Record<string, unknown> = { user_id: userId, activity_date: fecha }
  for (const [campo, columna] of Object.entries(COLUMNAS)) {
    if (b[campo] !== undefined) fila[columna] = b[campo]
  }

  const { data, error } = await supabase
    .from('activity_days')
    .upsert(fila, { onConflict: 'user_id,activity_date' })
    .select()
    .single()

  if (error) {
    logger.error('marcarActividad:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar la actividad' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: aDia(data) } satisfies ApiResponse)
}

/**
 * POST /tracking/activity/batch — el histórico del teléfono.
 *
 * Aquí las cinco banderas van SIEMPRE, completas, y no es palabrería: en un
 * `upsert` de varias filas PostgREST une las columnas de todas y rellena con el
 * valor por defecto las que falten en alguna. Con banderas parciales, un día
 * que solo trae `loggedFood` pondría el resto a `false` y borraría lo que ya
 * hubiera guardado de ese día.
 */
export async function registrarLoteActividad(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { days } = req.body as { days: Array<Record<string, any>> }

  const filas = days.map(d => ({
    user_id: userId,
    activity_date: d.date,
    logged_food: d.loggedFood ?? false,
    logged_workout: d.loggedWorkout ?? false,
    check_in_done: d.checkInDone ?? false,
    drank_water: d.drankWater ?? false,
    protegido: d.protegido ?? false,
  }))

  const { data, error } = await supabase
    .from('activity_days')
    .upsert(filas, { onConflict: 'user_id,activity_date' })
    .select()

  if (error) {
    logger.error('registrarLoteActividad:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar la actividad' } satisfies ApiResponse)
    return
  }

  res.status(201).json({
    success: true,
    data: { days: (data || []).map(aDia), count: data?.length ?? 0 },
  } satisfies ApiResponse)
}
