import React, { createContext, useContext } from 'react'

export interface AppTokens {
  isDark: boolean
  // Backgrounds
  bg: string
  bgSurface: string
  bgElevated: string
  // Accent (red en dark, azul #0F448B en light)
  accent: string
  accentSoft: string
  accentBorder: string
  // Text
  ink: string
  ink2: string
  ink3: string
  ink4: string
  // Borders
  border: string
  // Glass
  glass: string
  glassBorder: string
  glassHighlight: string
  // Tab bar
  tabBar: string
  tabBorder: string
  tabHighlight: string
  tabBlurTint: 'dark' | 'light'
  // Misc
  shadow: string
  statusBar: 'light' | 'dark'
  // Screen glow
  screenOverlay: string
}

const DARK: AppTokens = {
  isDark: true,
  bg:           '#070709',
  bgSurface:    '#141414',
  bgElevated:   '#1c1c1e',
  accent:       '#FF1F3D',
  accentSoft:   'rgba(255,31,61,0.14)',
  accentBorder: 'rgba(255,31,61,0.28)',
  ink:          '#FFFFFF',
  ink2:         'rgba(255,255,255,0.60)',
  ink3:         'rgba(255,255,255,0.35)',
  ink4:         'rgba(255,255,255,0.14)',
  border:       'rgba(255,255,255,0.08)',
  glass:        'rgba(255,255,255,0.05)',
  glassBorder:  'rgba(255,255,255,0.09)',
  glassHighlight: 'rgba(255,255,255,0.14)',
  tabBar:       'rgba(6,6,12,0.45)',
  tabBorder:    'rgba(255,255,255,0.07)',
  tabHighlight: 'rgba(255,255,255,0.14)',
  tabBlurTint:  'dark',
  shadow:       '#000000',
  statusBar:    'light',
  screenOverlay: 'rgba(6,6,12,0.45)',
}


// Los tokens que se exponen son SIEMPRE los oscuros, incluso en tema claro.
//
// Toda la app está escrita en paleta oscura y el interceptor de `@/theme/patch`
// convierte cada color en tiempo de render. Si este contexto devolviera ya los
// colores claros, el interceptor los mapearía por segunda vez (el blanco se
// volvería tinta otra vez) y el tema claro se rompería. Una sola fuente de
// verdad: se escribe en oscuro, el interceptor deriva el claro.
const ThemeContext = createContext<AppTokens>(DARK)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={DARK}>{children}</ThemeContext.Provider>
}

export function useAppTheme(): AppTokens {
  return useContext(ThemeContext)
}
