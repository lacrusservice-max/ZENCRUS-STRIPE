import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type DuelMetric = 'steps' | 'workouts' | 'streak' | 'calories_burned' | 'water_glasses' | 'health_score'
export type DuelStatus = 'pending' | 'active' | 'completed' | 'declined'
export type DuelDuration = 1 | 3 | 7 | 14

export interface DuelParticipant {
  userId: string
  userName: string
  userHandle: string
  userAvatar?: string
  userLevel: number
  progress: number
  isWinner: boolean
}

export interface Duel {
  id: string
  metric: DuelMetric
  duration: DuelDuration
  xpReward: number
  status: DuelStatus
  challenger: DuelParticipant
  opponent: DuelParticipant
  startDate: string
  endDate: string
  createdAt: string
  message?: string
}

const METRIC_LABELS: Record<DuelMetric, string> = {
  steps: 'Pasos totales',
  workouts: 'Entrenamientos',
  streak: 'Racha más larga',
  calories_burned: 'Calorías quemadas',
  water_glasses: 'Vasos de agua',
  health_score: 'Health Score promedio',
}

const METRIC_EMOJIS: Record<DuelMetric, string> = {
  steps: '👟',
  workouts: '🏋️',
  streak: '🔥',
  calories_burned: '⚡',
  water_glasses: '💧',
  health_score: '⭐',
}

const DEMO_DUELS: Duel[] = [
  {
    id: 'd1',
    metric: 'steps',
    duration: 7,
    xpReward: 300,
    status: 'active',
    challenger: {
      userId: 'me',
      userName: 'Tú',
      userHandle: '@yo',
      userLevel: 4,
      progress: 42350,
      isWinner: false,
    },
    opponent: {
      userId: 'u2',
      userName: 'Carlos Mendoza',
      userHandle: '@carlosfit',
      userLevel: 7,
      progress: 38700,
      isWinner: false,
    },
    startDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 4 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    message: '¡A ver quién camina más esta semana! 😤',
  },
]

interface DuelState {
  duels: Duel[]
  load: () => Promise<void>
  createDuel: (params: { metric: DuelMetric; duration: DuelDuration; opponentId: string; opponentName: string; opponentHandle: string; message?: string }) => Duel
  acceptDuel: (duelId: string) => void
  declineDuel: (duelId: string) => void
  updateProgress: (duelId: string, userId: string, progress: number) => void
  completeDuel: (duelId: string) => void
  getActive: () => Duel[]
  getPending: () => Duel[]
  getCompleted: () => Duel[]
  getMetricLabel: (metric: DuelMetric) => string
  getMetricEmoji: (metric: DuelMetric) => string
}

export const useDuelStore = create<DuelState>()(
  persist(
    (set, get) => ({
      duels: DEMO_DUELS,

      load: async () => {},

      createDuel: (params) => {
        const start = new Date()
        const end = new Date(start.getTime() + params.duration * 86400000)
        const duel: Duel = {
          id: `duel_${Date.now()}`,
          metric: params.metric,
          duration: params.duration,
          xpReward: params.duration * 50,
          status: 'pending',
          challenger: {
            userId: 'me',
            userName: 'Tú',
            userHandle: '@yo',
            userLevel: 1,
            progress: 0,
            isWinner: false,
          },
          opponent: {
            userId: params.opponentId,
            userName: params.opponentName,
            userHandle: params.opponentHandle,
            userLevel: 1,
            progress: 0,
            isWinner: false,
          },
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          createdAt: start.toISOString(),
          message: params.message,
        }
        set(s => ({ duels: [duel, ...s.duels] }))
        return duel
      },

      acceptDuel: (duelId) => {
        set(s => ({
          duels: s.duels.map(d =>
            d.id === duelId ? { ...d, status: 'active' as DuelStatus } : d
          ),
        }))
      },

      declineDuel: (duelId) => {
        set(s => ({
          duels: s.duels.map(d =>
            d.id === duelId ? { ...d, status: 'declined' as DuelStatus } : d
          ),
        }))
      },

      updateProgress: (duelId, userId, progress) => {
        set(s => ({
          duels: s.duels.map(d => {
            if (d.id !== duelId) return d
            const isChallenger = d.challenger.userId === userId
            return {
              ...d,
              challenger: isChallenger ? { ...d.challenger, progress } : d.challenger,
              opponent: !isChallenger ? { ...d.opponent, progress } : d.opponent,
            }
          }),
        }))
      },

      completeDuel: (duelId) => {
        set(s => ({
          duels: s.duels.map(d => {
            if (d.id !== duelId) return d
            const challengerWins = d.challenger.progress >= d.opponent.progress
            return {
              ...d,
              status: 'completed' as DuelStatus,
              challenger: { ...d.challenger, isWinner: challengerWins },
              opponent: { ...d.opponent, isWinner: !challengerWins },
            }
          }),
        }))
      },

      getActive: () => get().duels.filter(d => d.status === 'active'),
      getPending: () => get().duels.filter(d => d.status === 'pending'),
      getCompleted: () => get().duels.filter(d => d.status === 'completed'),
      getMetricLabel: (m) => METRIC_LABELS[m],
      getMetricEmoji: (m) => METRIC_EMOJIS[m],
    }),
    { name: 'zencrus-duels', storage: createJSONStorage(() => AsyncStorage) }
  )
)

export { METRIC_LABELS, METRIC_EMOJIS }
