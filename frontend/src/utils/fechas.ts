/**
 * EL DÍA DEL USUARIO
 * ──────────────────
 * Un solo sitio donde se decide qué día es hoy, y es el día del reloj de quien
 * usa la app.
 *
 * ── El error que esto arregla ───────────────────────────────────────────────
 * La app entera calculaba el día con `new Date().toISOString().slice(0, 10)`.
 * Eso NO da la fecha de hoy: da la fecha en UTC. En México —UTC-6— a partir de
 * las seis de la tarde devuelve el día siguiente.
 *
 * Lo que se veía: cenabas a las nueve, lo apuntabas, y la comida aparecía en el
 * diario de mañana. La racha se marcaba en un día que aún no había llegado. Un
 * hábito cumplido por la noche no salía en la rejilla de la semana. Y todo eso
 * solo después de cierta hora, que es lo que lo hacía parecer aleatorio.
 *
 * ── Por qué formatear a mano y no con `toISOString` ─────────────────────────
 * `toISOString` convierte a UTC siempre; ese es su trabajo. Para escribir la
 * fecha del calendario que el usuario tiene delante hay que leer los campos
 * locales —`getFullYear`, `getMonth`, `getDate`— y componerlos.
 *
 * ── Y por qué la aritmética va en UTC ───────────────────────────────────────
 * Al revés que lo anterior: para sumar días a una fecha YA escrita como
 * `YYYY-MM-DD` se trabaja en UTC a propósito, porque en UTC todos los días
 * miden 24 horas. Haciéndolo en local, los dos domingos del año en que cambia
 * la hora un día mide 23 o 25, y «ayer» se calcula mal justo esa madrugada.
 */

/** La fecha de un `Date` según el reloj del usuario, no según Greenwich. */
export function aFechaLocal(d: Date): string {
  const año = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

/** Hoy, para el usuario. */
export const hoyLocal = (): string => aFechaLocal(new Date())

const DIA_MS = 86_400_000

/**
 * Suma (o resta) días a una fecha `YYYY-MM-DD`.
 *
 * Devuelve otra fecha, no un `Date`: nadie que llame a esto quiere una hora, y
 * devolver un `Date` invita a volver a formatearlo mal.
 */
export function sumarDias(fecha: string, n: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d) + n * DIA_MS)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

/** La fecha de hace `n` días, contando en el calendario del usuario. */
export const haceDias = (n: number): string => sumarDias(hoyLocal(), -n)

/** La fecha de dentro de `n` días. */
export const enDias = (n: number): string => sumarDias(hoyLocal(), n)

/** Días enteros entre dos fechas `YYYY-MM-DD`. Positivo si `b` es posterior. */
export function diasEntre(a: string, b: string): number {
  const [a1, m1, d1] = a.split('-').map(Number)
  const [a2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / DIA_MS)
}
