// ZENCRUS — Design tokens compartidos (web)
// Espejo de frontend/src/constants/theme.ts — misma marca, mismo negro con
// temperatura, mismo rojo neón. Fuente única de verdad: no redefinir
// paletas locales por página (const C = {...}) — importar de aquí.

export const Colors = {
  bg: '#0a0a0a',
  panel: '#0f1218',
  panel2: '#12161d',
  panelElevated: '#131824',
  border: '#1e2430',

  navy: '#B3122A',
  navySoft: 'rgba(255,31,61,0.16)',
  navyBorder: 'rgba(255,31,61,0.3)',
  blue: '#FF1F3D',
  blue2: '#FF5871',

  text: '#f4f5f7',
  dim: '#9aa3b2',
  dim2: '#5f6875',

  green: '#FFFFFF',
  red: '#FF1F3D',
  amber: '#FFFFFF',
  orange: '#FF1F3D',
  gold: '#FFFFFF',
} as const

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64,
} as const

export const Radius = {
  sm: 6, md: 10, lg: 14, xl: 20, full: 999,
} as const

// Fuentes de marca — Rajdhani (headlines/geométrica) + Inter (cuerpo), cargadas vía next/font en layout.tsx
export const FontFamily = {
  display: 'var(--font-rajdhani), sans-serif',
  body: 'var(--font-inter), -apple-system, sans-serif',
} as const
