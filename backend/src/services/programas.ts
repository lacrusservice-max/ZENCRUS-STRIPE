/**
 * PROGRAMAS · PROGRESIÓN Y DESCARGA
 * ─────────────────────────────────
 * Cuánto peso toca hoy en cada ejercicio, y cuándo toca bajar.
 *
 * ── La progresión se CALCULA, no se escribe en el plan ──────────────────────
 * Un plan que dijera «semana 3: press de banca a 82,5 kg» solo serviría para
 * quien levante exactamente eso. Aquí el plan describe la FORMA de progresar
 * —doble progresión, porcentaje del máximo, tiempo— y el peso concreto sale de
 * lo que esa persona ha levantado de verdad, que está en `personal_records` y
 * en `workout_sets`.
 *
 * ── Y la persona manda por encima ───────────────────────────────────────────
 * Todo lo que calcula este módulo es una PROPUESTA. Si el usuario fija un peso
 * a mano, ese gana y se recuerda para las semanas siguientes. Es la filosofía
 * de la app: la máquina propone, la persona ajusta cualquier valor.
 *
 * ── Qué NO hace ─────────────────────────────────────────────────────────────
 * No decide si alguien está listo para subir mirando su sueño, su estrés o su
 * frecuencia cardíaca. Mira lo único que la app sabe con certeza: qué
 * repeticiones completó y con qué esfuerzo dijo que las hizo.
 */

import { supabase } from '../config/supabase'

// ── Forma del plan ───────────────────────────────────────────────────────────

export type Progresion = 'doble' | 'porcentaje' | 'tiempo' | 'fija'

export interface EjercicioPlan {
  /** Slug del catálogo. Sin él, el ejercicio no cuenta para el mapa del cuerpo. */
  slug?: string
  nombre: string
  series: number
  /** «6-8», «5», «max». Vacío si el ejercicio se mide en tiempo. */
  reps?: string
  /** Segundos, para planchas y similares. */
  duracion?: number
  descanso: number
  progresion: Progresion
  /** Cuánto se sube cuando toca, en kilos o en segundos. */
  incremento?: number
  /** Porcentajes del 1RM por semana. El índice es la semana − 1. */
  pct?: number[]
  /** Tipo de carga, para los que no llevan peso. */
  carga?: 'weight' | 'bodyweight' | 'band' | 'assisted' | 'none'
  notas?: string
}

export interface DiaPlan {
  /**
   * La IDENTIDAD del día dentro del plan, de 1 a N. No es cuándo se hace.
   *
   * Se queda aunque ahora los días vivan en el calendario, y por dos razones
   * que no son negociables: `workout_sessions.program_day` guarda ESTE número
   * en todo el historial ya registrado —cambiarlo de significado reescribiría
   * el pasado— y su restricción en la base es `between 1 and 7`, así que un
   * día de la semana empezando en cero ni siquiera cabría.
   *
   * Mover el lunes al martes cambia `diaSemana` y no toca esto, que es
   * justamente lo que se quiere: reordenar la semana no puede partir el
   * historial ni perder los pesos que ya habías fijado.
   */
  dia: number
  nombre: string
  /**
   * CUÁNDO se hace: 0 = lunes … 6 = domingo.
   *
   * Antes los días eran «día 1, día 2» y el plan avanzaba al entrenar, no con
   * el calendario. Tenía una virtud —saltarte el martes no marcaba nada como
   * fallado— y un defecto que pesa más: nadie organiza su vida en «día 2».
   * La gente piensa «los martes entreno pierna», y una app que no habla ese
   * idioma obliga a abrirla para saber qué toca.
   *
   * La virtud no se pierde: un día que se queda atrás sigue PENDIENTE y se
   * puede hacer otro día contando como él. Ver `pendientesDeLaSemana`.
   *
   * Opcional para no romper los planes que ya existen sin `diaSemana`: los
   * viejos se reparten por su número al leerlos.
   */
  diaSemana?: number
  /**
   * Los músculos que se entrenan ese día, como los eligió el usuario.
   *
   * De aquí sale el nombre («Pecho y tríceps») y de aquí salen los ejercicios
   * que propone ZENCRUS. Se guarda además de los ejercicios porque es la
   * INTENCIÓN: si mañana quiere rehacer el día, hay que saber qué pidió, no
   * solo con qué se quedó.
   */
  musculos?: string[]
  /** Grupo muscular dominante, para pintarlo. */
  foco?: string
  ejercicios: EjercicioPlan[]
}

/**
 * El día de la semana de un día del plan, con respaldo para los planes viejos.
 *
 * Los que se crearon antes de esto no traen `diaSemana`. En vez de dejarlos
 * sin sitio —lo que los haría desaparecer de la portada— se reparten por su
 * número: el día 1 al lunes, el 2 al miércoles y así, con la misma separación
 * que se propone hoy. No es lo que su dueño eligió, porque no eligió nada, pero
 * es un plan que sigue funcionando mientras no lo edite.
 */
const REPARTO_VIEJO: Record<number, number[]> = {
  1: [2], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6],
}

export function diaSemanaDe(d: DiaPlan, totalDias: number): number {
  if (typeof d.diaSemana === 'number' && d.diaSemana >= 0 && d.diaSemana <= 6) {
    return d.diaSemana
  }
  const reparto = REPARTO_VIEJO[Math.min(7, Math.max(1, totalDias))] ?? [0, 2, 4]
  return reparto[(d.dia - 1) % reparto.length] ?? 0
}

export interface Plan {
  dias: DiaPlan[]
}

// ── Descarga ─────────────────────────────────────────────────────────────────

/**
 * ¿Toca descarga esta semana?
 *
 * `deload_every: 4` significa que las semanas 4, 8 y 12 se bajan. No es una ley
 * física: es que a partir de la cuarta semana seguida subiendo, la fatiga
 * acumulada se come la ganancia y bajar rinde más que insistir.
 *
 * Sin `deload_every`, ninguna semana es de descarga salvo que el propio plan lo
 * haya escrito en sus porcentajes.
 */
export const esDescarga = (semana: number, cada: number | null): boolean =>
  cada != null && cada > 0 && semana % cada === 0

/** En descarga se recortan las series antes que el peso. */
const SERIES_EN_DESCARGA = 0.6
/** Y el peso baja poco: la idea es descansar, no perder el gesto. */
const PESO_EN_DESCARGA = 0.85

// ── Redondeo ─────────────────────────────────────────────────────────────────

/**
 * Al múltiplo cargable más cercano.
 *
 * Un cálculo puede dar 81,7 kg y eso no existe: el disco más pequeño de un
 * gimnasio son 1,25 por lado, o sea 2,5 en la barra. Proponer un número que no
 * se puede montar obliga a redondear a quien está delante de la barra, que es
 * justo el trabajo que la app viene a quitar.
 */
export function redondearCarga(kg: number, paso = 2.5): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0
  return Math.round(kg / paso) * paso
}

// ── Lo que se propone para un ejercicio ──────────────────────────────────────

import { equipoDe } from '../data/plantillaSemana'

export interface Propuesta {
  slug?: string
  nombre: string
  series: number
  reps?: string
  duracion?: number
  descanso: number
  carga: 'weight' | 'bodyweight' | 'band' | 'assisted' | 'none'
  /** Kilos propuestos. Null cuando no se puede saber todavía. */
  pesoKg: number | null
  /**
   * Por qué ese peso, en una frase para la pantalla. Va SIEMPRE, también
   * cuando el peso es null: «no lo sé» sin explicación parece un fallo, y
   * explicado es una invitación a meter el dato.
   */
  motivo: string
  /** Lo fijó la persona a mano y no se recalcula. */
  fijadoAMano: boolean
  esDescarga: boolean
  notas?: string
  /**
   * Con qué se hace, sacado del catálogo por su slug. Viaja para que la app
   * pueda saber si un ejercicio dejó de encajar al cambiar el material de casa
   * —sin tener que pedir la ficha de cada uno—. `null` en los anotados a mano.
   */
  equipment?: string | null
}

/** Lo último que se hizo de un ejercicio, para la doble progresión. */
export interface UltimaVez {
  pesoKg: number | null
  /** Repeticiones de cada serie efectiva, en orden. */
  reps: number[]
  /** El RIR más bajo de la sesión: lo cerca que estuvo del fallo. */
  rirMin: number | null
  duracion: number | null
}

/** «6-8» → [6, 8]. «5» → [5, 5]. «max» → null. */
export function rangoReps(reps?: string): [number, number] | null {
  if (!reps) return null
  const m = reps.match(/^(\d+)\s*-\s*(\d+)$/)
  if (m) return [Number(m[1]), Number(m[2])]
  const uno = reps.match(/^(\d+)$/)
  if (uno) return [Number(uno[1]), Number(uno[1])]
  return null
}

/**
 * El peso de hoy para un ejercicio.
 *
 * Cada forma de progresar responde a una pregunta distinta:
 *
 * · DOBLE PROGRESIÓN — «¿completaste el rango la última vez?». Se trabaja entre
 *   6 y 8; cuando salen 8 en todas las series y no fue a fallo, se sube. Es la
 *   que mejor funciona sin saber el máximo de nadie, y la única que se
 *   autorregula: una semana mala no sube el peso, y ya está.
 *
 * · PORCENTAJE — «¿qué porcentaje de tu máximo toca esta semana?». Necesita un
 *   1RM, aunque sea estimado. Es lo que permite periodizar de verdad: subir la
 *   intensidad tres semanas y bajarla la cuarta.
 *
 * · TIEMPO — igual que la doble, pero en segundos. Para planchas e isométricos.
 *
 * · FIJA — no se toca. Para calentamientos y trabajo técnico.
 */
export function proponer(
  e: EjercicioPlan,
  semana: number,
  opciones: {
    est1RM: number | null
    ultima: UltimaVez | null
    override: number | null
    descarga: boolean
  },
): Propuesta {
  const { est1RM, ultima, override, descarga } = opciones
  const carga = e.carga ?? 'weight'

  const series = descarga
    ? Math.max(2, Math.round(e.series * SERIES_EN_DESCARGA))
    : e.series

  const base: Omit<Propuesta, 'pesoKg' | 'motivo' | 'fijadoAMano'> = {
    slug: e.slug, nombre: e.nombre, series,
    reps: e.reps, duracion: e.duracion, descanso: e.descanso,
    carga, esDescarga: descarga, notas: e.notas,
    equipment: equipoDe(e.slug),
  }

  // Lo que fijó la persona gana sobre todo lo demás, descarga incluida: si
  // alguien decidió que su press va a 80, no se le mueve.
  if (override != null) {
    return { ...base, pesoKg: override, motivo: 'Lo fijaste tú', fijadoAMano: true }
  }

  if (carga !== 'weight' && carga !== 'assisted') {
    return {
      ...base, pesoKg: null, fijadoAMano: false,
      motivo: descarga ? 'Semana de descarga: menos series' : 'Sin peso',
    }
  }

  switch (e.progresion) {
    case 'porcentaje': {
      if (!est1RM) {
        return {
          ...base, pesoKg: null, fijadoAMano: false,
          motivo: 'Todavía no tienes marca en este ejercicio. Pon el peso que creas y a partir de la próxima semana lo calculo yo.',
        }
      }
      // El array se recorre en bucle si el programa dura más que la lista: un
      // plan de 4 porcentajes en 12 semanas repite el ciclo tres veces, que es
      // exactamente lo que hace una periodización por bloques.
      const lista = e.pct ?? [0.7]
      const pct = lista[(semana - 1) % lista.length]
      const bruto = est1RM * pct * (descarga ? PESO_EN_DESCARGA : 1)
      return {
        ...base, pesoKg: redondearCarga(bruto), fijadoAMano: false,
        motivo: descarga
          ? `Descarga: ${Math.round(pct * PESO_EN_DESCARGA * 100)} % de tu máximo (${est1RM} kg)`
          : `${Math.round(pct * 100)} % de tu máximo estimado (${est1RM} kg)`,
      }
    }

    case 'doble': {
      if (!ultima || ultima.pesoKg == null) {
        return {
          ...base, pesoKg: null, fijadoAMano: false,
          motivo: 'Primera vez con este ejercicio. Elige un peso con el que llegues al rango sin fallar.',
        }
      }

      const rango = rangoReps(e.reps)
      const tope = rango?.[1]
      const completo = tope != null
        && ultima.reps.length > 0
        && ultima.reps.every(r => r >= tope)
      // Llegar al tope pero a fallo NO es señal de subir: es señal de que ese
      // peso todavía está justo. Con RIR 0 se repite semana.
      const conMargen = ultima.rirMin == null || ultima.rirMin >= 1

      if (descarga) {
        return {
          ...base, pesoKg: redondearCarga(ultima.pesoKg * PESO_EN_DESCARGA), fijadoAMano: false,
          motivo: 'Semana de descarga: menos series y algo menos de peso',
        }
      }

      if (completo && conMargen) {
        const paso = e.incremento ?? 2.5
        return {
          ...base, pesoKg: redondearCarga(ultima.pesoKg + paso, paso >= 2.5 ? 2.5 : 1), fijadoAMano: false,
          motivo: `Completaste ${tope} en todas las series. Toca subir.`,
        }
      }

      return {
        ...base, pesoKg: ultima.pesoKg, fijadoAMano: false,
        motivo: completo
          ? 'Llegaste al rango pero al fallo. Repite peso y consolídalo.'
          : `Mismo peso hasta cerrar las ${tope ?? ''} repeticiones en todas las series.`,
      }
    }

    case 'tiempo': {
      const previo = ultima?.duracion ?? e.duracion ?? null
      if (previo == null) {
        return { ...base, pesoKg: null, fijadoAMano: false, motivo: 'Aguanta lo que puedas y lo tomo de referencia.' }
      }
      const paso = e.incremento ?? 5
      return {
        ...base,
        duracion: descarga ? previo : previo + paso,
        pesoKg: null, fijadoAMano: false,
        motivo: descarga ? 'Descarga: mismo tiempo, menos series' : `${paso} segundos más que la última vez`,
      }
    }

    default:
      return {
        ...base, pesoKg: ultima?.pesoKg ?? null, fijadoAMano: false,
        motivo: 'Peso libre: elige tú',
      }
  }
}

// ── Lo que hace falta saber del historial ────────────────────────────────────

/**
 * La última vez que se hizo cada uno de estos ejercicios.
 *
 * En UNA consulta para todos los ejercicios del día, no una por ejercicio: un
 * día son seis ejercicios y seis viajes a la base para pintar una pantalla es
 * lo que hace que una app parezca lenta sin que nada esté roto.
 *
 * Solo mira las series con mérito: un calentamiento a 40 kg no puede convencer
 * a la progresión de que hay que bajar el peso de trabajo.
 */
export async function ultimasVeces(
  userId: string,
  claves: string[],
): Promise<Map<string, UltimaVez>> {
  const out = new Map<string, UltimaVez>()
  if (claves.length === 0) return out

  const { data } = await supabase
    .from('workout_sets')
    .select('exercise_key, weight_kg, reps, duration_seconds, rir, kind, performed_at, session_id')
    .eq('user_id', userId)
    .in('exercise_key', claves)
    .neq('kind', 'warmup')
    .order('performed_at', { ascending: false })
    .limit(400)

  for (const clave of claves) {
    const suyas = (data ?? []).filter(s => s.exercise_key === clave)
    if (suyas.length === 0) continue

    // Solo las de la ÚLTIMA sesión en que se hizo. Mezclar series de días
    // distintos daría un rango de repeticiones que nunca ocurrió.
    const ultimaSesion = suyas[0].session_id
    const delDia = suyas.filter(s => s.session_id === ultimaSesion)

    const rirs = delDia.map(s => s.rir).filter((r): r is number => r != null)

    out.set(clave, {
      pesoKg: delDia[0].weight_kg != null ? Number(delDia[0].weight_kg) : null,
      reps: delDia.map(s => s.reps).filter((r): r is number => r != null),
      rirMin: rirs.length > 0 ? Math.min(...rirs) : null,
      duracion: delDia[0].duration_seconds ?? null,
    })
  }

  return out
}

/** Los 1RM estimados de varios ejercicios, en una consulta. */
export async function maximos(userId: string, claves: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (claves.length === 0) return out

  const { data } = await supabase
    .from('personal_records')
    .select('exercise_key, value')
    .eq('user_id', userId)
    .eq('metric', 'est_1rm')
    .in('exercise_key', claves)

  for (const r of data ?? []) out.set(r.exercise_key, Number(r.value))
  return out
}

/**
 * La clave con la que se agrupa un ejercicio del plan.
 *
 * Tiene que dar EXACTAMENTE lo mismo que `claveEjercicio` del módulo de
 * sesiones, o la progresión buscaría el historial bajo una clave y las series
 * se habrían guardado bajo otra. Por eso se importa de allí en vez de repetir
 * la normalización aquí.
 */
export { claveEjercicio } from './workoutSessions'

// ── El día completo ──────────────────────────────────────────────────────────

export interface DiaPropuesto {
  semana: number
  dia: number
  nombre: string
  foco?: string
  esDescarga: boolean
  ejercicios: Propuesta[]
}

export async function proponerDia(
  userId: string,
  plan: Plan,
  semana: number,
  dia: number,
  deloadEvery: number | null,
  overrides: Record<string, number>,
): Promise<DiaPropuesto | null> {
  const delDia = plan.dias?.find(d => d.dia === dia)
  if (!delDia) return null

  const { claveEjercicio } = await import('./workoutSessions')
  const claves = delDia.ejercicios.map(e => claveEjercicio(e.slug, e.nombre))

  const [ultimas, maxs] = await Promise.all([
    ultimasVeces(userId, claves),
    maximos(userId, claves),
  ])

  const descarga = esDescarga(semana, deloadEvery)

  return {
    semana, dia,
    nombre: delDia.nombre,
    foco: delDia.foco,
    esDescarga: descarga,
    ejercicios: delDia.ejercicios.map((e, i) => proponer(e, semana, {
      est1RM: maxs.get(claves[i]) ?? null,
      ultima: ultimas.get(claves[i]) ?? null,
      override: overrides[claves[i]] ?? null,
      descarga,
    })),
  }
}

// ── Avanzar ──────────────────────────────────────────────────────────────────

export interface Avance {
  current_week: number
  current_day: number
  status: 'active' | 'completed'
  ended_at: string | null
}

/**
 * Dónde queda el programa después de terminar un día.
 *
 * Avanza AL TERMINAR una sesión, no al pulsar un botón: el programa va por
 * donde se ha entrenado, no por donde se ha dicho que se iba a entrenar.
 *
 * No se salta días que no se hicieron ni se castiga por saltárselos: quien no
 * entrena el jueves entrena el viernes y el programa sigue por donde iba. Un
 * calendario rígido convierte una semana ocupada en un programa abandonado.
 */
export function siguiente(
  semana: number,
  dia: number,
  diasPorSemana: number,
  semanasTotales: number,
): Avance {
  const haySiguienteDia = dia < diasPorSemana

  if (haySiguienteDia) {
    return { current_week: semana, current_day: dia + 1, status: 'active', ended_at: null }
  }

  if (semana < semanasTotales) {
    return { current_week: semana + 1, current_day: 1, status: 'active', ended_at: null }
  }

  return {
    current_week: semana, current_day: dia,
    status: 'completed', ended_at: new Date().toISOString(),
  }
}
