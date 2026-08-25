/**
 * LOS 14 TRACKERS DEL CICLO
 * ═══════════════════════════════════════════════════════════════════════════
 * El contrato de datos del registro diario. Cada tracker tiene su propia forma
 * y su propio esquema: no hay un `value: any` en todo el archivo.
 *
 * ── Por qué cada uno tiene su forma ────────────────────────────────────────
 * La tentación es guardar todo como una lista de etiquetas y pintar la misma
 * rejilla de chips para los catorce. Es más rápido de escribir y es peor
 * producto: el dolor tiene zona e intensidad, el ánimo tiene dos ejes, la
 * temperatura tiene decimales que importan. Aplanarlos a chips pierde el dato
 * y obliga a la usuaria a traducir lo que siente al vocabulario de la app.
 *
 * ── Estos esquemas se usan en los dos lados ────────────────────────────────
 * El mismo `parse` corre en el cliente antes de guardar y en el servidor antes
 * de escribir. Un esquema que solo valida en el cliente no valida nada.
 */

import { z } from 'zod'

// ── Identidad ───────────────────────────────────────────────────────────────

export const TRACKER_KINDS = [
  'sangrado', 'dolor', 'animo', 'energia', 'flujo', 'digestion', 'piel',
  'sueno', 'libido', 'temperatura_basal', 'prueba', 'anticoncepcion',
  'medicacion', 'perimenopausia',
] as const

export type TrackerKind = typeof TRACKER_KINDS[number]

// ── 1 · Sangrado ────────────────────────────────────────────────────────────

/** Cinco niveles. El 0 existe y significa «hoy no», que es un dato, no un hueco. */
export const sangradoSchema = z.object({
  level: z.number().int().min(0).max(4),
  spotting: z.boolean().optional(),
})

// ── 2 · Dolor ───────────────────────────────────────────────────────────────

export const ZONAS_DOLOR = [
  'cabeza', 'pecho', 'abdomen_bajo', 'ovarios', 'lumbar', 'piernas',
  'articulaciones', 'vulva',
] as const

/**
 * Zona + intensidad, no una etiqueta suelta.
 *
 * «Cólicos» no dice si fueron molestos o incapacitantes, y esa diferencia es
 * justamente la que importa para detectar un patrón o para llevarlo al médico.
 */
export const dolorSchema = z.object({
  zones: z.array(z.object({
    id: z.enum(ZONAS_DOLOR),
    intensity: z.number().int().min(1).max(10),
  })).min(1),
})

// ── 3 · Ánimo ───────────────────────────────────────────────────────────────

/**
 * Dos ejes, no una lista de emociones.
 *
 * Una lista obliga a elegir una palabra —«ansiosa», «irritable»— y dos personas
 * usan esas palabras para cosas distintas. Valencia (mal↔bien) y activación
 * (apagada↔acelerada) son continuas, comparables entre sí y promediables, que
 * es lo que hace falta para correlacionarlas con la fase.
 */
export const animoSchema = z.object({
  valence: z.number().min(-1).max(1),
  arousal: z.number().min(-1).max(1),
  tags: z.array(z.string().max(24)).max(5).optional(),
})

// ── 4 · Energía ─────────────────────────────────────────────────────────────

export const energiaSchema = z.object({
  level: z.number().int().min(1).max(5),
})

// ── 5 · Flujo vaginal ───────────────────────────────────────────────────────

export const flujoSchema = z.object({
  texture: z.enum(['seco', 'pegajoso', 'cremoso', 'acuoso', 'clara_huevo']),
  amount: z.enum(['poco', 'medio', 'abundante']).optional(),
})

// ── 6 · Digestión ───────────────────────────────────────────────────────────

export const digestionSchema = z.object({
  tags: z.array(z.enum([
    'hinchazon', 'nauseas', 'estrenimiento', 'diarrea', 'gases',
    'acidez', 'antojos', 'sin_apetito',
  ])).min(1),
})

// ── 7 · Piel ────────────────────────────────────────────────────────────────

export const pielSchema = z.object({
  tags: z.array(z.enum(['acne', 'grasa', 'seca', 'sensible', 'normal'])).min(1),
  zones: z.array(z.enum(['frente', 'mejillas', 'menton', 'espalda'])).optional(),
})

// ── 8 · Sueño ───────────────────────────────────────────────────────────────

/**
 * Las horas y la calidad son cosas distintas.
 *
 * Ocho horas dando vueltas no son un buen sueño, y el resto de la app ya
 * aprendió esa lección: `healthTrackerStore` distingue la calidad declarada de
 * la deducida de la duración. Aquí se mantiene la misma disciplina.
 */
export const suenoSchema = z.object({
  hours: z.number().min(0).max(24),
  quality: z.enum(['mal', 'regular', 'bien', 'excelente']).optional(),
  source: z.enum(['manual', 'wearable']).default('manual'),
})

// ── 9 · Libido y actividad sexual ───────────────────────────────────────────

/**
 * Colapsado por defecto en la interfaz.
 *
 * No por pudor: porque es el dato que más incomoda ver en pantalla si alguien
 * mira por encima del hombro, y quien lo registra debe poder hacerlo sin que
 * quede expuesto en la vista de resumen.
 */
export const libidoSchema = z.object({
  desire: z.number().int().min(1).max(5).optional(),
  activity: z.enum(['ninguna', 'protegida', 'sin_proteccion', 'solitaria']).optional(),
})

// ── 10 · Temperatura basal ──────────────────────────────────────────────────

/**
 * Dos decimales, y no es un capricho.
 *
 * El salto térmico que confirma la ovulación es de unas dos décimas. Con un
 * solo decimal la señal se pierde en el redondeo y el módulo no puede
 * confirmar nada.
 */
export const temperaturaSchema = z.object({
  celsius: z.number().min(34).max(42),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  disturbed: z.boolean().optional(),  // noche mala, alcohol, fiebre
})

// ── 11 · Pruebas ────────────────────────────────────────────────────────────

export const pruebaSchema = z.object({
  type: z.enum(['ovulacion', 'embarazo']),
  result: z.enum(['positivo', 'negativo', 'invalido']),
  photoLocalUri: z.string().optional(),  // nunca sale del dispositivo
})

// ── 12 · Anticoncepción ─────────────────────────────────────────────────────

export const anticoncepcionSchema = z.object({
  method: z.enum([
    'ninguno', 'pildora', 'diu_hormonal', 'diu_cobre', 'implante',
    'inyeccion', 'parche', 'anillo', 'barrera', 'natural',
  ]),
  taken: z.boolean().optional(),
})

// ── 13 · Medicación y suplementos ───────────────────────────────────────────

export const medicacionSchema = z.object({
  items: z.array(z.object({
    name: z.string().min(1).max(60),
    taken: z.boolean(),
  })).min(1),
})

// ── 14 · Perimenopausia ─────────────────────────────────────────────────────

/** Solo visible en ese modo de vida. */
export const perimenopausiaSchema = z.object({
  tags: z.array(z.enum([
    'sofocos', 'sudores_nocturnos', 'sequedad', 'insomnio',
    'niebla_mental', 'palpitaciones', 'cambios_animo',
  ])).min(1),
  severity: z.number().int().min(1).max(5).optional(),
})

// ── Registro ────────────────────────────────────────────────────────────────

export const TRACKER_SCHEMAS = {
  sangrado: sangradoSchema,
  dolor: dolorSchema,
  animo: animoSchema,
  energia: energiaSchema,
  flujo: flujoSchema,
  digestion: digestionSchema,
  piel: pielSchema,
  sueno: suenoSchema,
  libido: libidoSchema,
  temperatura_basal: temperaturaSchema,
  prueba: pruebaSchema,
  anticoncepcion: anticoncepcionSchema,
  medicacion: medicacionSchema,
  perimenopausia: perimenopausiaSchema,
} as const satisfies Record<TrackerKind, z.ZodTypeAny>

export type TrackerValue<K extends TrackerKind> = z.infer<typeof TRACKER_SCHEMAS[K]>

/**
 * Valida el valor de un tracker.
 *
 * Devuelve el resultado en vez de lanzar: un registro mal formado no debe
 * tumbar la pantalla de la usuaria, tiene que poder decirle qué falta.
 */
export function validarTracker<K extends TrackerKind>(kind: K, value: unknown) {
  return TRACKER_SCHEMAS[kind].safeParse(value)
}

// ── Metadatos de presentación ───────────────────────────────────────────────

export interface TrackerMeta {
  kind: TrackerKind
  label: string
  /** Qué componente lo captura. No todos son chips: ver el comentario de arriba. */
  input: 'escala' | 'mapa_corporal' | 'rueda' | 'chips' | 'numero' | 'horas' | 'lista'
  /** Arranca colapsado en el panel de registro. */
  discreet?: boolean
  /** Solo se muestra en estos modos de vida. Vacío = en todos. */
  modes?: string[]
}

export const TRACKER_META: Record<TrackerKind, TrackerMeta> = {
  sangrado:          { kind: 'sangrado',          label: 'Sangrado',       input: 'escala' },
  dolor:             { kind: 'dolor',             label: 'Dolor',          input: 'mapa_corporal' },
  animo:             { kind: 'animo',             label: 'Ánimo',          input: 'rueda' },
  energia:           { kind: 'energia',           label: 'Energía',        input: 'escala' },
  flujo:             { kind: 'flujo',             label: 'Flujo',          input: 'chips' },
  digestion:         { kind: 'digestion',         label: 'Digestión',      input: 'chips' },
  piel:              { kind: 'piel',              label: 'Piel',           input: 'chips' },
  sueno:             { kind: 'sueno',             label: 'Sueño',          input: 'horas' },
  libido:            { kind: 'libido',            label: 'Libido',         input: 'chips', discreet: true },
  temperatura_basal: { kind: 'temperatura_basal', label: 'Temperatura',    input: 'numero' },
  prueba:            { kind: 'prueba',            label: 'Pruebas',        input: 'chips',
                       modes: ['buscando_embarazo'] },
  anticoncepcion:    { kind: 'anticoncepcion',    label: 'Anticoncepción', input: 'chips' },
  medicacion:        { kind: 'medicacion',        label: 'Medicación',     input: 'lista' },
  perimenopausia:    { kind: 'perimenopausia',    label: 'Perimenopausia', input: 'chips',
                       modes: ['perimenopausia'] },
}

/**
 * Los trackers que tocan en un modo de vida.
 *
 * Quien no busca embarazo no ve tests de ovulación, y quien no está en
 * perimenopausia no ve sofocos. Un panel con catorce filas donde seis no
 * aplican es un panel que nadie termina de rellenar.
 */
export function trackersDeModo(mode: string): TrackerMeta[] {
  return TRACKER_KINDS
    .map(k => TRACKER_META[k])
    .filter(m => !m.modes || m.modes.includes(mode))
}
