import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ChallengeType = 'hydration' | 'streak' | 'protein' | 'workout' | 'checkin' | 'health_score' | 'weight' | 'food_quality'

export interface Challenge {
  id: string
  title: string
  description: string
  emoji: string
  type: ChallengeType
  durationDays: number
  goalPerDay: number
  xpReward: number
  isPremium: boolean
}

export interface UserChallenge {
  challengeId: string
  startDate: string          // YYYY-MM-DD
  endDate: string
  progress: number           // current count
  completed: boolean
  abandoned: boolean
  progressHistory: string[]  // dates where goal was met
}

const BUILT_IN_CHALLENGES: Challenge[] = [
  {
    id: 'hydration_30',
    title: 'Hidratación máxima',
    description: 'Toma 8 vasos de agua al día durante 30 días consecutivos.',
    emoji: '💧',
    type: 'hydration',
    durationDays: 30,
    goalPerDay: 8,
    xpReward: 500,
    isPremium: false,
  },
  {
    id: 'streak_21',
    title: 'Guerrero 21 días',
    description: 'Mantén una racha activa de 21 días seguidos. Un hábito nace aquí.',
    emoji: '🔥',
    type: 'streak',
    durationDays: 21,
    goalPerDay: 1,
    xpReward: 400,
    isPremium: false,
  },
  {
    id: 'workout_20',
    title: 'Rutinero élite',
    description: 'Completa 20 entrenamientos en 30 días. Calidad + constancia.',
    emoji: '🏋️',
    type: 'workout',
    durationDays: 30,
    goalPerDay: 20,
    xpReward: 600,
    isPremium: false,
  },
  {
    id: 'checkin_14',
    title: 'Conciencia diaria',
    description: 'Haz el check-in matutino 14 días seguidos. Conocerte es poder.',
    emoji: '☀️',
    type: 'checkin',
    durationDays: 14,
    goalPerDay: 1,
    xpReward: 250,
    isPremium: false,
  },
  {
    id: 'health_score_14',
    title: 'Score 70+',
    description: 'Mantén tu ZENCRUS Health Score por encima de 70 durante 14 días.',
    emoji: '⭐',
    type: 'health_score',
    durationDays: 14,
    goalPerDay: 70,
    xpReward: 350,
    isPremium: true,
  },
  {
    id: 'weight_7',
    title: 'Registro consistente',
    description: 'Registra tu peso 7 días seguidos. Los datos son tu evidencia.',
    emoji: '⚖️',
    type: 'weight',
    durationDays: 7,
    goalPerDay: 1,
    xpReward: 150,
    isPremium: false,
  },
  {
    id: 'protein_14',
    title: 'Proteína perfecta',
    description: 'Cumple tu objetivo de proteína 14 días seguidos.',
    emoji: '💪',
    type: 'protein',
    durationDays: 14,
    goalPerDay: 1,
    xpReward: 300,
    isPremium: true,
  },
  {
    id: 'food_quality_7',
    title: 'Alimentos verdes',
    description: 'Registra solo alimentos de semáforo verde por 7 días. Alimentación real.',
    emoji: '🥗',
    type: 'food_quality',
    durationDays: 7,
    goalPerDay: 1,
    xpReward: 200,
    isPremium: true,
  },
]

interface ChallengeState {
  challenges: Challenge[]
  userChallenges: UserChallenge[]

  load: () => Promise<void>
  enroll: (challengeId: string) => Promise<void>
  abandon: (challengeId: string) => Promise<void>
  recordProgress: (challengeId: string, value: number, date?: string) => Promise<void>
  getActive: () => Array<{ challenge: Challenge; user: UserChallenge; pctDone: number; daysLeft: number }>
  getCompleted: () => Array<{ challenge: Challenge; user: UserChallenge }>
  getAvailable: () => Challenge[]
  isEnrolled: (challengeId: string) => boolean
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenges: BUILT_IN_CHALLENGES,
  userChallenges: [],

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem('user_challenges')
      if (raw) set({ userChallenges: JSON.parse(raw) })
    } catch {}
  },

  enroll: async (challengeId) => {
    const already = get().userChallenges.find(u => u.challengeId === challengeId && !u.abandoned)
    if (already) return
    const challenge = BUILT_IN_CHALLENGES.find(c => c.id === challengeId)
    if (!challenge) return
    const today = todayStr()
    const uc: UserChallenge = {
      challengeId,
      startDate: today,
      endDate: addDays(today, challenge.durationDays),
      progress: 0,
      completed: false,
      abandoned: false,
      progressHistory: [],
    }
    const updated = [...get().userChallenges.filter(u => u.challengeId !== challengeId || u.completed), uc]
    set({ userChallenges: updated })
    await AsyncStorage.setItem('user_challenges', JSON.stringify(updated))
  },

  abandon: async (challengeId) => {
    const updated = get().userChallenges.map(u =>
      u.challengeId === challengeId && !u.completed ? { ...u, abandoned: true } : u
    )
    set({ userChallenges: updated })
    await AsyncStorage.setItem('user_challenges', JSON.stringify(updated))
  },

  recordProgress: async (challengeId, value, date) => {
    const day = date ?? todayStr()
    const updated = get().userChallenges.map(u => {
      if (u.challengeId !== challengeId || u.completed || u.abandoned) return u
      const challenge = BUILT_IN_CHALLENGES.find(c => c.id === challengeId)
      if (!challenge) return u
      const alreadyToday = u.progressHistory.includes(day)
      if (alreadyToday) return u
      const newHistory = [...u.progressHistory, day]
      const newProgress = newHistory.length
      const completed = newHistory.length >= challenge.durationDays
      return { ...u, progress: newProgress, progressHistory: newHistory, completed }
    })
    set({ userChallenges: updated })
    await AsyncStorage.setItem('user_challenges', JSON.stringify(updated))
  },

  getActive: () => {
    const { challenges, userChallenges } = get()
    const today = todayStr()
    return userChallenges
      .filter(u => !u.completed && !u.abandoned && u.endDate >= today)
      .map(u => {
        const challenge = challenges.find(c => c.id === u.challengeId)!
        const daysLeft = Math.max(0, daysBetween(today, u.endDate))
        const pctDone = Math.min(u.progress / challenge.durationDays, 1)
        return { challenge, user: u, pctDone, daysLeft }
      })
  },

  getCompleted: () => {
    const { challenges, userChallenges } = get()
    return userChallenges
      .filter(u => u.completed)
      .map(u => ({ challenge: challenges.find(c => c.id === u.challengeId)!, user: u }))
  },

  getAvailable: () => {
    const { userChallenges } = get()
    const active = new Set(userChallenges.filter(u => !u.completed && !u.abandoned).map(u => u.challengeId))
    return BUILT_IN_CHALLENGES.filter(c => !active.has(c.id))
  },

  isEnrolled: (challengeId) => {
    return get().userChallenges.some(u => u.challengeId === challengeId && !u.completed && !u.abandoned)
  },
}))
