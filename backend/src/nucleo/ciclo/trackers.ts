/* ─────────────────────────────────────────────────────────────────────────
 * ARCHIVO GENERADO — NO LO EDITES AQUÍ
 *
 * La fuente es  nucleo/ciclo/trackers.ts
 * Para cambiarlo: edita ahí y corre  npm run nucleo
 *
 * Existe copiado porque la app y el servidor los compilan cadenas distintas
 * que no pueden leer una carpeta común. El motivo largo está en
 * scripts/nucleo.mjs.
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * NÚCLEO DEL CICLO · EL CONTRATO DE DATOS
 * ═══════════════════════════════════════════════════════════════════════════
 * Los dieciocho esquemas del registro diario, en un solo sitio.
 *
 * ── Por qué esto era lo más peligroso de tener duplicado ───────────────────
 * Eran dieciocho esquemas escritos a mano DOS veces, y la penalización por que
 * se separaran no era un error visible: si el cliente añade un campo y el
 * servidor no, el registro se rechaza y —como el lote «descarta lo inválido y
 * sigue»— se pierde EN SILENCIO. La app dice «guardado» y no hay nada.
 *
 * ── Este archivo es la FUENTE. Las copias son generadas ────────────────────
 * Ver `nucleo/ciclo/fases.ts`. Se edita AQUÍ y se corre `npm run nucleo`.
 *
 * ── Lo que NO está aquí ────────────────────────────────────────────────────
 * `TRACKER_META` —qué etiqueta lleva cada uno y con qué control se captura— se
 * queda en la app. Es vocabulario de pantalla, no contrato de datos, y el
 * servidor no tiene nada que hacer con él.
 */

import { z } from 'zod'

// ── Identidad ───────────────────────────────────────────────────────────────

export const TRACKER_KINDS = [
  'sangrado', 'dolor', 'animo', 'energia', 'flujo', 'digestion', 'piel',
  'sueno', 'libido', 'temperatura_basal', 'prueba', 'anticoncepcion',
  'medicacion', 'perimenopausia',
  // Los cuatro del mockup del registro diario. Requieren la migración 020:
  // `cycle_logs.kind` es un ENUM y sin ella el INSERT muere en el servidor.
  'antojos', 'apetito', 'entrenamiento', 'notas',
] as const

export type TrackerKind = typeof TRACKER_KINDS[number]

// ── 1 · Sangrado ────────────────────────────────────────────────────────────

/**
 * Seis niveles: 0 = «hoy no», y del 1 al 5 los cinco del mockup.
 *
 * Antes llegaba a 4 y el mockup pide cinco grados —manchado, ligero, moderado,
 * abundante, muy abundante—. Subir el techo es compatible hacia atrás: todo lo
 * ya guardado con 0-4 sigue validando y sigue significando lo mismo.
 *
 *   0 sin sangrado · 1 manchado · 2 ligero · 3 moderado · 4 abundante
 *   5 muy abundante
 *
 * El corte de `SANGRADO_MINIMO` sigue en 2, así que el manchado NO abre
 * periodo — que es la primera de las cuatro guardas contra el fantasma.
 */
/**
 * El color y la naturaleza del sangrado.
 *
 * Van DENTRO del `value` de `sangrado` y no como tipos aparte porque no tienen
 * vida propia: un color sin sangrado no significa nada, y separarlos obligaría
 * a leer dos filas para pintar un día.
 */
export const COLORES_SANGRADO = ['rojo_brillante', 'rojo_oscuro', 'cafe', 'otro'] as const

export const sangradoSchema = z.object({
  level: z.number().int().min(0).max(5),
  spotting: z.boolean().optional(),
  color: z.enum(COLORES_SANGRADO).optional(),
  /**
   * Ella dice que esto NO es su regla.
   *
   * Es la única de las cuatro guardas contra el periodo fantasma que no
   * deduce el motor: la declara la persona. Un sangrado moderado a mitad de
   * ciclo abriría un periodo y descuadraría todas las medias; con esto
   * marcado, se registra el sangrado pero NO cuenta para deducir periodos.
   */
  fueraDePeriodo: z.boolean().optional(),
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

// ── 15 · Antojos ────────────────────────────────────────────────────────────

export const ANTOJOS = [
  'dulce', 'salado', 'carbohidratos', 'grasas', 'proteinas', 'citricos', 'otro',
] as const

export const antojosSchema = z.object({
  tags: z.array(z.enum(ANTOJOS)).min(1).max(ANTOJOS.length),
})

// ── 16 · Apetito ────────────────────────────────────────────────────────────

/**
 * Aparte de `energia` aunque los dos sean una escala de cinco.
 *
 * En fase lútea el apetito sube de verdad —la progesterona eleva el gasto
 * basal— y la energía suele bajar. Guardarlos juntos borraría justo el cruce
 * que hace útil el módulo: comer más y rendir menos el mismo día no es una
 * contradicción, es la fase.
 */
export const apetitoSchema = z.object({
  level: z.number().int().min(1).max(5),
})

// ── 17 · Entrenamiento ──────────────────────────────────────────────────────

export const ESTADOS_ENTRENO = [
  'no_entrene', 'con_energia', 'cansada', 'con_dolor', 'motivada',
] as const

/**
 * Cómo se sintió entrenando, no si entrenó.
 *
 * Si entrenó ya lo sabe la app por la sesión registrada en Entrena. Lo que no
 * sabe —y es lo que se correlaciona con la fase— es cómo se sintió haciéndolo.
 * `no_entrene` es una respuesta válida y NO es un hueco: un día de descanso
 * elegido es un dato distinto de un día sin registrar.
 */
export const entrenamientoSchema = z.object({
  estado: z.enum(ESTADOS_ENTRENO),
})

// ── 18 · Notas ──────────────────────────────────────────────────────────────

/**
 * El texto libre del día.
 *
 * Mil caracteres es de sobra para «dormí poco y me dolía la espalda» y poco
 * para escribir un diario, que es exactamente lo que se busca: esto acompaña
 * al registro, no lo sustituye.
 */
export const notasSchema = z.object({
  texto: z.string().trim().min(1).max(1000),
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
  antojos: antojosSchema,
  apetito: apetitoSchema,
  entrenamiento: entrenamientoSchema,
  notas: notasSchema,
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
