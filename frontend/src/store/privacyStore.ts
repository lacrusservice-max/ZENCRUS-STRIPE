import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface PrivacyState {
  /** Exige autenticación biométrica cada vez que se abre el módulo de ciclo. */
  menstrualLockEnabled: boolean
  setMenstrualLock: (enabled: boolean) => void
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set) => ({
      menstrualLockEnabled: false,
      setMenstrualLock: (enabled) => set({ menstrualLockEnabled: enabled }),
    }),
    { name: 'zencrus-privacy', storage: createJSONStorage(() => AsyncStorage) }
  )
)
