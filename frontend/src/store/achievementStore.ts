import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type AchievementCategory = 'streak' | 'nutrition' | 'workout' | 'social' | 'health' | 'special'

export interface Achievement {
  id: string
  title: string
  description: string
  emoji: string
  category: AchievementCategory
  xpReward: number
  condition: (stats: AchievementStats) => boolean
}

export interface UnlockedAchievement {
  achievementId: string
  unlockedAt: string
}

export interface AchievementStats {
  streak: number
  totalWorkouts: number
  totalMealsLogged: number
  totalWaterDays: number
  friendsCount: number
  postsCount: number
  healthScore: number
  weightLogged: boolean
  photoUploaded: boolean
  barcodeScanned: number
  prBroken: number
  daysWithPerfectScore: number
  aiMessagesTotal: number
}

export const XP_LEVELS = [
  { level: 1, name: 'Principiante', minXP: 0, maxXP: 500, emoji: '🌱' },
  { level: 2, name: 'Aprendiz', minXP: 500, maxXP: 1000, emoji: '⚡' },
  { level: 3, name: 'Dedicado', minXP: 1000, maxXP: 2000, emoji: '🔥' },
  { level: 4, name: 'Constante', minXP: 2000, maxXP: 3500, emoji: '💪' },
  { level: 5, name: 'Atleta', minXP: 3500, maxXP: 5500, emoji: '🏃' },
  { level: 6, name: 'Guerrero', minXP: 5500, maxXP: 8000, emoji: '⚔️' },
  { level: 7, name: 'Campeón', minXP: 8000, maxXP: 11000, emoji: '🏆' },
  { level: 8, name: 'Élite', minXP: 11000, maxXP: 15000, emoji: '👑' },
  { level: 9, name: 'Leyenda', minXP: 15000, maxXP: 999999, emoji: '🌟' },
]

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_meal', title: 'Primera comida', description: 'Registra tu primera comida', emoji: '🍽️', category: 'nutrition', xpReward: 50, condition: s => s.totalMealsLogged >= 1 },
  { id: 'first_workout', title: 'Primera rutina', description: 'Completa tu primer entrenamiento', emoji: '🏋️', category: 'workout', xpReward: 100, condition: s => s.totalWorkouts >= 1 },
  { id: 'streak_3', title: 'Racha de 3 días', description: '3 días consecutivos activo', emoji: '🔥', category: 'streak', xpReward: 75, condition: s => s.streak >= 3 },
  { id: 'streak_7', title: 'Semana completa', description: '7 días consecutivos activo', emoji: '📅', category: 'streak', xpReward: 200, condition: s => s.streak >= 7 },
  { id: 'streak_14', title: 'Dos semanas', description: '14 días consecutivos activo', emoji: '🎯', category: 'streak', xpReward: 350, condition: s => s.streak >= 14 },
  { id: 'streak_30', title: 'Mes de hierro', description: '30 días consecutivos activo', emoji: '🏆', category: 'streak', xpReward: 750, condition: s => s.streak >= 30 },
  { id: 'streak_60', title: 'Dos meses imparable', description: '60 días consecutivos activo', emoji: '💎', category: 'streak', xpReward: 1500, condition: s => s.streak >= 60 },
  { id: 'streak_100', title: 'Centurión', description: '100 días consecutivos activo', emoji: '👑', category: 'streak', xpReward: 3000, condition: s => s.streak >= 100 },
  { id: 'workouts_10', title: '10 entrenamientos', description: 'Completa 10 rutinas', emoji: '💪', category: 'workout', xpReward: 200, condition: s => s.totalWorkouts >= 10 },
  { id: 'workouts_50', title: '50 entrenamientos', description: 'Completa 50 rutinas', emoji: '🥇', category: 'workout', xpReward: 500, condition: s => s.totalWorkouts >= 50 },
  { id: 'pr_first', title: 'Récord personal', description: 'Rompe tu primer PR', emoji: '📈', category: 'workout', xpReward: 150, condition: s => s.prBroken >= 1 },
  { id: 'pr_five', title: '5 récords personales', description: 'Rompe 5 PRs diferentes', emoji: '🚀', category: 'workout', xpReward: 400, condition: s => s.prBroken >= 5 },
  { id: 'meals_50', title: 'Nutricionista amateur', description: 'Registra 50 comidas', emoji: '🥗', category: 'nutrition', xpReward: 200, condition: s => s.totalMealsLogged >= 50 },
  { id: 'barcode_first', title: 'Escáner novato', description: 'Escanea tu primer producto', emoji: '📱', category: 'nutrition', xpReward: 50, condition: s => s.barcodeScanned >= 1 },
  { id: 'barcode_10', title: 'Detective nutricional', description: 'Escanea 10 productos', emoji: '🔍', category: 'nutrition', xpReward: 150, condition: s => s.barcodeScanned >= 10 },
  { id: 'social_first_post', title: 'Primera publicación', description: 'Comparte tu primer post', emoji: '📸', category: 'social', xpReward: 75, condition: s => s.postsCount >= 1 },
  { id: 'social_five_posts', title: 'Creador de contenido', description: 'Publica 5 veces', emoji: '✨', category: 'social', xpReward: 200, condition: s => s.postsCount >= 5 },
  { id: 'friends_first', title: 'Primer amigo', description: 'Conecta con tu primer amigo', emoji: '🤝', category: 'social', xpReward: 100, condition: s => s.friendsCount >= 1 },
  { id: 'friends_five', title: 'Comunidad', description: 'Conecta con 5 amigos', emoji: '👥', category: 'social', xpReward: 250, condition: s => s.friendsCount >= 5 },
  { id: 'health_score_80', title: 'Score élite', description: 'Alcanza 80 puntos en Health Score', emoji: '⭐', category: 'health', xpReward: 300, condition: s => s.healthScore >= 80 },
  { id: 'perfect_day', title: 'Día perfecto', description: 'Un día con Health Score de 100', emoji: '💯', category: 'health', xpReward: 500, condition: s => s.daysWithPerfectScore >= 1 },
  { id: 'weight_logged', title: 'Registro inicial', description: 'Registra tu peso por primera vez', emoji: '⚖️', category: 'health', xpReward: 50, condition: s => s.weightLogged },
  { id: 'photo_progress', title: 'Primera foto de progreso', description: 'Sube tu primera foto de progreso', emoji: '📷', category: 'health', xpReward: 100, condition: s => s.photoUploaded },
  { id: 'ai_conversations_10', title: 'Coach adicto', description: 'Ten 10 conversaciones con el Coach IA', emoji: '🤖', category: 'special', xpReward: 150, condition: s => s.aiMessagesTotal >= 10 },
]

interface AchievementState {
  totalXP: number
  unlockedAchievements: UnlockedAchievement[]
  streakShields: number
  stats: AchievementStats
  load: () => Promise<void>
  addXP: (amount: number, reason?: string) => void
  checkAchievements: (stats: Partial<AchievementStats>) => UnlockedAchievement[]
  updateStats: (updates: Partial<AchievementStats>) => void
  useStreakShield: () => boolean
  getCurrentLevel: () => typeof XP_LEVELS[0]
  getNextLevel: () => typeof XP_LEVELS[0] | null
  getLevelProgress: () => number
  getUnlocked: () => Achievement[]
  getLocked: () => Achievement[]
  isUnlocked: (id: string) => boolean
  getAllAchievements: () => Achievement[]
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      totalXP: 0,
      unlockedAchievements: [],
      streakShields: 0,
      stats: {
        streak: 0,
        totalWorkouts: 0,
        totalMealsLogged: 0,
        totalWaterDays: 0,
        friendsCount: 0,
        postsCount: 0,
        healthScore: 0,
        weightLogged: false,
        photoUploaded: false,
        barcodeScanned: 0,
        prBroken: 0,
        daysWithPerfectScore: 0,
        aiMessagesTotal: 0,
      },

      load: async () => {},

      addXP: (amount) => {
        set(s => ({ totalXP: s.totalXP + amount }))
      },

      updateStats: (updates) => {
        set(s => ({ stats: { ...s.stats, ...updates } }))
        get().checkAchievements({ ...get().stats, ...updates })
      },

      checkAchievements: (stats) => {
        const mergedStats = { ...get().stats, ...stats }
        const { unlockedAchievements } = get()
        const alreadyUnlocked = new Set(unlockedAchievements.map(u => u.achievementId))
        const newlyUnlocked: UnlockedAchievement[] = []

        ACHIEVEMENTS.forEach(a => {
          if (!alreadyUnlocked.has(a.id) && a.condition(mergedStats)) {
            const entry: UnlockedAchievement = {
              achievementId: a.id,
              unlockedAt: new Date().toISOString(),
            }
            newlyUnlocked.push(entry)
            get().addXP(a.xpReward)
          }
        })

        if (newlyUnlocked.length > 0) {
          set(s => ({ unlockedAchievements: [...s.unlockedAchievements, ...newlyUnlocked] }))
          // Every 7 streak days, award a shield
          if (mergedStats.streak > 0 && mergedStats.streak % 7 === 0) {
            set(s => ({ streakShields: s.streakShields + 1 }))
          }
        }
        return newlyUnlocked
      },

      useStreakShield: () => {
        const { streakShields } = get()
        if (streakShields <= 0) return false
        set(s => ({ streakShields: s.streakShields - 1 }))
        return true
      },

      getCurrentLevel: () => {
        const { totalXP } = get()
        return XP_LEVELS.slice().reverse().find(l => totalXP >= l.minXP) ?? XP_LEVELS[0]
      },

      getNextLevel: () => {
        const current = get().getCurrentLevel()
        return XP_LEVELS.find(l => l.level === current.level + 1) ?? null
      },

      getLevelProgress: () => {
        const { totalXP } = get()
        const current = get().getCurrentLevel()
        const next = get().getNextLevel()
        if (!next) return 100
        const range = next.minXP - current.minXP
        const progress = totalXP - current.minXP
        return Math.min(100, Math.round((progress / range) * 100))
      },

      getUnlocked: () => {
        const ids = new Set(get().unlockedAchievements.map(u => u.achievementId))
        return ACHIEVEMENTS.filter(a => ids.has(a.id))
      },

      getLocked: () => {
        const ids = new Set(get().unlockedAchievements.map(u => u.achievementId))
        return ACHIEVEMENTS.filter(a => !ids.has(a.id))
      },

      isUnlocked: (id) => get().unlockedAchievements.some(u => u.achievementId === id),

      getAllAchievements: () => ACHIEVEMENTS,
    }),
    { name: 'zencrus-achievements', storage: createJSONStorage(() => AsyncStorage) }
  )
)
