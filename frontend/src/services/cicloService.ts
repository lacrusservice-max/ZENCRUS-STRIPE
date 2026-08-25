/**
 * CICLO · CAPA DE DATOS
 * ═══════════════════════════════════════════════════════════════════════════
 * Única puerta de la app a `/cycle`. Las ocho tablas de la migración 018, que
 * hasta ahora vivían solo en el AsyncStorage del teléfono: reinstalar la app
 * perdía años de historial.
 *
 * ── El 404 aquí no es un error, es la respuesta ────────────────────────────
 * Para una cuenta sin el módulo, TODA esta rama responde 404 —el mismo cuerpo
 * que una ruta que no existe— porque la función tiene que ser invisible, no
 * bloqueada. Así que un 404 no se trata como fallo ni se reintenta: significa
 * «aquí no hay ciclo», y la app se queda con lo local y calla.
 *
 * ── Y un fallo de red tampoco borra nada ───────────────────────────────────
 * Es la lección de `feedback_sesion_limbo`: ante un error de red, lo local se
 * conserva. Vaciar la caché porque el servidor no contesta produce pantallas
 * en blanco que parecen pérdida de datos.
 */

import { apiGet, apiPut, apiPost, apiDelete } from '@/services/api'
import type { TrackerKind } from '@/features/salud/trackers'
import type { ModoVida } from '@/features/salud/ciclo/modos'

const unwrap = <T>(res: { data?: { data?: T } }): T => res.data?.data as T

/** `true` si el servidor dijo que esta rama no existe para esta cuenta. */
export const esSinCiclo = (e: unknown): boolean =>
  (e as { response?: { status?: number } })?.response?.status === 404

export interface PerfilCicloServidor {
  cycleEnabled: boolean
  lifeMode: ModoVida
  /* CALCULADAS a partir de su historial, y `null` mientras no lo haya. */
  avgCycleDays: number | null
  avgPeriodDays: number | null
  /* DECLARADAS por ella en el alta. Son cosas distintas: ver la migración 021. */
  declaredCycleDays: number | null
  declaredPeriodDays: number | null
  contraception: string | null
  lockBiometric: boolean
  lockTimeoutS: number
  discreetMode: boolean
  anonymousMode: boolean
}

export interface PeriodoServidor {
  inicio: string
  fin: string | null
  duracionCiclo: number | null
  declarado: boolean
}

export interface CicloServidor {
  profile: PerfilCicloServidor | null
  /** fecha → tracker → valor. La misma forma que usa `cicloStore`. */
  logs: Record<string, Record<string, unknown>>
  periods: PeriodoServidor[]
  declared: string[]
}

/** Todo lo que la pantalla necesita para el primer frame, en una sola petición. */
export async function leerCiclo(desde?: string, hasta?: string, limit = 3000): Promise<CicloServidor> {
  return unwrap(await apiGet('/cycle', { params: { desde, hasta, limit } }))
}

export async function guardarPerfil(cambios: Partial<{
  lifeMode: ModoVida
  declaredCycleDays: number
  declaredPeriodDays: number
  contraception: string | null
  lockBiometric: boolean
  lockTimeoutS: number
  discreetMode: boolean
  anonymousMode: boolean
}>): Promise<PerfilCicloServidor> {
  return unwrap(await apiPut('/cycle/profile', cambios))
}

export interface CambioCiclo {
  fecha: string
  kind: TrackerKind
  /** `null` = ese registro se borró. Viaja por el mismo canal a propósito. */
  value: unknown | null
}

/**
 * El lote: la cola de sincronización entera en una petición.
 *
 * El servidor descarta los cambios que ya no validan y lo dice en la respuesta
 * en vez de rechazar el lote. Si un registro guardado por una versión vieja
 * dejara de pasar el esquema, un lote todo-o-nada se atascaría reintentándolo
 * para siempre y con él todo lo que hubiera detrás.
 */
export async function sincronizarLote(
  cambios: CambioCiclo[],
): Promise<{ escritos: number; borrados: number; descartados: number }> {
  return unwrap(await apiPost('/cycle/logs/batch', { cambios }))
}

export async function guardarRegistro(
  fecha: string, kind: TrackerKind, value: unknown, source = 'manual',
): Promise<void> {
  await apiPut(`/cycle/logs/${fecha}/${kind}`, { value, source })
}

export async function borrarRegistro(fecha: string, kind: TrackerKind): Promise<void> {
  await apiDelete(`/cycle/logs/${fecha}/${kind}`)
}

export async function declararInicio(fecha: string): Promise<void> {
  await apiPost('/cycle/periods', { fecha })
}

export async function quitarInicio(fecha: string): Promise<void> {
  await apiDelete(`/cycle/periods/${fecha}`)
}

/**
 * Guarda la predicción que calculó el móvil.
 *
 * El motor vive en el cliente porque la predicción tiene que existir sin red.
 * Lo que sube es el resultado —con su banda y su confianza— para que ZENA y el
 * informe clínico puedan leerlo sin recalcular.
 */
export async function guardarPrediccion(p: {
  modelVersion: string
  nextPeriodLow: string
  nextPeriodLikely: string
  nextPeriodHigh: string
  ovulationLow?: string | null
  ovulationLikely?: string | null
  ovulationHigh?: string | null
  fertileStart?: string | null
  fertileEnd?: string | null
  confidence: number
  sampleCycles: number
  suppressedReason?: string | null
}): Promise<void> {
  await apiPut('/cycle/prediction', p)
}

/** El borrado de verdad: aquí y en el servidor. */
export async function borrarTodoElCiclo(): Promise<void> {
  await apiDelete('/cycle')
}
