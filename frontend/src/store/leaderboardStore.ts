import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'alltime'
export type LeaderboardMetric = 'xp' | 'streak' | 'workouts' | 'steps' | 'health_score'

export interface LeaderboardEntry {
  rank: number
  userId: string
  userName: string
  userHandle: string
  userLevel: number
  value: number
  change: number
  isMe: boolean
  country: string
}

const genLeaderboard = (metric: LeaderboardMetric, period: LeaderboardPeriod): LeaderboardEntry[] => {
  const names = [
    ['Roberto Silva', '@robfit', 'MX'],
    ['Ana García', '@anafit', 'MX'],
    ['Carlos Mendoza', '@carlosfit', 'MX'],
    ['María López', '@mariafit', 'MX'],
    ['Diego Torres', '@diegofit', 'MX'],
    ['Sofía Ramírez', '@sofiafit', 'MX'],
    ['Luis Hernández', '@luisfit', 'MX'],
    ['Patricia Vega', '@patrifit', 'MX'],
    ['Jorge Martínez', '@jorgefit', 'MX'],
    ['Valeria Cruz', '@valeriafit', 'MX'],
  ]
  const base = metric === 'xp' ? 5000 : metric === 'streak' ? 60 : metric === 'workouts' ? 30 : metric === 'steps' ? 80000 : 90
  const myRank = Math.floor(Math.random() * 3) + 3

  return names.map(([name, handle, country], i) => ({
    rank: i + 1,
    userId: `u${i + 1}`,
    userName: name,
    userHandle: handle,
    userLevel: 9 - i,
    value: Math.round(base * (1 - i * 0.07)),
    change: i < 3 ? Math.floor(Math.random() * 3) - 1 : Math.floor(Math.random() * 5) - 2,
    isMe: i + 1 === myRank,
    country,
  }))
}

interface LeaderboardState {
  data: Record<string, LeaderboardEntry[]>
  myRanks: Record<string, number>
  lastFetch: Record<string, number>
  load: (metric: LeaderboardMetric, period: LeaderboardPeriod) => Promise<void>
  getLeaderboard: (metric: LeaderboardMetric, period: LeaderboardPeriod) => LeaderboardEntry[]
  getMyRank: (metric: LeaderboardMetric, period: LeaderboardPeriod) => number
  getMyEntry: (metric: LeaderboardMetric, period: LeaderboardPeriod) => LeaderboardEntry | null
}

export const useLeaderboardStore = create<LeaderboardState>()(
  persist(
    (set, get) => ({
      data: {},
      myRanks: {},
      lastFetch: {},

      load: async (metric, period) => {
        const key = `${metric}_${period}`
        const now = Date.now()
        if (get().lastFetch[key] && now - get().lastFetch[key] < 300000) return
        // TODO: fetch from backend — using local demo data for now
        const entries = genLeaderboard(metric, period)
        set(s => ({
          data: { ...s.data, [key]: entries },
          lastFetch: { ...s.lastFetch, [key]: now },
        }))
      },

      getLeaderboard: (metric, period) => {
        const key = `${metric}_${period}`
        return get().data[key] ?? []
      },

      getMyRank: (metric, period) => {
        const entries = get().getLeaderboard(metric, period)
        const me = entries.find(e => e.isMe)
        return me?.rank ?? 0
      },

      getMyEntry: (metric, period) => {
        return get().getLeaderboard(metric, period).find(e => e.isMe) ?? null
      },
    }),
    { name: 'zencrus-leaderboard', storage: createJSONStorage(() => AsyncStorage) }
  )
)
