/**
 * LA SEMANA PLANEADA
 * ──────────────────
 * Dos tablas que se parecen en la forma —un documento por usuario, un documento
 * por semana— y por eso comparten controlador: el ciclado de macros
 * (`macro_cycles`) y el plan de comidas (`meal_plans`).
 *
 * Las dos se leen y se escriben ENTERAS. La pantalla de ciclado pinta los siete
 * días de golpe y la del planificador pinta la semana completa; no existe la
 * consulta «¿qué puse el martes?» ni «¿en cuántas semanas repetí pollo?». Por
 * eso el ciclo es un array y el plan un JSONB, y no treinta y cinco filas que
 * habría que juntar en cada lectura.
 *
 * ── Las bases del ciclado no se guardan aquí ────────────────────────────────
 * `macroCyclingStore` tiene `baseCalories`, `baseProtein`, `baseCarbs` y
 * `baseFat`, y `macro_cycles` no tiene columnas para ellos. No es un olvido:
 * son los targets del plan de dieta activo, que ya viven en `diet_plans`.
 * Duplicarlos aquí crearía dos verdades sobre cuántas calorías toca comer, que
 * es justo el problema que la 012 vino a arreglar con el peso.
 *
 * Se devuelven en el GET —leídos de donde ya están— para que la pantalla no
 * tenga que pedirlos por su cuenta y para que dejen de vivir en el teléfono.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'

const TIPOS_DIA = ['high', 'moderate', 'low', 'rest'] as const
const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] as const
const COMIDAS = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'] as const

// ── Esquemas ─────────────────────────────────────────────────────────────────

export const guardarCicloSchema = z.object({
  body: z.object({
    // Siete, ni seis ni ocho: es el `check` de la tabla y es la semana.
    cycle: z.array(z.enum(TIPOS_DIA)).length(7),
    preset: z.string().min(1).max(60).nullable().optional(),
    activo: z.boolean().default(false),
  }),
})

/**
 * La semana en el formato que ya usa el store, `YYYY-WNN`.
 *
 * Es el mismo `check` que tiene la tabla. Conviene saber que `currentWeekKey()`
 * del móvil no calcula la semana ISO de verdad —hace una división por siete
 * desde el 1 de enero— pero produce una llave válida y estable. Cambiar el
 * cálculo ahora dejaría huérfanos los planes ya guardados en los teléfonos.
 */
const SEMANA = z.string().regex(/^\d{4}-W\d{2}$/, 'La semana debe ser YYYY-WNN')

const comidaPlaneada = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  calories: z.number().min(0).max(50000),
  protein: z.number().min(0).max(5000),
  carbs: z.number().min(0).max(5000),
  fat: z.number().min(0).max(5000),
  emoji: z.string().max(16).optional(),
})

export const semanaSchema = z.object({ params: z.object({ semana: SEMANA }) })

export const guardarPlanSchema = z.object({
  params: z.object({ semana: SEMANA }),
  body: z.object({
    // Se valida hasta el fondo en vez de aceptar un JSON cualquiera. Es una
    // escritura del documento entero: un plan mal formado no rompe una fila,
    // deja la pantalla del planificador sin pintar hasta que alguien lo borre a
    // mano de la base.
    plan: z.record(
      z.enum(DIAS),
      z.record(z.enum(COMIDAS), z.array(comidaPlaneada).max(20)),
    ),
  }),
})

// ── Ciclado de macros ────────────────────────────────────────────────────────

function aCiclo(f: any) {
  return {
    cycle: f.cycle,
    // El store distingue «un preajuste» de «lo toqué a mano» con `null`; la
    // columna no admite nulos y guarda 'custom'. Se traduce en los dos sentidos
    // para que ninguno de los dos lados tenga que conocer al otro.
    preset: f.preset === 'custom' ? null : f.preset,
    activo: f.activo,
    updatedAt: f.updated_at,
  }
}

/** Los targets del plan de dieta activo, que son la base del ciclado. */
async function basesDelPlan(userId: string) {
  const { data, error } = await supabase
    .from('diet_plans')
    .select('total_calories, macros')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const macros = (data.macros ?? {}) as Record<string, number>
  return {
    calories: Number(data.total_calories) || 0,
    protein: Number(macros.protein) || 0,
    carbs: Number(macros.carbs) || 0,
    fat: Number(macros.fat) || 0,
  }
}

/** GET /tracking/macro-cycle — el ciclo activo y las bases sobre las que aplica. */
export async function obtenerCiclo(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const [cicloRes, base] = await Promise.all([
    supabase.from('macro_cycles').select('*').eq('user_id', userId).maybeSingle(),
    basesDelPlan(userId),
  ])

  if (cicloRes.error) {
    logger.error('obtenerCiclo:', cicloRes.error.message)
    res.status(500).json({ success: false, message: 'No se pudo leer el ciclado' } satisfies ApiResponse)
    return
  }

  res.status(200).json({
    success: true,
    // `null` cuando nunca se configuró: el store se queda con sus valores por
    // defecto, que es distinto de un ciclo guardado y desactivado.
    data: { cycle: cicloRes.data ? aCiclo(cicloRes.data) : null, base },
  } satisfies ApiResponse)
}

/** PUT /tracking/macro-cycle — guardar la semana entera. */
export async function guardarCiclo(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { cycle, preset, activo } = req.body

  const { data, error } = await supabase
    .from('macro_cycles')
    .upsert({
      user_id: userId,
      cycle,
      preset: preset ?? 'custom',
      activo,
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    logger.error('guardarCiclo:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar el ciclado' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: aCiclo(data) } satisfies ApiResponse)
}

// ── Plan de comidas ──────────────────────────────────────────────────────────

/**
 * GET /tracking/meal-plan/:semana — la semana pedida.
 *
 * Una semana sin plan contesta 200 con el plan vacío, no 404. La pantalla
 * siempre quiere un objeto que pintar, y «todavía no has planeado nada» no es
 * un error que merezca su propia rama en el móvil.
 */
export async function obtenerPlanSemana(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { semana } = req.params

  const { data, error } = await supabase
    .from('meal_plans')
    .select('week, plan, updated_at')
    .eq('user_id', userId)
    .eq('week', semana)
    .maybeSingle()

  if (error) {
    logger.error('obtenerPlanSemana:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo leer el plan' } satisfies ApiResponse)
    return
  }

  res.status(200).json({
    success: true,
    data: {
      week: semana,
      plan: data?.plan ?? {},
      updatedAt: data?.updated_at ?? null,
    },
  } satisfies ApiResponse)
}

/** PUT /tracking/meal-plan/:semana — guardar la semana entera. */
export async function guardarPlanSemana(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { semana } = req.params
  const { plan } = req.body

  const { data, error } = await supabase
    .from('meal_plans')
    .upsert({ user_id: userId, week: semana, plan }, { onConflict: 'user_id,week' })
    .select('week, plan, updated_at')
    .single()

  if (error) {
    logger.error('guardarPlanSemana:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar el plan' } satisfies ApiResponse)
    return
  }

  res.status(200).json({
    success: true,
    data: { week: data.week, plan: data.plan, updatedAt: data.updated_at },
  } satisfies ApiResponse)
}
