/**
 * TEMPERATURA BASAL · EL CAMBIO TÉRMICO
 * ═══════════════════════════════════════════════════════════════════════════
 * Tras la ovulación, la progesterona sube la temperatura basal unas dos
 * décimas y la mantiene alta hasta la regla. Ese escalón es la única señal que
 * una app puede usar para CONFIRMAR que hubo ovulación, y solo mirando hacia
 * atrás: cuando se ve, ya pasó.
 *
 * ── Confirmar no es predecir ───────────────────────────────────────────────
 * Es la distinción que sostiene todo este archivo. La temperatura no dice
 * cuándo vas a ovular, dice que ovulaste. Presentar lo primero es lo que
 * convierte un registro de temperatura en un método anticonceptivo, y para eso
 * hace falta la autorización sanitaria que ZENCRUS no tiene.
 *
 * ── La regla de los tres sobre seis ────────────────────────────────────────
 * Es el criterio clásico del método sintotérmico, y se implementa tal cual
 * porque es el que entienden los profesionales que van a leer el informe:
 *
 *   1. Se traza la línea de cobertura en el máximo de las seis temperaturas
 *      anteriores, más 0,05 °C.
 *   2. Hacen falta tres lecturas consecutivas por encima de esa línea.
 *   3. Al menos una de las tres —la tercera— debe superarla por 0,2 °C.
 *
 * ── Los dos decimales no son un capricho ───────────────────────────────────
 * El escalón entero mide unas dos décimas. Con un solo decimal la señal se
 * pierde en el redondeo y este archivo no puede confirmar nada. Por eso el
 * esquema del tracker pide dos y el mando de entrada los exige.
 *
 * ── Las noches malas se apartan ────────────────────────────────────────────
 * Fiebre, alcohol, dormir mal o tomar la temperatura a otra hora suben la
 * lectura sin que haya ovulado nadie. Quien marca `disturbed` está diciendo
 * «esta no cuenta», y hacerle caso es la diferencia entre un detector que
 * sirve y uno que se dispara solo.
 */

/** Cuántas lecturas previas forman la línea de cobertura. */
const BASE = 6
/** Cuántas lecturas altas seguidas hacen falta. */
const ALTAS = 3
/** Margen sobre el máximo previo, en grados. */
const MARGEN_LINEA = 0.05
/** Cuánto debe superar la línea la tercera lectura. */
const SALTO_MINIMO = 0.2

export interface LecturaTemperatura {
  fecha: string
  celsius: number
  /** Noche mala, fiebre, alcohol, hora distinta. No entra en el cálculo. */
  disturbed?: boolean
}

export interface CambioTermico {
  /**
   * Índice, dentro de las lecturas VÁLIDAS, de la primera lectura alta.
   * La ovulación se sitúa el día anterior a esa primera subida.
   */
  indicePrimeraAlta: number
  /** Fecha en que se estima que ocurrió la ovulación. */
  fechaOvulacion: string
  /** Fecha en la que el cambio quedó confirmado (la tercera alta). */
  fechaConfirmacion: string
  /** Temperatura de la línea de cobertura. */
  lineaCobertura: number
  /** Cuánto subió, en grados, respecto a la línea. */
  salto: number
}

/** Solo las lecturas que cuentan, en orden. */
export const lecturasValidas = (xs: LecturaTemperatura[]): LecturaTemperatura[] =>
  xs.filter(x => !x.disturbed).sort((a, b) => a.fecha.localeCompare(b.fecha))

/**
 * Busca el cambio térmico y devuelve el PRIMERO del rango, o `null`.
 *
 * El primero y no el último: dentro de un ciclo solo hay una ovulación, y si
 * la temperatura vuelve a subir más tarde es ruido —una noche mala que se
 * coló, un resfriado— y no una segunda ovulación.
 */
export function detectarCambioTermico(lecturas: LecturaTemperatura[]): CambioTermico | null {
  const v = lecturasValidas(lecturas)
  if (v.length < BASE + ALTAS) return null

  for (let i = BASE; i <= v.length - ALTAS; i++) {
    const previas = v.slice(i - BASE, i)
    const linea = Math.max(...previas.map(p => p.celsius)) + MARGEN_LINEA
    const tres = v.slice(i, i + ALTAS)

    if (!tres.every(t => t.celsius > linea)) continue
    // El escalón tiene que ser un escalón, no tres lecturas rozando la línea.
    if (tres[ALTAS - 1].celsius < linea + SALTO_MINIMO) continue

    return {
      indicePrimeraAlta: i,
      /* La ovulación ocurre ANTES de la subida: la progesterona tarda en
         calentar. El día previo a la primera lectura alta es la convención
         del método y la que espera cualquiera que lea el informe. */
      fechaOvulacion: v[i - 1].fecha,
      fechaConfirmacion: tres[ALTAS - 1].fecha,
      lineaCobertura: Math.round(linea * 100) / 100,
      salto: Math.round((tres[ALTAS - 1].celsius - linea) * 100) / 100,
    }
  }

  return null
}

/**
 * La curva tal y como se dibuja: dos tramos, antes y después del escalón.
 *
 * Se devuelve partida a propósito. Una sola línea continua esconde justo lo
 * que hay que ver —que hay dos mesetas— y un ciclo bifásico dibujado como una
 * línea sola parece un garabato sin significado.
 */
export interface CurvaTemperatura {
  puntos: LecturaTemperatura[]
  cambio: CambioTermico | null
  /** Índice del primer punto de la fase alta, o `null` si no hubo cambio. */
  corte: number | null
  min: number
  max: number
}

export function curvaTemperatura(lecturas: LecturaTemperatura[]): CurvaTemperatura | null {
  const puntos = lecturasValidas(lecturas)
  if (!puntos.length) return null

  const cambio = detectarCambioTermico(lecturas)
  const temps = puntos.map(p => p.celsius)

  /* El eje se ajusta al rango real con un pequeño margen. Fijarlo de 35 a 40
     dejaría el escalón —dos décimas— aplastado contra una línea recta: el dato
     estaría, pero no se vería, que a efectos prácticos es lo mismo que no
     tenerlo. */
  return {
    puntos,
    cambio,
    corte: cambio ? cambio.indicePrimeraAlta : null,
    min: Math.min(...temps) - 0.1,
    max: Math.max(...temps) + 0.1,
  }
}
