/**
 * HÁBITOS
 * ───────
 * Qué hábitos sigue cada quien (`habit_definitions`) y cuáles cumplió cada día
 * (`habit_logs`). Son dos tablas y un solo controlador porque nadie pregunta
 * por unas sin las otras: la pantalla pinta la lista y la rejilla de la semana
 * en el mismo golpe.
 *
 * ── Los cinco de fábrica los siembra el servidor ────────────────────────────
 * Hasta ahora `DEFAULT_HABITS` era una constante del móvil, así que los hábitos
 * de alguien no existían hasta que abría la app. Eso deja a ZENA sin nada que
 * leer justo cuando más falta hace —los primeros días— y hace que el mismo
 * `habit_key` signifique una cosa u otra según la versión instalada.
 *
 * Se siembran aquí, y solo cuando el usuario no tiene NINGUNA definición. La
 * condición es la que hace que todo lo demás funcione: si se sembraran siempre
 * que falte alguno, borrar un hábito de fábrica lo resucitaría en la siguiente
 * lectura y el botón de borrar parecería roto.
 *
 * ── Por eso borrar es desactivar ────────────────────────────────────────────
 * `DELETE` pone `activo=false`, no borra la fila. Con un borrado real el
 * usuario tiene cero definiciones otra vez y la siembra le devuelve los cinco.
 *
 * ── Una fila por hábito y día ───────────────────────────────────────────────
 * No un JSON por día. Lo explica la migración: la pregunta más frecuente es
 * «¿cuántos días seguidos lleva con esto?», y sobre un blob eso obliga a
 * leerlo todo y recorrerlo en memoria.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser YYYY-MM-DD')

/**
 * Los mismos cinco que tenía `habitsStore`, con las mismas llaves. Cambiar una
 * llave aquí desconectaría el histórico de quien ya la tenga apuntada: los
 * registros viejos seguirían diciendo `sleep` y nadie los reclamaría.
 */
const POR_DEFECTO = [
  { habit_key: 'sleep', label: 'Dormir 7h o más', icon: 'moon', momento: 'noche', hora: '23:00', tipo: 'hacer', meta_segundos: null, hora_fin: '06:00' },
  { habit_key: 'water', label: '8 vasos de agua', icon: 'water', momento: 'manana', hora: null, tipo: 'hacer', meta_segundos: null },
  { habit_key: 'workout', label: 'Entrenar', icon: 'barbell', momento: 'tarde', hora: null, tipo: 'hacer', meta_segundos: null },
  { habit_key: 'protein', label: 'Proteína objetivo', icon: 'restaurant', momento: 'manana', hora: null, tipo: 'hacer', meta_segundos: null },
  { habit_key: 'mind', label: 'Respirar / meditar 5 min', icon: 'leaf', momento: 'manana', hora: '07:00', tipo: 'hacer', meta_segundos: 300 },
]

// ── Esquemas ─────────────────────────────────────────────────────────────────

const LLAVE = z.string().min(1).max(60).regex(/^[a-zA-Z0-9_-]+$/, 'Llave de hábito inválida')

const MOMENTO = z.enum(['manana', 'tarde', 'noche'])
const TIPO = z.enum(['hacer', 'evitar'])
/** «07:00». Se guarda como `time`; los segundos no aportan nada aquí. */
const HORA = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora va como HH:MM')
/** Hasta 24 h. `null` significa «este hábito no lleva cronómetro». */
const META = z.number().int().min(1).max(86400)
/** Máscara de días: bit 0 = lunes … bit 6 = domingo. 127 son los siete. */
const DIAS = z.number().int().min(1).max(127)

export const listarHabitosSchema = z.object({
  query: z.object({
    desde: FECHA.optional(),
    hasta: FECHA.optional(),
    limit: z.coerce.number().int().min(1).max(5000).default(2000),
  }).refine(q => !q.desde || !q.hasta || q.desde <= q.hasta, 'El rango está invertido'),
})

/**
 * La llave la pone el móvil, igual que el `clientId` de las comidas: la
 * pantalla ya genera `custom_<timestamp>` al crear el hábito y necesita poder
 * marcarlo como cumplido antes de que el servidor conteste.
 */
export const crearHabitoSchema = z.object({
  body: z.object({
    habitKey: LLAVE,
    label: z.string().min(1).max(120),
    icon: z.string().min(1).max(60).default('checkmark'),
    orden: z.number().int().min(0).max(999).optional(),
    momento: MOMENTO.default('manana'),
    hora: HORA.nullish(),
    tipo: TIPO.default('hacer'),
    metaSegundos: META.nullish(),
    alarma: z.boolean().default(false),
    alarmaDias: DIAS.default(127),
    alarmaFin: z.boolean().default(false),
    alarmaFinDias: DIAS.default(127),
    alarmaSonido: z.string().min(1).max(60).nullish(),
    alarmaPosponer: z.boolean().default(true),
    horaFin: HORA.nullish(),
  }),
})

export const actualizarHabitoSchema = z.object({
  params: z.object({ key: LLAVE }),
  body: z.object({
    label: z.string().min(1).max(120).optional(),
    icon: z.string().min(1).max(60).optional(),
    activo: z.boolean().optional(),
    orden: z.number().int().min(0).max(999).optional(),
    momento: MOMENTO.optional(),
    hora: HORA.nullish(),
    tipo: TIPO.optional(),
    metaSegundos: META.nullish(),
    alarma: z.boolean().optional(),
    alarmaDias: DIAS.optional(),
    alarmaFin: z.boolean().optional(),
    alarmaFinDias: DIAS.optional(),
    alarmaSonido: z.string().min(1).max(60).nullish(),
    alarmaPosponer: z.boolean().optional(),
    horaFin: HORA.nullish(),
  }).refine(b => Object.keys(b).length > 0, 'Nada que actualizar'),
})

export const llaveHabitoSchema = z.object({ params: z.object({ key: LLAVE }) })

export const marcarHabitoSchema = z.object({
  params: z.object({ key: LLAVE, fecha: FECHA }),
  body: z.object({
    hecho: z.boolean().default(true),
    segundos: z.number().int().min(0).max(86400).optional(),
  }),
})

export const registrarLogsSchema = z.object({
  body: z.object({
    logs: z.array(z.object({
      habitKey: LLAVE,
      date: FECHA,
      hecho: z.boolean(),
      segundos: z.number().int().min(0).max(86400).optional(),
    })).min(1).max(2000),
  }),
})

// ── Traducción ───────────────────────────────────────────────────────────────

function aHabito(f: any) {
  return {
    id: f.habit_key,          // el store llama `id` a lo que aquí es la llave
    habitKey: f.habit_key,
    label: f.label,
    icon: f.icon,
    esDefault: f.es_default,
    activo: f.activo,
    orden: f.orden,
    momento: f.momento,
    // Postgres devuelve `time` como «07:00:00»; a la pantalla le sobra el resto.
    hora: f.hora ? String(f.hora).slice(0, 5) : null,
    tipo: f.tipo,
    metaSegundos: f.meta_segundos,
    alarma: f.alarma,
    alarmaDias: f.alarma_dias,
    alarmaFin: f.alarma_fin,
    alarmaFinDias: f.alarma_fin_dias,
    alarmaSonido: f.alarma_sonido,
    alarmaPosponer: f.alarma_posponer,
    // Igual que `hora`: Postgres la da como «06:00:00» y sobra el resto.
    horaFin: f.hora_fin ? String(f.hora_fin).slice(0, 5) : null,
  }
}

/**
 * Los registros salen con la forma que el store ya usa —fecha → hábito →
 * booleano— para que no tenga que darles la vuelta al recibirlos.
 */
function aLogs(filas: any[]): {
  logs: Record<string, Record<string, boolean>>
  segundos: Record<string, Record<string, number>>
} {
  const logs: Record<string, Record<string, boolean>> = {}
  const segundos: Record<string, Record<string, number>> = {}
  for (const f of filas) {
    const dia = logs[f.log_date] ?? (logs[f.log_date] = {})
    dia[f.habit_key] = f.hecho
    // El mapa de segundos va aparte para no cambiarle la forma a `logs`, que
    // media app ya lee como fecha → hábito → booleano. Solo aparecen los días
    // en que de verdad se cronometró algo.
    if (f.segundos) {
      const s = segundos[f.log_date] ?? (segundos[f.log_date] = {})
      s[f.habit_key] = f.segundos
    }
  }
  return { logs, segundos }
}

/** Las llaves que el usuario tiene dadas de alta, activas o no. */
async function llavesDe(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('habit_definitions')
    .select('habit_key')
    .eq('user_id', userId)
  return new Set((data || []).map(f => f.habit_key))
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/** GET /tracking/habits — la lista y el cumplimiento. */
export async function listarHabitos(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { desde, hasta, limit } = req.query as unknown as { desde?: string; hasta?: string; limit: number }

  const { data: definiciones, error: errDef } = await supabase
    .from('habit_definitions')
    .select('*')
    .eq('user_id', userId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })

  if (errDef) {
    logger.error('listarHabitos:', errDef.message)
    res.status(500).json({ success: false, message: 'No se pudieron leer los hábitos' } satisfies ApiResponse)
    return
  }

  let habitos = definiciones || []

  // Primera vez: se siembran los cinco de fábrica. `ignoreDuplicates` cubre el
  // caso de dos peticiones a la vez —la app arrancando mientras ZENA lee— que
  // sin él dejaría una de las dos con un error de llave repetida.
  if (habitos.length === 0) {
    const semilla = POR_DEFECTO.map((h, i) => ({
      ...h, user_id: userId, es_default: true, activo: true, orden: i,
    }))

    const { error: errSemilla } = await supabase
      .from('habit_definitions')
      .upsert(semilla, { onConflict: 'user_id,habit_key', ignoreDuplicates: true })

    if (errSemilla) {
      logger.error('listarHabitos (siembra):', errSemilla.message)
      res.status(500).json({ success: false, message: 'No se pudieron crear los hábitos iniciales' } satisfies ApiResponse)
      return
    }

    const { data: recien } = await supabase
      .from('habit_definitions')
      .select('*')
      .eq('user_id', userId)
      .order('orden', { ascending: true })
    habitos = recien || []
  }

  let q = supabase
    .from('habit_logs')
    .select('habit_key, log_date, hecho, segundos')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(limit)

  if (desde) q = q.gte('log_date', desde)
  if (hasta) q = q.lte('log_date', hasta)

  const { data: registros, error: errLogs } = await q

  if (errLogs) {
    logger.error('listarHabitos (registros):', errLogs.message)
    res.status(500).json({ success: false, message: 'No se pudo leer el cumplimiento' } satisfies ApiResponse)
    return
  }

  res.status(200).json({
    success: true,
    data: { habits: habitos.map(aHabito), ...aLogs(registros || []) },
  } satisfies ApiResponse)
}

/** POST /tracking/habits — un hábito propio. */
export async function crearHabito(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const {
    habitKey, label, icon, orden, momento, hora, tipo, metaSegundos,
    alarma, alarmaDias, alarmaFin, alarmaFinDias,
    alarmaSonido, alarmaPosponer, horaFin,
  } = req.body

  const { data, error } = await supabase
    .from('habit_definitions')
    .upsert({
      user_id: userId,
      habit_key: habitKey,
      label,
      icon,
      es_default: false,
      activo: true,
      orden: orden ?? 100,
      momento,
      hora: hora ?? null,
      tipo,
      meta_segundos: metaSegundos ?? null,
      alarma,
      alarma_dias: alarmaDias,
      alarma_fin: alarmaFin,
      alarma_fin_dias: alarmaFinDias,
      alarma_sonido: alarmaSonido ?? null,
      alarma_posponer: alarmaPosponer,
      hora_fin: horaFin ?? null,
    }, { onConflict: 'user_id,habit_key' })
    .select()
    .single()

  if (error) {
    logger.error('crearHabito:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo crear el hábito' } satisfies ApiResponse)
    return
  }

  res.status(201).json({ success: true, data: aHabito(data) } satisfies ApiResponse)
}

/** PATCH /tracking/habits/:key — renombrar, cambiar icono, reordenar, reactivar. */
export async function actualizarHabito(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { key } = req.params
  const b = req.body

  const cambios: Record<string, unknown> = {}
  if (b.label !== undefined) cambios.label = b.label
  if (b.icon !== undefined) cambios.icon = b.icon
  if (b.activo !== undefined) cambios.activo = b.activo
  if (b.orden !== undefined) cambios.orden = b.orden
  if (b.momento !== undefined) cambios.momento = b.momento
  if (b.tipo !== undefined) cambios.tipo = b.tipo
  // `null` es un valor válido aquí: significa «quítale la hora» / «sin cronómetro».
  if (b.hora !== undefined) cambios.hora = b.hora
  if (b.metaSegundos !== undefined) cambios.meta_segundos = b.metaSegundos
  if (b.alarma !== undefined) cambios.alarma = b.alarma
  if (b.alarmaDias !== undefined) cambios.alarma_dias = b.alarmaDias
  if (b.alarmaFin !== undefined) cambios.alarma_fin = b.alarmaFin
  if (b.alarmaFinDias !== undefined) cambios.alarma_fin_dias = b.alarmaFinDias
  if (b.alarmaPosponer !== undefined) cambios.alarma_posponer = b.alarmaPosponer
  // `null` vale: quitar el sonido propio, dejar de ser horario de sueño.
  if (b.alarmaSonido !== undefined) cambios.alarma_sonido = b.alarmaSonido
  if (b.horaFin !== undefined) cambios.hora_fin = b.horaFin

  const { data, error } = await supabase
    .from('habit_definitions')
    .update(cambios)
    .eq('user_id', userId)
    .eq('habit_key', key)
    .select()
    .maybeSingle()

  if (error) {
    logger.error('actualizarHabito:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo actualizar el hábito' } satisfies ApiResponse)
    return
  }
  if (!data) {
    res.status(404).json({ success: false, message: 'Hábito no encontrado' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: aHabito(data) } satisfies ApiResponse)
}

/**
 * DELETE /tracking/habits/:key — se desactiva, no se borra.
 *
 * Dos razones. La de arriba: con la fila borrada el usuario vuelve a tener cero
 * definiciones y la siembra le devuelve los cinco de fábrica. Y una segunda,
 * que vale también para los propios: el histórico de `habit_logs` sigue ahí, y
 * sin definición serían meses de registros que nadie sabe leer.
 */
export async function eliminarHabito(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { key } = req.params

  const { data, error } = await supabase
    .from('habit_definitions')
    .update({ activo: false })
    .eq('user_id', userId)
    .eq('habit_key', key)
    .select()
    .maybeSingle()

  if (error) {
    logger.error('eliminarHabito:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo eliminar el hábito' } satisfies ApiResponse)
    return
  }
  if (!data) {
    res.status(404).json({ success: false, message: 'Hábito no encontrado' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: aHabito(data) } satisfies ApiResponse)
}

/**
 * PUT /tracking/habits/:key/log/:fecha — marcar o desmarcar.
 *
 * Se guarda el `false` en vez de borrar la fila: «lo marqué y lo quité» y «no
 * lo toqué» son cosas distintas, y la segunda es la que dice que ese día el
 * usuario ni miró la pantalla.
 *
 * Antes de escribir se comprueba que el hábito exista. La tabla no tiene clave
 * ajena a `habit_definitions`, así que sin esto una llave equivocada —de ZENA,
 * el día que registre hábitos— crearía filas que no aparecen en ninguna
 * pantalla y que nadie va a buscar nunca.
 */
export async function marcarHabito(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { key, fecha } = req.params
  const { hecho, segundos } = req.body

  const conocidas = await llavesDe(userId)
  if (!conocidas.has(key)) {
    res.status(404).json({ success: false, message: 'Hábito no encontrado' } satisfies ApiResponse)
    return
  }

  const { data, error } = await supabase
    .from('habit_logs')
    .upsert(
      {
        user_id: userId, habit_key: key, log_date: fecha, hecho,
        ...(segundos !== undefined ? { segundos } : {}),
      },
      { onConflict: 'user_id,habit_key,log_date' },
    )
    .select('habit_key, log_date, hecho, segundos')
    .single()

  if (error) {
    logger.error('marcarHabito:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar el hábito del día' } satisfies ApiResponse)
    return
  }

  res.status(200).json({
    success: true,
    data: { habitKey: data.habit_key, date: data.log_date, hecho: data.hecho },
  } satisfies ApiResponse)
}

/**
 * POST /tracking/habits/logs/batch — meses de cumplimiento, de una vez.
 *
 * Las llaves se comprueban contra las definiciones en UNA consulta, no una por
 * registro: la migración de alguien con cuatro meses de historial son ~600
 * filas, y preguntar por cada una convertiría el primer arranque en un minuto
 * de espera.
 */
export async function registrarLogs(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { logs } = req.body as { logs: Array<{ habitKey: string; date: string; hecho: boolean; segundos?: number }> }

  const conocidas = await llavesDe(userId)
  const validos = logs.filter(l => conocidas.has(l.habitKey))

  // Los huérfanos no se rechazan con un error: vienen de un teléfono con
  // hábitos que se borraron hace meses y hacer fallar la migración entera por
  // eso costaría el histórico bueno que viene en el mismo lote.
  const descartados = logs.length - validos.length

  if (validos.length === 0) {
    res.status(200).json({ success: true, data: { count: 0, descartados } } satisfies ApiResponse)
    return
  }

  const { data, error } = await supabase
    .from('habit_logs')
    .upsert(
      validos.map(l => ({
        user_id: userId, habit_key: l.habitKey, log_date: l.date, hecho: l.hecho,
        ...(l.segundos !== undefined ? { segundos: l.segundos } : {}),
      })),
      { onConflict: 'user_id,habit_key,log_date' },
    )
    .select('habit_key')

  if (error) {
    logger.error('registrarLogs:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo guardar el cumplimiento' } satisfies ApiResponse)
    return
  }

  res.status(201).json({
    success: true,
    data: { count: data?.length ?? 0, descartados },
  } satisfies ApiResponse)
}
