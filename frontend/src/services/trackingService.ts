/**
 * SEGUIMIENTO DEL USUARIO · CAPA DE DATOS
 * ───────────────────────────────────────
 * Única puerta de la app a `/tracking`: peso y medidas, hábitos, actividad
 * diaria, ciclado de macros, plan de comidas y metas. Las siete tablas de la
 * migración 012, que hasta ahora vivían solo en el AsyncStorage del teléfono —
 * unas mil líneas de estado que se perdían al cambiar de móvil y que el
 * servidor no podía leer.
 *
 * ── Un solo archivo para cinco dominios ─────────────────────────────────────
 * Porque son envoltorios tipados sobre `api`, y partirlos en cinco obligaría a
 * los stores a acordarse de cinco rutas de importación para pedir cosas que
 * siempre viajan juntas: la pantalla de progreso lee peso y rachas a la vez, y
 * la de metas lee metas y peso.
 *
 * ── Las llaves de idempotencia las pone la app ──────────────────────────────
 * Igual que en nutrición: el `clientId` de una medición o de una meta es el id
 * que la pantalla ya generó. Si la red se cae después de guardar pero antes de
 * responder, el reintento devuelve la fila que ya existe en vez de crear otra.
 */

import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/services/api'

const unwrap = <T>(res: { data?: { data?: T } }): T => res.data?.data as T

// ═══ Peso y medidas ═════════════════════════════════════════════════════════

export type OrigenMedicion = 'manual' | 'scale' | 'ai' | 'import'

/**
 * El vocabulario es el de `BodyMeasurement` porque era el más completo de los
 * dos stores que se fusionan. `progressStore` traduce cuatro campos; el otro,
 * ninguno.
 */
export interface Medicion {
  id: string
  clientId: string
  date: string
  weight?: number
  bodyFatPct?: number
  muscleMassPct?: number
  neck?: number
  shoulders?: number
  chest?: number
  waist?: number
  hips?: number
  leftArm?: number
  rightArm?: number
  leftThigh?: number
  rightThigh?: number
  note?: string
  source: OrigenMedicion
  createdAt: string
}

export type NuevaMedicion =
  Omit<Partial<Medicion>, 'id' | 'createdAt' | 'source'> &
  { clientId: string; date: string; source?: OrigenMedicion }

export async function leerMediciones(desde?: string, hasta?: string, limit = 200): Promise<Medicion[]> {
  const q = new URLSearchParams({ limit: String(limit) })
  if (desde) q.set('desde', desde)
  if (hasta) q.set('hasta', hasta)
  const r = unwrap<{ entries: Medicion[] }>(
    await apiGet<{ data: { entries: Medicion[] } }>(`/tracking/body?${q}`),
  )
  return r?.entries ?? []
}

/**
 * La última medición y el último peso, que no tienen por qué ser la misma fila:
 * alguien pudo medirse la cintura ayer sin subirse a la báscula.
 */
export async function leerUltimaMedicion(): Promise<{ latest: Medicion | null; latestWeight: Medicion | null }> {
  return unwrap(await apiGet<{ data: { latest: Medicion | null; latestWeight: Medicion | null } }>('/tracking/body/latest'))
}

export async function guardarMedicion(m: NuevaMedicion): Promise<Medicion> {
  return unwrap(await apiPost<{ data: Medicion }>('/tracking/body', m))
}

export async function guardarMediciones(entries: NuevaMedicion[]): Promise<number> {
  const r = unwrap<{ count: number }>(
    await apiPost<{ data: { count: number } }>('/tracking/body/batch', { entries }),
  )
  return r?.count ?? 0
}

export async function actualizarMedicion(id: string, cambios: Partial<NuevaMedicion>): Promise<Medicion> {
  return unwrap(await apiPatch<{ data: Medicion }>(`/tracking/body/${id}`, cambios))
}

export async function borrarMedicion(id: string): Promise<void> {
  await apiDelete(`/tracking/body/${id}`)
}

// ═══ Hábitos ════════════════════════════════════════════════════════════════

export type Momento = 'manana' | 'tarde' | 'noche'
/** `evitar` es el hábito al revés: cumplir significa NO haberlo hecho. */
export type TipoHabito = 'hacer' | 'evitar'

export interface HabitoServidor {
  id: string          // la llave; el store la llama `id`
  habitKey: string
  label: string
  icon: string
  esDefault: boolean
  activo: boolean
  orden: number
  momento: Momento
  hora: string | null          // «07:00», o null si no tiene hora fijada
  tipo: TipoHabito
  metaSegundos: number | null  // null = este hábito no lleva cronómetro
}

/** fecha → hábito → cumplido. La misma forma que ya guarda `habitsStore`. */
export type RegistrosHabitos = Record<string, Record<string, boolean>>
/** fecha → hábito → segundos cronometrados. Solo los días que se cronometró. */
export type SegundosHabitos = Record<string, Record<string, number>>

export async function leerHabitos(desde?: string, hasta?: string): Promise<{
  habits: HabitoServidor[]; logs: RegistrosHabitos; segundos: SegundosHabitos
}> {
  const q = new URLSearchParams()
  if (desde) q.set('desde', desde)
  if (hasta) q.set('hasta', hasta)
  return unwrap(await apiGet<{ data: {
    habits: HabitoServidor[]; logs: RegistrosHabitos; segundos: SegundosHabitos
  } }>(`/tracking/habits?${q}`))
}

export interface NuevoHabito {
  orden?: number
  momento?: Momento
  hora?: string | null
  tipo?: TipoHabito
  metaSegundos?: number | null
}

export async function crearHabito(
  habitKey: string, label: string, icon: string, extra: NuevoHabito = {},
): Promise<HabitoServidor> {
  return unwrap(await apiPost<{ data: HabitoServidor }>('/tracking/habits', {
    habitKey, label, icon, ...extra,
  }))
}

export async function actualizarHabito(
  habitKey: string,
  cambios: {
    label?: string; icon?: string; activo?: boolean; orden?: number
    momento?: Momento; hora?: string | null; tipo?: TipoHabito; metaSegundos?: number | null
  },
): Promise<HabitoServidor> {
  return unwrap(await apiPatch<{ data: HabitoServidor }>(`/tracking/habits/${habitKey}`, cambios))
}

/** Desactiva; no borra. El histórico de cumplimiento seguiría ahí sin nombre. */
export async function borrarHabito(habitKey: string): Promise<void> {
  await apiDelete(`/tracking/habits/${habitKey}`)
}

export async function marcarHabito(
  habitKey: string, fecha: string, hecho: boolean, segundos?: number,
): Promise<void> {
  await apiPut(`/tracking/habits/${habitKey}/log/${fecha}`, {
    hecho, ...(segundos !== undefined ? { segundos } : {}),
  })
}

export async function guardarRegistrosHabitos(
  logs: Array<{ habitKey: string; date: string; hecho: boolean; segundos?: number }>,
): Promise<{ count: number; descartados: number }> {
  return unwrap(await apiPost<{ data: { count: number; descartados: number } }>('/tracking/habits/logs/batch', { logs }))
}

// ═══ Actividad diaria y rachas ══════════════════════════════════════════════

export interface DiaServidor {
  date: string
  loggedFood: boolean
  loggedWorkout: boolean
  checkInDone: boolean
  drankWater: boolean
  protegido: boolean
}

export interface RachasServidor {
  current: number
  longest: number
  totalActive: number
  lastActiveDate: string | null
}

export type MarcasDia = Partial<Omit<DiaServidor, 'date'>>

/**
 * `hoy` va siempre desde la app. El servidor corre en UTC y a media tarde ya
 * cree que es mañana: sin este dato rompería la racha de quien todavía no ha
 * cenado.
 */
export async function leerActividad(
  desde: string, hasta: string, hoy: string,
): Promise<{ days: DiaServidor[]; streak: RachasServidor }> {
  const q = new URLSearchParams({ desde, hasta, hoy })
  return unwrap(await apiGet<{ data: { days: DiaServidor[]; streak: RachasServidor } }>(`/tracking/activity?${q}`))
}

export async function marcarActividad(fecha: string, marcas: MarcasDia): Promise<DiaServidor> {
  return unwrap(await apiPut<{ data: DiaServidor }>(`/tracking/activity/${fecha}`, marcas))
}

export async function guardarActividad(days: Array<{ date: string } & MarcasDia>): Promise<number> {
  const r = unwrap<{ count: number }>(
    await apiPost<{ data: { count: number } }>('/tracking/activity/batch', { days }),
  )
  return r?.count ?? 0
}

// ═══ Ciclado de macros ══════════════════════════════════════════════════════

export type TipoDia = 'high' | 'moderate' | 'low' | 'rest'

export interface CicloServidor {
  cycle: TipoDia[]
  preset: string | null
  activo: boolean
  updatedAt: string
}

/** Los targets del plan de dieta activo. `null` si todavía no hay ninguno. */
export interface BasesMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export async function leerCiclo(): Promise<{ cycle: CicloServidor | null; base: BasesMacros | null }> {
  return unwrap(await apiGet<{ data: { cycle: CicloServidor | null; base: BasesMacros | null } }>('/tracking/macro-cycle'))
}

export async function guardarCiclo(
  cycle: TipoDia[], preset: string | null, activo: boolean,
): Promise<CicloServidor> {
  return unwrap(await apiPut<{ data: CicloServidor }>('/tracking/macro-cycle', { cycle, preset, activo }))
}

// ═══ Plan de comidas ════════════════════════════════════════════════════════

export async function leerPlanSemana<T>(semana: string): Promise<{ week: string; plan: T; updatedAt: string | null }> {
  return unwrap(await apiGet<{ data: { week: string; plan: T; updatedAt: string | null } }>(`/tracking/meal-plan/${semana}`))
}

export async function guardarPlanSemana<T>(semana: string, plan: T): Promise<void> {
  await apiPut(`/tracking/meal-plan/${semana}`, { plan })
}

// ═══ Metas ══════════════════════════════════════════════════════════════════

export type EstadoMeta = 'activa' | 'cumplida' | 'abandonada' | 'expirada'

export interface MetaServidor {
  id: string
  clientId: string
  title: string
  type: 'weight' | 'workout_frequency' | 'streak' | 'custom'
  direction: 'increase' | 'decrease'
  startValue: number
  targetValue: number
  startDate: string
  targetDate: string
  unit: string
  estado: EstadoMeta
  cerradaEn: string | null
  createdAt: string
}

export type NuevaMeta = Omit<MetaServidor, 'id' | 'estado' | 'cerradaEn' | 'createdAt'>

export async function leerMetas(estado?: EstadoMeta): Promise<MetaServidor[]> {
  const q = estado ? `?estado=${estado}` : ''
  const r = unwrap<{ goals: MetaServidor[] }>(
    await apiGet<{ data: { goals: MetaServidor[] } }>(`/tracking/goals${q}`),
  )
  return r?.goals ?? []
}

export async function crearMeta(meta: NuevaMeta): Promise<MetaServidor> {
  return unwrap(await apiPost<{ data: MetaServidor }>('/tracking/goals', meta))
}

export async function actualizarMeta(
  id: string,
  cambios: { title?: string; targetValue?: number; targetDate?: string; estado?: EstadoMeta },
): Promise<MetaServidor> {
  return unwrap(await apiPatch<{ data: MetaServidor }>(`/tracking/goals/${id}`, cambios))
}

/** Abandona la meta. Sigue en el histórico: ZENA la quiere para saber de dónde viene el usuario. */
export async function borrarMeta(id: string): Promise<void> {
  await apiDelete(`/tracking/goals/${id}`)
}
