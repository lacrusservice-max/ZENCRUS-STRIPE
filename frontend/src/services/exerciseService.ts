/**
 * BIBLIOTECA DE EJERCICIOS · CAPA DE DATOS
 * ────────────────────────────────────────
 * Única puerta de la app a `/exercises`. Los 206 ejercicios con su vídeo, su
 * póster y sus filtros.
 *
 * ── Las direcciones caducan en una hora ─────────────────────────────────────
 * Vídeos y pósters viven en un bucket privado y llegan firmados. No se guardan
 * en disco ni se cachean entre sesiones: un póster rescatado del disco al día
 * siguiente sería una imagen rota.
 *
 * Lo que SÍ se cachea en memoria es el listado, porque el catálogo no cambia
 * mientras la app está abierta y volver a pedir 206 fichas cada vez que alguien
 * entra en la biblioteca es tirar el ancho de banda de su móvil.
 */

import { apiGet } from '@/services/api'

// ── Formas ───────────────────────────────────────────────────────────────────

export interface ExerciseCard {
  slug: string
  name: string
  muscle: string | null
  muscleEs: string | null
  equipment: string
  equipmentEs: string
  pattern: string | null
  /** Se puede hacer sin gimnasio. */
  home: boolean
  poster: string | null
}

/** Cómo se hace, en cuatro frases. Lo compone el servidor al leer la ficha. */
export interface ComoSeHace {
  colocate: string
  mueve: string
  hastaDonde: string
  ojoCon: string
}

export interface ExerciseDetail extends ExerciseCard {
  video: string | null
  comoSeHace: ComoSeHace
  alternatives: {
    slug: string
    name: string
    equipmentEs: string
    home: boolean
    poster: string | null
  }[]
}

export interface Facet {
  id: string
  label: string
  count: number
}

export interface Filters {
  total: number
  home: number
  muscles: Facet[]
  equipment: Facet[]
  patterns: Facet[]
}

export interface ExercisePage {
  total: number
  offset: number
  limit: number
  exercises: ExerciseCard[]
}

export interface Query {
  q?: string
  muscle?: string
  equipment?: string
  pattern?: string
  place?: 'home' | 'gym'
  limit?: number
  offset?: number
}

const unwrap = <T>(res: { data?: { data?: T } }): T => (res.data?.data as T)

// ── Consultas ────────────────────────────────────────────────────────────────

/**
 * El servidor corta en 100 por página. La app pide de 40 en 40: llena una
 * pantalla larga sin traerse media biblioteca para enseñar seis fichas.
 */
export const PAGINA = 40

export const listExercises = async (q: Query = {}): Promise<ExercisePage> =>
  unwrap(await apiGet('/exercises', {
    params: {
      q: q.q?.trim() || undefined,
      muscle: q.muscle || undefined,
      equipment: q.equipment || undefined,
      pattern: q.pattern || undefined,
      place: q.place || undefined,
      limit: q.limit ?? PAGINA,
      offset: q.offset ?? 0,
    },
  })) ?? { total: 0, offset: 0, limit: PAGINA, exercises: [] }

export const getExercise = async (slug: string): Promise<ExerciseDetail> =>
  unwrap(await apiGet(`/exercises/${slug}`))

/**
 * Los filtros se piden UNA vez por sesión y se guardan aquí.
 *
 * Son las facetas del catálogo —qué grupos existen y cuántos hay de cada uno—,
 * y no cambian hasta que se suban vídeos nuevos. Volver a pedirlas cada vez que
 * se abre la biblioteca es una petición que siempre devuelve lo mismo.
 */
let cacheFiltros: Filters | null = null

export async function getFilters(): Promise<Filters> {
  if (cacheFiltros) return cacheFiltros
  cacheFiltros = unwrap<Filters>(await apiGet('/exercises/filters'))
  return cacheFiltros
}

/** Lo llama el cierre de sesión: la siguiente persona pide lo suyo. */
export function resetExerciseCache(): void {
  cacheFiltros = null
}

/**
 * Solo las imágenes de unos slugs concretos.
 *
 * Para quien ya sabe qué ejercicios enseña y solo le falta la foto: una rutina
 * guardada en el teléfono (que almacena el slug, no el póster) o una sesión
 * recuperada del servidor a mitad de entrenamiento.
 *
 * Devuelve un objeto y no una lista para que el que llama no tenga que casar
 * posiciones: si un slug no está en el catálogo, sencillamente no viene su
 * clave y quien lo pinta enseña el hueco con su icono.
 *
 * NO se cachea entre pantallas: las direcciones caducan en una hora y una URL
 * rescatada al día siguiente sería una imagen rota.
 */
export const getPosters = async (slugs: string[]): Promise<Record<string, string>> => {
  const limpios = [...new Set(slugs.filter(Boolean))].slice(0, 60)
  if (limpios.length === 0) return {}
  try {
    const r = unwrap<{ posters: Record<string, string> }>(
      await apiGet('/exercises/posters', { params: { slugs: limpios.join(',') } }),
    )
    return r?.posters ?? {}
  } catch (e) {
    // Una miniatura que falta no puede tumbar la pantalla que la enseña, pero
    // callarse del todo tampoco vale: un fallo aquí se ve como una rejilla de
    // huecos grises, que es indistinguible de «este ejercicio no tiene foto».
    // Sin este aviso costó encontrar por qué las rutinas salían sin imágenes.
    console.warn('[exercises/posters]', (e as Error)?.message ?? e)
    return {}
  }
}

// ── Presentación ─────────────────────────────────────────────────────────────

/**
 * Color de cada grupo muscular.
 *
 * Fijos y no derivados del nombre: el mismo músculo tiene que verse igual en la
 * rejilla, en el filtro y en el mapa corporal. Si se generaran, cambiarían al
 * añadir un grupo nuevo y nada cuadraría con nada.
 */
export const COLOR_GRUPO: Record<string, string> = {
  chest:      '#FF1F3D',
  back:       '#FF6B2C',
  shoulders:  '#FFB020',
  biceps:     '#22E0C8',
  triceps:    '#12A491',
  forearms:   '#0E7C8F',
  quads:      '#7C5CFF',
  hamstrings: '#A78BFA',
  glutes:     '#FF2D78',
  calves:     '#5B8DEF',
  core:       '#F5B31F',
  fullbody:   '#E5E7EB',
}

export const colorDe = (muscle: string | null) => COLOR_GRUPO[muscle ?? ''] ?? '#8B8D96'

/** Icono de Ionicons por material, para las fichas y los filtros. */
export const ICONO_MATERIAL: Record<string, string> = {
  barbell:    'barbell-outline',
  dumbbell:   'barbell',
  kettlebell: 'fitness-outline',
  cable:      'git-network-outline',
  machine:    'cog-outline',
  band:       'infinite-outline',
  bodyweight: 'body-outline',
  plate:      'disc-outline',
  landmine:   'triangle-outline',
}

export const iconoDe = (equipment: string) => ICONO_MATERIAL[equipment] ?? 'ellipse-outline'
