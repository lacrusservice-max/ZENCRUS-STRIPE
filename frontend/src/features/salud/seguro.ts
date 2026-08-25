/**
 * EL SEGURO · NO FALLAR DOS VECES
 * ═══════════════════════════════════════════════════════════════════════════
 * Fallar un día no rompe un hábito. Lo que lo rompe es el segundo, y ahí es
 * donde la gente borra la app. Casi ninguna tiene mecánica para eso: se limitan
 * a poner la racha a cero y a callarse.
 *
 * ── El primer fallo NO se menciona ─────────────────────────────────────────
 * A propósito. Avisar por un día suelto solo genera culpa por algo que es
 * normal, y la culpa no devuelve a nadie. Se habla al SEGUNDO, que es cuando
 * de verdad se está perdiendo el hábito.
 *
 * ── Se baja el listón, y eso es lo que funciona ────────────────────────────
 * No se pide lo mismo otra vez: se pide un cuarto. «Leer veinte minutos» pasa a
 * «leer cinco», y cuenta igual. Volver es más importante que cumplir, porque
 * quien vuelve mañana sigue teniendo el hábito y quien no vuelve, no.
 *
 * ── Nada de sermones a quien nunca lo hizo ─────────────────────────────────
 * Solo entra un hábito que YA se cumplía. Ofrecerle un rescate a alguien que
 * creó «Meditar» hace un mes y no lo hizo jamás no es ayudar, es señalar.
 *
 * ── Lo que NO guarda ───────────────────────────────────────────────────────
 * Que un día se cumpliera con la versión reducida no se apunta en ningún sitio:
 * el registro solo dice que se cumplió, que es verdad. Distinguirlo pediría una
 * columna más y no cambia nada de lo que la persona ve.
 */

import type { DayLog, Habit } from '@/store/habitsStore'
import { haceDias } from '@/utils/fechas'

/** Cuántos días seguidos hay que fallar para que aparezca. */
const FALLOS_MINIMOS = 2
/** Hasta dónde se mira atrás buscando si alguna vez se cumplió. */
const MEMORIA_DIAS = 45
/** La parte de la meta que se pide en su lugar. */
const PARTE = 0.25

export interface Seguro {
  habito: Habit
  /** Días seguidos fallados, contando desde ayer. */
  fallos: number
  /** La racha que se rompió, para poder nombrarla. */
  rachaPerdida: number
  /** Segundos que hoy bastan. `null` si el hábito no lleva cronómetro. */
  metaReducida: number | null
}

/** Los días seguidos fallados terminando AYER. Hoy no cuenta: el día va. */
function fallosSeguidos(logs: Record<string, DayLog>, id: string): number {
  let n = 0
  for (let i = 1; i <= MEMORIA_DIAS; i++) {
    if (logs[haceDias(i)]?.[id]) break
    n++
  }
  return n
}

/** La racha que venía justo antes de esos fallos. */
function rachaAntesDe(logs: Record<string, DayLog>, id: string, desde: number): number {
  let n = 0
  for (let i = desde + 1; i <= MEMORIA_DIAS; i++) {
    if (logs[haceDias(i)]?.[id]) n++
    else break
  }
  return n
}

/**
 * Menos, pero no ridículo: un cuarto de la meta, redondeado al minuto y nunca
 * por debajo de uno. De «20 min» sale «5 min», que se dice y se hace.
 */
function reducir(metaSegundos: number): number {
  const min = Math.max(1, Math.round((metaSegundos * PARTE) / 60))
  return min * 60
}

/**
 * El hábito que más merece un rescate hoy, o `null` si no hay ninguno.
 *
 * Se devuelve UNO. Enseñar tres rescates a la vez es enseñar tres deudas, y el
 * día que fallas tres cosas lo último que ayuda es una lista de tus fallos.
 */
export function buscarSeguro(
  habits: Habit[],
  logs: Record<string, DayLog>,
  hoy: string,
): Seguro | null {
  const deHoy = logs[hoy] ?? {}

  const candidatos = habits
    .filter(h => !deHoy[h.id])
    .map(h => {
      const fallos = fallosSeguidos(logs, h.id)
      return { h, fallos, rachaPerdida: rachaAntesDe(logs, h.id, fallos) }
    })
    // Dos fallos seguidos Y haberlo cumplido antes: sin lo segundo no es un
    // hábito que se está perdiendo, es uno que nunca empezó.
    .filter(c => c.fallos >= FALLOS_MINIMOS && c.rachaPerdida > 0)

  if (candidatos.length === 0) return null

  // El que más racha tenía: es el que más duele perder y el que más probable es
  // que se recupere.
  candidatos.sort((a, b) => b.rachaPerdida - a.rachaPerdida)
  const { h, fallos, rachaPerdida } = candidatos[0]

  return {
    habito: h,
    fallos,
    rachaPerdida,
    metaReducida: h.metaSegundos ? reducir(h.metaSegundos) : null,
  }
}

/** «5 minutos», o lo que hoy baste sin cronómetro. */
export function loQueBastaHoy(s: Seguro): string {
  if (!s.metaReducida) return 'Solo marcarlo'
  return `${Math.round(s.metaReducida / 60)} minutos`
}
