/**
 * SESIONES DE ENTRENAMIENTO · REGLAS
 * ──────────────────────────────────
 * Todo lo que hay que DECIDIR sobre una serie vive aquí: con qué clave se
 * agrupa un ejercicio, cuándo un 1RM estimado significa algo, qué cuenta como
 * récord y cómo se recalculan los totales de una sesión.
 *
 * Está en un módulo aparte por el mismo motivo que `socialAccess`: repartir
 * estas reglas por los controladores garantiza que dentro de tres meses dos
 * endpoints calculen el volumen de forma distinta y las estadísticas no cuadren
 * con el historial. Aquí solo hay una versión de cada regla.
 *
 * Lo que este módulo NO hace: decidir si alguien puede ver algo. Un
 * entrenamiento es de quien lo hizo y de nadie más, y eso se comprueba con un
 * `eq('user_id', …)` en cada consulta. No hay nada equivalente a una cuenta
 * privada que resolver.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import catalogo from '../data/exercises.json'

// ── El catálogo, para rellenar lo que la app no manda ────────────────────────
// Si una serie viene con slug del catálogo, el músculo lo pone el servidor: es
// dato del catálogo, no del teléfono, y así una estadística por grupo muscular
// no depende de que la app de hace seis versiones lo mandara bien.
const MUSCULO_POR_SLUG = new Map<string, string | null>(
  (catalogo.ejercicios as { slug: string; muscle: string | null }[])
    .map(e => [e.slug, e.muscle]),
)

/**
 * El grupo muscular de un slug del catálogo.
 *
 * Devuelve null cuando no se sabe, que es lo honesto, pero AVISA por el registro
 * si el slug venía puesto y no está en el catálogo. Es un fallo silencioso de
 * los caros: la serie se guarda bien, el historial del ejercicio funciona, y lo
 * único que pasa es que ese trabajo no aparece nunca en el mapa del cuerpo ni en
 * el reparto por músculo. Sin este aviso, la primera pista sería alguien
 * preguntando por qué su pecho está apagado después de entrenarlo.
 *
 * Pasa si se renombra un vídeo del catálogo sin migrar las series que ya lo
 * referenciaban, o si una versión vieja de la app manda un slug retirado.
 */
/**
 * El póster de un ejercicio del catálogo, por su clave.
 *
 * La clave de agrupación ES el slug cuando el ejercicio vino de la biblioteca,
 * así que con ella basta para encontrar la imagen. Lo escrito a mano no tiene
 * póster y devuelve null, que es lo honesto: la app pinta un hueco con su icono
 * en vez de inventarse una foto de otro ejercicio parecido.
 */
const POSTER_POR_CLAVE = new Map<string, string>(
  (catalogo.ejercicios as { slug: string; poster: string }[])
    .map(e => [e.slug, e.poster]),
)

export const posterDe = (clave: string): string | null =>
  POSTER_POR_CLAVE.get(clave) ?? null

export const musculoDe = (slug?: string | null): string | null => {
  if (!slug) return null
  const m = MUSCULO_POR_SLUG.get(slug)
  if (m === undefined) {
    logger.warn(`Slug fuera del catálogo: "${slug}". La serie se guarda sin músculo y no contará en el mapa del cuerpo.`)
    return null
  }
  return m
}

// ── Con qué se agrupa un ejercicio ───────────────────────────────────────────

/**
 * La clave de agrupación.
 *
 * Del catálogo se usa el slug, que es estable. Lo escrito a mano se normaliza
 * —minúsculas, sin acentos, sin espacios de más— porque «Press Banca», «press
 * banca» y «Press  banca» son el mismo ejercicio para quien los hizo, y si no
 * lo son para la base, el historial de ese ejercicio sale partido en tres y no
 * hay progresión que enseñar.
 *
 * No se intenta adivinar más que eso. «Press de banca» y «press banca» quedan
 * separados, y está bien: preferimos dos filas honestas a fusionar por
 * parecido dos ejercicios que resulten ser distintos.
 */
export function claveEjercicio(slug: string | null | undefined, nombre: string): string {
  if (slug) return slug
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Esfuerzo ─────────────────────────────────────────────────────────────────

/**
 * RIR y RPE son la misma escala del revés: RPE = 10 − RIR. Guardar las dos es
 * una conversión de unidades, no una invención — quien registra «me quedaban 2
 * repeticiones» está diciendo exactamente «esfuerzo 8».
 *
 * La conversión solo va en un sentido de forma completa: de RIR (entero) sale
 * siempre un RPE exacto. Al revés no: un RPE de 8,5 daría 1,5 repeticiones en
 * recámara, que la columna no admite y que además nadie diría. En ese caso se
 * deja el RIR vacío en lugar de redondear y ensuciar el dato.
 */
export function completarEsfuerzo(
  rir: number | null | undefined,
  rpe: number | null | undefined,
): { rir: number | null; rpe: number | null } {
  if (rir != null) return { rir, rpe: rpe ?? 10 - rir }
  if (rpe != null) {
    const derivado = 10 - rpe
    return { rpe, rir: Number.isInteger(derivado) && derivado >= 0 ? derivado : null }
  }
  return { rir: null, rpe: null }
}

// ── 1RM estimado ─────────────────────────────────────────────────────────────

export const TIPOS_SIN_MERITO = ['warmup', 'dropset'] as const

/**
 * Tope de repeticiones para estimar un 1RM: 12.
 *
 * Epley (peso × (1 + reps/30)) es fiable en el rango en que se entrena fuerza.
 * A 20 repeticiones afirma que alguien levantaría un 67 % más de lo que acaba
 * de mover, y a 30 el doble. Eso no es una estimación con más error: es un
 * número inventado que además dispararía «récords» falsos en cuanto alguien
 * hiciera una serie larga y ligera. Por encima de 12 se devuelve null, que es
 * la forma honesta de decir «con esta serie no se puede saber».
 */
export const MAX_REPS_1RM = 12

export function estimar1RM(
  loadType: string,
  kind: string,
  weightKg: number | null | undefined,
  reps: number | null | undefined,
): number | null {
  if (loadType !== 'weight') return null
  if ((TIPOS_SIN_MERITO as readonly string[]).includes(kind)) return null
  if (weightKg == null || weightKg <= 0) return null
  if (reps == null || reps < 1 || reps > MAX_REPS_1RM) return null
  if (reps === 1) return Math.round(weightKg * 100) / 100
  return Math.round(weightKg * (1 + reps / 30) * 100) / 100
}

// ── Totales de la sesión ─────────────────────────────────────────────────────

/**
 * Una serie tal y como sale de la base.
 *
 * Es la forma que devuelve `COLS_SERIE` del controlador. Está aquí y no allí
 * porque quien la CONSUME de verdad son las reglas de este módulo —totales,
 * récords, 1RM— y así no hay dos definiciones de la misma fila que puedan
 * separarse cuando se añada una columna.
 */
export interface SerieGuardada {
  id: string
  session_id: string
  client_id: string
  exercise_slug: string | null
  exercise_name: string
  exercise_key: string
  muscle: string | null
  order_index: number
  set_index: number
  kind: string
  load_type: string
  weight_kg: number | null
  band_color: string | null
  reps: number | null
  duration_seconds: number | null
  distance_m: number | null
  rir: number | null
  rpe: number | null
  rest_taken_seconds: number | null
  est_1rm: number | null
  notes: string | null
  performed_at: string
}

/**
 * Recalcula los totales de una sesión desde sus series.
 *
 * Se recalcula ENTERO en vez de sumar la serie nueva al total que ya había:
 * borrar o corregir una serie tiene que dejar el total bien, y un contador que
 * solo sabe sumar acaba desviándose sin que nadie se entere. Una sesión son
 * cuarenta series como mucho, así que rehacer la cuenta no cuesta nada.
 *
 * El CALENTAMIENTO no cuenta en los kilos movidos. Cinco series de barra vacía
 * inflarían el volumen de la semana y dirían que se entrenó más que nunca justo
 * cuando se entrenó igual.
 */
export function calcularTotales(
  series: Pick<SerieGuardada, 'kind' | 'load_type' | 'weight_kg' | 'reps'>[],
) {
  let total_reps = 0
  let total_volume_kg = 0

  for (const s of series) {
    if (s.reps) total_reps += s.reps
    if (s.kind === 'warmup') continue
    if (s.load_type === 'weight' && s.weight_kg && s.reps) {
      total_volume_kg += s.weight_kg * s.reps
    }
  }

  return {
    total_sets: series.length,
    total_reps,
    total_volume_kg: Math.round(total_volume_kg * 100) / 100,
  }
}

export async function refrescarTotales(sessionId: string): Promise<void> {
  const { data } = await supabase
    .from('workout_sets')
    .select('kind, load_type, weight_kg, reps')
    .eq('session_id', sessionId)

  const totales = calcularTotales(data ?? [])
  await supabase.from('workout_sessions').update(totales).eq('id', sessionId)
}

// ── Récords ──────────────────────────────────────────────────────────────────

export type Metrica = 'est_1rm' | 'max_weight' | 'max_reps' | 'max_duration' | 'max_distance'

export interface RecordNuevo {
  metric: Metrica
  value: number
  previous: number | null
  exerciseName: string
}

/**
 * Qué récords puede batir una serie.
 *
 * Cada modo de entrenar tiene su récord y todos hacen la misma ilusión: en el
 * gimnasio el 1RM, en calistenia las repeticiones, en una plancha el tiempo y
 * corriendo la distancia. Por eso no hay una columna «mejor marca» sino una
 * métrica por tipo de logro.
 *
 * `max_reps` solo cuenta donde NO hay kilos. Con peso, «30 repeticiones» no es
 * un récord sino una serie ligera, y aparecería como logro cada vez que alguien
 * hace un accesorio suave. Donde el peso es el cuerpo, en cambio, las
 * repeticiones son exactamente la marca.
 */
export function metricasDe(s: {
  kind: string
  load_type: string
  weight_kg: number | null
  reps: number | null
  duration_seconds: number | null
  distance_m: number | null
  est_1rm: number | null
}): { metric: Metrica; value: number }[] {
  if ((TIPOS_SIN_MERITO as readonly string[]).includes(s.kind)) return []

  const out: { metric: Metrica; value: number }[] = []

  if (s.est_1rm) out.push({ metric: 'est_1rm', value: s.est_1rm })
  if (s.load_type === 'weight' && s.weight_kg && s.weight_kg > 0 && s.reps && s.reps >= 1) {
    out.push({ metric: 'max_weight', value: s.weight_kg })
  }
  if (s.load_type !== 'weight' && s.reps && s.reps > 0) {
    out.push({ metric: 'max_reps', value: s.reps })
  }
  if (s.duration_seconds && s.duration_seconds > 0) {
    out.push({ metric: 'max_duration', value: s.duration_seconds })
  }
  if (s.distance_m && s.distance_m > 0) {
    out.push({ metric: 'max_distance', value: s.distance_m })
  }

  return out
}

/**
 * Guarda los récords que bata esta serie y devuelve cuáles fueron.
 *
 * El récord anterior NO se archiva: el histórico completo está en las series,
 * que es de donde se puede reconstruir entero si algún día hace falta. Una
 * tabla de récords que guarda todos los récords pasados es una segunda copia
 * del historial que puede contradecir a la primera.
 */
export async function registrarRecords(
  userId: string,
  sessionId: string,
  serie: SerieGuardada,
): Promise<RecordNuevo[]> {
  const candidatas = metricasDe(serie)
  if (candidatas.length === 0) return []

  const { data: actuales } = await supabase
    .from('personal_records')
    .select('metric, value')
    .eq('user_id', userId)
    .eq('exercise_key', serie.exercise_key)

  const previo = new Map<string, number>(
    (actuales ?? []).map(r => [r.metric as string, Number(r.value)]),
  )

  const batidos: RecordNuevo[] = []
  const filas = []

  for (const c of candidatas) {
    const anterior = previo.get(c.metric) ?? null
    if (anterior !== null && c.value <= anterior) continue

    filas.push({
      user_id: userId,
      exercise_key: serie.exercise_key,
      exercise_name: serie.exercise_name,
      metric: c.metric,
      value: c.value,
      weight_kg: serie.weight_kg,
      reps: serie.reps,
      set_id: serie.id,
      session_id: sessionId,
      achieved_at: serie.performed_at,
    })
    batidos.push({ metric: c.metric, value: c.value, previous: anterior, exerciseName: serie.exercise_name })
  }

  if (filas.length > 0) {
    await supabase
      .from('personal_records')
      .upsert(filas, { onConflict: 'user_id,exercise_key,metric' })
  }

  return batidos
}

/**
 * Rehace los récords de un ejercicio desde cero.
 *
 * Hace falta al BORRAR una serie: si el récord salió de la serie que se acaba
 * de corregir, se va con ella (la clave ajena lo borra en cascada) y el
 * anterior no está guardado en ninguna parte. Sin esto, corregir un 100 mal
 * tecleado dejaría a esa persona sin récord de ese ejercicio para siempre.
 *
 * Solo mira las series de UN ejercicio, que son las que el índice
 * `wset_user_exercise_time` sirve directamente.
 */
export async function rehacerRecords(userId: string, exerciseKey: string): Promise<void> {
  const { data: series } = await supabase
    .from('workout_sets')
    .select('id, exercise_key, exercise_name, kind, load_type, weight_kg, reps, duration_seconds, distance_m, est_1rm, performed_at, session_id')
    .eq('user_id', userId)
    .eq('exercise_key', exerciseKey)

  const mejores = new Map<string, { value: number; serie: any }>()

  for (const s of series ?? []) {
    for (const c of metricasDe(s as any)) {
      const actual = mejores.get(c.metric)
      if (!actual || c.value > actual.value) mejores.set(c.metric, { value: c.value, serie: s })
    }
  }

  await supabase
    .from('personal_records')
    .delete()
    .eq('user_id', userId)
    .eq('exercise_key', exerciseKey)

  if (mejores.size === 0) return

  await supabase.from('personal_records').insert(
    [...mejores.entries()].map(([metric, { value, serie }]) => ({
      user_id: userId,
      exercise_key: exerciseKey,
      exercise_name: serie.exercise_name,
      metric,
      value,
      weight_kg: serie.weight_kg,
      reps: serie.reps,
      set_id: serie.id,
      session_id: serie.session_id,
      achieved_at: serie.performed_at,
    })),
  )
}

// ── Sesiones olvidadas ───────────────────────────────────────────────────────

/**
 * Doce horas. Nadie entrena doce horas seguidas.
 *
 * La base solo admite UNA sesión abierta por persona, que es lo que hace que
 * «reanudar» no sea ambiguo. El precio de esa garantía es que una sesión que se
 * quedó abierta —se acabó la batería, se cerró la app y nadie volvió— bloquea
 * la siguiente para siempre. Esto es lo que la desatasca.
 */
const HORAS_PARA_OLVIDAR = 12

/**
 * Cierra las sesiones que se quedaron abiertas.
 *
 * Con series: se da por TERMINADA, no por descartada, y su duración se corta en
 * la última serie registrada. Lo que se hizo se hizo; lo que no se sabe es
 * cuánto rato se estuvo mirando el móvil después, y contarlo como parte del
 * entrenamiento inflaría la duración media de todo el mundo.
 *
 * Sin series: se borra. Es un botón mal pulsado, no un entrenamiento.
 */
export async function cerrarSesionesOlvidadas(): Promise<number> {
  const limite = new Date(Date.now() - HORAS_PARA_OLVIDAR * 3600_000).toISOString()

  const { data: abiertas } = await supabase
    .from('workout_sessions')
    .select('id, started_at')
    .eq('status', 'active')
    .lt('started_at', limite)

  if (!abiertas || abiertas.length === 0) return 0

  let cerradas = 0

  for (const s of abiertas) {
    const { data: series } = await supabase
      .from('workout_sets')
      .select('performed_at, kind, load_type, weight_kg, reps')
      .eq('session_id', s.id)
      .order('performed_at', { ascending: false })

    if (!series || series.length === 0) {
      await supabase.from('workout_sessions').delete().eq('id', s.id)
      cerradas++
      continue
    }

    const ultima = series[0].performed_at
    const duracion = Math.max(
      0,
      Math.round((new Date(ultima).getTime() - new Date(s.started_at).getTime()) / 1000),
    )

    await supabase
      .from('workout_sessions')
      .update({
        status: 'completed',
        ended_at: ultima,
        duration_seconds: duracion,
        ...calcularTotales(series as SerieGuardada[]),
      })
      .eq('id', s.id)
    cerradas++
  }

  return cerradas
}
