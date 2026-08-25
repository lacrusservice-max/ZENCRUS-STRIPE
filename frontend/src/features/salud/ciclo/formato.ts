/**
 * FECHAS EN CASTELLANO, SIN LIBRERÍA
 * ═══════════════════════════════════════════════════════════════════════════
 * Formatear cuatro fechas no justifica meter `date-fns` con su locale en el
 * paquete. Y `toLocaleDateString` tampoco vale aquí: en Android depende de los
 * datos ICU del dispositivo, así que la misma pantalla dice «sept» en un
 * teléfono y «sep.» en otro.
 *
 * Todo trabaja sobre `YYYY-MM-DD` y nunca sobre `Date`, por la razón que ya
 * documenta `utils/fechas.ts`: construir un `Date` a partir de una fecha suelta
 * abre la puerta a que el huso horario la mueva un día.
 */

const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
] as const

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const

/** Semana que empieza en lunes, como en España y en casi toda Latinoamérica. */
export const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

const partes = (f: string) => f.split('-').map(Number) as [number, number, number]

/** «12 sep» */
export function diaCorto(fecha: string): string {
  const [, m, d] = partes(fecha)
  return `${d} ${MESES_CORTOS[m - 1]}`
}

/** «12 de septiembre» */
export function diaLargo(fecha: string): string {
  const [, m, d] = partes(fecha)
  return `${d} de ${MESES[m - 1]}`
}

export const nombreMes = (mes: number): string => MESES[mes - 1]

/**
 * «entre el 12 y el 16 de sep», y «el 12 de sep» si los dos extremos coinciden.
 *
 * Que el caso de un solo día tenga su redacción importa: «entre el 12 y el 12»
 * es la clase de frase que delata que nadie leyó la pantalla.
 */
export function rangoCorto(desde: string, hasta: string): string {
  if (desde === hasta) return `el ${diaCorto(desde)}`
  const [, m1, d1] = partes(desde)
  const [, m2, d2] = partes(hasta)
  return m1 === m2
    ? `entre el ${d1} y el ${d2} de ${MESES_CORTOS[m1 - 1]}`
    : `entre el ${d1} de ${MESES_CORTOS[m1 - 1]} y el ${d2} de ${MESES_CORTOS[m2 - 1]}`
}

/** Día de la semana (0 = lunes). Se calcula en UTC para que no lo mueva el huso. */
export function diaSemana(fecha: string): number {
  const [a, m, d] = partes(fecha)
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7
}

/** Días que tiene un mes. */
export const diasDelMes = (año: number, mes: number): number =>
  new Date(Date.UTC(año, mes, 0)).getUTCDate()
