/**
 * GASTO ENERGÉTICO DE UN ENTRENAMIENTO
 * ────────────────────────────────────
 * Cuántas calorías costó una sesión. La columna `calories_kcal` llevaba desde
 * la migración 008 esperando a que alguien pusiera un número; esto lo pone.
 *
 * ── Se COMPONE, igual que «cómo se hace» ────────────────────────────────────
 * No hay una tabla de 206 filas con la caloría de cada ejercicio. El coste sale
 * del PATRÓN de movimiento —que es lo que decide cuánta masa muscular se mueve—
 * ajustado por el MATERIAL. Una sentadilla y una zancada cuestan parecido
 * porque mueven lo mismo; un curl de bíceps y una elevación lateral también,
 * entre ellos. Un ejercicio nuevo trae su coste el día que entra al catálogo.
 *
 * ── ACTIVAS, no totales. Esta es LA decisión ────────────────────────────────
 * En una hora de entrenamiento el cuerpo gasta unas 300 kcal, pero unas 80 de
 * esas las habría gastado tumbado en el sofá: son el metabolismo basal, que
 * nunca se apaga. Y esas 80 YA ESTÁN DENTRO del TDEE que la app enseña en el
 * perfil y usa para calcular tus objetivos.
 *
 * Si aquí devolviéramos las 300, el balance del día las contaría dos veces y el
 * déficit saldría 80 kcal a favor del usuario CADA DÍA que entrene — que es
 * justo el error que hace que alguien siga su plan a rajatabla y no adelgace.
 * Así que se devuelve el gasto ACTIVO: lo que costó de más por entrenar. Es lo
 * que hace Apple, y es la única cifra que se puede sumar sin mentir.
 *
 * Por eso además se llama «gasto del entrenamiento» y no «calorías quemadas».
 *
 * ── El basal se resta del TUYO, no del de un libro ──────────────────────────
 * La definición de MET dice que 1 MET ≈ 1 kcal por kilo y hora, y lo normal es
 * restar ese 1 MET y quedarse tan tranquilo. Aquí se resta el BMR REAL del
 * usuario (Mifflin-St Jeor, el que ya está en `goals.bmr`), porque el número
 * con el que esto no puede contradecirse es el que la app enseña en otra
 * pantalla, no el de la definición. Si no hay BMR guardado, se vuelve al MET −1.
 *
 * ── Es una ESTIMACIÓN de ±20-25 %, y hay que decirlo ────────────────────────
 * Sin pulsómetro no existe nada mejor: dos personas del mismo peso haciendo la
 * misma serie gastan distinto. La cifra sirve para comparar un martes con otro
 * martes, no para cuadrar una dieta al gramo. Quien la enseñe que lo diga, y
 * quien quiera corregirla que pueda —la app manda `caloriesKcal` y gana.
 *
 * ── SIN PESO NO HAY CIFRA ───────────────────────────────────────────────────
 * `estimar` devuelve null si no sabe cuánto pesas. Una estimación necesita una
 * entrada real; inventarse 70 kg produce un número con la misma pinta que uno
 * bueno y ya nadie sabría cuál es cuál. Mejor no enseñar nada.
 */

/**
 * MET por patrón de movimiento.
 *
 * El compendio de actividad física da entre 3,5 y 6,0 MET para el trabajo con
 * pesas —lo bajo es una sesión de máquinas con descansos largos, lo alto es
 * levantar en serio— y sube a 8 en circuito sin descanso. Estos valores viven
 * dentro de ese rango y se reparten por cuánta masa muscular mueve el gesto,
 * que es lo único que separa de verdad un peso muerto de un curl.
 *
 * OJO: el MET del compendio se mide sobre la sesión ENTERA, descansos dentro.
 * No es el coste del minuto que estás levantando, es el de la hora que pasas en
 * el gimnasio. Por eso abajo se multiplica por la duración de la sesión y no
 * por el tiempo bajo tensión, que daría un número tres veces más alto.
 */
const MET_POR_PATRON: Record<string, number> = {
  // Tren inferior completo. Lo más caro que se puede hacer con una barra.
  squat: 6.0,
  hinge: 6.0,
  // Llevar peso andando: no hay descanso dentro de la serie.
  carry: 5.5,
  // Tren superior con varias articulaciones. Mucha masa, pero menos que una
  // pierna: el glúteo y el cuádriceps solos pesan más que todo un brazo.
  'pull-vertical': 5.0,
  'pull-horizontal': 5.0,
  'push-horizontal': 5.0,
  'push-vertical': 5.0,
  // Casi todo isométrico y con poca masa. Cuesta esfuerzo, no calorías.
  core: 4.0,
  // Un músculo pequeño y nada más. Es el suelo del rango del compendio.
  isolation: 3.5,
  // Estirar está apenas por encima de estar de pie.
  stretch: 2.3,
}

/** Los 19 del catálogo que no tienen patrón: el centro del rango. */
const MET_SIN_PATRON = 4.5

/**
 * Ajuste por material.
 *
 * Pequeño a propósito: el material cambia el coste, pero mucho menos que el
 * gesto. Lo que mide de verdad es cuánto tiene que estabilizar el cuerpo y con
 * qué ritmo se suele mover ese trasto.
 */
const AJUSTE_POR_MATERIAL: Record<string, number> = {
  // Balísticas y encadenadas: un swing no tiene pausa entre repeticiones.
  kettlebell: 1.15,
  // Peso libre: el cuerpo entero sujeta la barra además de moverla.
  barbell: 1.05,
  landmine: 1.05,
  dumbbell: 1.0,
  bodyweight: 1.0,
  plate: 1.0,
  // El cable ya viene guiado; la máquina además te sienta y te sujeta la
  // espalda. Se estabiliza mucho menos, y estabilizar también cuesta.
  cable: 0.95,
  machine: 0.85,
  // La goma da su máxima resistencia solo al final del recorrido.
  band: 0.9,
}

/**
 * MET de una sesión SIN NINGUNA SERIE.
 *
 * El modelo las admite a propósito —una clase de 40 minutos y una carrera de
 * 8 km son sesiones completas y no tienen series— así que aquí hace falta una
 * salida que no dependa de los ejercicios.
 */
const MET_POR_MODO: Record<string, number> = {
  gym: 5.0,
  home: 4.5,
  class: 6.0,
  outdoor: 7.0,
}

export interface Gasto {
  /** Calorías ACTIVAS: lo que costó de más por entrenar. Nunca negativo. */
  kcal: number
  /** El MET medio que salió. Se guarda para poder auditar la cifra después. */
  met: number
  minutos: number
  origen: 'estimado'
}

/** Lo mínimo que hace falta saber de una serie para pesarla. */
export interface SerieParaGasto {
  exercise_slug?: string | null
}

/** Lo mínimo que hace falta saber de una ficha del catálogo. */
export interface FichaParaGasto {
  slug: string
  pattern?: string | null
  equipment?: string | null
}

/** El MET de un ejercicio concreto: su patrón, ajustado por su material. */
export function metDeEjercicio(ficha: FichaParaGasto | undefined): number {
  const base = (ficha?.pattern && MET_POR_PATRON[ficha.pattern]) || MET_SIN_PATRON
  const ajuste = (ficha?.equipment && AJUSTE_POR_MATERIAL[ficha.equipment]) || 1
  return base * ajuste
}

/**
 * El gasto activo de una sesión.
 *
 * Devuelve null cuando no se puede estimar sin inventar: sin peso corporal, sin
 * duración creíble, o con una duración absurda. Es preferible una ficha sin
 * cifra a una ficha con una cifra falsa.
 */
export function estimar(args: {
  modo: string
  duracionSegundos: number | null | undefined
  pesoKg: number | null | undefined
  bmrDiario?: number | null
  series: SerieParaGasto[]
  catalogo: Map<string, FichaParaGasto>
}): Gasto | null {
  const { modo, duracionSegundos, pesoKg, bmrDiario, series, catalogo } = args

  // Sin peso no hay cifra. Ver la cabecera: no se inventa una entrada.
  if (!pesoKg || pesoKg < 20 || pesoKg > 300) return null

  const minutos = (duracionSegundos ?? 0) / 60
  // Menos de un minuto no es un entrenamiento; más de seis horas es una sesión
  // que nadie cerró y que la barredora acabará cerrando en su última serie.
  if (minutos < 1 || minutos > 360) return null

  /**
   * El MET de la sesión es la MEDIA de los ejercicios que se hicieron,
   * pesada por cuántas series tuvo cada uno: una sesión de nueve series de
   * sentadilla y una de curl no cuesta lo mismo que al revés.
   *
   * El CALENTAMIENTO SÍ CUENTA aquí, y no es una incoherencia con el resto de
   * la app. En volumen y en récords no cuenta porque no genera estímulo; en
   * calorías cuenta porque el cuerpo se movió igual. Volumen es una medida de
   * entrenamiento; esto es una medida de física.
   */
  const conSlug = series.filter(s => s.exercise_slug)
  let met: number
  if (conSlug.length === 0) {
    met = MET_POR_MODO[modo] ?? MET_POR_MODO.gym
  } else {
    const suma = conSlug.reduce(
      (acc, s) => acc + metDeEjercicio(catalogo.get(s.exercise_slug!)),
      0,
    )
    met = suma / conSlug.length
  }

  // La fórmula del compendio: 1 MET consume 3,5 ml de oxígeno por kilo y
  // minuto, y cada litro de oxígeno son unas 5 kcal. De ahí el 200.
  const kcalTotales = (met * 3.5 * pesoKg / 200) * minutos

  /**
   * Y ahora se le quita lo que habrías gastado sin moverte.
   *
   * Con el BMR guardado se usa el tuyo, que es el que la app enseña en el
   * perfil. Sin él, se cae al 1 MET de la definición, que para un peso normal
   * se queda cerca y nunca dispara la cifra hacia arriba.
   */
  const kcalBasales = bmrDiario && bmrDiario > 500 && bmrDiario < 6000
    ? (bmrDiario / 1440) * minutos
    : (1 * 3.5 * pesoKg / 200) * minutos

  const activas = Math.round(kcalTotales - kcalBasales)

  // Estirar media hora puede dar negativo contra el basal. Cero, no un número
  // rojo: no se puede gastar menos que estando quieto.
  return {
    kcal: Math.max(0, activas),
    met: Math.round(met * 10) / 10,
    minutos: Math.round(minutos),
    origen: 'estimado',
  }
}
