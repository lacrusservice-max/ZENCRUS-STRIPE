import api from './api'

export interface MealItem {
  name: string
  portion: string
  calories: number
  protein: number
  carbs: number
  fats: number
}

export interface Meal {
  id: string
  meal_type: string
  name: string
  time: string
  items: MealItem[]
  total_calories: number
}

export interface DietPlan {
  id: string
  user_id: string
  total_calories: number
  macros: { protein: number; carbs: number; fats: number }
  meals: Meal[]
  generated_by: string
  validated_by?: string
  start_date: string
  is_active: boolean
  notes?: string
  created_at: string
}

const dietService = {
  getActivePlan: async (): Promise<DietPlan | null> => {
    const { data } = await api.get('/diet/active')
    return data.data ?? null
  },

  getPlans: async (): Promise<DietPlan[]> => {
    const { data } = await api.get('/diet/plans')
    return data.data ?? []
  },

  generatePlan: async (): Promise<DietPlan> => {
    const { data } = await api.post('/diet/generate')
    return data.data
  },

  getPlanById: async (id: string): Promise<DietPlan> => {
    const { data } = await api.get(`/diet/plans/${id}`)
    return data.data
  },
}

export default dietService
