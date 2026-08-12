/**
 * ENTRENAMIENTOS GENERADOS · CAPA DE DATOS
 * ────────────────────────────────────────
 * Pide al servidor una sesión hecha a medida del catálogo.
 *
 * ── No se cachea, y es a propósito ──────────────────────────────────────────
 * El servidor ya garantiza que el mismo día y los mismos parámetros dan el
 * mismo entrenamiento —el azar va sembrado con la fecha—, así que un caché aquí
 * no ahorraría variación, solo escondería el cambio de día: quien deje la app
 * abierta desde anoche vería el entrenamiento de ayer.
 *
 * Los pósters llegan firmados y caducan en una hora, que es el otro motivo por
 * el que esto no se guarda en disco.
 */

import { apiGet } from '@/services/api'

const unwrap = <T>(res: { data?: { data?: T } }): T => res.data?.data as T

export type Lugar = 'home' | 'gym' | 'todo'
export type Nivel = 'beginner' | 'intermediate' | 'advanced'
export type Estilo = 'fuerza' | 'circuito'

export interface EjercicioGenerado {
  slug: string
  nombre: string
  muscle: string | null
  muscleEs: string | null
  equipment: string
  equipmentEs: string
  pattern: string | null
  poster: string | null
  series: number
  reps: string
  descanso: number
  segundos: number
}

export interface Generado {
  region: string
  minutos: number
  lugar: Lugar
  nivel: Nivel
  estilo: Estilo
  titulo: string
  minutosReales: number
  series: number
  musculos: string[]
  ejercicios: EjercicioGenerado[]
}

export interface Opciones {
  duraciones: number[]
  regiones: { region: string; ejercicios: number; enCasa: number }[]
}

export const getOpciones = async (): Promise<Opciones> =>
  unwrap(await apiGet('/exercises/quick/options'))

export const getEntrenamiento = async (
  region: string, minutos: number, lugar: Lugar = 'todo', nivel: Nivel = 'intermediate',
): Promise<Generado> =>
  unwrap(await apiGet('/exercises/quick', {
    params: { region, minutes: minutos, place: lugar, level: nivel },
  }))

/**
 * La receta de un entrenamiento, en una cadena que cabe en una URL.
 *
 * Es lo que permite abrir la pantalla de entrenar con `?quick=upper-15-home` y
 * que ESA pantalla vuelva a pedir exactamente el mismo entrenamiento, sin
 * arrastrar seis ejercicios por la barra de direcciones ni meter un estado
 * global para pasar una lista de una pantalla a la de al lado. Funciona porque
 * el servidor es determinista: la receta basta para reconstruirlo.
 */
export const recetaDe = (region: string, minutos: number, lugar: Lugar): string =>
  `${region}-${minutos}-${lugar}`

export function leerReceta(receta: string): { region: string; minutos: number; lugar: Lugar } | null {
  const p = receta.split('-')
  if (p.length !== 3) return null
  const minutos = Number(p[1])
  if (!Number.isFinite(minutos)) return null
  return { region: p[0], minutos, lugar: p[2] as Lugar }
}

/** «13 min · 12 series» — lo que se enseña bajo el título. */
export const resumenDe = (g: Generado): string =>
  `${g.minutosReales} min · ${g.ejercicios.length} ejercicios · ${g.series} series`
