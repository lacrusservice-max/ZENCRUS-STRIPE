/**
 * LOS SIETE MODOS DE VIDA
 * ═══════════════════════════════════════════════════════════════════════════
 * El mismo módulo sirve a siete situaciones distintas, y en varias de ellas la
 * pantalla principal no debe enseñar lo mismo ni predecir lo mismo.
 *
 * ── Los tres que Flo no tiene ──────────────────────────────────────────────
 * Posparto, anticoncepción continua y ausencia de ciclo. No es un descuido de
 * Flo: es que en esas tres situaciones no hay ciclo que contar, y una app
 * construida sobre «día 14 de 28» no sabe qué decir. El resultado es que quien
 * acaba de parir, quien toma la píldora sin descanso o quien lleva meses sin
 * regla —muy común en deporte de fondo— abre la app y ve una predicción que no
 * significa nada, o la desinstala.
 *
 * Aquí cada modo decide tres cosas: si se predice, qué se enseña arriba y qué
 * trackers tienen sentido. Un modo no es un filtro cosmético.
 *
 * ── Y ninguno es una etiqueta permanente ───────────────────────────────────
 * Se cambia cuando se quiera y el historial nunca se borra al cambiar. Alguien
 * puede pasar por buscando embarazo → embarazo → posparto → seguimiento en dos
 * años, y sus datos de hace tres siguen siendo suyos.
 */

import type { TrackerKind } from '@/features/salud/trackers'

export const MODOS = [
  'seguimiento', 'buscando_embarazo', 'embarazo', 'posparto',
  'perimenopausia', 'anticoncepcion_continua', 'sin_ciclo',
] as const

export type ModoVida = typeof MODOS[number]

export interface Modo {
  id: ModoVida
  label: string
  /** Qué es este modo, en una línea, con las palabras de quien lo vive. */
  descripcion: string
  /**
   * Si el motor predice el próximo periodo.
   *
   * En embarazo y en ausencia de ciclo no hay nada que predecir, y en
   * anticoncepción continua lo que llega es sangrado por deprivación, que no
   * es una regla y no se comporta como tal.
   */
  predice: boolean
  /** Si tiene sentido estimar ovulación y ventana fértil. */
  ovula: boolean
  /** Por qué no se predice, para poder decirlo en vez de callar. */
  motivo?: string
  /** Trackers que se añaden a los de base en este modo. */
  extra?: TrackerKind[]
  /** Trackers que se retiran: aquí no significan nada. */
  quita?: TrackerKind[]
}

export const MODO: Record<ModoVida, Modo> = {
  seguimiento: {
    id: 'seguimiento',
    label: 'Seguimiento',
    descripcion: 'Sigo mi ciclo y cómo me sienta.',
    predice: true,
    ovula: true,
  },
  buscando_embarazo: {
    id: 'buscando_embarazo',
    label: 'Buscando embarazo',
    descripcion: 'Quiero saber cuáles son mis días fértiles.',
    predice: true,
    ovula: true,
    extra: ['prueba', 'temperatura_basal', 'flujo'],
  },
  embarazo: {
    id: 'embarazo',
    label: 'Embarazo',
    descripcion: 'Estoy embarazada.',
    predice: false,
    ovula: false,
    motivo: 'Durante el embarazo no hay ciclo que predecir. La pantalla cuenta semanas.',
    quita: ['anticoncepcion', 'prueba'],
  },
  posparto: {
    id: 'posparto',
    label: 'Posparto',
    descripcion: 'Di a luz hace poco y mi ciclo aún no ha vuelto.',
    predice: false,
    ovula: false,
    /* La ovulación vuelve ANTES que la regla, así que la primera regla no
       avisa. Decirlo importa: mucha gente da por hecho lo contrario. */
    motivo: 'El ciclo vuelve a su ritmo poco a poco. Cuando registres dos periodos, la predicción se activa sola.',
    quita: ['prueba'],
  },
  perimenopausia: {
    id: 'perimenopausia',
    label: 'Perimenopausia',
    descripcion: 'Mis ciclos están cambiando.',
    predice: true,
    ovula: false,
    motivo: 'En esta etapa la ovulación es irregular y estimarla daría una falsa seguridad.',
    extra: ['perimenopausia', 'sueno'],
  },
  anticoncepcion_continua: {
    id: 'anticoncepcion_continua',
    label: 'Anticoncepción continua',
    descripcion: 'Tomo anticoncepción sin descansos.',
    predice: false,
    ovula: false,
    motivo: 'Con anticoncepción hormonal continua no hay ovulación, y el sangrado que aparece es por deprivación, no una regla.',
    extra: ['anticoncepcion'],
  },
  sin_ciclo: {
    id: 'sin_ciclo',
    label: 'Sin ciclo',
    descripcion: 'Llevo tiempo sin regla.',
    predice: false,
    ovula: false,
    /* Muy común en deporte de fondo y en déficit calórico sostenido, y es
       justo el caso donde ZENCRUS puede aportar algo que ninguna app de ciclo
       puede: ya sabe cuánto entrena y cuánto come. */
    motivo: 'Sin periodos que contar no hay predicción posible. Lo que sí se puede seguir es todo lo demás.',
    quita: ['prueba', 'anticoncepcion'],
  },
}

export const MODO_POR_DEFECTO: ModoVida = 'seguimiento'

/** Los trackers que tocan en un modo, ya resueltos. */
export function trackersDelModo(modo: ModoVida, base: TrackerKind[]): TrackerKind[] {
  const m = MODO[modo]
  const fuera = new Set(m.quita ?? [])
  const dentro = [...base.filter(k => !fuera.has(k)), ...(m.extra ?? [])]
  return [...new Set(dentro)]
}
