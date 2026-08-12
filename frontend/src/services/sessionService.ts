/**
 * SESIÓN DE ENTRENAMIENTO · CAPA DE DATOS
 * ───────────────────────────────────────
 * Única puerta de la app a `/workout/sessions`. Aquí no hay lógica: traduce
 * nombres y ya. Quién decide qué se manda y cuándo es el store.
 *
 * ── Todo lleva un `clientId` ────────────────────────────────────────────────
 * Lo pone la app, no el servidor. Es lo que permite reintentar sin miedo: si la
 * respuesta se pierde por el camino —que en un gimnasio pasa constantemente—,
 * el segundo intento devuelve lo que ya se guardó en vez de duplicarlo. Sin
 * esto, una barra de cobertura mala convierte cuatro series en ocho.
 */

import { apiGet, apiPost, apiDelete } from '@/services/api'

// ── Formas ───────────────────────────────────────────────────────────────────

export type Modo = 'gym' | 'home' | 'outdoor' | 'class'
export type Origen = 'routine' | 'program' | 'class' | 'freestyle'
export type TipoSerie = 'warmup' | 'normal' | 'dropset' | 'failure' | 'amrap' | 'superset'
export type TipoCarga = 'weight' | 'bodyweight' | 'band' | 'assisted' | 'none'

export interface Sesion {
  id: string
  mode: Modo
  source: Origen
  title: string
  routine_id: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  status: 'active' | 'completed' | 'discarded'
  total_sets: number
  total_reps: number
  total_volume_kg: number
  distance_m: number | null
  elevation_m: number | null
  calories_kcal: number | null
  perceived_effort: number | null
  notes: string | null
  client_id: string
}

export interface Serie {
  id: string
  session_id: string
  exercise_slug: string | null
  exercise_name: string
  exercise_key: string
  muscle: string | null
  order_index: number
  set_index: number
  kind: TipoSerie
  load_type: TipoCarga
  weight_kg: number | null
  band_color: string | null
  reps: number | null
  duration_seconds: number | null
  distance_m: number | null
  rir: number | null
  rpe: number | null
  rest_taken_seconds: number | null
  est_1rm: number | null
  notes: string | null
  client_id: string
  performed_at: string
}

export type Metrica = 'est_1rm' | 'max_weight' | 'max_reps' | 'max_duration' | 'max_distance' | 'best_volume'

export interface Marca {
  exercise_key: string
  exercise_name: string
  metric: Metrica
  value: number
  weight_kg: number | null
  reps: number | null
  achieved_at: string
  /** Póster firmado del catálogo. Null si el ejercicio se escribió a mano. */
  poster?: string | null
}

export interface MarcaNueva {
  metric: Metrica
  value: number
  previous: number | null
  exerciseName: string
}

export interface NuevaSerie {
  clientId: string
  exerciseSlug?: string
  exerciseName: string
  orderIndex: number
  setIndex: number
  kind: TipoSerie
  loadType: TipoCarga
  weightKg?: number | null
  bandColor?: string | null
  reps?: number | null
  durationSeconds?: number | null
  distanceM?: number | null
  rir?: number | null
  rpe?: number | null
  restTakenSeconds?: number | null
  notes?: string | null
}

export interface Cierre {
  durationSeconds?: number
  perceivedEffort?: number | null
  notes?: string | null
  distanceM?: number | null
  elevationM?: number | null
  caloriesKcal?: number | null
  avgHr?: number | null
  maxHr?: number | null
  metrics?: Record<string, unknown>
}

const unwrap = <T>(res: { data?: { data?: T } }): T => res.data?.data as T

// ── Llamadas ─────────────────────────────────────────────────────────────────

export const abrirSesion = async (b: {
  clientId: string; mode: Modo; source: Origen; title: string
  routineId?: string; programId?: string; programWeek?: number; programDay?: number
}): Promise<{ session: Sesion; sets: Serie[]; resumed: boolean }> =>
  unwrap(await apiPost('/workout/sessions', b))

export const sesionActiva = async (): Promise<{ session: Sesion; sets: Serie[] } | null> =>
  unwrap(await apiGet('/workout/sessions/active'))

export const registrarSerie = async (
  sessionId: string, s: NuevaSerie,
): Promise<{ set: Serie; records: MarcaNueva[] }> =>
  unwrap(await apiPost(`/workout/sessions/${sessionId}/sets`, s))

export const borrarSerie = async (sessionId: string, setId: string): Promise<void> => {
  await apiDelete(`/workout/sessions/${sessionId}/sets/${setId}`)
}

export const cerrarSesion = async (sessionId: string, c: Cierre): Promise<{ session: Sesion; sets: Serie[] }> =>
  unwrap(await apiPost(`/workout/sessions/${sessionId}/finish`, c))

export const descartarSesion = async (sessionId: string): Promise<void> => {
  await apiPost(`/workout/sessions/${sessionId}/discard`)
}

export const listarSesiones = async (q: { mode?: Modo; limit?: number; offset?: number } = {}) =>
  unwrap<{ total: number; offset: number; limit: number; sessions: Sesion[] }>(
    await apiGet('/workout/sessions', { params: q }),
  )

export const detalleSesion = async (id: string): Promise<{ session: Sesion; sets: Serie[] }> =>
  unwrap(await apiGet(`/workout/sessions/${id}`))

export const misRecords = async (): Promise<Marca[]> =>
  unwrap(await apiGet('/workout/records')) ?? []

/**
 * Lo que se hizo la última vez en este ejercicio.
 *
 * Es el dato que evita repetir el mismo peso durante meses sin darse cuenta,
 * así que se pide al ABRIR el ejercicio, no al terminarlo.
 */
export const historialEjercicio = async (
  key: string, limit = 12,
): Promise<{ sets: Serie[]; records: Marca[] }> =>
  unwrap(await apiGet(`/workout/exercise-history/${encodeURIComponent(key)}`, { params: { limit } }))
  ?? { sets: [], records: [] }
