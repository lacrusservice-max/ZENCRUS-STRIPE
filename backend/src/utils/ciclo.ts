/**
 * CICLO · LO QUE EL SERVIDOR TAMBIÉN TIENE QUE SABER
 * ═══════════════════════════════════════════════════════════════════════════
 * Dos cosas que existen ya en el móvil y que aquí NO son un duplicado por
 * descuido, sino una decisión:
 *
 *   1. Los esquemas de los 14 trackers.
 *   2. La deducción de los periodos a partir del sangrado.
 *
 * ── Por qué los esquemas están en los dos lados ────────────────────────────
 * Porque un esquema que solo valida en el cliente no valida nada: cualquiera
 * con el token puede escribir directamente contra la API. Estas ocho tablas
 * son las más sensibles del proyecto —el historial reproductivo de una
 * persona—, así que lo que entra se comprueba aquí aunque ya se hubiera
 * comprobado allí.
 *
 * ── Y por qué la deducción también ─────────────────────────────────────────
 * `cycle_periods` es una vista materializada de `cycle_logs`, no una segunda
 * fuente. Se recalcula EN LA MISMA PETICIÓN en que cambian los registros, así
 * que no puede quedarse vieja. Si en vez de eso se guardara lo que el móvil
 * dedujo, dos versiones distintas de la app escribirían periodos distintos
 * sobre los mismos datos y el historial dependería de quién sincronizó último.
 *
 * ── La regla al copiar ─────────────────────────────────────────────────────
 * Si algo de esto cambia, cambia en los dos sitios A LA VEZ:
 *   frontend/src/features/salud/ciclo/periodos.ts
 *   frontend/src/features/salud/trackers.ts
 * Un umbral distinto entre cliente y servidor produce el peor fallo posible
 * aquí: la app enseña un ciclo y la base guarda otro.
 */

import { z } from 'zod'

// ═══ Trackers ══════════════════════════════════════════════════════════════

export const TRACKER_KINDS = [
  'sangrado', 'dolor', 'animo', 'energia', 'flujo', 'digestion', 'piel',
  'sueno', 'libido', 'temperatura_basal', 'prueba', 'anticoncepcion',
  'medicacion', 'perimenopausia',
] as const

export type TrackerKind = typeof TRACKER_KINDS[number]

const ZONAS_DOLOR = [
  'cabeza', 'pecho', 'abdomen_bajo', 'ovarios', 'lumbar', 'piernas',
  'articulaciones', 'vulva',
] as const

export const TRACKER_SCHEMAS: Record<TrackerKind, z.ZodTypeAny> = {
  sangrado: z.object({
    level: z.number().int().min(0).max(4),
    spotting: z.boolean().optional(),
  }),

  dolor: z.object({
    zones: z.array(z.object({
      id: z.enum(ZONAS_DOLOR),
      intensity: z.number().int().min(1).max(10),
    })).min(1).max(8),
  }),

  animo: z.object({
    valence: z.number().min(-1).max(1),
    arousal: z.number().min(-1).max(1),
    tags: z.array(z.string().max(24)).max(5).optional(),
  }),

  energia: z.object({ level: z.number().int().min(1).max(5) }),

  flujo: z.object({
    texture: z.enum(['seco', 'pegajoso', 'cremoso', 'acuoso', 'clara_huevo']),
    amount: z.enum(['poco', 'medio', 'abundante']).optional(),
  }),

  digestion: z.object({
    tags: z.array(z.enum([
      'hinchazon', 'nauseas', 'estrenimiento', 'diarrea', 'gases',
      'acidez', 'antojos', 'sin_apetito',
    ])).min(1),
  }),

  piel: z.object({
    tags: z.array(z.enum(['acne', 'grasa', 'seca', 'sensible', 'normal'])).min(1),
    zones: z.array(z.enum(['frente', 'mejillas', 'menton', 'espalda'])).optional(),
  }),

  sueno: z.object({
    hours: z.number().min(0).max(24),
    quality: z.enum(['mal', 'regular', 'bien', 'excelente']).optional(),
    source: z.enum(['manual', 'wearable']).default('manual'),
  }),

  libido: z.object({
    desire: z.number().int().min(1).max(5).optional(),
    activity: z.enum(['ninguna', 'protegida', 'sin_proteccion', 'solitaria']).optional(),
  }),

  /* Dos decimales: el salto térmico que confirma la ovulación mide unas dos
     décimas y con un solo decimal se pierde en el redondeo. */
  temperatura_basal: z.object({
    celsius: z.number().min(34).max(42),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    disturbed: z.boolean().optional(),
  }),

  /* `photoLocalUri` se acepta y se DESCARTA antes de escribir: la foto de un
     test nunca sale del teléfono. Ver `limpiar` más abajo. */
  prueba: z.object({
    type: z.enum(['ovulacion', 'embarazo']),
    result: z.enum(['positivo', 'negativo', 'invalido']),
    photoLocalUri: z.string().optional(),
  }),

  anticoncepcion: z.object({
    method: z.enum([
      'ninguno', 'pildora', 'diu_hormonal', 'diu_cobre', 'implante',
      'inyeccion', 'parche', 'anillo', 'barrera', 'natural',
    ]),
    taken: z.boolean().optional(),
  }),

  medicacion: z.object({
    items: z.array(z.object({
      name: z.string().min(1).max(60),
      taken: z.boolean(),
    })).min(1).max(40),
  }),

  perimenopausia: z.object({
    tags: z.array(z.enum([
      'sofocos', 'sudores_nocturnos', 'sequedad', 'insomnio',
      'niebla_mental', 'palpitaciones', 'cambios_animo',
    ])).min(1),
    severity: z.number().int().min(1).max(5).optional(),
  }),
}

/**
 * Valida y limpia el valor de un tracker.
 *
 * Devuelve `null` si no pasa. No lanza: un registro mal formado dentro de un
 * lote de doscientos no debe tumbar los otros ciento noventa y nueve.
 */
export function limpiarTracker(kind: TrackerKind, value: unknown): unknown | null {
  const esquema = TRACKER_SCHEMAS[kind]
  if (!esquema) return null

  const r = esquema.safeParse(value)
  if (!r.success) return null

  /* La ruta de la foto de un test se descarta aquí, y no en el móvil, porque
     lo que importa es que NUNCA se escriba: si la limpieza viviera solo en el
     cliente, bastaría una versión vieja de la app para empezar a guardar
     rutas de fotos de tests de embarazo en la base. */
  if (kind === 'prueba') {
    const { photoLocalUri, ...resto } = r.data as Record<string, unknown>
    return resto
  }
  return r.data
}

// ═══ Periodos ══════════════════════════════════════════════════════════════

/** A partir de aquí cuenta como menstruación. El nivel 1 es manchado. */
const SANGRADO_MINIMO = 2
/** Días sin sangrado que cierran una menstruación. */
const SEPARACION_MIN = 3
/** Ningún ciclo humano dura menos. Es la guarda contra el periodo fantasma. */
const CICLO_MIN = 15

const DIA_MS = 86_400_000

export function diasEntre(a: string, b: string): number {
  const [a1, m1, d1] = a.split('-').map(Number)
  const [a2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / DIA_MS)
}

export interface PeriodoDerivado {
  inicio: string
  fin: string | null
  diasSangrado: number
  duracionCiclo: number | null
  declarado: boolean
}

/**
 * Reconstruye los periodos a partir de los registros de sangrado.
 *
 * **La ausencia de registro NO es ausencia de sangrado.** Un día sin apuntar es
 * un día desconocido, no un día seco. Por eso ninguna separación se calcula
 * contando días sin registro: se cuenta de día CON sangrado a día CON sangrado.
 * Confundirlo parte periodos cada vez que alguien se salta un día, y con
 * periodos partidos las medias se hunden.
 *
 * Copia exacta de `frontend/src/features/salud/ciclo/periodos.ts`.
 */
export function derivarPeriodos(
  sangrados: Array<{ fecha: string; nivel: number }>,
  declarados: string[] = [],
): PeriodoDerivado[] {
  const conSangrado = sangrados
    .filter(s => s.nivel >= SANGRADO_MINIMO)
    .map(s => s.fecha)

  const forzados = new Set(declarados)
  const dias = [...new Set([...conSangrado, ...declarados])].sort()
  if (!dias.length) return []

  const periodos: PeriodoDerivado[] = []
  let inicio = dias[0]
  let ultimo = dias[0]
  let cuenta = 1

  const cerrar = (fin: string, n: number) => {
    periodos.push({
      inicio, fin, diasSangrado: n, duracionCiclo: null,
      declarado: forzados.has(inicio),
    })
  }

  for (let i = 1; i < dias.length; i++) {
    const dia = dias[i]
    const separacion = diasEntre(ultimo, dia)
    const desdeInicio = diasEntre(inicio, dia)
    const declarado = forzados.has(dia)

    if (declarado || (separacion >= SEPARACION_MIN && desdeInicio >= CICLO_MIN)) {
      cerrar(ultimo, cuenta)
      inicio = dia
      ultimo = dia
      cuenta = 1
      continue
    }

    // Sangrado suelto dentro del ciclo: no abre periodo y no se cuenta como día
    // de menstruación. Es sangrado intermenstrual, y lo informa el cliente.
    if (separacion >= SEPARACION_MIN) continue

    ultimo = dia
    cuenta++
  }

  cerrar(ultimo, cuenta)

  /* La duración se conoce al saber cuándo empezó el siguiente. La del último
     se queda en null a propósito: rellenarla con la media sería guardar una
     estimación como si fuera un hecho, y la migración 018 lo dice en la propia
     columna. */
  for (let i = 0; i < periodos.length - 1; i++) {
    periodos[i].duracionCiclo = diasEntre(periodos[i].inicio, periodos[i + 1].inicio)
  }

  return periodos
}
