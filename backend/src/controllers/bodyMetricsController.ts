/**
 * PESO Y MEDIDAS
 * ──────────────
 * Una fila por medición. Es la tabla que fusiona `progressStore` y
 * `bodyMeasurementsStore`, que hasta ahora guardaban lo mismo con nombres
 * distintos y en dos sitios distintos: había dos verdades sobre cuánto pesa
 * alguien y ninguna mandaba. `profile-stats.tsx` llegaba a leer de las dos a la
 * vez.
 *
 * Como bug de pantalla eso es molesto; como base para ZENA es incompatible. Si
 * le preguntan «¿cuánto peso?» tiene que haber UNA respuesta, y si le piden
 * «apunta que peso 80» tiene que haber UN sitio donde escribirlo.
 *
 * ── El vocabulario de aquí es el del store más completo ─────────────────────
 * Se habla en los nombres de `BodyMeasurement` (`weight`, `leftArm`,
 * `bodyFatPct`…) porque son un superconjunto de los de `progressStore`. Así uno
 * de los dos stores no traduce nada y el otro traduce un puñado de campos; al
 * revés habría que inventar nombres nuevos y traducir en los dos.
 *
 * ── Todo es opcional menos la fecha ─────────────────────────────────────────
 * Alguien puede pesarse sin medirse, medirse sin pesarse, o apuntar solo el
 * porcentaje de grasa que le dio la báscula. Lo único que se rechaza es la fila
 * sin ninguna medida, que no es un dato: es ruido.
 *
 * ── Dos mediciones el mismo día son dos filas ───────────────────────────────
 * La llave única es `client_id`, no la fecha, y es deliberado. Pesarse varias
 * veces al día es una de las señales del §12 de la especificación; colapsar el
 * día en una fila la borraría justo antes de que sirviera para algo.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'

const ORIGENES = ['manual', 'scale', 'ai', 'import'] as const

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser YYYY-MM-DD')

// ── Esquemas ─────────────────────────────────────────────────────────────────
//
// Los rangos son los mismos `check` que ya tiene la tabla, repetidos aquí a
// propósito. La base es la que garantiza que no entre basura; esto es para que
// una cintura de 900 cm conteste 422 con el campo que falla en vez de un 500
// con un mensaje de Postgres que el móvil no sabe enseñar.

const medicionBase = {
  clientId: z.string().min(1).max(120),
  weight: z.number().min(20).max(400).optional(),
  bodyFatPct: z.number().min(1).max(70).optional(),
  muscleMassPct: z.number().min(1).max(80).optional(),
  neck: z.number().min(10).max(100).optional(),
  shoulders: z.number().min(40).max(200).optional(),
  chest: z.number().min(40).max(200).optional(),
  waist: z.number().min(30).max(250).optional(),
  hips: z.number().min(40).max(250).optional(),
  leftArm: z.number().min(10).max(100).optional(),
  rightArm: z.number().min(10).max(100).optional(),
  leftThigh: z.number().min(20).max(120).optional(),
  rightThigh: z.number().min(20).max(120).optional(),
  note: z.string().max(500).optional(),
  source: z.enum(ORIGENES).default('manual'),
}

const MEDIDAS = [
  'weight', 'bodyFatPct', 'muscleMassPct', 'neck', 'shoulders', 'chest',
  'waist', 'hips', 'leftArm', 'rightArm', 'leftThigh', 'rightThigh',
] as const

const tieneAlgunaMedida = (m: Record<string, unknown>) =>
  MEDIDAS.some(campo => m[campo] !== undefined && m[campo] !== null)

const medicion = z.object({ ...medicionBase, date: FECHA })
  .refine(tieneAlgunaMedida, 'Una medición sin ninguna medida no es un dato')

export const registrarMedicionSchema = z.object({ body: medicion })

/**
 * Alta en lote. Existe para la migración: quien lleve meses apuntando su peso
 * en el teléfono sube todo su histórico de una vez en el primer arranque, y
 * hacerlo con una petición por fila convertiría eso en cientos de idas y
 * vueltas que se cortan a la mitad en cuanto el usuario cierra la app.
 */
export const registrarLoteSchema = z.object({
  body: z.object({
    entries: z.array(medicion).min(1).max(200),
  }),
})

export const actualizarMedicionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ ...medicionBase, date: FECHA.optional() })
    .partial()
    .refine(b => Object.keys(b).length > 0, 'Nada que actualizar'),
})

export const idMedicionSchema = z.object({ params: z.object({ id: z.string().uuid() }) })

export const rangoMedicionesSchema = z.object({
  query: z.object({
    desde: FECHA.optional(),
    hasta: FECHA.optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  }).refine(q => !q.desde || !q.hasta || q.desde <= q.hasta, 'El rango está invertido'),
})

// ── Traducción entre la app y la base ────────────────────────────────────────

function aFila(m: Record<string, any>, userId: string) {
  return {
    user_id: userId,
    measured_on: m.date,
    client_id: m.clientId,
    weight_kg: m.weight ?? null,
    body_fat_pct: m.bodyFatPct ?? null,
    muscle_mass_pct: m.muscleMassPct ?? null,
    neck_cm: m.neck ?? null,
    shoulders_cm: m.shoulders ?? null,
    chest_cm: m.chest ?? null,
    waist_cm: m.waist ?? null,
    hips_cm: m.hips ?? null,
    arm_left_cm: m.leftArm ?? null,
    arm_right_cm: m.rightArm ?? null,
    thigh_left_cm: m.leftThigh ?? null,
    thigh_right_cm: m.rightThigh ?? null,
    note: m.note ?? null,
    source: m.source ?? 'manual',
  }
}

/** `null` fuera; `undefined` dentro. El store distingue «no medido» por ausencia. */
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v))

function aMedicion(f: any) {
  return {
    id: f.id,
    clientId: f.client_id,
    date: f.measured_on,
    weight: num(f.weight_kg),
    bodyFatPct: num(f.body_fat_pct),
    muscleMassPct: num(f.muscle_mass_pct),
    neck: num(f.neck_cm),
    shoulders: num(f.shoulders_cm),
    chest: num(f.chest_cm),
    waist: num(f.waist_cm),
    hips: num(f.hips_cm),
    leftArm: num(f.arm_left_cm),
    rightArm: num(f.arm_right_cm),
    leftThigh: num(f.thigh_left_cm),
    rightThigh: num(f.thigh_right_cm),
    note: f.note ?? undefined,
    source: f.source,
    createdAt: f.created_at,
  }
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/** GET /tracking/body — el histórico, de lo más reciente hacia atrás. */
export async function obtenerMediciones(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { desde, hasta, limit } = req.query as unknown as { desde?: string; hasta?: string; limit: number }

  let q = supabase
    .from('body_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('measured_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (desde) q = q.gte('measured_on', desde)
  if (hasta) q = q.lte('measured_on', hasta)

  const { data, error } = await q

  if (error) {
    logger.error('obtenerMediciones:', error.message)
    res.status(500).json({ success: false, message: 'No se pudieron leer las medidas' } satisfies ApiResponse)
    return
  }

  res.status(200).json({
    success: true,
    data: { entries: (data || []).map(aMedicion) },
  } satisfies ApiResponse)
}

/**
 * GET /tracking/body/latest — la última medición y el último peso.
 *
 * Son dos filas distintas y por eso van dos consultas. «¿Cuánto peso?» pregunta
 * por la última fila CON peso, que no tiene por qué ser la última fila: alguien
 * pudo medirse la cintura ayer sin subirse a la báscula. Devolver solo la
 * última haría que ZENA contestara «no lo sé» a la pregunta más frecuente que
 * existe, teniendo el dato guardado.
 */
export async function obtenerUltima(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const [ultimaRes, pesoRes] = await Promise.all([
    supabase
      .from('body_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('measured_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('body_metrics')
      .select('*')
      .eq('user_id', userId)
      .not('weight_kg', 'is', null)
      .order('measured_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const fallo = ultimaRes.error || pesoRes.error
  if (fallo) {
    logger.error('obtenerUltima:', fallo.message)
    res.status(500).json({ success: false, message: 'No se pudo leer la última medida' } satisfies ApiResponse)
    return
  }

  res.status(200).json({
    success: true,
    data: {
      latest: ultimaRes.data ? aMedicion(ultimaRes.data) : null,
      latestWeight: pesoRes.data ? aMedicion(pesoRes.data) : null,
    },
  } satisfies ApiResponse)
}

/** POST /tracking/body — apuntar peso, medidas o las dos cosas. */
export async function registrarMedicion(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data, error } = await supabase
    .from('body_metrics')
    .upsert(aFila(req.body, userId), { onConflict: 'user_id,client_id' })
    .select()
    .single()

  if (error) {
    logger.error('registrarMedicion:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar la medida' } satisfies ApiResponse)
    return
  }

  res.status(201).json({ success: true, data: aMedicion(data) } satisfies ApiResponse)
}

/** POST /tracking/body/batch — el histórico del teléfono, de una vez. */
export async function registrarLoteMediciones(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { entries } = req.body

  const { data, error } = await supabase
    .from('body_metrics')
    .upsert(entries.map((m: any) => aFila(m, userId)), { onConflict: 'user_id,client_id' })
    .select()

  if (error) {
    logger.error('registrarLoteMediciones:', error.message)
    res.status(500).json({ success: false, message: 'No se pudieron guardar las medidas' } satisfies ApiResponse)
    return
  }

  res.status(201).json({
    success: true,
    data: { entries: (data || []).map(aMedicion), count: data?.length ?? 0 },
  } satisfies ApiResponse)
}

/** PATCH /tracking/body/:id — corregir una medición ya apuntada. */
export async function actualizarMedicion(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { id } = req.params
  const b = req.body as Record<string, unknown>

  // Solo se tocan los campos que llegaron: `aFila` pondría a null los ausentes
  // y corregir la cintura borraría el peso de esa misma fila.
  const columnas: Record<string, string> = {
    date: 'measured_on', weight: 'weight_kg', bodyFatPct: 'body_fat_pct',
    muscleMassPct: 'muscle_mass_pct', neck: 'neck_cm', shoulders: 'shoulders_cm',
    chest: 'chest_cm', waist: 'waist_cm', hips: 'hips_cm', leftArm: 'arm_left_cm',
    rightArm: 'arm_right_cm', leftThigh: 'thigh_left_cm', rightThigh: 'thigh_right_cm',
    note: 'note', source: 'source',
  }

  const cambios: Record<string, unknown> = {}
  for (const [campo, columna] of Object.entries(columnas)) {
    if (b[campo] !== undefined) cambios[columna] = b[campo]
  }

  // El `eq('user_id')` no es redundante con el id: es lo que impide que un id
  // ajeno adivinado toque la fila de otra persona.
  const { data, error } = await supabase
    .from('body_metrics')
    .update(cambios)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (error) {
    logger.error('actualizarMedicion:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo actualizar la medida' } satisfies ApiResponse)
    return
  }
  if (!data) {
    res.status(404).json({ success: false, message: 'Medición no encontrada' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: aMedicion(data) } satisfies ApiResponse)
}

/**
 * DELETE /tracking/body/:id — borrado de verdad.
 *
 * A diferencia del registro de comida, aquí no hay `deleted_at`: una medida mal
 * apuntada —80 en vez de 8.0 de grasa— es un error de dedo que descuadra todas
 * las gráficas, y lo que se quiere es que desaparezca, no que se pueda
 * recuperar durante treinta días.
 */
export async function eliminarMedicion(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { id } = req.params

  const { data, error } = await supabase
    .from('body_metrics')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    logger.error('eliminarMedicion:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo eliminar la medida' } satisfies ApiResponse)
    return
  }
  if (!data) {
    res.status(404).json({ success: false, message: 'Medición no encontrada' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: { id, deleted: true } } satisfies ApiResponse)
}
