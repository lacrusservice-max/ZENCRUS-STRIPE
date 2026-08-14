/**
 * REGISTRO DE NUTRICIÓN
 * ─────────────────────
 * Lo que la gente de verdad come, alimento a alimento. Hasta ahora esto vivía
 * únicamente en el AsyncStorage del teléfono —el mismo agujero que tenían los
 * entrenamientos antes de `workoutSessionController`— con dos consecuencias:
 * al cambiar de móvil se perdía el historial entero, y el servidor no tenía
 * nada que leer, así que ZENA no podía responder «¿cuántas calorías llevo hoy?»
 * ni registrar una comida que le pidieran por chat.
 *
 * ── El día no es el instante ────────────────────────────────────────────────
 * `log_date` la manda la app, no la calcula el servidor. La cena de las 23:50
 * que se apunta a las 00:10 pertenece al día anterior, y quien la apunta espera
 * verla ahí. Calcularla aquí con la hora del servidor —que además corre en UTC
 * en Railway— movería comidas de día a espaldas del usuario.
 *
 * ── Registrar dos veces no puede duplicar ───────────────────────────────────
 * Cada entrada llega con un `clientId` que pone el teléfono. Si la respuesta se
 * pierde y la app reintenta, la segunda petición devuelve la entrada que ya
 * existe en vez de crear otra. Alguien apuntando la comida en el metro es el
 * caso normal, no el raro.
 *
 * ── Borrar no borra ─────────────────────────────────────────────────────────
 * `deleted_at` en vez de DELETE. «Bórrame el desayuno» tiene que poder
 * deshacerse, y cuando ZENA sea quien borre, más todavía.
 *
 * ── `active` no es lo mismo que borrado ─────────────────────────────────────
 * Una entrada con `active=false` sigue VISIBLE en el diario pero sale de los
 * totales: es «esto lo dejé a la mitad», no «esto no pasó». Viene del store del
 * móvil y se respeta tal cual.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'

const COMIDAS = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2', 'snack3'] as const
const ORIGENES = ['manual', 'search', 'barcode', 'photo', 'ai', 'plan'] as const

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser YYYY-MM-DD')

// ── Esquemas ─────────────────────────────────────────────────────────────────

const entradaBase = {
  clientId: z.string().min(1).max(120),
  mealSlot: z.enum(COMIDAS),
  name: z.string().min(1).max(200),
  emoji: z.string().max(16).optional(),
  foodId: z.string().uuid().optional(),
  amount: z.number().positive().max(100000),
  unit: z.string().min(1).max(24).default('g'),
  calories: z.number().min(0).max(50000).default(0),
  protein: z.number().min(0).max(5000).default(0),
  carbs: z.number().min(0).max(5000).default(0),
  fat: z.number().min(0).max(5000).default(0),
  fiber: z.number().min(0).max(5000).default(0),
  active: z.boolean().default(true),
  source: z.enum(ORIGENES).default('manual'),
  consumedAt: z.string().datetime().optional(),
}

export const registrarEntradaSchema = z.object({
  body: z.object({ ...entradaBase, logDate: FECHA }),
})

/**
 * Alta en lote. Existe porque «Confirmar alimentos» manda varias entradas de
 * golpe y el reconocimiento por foto va a mandar todavía más: una petición por
 * alimento convertiría un registro en una tanda de reintentos sueltos.
 */
export const registrarLoteSchema = z.object({
  body: z.object({
    logDate: FECHA,
    entries: z.array(z.object(entradaBase)).min(1).max(60),
  }),
})

export const actualizarEntradaSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    amount: z.number().positive().max(100000).optional(),
    mealSlot: z.enum(COMIDAS).optional(),
    active: z.boolean().optional(),
    calories: z.number().min(0).max(50000).optional(),
    protein: z.number().min(0).max(5000).optional(),
    carbs: z.number().min(0).max(5000).optional(),
    fat: z.number().min(0).max(5000).optional(),
    fiber: z.number().min(0).max(5000).optional(),
  }).refine((b) => Object.keys(b).length > 0, 'Nada que actualizar'),
})

export const idEntradaSchema = z.object({ params: z.object({ id: z.string().uuid() }) })
export const diaSchema = z.object({ params: z.object({ fecha: FECHA }) })

export const rangoSchema = z.object({
  query: z.object({
    desde: FECHA,
    hasta: FECHA,
  }).refine((q) => q.desde <= q.hasta, 'El rango está invertido'),
})

export const guardarDiaSchema = z.object({
  params: z.object({ fecha: FECHA }),
  body: z.object({
    waterGlasses: z.number().int().min(0).max(50).optional(),
    streak: z.number().int().min(0).optional(),
  }),
})

// ── Traducción entre la app y la base ────────────────────────────────────────
// El móvil habla en camelCase y en «calories»; la base en snake_case y en
// «calories/protein_g». Se traduce en un solo sitio para que ningún controlador
// tenga que acordarse de los dos vocabularios.

function aFila(e: any, userId: string, logDate: string) {
  return {
    user_id: userId,
    log_date: logDate,
    client_id: e.clientId,
    meal_slot: e.mealSlot,
    food_id: e.foodId ?? null,
    name: e.name,
    emoji: e.emoji ?? null,
    amount: e.amount,
    unit: e.unit ?? 'g',
    calories: e.calories ?? 0,
    protein_g: e.protein ?? 0,
    carbs_g: e.carbs ?? 0,
    fat_g: e.fat ?? 0,
    fiber_g: e.fiber ?? 0,
    active: e.active ?? true,
    source: e.source ?? 'manual',
    consumed_at: e.consumedAt ?? null,
  }
}

function aEntrada(f: any) {
  return {
    id: f.id,
    clientId: f.client_id,
    mealSlot: f.meal_slot,
    foodId: f.food_id,
    name: f.name,
    emoji: f.emoji ?? undefined,
    amount: Number(f.amount),
    unit: f.unit,
    calories: Number(f.calories),
    protein: Number(f.protein_g),
    carbs: Number(f.carbs_g),
    fat: Number(f.fat_g),
    fiber: Number(f.fiber_g),
    active: f.active,
    source: f.source,
    consumedAt: f.consumed_at,
    createdAt: f.created_at,
  }
}

/**
 * Los totales se calculan al leer en vez de guardarse.
 *
 * Es la decisión contraria a la de `workout_sessions`, y a propósito: allí
 * calcular el volumen exige recorrer las series multiplicando peso por
 * repeticiones; aquí es sumar cinco columnas de las ~15 filas de un día.
 * Mantener totales guardados costaría más de lo que ahorra y añadiría una
 * forma nueva de que los números derivaran.
 */
function totales(entradas: any[]) {
  let calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0
  for (const e of entradas) {
    if (e.active === false) continue   // visible en el diario, fuera de la suma
    calories += e.calories; protein += e.protein
    carbs += e.carbs; fat += e.fat; fiber += e.fiber
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber: Math.round(fiber),
  }
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/** GET /nutrition/day/:fecha — el diario completo de un día. */
export async function obtenerDia(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { fecha } = req.params

  const [entradasRes, diaRes] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', fecha)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('nutrition_days')
      .select('water_glasses, streak')
      .eq('user_id', userId)
      .eq('log_date', fecha)
      .maybeSingle(),
  ])

  if (entradasRes.error) {
    logger.error('obtenerDia:', entradasRes.error.message)
    res.status(500).json({ success: false, message: 'No se pudo leer el día' } satisfies ApiResponse)
    return
  }

  const entries = (entradasRes.data || []).map(aEntrada)

  res.status(200).json({
    success: true,
    data: {
      date: fecha,
      entries,
      totals: totales(entries),
      waterGlasses: diaRes.data?.water_glasses ?? 0,
      streak: diaRes.data?.streak ?? 0,
    },
  } satisfies ApiResponse)
}

/**
 * GET /nutrition/range?desde&hasta — totales por día.
 *
 * Es lo que pinta la pantalla de progreso y lo que ZENA lee para el resumen
 * semanal. Devuelve totales, no entradas: mandar noventa días de alimentos uno
 * por uno para dibujar una gráfica sería tirar ancho de banda del usuario.
 */
export async function obtenerRango(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { desde, hasta } = req.query as { desde: string; hasta: string }

  const { data, error } = await supabase
    .from('meal_logs')
    .select('log_date, calories, protein_g, carbs_g, fat_g, fiber_g, active')
    .eq('user_id', userId)
    .gte('log_date', desde)
    .lte('log_date', hasta)
    .is('deleted_at', null)

  if (error) {
    logger.error('obtenerRango:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo leer el rango' } satisfies ApiResponse)
    return
  }

  const porDia = new Map<string, any[]>()
  for (const f of data || []) {
    const lista = porDia.get(f.log_date) || []
    lista.push({
      calories: Number(f.calories), protein: Number(f.protein_g),
      carbs: Number(f.carbs_g), fat: Number(f.fat_g), fiber: Number(f.fiber_g),
      active: f.active,
    })
    porDia.set(f.log_date, lista)
  }

  const days = [...porDia.entries()]
    .map(([date, entradas]) => ({ date, ...totales(entradas), entries: entradas.length }))
    .sort((a, b) => a.date.localeCompare(b.date))

  res.status(200).json({ success: true, data: { desde, hasta, days } } satisfies ApiResponse)
}

/** POST /nutrition/entries — registrar un alimento. */
export async function registrarEntrada(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { logDate, ...entrada } = req.body

  const { data, error } = await supabase
    .from('meal_logs')
    .upsert(aFila(entrada, userId, logDate), { onConflict: 'user_id,client_id' })
    .select()
    .single()

  if (error) {
    logger.error('registrarEntrada:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo registrar el alimento' } satisfies ApiResponse)
    return
  }

  res.status(201).json({ success: true, data: aEntrada(data) } satisfies ApiResponse)
}

/** POST /nutrition/entries/batch — varias de golpe, en una sola ida y vuelta. */
export async function registrarLote(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { logDate, entries } = req.body

  const filas = entries.map((e: any) => aFila(e, userId, logDate))

  const { data, error } = await supabase
    .from('meal_logs')
    .upsert(filas, { onConflict: 'user_id,client_id' })
    .select()

  if (error) {
    logger.error('registrarLote:', error.message)
    res.status(500).json({ success: false, message: 'No se pudieron registrar los alimentos' } satisfies ApiResponse)
    return
  }

  res.status(201).json({
    success: true,
    data: { entries: (data || []).map(aEntrada), count: data?.length ?? 0 },
  } satisfies ApiResponse)
}

/** PATCH /nutrition/entries/:id — corregir cantidad, comida o activo. */
export async function actualizarEntrada(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { id } = req.params
  const b = req.body

  const cambios: Record<string, any> = {}
  if (b.amount !== undefined) cambios.amount = b.amount
  if (b.mealSlot !== undefined) cambios.meal_slot = b.mealSlot
  if (b.active !== undefined) cambios.active = b.active
  if (b.calories !== undefined) cambios.calories = b.calories
  if (b.protein !== undefined) cambios.protein_g = b.protein
  if (b.carbs !== undefined) cambios.carbs_g = b.carbs
  if (b.fat !== undefined) cambios.fat_g = b.fat
  if (b.fiber !== undefined) cambios.fiber_g = b.fiber

  // El `eq('user_id')` no es redundante con el id: es lo que impide que un id
  // ajeno adivinado toque la fila de otra persona.
  const { data, error } = await supabase
    .from('meal_logs')
    .update(cambios)
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select()
    .maybeSingle()

  if (error) {
    logger.error('actualizarEntrada:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo actualizar' } satisfies ApiResponse)
    return
  }
  if (!data) {
    res.status(404).json({ success: false, message: 'Entrada no encontrada' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: aEntrada(data) } satisfies ApiResponse)
}

/** DELETE /nutrition/entries/:id — borrado suave, reversible durante 30 días. */
export async function eliminarEntrada(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { id } = req.params

  const { data, error } = await supabase
    .from('meal_logs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    logger.error('eliminarEntrada:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo eliminar' } satisfies ApiResponse)
    return
  }
  if (!data) {
    res.status(404).json({ success: false, message: 'Entrada no encontrada' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: { id, deleted: true } } satisfies ApiResponse)
}

/** POST /nutrition/entries/:id/restore — deshacer un borrado. */
export async function restaurarEntrada(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { id } = req.params

  const { data, error } = await supabase
    .from('meal_logs')
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .select()
    .maybeSingle()

  if (error) {
    logger.error('restaurarEntrada:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo restaurar' } satisfies ApiResponse)
    return
  }
  if (!data) {
    res.status(404).json({ success: false, message: 'No hay nada que restaurar' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: aEntrada(data) } satisfies ApiResponse)
}

/** PUT /nutrition/day/:fecha — agua y racha del día. */
export async function guardarDia(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { fecha } = req.params
  const { waterGlasses, streak } = req.body

  const fila: Record<string, any> = { user_id: userId, log_date: fecha }
  if (waterGlasses !== undefined) fila.water_glasses = waterGlasses
  if (streak !== undefined) fila.streak = streak

  const { data, error } = await supabase
    .from('nutrition_days')
    .upsert(fila, { onConflict: 'user_id,log_date' })
    .select('water_glasses, streak')
    .single()

  if (error) {
    logger.error('guardarDia:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar el día' } satisfies ApiResponse)
    return
  }

  res.status(200).json({
    success: true,
    data: { date: fecha, waterGlasses: data.water_glasses, streak: data.streak },
  } satisfies ApiResponse)
}
