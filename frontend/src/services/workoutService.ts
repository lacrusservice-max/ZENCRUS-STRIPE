import api from './api'

export interface Exercise {
  id: string
  exercise_id: string
  name: string
  sets: number
  reps: string
  rest_seconds: number
  notes?: string
  order_index: number
}

export interface WorkoutDay {
  day: number
  name: string
  focus: string
  exercises: Exercise[]
  estimated_duration: number
}

export interface WorkoutPlan {
  id: string
  user_id: string
  days_per_week: number
  schedule: WorkoutDay[]
  generated_by: string
  start_date: string
  is_active: boolean
  notes?: string
  created_at: string
}

const workoutService = {
  getActivePlan: async (): Promise<WorkoutPlan | null> => {
    const { data } = await api.get('/workout/active')
    return data.data ?? null
  },

  getPlans: async (): Promise<WorkoutPlan[]> => {
    const { data } = await api.get('/workout/plans')
    return data.data ?? []
  },

  generatePlan: async (): Promise<WorkoutPlan> => {
    const { data } = await api.post('/workout/generate')
    return data.data
  },

  getPlanById: async (id: string): Promise<WorkoutPlan> => {
    const { data } = await api.get(`/workout/plans/${id}`)
    return data.data
  },
}

export default workoutService
