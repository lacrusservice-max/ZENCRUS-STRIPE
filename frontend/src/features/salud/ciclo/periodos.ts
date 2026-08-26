/**
 * DERIVAR LOS PERIODOS DEL REGISTRO DE SANGRADO
 * ═══════════════════════════════════════════════════════════════════════════
 * Todo lo que el módulo calcula —fases, predicción, estadísticas, mapa de
 * calor— cuelga de una sola pregunta: ¿qué días empezó un periodo?
 *
 * ── Por qué se deduce y no se pregunta ─────────────────────────────────────
 * La alternativa es un botón de «hoy me bajó». Se ve más simple y es peor: son
 * dos registros para el mismo hecho, la usuaria puede marcar uno y olvidar el
 * otro, y entonces el historial y las medias dejan de coincidir con lo que
 * ella misma apuntó. Aquí el sangrado es la única fuente y el periodo se
 * deduce; declararlo a mano sigue siendo posible y gana siempre, pero es la
 * excepción, no el camino normal.
 *
 * ── La regla que hay que tener presente al leer este archivo ───────────────
 * **La ausencia de registro NO es ausencia de sangrado.** Un día sin apuntar
 * es un día desconocido, no un día seco. Confundir las dos cosas parte
 * periodos por la mitad cada vez que alguien se salta un día, y con periodos
 * partidos las medias se hunden y la app empieza a predecir ciclos de doce
 * días. Por eso ninguna separación se calcula contando días sin registro: se
 * cuenta de día CON sangrado a día CON sangrado.
 */

import { diasEntre } from '@/utils/fechas'
import {
  agruparPeriodos,
  CICLO_MIN as MIN_NUCLEO, CICLO_MAX as MAX_NUCLEO,
  SANGRADO_MINIMO as MINIMO_NUCLEO,
} from '@/nucleo/ciclo/fases'
import type { RegistroDia } from '@/store/cicloStore'

/**
 * A partir de aquí cuenta como menstruación.
 *
 * El nivel 1 es manchado y NO abre un periodo: el manchado a mitad de ciclo es
 * común —ovulación, implantación, un DIU asentándose— y tratarlo como regla
 * fabricaría un ciclo de quince días que nunca ocurrió.
 */
export const SANGRADO_MINIMO = MINIMO_NUCLEO

/**
 * Ningún ciclo humano dura menos de esto.
 *
 * Es la guarda fuerte: un sangrado que aparece antes de este día pertenece al
 * ciclo en curso o es sangrado intermenstrual, pero no es una regla nueva.
 * Sin esta guarda, dos días de manchado a mitad de mes bastarían para partir
 * el ciclo en dos y arruinar la media.
 */
export const CICLO_MIN = MIN_NUCLEO

/** Y ninguno dura más. Por encima, casi siempre falta un periodo por registrar. */
export const CICLO_MAX = MAX_NUCLEO

export interface Periodo {
  /** Primer día de sangrado. */
  inicio: string
  /** Último día de sangrado observado. `null` si sigue en curso. */
  fin: string | null
  /** Días de sangrado observados, no días transcurridos. */
  diasSangrado: number
  /**
   * Días hasta el inicio del siguiente periodo.
   *
   * `null` en el último: su duración no se sabe hasta que empiece el próximo,
   * y rellenarla con la media sería guardar una estimación como si fuera un
   * hecho. Es la misma disciplina que impone la columna `cycle_days` en la
   * migración 018.
   */
  duracionCiclo: number | null
  /** `true` si lo declaró la usuaria; `false` si lo dedujo el sistema. */
  declarado: boolean
}

/** Sangrado que aparece lejos del periodo. Se informa, no se convierte en ciclo. */
export interface SangradoIntermenstrual {
  fecha: string
  /** Día de ciclo en que ocurrió, contando desde el periodo anterior. */
  diaDeCiclo: number
}

export interface Derivacion {
  periodos: Periodo[]
  intermenstrual: SangradoIntermenstrual[]
}

/** Los días con sangrado real, ordenados. */
function diasConSangrado(logs: Record<string, RegistroDia>): string[] {
  return Object.keys(logs)
    .filter(f => {
      const s = logs[f]?.sangrado
      /* La CUARTA guarda contra el periodo fantasma, y la única que no deduce
         el motor: la declara ella. Un sangrado moderado a mitad de ciclo
         abriría un periodo y hundiría todas las medias; marcado como «fuera
         del periodo», se guarda el sangrado pero no cuenta para deducir. */
      if (s?.fueraDePeriodo) return false
      return s != null && s.level >= SANGRADO_MINIMO
    })
    .sort()
}

/**
 * Reconstruye los periodos a partir del registro diario.
 *
 * @param logs      registro completo, indexado por fecha local
 * @param declarados fechas que la usuaria marcó a mano como inicio de regla.
 *                   Ganan siempre: si dice que le bajó el día 3, le bajó el
 *                   día 3, aunque el sangrado de ese día no llegara al umbral.
 */
export function derivarPeriodos(
  logs: Record<string, RegistroDia>,
  declarados: string[] = [],
): Derivacion {
  /* La REGLA vive en el núcleo compartido con el servidor; aquí solo se
     traduce la forma de los datos. Antes estaba escrita entera en este archivo
     y en `backend/src/utils/ciclo.ts`, y las dos versiones YA no coincidían:
     el servidor miraba solo la separación entre días con sangrado y se saltaba
     la guarda del día 15 desde el inicio, así que un manchado a los cuatro
     días le abría un periodo que la app no abría. */
  const { periodos: grupos, intermenstrual } = agruparPeriodos(
    diasConSangrado(logs), declarados)

  const periodos: Periodo[] = grupos.map(g => ({
    inicio: g.inicio,
    fin: g.fin,
    diasSangrado: g.diasSangrado,
    duracionCiclo: null,
    declarado: g.declarado,
  }))
  if (!periodos.length) return { periodos: [], intermenstrual: [] }

  // La duración de cada ciclo se conoce al saber cuándo empezó el siguiente.
  for (let i = 0; i < periodos.length - 1; i++) {
    periodos[i].duracionCiclo = diasEntre(periodos[i].inicio, periodos[i + 1].inicio)
  }

  /* El último periodo puede seguir en curso. Se marca `fin: null` solo si el
     sangrado llega hasta el borde del registro; si dejó de sangrar hace días,
     ese periodo terminó aunque el ciclo siga. */
  const ult = periodos[periodos.length - 1]
  const hoy = Object.keys(logs).sort().pop()
  if (ult.fin && hoy && diasEntre(ult.fin, hoy) <= 1) ult.fin = null

  return { periodos, intermenstrual }
}

/**
 * El periodo en curso, o el último cerrado.
 *
 * Es el ancla de todo lo demás: el día de ciclo se cuenta desde aquí.
 */
export function periodoActual(periodos: Periodo[]): Periodo | null {
  return periodos.length ? periodos[periodos.length - 1] : null
}

/**
 * Qué día de ciclo es una fecha.
 *
 * Devuelve `null` si la fecha es anterior al primer periodo conocido: sin un
 * inicio del que contar, cualquier número sería inventado.
 */
export function diaDeCiclo(periodos: Periodo[], fecha: string): number | null {
  for (let i = periodos.length - 1; i >= 0; i--) {
    const d = diasEntre(periodos[i].inicio, fecha)
    if (d >= 0) return d + 1
  }
  return null
}
