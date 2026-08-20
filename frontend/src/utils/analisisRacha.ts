/**
 * LO QUE EL HISTORIAL YA SABE
 * ═══════════════════════════
 * `streakStore` guarda el estado de los últimos 84 días. De ahí salen, sin
 * pedirle nada al servidor ni guardar un campo más, cuatro cosas que la página
 * de rachas nunca ha enseñado:
 *
 *   · cuándo empezó la racha que llevas
 *   · qué rachas tuviste antes, con sus fechas
 *   · qué días de la semana cumples y cuáles fallas
 *   · qué día caerá el siguiente hito si sigues así
 *
 * ── Por qué van aparte y no dentro del store ────────────────────────────────
 * Porque son cálculos, no estado: la misma lista de días entra y siempre sale
 * lo mismo. Metidos en el store harían falta mocks de zustand y AsyncStorage
 * para comprobar que «una racha de tres días partida por un hueco cuenta como
 * dos», que es justo la clase de regla que se rompe sin que nadie lo note.
 */

import { hoyLocal } from '@/utils/fechas'

/** Lo que devuelve `getHistory`: un día y cómo acabó. */
export interface DiaHistorial {
  date: string
  status: 'completed' | 'protected' | 'missed' | 'future' | 'empty'
}

/** Un día cuenta si se cumplió o si lo salvó un protector. */
export const cuenta = (d: DiaHistorial): boolean =>
  d.status === 'completed' || d.status === 'protected'

/** Los días futuros no son huecos: aún no han pasado. */
const yaPaso = (d: DiaHistorial): boolean => d.status !== 'future'

export interface Tramo {
  inicio: string
  fin: string
  dias: number
}

/**
 * Todos los tramos seguidos del historial, del más antiguo al más reciente.
 *
 * El historial llega en orden descendente —hoy primero—, así que se le da la
 * vuelta antes de recorrerlo: buscar tramos hacia atrás obliga a invertir las
 * fechas al final y es donde se cuelan los errores de un día.
 */
export function tramos(historial: DiaHistorial[]): Tramo[] {
  const dias = [...historial].filter(yaPaso).reverse()
  const salida: Tramo[] = []
  let actual: Tramo | null = null

  for (const d of dias) {
    if (cuenta(d)) {
      if (actual) { actual.fin = d.date; actual.dias++ }
      else actual = { inicio: d.date, fin: d.date, dias: 1 }
    } else if (actual) {
      salida.push(actual)
      actual = null
    }
  }
  if (actual) salida.push(actual)
  return salida
}

/**
 * Cuándo empezó la racha que llevas ahora, o null si hoy no cuenta.
 *
 * Se mira el ÚLTIMO tramo y se comprueba que llegue hasta hoy: si acabó ayer,
 * la racha está rota aunque el tramo sea reciente, y decir «tu racha empezó
 * el…» sería mentir sobre algo que ya no existe.
 */
export function inicioDeRacha(historial: DiaHistorial[]): string | null {
  const t = tramos(historial)
  const ultimo = t[t.length - 1]
  if (!ultimo) return null
  return ultimo.fin === hoyLocal() ? ultimo.inicio : null
}

/**
 * Las rachas anteriores, de la más larga a la más corta.
 *
 * Se excluye la actual —si la hay— porque ya se enseña arriba a lo grande, y
 * repetirla aquí haría dudar de si es otra distinta.
 */
export function rachasPrevias(historial: DiaHistorial[], cuantas = 4): Tramo[] {
  const t = tramos(historial)
  const hoy = hoyLocal()
  return t
    .filter(x => x.fin !== hoy)
    .sort((a, b) => b.dias - a.dias)
    .slice(0, cuantas)
}

/**
 * Qué tal se te da cada día de la semana, de lunes a domingo.
 *
 * Devuelve la proporción de veces que ese día contó, de 0 a 1. Con menos de
 * dos apariciones devuelve null en vez de 0 o 1: un único domingo cumplido no
 * significa que los domingos se te den bien, y pintar una barra al 100 % con
 * un solo dato es inventarse un patrón.
 */
export function patronSemanal(historial: DiaHistorial[]): (number | null)[] {
  const hechos = Array(7).fill(0)
  const totales = Array(7).fill(0)

  for (const d of historial) {
    if (!yaPaso(d)) continue
    const [a, m, dd] = d.date.split('-').map(Number)
    const idx = (new Date(a, m - 1, dd).getDay() + 6) % 7   // 0 = lunes
    totales[idx]++
    if (cuenta(d)) hechos[idx]++
  }
  return totales.map((t, i) => (t < 2 ? null : hechos[i] / t))
}

/** El día flojo: el que menos cumples, si hay uno claro. */
export function diaFlojo(patron: (number | null)[]): number | null {
  const NOMBRES = 7
  let peor = -1
  let valor = 1
  for (let i = 0; i < NOMBRES; i++) {
    const v = patron[i]
    if (v == null) continue
    if (v < valor) { valor = v; peor = i }
  }
  /* Solo se señala si de verdad destaca. Con todo por encima del 70 % no hay
     punto flojo que avisar, y decirlo igualmente sería fabricar un problema. */
  return peor >= 0 && valor < 0.7 ? peor : null
}

/**
 * Qué día caerá el hito, si se mantiene el ritmo.
 *
 * Es una suma de días naturales sobre hoy, no una predicción: da por hecho que
 * no se falla ni uno. Y así se dice en la pantalla —«si sigues así»—, porque
 * presentarlo como una certeza sería prometer algo que depende de la persona.
 */
export function fechaDelHito(diasQueFaltan: number, desde = new Date()): Date {
  const f = new Date(desde)
  f.setDate(f.getDate() + diasQueFaltan)
  return f
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** «27 de noviembre de 2026», o «27 de noviembre» si es este mismo año. */
export function enLetra(f: Date, hoy = new Date()): string {
  const base = `${f.getDate()} de ${MESES[f.getMonth()]}`
  return f.getFullYear() === hoy.getFullYear() ? base : `${base} de ${f.getFullYear()}`
}

/** «14 ago» — para las fechas de las rachas viejas, donde el año sobra. */
export function enCorto(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES[m - 1].slice(0, 3)}`
}
