/**
 * METAS
 * ─────
 * Las metas viven en `user_goals`. La caché de zustand se mantiene para que la
 * pantalla abra con lo que ya había, pero el servidor manda.
 *
 * ── Borrar es abandonar ─────────────────────────────────────────────────────
 * `deleteGoal` sigue quitando la meta de la lista, y desde la pantalla no se
 * nota la diferencia. Por debajo la fila se cierra con estado `abandonada` en
 * vez de borrarse: una meta cumplida —o abandonada— es justo lo que ZENA quiere
 * recordar para celebrar el avance y para proponer la siguiente sabiendo de
 * dónde viene el usuario.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Goal } from '@/utils/goalProgress'
import { leerMetas, crearMeta, borrarMeta, type MetaServidor } from '@/services/trackingService'

export type { Goal }

interface GoalsState {
  goals: Goal[]
  addGoal: (goal: Omit<Goal, 'id'>) => void
  deleteGoal: (id: string) => void
  load: () => Promise<void>
}

function aMeta(m: MetaServidor): Goal {
  return {
    // El `clientId` es el id con el que nació en la pantalla: así una meta
    // recargada del servidor sigue siendo la misma que ya estaba en la lista.
    id: m.clientId || m.id,
    title: m.title,
    type: m.type,
    direction: m.direction,
    startValue: m.startValue,
    targetValue: m.targetValue,
    startDate: m.startDate,
    targetDate: m.targetDate,
    unit: m.unit,
    serverId: m.id,
  }
}

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set, get) => ({
      goals: [],

      addGoal: (goal) => {
        const nueva: Goal = { ...goal, id: `g_${Date.now()}` }
        set(s => ({ goals: [...s.goals, nueva] }))
        void crearMeta({
          clientId: nueva.id,
          title: nueva.title,
          type: nueva.type,
          direction: nueva.direction,
          startValue: nueva.startValue,
          targetValue: nueva.targetValue,
          startDate: nueva.startDate.slice(0, 10),
          targetDate: nueva.targetDate.slice(0, 10),
          unit: nueva.unit,
        }).catch(() => {})
      },

      deleteGoal: (id) => {
        const meta = get().goals.find(g => g.id === id)
        set(s => ({ goals: s.goals.filter(g => g.id !== id) }))
        if (meta?.serverId) void borrarMeta(meta.serverId).catch(() => {})
      },

      /** Solo las activas: las cerradas siguen en el histórico del servidor. */
      load: async () => {
        try {
          set({ goals: (await leerMetas('activa')).map(aMeta) })
        } catch {
          // Sin red se queda lo que hubiera en la caché.
        }
      },
    }),
    { name: 'zencrus-goals', storage: createJSONStorage(() => AsyncStorage) }
  )
)
