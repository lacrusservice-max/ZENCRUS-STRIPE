/**
 * CICLO MENSTRUAL
 * ═══════════════════════════════════════════════════════════════════════════
 * Las tablas de la migración 018. Hasta hoy el módulo entero vivía en el
 * AsyncStorage del teléfono: reinstalar la app perdía el historial, que es
 * justo el problema que esa migración existía para resolver.
 *
 * ── Estas son las tablas más sensibles del proyecto ────────────────────────
 * Un fallo de filtrado aquí no es un bug de privacidad cualquiera: es el
 * historial reproductivo de una persona en manos de otra. El proyecto no usa
 * Supabase Auth, así que `auth.uid()` es NULL y la RLS está activada SIN
 * política permisiva: lo único que separa los datos de dos usuarias es el
 * `.eq('user_id', userId)` de cada consulta de este archivo, con el userId
 * salido del token y de ningún otro sitio. Nunca del cuerpo, nunca de la ruta.
 *
 * ── `cycle_periods` es una vista materializada ─────────────────────────────
 * No es una segunda fuente de verdad: se recalcula desde `cycle_logs` en la
 * misma petición en que cambia el sangrado. Guardar en su lugar lo que el móvil
 * dedujo haría que dos versiones distintas de la app escribieran periodos
 * distintos sobre los mismos datos, y el historial dependería de quién
 * sincronizó el último.
 *
 * ── Lo que aquí NUNCA se escribe ───────────────────────────────────────────
 * La ruta local de la foto de un test. Llega en el cuerpo porque el esquema la
 * acepta, y se descarta antes del insert (ver `limpiarTracker`). Descartarla
 * solo en el cliente no serviría: bastaría una versión vieja de la app.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import {
  TRACKER_KINDS, type TrackerKind, limpiarTracker, derivarPeriodos,
} from '../utils/ciclo'

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser YYYY-MM-DD')
const KIND = z.enum(TRACKER_KINDS)

// ── Esquemas ─────────────────────────────────────────────────────────────────

export const rangoSchema = z.object({
  query: z.object({
    desde: FECHA.optional(),
    hasta: FECHA.optional(),
    limit: z.coerce.number().int().min(1).max(5000).default(3000),
  }).refine(q => !q.desde || !q.hasta || q.desde <= q.hasta, 'El rango está invertido'),
})

export const guardarPerfilSchema = z.object({
  body: z.object({
    lifeMode: z.enum([
      'seguimiento', 'buscando_embarazo', 'embarazo', 'posparto',
      'perimenopausia', 'anticoncepcion_continua', 'sin_ciclo',
    ]).optional(),
    contraception: z.string().max(80).nullable().optional(),
    /* Lo que declara en el alta. Los topes son los del CHECK de la 021: si el
       esquema aceptara más, el error saldría de Postgres y llegaría como un
       500 en vez de como un «ese número no puede ser». */
    declaredCycleDays: z.number().int().min(15).max(60).nullable().optional(),
    declaredPeriodDays: z.number().int().min(1).max(15).nullable().optional(),
    lockBiometric: z.boolean().optional(),
    lockTimeoutS: z.number().int().min(0).max(86_400).optional(),
    discreetMode: z.boolean().optional(),
    anonymousMode: z.boolean().optional(),
  }).refine(b => Object.keys(b).length > 0, 'Nada que actualizar'),
})

export const registrarSchema = z.object({
  params: z.object({ fecha: FECHA, kind: KIND }),
  body: z.object({
    value: z.unknown(),
    note: z.string().max(500).nullable().optional(),
    source: z.enum(['manual', 'voz', 'widget', 'wearable', 'import']).default('manual'),
  }),
})

export const borrarSchema = z.object({
  params: z.object({ fecha: FECHA, kind: KIND }),
})

/**
 * El lote es la cola de sincronización del móvil.
 *
 * `value: null` significa borrado, y viaja por el mismo canal a propósito:
 * borrar un registro ES un cambio, y si los borrados fueran por otra vía
 * podrían llegar desordenados respecto a las escrituras del mismo día.
 */
export const loteSchema = z.object({
  body: z.object({
    cambios: z.array(z.object({
      fecha: FECHA,
      kind: KIND,
      value: z.unknown().nullable(),
      source: z.enum(['manual', 'voz', 'widget', 'wearable', 'import']).optional(),
    })).min(1).max(1000),
  }),
})

export const declararSchema = z.object({ body: z.object({ fecha: FECHA }) })
export const fechaSchema = z.object({ params: z.object({ fecha: FECHA }) })

export const prediccionSchema = z.object({
  body: z.object({
    modelVersion: z.string().min(1).max(40),
    nextPeriodLow: FECHA,
    nextPeriodLikely: FECHA,
    nextPeriodHigh: FECHA,
    ovulationLow: FECHA.nullable().optional(),
    ovulationLikely: FECHA.nullable().optional(),
    ovulationHigh: FECHA.nullable().optional(),
    fertileStart: FECHA.nullable().optional(),
    fertileEnd: FECHA.nullable().optional(),
    confidence: z.number().int().min(0).max(100),
    sampleCycles: z.number().int().min(0).max(500).default(0),
    suppressedReason: z.string().max(200).nullable().optional(),
  }).refine(
    b => b.nextPeriodLow <= b.nextPeriodLikely && b.nextPeriodLikely <= b.nextPeriodHigh,
    'La banda está invertida',
  ),
})

// ── Traducción ───────────────────────────────────────────────────────────────

function aPerfil(f: any) {
  return {
    cycleEnabled: f.cycle_enabled,
    lifeMode: f.life_mode,
    declaredCycleDays: f.declared_cycle_days,
    declaredPeriodDays: f.declared_period_days,
    avgCycleDays: f.avg_cycle_days,
    avgPeriodDays: f.avg_period_days,
    contraception: f.contraception,
    lockBiometric: f.lock_biometric,
    lockTimeoutS: f.lock_timeout_s,
    discreetMode: f.discreet_mode,
    anonymousMode: f.anonymous_mode,
  }
}

/** fecha → { kind: value }. Es la forma exacta que ya usa `cicloStore`. */
function aLogs(filas: any[]): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const f of filas) {
    const dia = out[f.log_date] ?? (out[f.log_date] = {})
    dia[f.kind] = f.value
  }
  return out
}

// ── Vista materializada de periodos ──────────────────────────────────────────

/**
 * Recalcula `cycle_periods` desde el sangrado registrado.
 *
 * Se llama después de CUALQUIER cambio que toque el sangrado o los inicios
 * declarados. Es idempotente: correrla dos veces deja lo mismo.
 *
 * ── Por qué upsert y borrado del sobrante, y no «borrar todo e insertar» ───
 * Porque el borrado total abre una ventana en la que la usuaria no tiene
 * periodos, y si el insert falla ahí se queda. Con este orden, un fallo del
 * upsert no cambia nada y un fallo del borrado deja filas de más —recuperable
 * en el siguiente recálculo— pero nunca pierde historial.
 *
 * Los inicios declarados se leen ANTES de tocar nada y vuelven a entrar
 * marcados: son la única entrada de esta tabla que no se puede deducir.
 */
async function recalcularPeriodos(userId: string): Promise<void> {
  const [{ data: sangrados }, { data: declaradas }] = await Promise.all([
    supabase
      .from('cycle_logs')
      .select('log_date, value')
      .eq('user_id', userId)
      .eq('kind', 'sangrado')
      .order('log_date', { ascending: true }),
    supabase
      .from('cycle_periods')
      .select('start_date')
      .eq('user_id', userId)
      .eq('declared', true),
  ])

  const entradas = (sangrados || []).map(f => ({
    fecha: f.log_date as string,
    nivel: Number((f.value as any)?.level ?? 0),
    /* Sin esto, el servidor deduciría periodos que el cliente no deduce: ella
       marca «sangrado fuera del periodo», la app lo respeta, y el recálculo del
       servidor le abre igualmente un periodo fantasma que vuelve a bajar. */
    fueraDePeriodo: (f.value as any)?.fueraDePeriodo === true,
  }))
  const declarados = (declaradas || []).map(f => f.start_date as string)

  const periodos = derivarPeriodos(entradas, declarados)

  if (!periodos.length) {
    // Sin sangrado y sin declaraciones no hay periodos: la tabla queda vacía.
    await supabase.from('cycle_periods').delete().eq('user_id', userId)
    return
  }

  const filas = periodos.map(p => ({
    user_id: userId,
    start_date: p.inicio,
    end_date: p.fin,
    // Todas son reales: esta tabla nunca guarda periodos predichos. Ver 019.
    confirmed: true,
    declared: p.declarado,
    cycle_days: p.duracionCiclo,
  }))

  const { error } = await supabase
    .from('cycle_periods')
    .upsert(filas, { onConflict: 'user_id,start_date' })

  if (error) {
    logger.error('recalcularPeriodos (upsert):', error.message)
    return
  }

  // Lo que ya no sale de la deducción se retira.
  const vigentes = periodos.map(p => p.inicio)
  const { error: errSobra } = await supabase
    .from('cycle_periods')
    .delete()
    .eq('user_id', userId)
    .not('start_date', 'in', `(${vigentes.map(f => `"${f}"`).join(',')})`)

  if (errSobra) logger.warn('recalcularPeriodos (sobrantes):', errSobra.message)
}

/** Crea la fila de perfil si no existe. Devuelve la fila, venga de donde venga. */
async function perfilDe(userId: string): Promise<any | null> {
  const { data } = await supabase
    .from('health_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (data) return data

  /* `ignoreDuplicates` cubre dos peticiones simultáneas —la app arrancando
     mientras ZENA lee— que sin él dejarían una con error de llave repetida. */
  await supabase
    .from('health_profile')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })

  const { data: recien } = await supabase
    .from('health_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return recien ?? null
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/**
 * GET /cycle — todo lo que la app necesita al abrir.
 *
 * Perfil, registros, periodos y declaraciones en una sola petición. La pantalla
 * los necesita los cuatro para pintar el primer frame; en cuatro llamadas se
 * vería rellenándose por trozos.
 */
export async function obtenerCiclo(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { desde, hasta, limit } = req.query as unknown as {
    desde?: string; hasta?: string; limit: number
  }

  let q = supabase
    .from('cycle_logs')
    .select('log_date, kind, value, note, source')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(limit)

  if (desde) q = q.gte('log_date', desde)
  if (hasta) q = q.lte('log_date', hasta)

  const [perfil, { data: logs, error }, { data: periodos }] = await Promise.all([
    perfilDe(userId),
    q,
    supabase
      .from('cycle_periods')
      .select('start_date, end_date, cycle_days, declared')
      .eq('user_id', userId)
      .order('start_date', { ascending: true }),
  ])

  if (error) {
    logger.error('obtenerCiclo:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo leer tu ciclo' } satisfies ApiResponse)
    return
  }

  res.status(200).json({
    success: true,
    data: {
      profile: perfil ? aPerfil(perfil) : null,
      logs: aLogs(logs || []),
      periods: (periodos || []).map(p => ({
        inicio: p.start_date,
        fin: p.end_date,
        duracionCiclo: p.cycle_days,
        declarado: p.declared,
      })),
      declared: (periodos || []).filter(p => p.declared).map(p => p.start_date),
    },
  } satisfies ApiResponse)
}

/** PUT /cycle/profile */
export async function guardarPerfil(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const b = req.body

  await perfilDe(userId)

  const cambios: Record<string, unknown> = {}
  if (b.lifeMode !== undefined) cambios.life_mode = b.lifeMode
  if (b.contraception !== undefined) cambios.contraception = b.contraception
  if (b.declaredCycleDays !== undefined) cambios.declared_cycle_days = b.declaredCycleDays
  if (b.declaredPeriodDays !== undefined) cambios.declared_period_days = b.declaredPeriodDays
  if (b.lockBiometric !== undefined) cambios.lock_biometric = b.lockBiometric
  if (b.lockTimeoutS !== undefined) cambios.lock_timeout_s = b.lockTimeoutS
  if (b.discreetMode !== undefined) cambios.discreet_mode = b.discreetMode
  if (b.anonymousMode !== undefined) cambios.anonymous_mode = b.anonymousMode

  /* `cycle_enabled` NO se toca desde aquí a propósito: es la llave que decide
     si el módulo existe para esta cuenta, y una pantalla de ajustes del propio
     módulo no debe poder concedérsela a nadie. Se activa en el perfil, fuera. */

  const { data, error } = await supabase
    .from('health_profile')
    .update(cambios)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    logger.error('guardarPerfil:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: aPerfil(data) } satisfies ApiResponse)
}

/** PUT /cycle/logs/:fecha/:kind */
export async function registrarLog(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { fecha, kind } = req.params as { fecha: string; kind: TrackerKind }
  const { value, note, source } = req.body

  const limpio = limpiarTracker(kind, value)
  if (limpio === null) {
    res.status(422).json({
      success: false,
      message: `El valor de «${kind}» no tiene la forma esperada`,
    } satisfies ApiResponse)
    return
  }

  const { error } = await supabase
    .from('cycle_logs')
    .upsert({
      user_id: userId, log_date: fecha, kind,
      value: limpio, note: note ?? null, source,
    }, { onConflict: 'user_id,log_date,kind' })

  if (error) {
    logger.error('registrarLog:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar el registro' } satisfies ApiResponse)
    return
  }

  if (kind === 'sangrado') await recalcularPeriodos(userId)

  res.status(200).json({ success: true } satisfies ApiResponse)
}

/** DELETE /cycle/logs/:fecha/:kind */
export async function borrarLog(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { fecha, kind } = req.params as { fecha: string; kind: TrackerKind }

  const { error } = await supabase
    .from('cycle_logs')
    .delete()
    .eq('user_id', userId)
    .eq('log_date', fecha)
    .eq('kind', kind)

  if (error) {
    logger.error('borrarLog:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo borrar' } satisfies ApiResponse)
    return
  }

  if (kind === 'sangrado') await recalcularPeriodos(userId)

  res.status(200).json({ success: true } satisfies ApiResponse)
}

/**
 * POST /cycle/logs/batch — la cola de sincronización.
 *
 * Los cambios malformados se apartan y se cuentan en la respuesta en vez de
 * tumbar el lote entero: si un registro viejo de una versión anterior ya no
 * valida, la cola se quedaría atascada para siempre reintentándolo, y con ella
 * todo lo que hubiera detrás.
 */
export async function registrarLote(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { cambios } = req.body as {
    cambios: Array<{ fecha: string; kind: TrackerKind; value: unknown | null; source?: string }>
  }

  const escrituras: any[] = []
  const borrados: Array<{ fecha: string; kind: TrackerKind }> = []
  let descartados = 0
  let tocaSangrado = false

  /* El último cambio de un mismo (día, tracker) gana. Sin esto, un lote con
     dos ediciones del mismo dato produce dos filas en el upsert y Postgres
     rechaza el lote entero por afectar dos veces a la misma clave. */
  const ultimos = new Map<string, typeof cambios[number]>()
  for (const c of cambios) ultimos.set(`${c.fecha}|${c.kind}`, c)

  for (const c of ultimos.values()) {
    if (c.kind === 'sangrado') tocaSangrado = true

    if (c.value === null) {
      borrados.push({ fecha: c.fecha, kind: c.kind })
      continue
    }
    const limpio = limpiarTracker(c.kind, c.value)
    if (limpio === null) { descartados++; continue }

    escrituras.push({
      user_id: userId, log_date: c.fecha, kind: c.kind,
      value: limpio, source: c.source ?? 'manual',
    })
  }

  if (escrituras.length) {
    const { error } = await supabase
      .from('cycle_logs')
      .upsert(escrituras, { onConflict: 'user_id,log_date,kind' })
    if (error) {
      logger.error('registrarLote (upsert):', error.message)
      res.status(500).json({ success: false, message: 'No se pudo sincronizar' } satisfies ApiResponse)
      return
    }
  }

  for (const b of borrados) {
    const { error } = await supabase
      .from('cycle_logs')
      .delete()
      .eq('user_id', userId)
      .eq('log_date', b.fecha)
      .eq('kind', b.kind)
    if (error) logger.warn('registrarLote (borrado):', error.message)
  }

  if (tocaSangrado) await recalcularPeriodos(userId)

  res.status(200).json({
    success: true,
    data: { escritos: escrituras.length, borrados: borrados.length, descartados },
  } satisfies ApiResponse)
}

/** POST /cycle/periods — «aquí empezó mi regla», dicho a mano. */
export async function declararInicio(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { fecha } = req.body as { fecha: string }

  const { error } = await supabase
    .from('cycle_periods')
    .upsert({
      user_id: userId, start_date: fecha, confirmed: true, declared: true,
    }, { onConflict: 'user_id,start_date' })

  if (error) {
    logger.error('declararInicio:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar' } satisfies ApiResponse)
    return
  }

  await recalcularPeriodos(userId)
  res.status(200).json({ success: true } satisfies ApiResponse)
}

/**
 * DELETE /cycle/periods/:fecha — retirar la declaración.
 *
 * Se borra la fila y se recalcula. Si ese día tiene sangrado registrado, el
 * recálculo puede devolver un periodo que empiece ahí —ya sin `declared`—, y
 * eso es correcto: se retira la afirmación, no el hecho.
 */
export async function quitarInicio(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { fecha } = req.params as { fecha: string }

  const { error } = await supabase
    .from('cycle_periods')
    .delete()
    .eq('user_id', userId)
    .eq('start_date', fecha)
    .eq('declared', true)

  if (error) {
    logger.error('quitarInicio:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo quitar' } satisfies ApiResponse)
    return
  }

  await recalcularPeriodos(userId)
  res.status(200).json({ success: true } satisfies ApiResponse)
}

/**
 * PUT /cycle/prediction — guardar la predicción que calculó el móvil.
 *
 * El cálculo vive en el cliente y no aquí. No es por comodidad: la predicción
 * tiene que existir sin red —se abre la app en el metro— y duplicar el motor
 * en dos lenguajes es la receta para que ambos se desincronicen. Lo que se
 * guarda es el RESULTADO, con su banda y su confianza, para que ZENA y el
 * informe clínico puedan leerlo sin recalcular.
 */
export async function guardarPrediccion(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const b = req.body

  const { error } = await supabase.from('cycle_predictions').insert({
    user_id: userId,
    model_version: b.modelVersion,
    next_period_low: b.nextPeriodLow,
    next_period_likely: b.nextPeriodLikely,
    next_period_high: b.nextPeriodHigh,
    ovulation_low: b.ovulationLow ?? null,
    ovulation_likely: b.ovulationLikely ?? null,
    ovulation_high: b.ovulationHigh ?? null,
    fertile_start: b.fertileStart ?? null,
    fertile_end: b.fertileEnd ?? null,
    confidence: b.confidence,
    sample_cycles: b.sampleCycles,
    suppressed_reason: b.suppressedReason ?? null,
  })

  if (error) {
    logger.error('guardarPrediccion:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar la predicción' } satisfies ApiResponse)
    return
  }

  res.status(201).json({ success: true } satisfies ApiResponse)
}

/**
 * DELETE /cycle — el borrado de verdad.
 *
 * Borra, no oculta, y sin pedirle permiso a nadie. Media docena de apps de la
 * categoría hacen que «borrar» quite el dato de la pantalla y lo deje en la
 * base; en datos reproductivos eso no es un matiz.
 *
 * El perfil se conserva con sus preferencias de privacidad: si se borrara,
 * quien tenía el bloqueo biométrico puesto se encontraría el módulo abierto
 * la próxima vez, que es lo contrario de lo que acaba de pedir.
 */
export async function borrarTodo(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const tablas = ['cycle_logs', 'cycle_periods', 'cycle_predictions', 'cycle_correlations']
  for (const t of tablas) {
    const { error } = await supabase.from(t).delete().eq('user_id', userId)
    if (error) {
      logger.error(`borrarTodo (${t}):`, error.message)
      res.status(500).json({
        success: false,
        message: 'No se pudo borrar todo. No se ha borrado nada a medias: vuelve a intentarlo.',
      } satisfies ApiResponse)
      return
    }
  }

  await supabase
    .from('health_profile')
    .update({ avg_cycle_days: null, avg_period_days: null })
    .eq('user_id', userId)

  res.status(200).json({ success: true } satisfies ApiResponse)
}
