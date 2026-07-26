import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

export interface MedicalId {
  bloodType: string
  allergies: string
  conditions: string
  medications: string
  contacts: EmergencyContact[]
  organDonor: boolean
  notes: string
}

interface MedicalIdState {
  data: MedicalId
  update: (updates: Partial<MedicalId>) => void
  isComplete: () => boolean
}

const EMPTY: MedicalId = {
  bloodType: '',
  allergies: '',
  conditions: '',
  medications: '',
  contacts: [],
  organDonor: false,
  notes: '',
}

export const useMedicalIdStore = create<MedicalIdState>()(
  persist(
    (set, get) => ({
      data: EMPTY,
      update: (updates) => set(s => ({ data: { ...s.data, ...updates } })),
      isComplete: () => {
        const { data } = get()
        return !!(data.bloodType && data.contacts.length > 0)
      },
    }),
    { name: 'zencrus-medical-id', storage: createJSONStorage(() => AsyncStorage) }
  )
)
