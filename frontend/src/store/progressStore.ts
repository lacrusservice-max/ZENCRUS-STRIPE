/**
 * PROGRESO
 * ────────
 * El peso, las medidas y la gamificación. Las dos primeras cosas ya no viven
 * en AsyncStorage: salen de `body_metrics`, la misma tabla que
 * `bodyMeasurementsStore`. Los dos stores siguen teniendo la interfaz de
 * siempre y ninguna pantalla se toca, pero por debajo comparten origen.
 *
 * Una fila con solo `weight` es lo que aquí se llamaba `WeightEntry`; una con
 * las circunferencias llenas es lo que se llamaba `Measurements`. Son la misma
 * cosa medida con más o menos detalle, y por eso una fila puede aparecer en las
 * dos listas: quien se pesa y se mide a la vez hace una sola medición.
 *
 * ── Los logros y el XP se quedan donde estaban ──────────────────────────────
 * No son de la migración 012. Siguen en el teléfono hasta que les toque su
 * propia tabla.
 */

import { hoyLocal } from '@/utils/fechas'
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { sincronizarMedicion, traerMediciones } from './trackingSync'
import type { Medicion } from '@/services/trackingService'

export interface WeightEntry {
  id: string
  date: string       // YYYY-MM-DD
  weight: number     // kg
  note?: string
}

export interface Measurements {
  id: string
  date: string
  neck?: number
  chest?: number
  waist?: number
  hips?: number
  leftArm?: number
  rightArm?: number
  leftThigh?: number
  rightThigh?: number
  bodyFat?: number   // %
}

export interface Achievement {
  id: string
  title: string
  description: string
  emoji: string
  unlockedAt: number   // timestamp
  xp: number
}

interface ProgressState {
  weightHistory: WeightEntry[]
  measurementHistory: Measurements[]
  achievements: Achievement[]
  totalXP: number
  level: number

  load: () => Promise<void>
  addWeight: (weight: number, note?: string) => Promise<void>
  addMeasurements: (m: Omit<Measurements, 'id' | 'date'>) => Promise<void>
  unlockAchievement: (a: Omit<Achievement, 'unlockedAt'>) => Promise<void>
  getLatestWeight: () => WeightEntry | undefined
  getWeightChange: () => number   // kg desde primera entrada
  getLevelInfo: () => { level: number; title: string; nextLevelXP: number; currentLevelXP: number }
}

const LEVEL_TITLES = [
  'Principiante', 'Comprometido', 'Constante', 'Disciplinado',
  'Enfocado', 'Atleta', 'Guerrero', 'Élite', 'Leyenda',
]

const XP_PER_LEVEL = 500

function computeLevel(xp: number): number {
  return Math.min(Math.floor(xp / XP_PER_LEVEL), LEVEL_TITLES.length - 1)
}

const CIRCUNFERENCIAS = ['neck', 'chest', 'waist', 'hips', 'leftArm', 'rightArm', 'leftThigh', 'rightThigh'] as const

const tieneMedidas = (m: Medicion) =>
  m.bodyFatPct !== undefined || CIRCUNFERENCIAS.some(c => m[c] !== undefined)

export const useProgressStore = create<ProgressState>((set, get) => ({
  weightHistory: [],
  measurementHistory: [],
  achievements: [],
  totalXP: 0,
  level: 0,

  /**
   * El peso y las medidas vienen del servidor; los logros y el XP del teléfono.
   *
   * Si no hay red, las dos primeras listas se quedan como estén: la caché de
   * zustand no persiste esto, así que la pantalla puede aparecer vacía un
   * momento — pero enseñar un peso inventado sería peor.
   */
  load: async () => {
    try {
      const [aRaw, xpRaw] = await Promise.all([
        AsyncStorage.getItem('achievements'),
        AsyncStorage.getItem('total_xp'),
      ])
      const xp = xpRaw ? parseInt(xpRaw) : 0
      set({
        achievements: aRaw ? JSON.parse(aRaw) : [],
        totalXP: xp,
        level: computeLevel(xp),
      })
    } catch {}

    const mediciones = await traerMediciones()
    if (!mediciones) return

    // De más antigua a más reciente: `getWeightChange` compara la primera con
    // la última y `getLatestWeight` coge la del final.
    const cronologico = [...mediciones].sort((a, b) => a.date.localeCompare(b.date))

    set({
      weightHistory: cronologico
        .filter(m => m.weight !== undefined)
        .map(m => ({ id: m.clientId || m.id, date: m.date, weight: m.weight!, note: m.note })),
      measurementHistory: cronologico.filter(tieneMedidas).map(m => ({
        id: m.clientId || m.id,
        date: m.date,
        neck: m.neck, chest: m.chest, waist: m.waist, hips: m.hips,
        leftArm: m.leftArm, rightArm: m.rightArm,
        leftThigh: m.leftThigh, rightThigh: m.rightThigh,
        bodyFat: m.bodyFatPct,
      })),
    })
  },

  addWeight: async (weight, note) => {
    const entry: WeightEntry = {
      id: `w_${Date.now()}`,
      date: hoyLocal(),
      weight, note,
    }
    const history = [...get().weightHistory, entry].sort((a, b) => a.date.localeCompare(b.date))
    set({ weightHistory: history })

    void sincronizarMedicion({ clientId: entry.id, date: entry.date, weight, note })

    // XP por registrar peso
    const newXP = get().totalXP + 10
    set({ totalXP: newXP, level: computeLevel(newXP) })
    await AsyncStorage.setItem('total_xp', String(newXP))
  },

  addMeasurements: async (m) => {
    const entry: Measurements = {
      ...m, id: `me_${Date.now()}`, date: hoyLocal(),
    }
    const history = [...get().measurementHistory, entry]
    set({ measurementHistory: history })

    // `bodyFat` es el único nombre que no coincide con el de la tabla.
    const { id, date, bodyFat, ...circunferencias } = entry
    void sincronizarMedicion({ clientId: id, date, bodyFatPct: bodyFat, ...circunferencias })

    const newXP = get().totalXP + 20
    set({ totalXP: newXP, level: computeLevel(newXP) })
    await AsyncStorage.setItem('total_xp', String(newXP))
  },

  unlockAchievement: async (a) => {
    const already = get().achievements.find(x => x.id === a.id)
    if (already) return
    const achievement: Achievement = { ...a, unlockedAt: Date.now() }
    const achievements = [...get().achievements, achievement]
    set({ achievements })
    await AsyncStorage.setItem('achievements', JSON.stringify(achievements))

    const newXP = get().totalXP + a.xp
    set({ totalXP: newXP, level: computeLevel(newXP) })
    await AsyncStorage.setItem('total_xp', String(newXP))
  },

  getLatestWeight: () => {
    const h = get().weightHistory
    return h.length ? h[h.length - 1] : undefined
  },

  getWeightChange: () => {
    const h = get().weightHistory
    if (h.length < 2) return 0
    return Math.round((h[h.length - 1].weight - h[0].weight) * 10) / 10
  },

  getLevelInfo: () => {
    const { totalXP, level } = get()
    const currentLevelXP = totalXP % XP_PER_LEVEL
    return {
      level,
      title: LEVEL_TITLES[level] ?? 'Leyenda',
      nextLevelXP: XP_PER_LEVEL,
      currentLevelXP,
    }
  },
}))
