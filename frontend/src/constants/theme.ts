// ZENCRUS — Sistema de diseño
// Paleta: negro dominante, azul eléctrico ZENCRUS, blancos

export const Colors = {
  // Marca principal — Azul eléctrico ZENCRUS
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#2563EB',  // Azul principal ZENCRUS
    600: '#1d4ed8',
    700: '#1e40af',
    800: '#1e3a8f',
    900: '#172554',
  },

  // Secundario — Cyan energético
  secondary: {
    50: '#e0fffe',
    100: '#b3fffe',
    200: '#66fffd',
    300: '#00fffc',
    400: '#00e5e3',
    500: '#00C2C0',  // Cyan principal
    600: '#009997',
    700: '#007776',
    800: '#005554',
    900: '#003332',
  },

  // Acentos
  accent: {
    orange: '#FF6B35',
    red: '#FF3B30',
    green: '#30D158',
    yellow: '#FFD60A',
    pink: '#FF375F',
  },

  // Semánticos
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF3B30',
  info: '#2563EB',

  // Neutros
  neutral: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d1d1d6',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },

  // Tema claro
  light: {
    background: '#f4f4f5',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    border: '#e4e4e7',
    text: '#09090b',
    textSecondary: '#71717a',
    textTertiary: '#a1a1aa',
    icon: '#52525b',
  },

  // Tema oscuro — principal de ZENCRUS
  dark: {
    background: '#0a0a0a',
    surface: '#141414',
    surfaceElevated: '#1c1c1e',
    border: '#2c2c2e',
    text: '#f4f4f5',
    textSecondary: '#a1a1aa',
    textTertiary: '#71717a',
    icon: '#d1d1d6',
  },
}

export const Typography = {
  fontFamily: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
    mono: 'JetBrainsMono-Regular',
  },

  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 34,
    '5xl': 40,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
}

export const Spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
}

export const BorderRadius = {
  sm: 6,
  base: 10,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 32,
  full: 9999,
}

export const Shadows = {
  sm: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  base: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  lg: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 10,
  },
}

export const Gradients = {
  primary: ['#2563EB', '#60a5fa'],
  secondary: ['#00C2C0', '#00fffc'],
  warm: ['#FF6B35', '#FFD60A'],
  cool: ['#2563EB', '#00C2C0'],
  dark: ['#141414', '#1c1c1e'],
  brand: ['#0a0a0a', '#1c1c1e'],
}

export const Animation = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
    spring: 500,
  },
  spring: {
    damping: 20,
    stiffness: 300,
    mass: 1,
  },
}

// Liquid glass design tokens — ZENCRUS
export const Glass = {
  card:          'rgba(255,255,255,0.05)',
  cardBorder:    'rgba(255,255,255,0.09)',
  cardHighlight: 'rgba(255,255,255,0.18)',
  elevated:      'rgba(255,255,255,0.08)',
  interactive:   'rgba(255,255,255,0.07)',
  tabBar:        'rgba(11,11,15,0.97)',
  tabBorder:     'rgba(255,255,255,0.07)',
  tabHighlight:  'rgba(255,255,255,0.14)',
  purpleTint:    'rgba(37,99,235,0.14)',
  purpleBorder:  'rgba(37,99,235,0.28)',
  successTint:   'rgba(48,209,88,0.10)',
  successBorder: 'rgba(48,209,88,0.22)',
  warningTint:   'rgba(255,159,10,0.10)',
  errorTint:     'rgba(255,59,48,0.10)',
  cyanTint:      'rgba(0,194,192,0.10)',
}
