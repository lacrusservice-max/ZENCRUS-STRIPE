/**
 * TRADUCCIÓN DE LO QUE YA ESTÁ EN EL TELÉFONO
 * ───────────────────────────────────────────
 * Convierte lo guardado en AsyncStorage por los siete stores de siempre a lo
 * que esperan los endpoints de `/tracking`. Son funciones puras, sin
 * AsyncStorage ni red, y viven aparte por un motivo concreto: es el código que
 * toca datos que nadie validó nunca.
 *
 * Un histórico de teléfono lleva años de escrituras de versiones distintas de
 * la app: pesos a cero de cuando la pantalla dejaba guardar vacío, un
 * porcentaje de grasa de 180 por un dedazo, fechas en ISO completo donde ahora
 * se espera `YYYY-MM-DD`, hábitos borrados hace meses con registros huérfanos.
 * Todo eso se sube UNA vez y para siempre, y una sola fila mala devuelve 422 y
 * tumba el lote entero — con él, meses de historial bueno.
 *
 * Por eso se sanea antes y por eso está separado: para poder probarlo con datos
 * feos de verdad en vez de confiar en que el formato sea el que uno recuerda.
 */

import type { NuevaMedicion, NuevaMeta } from '@/services/trackingService'

/** Los rangos que acepta el servidor, que son los `check` de las tablas. */
const RANGOS: Record<string, [number, number]> = {
  weight: [20, 400], bodyFatPct: [1, 70], muscleMassPct: [1, 80],
  neck: [10, 100], shoulders: [40, 200], chest: [40, 200],
  waist: [30, 250], hips: [40, 250],
  leftArm: [10, 100], rightArm: [10, 100],
  leftThigh: [20, 120], rightThigh: [20, 120],
}

export const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** Las llaves de los cinco hábitos de fábrica, que ya siembra el servidor. */
export const HABITOS_DE_FABRICA = new Set(['sleep', 'water', 'workout', 'protein', 'mind'])

/**
 * Las cuatro medidas de mentira que `bodyMeasurementsStore` sembraba cuando no
 * había datos. Sus ids son `m0`…`m3`; las de verdad, `m_<timestamp>`.
 *
 * No se migran. Subirlas las volvería permanentes y ZENA razonaría sobre un
 * cuerpo que no existe: le diría a alguien que lleva tres semanas bajando de
 * peso cuando no se ha pesado nunca.
 */
export const esMedidaDeMentira = (id: unknown): boolean =>
  typeof id === 'string' && /^m\d+$/.test(id)

/**
 * Deja solo los valores que están dentro de rango y devuelve `null` si no
 * sobrevive ninguno: una fila sin ninguna medida no es un dato, es ruido, y el
 * servidor la rechazaría con razón.
 */
export function saneaMedicion(
  clientId: string,
  date: unknown,
  campos: Record<string, unknown>,
  note?: unknown,
): NuevaMedicion | null {
  const fecha = String(date ?? '').slice(0, 10)
  if (!ES_FECHA.test(fecha)) return null

  const limpia: Record<string, number> = {}
  for (const [campo, [min, max]] of Object.entries(RANGOS)) {
    const v = campos[campo]
    if (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) limpia[campo] = v
  }
  if (Object.keys(limpia).length === 0) return null

  return {
    clientId,
    date: fecha,
    source: 'import',
    ...(typeof note === 'string' && note ? { note: note.slice(0, 500) } : {}),
    ...limpia,
  }
}

/**
 * Las tres procedencias del peso y las medidas, fusionadas.
 *
 * Los prefijos no son decorativos: los tres orígenes generaban sus ids con
 * `Date.now()`, y dos filas creadas en el mismo milisegundo compartirían
 * `clientId` — con lo que una pisaría a la otra al subir, porque esa es
 * justamente la llave de idempotencia.
 */
export function medicionesDelLegado(fuentes: {
  pesos?: any[]
  medidas?: any[]
  cuerpo?: any[]
}): NuevaMedicion[] {
  return [
    ...(fuentes.pesos ?? [])
      .filter(e => e?.id != null)
      .map(e => saneaMedicion(`w_${e.id}`, e.date, { weight: e.weight }, e.note)),

    // `bodyFat` es el único nombre que no coincide con el de la tabla.
    ...(fuentes.medidas ?? [])
      .filter(e => e?.id != null)
      .map(e => saneaMedicion(`me_${e.id}`, e.date, { ...e, bodyFatPct: e.bodyFat })),

    ...(fuentes.cuerpo ?? [])
      .filter(m => m?.id != null && !esMedidaDeMentira(m.id))
      .map(m => saneaMedicion(`bm_${m.id}`, m.date, m, m.note)),
  ].filter((m): m is NuevaMedicion => m !== null)
}

export interface DiaLegado {
  date: string
  loggedFood: boolean
  loggedWorkout: boolean
  checkInDone: boolean
  drankWater: boolean
  protegido: boolean
}

/**
 * La actividad de cada día y los días salvados con un protector.
 *
 * Las cinco banderas van SIEMPRE completas: en un `upsert` de varias filas
 * PostgREST une las columnas de todas y rellena con el valor por defecto las
 * que falten en alguna, así que un día parcial pondría el resto a `false`.
 */
export function diasDelLegado(
  actividades: Array<{ date: string; datos: any }>,
  protegidos: string[] = [],
): DiaLegado[] {
  const salvados = new Set(protegidos.filter(f => ES_FECHA.test(f)))

  const dias: DiaLegado[] = actividades
    .filter(a => ES_FECHA.test(a.date))
    .map(a => ({
      date: a.date,
      loggedFood: !!a.datos?.loggedFood,
      loggedWorkout: !!a.datos?.loggedWorkout,
      checkInDone: !!a.datos?.checkInDone,
      // El store lo llamaba `drank8Glasses`.
      drankWater: !!a.datos?.drank8Glasses,
      protegido: salvados.has(a.date),
    }))

  // Un día protegido puede no tener fila de actividad: es justo un día en el
  // que no se hizo nada. Sin añadirlo, la cadena se rompería al reconstruirla y
  // el usuario perdería la racha que el protector le había salvado.
  const conFila = new Set(dias.map(d => d.date))
  for (const fecha of salvados) {
    if (!conFila.has(fecha)) {
      dias.push({
        date: fecha,
        loggedFood: false, loggedWorkout: false, checkInDone: false,
        drankWater: false, protegido: true,
      })
    }
  }

  return dias
}

/** De `fecha → hábito → cumplido` a una lista plana, que es lo que sube. */
export function registrosDeHabitos(
  logs: Record<string, Record<string, boolean>> | null | undefined,
): Array<{ habitKey: string; date: string; hecho: boolean }> {
  return Object.entries(logs ?? {})
    .filter(([date]) => ES_FECHA.test(date))
    .flatMap(([date, dia]) =>
      Object.entries(dia ?? {}).map(([habitKey, hecho]) => ({ habitKey, date, hecho: !!hecho })),
    )
}

/** Los hábitos propios. Los cinco de fábrica los siembra el servidor. */
export function habitosDelLegado(
  habitos: any[] | null | undefined,
): Array<{ habitKey: string; label: string; icon: string }> {
  return (habitos ?? [])
    .filter(h => typeof h?.id === 'string' && h.id && !HABITOS_DE_FABRICA.has(h.id))
    .map(h => ({
      habitKey: h.id,
      label: String(h.label ?? h.id).slice(0, 120),
      icon: String(h.icon ?? 'checkmark').slice(0, 60),
    }))
}

const TIPOS_META = new Set(['weight', 'workout_frequency', 'streak', 'custom'])
const DIRECCIONES = new Set(['increase', 'decrease'])

/**
 * Una meta del store, con las fechas recortadas.
 *
 * `goalProgress.ts` documenta `startDate` como «ISO», y una meta guardada con
 * la hora dentro no pasa el formato que pide el servidor. Y una que termina
 * antes de empezar la rechaza —con razón— así que se descarta aquí en vez de
 * gastar el intento.
 */
export function metaDelLegado(g: any): NuevaMeta | null {
  if (!g?.id) return null

  const startDate = String(g.startDate ?? '').slice(0, 10)
  const targetDate = String(g.targetDate ?? '').slice(0, 10)
  if (!ES_FECHA.test(startDate) || !ES_FECHA.test(targetDate) || targetDate < startDate) return null
  if (!TIPOS_META.has(g.type) || !DIRECCIONES.has(g.direction)) return null

  const startValue = Number(g.startValue)
  const targetValue = Number(g.targetValue)
  if (!Number.isFinite(startValue) || !Number.isFinite(targetValue)) return null

  return {
    clientId: `g_${g.id}`,
    title: String(g.title ?? 'Meta').slice(0, 200) || 'Meta',
    type: g.type,
    direction: g.direction,
    startValue,
    targetValue,
    startDate,
    targetDate,
    unit: String(g.unit ?? '').slice(0, 40) || 'kg',
  }
}
