/**
 * BIBLIOTECA DE EJERCICIOS
 * ────────────────────────
 * Los 206 ejercicios del catálogo, con su vídeo y su póster.
 *
 * ── El catálogo vive en memoria ─────────────────────────────────────────────
 * Son 206 fichas y 77 KB: cabe entero en la memoria del proceso y se carga una
 * vez al arrancar. Meterlo en Postgres sería pagar un viaje a la base por cada
 * filtro para consultar algo que no cambia entre despliegues.
 *
 * Está dentro de `src/` a propósito: con `resolveJsonModule`, TypeScript lo
 * copia a `dist/` al compilar. Un JSON fuera de `src/` no llegaría a Railway.
 *
 * ── Los archivos siguen siendo privados ─────────────────────────────────────
 * El bucket no cambia de reglas por ser catálogo: cada respuesta firma sus URL
 * en el momento y caducan en una hora. Lo único distinto es que aquí no hay
 * nada que comprobar sobre quién pregunta —el catálogo es igual para todos—,
 * así que no pasa por `socialAccess`: pasa por `authenticate` y ya está.
 *
 * ── Por qué la lista no firma los vídeos ────────────────────────────────────
 * Una lista de 30 ejercicios necesita 30 pósters, no 30 vídeos: nadie reproduce
 * treinta a la vez. El vídeo se firma solo al abrir la ficha. Firmar es barato
 * —criptografía local, sin red— pero 206 firmas por petición para tirarlas
 * todas menos una es trabajo regalado.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { readUrls, readUrl, mediaReady } from '../services/media'
import catalogo from '../data/exercises.json'
import { generar, DURACIONES, REGIONES } from '../services/generador'

// ── Forma de una ficha ───────────────────────────────────────────────────────

interface Ficha {
  slug: string
  nombre: string
  equipment: string
  equipmentEs: string
  muscle: string | null
  muscleEs: string | null
  pattern: string | null
  home: boolean
  gym: boolean
  video: string
  poster: string
}

const TODOS = catalogo.ejercicios as Ficha[]

/** Índice por slug: buscar una ficha es un acceso, no un recorrido de 206. */
const POR_SLUG = new Map(TODOS.map(e => [e.slug, e]))

const clavePoster = (e: Ficha) => `library/poster/${e.poster}`
const claveVideo = (e: Ficha) => `library/video/${e.video}`

const fail = (res: Response, code: number, message: string) => {
  res.status(code).json({ success: false, message } satisfies ApiResponse)
}

// ── Esquema ──────────────────────────────────────────────────────────────────

export const listSchema = z.object({
  query: z.object({
    q: z.string().max(60).optional(),
    muscle: z.string().max(24).optional(),
    equipment: z.string().max(24).optional(),
    pattern: z.string().max(24).optional(),
    /** `home` deja solo lo que se puede hacer sin gimnasio. */
    place: z.enum(['home', 'gym']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
})

// ── Búsqueda ─────────────────────────────────────────────────────────────────

/**
 * Normaliza para comparar: sin acentos y en minúsculas.
 *
 * Quien busca «biceps» en un teclado con prisa tiene que encontrar «bíceps», y
 * quien busca «Press» tiene que encontrar «press». Sin esto, la búsqueda falla
 * justo en las palabras que más se buscan.
 */
const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Se indexa una vez al arrancar, no en cada búsqueda. */
const INDICE = new Map(
  TODOS.map(e => [e.slug, normalizar(`${e.nombre} ${e.slug} ${e.muscleEs ?? ''} ${e.equipmentEs ?? ''}`)]),
)

// ── Listado ──────────────────────────────────────────────────────────────────

/** GET /exercises?q=&muscle=&equipment=&pattern=&place=&limit=&offset= */
export async function listExercises(req: Request, res: Response): Promise<void> {
  const { q, muscle, equipment, pattern, place } = req.query as z.infer<typeof listSchema>['query']
  const limit = Number(req.query.limit ?? 40)
  const offset = Number(req.query.offset ?? 0)

  let lista = TODOS
  if (muscle) lista = lista.filter(e => e.muscle === muscle)
  if (equipment) lista = lista.filter(e => e.equipment === equipment)
  if (pattern) lista = lista.filter(e => e.pattern === pattern)
  // «gym» no filtra nada: todo lo del catálogo se puede hacer en un gimnasio.
  // Lo que sí acota es «home», que deja fuera lo que necesita máquina o barra fija.
  if (place === 'home') lista = lista.filter(e => e.home)

  if (q && q.trim().length >= 2) {
    const t = normalizar(q.trim())
    lista = lista.filter(e => (INDICE.get(e.slug) ?? '').includes(t))
  }

  const total = lista.length
  const pagina = lista.slice(offset, offset + limit)

  // Los pósters de esta página, firmados de una tacada.
  const firmadas = mediaReady()
    ? await readUrls(pagina.map(clavePoster))
    : new Map<string, string>()

  res.json({
    success: true,
    data: {
      total,
      offset,
      limit,
      exercises: pagina.map(e => ({
        slug: e.slug,
        name: e.nombre,
        muscle: e.muscle,
        muscleEs: e.muscleEs,
        equipment: e.equipment,
        equipmentEs: e.equipmentEs,
        pattern: e.pattern,
        home: e.home,
        poster: firmadas.get(clavePoster(e)) ?? null,
      })),
    },
  } satisfies ApiResponse)
}

// ── Una ficha ────────────────────────────────────────────────────────────────

/** GET /exercises/:slug */
export async function getExercise(req: Request, res: Response): Promise<void> {
  const e = POR_SLUG.get(req.params.slug)
  if (!e) return fail(res, 404, 'Ese ejercicio no existe')

  let video: string | null = null
  let poster: string | null = null
  if (mediaReady()) {
    try {
      [video, poster] = await Promise.all([readUrl(claveVideo(e)), readUrl(clavePoster(e))])
    } catch (err) {
      logger.error(`biblioteca · firmando ${e.slug}: ${(err as Error).message}`)
    }
  }

  /**
   * Alternativas: mismo PATRÓN de movimiento, no mismo músculo.
   *
   * Si la máquina está ocupada hace falta otro empuje horizontal, no cualquier
   * ejercicio de pecho: un cruce de poleas no sustituye a un press. Se prefiere
   * lo que se pueda hacer en casa, que es donde más falta hace un sustituto.
   */
  const alternativas = TODOS
    .filter(o => o.slug !== e.slug && o.pattern && o.pattern === e.pattern && o.muscle === e.muscle)
    .sort((a, b) => Number(b.home) - Number(a.home))
    .slice(0, 6)

  const posters = mediaReady()
    ? await readUrls(alternativas.map(clavePoster))
    : new Map<string, string>()

  res.json({
    success: true,
    data: {
      slug: e.slug,
      name: e.nombre,
      muscle: e.muscle,
      muscleEs: e.muscleEs,
      equipment: e.equipment,
      equipmentEs: e.equipmentEs,
      pattern: e.pattern,
      home: e.home,
      video,
      poster,
      alternatives: alternativas.map(a => ({
        slug: a.slug,
        name: a.nombre,
        equipmentEs: a.equipmentEs,
        home: a.home,
        poster: posters.get(clavePoster(a)) ?? null,
      })),
    },
  } satisfies ApiResponse)
}

// ── Filtros disponibles ──────────────────────────────────────────────────────

/**
 * GET /exercises/filters
 *
 * Los grupos, materiales y patrones que EXISTEN, con cuántos ejercicios tiene
 * cada uno. La app no debería llevar esa lista escrita a mano: el día que
 * lleguen vídeos nuevos aparecería un grupo sin filtro, o un filtro que no
 * devuelve nada.
 */
export async function getFilters(_req: Request, res: Response): Promise<void> {
  const contar = (campo: 'muscle' | 'equipment' | 'pattern', etiqueta?: 'muscleEs' | 'equipmentEs') => {
    const m = new Map<string, { id: string; label: string; count: number }>()
    for (const e of TODOS) {
      const id = e[campo]
      if (!id) continue
      const label = etiqueta ? (e[etiqueta] ?? id) : id
      const y = m.get(id)
      y ? y.count++ : m.set(id, { id, label, count: 1 })
    }
    return [...m.values()].sort((a, b) => b.count - a.count)
  }

  res.json({
    success: true,
    data: {
      total: TODOS.length,
      home: TODOS.filter(e => e.home).length,
      muscles: contar('muscle', 'muscleEs'),
      equipment: contar('equipment', 'equipmentEs'),
      patterns: contar('pattern'),
    },
  } satisfies ApiResponse)
}


// ── Entrenamientos generados ─────────────────────────────────────────────────

export const rapidoSchema = z.object({
  query: z.object({
    region: z.string().max(20).optional(),
    minutes: z.coerce.number().int().min(5).max(90).optional(),
    place: z.enum(['home', 'gym', 'todo']).optional(),
    level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  }),
})

/**
 * Un entrenamiento hecho a medida, del catálogo, en el momento.
 *
 * Los pósters se firman como en el resto: el bucket es privado y estas URL
 * caducan en una hora. El vídeo NO se firma aquí —son seis o siete ejercicios y
 * nadie los reproduce desde la lista—; se firma al abrir la ficha.
 */
export async function entrenamientoRapido(req: Request, res: Response): Promise<void> {
  const plan = generar({
    region: (req.query.region as string) ?? 'fullbody',
    minutos: Number(req.query.minutes ?? 20),
    lugar: (req.query.place as 'home' | 'gym' | 'todo') ?? 'todo',
    nivel: (req.query.level as 'beginner' | 'intermediate' | 'advanced') ?? 'intermediate',
  })

  if (!plan) {
    fail(res, 404, 'No hay ejercicios suficientes para esa combinación. Prueba con más material o con otra zona.')
    return
  }

  // `readUrls` devuelve un MAPA por clave, no una lista por posición: si se
  // trata como lista, un póster que falle desplaza a todos los siguientes y
  // cada ejercicio acaba con la imagen del de al lado.
  const firmadas = mediaReady()
    ? await readUrls(plan.ejercicios.map(e => `library/poster/${e.poster}`))
    : new Map<string, string>()

  res.status(200).json({
    success: true,
    data: {
      ...plan,
      ejercicios: plan.ejercicios.map(e => ({
        ...e,
        poster: firmadas.get(`library/poster/${e.poster}`) ?? null,
      })),
    },
  } satisfies ApiResponse)
}

/**
 * El menú de Descubre: qué combinaciones existen.
 *
 * Se calcula del catálogo en vez de escribirse a mano, para que una región que
 * se quede sin ejercicios suficientes deje de ofrecerse sola en vez de llevar a
 * una pantalla vacía.
 */
export async function opcionesRapidas(_req: Request, res: Response): Promise<void> {
  const disponibles = Object.entries(REGIONES).map(([id, musculos]) => {
    const total = TODOS.filter(e => e.muscle && musculos.includes(e.muscle)).length
    const casa = TODOS.filter(e => e.muscle && musculos.includes(e.muscle) && e.home).length
    return { region: id, ejercicios: total, enCasa: casa }
  }).filter(r => r.ejercicios >= 3)

  res.status(200).json({
    success: true,
    data: { duraciones: DURACIONES, regiones: disponibles },
  } satisfies ApiResponse)
}
