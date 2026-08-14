/**
 * GENERADOR DE ENTRENAMIENTOS
 * ───────────────────────────
 * «Tengo quince minutos, estoy en casa y quiero tren superior» → una sesión
 * lista, con sus ejercicios, sus series y sus descansos.
 *
 * ── Por qué generar y no guardar una lista ──────────────────────────────────
 * Las apps de este tipo traen entrenamientos pregrabados: un vídeo de 15 min de
 * tren superior, el mismo para todo el mundo y para siempre. Eso obliga a
 * producir contenido nuevo para cada combinación —y son cientos— y garantiza
 * que quien lo repita tres semanas haga exactamente lo mismo tres semanas.
 *
 * Aquí la sesión se compone del catálogo de 206 en el momento. Sale distinta
 * según el material que tengas, la zona que pidas y el tiempo que te quede, y
 * cambia de un día para otro sin que nadie grabe nada.
 *
 * ── Pero NO cambia dentro del mismo día ─────────────────────────────────────
 * El azar va sembrado con la fecha y los parámetros. Quien abra «15 min · tren
 * superior» por la mañana y otra vez por la tarde se encuentra el MISMO
 * entrenamiento: si cambiara a cada visita, no habría forma de decir «voy a
 * hacer el de antes» ni de comparar dos días.
 */

import catalogo from '../data/exercises.json'

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
  poster: string
}

const TODOS = catalogo.ejercicios as Ficha[]

// ── Las regiones, las mismas que la app ──────────────────────────────────────
// Duplicadas a propósito: el servidor no puede depender de una constante del
// cliente, y si algún día divergen, lo que manda es esto.
export const REGIONES: Record<string, string[]> = {
  fullbody:  ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'core'],
  upper:     ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  arms:      ['biceps', 'triceps', 'forearms'],
  chest:     ['chest'],
  legs:      ['quads', 'hamstrings', 'glutes', 'calves'],
  back:      ['back'],
  shoulders: ['shoulders'],
  core:      ['core'],
}

/**
 * Cuánto dura una serie, en segundos.
 *
 * Cuarenta de trabajo es lo que se tarda en hacer entre ocho y doce
 * repeticiones a un ritmo normal. El descanso va aparte porque cambia según el
 * ejercicio: no se descansa lo mismo tras una sentadilla que tras un curl.
 */
const SEGUNDOS_TRABAJO = 40

/** Descanso por patrón. Lo que mueve mucha masa pide más. */
const DESCANSO: Record<string, number> = {
  squat: 120, hinge: 120, deadlift: 120,
  press: 90, push: 90, row: 90, pull: 90, pulldown: 90,
  lunge: 75, carry: 75,
  curl: 60, fly: 60, raise: 60, extension: 60,
  core: 45, stretch: 30, mobility: 30,
}

/**
 * DOS FORMAS DE OCUPAR EL MISMO RATO
 *
 * · FUERZA: pocos ejercicios, más series, descansos largos. Es lo correcto
 *   cuando hay tiempo y se busca cargar.
 * · CIRCUITO: más ejercicios, menos series y descansos cortos. Es lo que
 *   significa de verdad «tengo quince minutos».
 *
 * Con descansos de 90 s, quince minutos dan para TRES ejercicios. Matemática-
 * mente correcto y completamente equivocado como respuesta: quien pide un
 * entrenamiento corto no quiere una sesión de fuerza recortada, quiere moverse
 * seguido. El estilo se deduce del presupuesto en vez de preguntarlo, porque el
 * tiempo disponible ya lo dice todo.
 */
export type Estilo = 'fuerza' | 'circuito'

const UMBRAL_CIRCUITO = 18   // minutos

const estiloDe = (minutos: number): Estilo => minutos <= UMBRAL_CIRCUITO ? 'circuito' : 'fuerza'

/** En circuito el descanso se comprime a la mitad, con suelo de 30 s. */
const descansoDe = (patron: string | null, estilo: Estilo): number => {
  const base = DESCANSO[patron ?? ''] ?? 75
  return estilo === 'circuito' ? Math.max(30, Math.round(base * 0.45)) : base
}

/**
 * Azar sembrado: mismo día y mismos parámetros, mismo entrenamiento.
 */
function sembrar(semilla: string): () => number {
  let h = 2166136261
  for (let i = 0; i < semilla.length; i++) {
    h ^= semilla.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5
    return ((h >>> 0) % 1_000_000) / 1_000_000
  }
}

const barajar = <T>(lista: T[], azar: () => number): T[] => {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Lo que sale ──────────────────────────────────────────────────────────────

export interface EjercicioGenerado {
  slug: string
  nombre: string
  muscle: string | null
  muscleEs: string | null
  equipment: string
  equipmentEs: string
  pattern: string | null
  poster: string
  series: number
  reps: string
  descanso: number
  /** Segundos que ocupa en total, con sus descansos. */
  segundos: number
}

export interface Generado {
  region: string
  minutos: number
  lugar: 'home' | 'gym' | 'todo'
  nivel: 'beginner' | 'intermediate' | 'advanced'
  /** Cómo se ocupa el rato: pocas series largas o muchas seguidas. */
  estilo: Estilo
  titulo: string
  /** Minutos de verdad, que casi nunca son los pedidos exactos. */
  minutosReales: number
  series: number
  musculos: string[]
  ejercicios: EjercicioGenerado[]
}

export interface Peticion {
  region: string
  minutos: number
  lugar?: 'home' | 'gym' | 'todo'
  nivel?: 'beginner' | 'intermediate' | 'advanced'
  equipment?: string[]
  /** Para que el mismo día salga lo mismo. Por defecto, hoy. */
  dia?: string
}

/** Series por ejercicio según el nivel. Un principiante no necesita cinco. */
const SERIES: Record<string, number> = { beginner: 2, intermediate: 3, advanced: 4 }
const REPS: Record<string, string> = { beginner: '10-12', intermediate: '8-12', advanced: '6-10' }

/**
 * En circuito se quita una serie por ejercicio (mínimo dos).
 *
 * El presupuesto que se libera se gasta en MÁS ejercicios, que es lo que hace
 * que un entrenamiento corto se sienta corto: cambiar de movimiento a menudo,
 * no repetir el mismo cuatro veces con prisa.
 */
const seriesDe = (nivel: string, estilo: Estilo): number =>
  Math.max(2, (SERIES[nivel] ?? 3) - (estilo === 'circuito' ? 1 : 0))

/**
 * Compone el entrenamiento.
 *
 * ── El reparto es por MÚSCULO, no por cantidad ──────────────────────────────
 * Se recorren los músculos de la región por turnos y se coge uno de cada. Sin
 * eso, coger seis ejercicios al azar de «tren superior» da tres de pecho y
 * ninguno de espalda uno de cada tres días, porque el catálogo tiene más
 * ejercicios de pecho.
 *
 * ── Y no se repite patrón seguido ───────────────────────────────────────────
 * Dos empujes consecutivos cansan el mismo hombro y hacen que el segundo salga
 * peor. Al alternar patrón, el descanso de un grupo es el trabajo del otro.
 */
export function generar(p: Peticion): Generado | null {
  const musculos = REGIONES[p.region] ?? REGIONES.fullbody
  const lugar = p.lugar ?? 'todo'
  const nivel = p.nivel ?? 'intermediate'
  const dia = p.dia ?? new Date().toISOString().slice(0, 10)

  const azar = sembrar(`${dia}|${p.region}|${p.minutos}|${lugar}|${nivel}|${(p.equipment ?? []).join(',')}`)

  // Candidatos: de la región, del sitio y con material disponible.
  const pool = TODOS.filter(e => {
    if (!e.muscle || !musculos.includes(e.muscle)) return false
    if (lugar === 'home' && !e.home) return false
    if (lugar === 'gym' && !e.gym) return false
    if (p.equipment?.length && !p.equipment.includes(e.equipment)) return false
    // Los estiramientos no son trabajo: van aparte, al final.
    return e.pattern !== 'stretch'
  })

  if (pool.length === 0) return null

  const estilo = estiloDe(p.minutos)
  const series = seriesDe(nivel, estilo)
  const reps = REPS[nivel] ?? '8-12'
  const presupuesto = p.minutos * 60

  // Por músculo, ya barajado: así cada turno saca uno distinto.
  const porMusculo = new Map<string, Ficha[]>()
  for (const m of musculos) {
    const suyos = barajar(pool.filter(e => e.muscle === m), azar)
    if (suyos.length > 0) porMusculo.set(m, suyos)
  }

  const elegidos: Ficha[] = []
  let gastado = 0
  let ultimoPatron: string | null = null
  let vueltas = 0

  while (gastado < presupuesto && vueltas < 40) {
    vueltas++
    let metioAlguno = false

    for (const [, lista] of porMusculo) {
      if (lista.length === 0) continue

      // Se prefiere uno que NO repita el patrón anterior; si no hay, vale
      // cualquiera antes que dejar el hueco vacío.
      const i = lista.findIndex(e => e.pattern !== ultimoPatron)
      const ficha = lista.splice(i >= 0 ? i : 0, 1)[0]

      const descanso = descansoDe(ficha.pattern, estilo)
      const transicion = estilo === 'circuito' ? 15 : 30
      const cuesta = series * SEGUNDOS_TRABAJO + (series - 1) * descanso + transicion

      if (gastado + cuesta > presupuesto && elegidos.length >= 3) continue

      elegidos.push(ficha)
      gastado += cuesta
      ultimoPatron = ficha.pattern
      metioAlguno = true

      if (gastado >= presupuesto) break
    }

    if (!metioAlguno) break
  }

  if (elegidos.length === 0) return null

  const ejercicios: EjercicioGenerado[] = elegidos.map(e => {
    const descanso = descansoDe(e.pattern, estilo)
    return {
      slug: e.slug, nombre: e.nombre,
      muscle: e.muscle, muscleEs: e.muscleEs,
      equipment: e.equipment, equipmentEs: e.equipmentEs,
      pattern: e.pattern, poster: e.poster,
      series, reps, descanso,
      segundos: series * SEGUNDOS_TRABAJO + (series - 1) * descanso + (estilo === 'circuito' ? 15 : 30),
    }
  })

  const total = ejercicios.reduce((a, e) => a + e.segundos, 0)
  const musculosReales = [...new Set(ejercicios.map(e => e.muscle).filter((m): m is string => !!m))]

  return {
    region: p.region, minutos: p.minutos, lugar, nivel, estilo,
    titulo: tituloDe(p.region, p.minutos, lugar),
    minutosReales: Math.round(total / 60),
    series: ejercicios.length * series,
    musculos: musculosReales,
    ejercicios,
  }
}

const NOMBRE_REGION: Record<string, string> = {
  fullbody: 'Cuerpo entero', upper: 'Tren superior', arms: 'Brazos',
  chest: 'Pecho', legs: 'Glúteos y piernas', back: 'Espalda',
  shoulders: 'Hombros', core: 'Core',
}

/**
 * El título.
 *
 * Empieza por los minutos porque es el dato con el que se elige: quien tiene
 * doce minutos descarta el de veinte antes de leer de qué es.
 */
function tituloDe(region: string, minutos: number, lugar: string): string {
  const zona = NOMBRE_REGION[region] ?? 'Cuerpo entero'
  const donde = lugar === 'home' ? ' en casa' : ''
  return `${minutos} min · ${zona}${donde}`
}

/**
 * Las combinaciones que se ofrecen en Descubre.
 *
 * Tres duraciones y no diez: la gente tiene diez minutos, veinte o media hora,
 * y una rejilla con siete opciones de tiempo se lee peor que una con tres.
 */
export const DURACIONES = [10, 20, 30]
