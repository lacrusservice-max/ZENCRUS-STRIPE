/**
 * NÚCLEO DEL CICLO · LAS FASES
 * ═══════════════════════════════════════════════════════════════════════════
 * El cálculo de fases, en un solo sitio. Vivía copiado en la app y en el
 * servidor, y una copia que se toca sin la otra hace que ZENA hable de una
 * fase distinta a la que enseña la pantalla.
 *
 * ── Este archivo es la FUENTE. Las copias son generadas ────────────────────
 * `frontend/src/nucleo/` y `backend/src/nucleo/` se generan desde aquí con
 * `npm run nucleo` y llevan una cabecera que lo dice. No se editan: el
 * guardián `npm run nucleo:verificar` falla si difieren, y está enganchado al
 * `type-check` de los dos lados, así que una edición en el sitio equivocado no
 * llega a producción.
 *
 * ── Nada de imports fuera de aquí ──────────────────────────────────────────
 * Este archivo lo compilan dos cadenas distintas —Metro y tsc— con alias de
 * módulos distintos. Un solo `@/utils/...` lo rompería en uno de los dos, así
 * que todo lo que necesita está dentro.
 */

export type Fase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea'

/** El orden real del ciclo. Se usa para interpolar entre fases vecinas. */
export const ORDEN_FASES: Fase[] = ['menstrual', 'folicular', 'ovulatoria', 'lutea']

/** La fase que sigue. Cierra el círculo: después de lútea viene menstrual. */
export const faseSiguiente = (f: Fase): Fase =>
  ORDEN_FASES[(ORDEN_FASES.indexOf(f) + 1) % ORDEN_FASES.length]

/**
 * Ningún ciclo humano dura menos de esto.
 *
 * Es la guarda fuerte: un sangrado que aparece antes de este día pertenece al
 * ciclo en curso o es sangrado intermenstrual, pero no es una regla nueva.
 * Sin ella, dos días de manchado a mitad de mes bastarían para partir el ciclo
 * en dos y arruinar la media.
 */
export const CICLO_MIN = 15

/** Y ninguno dura más. Por encima, casi siempre falta un periodo por registrar. */
export const CICLO_MAX = 60

/**
 * A partir de qué nivel de sangrado se cuenta como regla.
 *
 * El manchado —nivel 1— NO abre periodo. Es la primera de las cuatro guardas
 * contra el periodo fantasma.
 */
export const SANGRADO_MINIMO = 2

/**
 * La duración de la fase lútea, en días.
 *
 * Es LA constante del módulo: todo se cuenta hacia atrás desde la regla
 * prevista porque la lútea es la parte estable del ciclo, mientras que la
 * folicular varía muchísimo entre personas. De ahí sale `Ovulación = C − 13`.
 *
 * El prompt maestro la fija en 13. La literatura la sitúa entre 12 y 14; 13 es
 * el centro y es el número con el que están calculadas las tablas de
 * referencia del documento, así que cambiarlo aquí descuadraría esas tablas.
 */
export const LUTEA = 13

/**
 * Los valores de la población, para cuando no hay historial.
 */
export const POBLACION = { duracion: 28, desviacion: 4, sangrado: 5, lutea: LUTEA } as const

export interface MarcoFases {
  duracion: number
  diasPeriodo: number
  /** Día de ciclo en que se estima la ovulación. */
  diaOvulacion: number
  /** Día en que empieza cada fase. */
  limites: Record<Fase, number>
  /** Primer y último día de la ventana fértil: [Ov−5, Ov+1]. */
  ventanaFertil: [number, number]
}

/**
 * Las fases se calculan sobre SU ciclo, no sobre el día 14 de nadie.
 *
 * Este es el error más extendido de la categoría: fijar la ovulación en el día
 * 14 porque es lo que toca en un ciclo de 28. En un ciclo de 34 días la
 * ovulación cae cerca del día 20, y una app que insista en el 14 le enseña la
 * ventana fértil casi una semana antes de tiempo.
 *
 * Lo que de verdad es estable es la fase lútea —de la ovulación a la regla,
 * unos catorce días—, así que se cuenta hacia atrás desde el final. Se acota a
 * un mínimo de ocho días de fase folicular para que en ciclos muy cortos la
 * ovulación no acabe cayendo dentro del sangrado.
 */
export function marcoFases(duracion: number, diasPeriodo: number): MarcoFases {
  const dur = Math.max(CICLO_MIN, Math.min(CICLO_MAX, Math.round(duracion)))
  const periodo = Math.max(1, Math.min(10, Math.round(diasPeriodo)))

  /* `Ovulación = C − 13`, acotada para que en ciclos muy cortos no caiga dentro
     del sangrado ni deje la folicular en nada. */
  const diaOvulacion = Math.max(periodo + 2, dur - LUTEA)

  return {
    duracion: dur,
    diasPeriodo: periodo,
    diaOvulacion,
    /* La fase ovulatoria es UN día: el de la ovulación estimada.
       La ventana fértil —seis días— es otra cosa y va aparte, porque se
       superpone con el final de la folicular y el principio de la lútea. Meter
       las dos ideas en el mismo tramo es lo que hacía que el arco «ovulatoria»
       midiera seis días y la ovulación pareciera durar una semana. */
    limites: {
      menstrual: 1,
      folicular: periodo + 1,
      ovulatoria: diaOvulacion,
      lutea: diaOvulacion + 1,
    },
    ventanaFertil: [Math.max(1, diaOvulacion - 5), Math.min(dur, diaOvulacion + 1)],
  }
}

/**
 * ¿Cae este día de ciclo dentro de la ventana fértil?
 *
 * Función única, compartida por rueda, calendario y estadísticas. Reimplantarla
 * en cada pantalla es la causa más común de que el calendario y el anillo
 * pinten días distintos.
 */
export function enVentanaFertil(dia: number, marco: MarcoFases): boolean {
  return dia >= marco.ventanaFertil[0] && dia <= marco.ventanaFertil[1]
}

/**
 * La opacidad del degradado del sangrado.
 *
 * Día 1 sólido, último día muy desvanecido. Comunica de un vistazo que el flujo
 * baja, que es información real y no decoración.
 *
 *     opacidad(n) = 1 − ((n−1) / (D−1)) × 0.75
 */
export function opacidadDegradado(diaDeSangrado: number, diasPeriodo: number): number {
  if (diasPeriodo <= 1) return 1
  const n = Math.max(1, Math.min(diasPeriodo, diaDeSangrado))
  return 1 - ((n - 1) / (diasPeriodo - 1)) * 0.75
}

/** Lo registrado se ve entero; lo previsto, a media luz. */
export const FACTOR_ESTADO = { registrado: 1, predicho: 0.55 } as const

export type Regularidad = 'sin_datos' | 'muy_regular' | 'regular' | 'algo_irregular' | 'irregular'

/**
 * Cuatro niveles según la desviación estándar de las duraciones.
 *
 * Función única: la usan la predicción —para decidir si enseña fecha puntual o
 * rango— y las estadísticas. Con menos de tres ciclos no se clasifica, porque
 * una desviación calculada sobre dos números no significa nada.
 */
export function clasificarRegularidad(sd: number | null, ciclos: number): Regularidad {
  if (sd === null || ciclos < 3) return 'sin_datos'
  if (sd <= 2) return 'muy_regular'
  if (sd <= 4) return 'regular'
  if (sd <= 7) return 'algo_irregular'
  return 'irregular'
}

/**
 * Cuántos días de margen se enseñan a cada lado, según la regularidad.
 *
 *   Muy regular    → 0, fecha puntual
 *   Regular        → ±2
 *   Algo irregular → ±SD
 *   Irregular      → ±SD, y la pantalla añade sugerencia de consulta
 */
export function margenSegunRegularidad(r: Regularidad, sd: number | null): number {
  if (r === 'muy_regular') return 0
  if (r === 'regular') return 2
  return Math.max(2, Math.round(sd ?? POBLACION.desviacion))
}

/** La fase de un día de ciclo dentro de su marco. */
export function faseDeDia(dia: number, marco: MarcoFases): Fase {
  const l = marco.limites
  if (dia >= l.lutea) return 'lutea'
  if (dia >= l.ovulatoria) return 'ovulatoria'
  if (dia >= l.folicular) return 'folicular'
  return 'menstrual'
}

/** Días sin sangrado que cierran una menstruación. */
export const SEPARACION_MIN = 3

export interface GrupoPeriodo {
  inicio: string
  fin: string
  /** Días CON sangrado, no días transcurridos. */
  diasSangrado: number
  declarado: boolean
}

export interface SangradoSuelto {
  fecha: string
  /** Día de ciclo en que ocurrió, contando desde el inicio del periodo. */
  diaDeCiclo: number
}

/**
 * Agrupa días sueltos de sangrado en periodos.
 *
 * Recibe fechas ya filtradas —quien llama decide qué cuenta como sangrado— y
 * aplica las guardas. Se separa así porque cada lado guarda los registros con
 * una forma distinta: la app un mapa por fecha, el servidor filas. La REGLA es
 * la misma y vive aquí; la traducción, en cada lado.
 *
 * ── Las tres guardas contra el periodo fantasma ────────────────────────────
 * 1. El manchado no abre periodo. Esa la aplica quien llama, al filtrar por
 *    `SANGRADO_MINIMO`.
 * 2. Nada nuevo antes del día 15 CONTANDO DESDE EL INICIO del periodo en
 *    curso, no desde el último día con sangrado. Es la diferencia que hacía
 *    que el servidor y la app no coincidieran: mirar solo la separación
 *    convierte cualquier manchado a los cuatro días en una regla nueva.
 * 3. La separación se cuenta de día CON sangrado a día CON sangrado, no
 *    contando días sin registro. Confundirlo parte periodos cada vez que
 *    alguien se salta un día, y con periodos partidos las medias se hunden.
 *
 * ── Y lo que no abre periodo tampoco se tira ───────────────────────────────
 * El sangrado que aparece lejos del periodo se devuelve aparte: es justo el
 * dato que interesa llevar a una consulta médica, y borrarlo por no encajar
 * sería perder lo más informativo del historial.
 */
export function agruparPeriodos(
  diasConSangrado: string[],
  declarados: string[] = [],
): { periodos: GrupoPeriodo[]; intermenstrual: SangradoSuelto[] } {
  const forzados = new Set(declarados)
  // Un inicio declarado que no tiene sangrado apuntado sigue siendo un inicio.
  const dias = [...new Set([...diasConSangrado, ...declarados])].sort()
  if (!dias.length) return { periodos: [], intermenstrual: [] }

  const periodos: GrupoPeriodo[] = []
  const intermenstrual: SangradoSuelto[] = []

  let inicio = dias[0]
  let ultimo = dias[0]
  let cuenta = 1

  const cerrar = (fin: string, n: number) => {
    periodos.push({ inicio, fin, diasSangrado: n, declarado: forzados.has(inicio) })
  }

  for (let i = 1; i < dias.length; i++) {
    const dia = dias[i]
    const separacion = diasEntreFechas(ultimo, dia)
    const desdeInicio = diasEntreFechas(inicio, dia)

    /* Un inicio declarado abre periodo aunque caiga antes del mínimo: la
       usuaria sabe de su cuerpo más que la guarda. */
    const nuevo = forzados.has(dia)
      || (separacion >= SEPARACION_MIN && desdeInicio >= CICLO_MIN)

    if (nuevo) {
      cerrar(ultimo, cuenta)
      inicio = dia
      ultimo = dia
      cuenta = 1
      continue
    }

    if (separacion >= SEPARACION_MIN) {
      intermenstrual.push({ fecha: dia, diaDeCiclo: desdeInicio + 1 })
      continue
    }

    ultimo = dia
    cuenta++
  }

  cerrar(ultimo, cuenta)
  return { periodos, intermenstrual }
}

/**
 * Días enteros entre dos fechas `YYYY-MM-DD`.
 *
 * Se construyen a mediodía UTC a propósito. Con medianoche, un cambio de
 * horario de verano hace que un «día» dure 23 o 25 horas y la resta se
 * redondea mal justo en los ciclos que cruzan el cambio de hora.
 */
export function diasEntreFechas(a: string, b: string): number {
  const ms = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10), 12)
    - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10), 12)
  return Math.round(ms / 86_400_000)
}
