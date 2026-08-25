/**
 * EN CASA · RECONCILIAR EL PLAN CON LO QUE TIENES
 * ══════════════════════════════════════════════
 * El último eslabón, y el que convierte esto en un sistema en vez de en un
 * filtro: **cuando cambia lo que tienes en casa, el plan que ya está guardado
 * deja de encajar, y alguien tiene que darse cuenta.**
 *
 * Sin esto, alguien que monta su semana con mancuernas y luego las devuelve se
 * queda con seis días de ejercicios que no puede hacer, y la app tan contenta.
 * El filtro de la biblioteca no lo arregla: la biblioteca es para buscar, el
 * plan es lo que te dice qué hacer mañana.
 *
 * ── POR QUÉ NO SE SUSTITUYE EN SILENCIO ─────────────────────────────────────
 * Sería fácil cambiar los ejercicios solos y no decir nada. Es la decisión
 * equivocada por dos motivos:
 *
 *   · **El plan es suyo.** Puede haberlo editado a mano, puesto un ejercicio
 *     concreto por una razón que la app no conoce. Cambiárselo mientras duerme
 *     es la clase de cosa que hace que alguien deje de fiarse de una app.
 *   · **Puede que el material vuelva.** Quien marca «ya no tengo mancuernas»
 *     porque están en casa de su hermano una semana no quiere perder su plan.
 *
 * Así que se detecta, se cuenta, y el cambio lo pide él. Un toque, pero suyo.
 *
 * ── La sustitución respeta el hueco, no el ejercicio ────────────────────────
 * Se cambia con `clavePlan`, que es la identidad del HUECO en el plan y no la
 * del ejercicio que lo ocupa. Así el peso que hubiera fijado a mano y el
 * historial del hueco sobreviven al cambio.
 */

import { alternativasDe, cambiarEjercicio, Propuesta } from '@/services/programService'
import { puedoHacerlo, Aparejo } from '@/store/casaMaterialStore'

export interface Desajuste {
  clavePlan: string
  slug?: string
  nombre: string
  /** Con qué se hace, para poder decir POR QUÉ ya no encaja. */
  equipment: string | null
  musculo?: string | null
}

/**
 * Qué ejercicios del día ya no puedes hacer.
 *
 * Los anotados a mano —sin `slug` ni `equipment`— NO se tocan: la app no sabe
 * con qué se hacen y adivinarlo sería peor que dejarlos. Si alguien escribió
 * «la máquina rara del garaje», es asunto suyo.
 */
export function desajustesDe(
  ejercicios: Propuesta[],
  tengo: Aparejo[],
  preguntado: boolean,
): Desajuste[] {
  if (!preguntado) return []
  return ejercicios
    .filter(e => e.slug && e.equipment)
    .filter(e => !puedoHacerlo({ slug: e.slug, equipment: e.equipment }, tengo, preguntado))
    .map(e => ({
      clavePlan: e.clavePlan,
      slug: e.slug,
      nombre: e.nombre,
      equipment: e.equipment ?? null,
      musculo: e.muscleEs ?? e.muscle,
    }))
}

/** El nombre humano del material que falta, para poder explicarlo. */
export function faltaLo(equipment: string | null): string {
  switch (equipment) {
    case 'dumbbell': return 'mancuernas'
    case 'kettlebell': return 'pesa rusa'
    case 'band': return 'bandas'
    case 'bodyweight': return 'barra o banco'
    default: return 'material de gimnasio'
  }
}

export interface Sustitucion {
  clavePlan: string
  antes: string
  despues: string | null
  /** `false` cuando no había ninguna alternativa que encajara. */
  resuelto: boolean
}

/**
 * Cambia cada desajuste por la primera alternativa que SÍ cabe en su casa.
 *
 * ── Se va uno por uno y se aguanta el fallo ─────────────────────────────────
 * Si una alternativa no llega o el servidor falla en el tercero, los dos
 * primeros ya cambiados se quedan cambiados y el tercero se reporta sin
 * resolver. Abortar entero dejaría el plan a medias sin que nadie supiera por
 * dónde iba, que es peor que un cambio parcial explicado.
 */
export async function sustituir(
  desajustes: Desajuste[],
  tengo: Aparejo[],
): Promise<Sustitucion[]> {
  const salida: Sustitucion[] = []

  for (const d of desajustes) {
    try {
      const r = await alternativasDe(d.clavePlan)
      const cabe = r.alternativas.find(a =>
        puedoHacerlo({ slug: a.slug, equipment: a.equipment }, tengo, true))

      if (!cabe) {
        salida.push({ clavePlan: d.clavePlan, antes: d.nombre, despues: null, resuelto: false })
        continue
      }
      await cambiarEjercicio(d.clavePlan, cabe.slug)
      salida.push({ clavePlan: d.clavePlan, antes: d.nombre, despues: cabe.nombre, resuelto: true })
    } catch {
      salida.push({ clavePlan: d.clavePlan, antes: d.nombre, despues: null, resuelto: false })
    }
  }

  return salida
}
