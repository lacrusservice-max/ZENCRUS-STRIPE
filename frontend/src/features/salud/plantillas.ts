/**
 * LAS PLANTILLAS
 * ═══════════════════════════════════════════════════════════════════════════
 * Con qué empieza la creación de un hábito.
 *
 * ── Por qué van primero ────────────────────────────────────────────────────
 * Nadie empieza sabiendo a qué hora quiere leer. Preguntar el nombre en la
 * primera pantalla obliga a decidirlo todo desde cero; una plantilla llega con
 * su hora, su momento y su cronómetro puestos, y solo se toca lo que no
 * encaje. «Créalo desde cero» sigue estando, pero deja de ser el único camino.
 *
 * ── Y ya existían ──────────────────────────────────────────────────────────
 * Los cinco hábitos de fábrica que siembra el servidor son exactamente esto.
 * Lo único que faltaba era enseñarlos al crear, en vez de solo al empezar.
 */

import type { Momento, TipoHabito } from '@/store/habitsStore'

export interface Plantilla {
  id: string
  /** Como se llamará el hábito. */
  nombre: string
  /** Como se lee en la rejilla. */
  etiqueta: string
  /** La línea de debajo: qué trae puesto. */
  resumen: string
  icono: string
  momento: Momento
  tipo: TipoHabito
  /** Minutos desde medianoche, o null si no lleva hora. */
  hora: number | null
  /** Minutos de cronómetro. 0 = ninguno. */
  minutos: number
  /** Horario de sueño: minutos desde medianoche a los que se despierta. */
  despertar?: number
}

export const PLANTILLAS: Plantilla[] = [
  {
    id: 'leer', nombre: 'Leer', etiqueta: 'LEER', resumen: 'Noche · 20 min',
    icono: 'book', momento: 'noche', tipo: 'hacer', hora: 22 * 60 + 30, minutos: 20,
  },
  {
    id: 'correr', nombre: 'Correr', etiqueta: 'CORRER', resumen: 'Mañana · 30 min',
    icono: 'walk', momento: 'manana', tipo: 'hacer', hora: 6 * 60 + 30, minutos: 30,
  },
  {
    id: 'respirar', nombre: 'Respirar', etiqueta: 'RESPIRAR', resumen: 'Mañana · 5 min',
    icono: 'leaf', momento: 'manana', tipo: 'hacer', hora: 7 * 60, minutos: 5,
  },
  {
    id: 'agua', nombre: 'Beber agua', etiqueta: 'AGUA', resumen: 'Todo el día',
    icono: 'water', momento: 'manana', tipo: 'hacer', hora: null, minutos: 0,
  },
  {
    id: 'pantallas', nombre: 'Sin pantallas', etiqueta: 'PANTALLAS', resumen: 'Noche · evitar',
    icono: 'phone-portrait', momento: 'noche', tipo: 'evitar', hora: 23 * 60, minutos: 0,
  },
  {
    id: 'dormir', nombre: 'Dormir', etiqueta: 'DORMIR', resumen: '23:00 → 07:00',
    icono: 'moon', momento: 'noche', tipo: 'hacer', hora: 23 * 60, minutos: 0,
    despertar: 7 * 60,
  },
]
