import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface BodyMeasurement {
  id: string
  date: string
  weight?: number
  bodyFatPct?: number
  muscleMassPct?: number
  chest?: number
  waist?: number
  hips?: number
  leftArm?: number
  rightArm?: number
  leftThigh?: number
  rightThigh?: number
  neck?: number
  shoulders?: number
  note?: string
}

export interface ProgressPhoto {
  id: string
  date: string
  uri: string
  angle: 'front' | 'side' | 'back'
  note?: string
  weight?: number
}

export type MeasurementUnit = 'metric' | 'imperial'

const DEMO_MEASUREMENTS: BodyMeasurement[] = Array.from({ length: 4 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - i * 7)
  return {
    id: `m${i}`,
    date: d.toISOString().slice(0, 10),
    weight: 75 - i * 0.5,
    waist: 82 - i * 0.3,
    chest: 96 + i * 0.2,
    hips: 94 - i * 0.2,
    leftArm: 33 + i * 0.1,
    rightArm: 33.5 + i * 0.1,
  }
})

interface BodyMeasurementsState {
  measurements: BodyMeasurement[]
  photos: ProgressPhoto[]
  unit: MeasurementUnit
  load: () => Promise<void>
  addMeasurement: (m: Omit<BodyMeasurement, 'id'>) => void
  updateMeasurement: (id: string, updates: Partial<BodyMeasurement>) => void
  deleteMeasurement: (id: string) => void
  addPhoto: (photo: Omit<ProgressPhoto, 'id'>) => void
  deletePhoto: (id: string) => void
  setUnit: (unit: MeasurementUnit) => void
  getLatest: () => BodyMeasurement | null
  getProgress: (field: keyof BodyMeasurement) => { value: number; change: number; changePct: number } | null
  getPhotosByAngle: (angle: ProgressPhoto['angle']) => ProgressPhoto[]
  getWeightHistory: () => { date: string; value: number }[]
}

export const useBodyMeasurementsStore = create<BodyMeasurementsState>()(
  persist(
    (set, get) => ({
      measurements: DEMO_MEASUREMENTS,
      photos: [],
      unit: 'metric',

      load: async () => {},

      addMeasurement: (m) => {
        const entry: BodyMeasurement = { ...m, id: `m_${Date.now()}` }
        set(s => ({
          measurements: [entry, ...s.measurements].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          ),
        }))
      },

      updateMeasurement: (id, updates) => {
        set(s => ({
          measurements: s.measurements.map(m => m.id === id ? { ...m, ...updates } : m),
        }))
      },

      deleteMeasurement: (id) => {
        set(s => ({ measurements: s.measurements.filter(m => m.id !== id) }))
      },

      addPhoto: (photo) => {
        const entry: ProgressPhoto = { ...photo, id: `ph_${Date.now()}` }
        set(s => ({ photos: [entry, ...s.photos] }))
      },

      deletePhoto: (id) => {
        set(s => ({ photos: s.photos.filter(p => p.id !== id) }))
      },

      setUnit: (unit) => set({ unit }),

      getLatest: () => get().measurements[0] ?? null,

      getProgress: (field) => {
        const { measurements } = get()
        if (measurements.length < 2) return null
        const latest = measurements[0][field] as number | undefined
        const oldest = measurements[measurements.length - 1][field] as number | undefined
        if (latest == null || oldest == null) return null
        const change = Math.round((latest - oldest) * 10) / 10
        const changePct = Math.round((change / oldest) * 100 * 10) / 10
        return { value: latest, change, changePct }
      },

      getPhotosByAngle: (angle) => {
        return get().photos.filter(p => p.angle === angle)
      },

      getWeightHistory: () => {
        return get().measurements
          .filter(m => m.weight != null)
          .map(m => ({ date: m.date, value: m.weight! }))
          .reverse()
      },
    }),
    { name: 'zencrus-body-measurements', storage: createJSONStorage(() => AsyncStorage) }
  )
)
