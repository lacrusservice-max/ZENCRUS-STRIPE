import api from './api'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: string
  subscription_tier: string
  email_verified: boolean
  weight?: number
  height?: number
  age?: number
  gender?: string
  activity_level?: string
  fitness_goals?: string[]
  dietary_restrictions?: string[]
  health_conditions?: string[]
  profile_completed: boolean
  created_at: string
}

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active'

export interface UpdateProfilePayload {
  full_name?: string
  weight?: number
  height?: number
  age?: number
  gender?: 'male' | 'female' | 'other'
  activity_level?: ActivityLevel
  fitness_goals?: string[]
  dietary_restrictions?: string[]
  health_conditions?: string[]
}

const profileService = {
  getProfile: async (): Promise<UserProfile> => {
    const { data } = await api.get('/users/profile')
    return data.data
  },

  updateProfile: async (payload: UpdateProfilePayload): Promise<UserProfile> => {
    const { data } = await api.put('/users/profile', payload)
    return data.data
  },
}

export default profileService
