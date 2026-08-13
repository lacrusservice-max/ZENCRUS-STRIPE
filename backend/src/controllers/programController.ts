/**
 * PROGRAMAS DE VARIAS SEMANAS
 * ───────────────────────────
 * El catálogo, la inscripción y el día que toca hoy. Toda la aritmética de
 * progresión vive en `services/programas.ts`; aquí solo se decide qué se lee,
 * qué se escribe y quién puede.
 *
 * ── Lo hecho NO se guarda aquí ──────────────────────────────────────────────
 * «¿Qué llevo del programa?» se responde consultando `workout_sessions` por
 * `program_id`, que es donde ya está la verdad. Un contador en la inscripción
 * sería una segunda copia, y las dos copias acaban discrepando: se descarta un
 * entrenamiento y el contador se queda arriba.
 *
 * ── Un programa es de quien lo hizo ─────────────────────────────────────────
 * `user_id` a null significa «de ZENCRUS, para todos». Con valor, es privado.
 * Cada lectura filtra por `user_id is null or user_id = yo`; no hay nada
 * equivalente a una cuenta privada que resolver, así que no pasa por
 * `socialAccess`.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import {
  proponerDia, siguiente, esDescarga, claveEjercicio,
  Plan,
} from '../services/programas'
import { posterDe } from '../services/workoutSessions'
import { readUrls, mediaReady } from '../services/media'
import catalogo from '../data/exercises.json'

/**
 * El catálogo indexado por slug, para poner músculo y material en cada
 * ejercicio del plan.
 *
 * El plan solo guarda slug y nombre —el resto es dato del catálogo y duplicarlo
 * dentro del jsonb lo dejaría desactualizado en cuanto se renombrara algo—,
 * pero la ficha del día necesita decir qué se trabaja y qué hace falta. Se
 * resuelve al leer, que es gratis: el catálogo ya está en memoria.
 */
interface FichaCatalogo {
  slug: string
  nombre: string
  muscle: string | null
  muscleEs: string | null
  equipment: string
  equipmentEs: string
  pattern: string | null
  home: boolean
}
const POR_SLUG = new Map<string, FichaCatalogo>(
  (catalogo.ejercicios as FichaCatalogo[]).map(e => [e.slug, e]),
)

const fail = (res: Response, code: number, message: string) => {
  res.status(code).json({ success: false, message } satisfies ApiResponse)
}

const ok = <T>(res: Response, data: T, code = 200) => {
  res.status(code).json({ success: true, data } satisfies ApiResponse)
}

/** Las columnas del programa sin el plan: para listar sin traerlo entero. */
const COLS_CABECERA =
  'id, user_id, name, description, weeks, days_per_week, goal, level, mode, deload_every, created_at'

// ── Esquemas ─────────────────────────────────────────────────────────────────

export const inscribirSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const fijarSchema = z.object({
  body: z.object({
    exerciseKey: z.string().min(1).max(160),
    /**
     * Null BORRA lo fijado y devuelve el ejercicio al cálculo automático.
     * Hace falta: sin esta puerta, un peso puesto por error se quedaría
     * mandando para siempre y la única salida sería abandonar el programa.
     */
    weightKg: z.number().min(0).max(999).nullable(),
  }),
})

// ── Catálogo ─────────────────────────────────────────────────────────────────

/**
 * GET /workout/programs
 *
 * Los de ZENCRUS publicados y los míos. Sin el plan: la tarjeta del catálogo
 * enseña nombre, duración y nivel, y traer cuatro planes completos para pintar
 * cuatro tarjetas es gastar la conexión de alguien en datos que no se ven.
 */
export async function listarProgramas(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data, error } = await supabase
    .from('workout_programs')
    .select(COLS_CABECERA)
    .or(`and(user_id.is.null,is_published.eq.true),user_id.eq.${userId}`)
    .order('user_id', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('No se pudo leer el catálogo de programas:', error.message)
    fail(res, 500, 'No se pudieron leer los programas')
    return
  }

  ok(res, (data ?? []).map(p => ({ ...p, esMio: p.user_id === userId })))
}

/**
 * GET /workout/programs/:id
 *
 * La ficha completa, con el plan y con las imágenes de los ejercicios de cada
 * día. Los pósters van aquí y no en el listado por el mismo motivo que el plan.
 */
export async function detalleProgama(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: p } = await supabase
    .from('workout_programs')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle()

  if (!p) { fail(res, 404, 'Programa no encontrado'); return }
  if (p.user_id !== null && p.user_id !== userId) { fail(res, 404, 'Programa no encontrado'); return }

  ok(res, { ...p, esMio: p.user_id === userId, posters: await postersDelPlan(p.plan as Plan) })
}

/**
 * Las imágenes de todos los ejercicios de un plan, por slug.
 *
 * Un plan repite ejercicios entre días —la sentadilla sale tres veces en el
 * programa de fuerza—, así que se firman las claves DISTINTAS y la app casa por
 * slug. Firmar una por aparición sería firmar tres veces la misma imagen.
 */
async function postersDelPlan(plan: Plan): Promise<Record<string, string>> {
  const slugs = [...new Set(
    (plan.dias ?? []).flatMap(d => d.ejercicios.map(e => e.slug).filter((s): s is string => !!s)),
  )]

  const archivos = new Map<string, string>()
  for (const s of slugs) {
    const p = posterDe(s)
    if (p) archivos.set(s, `library/poster/${p}`)
  }

  if (!mediaReady() || archivos.size === 0) return {}

  const firmadas = await readUrls([...archivos.values()])
  const out: Record<string, string> = {}
  for (const [slug, clave] of archivos) {
    const url = firmadas.get(clave)
    if (url) out[slug] = url
  }
  return out
}

// ── Planes propios ───────────────────────────────────────────────────────────

const ejercicioSchema = z.object({
  slug: z.string().max(160).optional(),
  nombre: z.string().min(1).max(160),
  series: z.number().int().min(1).max(20),
  reps: z.string().max(20).optional(),
  duracion: z.number().int().min(1).max(3600).optional(),
  descanso: z.number().int().min(0).max(600),
  progresion: z.enum(['doble', 'porcentaje', 'tiempo', 'fija']).default('doble'),
  incremento: z.number().min(0).max(50).optional(),
  carga: z.enum(['weight', 'bodyweight', 'band', 'assisted', 'none']).optional(),
  notas: z.string().max(300).optional(),
})

export const guardarPlanSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(80),
    description: z.string().max(500).optional(),
    weeks: z.number().int().min(1).max(52),
    goal: z.enum(['strength', 'hypertrophy', 'endurance', 'general']).default('hypertrophy'),
    level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
    mode: z.enum(['gym', 'home', 'outdoor', 'class']).default('gym'),
    deloadEvery: z.number().int().min(2).max(12).nullable().optional(),
    dias: z.array(z.object({
      dia: z.number().int().min(1).max(7),
      nombre: z.string().min(1).max(60),
      foco: z.string().max(24).optional(),
      ejercicios: z.array(ejercicioSchema).min(1).max(15),
    })).min(1).max(7),
  }),
})

/**
 * POST /workout/programs · PUT /workout/programs/:id
 *
 * Montar tu propio plan. Es un programa como los de ZENCRUS pero con dueño, así
 * que hereda TODO sin escribir nada nuevo: la línea de tiempo, la progresión
 * que calcula el peso desde tus marcas, el avance al terminar un día y el
 * cambio de ejercicio.
 *
 * ── `days_per_week` se DEDUCE, no se pregunta ───────────────────────────────
 * Es cuántos días trae el plan. Preguntarlo aparte es pedir un dato que ya se
 * sabe y abrir la puerta a que no cuadren: alguien pone «4 días» y define tres,
 * y a partir de ahí el programa espera un día cuatro que no existe.
 */
export async function guardarPlan(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const b = req.body as {
    name: string; description?: string; weeks: number
    goal: string; level: string; mode: string; deloadEvery?: number | null
    dias: { dia: number; nombre: string; foco?: string; ejercicios: unknown[] }[]
  }

  // Los días se renumeran del 1 al N por si llegan con huecos: el motor recorre
  // `current_day` de uno en uno y un salto lo dejaría buscando un día que no está.
  const dias = [...b.dias]
    .sort((a, c) => a.dia - c.dia)
    .map((d, i) => ({ ...d, dia: i + 1 }))

  const fila = {
    user_id: userId,
    name: b.name.trim(),
    description: b.description?.trim() || null,
    weeks: b.weeks,
    days_per_week: dias.length,
    goal: b.goal,
    level: b.level,
    mode: b.mode,
    deload_every: b.deloadEvery ?? null,
    plan: { dias },
    is_published: true,
  }

  const id = req.params.id

  if (id) {
    // Solo se edita lo PROPIO. Un plan de ZENCRUS es de todos y no se toca.
    const { data: mio } = await supabase
      .from('workout_programs')
      .select('id')
      .eq('id', id).eq('user_id', userId)
      .maybeSingle()

    if (!mio) { fail(res, 404, 'Ese plan no es tuyo o no existe'); return }

    const { data, error } = await supabase
      .from('workout_programs').update(fila).eq('id', id).select().single()

    if (error) { logger.error('No se pudo guardar el plan:', error.message); fail(res, 500, 'No se pudo guardar el plan'); return }
    ok(res, data)
    return
  }

  const { data, error } = await supabase
    .from('workout_programs').insert(fila).select().single()

  if (error) { logger.error('No se pudo crear el plan:', error.message); fail(res, 500, 'No se pudo crear el plan'); return }
  ok(res, data, 201)
}

/**
 * DELETE /workout/programs/:id
 *
 * Borra un plan tuyo. La inscripción se va en cascada con él, así que si lo
 * estabas siguiendo dejas de seguirlo — pero los entrenamientos que hiciste
 * siguen en tu historial y en tus récords: son tuyos, no del plan.
 */
export async function borrarPlan(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data, error } = await supabase
    .from('workout_programs')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', userId)   // ← lo que impide borrar los de ZENCRUS
    .select()
    .maybeSingle()

  if (error) { fail(res, 500, 'No se pudo borrar el plan'); return }
  if (!data) { fail(res, 404, 'Ese plan no es tuyo o no existe'); return }

  ok(res, { deleted: data.id })
}

// ── Inscripción ──────────────────────────────────────────────────────────────

/**
 * POST /workout/programs/:id/enroll
 *
 * Empezar un programa. Si ya había uno activo se ABANDONA, y se dice en la
 * respuesta para que la app pueda avisar. El índice `pe_one_active` no deja dos
 * a la vez, y con razón: dos programas en paralelo suman su volumen sobre el
 * mismo cuerpo y cada uno cuenta con que recuperas de lo suyo.
 */
export async function inscribirse(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: p } = await supabase
    .from('workout_programs')
    .select('id, user_id, is_published')
    .eq('id', req.params.id)
    .maybeSingle()

  if (!p) { fail(res, 404, 'Programa no encontrado'); return }
  if (p.user_id !== null && p.user_id !== userId) { fail(res, 404, 'Programa no encontrado'); return }
  if (p.user_id === null && !p.is_published) { fail(res, 409, 'Este programa ya no está disponible'); return }

  const { data: previa } = await supabase
    .from('program_enrollments')
    .select('id, program_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  // Volver a inscribirse en el MISMO programa no reinicia nada: quien pulsa
  // «empezar» sobre el que ya está siguiendo quiere continuar, no perder cinco
  // semanas de progreso.
  if (previa?.program_id === p.id) {
    ok(res, { enrollment: await leerInscripcion(userId), reanudada: true })
    return
  }

  if (previa) {
    await supabase
      .from('program_enrollments')
      .update({ status: 'abandoned', ended_at: new Date().toISOString() })
      .eq('id', previa.id)
  }

  const { data: creada, error } = await supabase
    .from('program_enrollments')
    .insert({ user_id: userId, program_id: p.id })
    .select()
    .single()

  if (error || !creada) {
    logger.error('No se pudo inscribir en el programa:', error?.message)
    fail(res, 500, 'No se pudo empezar el programa')
    return
  }

  ok(res, { enrollment: await leerInscripcion(userId), reanudada: false, anteriorAbandonado: !!previa }, 201)
}

/** La inscripción activa con su programa, o null. */
async function leerInscripcion(userId: string) {
  const { data } = await supabase
    .from('program_enrollments')
    .select('*, program:workout_programs(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  return data ?? null
}

/**
 * GET /workout/programs/mine/enrollment
 *
 * Por dónde voy, con lo necesario para pintar la línea de tiempo: qué días se
 * han hecho de verdad. Salen de las sesiones, no de un contador.
 */
export async function miInscripcion(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const inscripcion = await leerInscripcion(userId)
  if (!inscripcion) { ok(res, null); return }

  const { data: hechos } = await supabase
    .from('workout_sessions')
    .select('id, program_week, program_day, started_at, total_volume_kg, total_sets')
    .eq('user_id', userId)
    .eq('program_id', inscripcion.program_id)
    .eq('status', 'completed')
    .order('started_at', { ascending: true })

  const programa = inscripcion.program as { weeks: number; days_per_week: number; deload_every: number | null; plan: Plan }

  ok(res, {
    ...inscripcion,
    completados: (hechos ?? []).map(s => ({
      sessionId: s.id,
      semana: s.program_week,
      dia: s.program_day,
      fecha: s.started_at,
      series: s.total_sets,
      volumen: Number(s.total_volume_kg ?? 0),
    })),
    /**
     * Qué semanas son de descarga, calculado aquí y no en la app.
     *
     * Es la misma regla que usa la progresión para recortar series y peso; si
     * la app la repitiera por su cuenta, el día que se cambie el criterio la
     * línea de tiempo diría una cosa y el entrenamiento haría otra.
     */
    semanasDescarga: Array.from({ length: programa.weeks }, (_, i) => i + 1)
      .filter(s => esDescarga(s, programa.deload_every)),
    posters: await postersDelPlan(programa.plan),
  })
}

/**
 * GET /workout/programs/mine/today
 *
 * El día que toca, con el peso propuesto para cada ejercicio y el porqué.
 *
 * Acepta `?week=&day=` para mirar OTRO día sin moverse del sitio: la ficha de
 * un día futuro de la línea de tiempo tiene que poder abrirse sin que eso
 * cambie por dónde va el programa.
 */
export async function diaDeHoy(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const inscripcion = await leerInscripcion(userId)
  if (!inscripcion) { fail(res, 404, 'No estás siguiendo ningún programa'); return }

  const programa = inscripcion.program as {
    weeks: number; days_per_week: number; deload_every: number | null; plan: Plan
    name: string; mode: string; goal: string
  }

  const semana = Number(req.query.week ?? inscripcion.current_week)
  const dia = Number(req.query.day ?? inscripcion.current_day)

  if (!Number.isFinite(semana) || semana < 1 || semana > programa.weeks) {
    fail(res, 400, 'Esa semana no está en el programa'); return
  }
  if (!Number.isFinite(dia) || dia < 1 || dia > programa.days_per_week) {
    fail(res, 400, 'Ese día no está en el programa'); return
  }

  /**
   * Los cambios de ejercicio se aplican ANTES de proponer.
   *
   * Así la progresión mira el historial del ejercicio que de verdad se va a
   * hacer. Si se aplicaran después, alguien que cambió la prensa por sentadilla
   * búlgara vería el peso calculado sobre sus marcas de prensa, que no tienen
   * nada que ver.
   */
  const swaps = (inscripcion.swaps ?? {}) as Record<string, string>
  const planEfectivo = aplicarSwaps(programa.plan, swaps)

  const propuesto = await proponerDia(
    userId,
    planEfectivo,
    semana,
    dia,
    programa.deload_every,
    (inscripcion.overrides ?? {}) as Record<string, number>,
  )

  if (!propuesto) { fail(res, 404, 'Ese día no está en el plan'); return }

  // ¿Ya se hizo? La ficha tiene que poder decir «esto ya lo hiciste» en vez de
  // ofrecer empezarlo otra vez como si nada.
  const { data: yaHecho } = await supabase
    .from('workout_sessions')
    .select('id, started_at')
    .eq('user_id', userId)
    .eq('program_id', inscripcion.program_id)
    .eq('program_week', semana)
    .eq('program_day', dia)
    .eq('status', 'completed')
    .maybeSingle()

  // Las claves del plan ORIGINAL, en el mismo orden que los ejercicios: son las
  // que identifican el hueco a la hora de cambiar o de fijar un peso, y no
  // cambian aunque se sustituya el ejercicio.
  const original = programa.plan.dias.find(d => d.dia === dia)
  const clavesPlan = (original?.ejercicios ?? []).map(e => claveEjercicio(e.slug, e.nombre))

  ok(res, {
    programa: {
      id: inscripcion.program_id, nombre: programa.name,
      semanas: programa.weeks, diasPorSemana: programa.days_per_week,
      // El modo y el objetivo viajan para que la ficha del día pinte la
      // fotografía DE SU PROGRAMA. Sin ellos, un día de «En casa» salía con la
      // foto del gimnasio y la sección perdía la pista visual que la ordena.
      mode: programa.mode, goal: programa.goal,
    },
    esElDeHoy: semana === inscripcion.current_week && dia === inscripcion.current_day,
    hecho: yaHecho ? { sessionId: yaHecho.id, fecha: yaHecho.started_at } : null,
    ...propuesto,
    ejercicios: propuesto.ejercicios.map((e, i) => {
      const f = e.slug ? POR_SLUG.get(e.slug) : undefined
      const clavePlan = clavesPlan[i] ?? claveEjercicio(e.slug, e.nombre)
      return {
        ...e,
        clavePlan,
        cambiado: !!swaps[clavePlan],
        original: swaps[clavePlan] ? original?.ejercicios[i]?.nombre ?? null : null,
        muscle: f?.muscle ?? null,
        muscleEs: f?.muscleEs ?? null,
        equipment: f?.equipment ?? null,
        equipmentEs: f?.equipmentEs ?? null,
        pattern: f?.pattern ?? null,
      }
    }),
    posters: await postersDelPlan(planEfectivo),
  })
}

/** Devuelve el plan con los ejercicios sustituidos por los que se hacen. */
function aplicarSwaps(plan: Plan, swaps: Record<string, string>): Plan {
  if (Object.keys(swaps).length === 0) return plan

  return {
    dias: (plan.dias ?? []).map(d => ({
      ...d,
      ejercicios: d.ejercicios.map(e => {
        const nuevo = swaps[claveEjercicio(e.slug, e.nombre)]
        const ficha = nuevo ? POR_SLUG.get(nuevo) : undefined
        // Un slug que ya no esté en el catálogo se ignora y se hace el
        // original: mejor eso que dejar a alguien con un ejercicio fantasma.
        if (!ficha) return e
        // Series, repeticiones y descanso son del PLAN, no del ejercicio: lo
        // que se cambia es el movimiento, no el estímulo que se buscaba.
        return { ...e, slug: ficha.slug, nombre: ficha.nombre }
      }),
    })),
  }
}

/**
 * POST /workout/programs/mine/override
 *
 * Fijar a mano el peso de un ejercicio, o soltarlo con `weightKg: null`.
 *
 * Es la filosofía de la app llevada a los programas: la progresión propone y la
 * persona ajusta CUALQUIER valor. Lo fijado se recuerda de una semana a la
 * siguiente en vez de tener que volver a corregirlo cada vez.
 */
export async function fijarPeso(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { exerciseKey, weightKg } = req.body as { exerciseKey: string; weightKg: number | null }

  const { data: inscripcion } = await supabase
    .from('program_enrollments')
    .select('id, overrides')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (!inscripcion) { fail(res, 404, 'No estás siguiendo ningún programa'); return }

  const overrides = { ...(inscripcion.overrides ?? {}) } as Record<string, number>
  if (weightKg == null) delete overrides[exerciseKey]
  else overrides[exerciseKey] = weightKg

  const { error } = await supabase
    .from('program_enrollments')
    .update({ overrides })
    .eq('id', inscripcion.id)

  if (error) { fail(res, 500, 'No se pudo guardar el peso'); return }

  ok(res, { overrides })
}

export const cambiarSchema = z.object({
  body: z.object({
    /** La clave del ejercicio EN EL PLAN, no la del sustituto. */
    planKey: z.string().min(1).max(160),
    /** Null devuelve el ejercicio original. */
    slug: z.string().min(1).max(160).nullable(),
  }),
})

/**
 * POST /workout/programs/mine/swap
 *
 * Cambiar un ejercicio del plan por otro, o deshacer el cambio con `slug: null`.
 *
 * Solo admite sustitutos del MISMO PATRÓN de movimiento. No es una restricción
 * caprichosa: si la máquina de press está ocupada hace falta otro empuje
 * horizontal, no cualquier ejercicio de pecho. Cambiar un press por unas
 * aperturas mantiene el músculo y pierde el estímulo, que es justo lo que el
 * programa venía a organizar.
 */
export async function cambiarEjercicio(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { planKey, slug } = req.body as { planKey: string; slug: string | null }

  const { data: inscripcion } = await supabase
    .from('program_enrollments')
    .select('id, swaps, program:workout_programs(plan, mode)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (!inscripcion) { fail(res, 404, 'No estás siguiendo ningún programa'); return }

  const programa = inscripcion.program as unknown as { plan: Plan; mode: string }
  const swaps = { ...(inscripcion.swaps ?? {}) } as Record<string, string>

  if (slug == null) {
    delete swaps[planKey]
  } else {
    const nuevo = POR_SLUG.get(slug)
    if (!nuevo) { fail(res, 400, 'Ese ejercicio no está en el catálogo'); return }

    const enElPlan = (programa.plan.dias ?? [])
      .flatMap(d => d.ejercicios)
      .find(e => claveEjercicio(e.slug, e.nombre) === planKey)

    if (!enElPlan) { fail(res, 404, 'Ese ejercicio no está en tu programa'); return }

    const viejo = enElPlan.slug ? POR_SLUG.get(enElPlan.slug) : undefined
    if (viejo?.pattern && nuevo.pattern !== viejo.pattern) {
      fail(res, 400, 'Ese ejercicio no trabaja el mismo patrón de movimiento')
      return
    }

    swaps[planKey] = slug
  }

  const { error } = await supabase
    .from('program_enrollments')
    .update({ swaps })
    .eq('id', inscripcion.id)

  if (error) { fail(res, 500, 'No se pudo cambiar el ejercicio'); return }

  ok(res, { swaps })
}

/**
 * GET /workout/programs/mine/alternatives/:planKey
 *
 * Por qué se puede cambiar un ejercicio del plan: mismo patrón, y si el
 * programa es de casa, solo lo que se pueda hacer sin gimnasio.
 */
export async function alternativasDePlan(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const planKey = req.params.planKey

  const { data: inscripcion } = await supabase
    .from('program_enrollments')
    .select('swaps, program:workout_programs(plan, mode)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (!inscripcion) { fail(res, 404, 'No estás siguiendo ningún programa'); return }

  const programa = inscripcion.program as unknown as { plan: Plan; mode: string }
  const enElPlan = (programa.plan.dias ?? [])
    .flatMap(d => d.ejercicios)
    .find(e => claveEjercicio(e.slug, e.nombre) === planKey)

  if (!enElPlan?.slug) { fail(res, 404, 'Ese ejercicio no se puede cambiar'); return }

  const original = POR_SLUG.get(enElPlan.slug)
  if (!original) { fail(res, 404, 'Ese ejercicio no está en el catálogo'); return }

  let lista = (catalogo.ejercicios as FichaCatalogo[])
    .filter(e => e.pattern && e.pattern === original.pattern && e.slug !== original.slug)

  if (programa.mode === 'home') lista = lista.filter(e => e.home)

  // Primero los del mismo músculo: cambiar un press de banca por unos fondos es
  // más parecido que cambiarlo por un press de hombro, aunque los tres empujen.
  lista.sort((a, b) => Number(b.muscle === original.muscle) - Number(a.muscle === original.muscle))
  lista = lista.slice(0, 12)

  const claves = new Map(lista.map(e => [e.slug, `library/poster/${posterDe(e.slug) ?? ''}`]))
  const firmadas = mediaReady() && claves.size
    ? await readUrls([...claves.values()].filter(k => !k.endsWith('/')))
    : new Map<string, string>()

  ok(res, {
    original: { slug: original.slug, nombre: original.nombre, muscleEs: original.muscleEs, equipmentEs: original.equipmentEs },
    actual: ((inscripcion.swaps ?? {}) as Record<string, string>)[planKey] ?? null,
    alternativas: lista.map(e => ({
      slug: e.slug,
      nombre: e.nombre,
      muscleEs: e.muscleEs,
      equipmentEs: e.equipmentEs,
      home: e.home,
      poster: firmadas.get(claves.get(e.slug) ?? '') ?? null,
    })),
  })
}

/** POST /workout/programs/mine/abandon */
export async function abandonar(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data, error } = await supabase
    .from('program_enrollments')
    .update({ status: 'abandoned', ended_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active')
    .select()
    .maybeSingle()

  if (error) { fail(res, 500, 'No se pudo dejar el programa'); return }
  if (!data) { fail(res, 404, 'No estás siguiendo ningún programa'); return }

  // El historial NO se toca: los entrenamientos que se hicieron siguen siendo
  // entrenamientos aunque el programa se deje a medias.
  ok(res, { abandoned: data.id })
}

// ── Qué toca hoy ─────────────────────────────────────────────────────────────

/**
 * GET /workout/today
 *
 * Todo lo que la portada de Entrena necesita saber, en UNA petición.
 *
 * ── Por qué junto y no cuatro llamadas ──────────────────────────────────────
 * La portada tiene que contestar «¿qué hago hoy?» antes de que a nadie le dé
 * tiempo a preguntárselo. Encadenando cuatro peticiones —sesión abierta,
 * inscripción, día propuesto, sesiones de hoy— la pantalla se monta a trozos y
 * cada trozo aparece cuando llega: eso es exactamente la sensación de app lenta
 * y desordenada que hay que evitar.
 *
 * ── El orden de las respuestas ES la jerarquía de la portada ────────────────
 * `estado` dice qué enseñar arriba, y solo hay uno a la vez:
 *   · `abierta`   — dejaste algo a medias. Manda sobre todo lo demás.
 *   · `hecho`     — ya entrenaste hoy. Ni se ofrece repetir ni se esconde.
 *   · `toca`      — te toca este día del programa.
 *   · `sinPlan`   — no sigues nada; hay que ofrecer montarlo.
 */
export async function queTocaHoy(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  // El día natural de quien pregunta, no el del servidor. Sin esto, alguien
  // entrenando a las once de la noche en México vería su sesión contada en el
  // día siguiente y la portada le diría que aún no ha entrenado.
  const desfaseMin = Number(req.query.tzOffset ?? 0)
  const ahora = new Date()
  const local = new Date(ahora.getTime() - desfaseMin * 60_000)
  const desde = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()))
  const inicioDia = new Date(desde.getTime() + desfaseMin * 60_000).toISOString()

  const [abiertaRes, hoyRes, inscripcion] = await Promise.all([
    supabase.from('workout_sessions').select('*')
      .eq('user_id', userId).eq('status', 'active').maybeSingle(),
    supabase.from('workout_sessions').select('id, title, total_sets, total_volume_kg, duration_seconds, started_at')
      .eq('user_id', userId).eq('status', 'completed')
      .gte('started_at', inicioDia)
      .order('started_at', { ascending: false }),
    leerInscripcion(userId),
  ])

  const abierta = abiertaRes.data
  const hechasHoy = hoyRes.data ?? []

  // ── Sin programa: no hay «día que toca» que calcular ──────────────────────
  if (!inscripcion) {
    ok(res, {
      estado: abierta ? 'abierta' : hechasHoy.length > 0 ? 'hecho' : 'sinPlan',
      abierta: abierta ?? null,
      hechasHoy,
      programa: null,
      dia: null,
      semana: null,
    })
    return
  }

  const programa = inscripcion.program as {
    id: string; name: string; weeks: number; days_per_week: number
    deload_every: number | null; plan: Plan; mode: string; goal: string
  }

  const swaps = (inscripcion.swaps ?? {}) as Record<string, string>
  const planEfectivo = aplicarSwaps(programa.plan, swaps)

  const propuesto = await proponerDia(
    userId, planEfectivo,
    inscripcion.current_week, inscripcion.current_day,
    programa.deload_every,
    (inscripcion.overrides ?? {}) as Record<string, number>,
  )

  // ── La semana actual, día a día ───────────────────────────────────────────
  // Es el «mapa vertical» de la portada: qué toca cada día de esta semana y
  // cuáles ya están hechos. Sale de las sesiones, no de un contador.
  const { data: deLaSemana } = await supabase
    .from('workout_sessions')
    .select('id, program_day, started_at, total_sets, total_volume_kg')
    .eq('user_id', userId)
    .eq('program_id', inscripcion.program_id)
    .eq('program_week', inscripcion.current_week)
    .eq('status', 'completed')

  const hechosPorDia = new Map((deLaSemana ?? []).map(s => [s.program_day, s]))

  const semana = {
    numero: inscripcion.current_week,
    de: programa.weeks,
    esDescarga: esDescarga(inscripcion.current_week, programa.deload_every),
    dias: (planEfectivo.dias ?? []).map(d => {
      const hecho = hechosPorDia.get(d.dia)
      return {
        dia: d.dia,
        nombre: d.nombre,
        foco: d.foco ?? null,
        ejercicios: d.ejercicios.length,
        series: d.ejercicios.reduce((a, e) => a + e.series, 0),
        hecho: hecho
          ? { sessionId: hecho.id, series: hecho.total_sets, volumen: Number(hecho.total_volume_kg ?? 0) }
          : null,
        esHoy: d.dia === inscripcion.current_day,
      }
    }),
  }

  const yaHechoElDeHoy = hechosPorDia.has(inscripcion.current_day)

  ok(res, {
    estado: abierta ? 'abierta' : yaHechoElDeHoy ? 'hecho' : 'toca',
    abierta: abierta ?? null,
    hechasHoy,
    programa: {
      id: programa.id, nombre: programa.name,
      semanas: programa.weeks, diasPorSemana: programa.days_per_week,
      mode: programa.mode, goal: programa.goal,
      esMio: (inscripcion.program as { user_id: string | null }).user_id === userId,
    },
    dia: propuesto ? { ...propuesto, posters: await postersDelPlan(planEfectivo) } : null,
    semana,
  })
}

// ── Avance, desde el cierre de una sesión ────────────────────────────────────

/**
 * Adelanta el programa cuando se cierra una sesión suya.
 *
 * Lo llama `cerrarSesion`, no un botón: el programa va por donde se ha
 * ENTRENADO, no por donde se ha dicho que se iba a entrenar.
 *
 * Nunca revienta el cierre de la sesión. Si algo falla aquí, la sesión ya está
 * guardada y lo único que pasa es que el programa se queda un día atrás, que se
 * arregla solo al terminar el siguiente. Perder el entrenamiento por no poder
 * mover un contador sería un pésimo intercambio.
 */
export async function avanzarPrograma(
  userId: string,
  sesion: { program_id: string | null; program_week: number | null; program_day: number | null },
): Promise<{ current_week: number; current_day: number; status: string } | null> {
  if (!sesion.program_id || sesion.program_week == null || sesion.program_day == null) return null

  try {
    const { data: inscripcion } = await supabase
      .from('program_enrollments')
      .select('id, current_week, current_day, program:workout_programs(weeks, days_per_week)')
      .eq('user_id', userId)
      .eq('program_id', sesion.program_id)
      .eq('status', 'active')
      .maybeSingle()

    if (!inscripcion) return null

    /**
     * Solo avanza si lo cerrado es el día por el que iba.
     *
     * Sin esta comprobación, repetir un día de la semana pasada —o abrir una
     * ficha vieja de la línea de tiempo y entrenarla— empujaría el programa
     * hacia delante y saltaría días sin hacer.
     */
    if (sesion.program_week !== inscripcion.current_week || sesion.program_day !== inscripcion.current_day) {
      return null
    }

    const p = inscripcion.program as unknown as { weeks: number; days_per_week: number }
    const avance = siguiente(inscripcion.current_week, inscripcion.current_day, p.days_per_week, p.weeks)

    await supabase
      .from('program_enrollments')
      .update(avance)
      .eq('id', inscripcion.id)

    return { current_week: avance.current_week, current_day: avance.current_day, status: avance.status }
  } catch (e) {
    logger.warn(`No se pudo avanzar el programa tras cerrar la sesión: ${(e as Error).message}`)
    return null
  }
}

export { claveEjercicio }
