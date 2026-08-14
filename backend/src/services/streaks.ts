/**
 * RACHAS
 * ──────
 * Las rachas no se guardan: se deducen de la actividad de cada día. Es lo que
 * decidió la migración 012 y el motivo está escrito ahí — un contador guardado
 * y una historia de la que sale el mismo contador acaban discrepando siempre, y
 * cuando discrepan gana el que está mal.
 *
 * ── Por qué vive en el backend y no en el store ─────────────────────────────
 * Porque hay dos que preguntan: la pantalla de rachas y `consultar_progreso`,
 * la herramienta con la que ZENA lee el progreso del usuario. Con una copia en
 * el móvil y otra en el servidor, un día se contestan cosas distintas y el
 * usuario ve que su coach no sabe cuántos días lleva.
 *
 * ── Qué cuenta como día activo ──────────────────────────────────────────────
 * Comer, entrenar o hacer el check-in. Beber agua no: se registra porque la
 * pantalla lo pinta, pero ocho vasos no son un día de trabajo. Es la misma
 * regla que `isDayComplete` aplicaba en el móvil, y se conserva tal cual para
 * que a nadie se le mueva la racha el día que esto se conecte.
 *
 * ── El día protegido ────────────────────────────────────────────────────────
 * Un protector de racha salva un día saltado: la cadena sigue viva. Pero un día
 * protegido NO suma a los días activos totales — no se entrenó, se perdonó. Son
 * dos preguntas distintas y mezclarlas convierte «llevas 40 días activos» en
 * una felicitación por días en los que no se hizo nada.
 */

/** La actividad de un día, ya traducida del `snake_case` de la tabla. */
export interface DiaActividad {
  date: string
  loggedFood: boolean
  loggedWorkout: boolean
  checkInDone: boolean
  drankWater: boolean
  protegido: boolean
}

export interface Rachas {
  /** Días consecutivos hasta hoy. */
  current: number
  /** La mejor racha de toda la historia del usuario. */
  longest: number
  /** Días en los que de verdad se hizo algo. Los protegidos no cuentan. */
  totalActive: number
  lastActiveDate: string | null
}

const DIA_MS = 86_400_000

/**
 * Suma días a una fecha `YYYY-MM-DD` sin salir nunca de UTC.
 *
 * Con `new Date('2026-08-13')` y `setDate` esto parecería funcionar y fallaría
 * dos domingos al año: en los husos con horario de verano un día no siempre
 * mide 24 horas, y la racha se rompería sola en la madrugada del cambio.
 */
export function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * DIA_MS).toISOString().slice(0, 10)
}

/** Se hizo algo de verdad ese día. */
export function huboActividad(d: DiaActividad): boolean {
  return d.loggedFood || d.loggedWorkout || d.checkInDone
}

/** El día no rompe la cadena: o se hizo algo, o se gastó un protector. */
export function mantieneLaCadena(d: DiaActividad): boolean {
  return huboActividad(d) || d.protegido
}

/**
 * Calcula las tres cifras a partir de la serie de días.
 *
 * `dias` debe ser TODO el histórico del usuario, no la ventana que pinta la
 * pantalla: la mejor racha puede estar en marzo y una consulta de doce semanas
 * la dejaría fuera, con lo que el récord de alguien bajaría solo por mirar el
 * calendario.
 *
 * `hoy` lo manda el cliente. El servidor corre en UTC y a las 19:00 de México
 * ya es «mañana» para él: calcular aquí el día de hoy rompería la racha de
 * media tarde a quien todavía no ha cenado.
 */
export function calcularRachas(dias: DiaActividad[], hoy: string): Rachas {
  const porFecha = new Map(dias.map(d => [d.date, d]))

  const activos = dias.filter(huboActividad).map(d => d.date).sort()
  const totalActive = activos.length
  const lastActiveDate = activos.length ? activos[activos.length - 1] : null

  // ── La racha actual ───────────────────────────────────────────────────────
  // Se cuenta hacia atrás desde hoy. Si hoy todavía no hay nada no se rompe
  // nada: el día no ha terminado. Se empieza a contar desde ayer y quien abra
  // la app por la mañana sigue viendo sus 30 días, no un cero desmoralizador.
  let inicio = hoy
  if (!esDeCadena(porFecha, hoy)) inicio = sumarDias(hoy, -1)

  let current = 0
  for (let f = inicio; esDeCadena(porFecha, f); f = sumarDias(f, -1)) current++

  // ── La mejor racha ────────────────────────────────────────────────────────
  // Sobre las fechas ordenadas: un salto en el calendario corta la tirada, y un
  // día que no está en la tabla es un día sin actividad — no hay fila porque no
  // hubo nada que guardar.
  const cadena = dias.filter(mantieneLaCadena).map(d => d.date).sort()

  let longest = 0
  let tirada = 0
  let anterior: string | null = null
  for (const fecha of cadena) {
    tirada = anterior !== null && sumarDias(anterior, 1) === fecha ? tirada + 1 : 1
    if (tirada > longest) longest = tirada
    anterior = fecha
  }

  // La racha en curso puede ser la mejor sin haber terminado todavía.
  return { current, longest: Math.max(longest, current), totalActive, lastActiveDate }
}

function esDeCadena(porFecha: Map<string, DiaActividad>, fecha: string): boolean {
  const dia = porFecha.get(fecha)
  return dia !== undefined && mantieneLaCadena(dia)
}
