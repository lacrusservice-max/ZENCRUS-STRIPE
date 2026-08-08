import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = '@zencrus_theme'

interface ThemeState {
  isDark: boolean
  loaded: boolean
  toggle: () => void
  load: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: true,
  loaded: false,

  load: async () => {
    try {
      const v = await AsyncStorage.getItem(KEY)
      set({ isDark: v !== 'light', loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  toggle: () => {
    const next = !get().isDark
    set({ isDark: next })
    AsyncStorage.setItem(KEY, next ? 'dark' : 'light').catch(() => {})
  },
}))
