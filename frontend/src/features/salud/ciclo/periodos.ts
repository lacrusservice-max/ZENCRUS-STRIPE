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
import type { RegistroDia } from '@/store/cicloStore'

/**
 * A partir de aquí cuenta como menstruación.
 *
 * El nivel 1 es manchado y NO abre un periodo: el manchado a mitad de ciclo es
 * común —ovulación, implantación, un DIU asentándose— y tratarlo como regla
 * fabricaría un ciclo de quince días que nunca ocurrió.
 */
export const SANGRADO_MINIMO = 2

/** Días sin sangrado que cierran una menstruación. */
const SEPARACION_MIN = 3

/**
 * Ningún ciclo humano dura menos de esto.
 *
 * Es la guarda fuerte: un sangrado que aparece antes de este día pertenece al
 * ciclo en curso o es sangrado intermenstrual, pero no es una regla nueva.
 * Sin esta guarda, dos días de manchado a mitad de mes bastarían para partir
 * el ciclo en dos y arruinar la media.
 */
export const CICLO_MIN = 15

/** Y ninguno dura más. Por encima, casi siempre falta un periodo por registrar. */
export const CICLO_MAX = 60

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
  const sangrado = diasConSangrado(logs)
  const forzados = new Set(declarados)

  // Un inicio declarado que no tiene sangrado apuntado sigue siendo un inicio.
  const dias = [...new Set([...sangrado, ...declarados])].sort()
  if (!dias.length) return { periodos: [], intermenstrual: [] }

  const periodos: Periodo[] = []
  const intermenstrual: SangradoIntermenstrual[] = []

  let inicio = dias[0]
  let ultimo = dias[0]
  let cuenta = 1

  const cerrar = (fin: string, dias_: number) => {
    periodos.push({
      inicio,
      fin,
      diasSangrado: dias_,
      duracionCiclo: null,
      declarado: forzados.has(inicio),
    })
  }

  for (let i = 1; i < dias.length; i++) {
    const dia = dias[i]
    const separacion = diasEntre(ultimo, dia)
    const desdeInicio = diasEntre(inicio, dia)

    const declarado = forzados.has(dia)
    // Un inicio declarado abre periodo aunque caiga antes del mínimo: la
    // usuaria sabe de su cuerpo más que la guarda.
    const nuevo = declarado || (separacion >= SEPARACION_MIN && desdeInicio >= CICLO_MIN)

    if (nuevo) {
      cerrar(ultimo, cuenta)
      inicio = dia
      ultimo = dia
      cuenta = 1
      continue
    }

    if (separacion >= SEPARACION_MIN) {
      /* Sangrado suelto dentro del mismo ciclo. No abre periodo —la guarda de
         CICLO_MIN lo impide— pero tampoco se tira: es justo el dato que
         interesa llevar a una consulta. */
      intermenstrual.push({ fecha: dia, diaDeCiclo: desdeInicio + 1 })
      continue
    }

    ultimo = dia
    cuenta++
  }

  cerrar(ultimo, cuenta)

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
