// ZENCRUS — Design tokens compartidos (web)
// Espejo de frontend/src/constants/theme.ts — misma marca, mismo negro con
// temperatura, mismo azul eléctrico. Fuente única de verdad: no redefinir
// paletas locales por página (const C = {...}) — importar de aquí.

export const Colors = {
  bg: '#0a0a0a',
  panel: '#0f1218',
  panel2: '#12161d',
  panelElevated: '#131824',
  border: '#1e2430',

  navy: '#1e3a8a',
  navySoft: 'rgba(30,58,138,0.16)',
  navyBorder: 'rgba(37,99,235,0.3)',
  blue: '#3b82f6',
  blue2: '#60a5fa',

  text: '#f4f5f7',
  dim: '#9aa3b2',
  dim2: '#5f6875',

  green: '#3fae6b',
  red: '#e0576b',
  amber: '#f5b544',
  orange: '#f08a4b',
  gold: '#c9a94e',
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
