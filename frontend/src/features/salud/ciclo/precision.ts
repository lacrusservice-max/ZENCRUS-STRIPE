/**
 * ¿ESTO SIRVE? — LA PRUEBA, NO LA PROMESA
 * ═══════════════════════════════════════════════════════════════════════════
 * Cuánto se equivoca la predicción, medido contra lo que pasó de verdad.
 *
 * ── Por qué existe este archivo ────────────────────────────────────────────
 * «¿Cómo sé que esta app acierta?» tiene dos respuestas posibles. Una es
 * decirle que confíe. La otra es enseñarle el número: por cuántos días falló
 * cada predicción, y si está mejorando. Solo la segunda se puede comprobar, y
 * es la única que se sostiene el día que falle.
 *
 * Ninguna app de ciclo enseña esto. No es casualidad: enseñarlo obliga a
 * acertar. Ese es exactamente el motivo por el que hay que enseñarlo.
 *
 * ── Cómo se mide: prediciendo el pasado ────────────────────────────────────
 * Para cada periodo del historial se vuelve a predecir usando SOLO lo que se
 * sabía antes de que ocurriera, y se compara con la fecha real. Es la única
 * forma honesta: medir la predicción con los datos que la incluyen sería
 * examinarse con las respuestas delante.
 *
 * ── El error se mide en días, con signo ────────────────────────────────────
 * Negativo = la app la esperaba antes de lo que llegó. Positivo = después.
 * El signo importa: equivocarse siempre hacia el mismo lado es un sesgo que se
 * puede corregir; equivocarse a los dos lados por igual es ruido, y es lo
 * mejor a lo que se puede aspirar.
 */

import { predecir } from './prediccion'
import type { Periodo } from './periodos'
import { diasEntre, sumarDias } from '@/utils/fechas'

/**
 * Cuántos periodos hacen falta para que `predecir` tenga algo que decir.
 *
 * Con uno solo no hay ninguna duración medida —la de un periodo se sabe cuando
 * empieza el siguiente—, así que la primera predicción comprobable es la del
 * tercero.
 */
const MUESTRA_PARA_PREDECIR = 2

/** Cuántas predicciones hacen falta para que la media signifique algo. */
export const MINIMO_PARA_MEDIR = 2

export interface Acierto {
  /** El periodo que se intentó predecir. */
  inicioReal: string
  inicioPrevisto: string
  /** Días de diferencia, con signo. */
  error: number
  /** ¿Cayó dentro de la banda que se enseñó? */
  dentroDeBanda: boolean
  /** Ancho de la banda que se enseñaba entonces, en días. */
  margen: number
}

export interface Precision {
  aciertos: Acierto[]
  /** Error medio absoluto, en días. `null` si no hay con qué medir. */
  errorMedio: number | null
  /** Sesgo: si es negativo, la app tiende a adelantarla. */
  sesgo: number | null
  /** Qué porcentaje cayó dentro de la banda que se enseñó. */
  dentroDeBanda: number | null
  /** El error de las últimas tres frente a las anteriores. `null` si no da. */
  mejorando: boolean | null
}

/**
 * Cómo de bien ha ido prediciendo hasta ahora.
 *
 * Solo mira periodos DEDUCIDOS del sangrado, no los declarados a mano: un
 * inicio que la propia usuaria corrigió no es una predicción acertada ni
 * fallada, es un dato que se le dio al motor.
 */
export function medirPrecision(periodos: Periodo[]): Precision {
  const vacio: Precision = {
    aciertos: [], errorMedio: null, sesgo: null, dentroDeBanda: null, mejorando: null,
  }
  if (periodos.length < MUESTRA_PARA_PREDECIR + 1) return vacio

  const aciertos: Acierto[] = []

  for (let i = MUESTRA_PARA_PREDECIR; i < periodos.length; i++) {
    const real = periodos[i]
    if (real.declarado) continue

    /* Lo que se sabía la víspera. El día de referencia es el anterior al
       inicio real: predecir DESDE el propio día que se quiere adivinar sería
       hacer trampas. */
    const anteriores = periodos.slice(0, i)
    const vispera = sumarDias(real.inicio, -1)

    const p = predecir(anteriores, { hoy: vispera })
    if (!p) continue

    aciertos.push({
      inicioReal: real.inicio,
      inicioPrevisto: p.proximoPeriodo.likely,
      error: diasEntre(p.proximoPeriodo.likely, real.inicio),
      dentroDeBanda: real.inicio >= p.proximoPeriodo.low && real.inicio <= p.proximoPeriodo.high,
      margen: p.margenDias,
    })
  }

  if (aciertos.length < MINIMO_PARA_MEDIR) return { ...vacio, aciertos }

  const errores = aciertos.map(a => a.error)
  const errorMedio = media(errores.map(Math.abs))
  const sesgo = media(errores)
  const dentro = aciertos.filter(a => a.dentroDeBanda).length / aciertos.length

  /* «Mejorando» solo se afirma con seis predicciones: con menos, comparar las
     tres últimas contra las anteriores es comparar ruido con ruido y saldría
     una flecha que sube o baja según el mes. */
  let mejorando: boolean | null = null
  if (aciertos.length >= 6) {
    const recientes = media(errores.slice(-3).map(Math.abs))
    const antiguos = media(errores.slice(0, -3).map(Math.abs))
    // Un cuarto de día de diferencia no es una mejora, es redondeo.
    if (Math.abs(recientes - antiguos) >= 0.25) mejorando = recientes < antiguos
  }

  return { aciertos, errorMedio, sesgo, dentroDeBanda: dentro, mejorando }
}

const media = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

/**
 * La frase que se enseña, ya escrita.
 *
 * Está aquí y no en la pantalla porque el reto es decir un número sin
 * presumir. «Acierto el 94 %» es marketing; «me equivoco por día y medio de
 * media» es el mismo dato dicho de forma que se puede comprobar — y que deja
 * a la usuaria decidir si le vale.
 */
export function frasePrecision(p: Precision): string {
  if (p.errorMedio === null) {
    const faltan = MUESTRA_PARA_PREDECIR + MINIMO_PARA_MEDIR - p.aciertos.length
    return faltan > 0
      ? 'Todavía no puedo decirte cuánto acierto: necesito unos ciclos más para poder comprobarme.'
      : 'Todavía no puedo decirte cuánto acierto.'
  }

  const e = p.errorMedio
  const redondo = e < 1 ? 'menos de un día' : `${e.toFixed(1).replace('.', ',')} días`
  const base = `De media me equivoco por ${redondo}, medido sobre ${p.aciertos.length} ${p.aciertos.length === 1 ? 'predicción' : 'predicciones'} tuyas.`

  const sesgo = p.sesgo !== null && Math.abs(p.sesgo) >= 1
    ? p.sesgo < 0
      ? ' Suelo esperarla antes de tiempo.'
      : ' Suelo esperarla más tarde de lo que llega.'
    : ''

  const tendencia = p.mejorando === true
    ? ' Y voy afinando: mis últimas predicciones fallan menos que las primeras.'
    : p.mejorando === false
      ? ' Últimamente fallo un poco más; suele pasar cuando el ciclo cambia de ritmo.'
      : ''

  return base + sesgo + tendencia
}
