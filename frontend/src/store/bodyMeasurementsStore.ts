/**
 * MEDIDAS CORPORALES
 * ──────────────────
 * Sigue siendo el store de siempre —ninguna pantalla cambia— pero por debajo
 * lee y escribe en `body_metrics`, la misma tabla que `progressStore`. Antes
 * había dos verdades sobre cuánto pesa alguien y `profile-stats.tsx` leía de
 * las dos a la vez; ahora comparten origen.
 *
 * ── Se acabaron las medidas de mentira ──────────────────────────────────────
 * Este store sembraba cuatro medidas inventadas cuando no había datos, y un
 * usuario nuevo las veía como suyas: 75 kilos que nunca pesó bajando medio kilo
 * por semana. Se han quitado, y además se filtran al rehidratar, porque a quien
 * ya las tenga guardadas no le bastaría con dejar de sembrarlas.
 *
 * Una pantalla vacía dice la verdad. Cuatro medidas falsas, no.
 */

import { hoyLocal } from '@/utils/fechas'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  sincronizarMedicion, olvidarMedicion, traerMediciones, esMedidaDeMentira,
} from './trackingSync'
import { actualizarMedicion, borrarMedicion, type Medicion } from '@/services/trackingService'

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
  /** Id de la fila en Supabase. No existe hasta que la medición sube. */
  serverId?: string
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

/** Del servidor al store: el `clientId` es el id local con el que nació. */
function aMedida(s: Medicion): BodyMeasurement {
  return {
    id: s.clientId || s.id,
    date: s.date,
    weight: s.weight,
    bodyFatPct: s.bodyFatPct,
    muscleMassPct: s.muscleMassPct,
    chest: s.chest,
    waist: s.waist,
    hips: s.hips,
    leftArm: s.leftArm,
    rightArm: s.rightArm,
    leftThigh: s.leftThigh,
    rightThigh: s.rightThigh,
    neck: s.neck,
    shoulders: s.shoulders,
    note: s.note,
    serverId: s.id,
  }
}

const sinServerId = ({ id, serverId, ...resto }: BodyMeasurement) => ({ clientId: id, ...resto })

export const useBodyMeasurementsStore = create<BodyMeasurementsState>()(
  persist(
    (set, get) => ({
      measurements: [],
      photos: [],
      unit: 'metric',

      /**
       * Trae el histórico del servidor y pisa lo local. Sin red no hace nada:
       * quien abra la pantalla en el metro sigue viendo sus medidas.
       */
      load: async () => {
        const desdeElServidor = await traerMediciones()
        if (!desdeElServidor) return
        set({
          measurements: desdeElServidor
            .map(aMedida)
            .sort((a, b) => b.date.localeCompare(a.date)),
        })
      },

      addMeasurement: (m) => {
        const entry: BodyMeasurement = { ...m, id: `m_${Date.now()}` }
        set(s => ({
          measurements: [entry, ...s.measurements].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          ),
        }))
        // Optimista: la pantalla ya respondió. Sin red esto cae a la cola.
        void sincronizarMedicion({ ...sinServerId(entry), date: entry.date || hoyLocal() })
      },

      updateMeasurement: (id, updates) => {
        set(s => ({
          measurements: s.measurements.map(m => m.id === id ? { ...m, ...updates } : m),
        }))
        const medida = get().measurements.find(m => m.id === id)
        if (medida?.serverId) {
          void actualizarMedicion(medida.serverId, updates).catch(() => {})
        } else if (medida) {
          // Todavía no ha subido: se manda entera y el `clientId` la reconoce.
          void sincronizarMedicion({ ...sinServerId(medida), date: medida.date })
        }
      },

      deleteMeasurement: (id) => {
        const medida = get().measurements.find(m => m.id === id)
        set(s => ({ measurements: s.measurements.filter(m => m.id !== id) }))
        if (medida?.serverId) {
          void borrarMedicion(medida.serverId).catch(() => {})
        } else {
          // Nunca llegó al servidor: puede seguir esperando en la cola. Si no se
          // saca de ahí, al volver la red reaparecería sola.
          void olvidarMedicion(id)
        }
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
    {
      name: 'zencrus-body-measurements',
      storage: createJSONStorage(() => AsyncStorage),
      /**
       * Las cuatro de mentira se van al rehidratar. Quitar el sembrado solo
       * arregla a los usuarios nuevos; quien ya las tenga guardadas seguiría
       * viéndolas para siempre, y ZENA razonando sobre ellas.
       */
      onRehydrateStorage: () => (estado) => {
        if (!estado?.measurements?.length) return
        estado.measurements = estado.measurements.filter(m => !esMedidaDeMentira(m.id))
      },
    }
  )
)
