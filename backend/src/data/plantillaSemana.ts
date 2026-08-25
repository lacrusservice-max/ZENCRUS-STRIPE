/**
 * DE «LUNES: PECHO Y TRÍCEPS» A UNA LISTA DE EJERCICIOS
 * ────────────────────────────────────────────────────
 * El usuario dice qué músculos toca cada día. Esto pone los ejercicios.
 *
 * ── Propone, no impone ──────────────────────────────────────────────────────
 * Lo que sale de aquí es un PUNTO DE PARTIDA que el usuario edita: quita, añade,
 * cambia y reordena. Es la regla de siempre de la app —ZENCRUS propone y tú
 * controlas cada valor— y aquí importa más que en ningún sitio, porque nadie
 * entrena exactamente lo que le diga una lista automática.
 *
 * ── Por qué NO se usa el generador ──────────────────────────────────────────
 * `services/generador.ts` compone sesiones sueltas y cambia de un día para
 * otro, que es lo que se quiere para «tengo 15 minutos». Un plan es lo
 * contrario: tiene que ser ESTABLE. Si la lista cambiara sola, las ediciones
 * del usuario se perderían y no habría dos semanas comparables. Aquí no hay
 * azar de ninguna clase: los mismos músculos dan siempre la misma propuesta.
 *
 * ── Las tres reglas que ordenan un día ──────────────────────────────────────
 * 1 · LO COMPUESTO PRIMERO. Una sentadilla con las piernas ya cansadas de
 *     extensiones es peor sentadilla y más riesgo. El orden sale del `pattern`,
 *     no del nombre.
 * 2 · SEIS EJERCICIOS COMO MUCHO. Más que eso es una sesión de hora y media que
 *     se abandona a la tercera semana. El reparto se ajusta al número de
 *     músculos del día, no al revés.
 * 3 · LO GRANDE LLEVA MÁS SERIES Y MENOS REPS. Un press de banca es 4×6-8 con
 *     dos minutos y medio; una elevación lateral es 3×12-15 con setenta y cinco
 *     segundos. Sale del patrón, igual que el gasto energético y las
 *     explicaciones: el catálogo ya sabe lo que hace falta.
 */

import catalogo from './exercises.json'

interface Ficha {
  slug: string
  nombre: string
  equipment: string
  muscle: string | null
  pattern: string | null
  home: boolean
  gym: boolean
}

const TODOS = catalogo.ejercicios as Ficha[]

/**
 * Los grupos musculares que se pueden elegir, con su nombre.
 *
 * Son los del catálogo y ni uno más: ofrecer «dorsal» y «trapecio» por separado
 * cuando detrás hay el mismo montón de ejercicios de espalda es prometer una
 * precisión que no existe.
 */
export const MUSCULOS: { clave: string; nombre: string; corto: string }[] = [
  { clave: 'chest',      nombre: 'Pecho',         corto: 'Pecho' },
  { clave: 'back',       nombre: 'Espalda',       corto: 'Espalda' },
  { clave: 'shoulders',  nombre: 'Hombro',        corto: 'Hombro' },
  { clave: 'biceps',     nombre: 'Bíceps',        corto: 'Bíceps' },
  { clave: 'triceps',    nombre: 'Tríceps',       corto: 'Tríceps' },
  { clave: 'quads',      nombre: 'Cuádriceps',    corto: 'Cuádriceps' },
  { clave: 'hamstrings', nombre: 'Femoral',       corto: 'Femoral' },
  { clave: 'glutes',     nombre: 'Glúteo',        corto: 'Glúteo' },
  { clave: 'calves',     nombre: 'Gemelo',        corto: 'Gemelo' },
  { clave: 'core',       nombre: 'Core',          corto: 'Core' },
  { clave: 'forearms',   nombre: 'Antebrazo',     corto: 'Antebrazo' },
  { clave: 'fullbody',   nombre: 'Cuerpo entero', corto: 'Cuerpo' },
]

const NOMBRE = new Map(MUSCULOS.map(m => [m.clave, m.nombre]))

/**
 * El nombre del día sale de sus músculos: «Pecho y tríceps».
 *
 * No se pide que lo escriba el usuario y no se llama «Día 2» ni «Empuje». Un
 * nombre que hay que aprenderse es un nombre que estorba: quien abre el martes
 * quiere leer lo que va a entrenar, no descifrar una etiqueta.
 */
export function nombreDeDia(musculos: string[]): string {
  const nombres = musculos.map(m => NOMBRE.get(m) ?? m).filter(Boolean)
  if (nombres.length === 0) return 'Descanso'
  if (nombres.length === 1) return nombres[0]

  /**
   * En minúscula TODOS menos el primero.
   *
   * Antes solo se bajaba el último y salían cosas como «Gemelo, Cuádriceps y
   * femoral», con una mayúscula suelta en medio que parece un error de
   * escritura. En español solo va en mayúscula la primera palabra de la frase.
   */
  const [primero, ...resto] = nombres
  const bajos = resto.map(n => n.toLocaleLowerCase('es'))
  return bajos.length === 1
    ? `${primero} y ${bajos[0]}`
    : `${primero}, ${bajos.slice(0, -1).join(', ')} y ${bajos[bajos.length - 1]}`
}

/** Cuánto pesa cada patrón para ordenar el día. Lo compuesto primero. */
const ORDEN_PATRON: Record<string, number> = {
  squat: 0, hinge: 0,
  'push-horizontal': 1, 'pull-horizontal': 1,
  'push-vertical': 2, 'pull-vertical': 2,
  carry: 3,
  isolation: 4,
  core: 5,
  stretch: 6,
}

const esCompuesto = (p: string | null) => (ORDEN_PATRON[p ?? ''] ?? 4) <= 3

/**
 * Series, repeticiones y descanso según lo que sea el ejercicio.
 *
 * Lo compuesto y pesado pide menos repeticiones y más descanso; lo de aislar,
 * al revés. El core se mide en tiempo porque una plancha no tiene repeticiones.
 */
function dosis(f: Ficha): { series: number; reps?: string; duracion?: number; descanso: number } {
  if (f.pattern === 'core' || f.pattern === 'stretch') {
    return { series: 3, duracion: 40, descanso: 45 }
  }
  if (f.pattern === 'squat' || f.pattern === 'hinge') {
    return { series: 4, reps: '6-8', descanso: 150 }
  }
  if (esCompuesto(f.pattern)) {
    return { series: 4, reps: '8-10', descanso: 120 }
  }
  return { series: 3, reps: '10-12', descanso: 75 }
}

/**
 * Cuánto sube cuando toca, en kilos.
 *
 * Una barra sube de 2,5 en 2,5 porque es el disco pequeño que hay en casi todos
 * los gimnasios; una mancuerna, de 2 en 2 porque suben de dos en dos; y una
 * elevación lateral, de kilo en kilo, porque 2,5 kg sobre 8 es un salto del 30 %
 * que nadie completa. El incremento no es una preferencia: es lo que hay en la
 * sala.
 */
function incrementoDe(f: Ficha): number {
  if (f.pattern === 'squat' || f.pattern === 'hinge') return 5
  if (f.equipment === 'barbell') return 2.5
  if (f.equipment === 'machine' || f.equipment === 'cable') return 2.5
  if (f.equipment === 'dumbbell') return esCompuesto(f.pattern) ? 2 : 1
  return 1
}

/**
 * La FAMILIA de un ejercicio: su movimiento, sin el material ni la variante.
 *
 * Existe porque sin ella la propuesta salía inservible. «Hombro» devolvía cinco
 * face pulls seguidos —el de polea, el de banda, el de máquina, el de rodillas
 * y el sentado— y «pecho» en casa, tres aperturas. Todos eran del músculo
 * correcto y del patrón correcto; simplemente eran el MISMO ejercicio cinco
 * veces. Un día así no entrena el hombro, entrena una sola cosa cinco veces.
 *
 * Se quitan las palabras de relleno y el material y se mira lo que queda: dos
 * palabras bastan. «Face pull en polea» y «Face pull alto con banda» son los
 * dos «face pull»; «Apertura de pecho» y «Apertura de deltoides» no lo son.
 */
const RELLENO = new Set([
  'de', 'con', 'en', 'a', 'el', 'la', 'los', 'las', 'un', 'una', 'y', 'sobre',
  'para', 'del', 'al', 'por',
  // «Ejercicio» no distingue nada: es ruido que mete el compositor de nombres.
  'ejercicio',
])

/**
 * Se comparan las OCHO primeras letras del nombre sin relleno ni espacios.
 *
 * La primera versión cogía las dos primeras palabras, y el catálogo la derrotó
 * en cuanto se vio en pantalla: «Ejercicio facepulls en máquina» y «Face pull
 * alto con banda» son el mismo movimiento escrito de dos formas —una palabra
 * contra dos, y con una ese de más— así que salían como familias distintas y el
 * día de hombro abría con dos face pulls seguidos. Machacando los espacios y
 * quedándose con ocho letras, los dos dan «facepull».
 *
 * Es una heurística, no una verdad: está ajustada contra estos 206 nombres y
 * puede unir de más. Eso es justo el lado por el que conviene equivocarse —unir
 * de más solo cuesta variedad, y las pasadas de respaldo de `elegirVariado` la
 * recuperan; separar de menos devuelve cinco veces el mismo ejercicio, que es
 * lo que había que arreglar.
 */
function familia(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter(p => p && !RELLENO.has(p))
    // Fuera el plural: «facepulls» y «face pull» tienen que ser lo mismo.
    .map(p => (p.length > 4 && p.endsWith('s') ? p.slice(0, -1) : p))
    .join('')
    .slice(0, 8)
}

/**
 * Elegir `cupo` ejercicios de una lista ya ordenada, buscando VARIEDAD.
 *
 * Tres pasadas, cada una más permisiva que la anterior, y ese orden es el
 * truco: la primera da el día ideal —movimientos distintos y patrones
 * distintos—, y las otras dos existen para que un músculo con pocos ejercicios
 * no se quede corto. El gemelo tiene tres en todo el catálogo y los tres son
 * una elevación de gemelo: con la regla estricta a secas, el día de gemelo
 * habría salido con un solo ejercicio.
 */
function elegirVariado(candidatos: Ficha[], cupo: number): Ficha[] {
  const elegidos: Ficha[] = []
  const familias = new Set<string>()
  const porPatron = new Map<string, number>()
  const dentro = new Set<string>()

  const meter = (f: Ficha) => {
    elegidos.push(f)
    dentro.add(f.slug)
    familias.add(familia(f.nombre))
    const p = f.pattern ?? ''
    porPatron.set(p, (porPatron.get(p) ?? 0) + 1)
  }

  // 1 · Lo ideal: movimiento nuevo y como mucho dos del mismo patrón.
  for (const f of candidatos) {
    if (elegidos.length >= cupo) break
    if (familias.has(familia(f.nombre))) continue
    if ((porPatron.get(f.pattern ?? '') ?? 0) >= 2) continue
    meter(f)
  }
  // 2 · Si falta, se suelta el tope de patrón pero no el de movimiento.
  for (const f of candidatos) {
    if (elegidos.length >= cupo) break
    if (dentro.has(f.slug) || familias.has(familia(f.nombre))) continue
    meter(f)
  }
  // 3 · Y si aún falta, lo que quede: mejor una variante repetida que un hueco.
  for (const f of candidatos) {
    if (elegidos.length >= cupo) break
    if (dentro.has(f.slug)) continue
    meter(f)
  }
  return elegidos
}

export interface EjercicioPropuesto {
  slug: string
  nombre: string
  series: number
  reps?: string
  duracion?: number
  descanso: number
  progresion: 'doble' | 'fija' | 'tiempo'
  incremento?: number
  carga?: 'weight' | 'bodyweight' | 'band' | 'assisted' | 'none'
  /** El músculo por el que entró, para poder agrupar en la pantalla. */
  musculo: string
  /**
   * Con qué se hace. Viaja para que la app pueda saber, sin pedir nada más, si
   * un ejercicio del plan dejó de encajar cuando cambia el material de casa.
   */
  equipment: string
}

/**
 * Cuántos ejercicios le tocan a cada músculo del día.
 *
 * Un solo músculo se lleva cinco; dos se reparten tres y dos; a partir de tres
 * van a dos cada uno. El día nunca pasa de seis, y esa es la regla que manda
 * sobre las demás: es la diferencia entre un plan que se cumple y uno que se
 * abandona.
 */
function reparto(cuantos: number): number[] {
  if (cuantos <= 0) return []
  if (cuantos === 1) return [5]
  if (cuantos === 2) return [3, 3]
  if (cuantos === 3) return [2, 2, 2]
  // Con cuatro o más se da uno a cada uno hasta seis y el resto se queda fuera:
  // querer tocar cinco músculos en un día es querer no entrenar ninguno.
  return Array.from({ length: Math.min(cuantos, 6) }, () => 1)
}

/**
 * Los ejercicios de un día, a partir de sus músculos.
 *
 * `entorno` filtra por dónde se entrena: en casa no se puede proponer una
 * prensa. Determinista: los mismos músculos dan siempre lo mismo.
 */
/**
 * QUÉ HACE FALTA PARA CADA EJERCICIO, MÁS ALLÁ DE SU `equipment`
 * ═════════════════════════════════════════════════════════════
 * Estos seis dicen «peso corporal» y es verdad —no llevas hierro—, pero sin
 * una barra de la que colgarte o un banco donde apoyarte no se pueden hacer.
 * El catálogo ya los deja fuera de `home`, que es lo correcto para la regla
 * gruesa; esto es la regla fina, la que sabe si están en TU casa.
 */
export const PIDE_APAREJO: Record<string, string> = {
  'pull-ups': 'barra',
  'chin-ups': 'barra',
  'hanging-knee-raises': 'barra',
  'parralel-bar-dips': 'barra',
  'inverted-row': 'barra',
  'bench-dips': 'banco',
}

/**
 * ¿Se puede hacer este ejercicio con lo que hay en esa casa?
 *
 * ── Esta función es la AUTORIDAD ────────────────────────────────────────────
 * La app tiene una copia para poder filtrar sin ir al servidor, pero la buena
 * es esta: el catálogo vive aquí y las reglas viven donde vive el dato. Si las
 * dos se separan, manda esta y la del cliente se corrige.
 *
 * Sin inventario devuelve `true`: antes de que el usuario conteste, esconderle
 * medio catálogo sería peor que no filtrar.
 */
/** Con qué se hace un ejercicio del catálogo. `null` si no está (uno a mano). */
export function equipoDe(slug: string | undefined): string | null {
  if (!slug) return null
  return TODOS.find(f => f.slug === slug)?.equipment ?? null
}

export function cabeEnCasa(f: { slug: string; equipment: string }, aparejos: string[] | null): boolean {
  if (!aparejos) return true

  const pide = PIDE_APAREJO[f.slug]
  if (pide) return aparejos.includes(pide)

  switch (f.equipment) {
    case 'bodyweight': return true
    case 'dumbbell': return aparejos.includes('dumbbell')
    case 'kettlebell': return aparejos.includes('kettlebell')
    case 'band': return aparejos.includes('band')
    // Barra, polea, máquina, multipower, landmine y disco no son de casa.
    default: return false
  }
}

export function proponerDia(
  musculos: string[],
  entorno: 'gym' | 'home' = 'gym',
  /** Lo que hay en su casa. `null` = todavía no ha contestado. */
  aparejos: string[] | null = null,
): EjercicioPropuesto[] {
  const limpios = musculos.filter(m => NOMBRE.has(m))
  if (limpios.length === 0) return []

  const cupos = reparto(limpios.length)
  const elegidos: Ficha[] = []
  const yaPuestos = new Set<string>()

  limpios.forEach((musculo, i) => {
    const cupo = cupos[i] ?? 1
    const candidatos = TODOS
      .filter(f => f.muscle === musculo)
      .filter(f => (entorno === 'home' ? f.home : f.gym))
      // En casa, además, lo que de verdad puede hacer con lo que tiene.
      .filter(f => entorno !== 'home' || cabeEnCasa(f, aparejos))
      .filter(f => f.pattern !== 'stretch')
      .filter(f => !yaPuestos.has(f.slug))
      /**
       * Lo compuesto primero y, dentro de eso, por nombre.
       *
       * Ordenar por nombre parece arbitrario y es justo lo que se busca: hace
       * falta un desempate ESTABLE. Con cualquier orden que dependa de la fecha
       * o del azar, el mismo plan daría ejercicios distintos según cuándo se
       * creara, y dos usuarios con el mismo lunes tendrían lunes distintos sin
       * que nada lo explicara.
       */
      .sort((a, b) => {
        const oa = ORDEN_PATRON[a.pattern ?? ''] ?? 4
        const ob = ORDEN_PATRON[b.pattern ?? ''] ?? 4
        if (oa !== ob) return oa - ob
        return a.nombre.localeCompare(b.nombre, 'es')
      })

    for (const f of elegirVariado(candidatos, cupo)) {
      elegidos.push(f)
      yaPuestos.add(f.slug)
    }
  })

  // Y el día entero se reordena: lo compuesto va delante venga del músculo que
  // venga. Sin esto, «pecho y tríceps» pondría los tríceps aislados en medio.
  elegidos.sort((a, b) => (ORDEN_PATRON[a.pattern ?? ''] ?? 4) - (ORDEN_PATRON[b.pattern ?? ''] ?? 4))

  return elegidos.slice(0, 6).map(f => {
    const d = dosis(f)
    const esPeso = f.equipment !== 'bodyweight' && f.equipment !== 'band'
    return {
      slug: f.slug,
      nombre: f.nombre,
      ...d,
      progresion: d.duracion ? 'tiempo' : esPeso ? 'doble' : 'fija',
      ...(d.duracion ? { incremento: 5 } : esPeso ? { incremento: incrementoDe(f) } : {}),
      ...(esPeso ? {} : { carga: f.equipment === 'band' ? 'band' as const : 'bodyweight' as const }),
      musculo: f.muscle ?? '',
      equipment: f.equipment,
    }
  })
}

/**
 * Qué días de la semana se proponen para N días de entrenamiento.
 *
 * Repartidos, no seguidos. Entrenar lunes, martes y miércoles y descansar
 * cuatro días seguidos entrena el mismo número de veces y rinde menos: el
 * músculo se recupera en 48 horas y luego empieza a perder. Se puede cambiar
 * después —son los días de cada uno— pero la propuesta parte de lo que funciona.
 *
 * 0 = lunes … 6 = domingo.
 */
export function diasSugeridos(cuantos: number): number[] {
  const POR_CUANTOS: Record<number, number[]> = {
    1: [2],                    // miércoles
    2: [0, 3],                 // lunes y jueves
    3: [0, 2, 4],              // lunes, miércoles y viernes
    4: [0, 1, 3, 4],           // lunes, martes, jueves y viernes
    5: [0, 1, 2, 4, 5],        // de lunes a sábado con el miércoles dentro
    6: [0, 1, 2, 3, 4, 5],     // todos menos el domingo
    7: [0, 1, 2, 3, 4, 5, 6],
  }
  return POR_CUANTOS[Math.max(1, Math.min(7, cuantos))] ?? [0, 2, 4]
}
