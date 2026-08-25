/**
 * PROGRAMAS · CAPA DE DATOS
 * ─────────────────────────
 * Única puerta de la app a `/workout/programs`. Traduce nombres y ya: quién
 * decide qué se pide y cuándo es la pantalla.
 *
 * ── Los pósters vienen aparte, por slug ─────────────────────────────────────
 * Un plan repite ejercicios entre días —la sentadilla sale tres veces en el
 * programa de fuerza—, así que el servidor manda un mapa `slug → imagen` en vez
 * de una URL dentro de cada ejercicio. Firmar la misma imagen tres veces sería
 * trabajo regalado, y las direcciones caducan en una hora, así que tampoco se
 * guardan.
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/services/api'

// ── Formas ───────────────────────────────────────────────────────────────────

export type Objetivo = 'strength' | 'hypertrophy' | 'endurance' | 'general'
export type Nivel = 'beginner' | 'intermediate' | 'advanced'
export type Progresion = 'doble' | 'porcentaje' | 'tiempo' | 'fija'

export interface ProgramaCabecera {
  id: string
  user_id: string | null
  name: string
  description: string | null
  weeks: number
  days_per_week: number
  goal: Objetivo
  level: Nivel
  mode: 'gym' | 'home' | 'outdoor' | 'class'
  deload_every: number | null
  created_at: string
  esMio: boolean
}

export interface EjercicioPlan {
  slug?: string
  nombre: string
  series: number
  reps?: string
  duracion?: number
  descanso: number
  progresion: Progresion
  incremento?: number
  pct?: number[]
  carga?: 'weight' | 'bodyweight' | 'band' | 'assisted' | 'none'
  notas?: string
}

export interface DiaPlan {
  /** Su número dentro del plan, de 1 a N. Es la identidad, no el cuándo. */
  dia: number
  /**
   * Cuándo se hace: 0 = lunes … 6 = domingo.
   *
   * Opcional porque los planes creados antes de esto no lo traen. El servidor
   * les reparte los días al leerlos, así que siguen funcionando; al editarlos
   * en el planificador se quedan con día de la semana de verdad.
   */
  diaSemana?: number
  /** Los músculos que eligió su dueño. De aquí salió el nombre y la propuesta. */
  musculos?: string[]
  nombre: string
  foco?: string
  ejercicios: EjercicioPlan[]
}

export interface ProgramaDetalle extends ProgramaCabecera {
  plan: { dias: DiaPlan[] }
  posters: Record<string, string>
}

/** Un ejercicio ya resuelto para hoy: con su peso y el porqué. */
export interface Propuesta {
  slug?: string
  nombre: string
  series: number
  reps?: string
  duracion?: number
  descanso: number
  carga: 'weight' | 'bodyweight' | 'band' | 'assisted' | 'none'
  pesoKg: number | null
  motivo: string
  fijadoAMano: boolean
  esDescarga: boolean
  notas?: string
  /**
   * La clave del hueco EN EL PLAN, que no cambia aunque se sustituya el
   * ejercicio. Es con la que se fija un peso o se pide un cambio: usar la del
   * ejercicio actual haría que al cambiarlo se perdiera lo fijado.
   */
  clavePlan: string
  cambiado: boolean
  /** Cómo se llamaba el del plan, cuando se ha cambiado. */
  original: string | null
  muscle: string | null
  muscleEs: string | null
  /**
   * Con qué se hace. Estaba declarado desde siempre pero el servidor no lo
   * mandaba: ahora se rellena desde el catálogo por su slug, y es lo que
   * permite saber si un ejercicio dejó de encajar al cambiar el material.
   */
  equipment: string | null
  equipmentEs: string | null
  pattern: string | null
}

export interface Alternativa {
  slug: string
  nombre: string
  muscleEs: string | null
  equipmentEs: string
  /** La clave en inglés. `equipmentEs` es para leer; esta es para decidir. */
  equipment: string
  home: boolean
  poster: string | null
}

export interface DiaPropuesto {
  programa: {
    id: string; nombre: string; semanas: number; diasPorSemana: number
    mode: string; goal: string
  }
  esElDeHoy: boolean
  hecho: { sessionId: string; fecha: string } | null
  semana: number
  dia: number
  nombre: string
  foco?: string
  esDescarga: boolean
  ejercicios: Propuesta[]
  posters: Record<string, string>
}

export interface DiaCompletado {
  sessionId: string
  semana: number
  dia: number
  fecha: string
  series: number
  volumen: number
}

export interface Inscripcion {
  id: string
  program_id: string
  started_at: string
  current_week: number
  current_day: number
  status: 'active' | 'completed' | 'abandoned'
  overrides: Record<string, number>
  program: ProgramaCabecera & { plan: { dias: DiaPlan[] } }
  completados: DiaCompletado[]
  semanasDescarga: number[]
  posters: Record<string, string>
}

// ── Qué toca hoy ─────────────────────────────────────────────────────────────

/**
 * `estado` decide QUÉ se enseña arriba en la portada, y solo hay uno a la vez:
 *
 *   · `abierta`  — dejaste algo a medias. Manda sobre todo lo demás.
 *   · `hecho`    — ya entrenaste hoy.
 *   · `toca`     — te toca este día de tu plan.
 *   · `sinPlan`  — no sigues nada todavía.
 */
/**
 * `descanso` es nuevo: hoy no toca nada porque así lo pusiste tú.
 *
 * No es lo mismo que no tener plan, y la portada tiene que poder decirlo de
 * otra manera. Un día de descanso planeado es parte del plan, no un hueco.
 */
export type EstadoHoy = 'abierta' | 'hecho' | 'toca' | 'descanso' | 'sinPlan'

export interface DiaDeLaSemana {
  /** Su número dentro del plan, de 1 a N. Es la identidad, no el cuándo. */
  dia: number
  /** Cuándo se hace: 0 = lunes … 6 = domingo. */
  diaSemana: number
  nombre: string
  /** Los músculos que eligió el usuario para ese día. */
  musculos: string[]
  foco: string | null
  ejercicios: number
  series: number
  hecho: { sessionId: string; series: number; volumen: number } | null
  esHoy: boolean
  /** Su día ya pasó esta semana y no se hizo. Se puede hacer y cuenta igual. */
  pendiente: boolean
}

export interface Hoy {
  estado: EstadoHoy
  abierta: {
    id: string; title: string; mode: string; started_at: string; total_sets: number
    /** De qué día del plan es, si vino de uno. Decide a dónde lleva «seguir». */
    program_id: string | null
    program_week: number | null
    program_day: number | null
  } | null
  hechasHoy: {
    id: string; title: string; total_sets: number; total_volume_kg: number
    duration_seconds: number | null; started_at: string
    /** Gasto activo estimado. Null en las sesiones anteriores al estimador. */
    calories_kcal: number | null
  }[]
  programa: {
    id: string; nombre: string; semanas: number; diasPorSemana: number
    mode: string; goal: string; esMio: boolean
  } | null
  dia: DiaPropuesto | null
  semana: {
    numero: number; de: number; esDescarga: boolean; dias: DiaDeLaSemana[]
  } | null
  /**
   * El anillo de la semana. Viene SIEMPRE, con plan y sin plan: a quien entrena
   * por su cuenta es a quien más le sirve saber si esta semana lleva tres o uno.
   *
   * OJO con no confundir esto con `semana`, que es la del PROGRAMA. Esta es la
   * de calendario, de lunes a domingo, porque lo que mide es constancia.
   */
  anillo: {
    /** Lunes a domingo. */
    dias: boolean[]
    /** 0 = lunes. */
    hoy: number
    hechos: number
    objetivo: number
    origen: 'plan' | 'defecto'
    kcal: number
    sesiones: number
    desde: string
  } | null
}

const unwrap = <T>(res: { data?: { data?: T } }): T => res.data?.data as T

// ── Llamadas ─────────────────────────────────────────────────────────────────

/**
 * Todo lo que la portada necesita, en una sola petición.
 *
 * Manda el desfase horario del teléfono para que «hoy» sea el día natural de
 * quien pregunta. Sin esto, entrenar a las once de la noche en México contaría
 * en el día siguiente y la portada diría que aún no has entrenado.
 */
export const queTocaHoy = async (): Promise<Hoy> =>
  unwrap(await apiGet('/workout/today', {
    params: { tzOffset: new Date().getTimezoneOffset() },
  }))

export const listarProgramas = async (): Promise<ProgramaCabecera[]> =>
  unwrap(await apiGet('/workout/programs')) ?? []

export const getPrograma = async (id: string): Promise<ProgramaDetalle> =>
  unwrap(await apiGet(`/workout/programs/${id}`))

export const inscribirse = async (id: string): Promise<{ reanudada: boolean; anteriorAbandonado?: boolean }> =>
  unwrap(await apiPost(`/workout/programs/${id}/enroll`))

/** Null cuando no se está siguiendo ninguno: no es un error, es lo normal. */
export const miInscripcion = async (): Promise<Inscripcion | null> =>
  unwrap(await apiGet('/workout/programs/mine/enrollment')) ?? null

export const getDia = async (semana?: number, dia?: number): Promise<DiaPropuesto> =>
  unwrap(await apiGet('/workout/programs/mine/today', {
    params: semana != null && dia != null ? { week: semana, day: dia } : undefined,
  }))

export const fijarPeso = async (exerciseKey: string, weightKg: number | null) =>
  unwrap<{ overrides: Record<string, number> }>(
    await apiPost('/workout/programs/mine/override', { exerciseKey, weightKg }),
  )

export const abandonarPrograma = async (): Promise<void> => {
  await apiPost('/workout/programs/mine/abandon')
}

/** Lo que se manda al crear o editar un plan propio. */
export interface PlanPropio {
  name: string
  description?: string
  weeks: number
  goal: Objetivo
  level: Nivel
  mode: 'gym' | 'home' | 'outdoor' | 'class'
  deloadEvery?: number | null
  dias: {
    dia: number
    /** 0 = lunes … 6 = domingo. Dos días no pueden repetirlo: el servidor lo rechaza. */
    diaSemana: number
    musculos: string[]
    nombre: string
    foco?: string
    ejercicios: EjercicioPlan[]
  }[]
}

// ── El planificador ──────────────────────────────────────────────────────────

export interface Musculo { clave: string; nombre: string; corto: string }

export const getMusculos = async () =>
  unwrap<{ musculos: Musculo[]; diasSugeridos: { n: number; dias: number[] }[] }>(
    await apiGet('/workout/plan/musculos'),
  )

/**
 * «Pecho y tríceps» → los ejercicios, con series, reps y descanso ya puestos.
 *
 * Lo resuelve el servidor porque el catálogo de 206 vive allí. Lo que vuelve es
 * una PROPUESTA: no está guardada en ningún sitio y el usuario la edita antes
 * de que exista nada.
 */
export const proponerEjercicios = async (
  musculos: string[],
  modo: 'gym' | 'home' = 'gym',
  /**
   * Lo que hay en su casa. `null` = todavía no ha contestado y no se filtra;
   * `[]` = ha dicho que no tiene nada, y entonces solo queda peso corporal.
   * La diferencia importa: son dos estados distintos, no el mismo vacío.
   */
  aparejos: string[] | null = null,
) =>
  unwrap<{
    nombre: string
    ejercicios: (EjercicioPlan & { musculo: string })[]
    posters?: Record<string, string>
    motivo?: string
  }>(await apiGet(
    `/workout/plan/propuesta?musculos=${encodeURIComponent(musculos.join(','))}&modo=${modo}`
    + (modo === 'home' && aparejos !== null ? `&equipment=${encodeURIComponent(aparejos.join(','))}` : ''),
  ))

/** Lunes a domingo, como los cuenta el servidor: 0 = lunes. */
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * Guarda un plan tuyo. Sin `id` lo crea; con `id` lo actualiza.
 *
 * No se manda `days_per_week`: lo deduce el servidor de cuántos días trae el
 * plan. Un número aparte solo puede acabar sin cuadrar.
 */
export const guardarPlan = async (p: PlanPropio, id?: string): Promise<ProgramaCabecera> =>
  unwrap(id
    ? await apiPut(`/workout/programs/${id}`, p)
    : await apiPost('/workout/programs', p))

export const borrarPlan = async (id: string): Promise<void> => {
  await apiDelete(`/workout/programs/${id}`)
}

export const alternativasDe = async (planKey: string) =>
  unwrap<{
    original: { slug: string; nombre: string; muscleEs: string | null; equipmentEs: string }
    actual: string | null
    alternativas: Alternativa[]
  }>(await apiGet(`/workout/programs/mine/alternatives/${encodeURIComponent(planKey)}`))

/** `slug: null` devuelve el ejercicio original del plan. */
export const cambiarEjercicio = async (planKey: string, slug: string | null) =>
  unwrap<{ swaps: Record<string, string> }>(
    await apiPost('/workout/programs/mine/swap', { planKey, slug }),
  )

/**
 * Las series de aproximación antes de la primera pesada.
 *
 * Se calculan en la app y no se guardan en ningún sitio: no son trabajo, son
 * preparación, y meterlas en el historial ensuciaría el volumen y los récords.
 * Por eso el servidor no sabe nada de ellas.
 *
 * La barra vacía primero, y después tres aproximaciones. Se corta lo que no
 * llegue al peso de la barra: proponer «calienta con 15 kg» a quien va a
 * levantar 40 con una barra de 20 es proponer algo que no existe.
 */
export const calentamiento = (
  pesoKg: number | null,
  barraKg = 20,
): { pesoKg: number; reps: number }[] => {
  if (pesoKg == null || pesoKg <= barraKg) return []

  const paso = (kg: number) => Math.max(barraKg, Math.round(kg / 2.5) * 2.5)

  return [
    { pesoKg: barraKg, reps: 8 },
    { pesoKg: paso(pesoKg * 0.55), reps: 5 },
    { pesoKg: paso(pesoKg * 0.75), reps: 3 },
    { pesoKg: paso(pesoKg * 0.9), reps: 1 },
  ].filter((x, i, a) => i === 0 || x.pesoKg > a[i - 1].pesoKg)
}

// ── Presentación ─────────────────────────────────────────────────────────────

export const NOMBRE_OBJETIVO: Record<Objetivo, string> = {
  strength: 'Fuerza',
  hypertrophy: 'Músculo',
  endurance: 'Resistencia',
  general: 'General',
}

export const NOMBRE_NIVEL: Record<Nivel, string> = {
  beginner: 'Para empezar',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

export const NOMBRE_MODO: Record<string, string> = {
  gym: 'Gimnasio', home: 'En casa', outdoor: 'Aire libre', class: 'Dirigido',
}

/**
 * La misma clave con la que el servidor agrupa un ejercicio.
 *
 * Tiene que dar EXACTAMENTE lo mismo que `claveEjercicio` del backend, o fijar
 * un peso a mano lo guardaría bajo una clave y la progresión lo buscaría bajo
 * otra: el peso fijado no aparecería nunca y parecería que no se guardó.
 */
export const claveDe = (slug: string | undefined, nombre: string): string =>
  slug ?? nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** «5 × 8-12» o «3 × 30 s». Lo que se va a hacer, en una línea. */
export const prescripcion = (e: { series: number; reps?: string; duracion?: number }): string =>
  e.duracion != null
    ? `${e.series} × ${e.duracion} s`
    : `${e.series} × ${e.reps ?? '—'}`
