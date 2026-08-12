/**
 * RUTINAS
 * ───────
 * Las sesiones guardadas para repetir. Solo el PLAN.
 *
 * ── Lo realizado ya NO vive aquí ────────────────────────────────────────────
 * Este store guardaba también el historial de entrenamientos y los récords, en
 * AsyncStorage. Eso se acabó: lo realizado vive en el servidor
 * (`sessionStore` + `/workout/sessions`), que es lo que hace que el historial
 * sobreviva a cambiar de teléfono y que las estadísticas y los programas
 * puedan calcularse sobre datos completos.
 *
 * El historial local que hubiera de la versión anterior NO se migra —decisión
 * tomada— y `loadAll` borra sus claves al pasar, para que no se queden ocupando
 * disco eternamente en algo que nadie va a leer.
 *
 * ── Las rutinas SÍ se quedan en el teléfono ─────────────────────────────────
 * Son preferencias, no datos: cinco listas de ejercicios que se editan a
 * menudo, no interesan a nadie más y no hacen falta en el servidor para
 * calcular nada. Subirlas sería pedir permiso de red para guardar un borrador.
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface Exercise {
  id: string
  name: string
  /**
   * Slug del catálogo de 206, cuando el ejercicio salió de la biblioteca.
   *
   * Es lo que ata las series registradas al historial del ejercicio de verdad.
   * Sin él, entrenar «Press de banca» desde una rutina y desde la biblioteca
   * crearía DOS historiales con nombres parecidos y ninguna progresión.
   * Opcional a propósito: en un gimnasio siempre hay una máquina que no está
   * en ningún catálogo y también se tiene que poder anotar.
   */
  slug?: string
  /** Grupo muscular del catálogo, para pintarlo sin volver a preguntar. */
  muscle?: string
  sets: number
  reps: string        // "8-12", "15", "max", "60s"
  weight: string      // "bodyweight", "60", "banda"
  rest: number        // segundos
  notes?: string
}

export interface Routine {
  id: string
  name: string
  /** gym · home · outdoor · class — los mismos cuatro que los modos de sesión. */
  trainingType: string
  exercises: Exercise[]
  estimatedMinutes: number
  notes?: string
  createdAt: number
  /**
   * Quedó de la versión con emojis en las pastillas de tipo. Se conserva en el
   * tipo —no se escribe ni se pinta— para que las rutinas guardadas antes se
   * sigan leyendo sin migración.
   */
  emoji?: string
}

const STORAGE_ROUTINES = 'workout_routines'

/**
 * Claves de la versión anterior. Se borran una vez y no se vuelven a escribir.
 * Están nombradas aquí para que quede constancia de qué se tiró y cuándo.
 */
const CLAVES_MUERTAS = ['workout_log', 'workout_prs']

interface WorkoutState {
  routines: Routine[]
  loadAll: () => Promise<void>
  saveRoutine: (r: Routine) => Promise<void>
  deleteRoutine: (id: string) => Promise<void>
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  routines: [],

  loadAll: async () => {
    try {
      const crudo = await AsyncStorage.getItem(STORAGE_ROUTINES)
      set({ routines: crudo ? JSON.parse(crudo) : [] })
    } catch {
      set({ routines: [] })
    }

    // Sin `await` ni `catch` ruidoso: que no se pueda limpiar disco no puede
    // impedir que se vean las rutinas.
    void AsyncStorage.multiRemove(CLAVES_MUERTAS).catch(() => {})
  },

  saveRoutine: async (r) => {
    const routines = [...get().routines.filter(x => x.id !== r.id), r]
    set({ routines })
    await AsyncStorage.setItem(STORAGE_ROUTINES, JSON.stringify(routines))
  },

  deleteRoutine: async (id) => {
    const routines = get().routines.filter(r => r.id !== id)
    set({ routines })
    await AsyncStorage.setItem(STORAGE_ROUTINES, JSON.stringify(routines))
  },
}))
