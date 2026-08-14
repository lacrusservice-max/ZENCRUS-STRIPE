/**
 * METAS
 * ─────
 * Metas con fecha: bajar 3 kilos para el 20 de diciembre, entrenar cuatro veces
 * por semana, llegar a 60 días de racha. El progreso no se guarda —se calcula
 * comparando el valor actual contra el ritmo esperado, y de eso ya se encarga
 * `goalProgress.ts` en el móvil— así que aquí solo vive el enunciado.
 *
 * ── Una meta no se borra, se cierra ─────────────────────────────────────────
 * `DELETE` pone `estado='abandonada'`. Una meta cumplida es exactamente lo que
 * ZENA quiere recordar: para celebrarlo cuando toque y para proponer la
 * siguiente sabiendo de dónde viene. Borrarlas dejaría a la coach felicitando
 * por un primer logro a alguien que lleva ocho.
 *
 * La interfaz del store no se entera: `deleteGoal` sigue llamando a DELETE y la
 * meta sigue desapareciendo de la lista, porque la lista pide las activas.
 *
 * ── Los límites clínicos no están aquí todavía ──────────────────────────────
 * El §12 de la especificación pide rechazar un peso objetivo fuera de rango
 * saludable, y hace falta la talla del perfil para saber cuál es ese rango. Es
 * el paso 11 del orden de implementación y tiene que ser un módulo compartido
 * por este endpoint y por las herramientas de ZENA: escribirlo dos veces
 * garantiza que un día solo uno de los dos proteja.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'

const TIPOS = ['weight', 'workout_frequency', 'streak', 'custom'] as const
const DIRECCIONES = ['increase', 'decrease'] as const
const ESTADOS = ['activa', 'cumplida', 'abandonada', 'expirada'] as const

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser YYYY-MM-DD')

// ── Esquemas ─────────────────────────────────────────────────────────────────

export const listarMetasSchema = z.object({
  query: z.object({
    estado: z.enum(ESTADOS).optional(),
  }),
})

export const crearMetaSchema = z.object({
  body: z.object({
    clientId: z.string().min(1).max(120),
    title: z.string().min(1).max(200),
    type: z.enum(TIPOS),
    direction: z.enum(DIRECCIONES),
    startValue: z.number().min(-100000).max(100000),
    targetValue: z.number().min(-100000).max(100000),
    startDate: FECHA,
    targetDate: FECHA,
    unit: z.string().min(1).max(40),
  }).refine(b => b.targetDate >= b.startDate, 'La meta termina antes de empezar'),
})

export const actualizarMetaSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    targetValue: z.number().min(-100000).max(100000).optional(),
    targetDate: FECHA.optional(),
    estado: z.enum(ESTADOS).optional(),
  }).refine(b => Object.keys(b).length > 0, 'Nada que actualizar'),
})

export const idMetaSchema = z.object({ params: z.object({ id: z.string().uuid() }) })

// ── Traducción ───────────────────────────────────────────────────────────────
// El móvil habla en `type` y `direction`; la tabla en `tipo` y `direccion`. Se
// mantienen los nombres del store para que `goalsStore` y `goalProgress.ts` no
// tengan que tocar su `Goal`.

function aFila(m: any, userId: string) {
  return {
    user_id: userId,
    client_id: m.clientId,
    title: m.title,
    tipo: m.type,
    direccion: m.direction,
    start_value: m.startValue,
    target_value: m.targetValue,
    start_date: m.startDate,
    target_date: m.targetDate,
    unit: m.unit,
  }
}

function aMeta(f: any) {
  return {
    id: f.id,
    clientId: f.client_id,
    title: f.title,
    type: f.tipo,
    direction: f.direccion,
    startValue: Number(f.start_value),
    targetValue: Number(f.target_value),
    startDate: f.start_date,
    targetDate: f.target_date,
    unit: f.unit,
    estado: f.estado,
    cerradaEn: f.cerrada_en,
    createdAt: f.created_at,
  }
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/** GET /tracking/goals — sin filtro devuelve todas; la app pide las activas. */
export async function listarMetas(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { estado } = req.query as { estado?: string }

  let q = supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', userId)
    .order('target_date', { ascending: true })

  if (estado) q = q.eq('estado', estado)

  const { data, error } = await q

  if (error) {
    logger.error('listarMetas:', error.message)
    res.status(500).json({ success: false, message: 'No se pudieron leer las metas' } satisfies ApiResponse)
    return
  }

  res.status(200).json({
    success: true,
    data: { goals: (data || []).map(aMeta) },
  } satisfies ApiResponse)
}

/** POST /tracking/goals — plantear una meta. */
export async function crearMeta(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data, error } = await supabase
    .from('user_goals')
    .upsert(aFila(req.body, userId), { onConflict: 'user_id,client_id' })
    .select()
    .single()

  if (error) {
    logger.error('crearMeta:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo crear la meta' } satisfies ApiResponse)
    return
  }

  res.status(201).json({ success: true, data: aMeta(data) } satisfies ApiResponse)
}

/** PATCH /tracking/goals/:id — corregirla o cerrarla. */
export async function actualizarMeta(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { id } = req.params
  const b = req.body

  const cambios: Record<string, unknown> = {}
  if (b.title !== undefined) cambios.title = b.title
  if (b.targetValue !== undefined) cambios.target_value = b.targetValue
  if (b.targetDate !== undefined) cambios.target_date = b.targetDate

  // La fecha de cierre va pegada al estado y no se pide por separado: si la
  // mandara el cliente acabaría habiendo metas cumplidas sin fecha y fechas de
  // cierre en metas activas.
  if (b.estado !== undefined) {
    cambios.estado = b.estado
    cambios.cerrada_en = b.estado === 'activa' ? null : new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('user_goals')
    .update(cambios)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (error) {
    logger.error('actualizarMeta:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo actualizar la meta' } satisfies ApiResponse)
    return
  }
  if (!data) {
    res.status(404).json({ success: false, message: 'Meta no encontrada' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: aMeta(data) } satisfies ApiResponse)
}

/** DELETE /tracking/goals/:id — abandonarla. Sigue en el histórico. */
export async function eliminarMeta(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { id } = req.params

  const { data, error } = await supabase
    .from('user_goals')
    .update({ estado: 'abandonada', cerrada_en: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('estado', 'activa')
    .select()
    .maybeSingle()

  if (error) {
    logger.error('eliminarMeta:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo eliminar la meta' } satisfies ApiResponse)
    return
  }
  if (!data) {
    res.status(404).json({ success: false, message: 'Meta no encontrada o ya cerrada' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: aMeta(data) } satisfies ApiResponse)
}
