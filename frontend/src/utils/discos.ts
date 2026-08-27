/**
 * CALCULADORA DE DISCOS
 * ─────────────────────
 * Qué discos poner a cada lado de la barra para llegar a un peso.
 *
 * Parece una tontería hasta que estás en el gimnasio con 87,5 kg en la hoja y
 * la barra delante. Es la cuenta que todo el mundo hace mal a la cuarta serie,
 * cuando ya no queda cabeza para dividir entre dos.
 *
 * ── Por qué «por lado» y no «en total» ──────────────────────────────────────
 * Porque es lo que se hace con las manos. Nadie carga «cuarenta kilos de
 * discos»: coge un veinte y lo mete a la izquierda, coge otro y lo mete a la
 * derecha. Enseñar el total obliga a dividir entre dos cada vez.
 */

/** Barras que hay en un gimnasio, en kilos. */
export const BARRAS = [
  { id: 'olimpica',  label: 'Olímpica',   kg: 20 },
  { id: 'mujer',     label: 'Olímpica 15', kg: 15 },
  { id: 'corta',     label: 'Corta / Z',  kg: 10 },
  { id: 'sin',       label: 'Sin barra',  kg: 0 },
] as const

export type BarraId = typeof BARRAS[number]['id']

/**
 * Los discos, de mayor a menor.
 *
 * El orden IMPORTA: el reparto va cogiendo el más grande que quepa, y con esta
 * serie eso da siempre la solución con menos discos y sin sobrante, porque cada
 * disco es múltiplo del siguiente o se completa con los de abajo. Cambiar el
 * orden rompe las dos cosas a la vez.
 */
export const DISCOS_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const

/** Color de cada disco, como en un gimnasio de verdad. */
export const COLOR_DISCO: Record<number, string> = {
  25: '#FF5C00',   // rojo
  20: '#2F6FED',   // azul
  15: '#F5B31F',   // amarillo
  10: '#22B07D',   // verde
  5:  '#F2F3F5',   // blanco
  2.5: '#A1A3A9',  // acero
  1.25: '#5C5F66', // acero oscuro
}

export interface Disco {
  kg: number
  /** Cuántos de ese disco van EN CADA LADO. */
  n: number
}

export interface Reparto {
  /** Los discos de un lado. El otro lado es igual. */
  porLado: Disco[]
  /** Kilos que caen a cada lado. */
  kgPorLado: number
  /** Lo que pesa la barra cargada de verdad. */
  total: number
  /** Lo que se pedía. */
  objetivo: number
  /**
   * Lo que falta para el objetivo. Cero cuando cuadra exacto.
   * Se dice en vez de callarlo: quien pide 91 kg tiene derecho a saber que con
   * discos normales se queda en 90 y no ha cargado mal.
   */
  falta: number
  /** El objetivo no llega ni al peso de la barra vacía. */
  menorQueLaBarra: boolean
}

/**
 * Reparte el peso objetivo en discos por lado.
 *
 * Solo cuenta con discos que existan en PAREJA: no se carga un lado más que el
 * otro. Por eso se calcula sobre la mitad del peso que va sin contar la barra,
 * y lo que sobra se informa en vez de repartirse a ojo.
 */
export function repartirDiscos(
  objetivo: number,
  barraKg: number,
  discos: readonly number[] = DISCOS_KG,
): Reparto {
  const vacio: Reparto = {
    porLado: [], kgPorLado: 0, total: barraKg, objetivo,
    falta: Math.max(0, objetivo - barraKg), menorQueLaBarra: objetivo < barraKg,
  }

  if (!Number.isFinite(objetivo) || objetivo <= 0) return { ...vacio, falta: 0 }
  if (objetivo < barraKg) return vacio
  if (objetivo === barraKg) return { ...vacio, falta: 0 }

  let restaPorLado = (objetivo - barraKg) / 2
  const porLado: Disco[] = []

  for (const kg of [...discos].sort((a, b) => b - a)) {
    // El redondeo evita que 0.1 + 0.2 deje un residuo fantasma que meta un
    // disco de 1,25 donde no hace falta.
    const n = Math.floor(Math.round(restaPorLado * 1000) / 1000 / kg)
    if (n > 0) {
      porLado.push({ kg, n })
      restaPorLado = Math.round((restaPorLado - n * kg) * 1000) / 1000
    }
  }

  const kgPorLado = porLado.reduce((s, d) => s + d.kg * d.n, 0)
  const total = Math.round((barraKg + kgPorLado * 2) * 100) / 100

  return {
    porLado,
    kgPorLado: Math.round(kgPorLado * 100) / 100,
    total,
    objetivo,
    falta: Math.round((objetivo - total) * 100) / 100,
    menorQueLaBarra: false,
  }
}

/**
 * El peso cargable más cercano al objetivo, hacia abajo.
 *
 * Sirve para el botón de «ajustar»: quien teclea 91 kg quiere 90, no un aviso.
 */
export function pesoAlcanzable(objetivo: number, barraKg: number): number {
  return repartirDiscos(objetivo, barraKg).total
}

/** «2×20 · 1×10 · 1×2,5» — para decirlo en una línea. */
export function resumirReparto(r: Reparto): string {
  if (r.menorQueLaBarra) return 'Menos que la barra'
  if (r.porLado.length === 0) return 'Barra sola'
  return r.porLado
    .map(d => `${d.n}×${String(d.kg).replace('.', ',')}`)
    .join(' · ')
}
