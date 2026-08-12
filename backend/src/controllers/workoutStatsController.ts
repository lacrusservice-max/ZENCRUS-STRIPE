/**
 * ESTADÍSTICAS DE ENTRENAMIENTO
 * ─────────────────────────────
 * Lo que se puede decir de alguien a partir de lo que ha registrado.
 *
 * ── Se calculan aquí y no en el teléfono ────────────────────────────────────
 * Dos motivos. Uno: la app tendría que bajarse dos años de series para pintar
 * una barra. Dos, y más importante: si la cuenta la hace el cliente, cambiar la
 * fórmula obliga a que todo el mundo actualice para que sus números sean
 * comparables con los de ayer, y mientras tanto dos personas con los mismos
 * datos ven cosas distintas.
 *
 * ── La ventana es de días, no de «semanas naturales» ────────────────────────
 * «Los últimos 7 días» es una respuesta honesta cualquier día de la semana.
 * «Esta semana» dice que un lunes por la mañana no has entrenado nada, lo cual
 * es cierto y completamente inútil.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { supabase } from '../config/supabase'

const ok = <T>(res: Response, data: T) =>
  res.status(200).json({ success: true, data } satisfies ApiResponse)

const fail = (res: Response, code: number, message: string) =>
  res.status(code).json({ success: false, message } satisfies ApiResponse)

export const ventanaSchema = z.object({
  query: z.object({ days: z.coerce.number().int().min(1).max(400).optional() }),
})

export const curvaSchema = z.object({
  params: z.object({ key: z.string().min(1).max(160) }),
  query: z.object({ days: z.coerce.number().int().min(7).max(730).optional() }),
})

const desde = (dias: number) => new Date(Date.now() - dias * 86400_000).toISOString()

/**
 * Los grupos musculares que conoce el catálogo.
 *
 * Fijos y no derivados de lo que haya en la base: el mapa del cuerpo tiene que
 * enseñar los doce siempre, incluidos los que llevan un mes sin tocarse. Un
 * grupo que desaparece del dibujo por no haberlo entrenado es justo el que hay
 * que ver.
 */
export const GRUPOS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'core', 'fullbody',
] as const

/**
 * Cuántas horas tarda un grupo muscular en recuperarse.
 *
 * 48 h para los grandes y 24 h para los pequeños es lo que se maneja en la
 * literatura de hipertrofia, y es una GUÍA, no una prohibición: la app enseña
 * el estado, no impide entrenar. El core y los antebrazos aguantan más
 * frecuencia porque son de fibra lenta y se usan a diario de todas formas.
 */
const HORAS_RECUPERACION: Record<string, number> = {
  chest: 48, back: 48, shoulders: 48, quads: 72, hamstrings: 72, glutes: 48,
  biceps: 36, triceps: 36, forearms: 24, calves: 24, core: 24, fullbody: 48,
}

interface FilaSerie {
  muscle: string | null
  kind: string
  load_type: string
  weight_kg: number | null
  reps: number | null
  duration_seconds: number | null
  performed_at: string
  exercise_key: string
  exercise_name: string
  est_1rm: number | null
}

/**
 * Kilos movidos por una serie.
 *
 * El calentamiento no cuenta: cinco series de barra vacía dirían que se entrenó
 * más que nunca justo cuando se entrenó igual. Sin kilos el volumen es cero
 * —una plancha no mueve peso— y por eso el volumen NUNCA es la única medida que
 * se enseña: al lado va siempre el número de series, que sí cuenta en todos los
 * modos.
 */
const volumenDe = (s: FilaSerie): number =>
  s.kind !== 'warmup' && s.load_type === 'weight' && s.weight_kg && s.reps
    ? s.weight_kg * s.reps
    : 0

/** Series efectivas: las que de verdad estimulan. El calentamiento no. */
const cuenta = (s: FilaSerie): boolean => s.kind !== 'warmup'

// ── Resumen ──────────────────────────────────────────────────────────────────

/**
 * El panel de «Hoy»: lo que hace falta para decidir si entrenar y de qué.
 */
export async function resumen(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const dias = Number(req.query.days ?? 28)

  const { data: sesiones, error } = await supabase
    .from('workout_sessions')
    .select('id, mode, title, started_at, duration_seconds, total_sets, total_volume_kg, distance_m')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', desde(dias))
    .order('started_at', { ascending: false })

  if (error) { fail(res, 500, 'No se pudieron leer tus estadísticas'); return }

  const lista = sesiones ?? []
  const semana = lista.filter(s => s.started_at >= desde(7))

  /**
   * Totales de siempre, sin ventana.
   *
   * Los pide el perfil («llevas 214 entrenamientos») y no se pueden sacar de la
   * ventana de 28 días sin mentir. Es una consulta aparte porque trae otras
   * columnas y sin filtro de fecha: son unos cientos de filas por persona, dos
   * enteros cada una, y va por el índice `ws_user_time`.
   */
  const { data: todas } = await supabase
    .from('workout_sessions')
    .select('duration_seconds, total_volume_kg')
    .eq('user_id', userId)
    .eq('status', 'completed')

  const historico = {
    sesiones: (todas ?? []).length,
    minutos: Math.round((todas ?? []).reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / 60),
    volumen: Math.round((todas ?? []).reduce((a, s) => a + Number(s.total_volume_kg ?? 0), 0)),
  }

  /**
   * Lo de HOY, aparte.
   *
   * Lo preguntan el panel de inicio y el entrenador para saber si ya se ha
   * entrenado. Se resuelve en el servidor y no comparando fechas en el
   * teléfono: el día de la app es el del huso del móvil y el de la base es UTC,
   * y a las once de la noche eso son dos días distintos.
   */
  const hoy = new Date().toISOString().slice(0, 10)
  const deHoy = lista.find(s => s.started_at.slice(0, 10) === hoy) ?? null

  // La racha se cuenta en DÍAS con entrenamiento, no en sesiones: entrenar dos
  // veces un martes no son dos días de racha.
  const diasConEntreno = new Set(lista.map(s => s.started_at.slice(0, 10)))
  let racha = 0
  for (let i = 0; i < dias; i++) {
    const dia = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)
    if (diasConEntreno.has(dia)) racha++
    // El día de hoy sin entrenar todavía no rompe la racha: son las diez de la
    // mañana y queda el día entero por delante.
    else if (i > 0) break
  }

  ok(res, {
    ventanaDias: dias,
    sesiones: lista.length,
    sesionesSemana: semana.length,
    seriesSemana: semana.reduce((a, s) => a + (s.total_sets ?? 0), 0),
    volumenSemana: Math.round(semana.reduce((a, s) => a + Number(s.total_volume_kg ?? 0), 0)),
    minutosSemana: Math.round(semana.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / 60),
    racha,
    porModo: ['gym', 'home', 'outdoor', 'class'].map(m => ({
      mode: m, sesiones: lista.filter(s => s.mode === m).length,
    })),
    ultima: lista[0] ?? null,
    historico,
    entrenadoHoy: deHoy !== null,
    hoy: deHoy,
  })
}

// ── El cuerpo ────────────────────────────────────────────────────────────────

/**
 * Carga y recuperación por grupo muscular. Es lo que pinta el mapa anatómico.
 *
 * Devuelve SIEMPRE los doce grupos, incluidos los que están a cero: un grupo
 * que desaparece del dibujo por no haberse entrenado es exactamente el que hay
 * que ver. Ese hueco es la información.
 */
export async function porMusculo(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const dias = Number(req.query.days ?? 7)

  const { data, error } = await supabase
    .from('workout_sets')
    .select('muscle, kind, load_type, weight_kg, reps, duration_seconds, performed_at, exercise_key, exercise_name, est_1rm')
    .eq('user_id', userId)
    .gte('performed_at', desde(dias))

  if (error) { fail(res, 500, 'No se pudo leer la carga por músculo'); return }

  const series = (data ?? []) as FilaSerie[]
  const ahora = Date.now()

  const grupos = GRUPOS.map(grupo => {
    const suyas = series.filter(s => s.muscle === grupo && cuenta(s))
    const ultima = suyas.reduce<string | null>(
      (max, s) => (!max || s.performed_at > max ? s.performed_at : max), null,
    )

    const horasDesde = ultima ? (ahora - new Date(ultima).getTime()) / 3_600_000 : null
    const necesita = HORAS_RECUPERACION[grupo] ?? 48

    return {
      grupo,
      series: suyas.length,
      volumen: Math.round(suyas.reduce((a, s) => a + volumenDe(s), 0)),
      ultimaVez: ultima,
      horasDesde: horasDesde === null ? null : Math.round(horasDesde),
      /**
       * De 0 (recién machacado) a 1 (fresco). Null si nunca se ha entrenado:
       * no es lo mismo «descansado» que «sin datos», y pintarlos igual haría
       * que un principiante viera el cuerpo entero en verde.
       */
      recuperacion: horasDesde === null ? null
        : Math.min(1, Math.round((horasDesde / necesita) * 100) / 100),
    }
  })

  const totalSeries = grupos.reduce((a, g) => a + g.series, 0)

  ok(res, {
    ventanaDias: dias,
    totalSeries,
    grupos: grupos.map(g => ({
      ...g,
      // Reparto del esfuerzo. Es lo que enseña que llevas tres semanas sin
      // tocar las piernas mientras el pecho se lleva un tercio de todo.
      cuota: totalSeries > 0 ? Math.round((g.series / totalSeries) * 1000) / 1000 : 0,
    })),
  })
}

// ── Volumen en el tiempo ─────────────────────────────────────────────────────

/**
 * Volumen y series por semana. La curva de si se está progresando o parado.
 *
 * Se agrupa por semanas ISO (de lunes a domingo) porque una semana es la unidad
 * en la que se planifica el entrenamiento de verdad. Por días saldría un
 * diente de sierra donde el descanso parece un desplome.
 */
export async function volumenPorSemana(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const dias = Number(req.query.days ?? 84)   // doce semanas

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('started_at, total_sets, total_volume_kg, duration_seconds, mode')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', desde(dias))
    .order('started_at', { ascending: true })

  if (error) { fail(res, 500, 'No se pudo leer el volumen'); return }

  /** Lunes de la semana a la que pertenece una fecha. */
  const lunesDe = (iso: string) => {
    const d = new Date(iso)
    const dia = (d.getUTCDay() + 6) % 7   // 0 = lunes
    d.setUTCDate(d.getUTCDate() - dia)
    return d.toISOString().slice(0, 10)
  }

  const porSemana = new Map<string, { volumen: number; series: number; sesiones: number; minutos: number }>()

  // Se siembran TODAS las semanas de la ventana, también las vacías: sin esto
  // una semana sin entrenar no aparecería y la gráfica uniría los dos lados del
  // hueco con una línea recta, escondiendo justo el parón.
  for (let i = 0; i <= Math.ceil(dias / 7); i++) {
    porSemana.set(lunesDe(new Date(Date.now() - i * 7 * 86400_000).toISOString()),
      { volumen: 0, series: 0, sesiones: 0, minutos: 0 })
  }

  for (const s of data ?? []) {
    const k = lunesDe(s.started_at)
    const acc = porSemana.get(k) ?? { volumen: 0, series: 0, sesiones: 0, minutos: 0 }
    acc.volumen += Number(s.total_volume_kg ?? 0)
    acc.series += s.total_sets ?? 0
    acc.sesiones += 1
    acc.minutos += Math.round((s.duration_seconds ?? 0) / 60)
    porSemana.set(k, acc)
  }

  ok(res, {
    semanas: [...porSemana.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lunes, v]) => ({ lunes, ...v, volumen: Math.round(v.volumen) })),
  })
}

// ── La curva de un ejercicio ─────────────────────────────────────────────────

/**
 * Cómo va un ejercicio en el tiempo: el mejor 1RM estimado de cada día.
 *
 * El MEJOR del día y no todas las series: una sesión son cuatro puntos casi
 * iguales seguidos de un descenso por fatiga, y dibujarlos todos convierte una
 * tendencia clara en un electrocardiograma. Lo que interesa es el techo.
 */
export async function curvaEjercicio(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const dias = Number(req.query.days ?? 180)

  const { data, error } = await supabase
    .from('workout_sets')
    .select('performed_at, est_1rm, weight_kg, reps, exercise_name, kind, load_type, duration_seconds, muscle, exercise_key')
    .eq('user_id', userId)
    .eq('exercise_key', req.params.key)
    .gte('performed_at', desde(dias))
    .order('performed_at', { ascending: true })

  if (error) { fail(res, 500, 'No se pudo leer la curva del ejercicio'); return }

  const series = (data ?? []) as FilaSerie[]
  const porDia = new Map<string, { est1RM: number; weightKg: number | null; reps: number | null }>()

  for (const s of series) {
    if (!cuenta(s) || !s.est_1rm) continue
    const dia = s.performed_at.slice(0, 10)
    const actual = porDia.get(dia)
    if (!actual || Number(s.est_1rm) > actual.est1RM) {
      porDia.set(dia, { est1RM: Number(s.est_1rm), weightKg: s.weight_kg, reps: s.reps })
    }
  }

  ok(res, {
    exerciseKey: req.params.key,
    exerciseName: series[0]?.exercise_name ?? req.params.key,
    totalSeries: series.filter(cuenta).length,
    // Volumen acumulado del ejercicio: para los que no dan 1RM (dominadas,
    // planchas) es lo único que enseña progresión, y por eso va siempre.
    volumenTotal: Math.round(series.reduce((a, s) => a + volumenDe(s), 0)),
    puntos: [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, v]) => ({ dia, ...v })),
  })
}

// ── Lo que más se entrena ────────────────────────────────────────────────────

/**
 * Los ejercicios por volumen de trabajo.
 *
 * Sirve para dos cosas opuestas y las dos útiles: ver en qué se está apoyando
 * de verdad el entrenamiento, y ver qué se abandonó hace dos meses sin querer.
 */
export async function ejerciciosMasHechos(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const dias = Number(req.query.days ?? 90)

  const { data, error } = await supabase
    .from('workout_sets')
    .select('exercise_key, exercise_name, muscle, kind, load_type, weight_kg, reps, duration_seconds, performed_at, est_1rm')
    .eq('user_id', userId)
    .gte('performed_at', desde(dias))

  if (error) { fail(res, 500, 'No se pudieron leer tus ejercicios'); return }

  const porEjercicio = new Map<string, {
    exerciseKey: string; exerciseName: string; muscle: string | null
    series: number; volumen: number; ultimaVez: string; mejor1RM: number
  }>()

  for (const s of (data ?? []) as FilaSerie[]) {
    if (!cuenta(s)) continue
    const acc = porEjercicio.get(s.exercise_key) ?? {
      exerciseKey: s.exercise_key, exerciseName: s.exercise_name, muscle: s.muscle,
      series: 0, volumen: 0, ultimaVez: s.performed_at, mejor1RM: 0,
    }
    acc.series += 1
    acc.volumen += volumenDe(s)
    if (s.performed_at > acc.ultimaVez) acc.ultimaVez = s.performed_at
    if (s.est_1rm && Number(s.est_1rm) > acc.mejor1RM) acc.mejor1RM = Number(s.est_1rm)
    porEjercicio.set(s.exercise_key, acc)
  }

  ok(res, {
    ejercicios: [...porEjercicio.values()]
      .map(e => ({ ...e, volumen: Math.round(e.volumen) }))
      .sort((a, b) => b.series - a.series)
      .slice(0, 40),
  })
}
