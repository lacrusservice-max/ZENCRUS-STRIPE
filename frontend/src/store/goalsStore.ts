import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Goal } from '@/utils/goalProgress'

export type { Goal }

interface GoalsState {
  goals: Goal[]
  addGoal: (goal: Omit<Goal, 'id'>) => void
  deleteGoal: (id: string) => void
  load: () => void
}

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set) => ({
      goals: [],
      addGoal: (goal) => set(s => ({ goals: [...s.goals, { ...goal, id: Date.now().toString() }] })),
      deleteGoal: (id) => set(s => ({ goals: s.goals.filter(g => g.id !== id) })),
      load: () => {},
    }),
    { name: 'zencrus-goals', storage: createJSONStorage(() => AsyncStorage) }
  )
)
