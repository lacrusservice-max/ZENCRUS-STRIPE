/**
 * MOTOR DE PREDICCIÓN DEL CICLO
 * ═══════════════════════════════════════════════════════════════════════════
 * Lógica pura, sin React, sin red y sin fechas del sistema salvo las que se le
 * pasan. Todo lo que decide este archivo se puede probar con una tabla de
 * entradas y salidas, y por eso tiene pruebas de verdad: es el único sitio del
 * módulo donde un error no se ve en pantalla, se ve en la vida de alguien que
 * planificó un viaje con una fecha equivocada.
 *
 * ── La única regla no negociable ───────────────────────────────────────────
 * **Ninguna predicción sale de aquí sin su banda y su confianza.**
 *
 * Flo, Clue, Ovia y todas las demás dan una fecha exacta. Es cómodo y es
 * matemáticamente deshonesto: con una variabilidad típica de tres o cuatro
 * días, decir «te baja el 14» finge una precisión que el dato no tiene. Aquí
 * la banda es el producto — su anchura es lo que dibuja La Cinta— y la fecha
 * central es solo el punto medio de esa banda.
 *
 * ── Cómo se construye el intervalo ─────────────────────────────────────────
 * Un intervalo de PREDICCIÓN, no de la media. Son cosas distintas y la
 * diferencia importa: no se busca «dónde está el promedio de sus ciclos» sino
 * «dónde va a caer el PRÓXIMO», que es más ancho.
 *
 *     banda = media ± t(0,90; n-1) · s · √(1 + 1/n)
 *
 * El `√(1 + 1/n)` es lo que separa un intervalo de predicción de uno de
 * confianza, y el t de Student —en vez del 1,282 de la normal— es lo que
 * ensancha la banda cuando hay pocos ciclos. Con tres ciclos la banda sale
 * ancha porque con tres ciclos NO SE SABE, y esconderlo con una normal sería
 * volver a mentir con otra cara.
 *
 * ── Lo que este archivo NO es ──────────────────────────────────────────────
 * No es un método anticonceptivo. Natural Cycles tiene autorización de la FDA
 * para presentarse así; ZENCRUS no la tiene y no puede insinuarlo. La ventana
 * fértil que se calcula aquí es informativa y así se etiqueta en pantalla.
 */

import { sumarDias, diasEntre } from '@/utils/fechas'
import type { Phase } from './fases'
import type { Periodo } from './periodos'
import { CICLO_MIN, CICLO_MAX } from './periodos'

export const MODELO = 'ciclo-v1'

/** Cuántos ciclos mira hacia atrás. */
const VENTANA = 12

/**
 * A partir de aquí el modelo se considera fundado.
 *
 * No es un número redondo elegido a ojo: con dos ciclos hay una sola
 * diferencia entre ellos y la desviación típica no existe. Tres es el mínimo
 * para que la dispersión signifique algo, y es el mismo umbral que la
 * migración 018 impone en duro sobre `cycle_correlations.sample_size`.
 */
export const CICLOS_PARA_FUNDAR = 3

/** Medias poblacionales. Solo para el arranque, y siempre etiquetadas como tales. */
const POBLACION = { duracion: 28, desviacion: 4, sangrado: 5, lutea: 14 } as const

/**
 * Cuantil t de Student al 90 % de una cola (banda del 80 % a dos colas).
 *
 * Se tabula en vez de aproximarse porque la tabla es corta y exacta, y porque
 * la aproximación normal justo donde importa —con tres o cuatro ciclos— se
 * queda corta casi un 30 %.
 */
const T90: Record<number, number> = {
  1: 3.078, 2: 1.886, 3: 1.638, 4: 1.533, 5: 1.476, 6: 1.440, 7: 1.415,
  8: 1.397, 9: 1.383, 10: 1.372, 11: 1.363, 12: 1.356, 13: 1.350, 14: 1.345,
  15: 1.341, 16: 1.337, 17: 1.333, 18: 1.330, 19: 1.328, 20: 1.325,
}
const t90 = (gl: number): number =>
  gl <= 0 ? T90[1] : T90[gl] ?? (gl <= 30 ? 1.310 : 1.282)

// ── Estadísticas ────────────────────────────────────────────────────────────

export type Regularidad = 'sin_datos' | 'regular' | 'algo_irregular' | 'irregular'

export interface Estadisticas {
  /** Ciclos completos que hay en el historial. */
  ciclos: number
  /** Cuántos entraron en el cálculo tras descartar atípicos. */
  usados: number
  media: number | null
  mediana: number | null
  desviacion: number | null
  masCorto: number | null
  masLargo: number | null
  mediaSangrado: number | null
  regularidad: Regularidad
}

const mediana = (xs: number[]): number => {
  const o = [...xs].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

export function estadisticas(periodos: Periodo[]): Estadisticas {
  const todas = periodos
    .map(p => p.duracionCiclo)
    .filter((d): d is number => d != null)

  /* Un ciclo fuera de [15, 60] casi nunca es un ciclo: es un periodo que no se
     registró. Se aparta del cálculo para que no arrastre la media, pero no se
     borra — sale como anomalía, que es donde sirve. */
  const validas = todas.filter(d => d >= CICLO_MIN && d <= CICLO_MAX)
  const recientes = validas.slice(-VENTANA)

  const sangrados = periodos.map(p => p.diasSangrado).filter(d => d > 0).slice(-VENTANA)
  const mediaSangrado = sangrados.length
    ? Math.round((sangrados.reduce((a, b) => a + b, 0) / sangrados.length) * 10) / 10
    : null

  if (!recientes.length) {
    return {
      ciclos: todas.length, usados: 0,
      media: null, mediana: null, desviacion: null,
      masCorto: null, masLargo: null, mediaSangrado,
      regularidad: 'sin_datos',
    }
  }

  const n = recientes.length
  const media = recientes.reduce((a, b) => a + b, 0) / n
  /* Desviación muestral (n-1). Con n=1 no hay dispersión que medir y se deja
     en null en vez de devolver 0, que se leería como «perfectamente regular». */
  const desviacion = n > 1
    ? Math.sqrt(recientes.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1))
    : null

  const regularidad: Regularidad =
    desviacion == null ? 'sin_datos'
      : desviacion <= 2 ? 'regular'
        : desviacion <= 5 ? 'algo_irregular'
          : 'irregular'

  return {
    ciclos: todas.length,
    usados: n,
    media: Math.round(media * 10) / 10,
    mediana: mediana(recientes),
    desviacion: desviacion == null ? null : Math.round(desviacion * 10) / 10,
    masCorto: Math.min(...recientes),
    masLargo: Math.max(...recientes),
    mediaSangrado,
    regularidad,
  }
}

// ── Confianza ───────────────────────────────────────────────────────────────

/**
 * De 0 a 100, y con las dos cosas que la determinan a la vista.
 *
 * Depende de cuántos ciclos hay (una muestra corta no sabe) y de lo regular
 * que sea el cuerpo (una muestra larga de ciclos dispares tampoco). No se
 * llega nunca a 100: un ciclo puede adelantarse por un viaje, una gripe o una
 * semana mala, y ninguna cantidad de historial lo impide.
 */
export function calcularConfianza(usados: number, desviacion: number | null): number {
  const sd = desviacion ?? POBLACION.desviacion
  const muestra = Math.min(1, usados / 6)
  const regular = Math.max(0, Math.min(1, 1 - (sd - 1) / 6))
  const c = Math.round(100 * (0.35 + 0.65 * muestra) * regular)
  return Math.max(5, Math.min(95, c))
}

export type NivelConfianza = 'muy baja' | 'baja' | 'media' | 'buena' | 'alta'

export const nivelConfianza = (c: number): NivelConfianza =>
  c < 30 ? 'muy baja' : c < 50 ? 'baja' : c < 70 ? 'media' : c < 85 ? 'buena' : 'alta'

/**
 * Qué confianza tendría con dos ciclos más.
 *
 * Existe para poder decir «registra dos ciclos más y sube a ~70 %» en vez de
 * enseñar un número bajo sin salida. Un dato que no dice qué hacer con él es
 * ruido.
 */
export const confianzaProyectada = (usados: number, desviacion: number | null, mas = 2): number =>
  calcularConfianza(usados + mas, desviacion)

// ── Fases ───────────────────────────────────────────────────────────────────

export interface MarcoFases {
  duracion: number
  diasPeriodo: number
  /** Día de ciclo en que se estima la ovulación. */
  diaOvulacion: number
  /** Día en que empieza cada fase. Es lo que consume La Cinta. */
  limites: Record<Phase, number>
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
  const diaOvulacion = Math.max(periodo + 3, Math.min(dur - 8, dur - POBLACION.lutea))

  return {
    duracion: dur,
    diasPeriodo: periodo,
    diaOvulacion,
    limites: {
      menstrual: 1,
      folicular: periodo + 1,
      // Cinco días alrededor de la ovulación: es una estimación, no un instante.
      ovulatoria: Math.max(periodo + 1, diaOvulacion - 2),
      lutea: diaOvulacion + 3,
    },
  }
}

/** La fase de un día de ciclo dentro de su marco. */
export function faseDeDia(dia: number, marco: MarcoFases): Phase {
  const l = marco.limites
  if (dia >= l.lutea) return 'lutea'
  if (dia >= l.ovulatoria) return 'ovulatoria'
  if (dia >= l.folicular) return 'folicular'
  return 'menstrual'
}

// ── Predicción ──────────────────────────────────────────────────────────────

export interface Banda {
  low: string
  likely: string
  high: string
}

export interface Prediccion {
  modelo: string
  proximoPeriodo: Banda
  /** Medio ancho de la banda, en días. Es lo que dibuja La Cinta. */
  margenDias: number
  ovulacion: Banda | null
  /** Informativa. NUNCA como método anticonceptivo. */
  ventanaFertil: { inicio: string; fin: string } | null
  confianza: number
  ciclosUsados: number
  /** Duración con la que se calculó, y si salió de su historial o de la población. */
  duracionUsada: number
  fuenteDuracion: 'personal' | 'poblacional'
  marco: MarcoFases
  /** Día de ciclo de la fecha de referencia. */
  diaDeCiclo: number
  fase: Phase
  /** Días de retraso respecto al día probable. 0 si aún no ha llegado. */
  retraso: number
  /** Por qué no se predice ovulación, si es el caso. */
  motivoSuprimido: string | null
}

export interface OpcionesPrediccion {
  /** Fecha de referencia. Se pasa siempre: este módulo no lee el reloj. */
  hoy: string
  /**
   * Anticoncepción hormonal continua o modos sin ovulación.
   * El sangrado por deprivación no es una regla y no hay ovulación que
   * predecir: se dice, en vez de callarse y dar un número inventado.
   */
  sinOvulacion?: boolean
}

/**
 * La predicción completa, o `null` si no hay ni un periodo del que partir.
 *
 * Devolver `null` es parte del diseño: sin un solo inicio de regla no hay nada
 * honesto que enseñar, y la pantalla tiene un estado vacío para eso. Rellenar
 * el hueco con la media poblacional presentada como suya es exactamente lo que
 * este módulo existe para no hacer.
 */
export function predecir(
  periodos: Periodo[],
  opts: OpcionesPrediccion,
): Prediccion | null {
  const ultimo = periodos[periodos.length - 1]
  if (!ultimo) return null

  const est = estadisticas(periodos)

  const personal = est.usados >= 1 && est.media != null
  const duracion = personal ? est.media! : POBLACION.duracion
  const sd = est.desviacion ?? POBLACION.desviacion
  const n = Math.max(1, est.usados)

  /* Intervalo de PREDICCIÓN, no de la media: el √(1 + 1/n) es lo que lo
     distingue, y con pocos ciclos es justo lo que evita una banda falsamente
     estrecha. */
  const margenCrudo = t90(n - 1) * sd * Math.sqrt(1 + 1 / n)

  /* Suelo de un día: ningún cuerpo funciona con precisión de reloj y una banda
     de cero días volvería a ser la fecha exacta que este módulo evita.
     Techo de siete: por encima, la banda deja de ser información y la pantalla
     debe decir «demasiado irregular para predecir» en vez de pintar dos
     semanas de incertidumbre. */
  const margenDias = Math.max(1, Math.min(7, Math.round(margenCrudo)))

  const likely = sumarDias(ultimo.inicio, Math.round(duracion))
  const proximoPeriodo: Banda = {
    low: sumarDias(likely, -margenDias),
    likely,
    high: sumarDias(likely, margenDias),
  }

  const diasPeriodo = est.mediaSangrado ?? POBLACION.sangrado
  const marco = marcoFases(duracion, diasPeriodo)

  const transcurridos = diasEntre(ultimo.inicio, opts.hoy)
  const diaDeCiclo = transcurridos + 1
  /* Si ya se pasó del ciclo, la fase se sigue calculando sobre el marco pero
     el día no se recorta: un día 34 de un ciclo de 28 es información —hay
     retraso— y aplastarlo a 28 la escondería. */
  const fase = faseDeDia(Math.min(diaDeCiclo, marco.duracion), marco)
  const retraso = Math.max(0, diasEntre(likely, opts.hoy))

  let ovulacion: Banda | null = null
  let ventanaFertil: { inicio: string; fin: string } | null = null
  let motivoSuprimido: string | null = null

  if (opts.sinOvulacion) {
    motivoSuprimido = 'Con anticoncepción hormonal continua no hay ovulación que estimar.'
  } else {
    /* La ovulación se cuenta hacia atrás desde la regla predicha, porque la
       fase lútea es la estable. Eso significa que hereda la incertidumbre de
       la predicción y le suma la suya: la banda es más ancha, no más
       estrecha, y así se dibuja. */
    const centro = sumarDias(ultimo.inicio, marco.diaOvulacion - 1)
    const margenOv = Math.min(9, margenDias + 2)
    ovulacion = {
      low: sumarDias(centro, -margenOv),
      likely: centro,
      high: sumarDias(centro, margenOv),
    }
    /* Cinco días antes por la supervivencia del espermatozoide y uno después
       por la del óvulo. Informativa: ver la cabecera del archivo. */
    ventanaFertil = {
      inicio: sumarDias(ovulacion.low, -5),
      fin: sumarDias(ovulacion.high, 1),
    }
  }

  return {
    modelo: MODELO,
    proximoPeriodo,
    margenDias,
    ovulacion,
    ventanaFertil,
    confianza: calcularConfianza(est.usados, est.desviacion),
    ciclosUsados: est.usados,
    duracionUsada: Math.round(duracion),
    fuenteDuracion: personal ? 'personal' : 'poblacional',
    marco,
    diaDeCiclo,
    fase,
    retraso,
    motivoSuprimido,
  }
}
