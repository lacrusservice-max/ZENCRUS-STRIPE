/**
 * REGISTRO DE NUTRICIÓN · CAPA DE DATOS
 * ─────────────────────────────────────
 * Única puerta de la app a `/nutrition`. Hasta ahora lo que la gente comía
 * vivía solo en el AsyncStorage del teléfono: se perdía al cambiar de móvil y
 * el servidor no podía leerlo, así que ZENA no sabía nada de la alimentación
 * de nadie.
 *
 * ── El `clientId` es el `id` que ya generaba la app ─────────────────────────
 * Cada `FoodEntry` nace con su id en la pantalla que la crea. Ese mismo id
 * viaja como `clientId` y el servidor lo usa para no duplicar: si la red se
 * cae después de guardar pero antes de responder, el reintento devuelve la
 * entrada que ya existe en vez de crear otra.
 *
 * ── La fecha la manda el cliente ────────────────────────────────────────────
 * El servidor corre en UTC. Si calculara el día él, la cena de las 23:50 se
 * apuntaría al día siguiente. Se manda siempre `logDate` y, en las peticiones
 * con cuota, la cabecera `X-Zona-Fecha` para que el contador diario también
 * corte a medianoche del usuario.
 */

import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/services/api'

const unwrap = <T>(res: { data?: { data?: T } }): T => res.data?.data as T

// ── Formas ───────────────────────────────────────────────────────────────────

export type MealSlotId = 'breakfast' | 'lunch' | 'dinner' | 'snack1' | 'snack2' | 'snack3'
export type OrigenEntrada = 'manual' | 'search' | 'barcode' | 'photo' | 'ai' | 'plan'

export interface EntradaServidor {
  id: string
  clientId: string
  mealSlot: MealSlotId
  foodId: string | null
  name: string
  emoji?: string
  amount: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  active: boolean
  source: OrigenEntrada
  consumedAt: string | null
  createdAt: string
}

export interface Totales {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface DiaNutricion {
  date: string
  entries: EntradaServidor[]
  totals: Totales
  waterGlasses: number
  streak: number
}

export interface DiaResumen extends Totales {
  date: string
  entries: number
}

/** Lo que la app manda para registrar un alimento. */
export interface NuevaEntrada {
  clientId: string
  mealSlot: MealSlotId
  name: string
  emoji?: string
  foodId?: string
  amount: number
  unit?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  active?: boolean
  source?: OrigenEntrada
  consumedAt?: string
}

/** Cabecera con la fecha local, para que la cuota diaria corte donde debe. */
const conFecha = (fecha: string) => ({ headers: { 'X-Zona-Fecha': fecha } })

// ── Lectura ──────────────────────────────────────────────────────────────────

export async function leerDia(fecha: string): Promise<DiaNutricion> {
  return unwrap(await apiGet<{ data: DiaNutricion }>(`/nutrition/day/${fecha}`))
}

/** Totales por día para la pantalla de progreso y los resúmenes de ZENA. */
export async function leerRango(desde: string, hasta: string): Promise<DiaResumen[]> {
  const r = unwrap<{ days: DiaResumen[] }>(
    await apiGet<{ data: { days: DiaResumen[] } }>(`/nutrition/range?desde=${desde}&hasta=${hasta}`),
  )
  return r?.days ?? []
}

// ── Escritura ────────────────────────────────────────────────────────────────

export async function registrar(fecha: string, entrada: NuevaEntrada): Promise<EntradaServidor> {
  return unwrap(
    await apiPost<{ data: EntradaServidor }>('/nutrition/entries', { logDate: fecha, ...entrada }, conFecha(fecha)),
  )
}

/**
 * Alta en lote. La usa «Confirmar alimentos» y la usará el reconocimiento por
 * foto: una petición por alimento convertiría un registro en una tanda de
 * reintentos sueltos, y en mala cobertura eso es medio registro perdido.
 */
export async function registrarLote(fecha: string, entradas: NuevaEntrada[]): Promise<EntradaServidor[]> {
  const r = unwrap<{ entries: EntradaServidor[] }>(
    await apiPost<{ data: { entries: EntradaServidor[] } }>(
      '/nutrition/entries/batch', { logDate: fecha, entries: entradas }, conFecha(fecha),
    ),
  )
  return r?.entries ?? []
}

export async function actualizar(
  id: string,
  cambios: Partial<Pick<EntradaServidor, 'amount' | 'mealSlot' | 'active' | 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber'>>,
): Promise<EntradaServidor> {
  return unwrap(await apiPatch<{ data: EntradaServidor }>(`/nutrition/entries/${id}`, cambios))
}

/** Borrado suave: recuperable durante 30 días con `restaurar`. */
export async function eliminar(id: string): Promise<void> {
  await apiDelete(`/nutrition/entries/${id}`)
}

export async function restaurar(id: string): Promise<EntradaServidor> {
  return unwrap(await apiPost<{ data: EntradaServidor }>(`/nutrition/entries/${id}/restore`))
}

export async function guardarDia(
  fecha: string,
  datos: { waterGlasses?: number; streak?: number },
): Promise<{ date: string; waterGlasses: number; streak: number }> {
  return unwrap(
    await apiPut<{ data: { date: string; waterGlasses: number; streak: number } }>(
      `/nutrition/day/${fecha}`, datos,
    ),
  )
}
