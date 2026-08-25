/**
 * AL AIRE LIBRE · AJUSTES Y PLAN
 * ══════════════════════════════
 * Preferencias del módulo y el plan que se está siguiendo.
 *
 * ── NINGÚN INTERRUPTOR DECORATIVO ───────────────────────────────────────────
 * Cada ajuste de aquí cambia algo de verdad, y si no puede, no está. Un panel
 * lleno de palancas que no hacen nada es peor que un panel corto: la gente las
 * mueve, no nota diferencia y deja de fiarse de todos los demás.
 *
 * Por eso `avisosVoz` NO existe todavía. La app no tiene `expo-speech` ni
 * `expo-av`, así que no hay nada que hacer sonar. Añadirlo es una dependencia
 * nativa y un dev build nuevo; hasta entonces las sesiones avisan con vibración
 * y con la pantalla, que sí funcionan.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Unidades = 'km' | 'mi'

interface AjustesState {
  unidades: Unidades
  /** Cada cuántos metros marcar un parcial. */
  parcialCada: number
  pausaAutomatica: boolean
  pantallaEncendida: boolean
  /** Usar el barómetro en vez del GPS para la altura, cuando esté escrito. */
  barometro: boolean
  contarEnGastoDelDia: boolean
  /** Recorta el principio y el final del recorrido al compartirlo. */
  ocultarInicio: boolean
  metrosOcultos: number

  /** Plan en curso: id del plan y semana por la que va. */
  planActivo: string | null
  semanaPlan: number

  set: <K extends keyof AjustesState>(k: K, v: AjustesState[K]) => void
  activarPlan: (id: string | null) => void
  avanzarSemana: () => void
}

export const useOutdoorAjustes = create<AjustesState>()(
  persist(
    (set, get) => ({
      unidades: 'km',
      parcialCada: 1000,
      pausaAutomatica: true,
      pantallaEncendida: true,
      barometro: false,
      contarEnGastoDelDia: true,
      ocultarInicio: false,
      metrosOcultos: 200,

      planActivo: null,
      semanaPlan: 1,

      set: (k, v) => set({ [k]: v } as Pick<AjustesState, typeof k>),
      activarPlan: (id) => set({ planActivo: id, semanaPlan: 1 }),
      avanzarSemana: () => set({ semanaPlan: get().semanaPlan + 1 }),
    }),
    { name: 'zencrus-outdoor-ajustes', storage: createJSONStorage(() => AsyncStorage) }
  )
)

// ── Conversión ───────────────────────────────────────────────────────────────

const MILLA = 1609.344

/**
 * Metros a la unidad elegida. Devuelve también el rótulo, porque enseñar «5,2»
 * sin decir de qué es el error más fácil de cometer al soportar dos sistemas.
 */
export function distancia(metros: number, u: Unidades) {
  return u === 'mi'
    ? { valor: metros / MILLA, unidad: 'mi' }
    : { valor: metros / 1000, unidad: 'km' }
}

/** Segundos por kilómetro → segundos por la unidad elegida. */
export function ritmoEnUnidad(segPorKm: number, u: Unidades) {
  return u === 'mi' ? segPorKm * (MILLA / 1000) : segPorKm
}
