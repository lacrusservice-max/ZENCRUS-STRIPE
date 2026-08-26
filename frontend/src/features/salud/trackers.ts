/**
 * LOS TRACKERS DEL CICLO · LO QUE SABE LA APP
 * ═══════════════════════════════════════════════════════════════════════════
 * El contrato de datos —los dieciocho esquemas— ya no vive aquí: está en el
 * núcleo compartido con el servidor, `nucleo/ciclo/trackers.ts`, y este archivo
 * lo reexporta y le añade lo que solo entiende la app.
 *
 * ── Por qué se movió ───────────────────────────────────────────────────────
 * Eran dieciocho esquemas escritos a mano dos veces. Si el cliente añadía un
 * campo y el servidor no, el registro se rechazaba y —como el lote «descarta
 * lo inválido y sigue»— se perdía EN SILENCIO: la app decía «guardado» y no
 * había nada. Ese fallo ya no se puede cometer.
 *
 * ── Lo que sí se queda ─────────────────────────────────────────────────────
 * `TRACKER_META` y `trackersDeModo`: cómo se llama cada tracker en pantalla y
 * con qué control se captura. Es vocabulario de interfaz y el servidor no tiene
 * nada que hacer con ello.
 */

export {
  TRACKER_KINDS, TRACKER_SCHEMAS, validarTracker,
  COLORES_SANGRADO, ZONAS_DOLOR, ANTOJOS, ESTADOS_ENTRENO,
  sangradoSchema, dolorSchema, animoSchema, energiaSchema, flujoSchema,
  digestionSchema, pielSchema, suenoSchema, libidoSchema, temperaturaSchema,
  pruebaSchema, anticoncepcionSchema, medicacionSchema, perimenopausiaSchema,
  antojosSchema, apetitoSchema, entrenamientoSchema, notasSchema,
} from '@/nucleo/ciclo/trackers'

export type { TrackerKind, TrackerValue } from '@/nucleo/ciclo/trackers'

import type { TrackerKind } from '@/nucleo/ciclo/trackers'
import { TRACKER_KINDS } from '@/nucleo/ciclo/trackers'

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
  antojos:           { kind: 'antojos',           label: 'Antojos',        input: 'chips' },
  apetito:           { kind: 'apetito',           label: 'Apetito',        input: 'escala' },
  entrenamiento:     { kind: 'entrenamiento',     label: 'Entrenamiento',  input: 'chips' },
  notas:             { kind: 'notas',             label: 'Notas',          input: 'lista' },
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
