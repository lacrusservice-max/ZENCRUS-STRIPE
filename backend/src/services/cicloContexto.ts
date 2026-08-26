/**
 * EL CICLO, PARA QUIEN LO NECESITE SABER
 * ═══════════════════════════════════════════════════════════════════════════
 * Qué fase del ciclo es hoy y qué se registró, en un formato que ZENA —y
 * cualquier otra parte de la app— pueda leer sin conocer el motor entero.
 *
 * Es la pieza que hace que el módulo deje de ser una isla: los datos ya
 * estaban, pero no salían de sus nueve pantallas. Una coach que no sabe que
 * estás en el día 26 te dice que subas cargas justo cuando el cuerpo pide lo
 * contrario, y no por falta de criterio: por falta de dato.
 *
 * ── Devuelve `null` mucho más de lo que devuelve datos, y está bien ────────
 * Sin el módulo, sin historial, o en un modo que no predice —embarazo, sin
 * ciclo—, aquí no hay nada que decir. Devolver `null` es la respuesta correcta;
 * inventar una fase para que la coach tenga algo que comentar sería justo el
 * fallo que este módulo existe para no cometer.
 *
 * ── Y para quien no tiene el módulo, el ciclo NO EXISTE ────────────────────
 * No es que se calle: es que ZENA no debe saber que existe. Si le llegara «esta
 * usuaria no tiene ciclo activado», bastaría una pregunta bien hecha para que
 * lo mencionara, y la función fantasma dejaría de serlo. Por eso aquí se sale
 * antes de leer nada más.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import { diasEntre } from '../utils/ciclo'
import { FASES, type FaseCiclo } from './cicloExperto'

/* ── El cálculo de fases ────────────────────────────────────────────────────
   Copia exacta de `frontend/src/features/salud/ciclo/prediccion.ts`. Es la
   TERCERA copia de lógica de ciclo que vive en los dos lados —las otras son
   `derivarPeriodos` y los esquemas de trackers—, y como aquellas: si cambia,
   cambia en ambos a la vez. Fijar la ovulación en el día 14 es el error de
   toda la categoría; lo estable es la lútea y por eso se cuenta hacia atrás
   desde el final. ───────────────────────────────────────────────────────── */

const CICLO_MIN = 15
const CICLO_MAX = 60
const LUTEA = 14
const POBLACION = { duracion: 28, sangrado: 5 } as const

interface Marco {
  duracion: number
  diasPeriodo: number
  diaOvulacion: number
  limites: Record<FaseCiclo, number>
}

function marcoFases(duracion: number, diasPeriodo: number): Marco {
  const dur = Math.max(CICLO_MIN, Math.min(CICLO_MAX, Math.round(duracion)))
  const periodo = Math.max(1, Math.min(10, Math.round(diasPeriodo)))
  const diaOvulacion = Math.max(periodo + 3, Math.min(dur - 8, dur - LUTEA))

  return {
    duracion: dur,
    diasPeriodo: periodo,
    diaOvulacion,
    limites: {
      menstrual: 1,
      folicular: periodo + 1,
      ovulatoria: Math.max(periodo + 1, diaOvulacion - 2),
      lutea: diaOvulacion + 3,
    },
  }
}

function faseDeDia(dia: number, marco: Marco): FaseCiclo {
  const l = marco.limites
  if (dia >= l.lutea) return 'lutea'
  if (dia >= l.ovulatoria) return 'ovulatoria'
  if (dia >= l.folicular) return 'folicular'
  return 'menstrual'
}

/* ── Lo que sale de aquí ───────────────────────────────────────────────── */

export interface ContextoCiclo {
  fase: FaseCiclo
  diaDeCiclo: number
  duracionTipica: number
  /** De dónde sale la duración. Cambia cuánto se puede afirmar. */
  fuente: 'medida' | 'declarada' | 'poblacional'
  /** Días hasta el inicio previsto. Negativo si ya se pasó. */
  diasParaLaRegla: number
  /** Lo que registró HOY, en palabras. Vacío si no registró nada. */
  hoy: {
    sangrado: number | null
    energia: number | null
    animo: string | null
    sintomas: string[]
    antojos: string[]
    entrenamiento: string | null
  }
  anticonceptivo: string | null
  /** Modos donde no se predice: la coach debe cambiar el tono, no el tema. */
  modo: string
}

/**
 * El contexto de hoy, o `null` si no hay nada honesto que decir.
 *
 * No lanza nunca: si algo falla, la coach sigue funcionando sin esta parte. Un
 * fallo leyendo el ciclo no puede tumbar el chat entero.
 */
export async function contextoDeCiclo(userId: string): Promise<ContextoCiclo | null> {
  try {
    const { data: perfil } = await supabase
      .from('health_profile')
      .select('cycle_enabled, life_mode, avg_cycle_days, avg_period_days, declared_cycle_days, declared_period_days, contraception')
      .eq('user_id', userId)
      .maybeSingle()

    // Sin módulo, el ciclo no existe. Ni para ZENA.
    if (!perfil?.cycle_enabled) return null

    // En estos modos no hay fase que calcular y forzarla sería inventar.
    const modo = String(perfil.life_mode ?? 'seguimiento')
    if (modo === 'embarazo' || modo === 'sin_ciclo' || modo === 'posparto') return null

    const { data: periodos } = await supabase
      .from('cycle_periods')
      .select('start_date')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(1)

    const ultimo = periodos?.[0]?.start_date as string | undefined
    if (!ultimo) return null

    /* La duración, por orden de fiabilidad: medida > declarada > población.
       `fuente` viaja con el dato para que la coach pueda decir «según lo que
       hemos medido» o «según lo que me contaste», que no es lo mismo. */
    const medida = perfil.avg_cycle_days as number | null
    const declarada = perfil.declared_cycle_days as number | null
    const duracion = medida ?? declarada ?? POBLACION.duracion
    const fuente: ContextoCiclo['fuente'] =
      medida ? 'medida' : declarada ? 'declarada' : 'poblacional'

    const sangrado = (perfil.avg_period_days as number | null)
      ?? (perfil.declared_period_days as number | null)
      ?? POBLACION.sangrado

    const hoyISO = new Date().toISOString().slice(0, 10)
    const marco = marcoFases(duracion, sangrado)

    /* El día de ciclo NO se recorta al tamaño del ciclo: un día 34 en un ciclo
       de 28 significa retraso, y aplastarlo a 28 escondería justo eso. */
    const diaDeCiclo = diasEntre(ultimo, hoyISO) + 1
    if (diaDeCiclo < 1) return null

    const fase = faseDeDia(Math.min(diaDeCiclo, marco.duracion), marco)
    const diasParaLaRegla = marco.duracion - diaDeCiclo + 1

    const { data: logs } = await supabase
      .from('cycle_logs')
      .select('kind, value')
      .eq('user_id', userId)
      .eq('log_date', hoyISO)

    return {
      fase,
      diaDeCiclo,
      duracionTipica: marco.duracion,
      fuente,
      diasParaLaRegla,
      hoy: resumirDia(logs ?? []),
      anticonceptivo: (perfil.contraception as string | null) ?? null,
      modo,
    }
  } catch (err) {
    logger.error('contextoDeCiclo error:', err)
    return null
  }
}

const ANIMO_ET = (v: number, a: number): string => {
  if (v > 0.6) return 'contenta'
  if (v > 0.2) return a < 0 ? 'tranquila' : 'bien'
  if (v > -0.35) return 'sensible'
  return a > 0.4 ? 'irritable' : 'baja de ánimo'
}

const ZONA_ET: Record<string, string> = {
  abdomen_bajo: 'cólicos', cabeza: 'dolor de cabeza', lumbar: 'dolor lumbar',
  pecho: 'sensibilidad en senos', ovarios: 'dolor de ovarios',
  piernas: 'dolor muscular', articulaciones: 'dolor articular', vulva: 'molestia vulvar',
}

const TAG_ET: Record<string, string> = {
  hinchazon: 'hinchazón', nauseas: 'náuseas', diarrea: 'diarrea',
  estrenimiento: 'estreñimiento', acne: 'acné', grasa: 'piel grasa', seca: 'piel seca',
}

const ENTRENO_ET: Record<string, string> = {
  no_entrene: 'no entrenó', con_energia: 'entrenó con energía',
  cansada: 'entrenó cansada', con_dolor: 'entrenó con molestias',
  motivada: 'entrenó motivada',
}

/** Los registros crudos del día, en palabras que un modelo pueda usar. */
function resumirDia(logs: { kind: string; value: unknown }[]): ContextoCiclo['hoy'] {
  const por = new Map(logs.map(l => [l.kind, l.value as Record<string, unknown>]))

  const dolor = (por.get('dolor')?.zones as { id: string }[] | undefined) ?? []
  const dig = (por.get('digestion')?.tags as string[] | undefined) ?? []
  const piel = (por.get('piel')?.tags as string[] | undefined) ?? []
  const animo = por.get('animo') as { valence?: number; arousal?: number } | undefined

  return {
    sangrado: (por.get('sangrado')?.level as number | undefined) ?? null,
    energia: (por.get('energia')?.level as number | undefined) ?? null,
    animo: animo && typeof animo.valence === 'number'
      ? ANIMO_ET(animo.valence, animo.arousal ?? 0)
      : null,
    sintomas: [
      ...dolor.map(z => ZONA_ET[z.id] ?? z.id),
      ...dig.map(t => TAG_ET[t] ?? t),
      ...piel.map(t => TAG_ET[t] ?? t),
    ],
    antojos: (por.get('antojos')?.tags as string[] | undefined) ?? [],
    entrenamiento: ENTRENO_ET[por.get('entrenamiento')?.estado as string] ?? null,
  }
}

/**
 * El contexto, escrito para meterlo en el prompt del sistema.
 *
 * Devuelve cadena vacía cuando no hay contexto, para poder concatenarlo sin
 * comprobar nada en quien llama.
 *
 * Las tres reglas del final no son adorno. Sin la primera, la coach empieza a
 * prometer rendimiento por fase, que es lo que la evidencia de 2023-2025 no
 * sostiene. Sin la segunda, saca el tema del ciclo en una conversación sobre
 * pollo a la plancha. Sin la tercera, diagnostica.
 */
export function cicloParaPrompt(c: ContextoCiclo | null): string {
  if (!c) return ''

  const f = FASES[c.fase]
  const reg = c.hoy
  const registrado = [
    reg.sangrado ? `sangrado nivel ${reg.sangrado} de 5` : null,
    reg.energia ? `energía ${reg.energia} de 5` : null,
    reg.animo,
    reg.sintomas.length ? `síntomas: ${reg.sintomas.join(', ')}` : null,
    reg.antojos.length ? `antojos: ${reg.antojos.join(', ')}` : null,
    reg.entrenamiento,
  ].filter(Boolean).join(' · ')

  const certeza = c.fuente === 'medida'
    ? 'medida sobre sus propios ciclos'
    : c.fuente === 'declarada'
      ? 'la que ella declaró, aún sin confirmar con historial'
      : 'la media de la población, porque aún no hay historial suyo'

  return `
=== CICLO MENSTRUAL (hoy) ===
- Fase: ${f.etiqueta} · día ${c.diaDeCiclo} de un ciclo de ${c.duracionTipica} días (${certeza})
- Faltan ${c.diasParaLaRegla} días para la regla prevista
- Qué favorece esta fase: ${f.favorece}
- Alimentación que encaja: ${f.comer}
- Movimiento que encaja: ${f.entrenar}
${registrado ? `- Registrado hoy: ${registrado}` : '- Hoy no ha registrado nada todavía'}
${c.anticonceptivo ? `- Usa anticoncepción: ${c.anticonceptivo}. Su ciclo no refleja fluctuaciones hormonales naturales; habla de bienestar general, no de ventanas hormonales.` : ''}

CÓMO USAR ESTO:
1. NO prometas rendimiento por fase. La evidencia sobre fuerza e hipertrofia según
   la fase es débil e inconsistente; lo que sí se sostiene es el manejo de
   síntomas y el bienestar. Habla en esos términos.
2. No saques el tema si no viene a cuento. Úsalo para AJUSTAR lo que ya te
   preguntaron —por qué hoy pide más comida, por qué esa sesión costó más— no
   para convertir cada respuesta en una charla sobre el ciclo.
3. No diagnostiques nada. Ante dolor incapacitante, sangrado muy abundante o
   ciclos que cambian de golpe, sugiere consultar a un profesional, con calidez
   y sin alarmar.
`.trim()
}
