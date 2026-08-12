/**
 * ESTADÍSTICAS DE ENTRENAMIENTO · CAPA DE DATOS
 * ─────────────────────────────────────────────
 * Única puerta de la app a `/workout/stats`. Las cuentas las hace el servidor;
 * aquí solo se piden y se nombran.
 */

import { apiGet } from '@/services/api'
import type { Modo, Sesion } from '@/services/sessionService'

const unwrap = <T>(res: { data?: { data?: T } }): T => res.data?.data as T

// ── Formas ───────────────────────────────────────────────────────────────────

export interface Resumen {
  ventanaDias: number
  sesiones: number
  sesionesSemana: number
  seriesSemana: number
  volumenSemana: number
  minutosSemana: number
  racha: number
  porModo: { mode: Modo; sesiones: number }[]
  ultima: Sesion | null
  /** Totales de siempre, sin ventana. Los pide el perfil. */
  historico: { sesiones: number; minutos: number; volumen: number }
  /** Lo decide el servidor: el día de la app y el de la base no son el mismo. */
  entrenadoHoy: boolean
  hoy: Sesion | null
}

export interface CargaGrupo {
  grupo: string
  series: number
  volumen: number
  ultimaVez: string | null
  horasDesde: number | null
  /** 0 = recién entrenado · 1 = recuperado · null = nunca. */
  recuperacion: number | null
  cuota: number
}

export interface Musculos {
  ventanaDias: number
  totalSeries: number
  grupos: CargaGrupo[]
}

export interface Dia {
  /** YYYY-MM-DD en el huso del móvil, no en UTC. */
  fecha: string
  sesiones: number
  series: number
  volumen: number
  minutos: number
}

export interface Semana {
  lunes: string
  volumen: number
  series: number
  sesiones: number
  minutos: number
}

export interface PuntoCurva {
  dia: string
  est1RM: number
  weightKg: number | null
  reps: number | null
}

export interface Curva {
  exerciseKey: string
  exerciseName: string
  totalSeries: number
  volumenTotal: number
  puntos: PuntoCurva[]
}

export interface EjercicioHecho {
  exerciseKey: string
  exerciseName: string
  muscle: string | null
  series: number
  volumen: number
  ultimaVez: string
  mejor1RM: number
  /** Póster firmado del catálogo. Null si el ejercicio se escribió a mano. */
  poster: string | null
}

// ── Llamadas ─────────────────────────────────────────────────────────────────

export const getResumen = async (days = 28): Promise<Resumen> =>
  unwrap(await apiGet('/workout/stats/summary', { params: { days } }))

export const getMusculos = async (days = 7): Promise<Musculos> =>
  unwrap(await apiGet('/workout/stats/muscles', { params: { days } }))

export const getVolumen = async (days = 84): Promise<{ semanas: Semana[] }> =>
  unwrap(await apiGet('/workout/stats/volume', { params: { days } }))

/**
 * Día a día, para la tira de la semana.
 *
 * Va el desplazamiento horario del móvil porque la base guarda UTC: sin él,
 * entrenar a las once de la noche se marcaría en el día siguiente.
 */
export const getDias = async (days = 7): Promise<{ dias: Dia[] }> =>
  unwrap(await apiGet('/workout/stats/days', {
    params: { days, tzOffset: new Date().getTimezoneOffset() },
  }))

export const getEjercicios = async (days = 90): Promise<{ ejercicios: EjercicioHecho[] }> =>
  unwrap(await apiGet('/workout/stats/exercises', { params: { days } }))

export const getCurva = async (key: string, days = 180): Promise<Curva> =>
  unwrap(await apiGet(`/workout/stats/curve/${encodeURIComponent(key)}`, { params: { days } }))

// ── Presentación ─────────────────────────────────────────────────────────────

/**
 * Kilos en corto.
 *
 * A partir de mil se pasa a toneladas: «12.400 kg» son seis caracteres que
 * nadie compara de un vistazo, y «12,4 t» sí. Por debajo se deja en kilos
 * porque «0,8 t» no significa nada para quien acaba de mover 800.
 */
export const kilosCorto = (kg: number): string =>
  kg >= 1000
    ? `${(Math.round(kg / 100) / 10).toString().replace('.', ',')} t`
    : `${Math.round(kg)} kg`

/** «2 h 05» / «45 min». */
export const minutosCorto = (min: number): string =>
  min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`

/** Días desde una fecha, como se dicen en voz alta. */
export const desdeCuando = (iso: string | null): string => {
  if (!iso) return 'nunca'
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000
  if (h < 1) return 'hace un momento'
  if (h < 24) return `hace ${Math.round(h)} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} días`
  if (d < 14) return 'hace una semana'
  if (d < 60) return `hace ${Math.floor(d / 7)} semanas`
  return `hace ${Math.floor(d / 30)} meses`
}
