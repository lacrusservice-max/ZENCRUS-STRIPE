/**
 * LO QUE SE PUEDE DECIR DE CADA FASE
 * ═══════════════════════════════════════════════════════════════════════════
 * Energía, ánimo, antojos y apetito, agrupados por la fase en la que se
 * registraron. Lógica pura: entra el diario y salen números, sin tocar la
 * pantalla ni el almacén.
 *
 * ── Tres días por fase, o no se dice nada ──────────────────────────────────
 * Con uno o dos días no hay «energía en fase lútea», hay dos días sueltos. La
 * media de dos números se pinta igual de bonita que la de treinta y se lee con
 * la misma confianza, y eso es justo lo que la hace peligrosa: una tarde mala
 * en la única lútea registrada se convierte en «tu energía baja en lútea»,
 * ella se lo cree, y a partir de ahí lo ve en todas partes. Por debajo del
 * mínimo la métrica devuelve `null` y la pantalla enseña el hueco.
 *
 * Cada métrica lleva su propio contador. Se registran por separado —hay días
 * de solo energía y días de solo ánimo—, así que un único mínimo por fase
 * escondería una métrica bien registrada detrás de otra que no lo está.
 *
 * ── El ánimo se cuenta, no se promedia ─────────────────────────────────────
 * El ánimo se guarda como valencia y activación, dos números continuos, y
 * promediarlos es tentador porque el tipo lo permite. Pero la media de «feliz»
 * y «triste» cae casi exactamente sobre «sensible»: una fase en la que se
 * estuvo la mitad del tiempo eufórica y la otra mitad hundida se resumiría
 * como una fase tibia, que es lo contrario de lo que pasó. Así que se agrupa
 * cada día en su ánimo más cercano y se enseña el que más veces aparece, con
 * cuántas de cuántas. La moda de una distribución partida en dos será
 * discutible, pero nunca es una mentira.
 */

import { faseDeDia, type MarcoFases } from '@/nucleo/ciclo/fases'
import { PHASE_ORDER, type Phase } from './fases'
import { ANIMOS, animoMasCercano, type Animo } from './animos'
import { diasEntre } from '@/utils/fechas'

/** Días registrados que hacen falta en una fase para decir algo de ella. */
export const MINIMO_DIAS_FASE = 3

/** Días con registro que hacen falta para dar porcentajes de síntomas. */
export const MINIMO_DIAS_SINTOMAS = 10

/** Cuánto tiene que moverse una media mensual para llamarlo tendencia. */
export const UMBRAL_TENDENCIA = 0.5

export interface Dominante {
  id: string
  etiqueta: string
  /** Días en los que salió este. */
  n: number
  /** Días con este dato en la fase. `n / de` es su porcentaje. */
  de: number
}

export interface ResumenFase {
  energia: { media: number; n: number } | null
  apetito: { media: number; n: number } | null
  animo: (Dominante & { animo: Animo }) | null
  antojo: Dominante | null
  /** Días de esta fase con algún dato, aunque ninguna métrica llegue al mínimo. */
  dias: number
}

type Diario = Record<string, Record<string, unknown>>

const ANIMOS_POR_ID = new Map(ANIMOS.map(a => [a.id, a]))

const ANTOJO_ET: Record<string, string> = {
  dulce: 'Dulce', salado: 'Salado', carbohidratos: 'Carbohidratos',
  grasas: 'Grasas', proteinas: 'Proteínas', citricos: 'Cítricos', otro: 'Otro',
}

/** El día de ciclo de una fecha, o `null` si cae antes del primer periodo. */
function diaDeCicloDe(fecha: string, inicios: string[], duracion: number): number | null {
  const inicio = [...inicios].reverse().find(i => i <= fecha)
  if (!inicio) return null
  const d = diasEntre(inicio, fecha) + 1
  /* Se admite hasta una semana de más: un ciclo que se alarga sigue contando,
     pero un hueco de meses sin registrar no puede colocarse en ninguna fase. */
  if (d < 1 || d > duracion + 7) return null
  return d
}

/** El elemento más repetido de una cesta, con sus dos cuentas. */
function moda(
  cuenta: Map<string, number>,
  total: number,
  etiquetaDe: (id: string) => string,
): Dominante | null {
  let mejor: string | null = null
  let n = 0
  for (const [id, c] of cuenta) if (c > n) { mejor = id; n = c }
  return mejor === null ? null : { id: mejor, etiqueta: etiquetaDe(mejor), n, de: total }
}

export function resumenPorFase(
  logs: Diario,
  desde: string, hasta: string,
  periodos: { inicio: string }[],
  marco: MarcoFases,
): Record<Phase, ResumenFase> {
  const inicios = periodos.map(p => p.inicio).sort()

  const acc: Record<Phase, {
    energia: number[]
    apetito: number[]
    animo: Map<string, number>
    animoN: number
    antojo: Map<string, number>
    antojoN: number
    dias: number
  }> = Object.fromEntries(PHASE_ORDER.map(f => [f, {
    energia: [], apetito: [], animo: new Map(), animoN: 0,
    antojo: new Map(), antojoN: 0, dias: 0,
  }])) as never

  for (const [fecha, dia] of Object.entries(logs)) {
    if (fecha < desde || fecha > hasta) continue
    const diaCiclo = diaDeCicloDe(fecha, inicios, marco.duracion)
    if (diaCiclo === null) continue

    const a = acc[faseDeDia(((diaCiclo - 1) % marco.duracion) + 1, marco)]
    let algo = false

    const energia = (dia.energia as { level?: number } | undefined)?.level
    if (typeof energia === 'number') { a.energia.push(energia); algo = true }

    const apetito = (dia.apetito as { level?: number } | undefined)?.level
    if (typeof apetito === 'number') { a.apetito.push(apetito); algo = true }

    const animo = dia.animo as { valence?: number; arousal?: number } | undefined
    if (typeof animo?.valence === 'number' && typeof animo.arousal === 'number') {
      const cual = animoMasCercano(animo.valence, animo.arousal)
      a.animo.set(cual.id, (a.animo.get(cual.id) ?? 0) + 1)
      a.animoN++
      algo = true
    }

    /* Un día con tres antojos cuenta una vez por cada uno en el numerador,
       pero UNA sola vez en el denominador: lo que se responde es «cuando tuvo
       antojos, ¿de qué eran?», no «qué porcentaje de sus antojos fue dulce». */
    const antojos = (dia.antojos as { tags?: string[] } | undefined)?.tags
    if (antojos?.length) {
      for (const t of new Set(antojos)) {
        a.antojo.set(t, (a.antojo.get(t) ?? 0) + 1)
      }
      a.antojoN++
      algo = true
    }

    if (algo) a.dias++
  }

  const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const bastantes = (n: number) => n >= MINIMO_DIAS_FASE

  return Object.fromEntries(PHASE_ORDER.map(f => {
    const a = acc[f]
    const animo = bastantes(a.animoN)
      ? moda(a.animo, a.animoN, id => id)
      : null
    return [f, {
      energia: bastantes(a.energia.length)
        ? { media: media(a.energia), n: a.energia.length } : null,
      apetito: bastantes(a.apetito.length)
        ? { media: media(a.apetito), n: a.apetito.length } : null,
      animo: animo
        ? (() => {
          const cual = ANIMOS_POR_ID.get(animo.id)!
          return { ...animo, etiqueta: cual.etiqueta, animo: cual }
        })()
        : null,
      antojo: bastantes(a.antojoN)
        ? moda(a.antojo, a.antojoN, id => ANTOJO_ET[id] ?? id) : null,
      dias: a.dias,
    } satisfies ResumenFase]
  })) as Record<Phase, ResumenFase>
}

/* ── Tendencia mes a mes ─────────────────────────────────────────────────── */

export type Sentido = 'sube' | 'baja' | 'igual'

export interface Tendencia {
  /** Media del último mes completo con muestra suficiente. */
  actual: number
  /** Media del mes anterior a ese. */
  previo: number
  delta: number
  sentido: Sentido
  /** Los dos meses comparados, en `YYYY-MM`. */
  meses: [string, string]
}

/**
 * Compara los dos últimos meses con muestra suficiente.
 *
 * Se comparan MESES DE CALENDARIO y no ciclos porque es lo que ella puede
 * comprobar: «en julio comía más que en agosto» se contrasta con la memoria,
 * «en tu ciclo anterior» no. Y se salta cualquier mes con menos de tres días
 * registrados en vez de compararlo igualmente: un mes con dos registros da un
 * salto enorme que no es un cambio de la persona, es un cambio de cuánto
 * apuntó.
 *
 * El umbral de medio punto sobre una escala de cinco es lo que separa un
 * cambio de un redondeo. Por debajo se dice «igual», que también es una
 * respuesta.
 */
export function tendenciaMensual(
  logs: Diario,
  campo: 'energia' | 'apetito',
  hasta: string,
): Tendencia | null {
  const porMes = new Map<string, number[]>()

  for (const [fecha, dia] of Object.entries(logs)) {
    if (fecha > hasta) continue
    const v = (dia[campo] as { level?: number } | undefined)?.level
    if (typeof v !== 'number') continue
    const mes = fecha.slice(0, 7)
    const xs = porMes.get(mes) ?? []
    xs.push(v)
    porMes.set(mes, xs)
  }

  const meses = [...porMes.entries()]
    .filter(([, xs]) => xs.length >= MINIMO_DIAS_FASE)
    .sort(([a], [b]) => a.localeCompare(b))

  if (meses.length < 2) return null

  const [mesPrevio, previoXs] = meses[meses.length - 2]
  const [mesActual, actualXs] = meses[meses.length - 1]
  const m = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const actual = m(actualXs)
  const previo = m(previoXs)
  const delta = actual - previo

  return {
    actual, previo, delta,
    sentido: delta > UMBRAL_TENDENCIA ? 'sube'
      : delta < -UMBRAL_TENDENCIA ? 'baja'
        : 'igual',
    meses: [mesPrevio, mesActual],
  }
}
