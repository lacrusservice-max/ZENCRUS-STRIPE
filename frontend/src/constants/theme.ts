// ZENCRUS — Sistema de diseño
// Paleta: negro dominante, rojo neón ZENCRUS, blancos

export const Colors = {
  // Marca principal — Rojo neón ZENCRUS
  primary: {
    50: '#fff0f2',
    100: '#ffd7de',
    200: '#ffb3be',
    300: '#ff8fa0',
    400: '#ff5871',
    500: '#FF1F3D',  // Rojo neón principal ZENCRUS
    600: '#e01a36',
    700: '#b3122a',
    800: '#800d1e',
    900: '#4d0812',
  },

  // Secundario — blanco/gris neutro
  secondary: {
    50: '#ffffff',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d1d1d6',
    400: '#a1a1aa',
    500: '#8B8D96',  // Acero principal
    600: '#74767F',
    700: '#5C5E67',
    800: '#3f3f46',
    900: '#27272a',
  },

  // Acentos
  accent: {
    orange: '#FF1F3D',
    red: '#FF1F3D',
    green: '#FFFFFF',
    yellow: '#FFFFFF',
    pink: '#FF1F3D',
  },

  /**
   * Paleta NEÓN — negro · blanco · rojo neón.
   * Dirección visual aprobada para Nutrición. El rojo se reserva para lo que
   * exige atención (pendiente, excedido, ZENA, acción principal); el blanco
   * es el dato primario y el acero el tercer macro.
   */
  neon: {
    void: '#050506',
    pane: 'rgba(255,255,255,0.045)',
    paneHi: 'rgba(255,255,255,0.075)',
    edge: 'rgba(255,255,255,0.11)',
    white: '#FFFFFF',
    w2: 'rgba(255,255,255,0.60)',
    w3: 'rgba(255,255,255,0.34)',
    w4: 'rgba(255,255,255,0.14)',
    red: '#FF1F3D',
    redSoft: '#FF5871',
    redDeep: '#FF0030',
    redCore: '#FFD7DE',
    redDim: 'rgba(255,31,61,0.14)',
    steel: '#74767F',
    steelSoft: '#8B8D96',
  },

  // Semánticos
  success: '#FFFFFF',
  warning: '#FFFFFF',
  error: '#FF1F3D',
  info: '#FF1F3D',

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
  // Rajdhani (geométrica, mayúsculas fuertes) para headlines/marca;
  // Inter para cuerpo de texto largo — nunca la misma fuente para ambos usos.
  fontFamily: {
    display: 'Rajdhani_700Bold',
    displaySemiBold: 'Rajdhani_600SemiBold',
    displayMedium: 'Rajdhani_500Medium',
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',

    // ZENCRUS, la tipografía propia. Dibujada a partir del logotipo: esqueleto
    // geométrico, esquinas cortadas a 45° y remates en sesgo. Está registrada
    // en app/_layout.tsx y vive en assets/fonts.
    //
    // Ninguna pantalla la usa todavía: cambiar la voz de la app es una
    // decisión aparte. Estas claves existen para poder hacerlo por partes.
    zencrusLight: 'Zencrus-Light',
    zencrus: 'Zencrus-Regular',
    zencrusMedium: 'Zencrus-Medium',
    zencrusSemiBold: 'Zencrus-SemiBold',
    zencrusBold: 'Zencrus-Bold',
    zencrusBlack: 'Zencrus-Black',
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
    shadowColor: '#FF1F3D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  base: {
    shadowColor: '#FF1F3D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#FF1F3D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  lg: {
    shadowColor: '#FF1F3D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 10,
  },
}

export const Gradients = {
  primary: ['#FF1F3D', '#ff5871'],
  secondary: ['#FFFFFF', '#e4e4e7'],
  warm: ['#FF1F3D', '#ff5871'],
  cool: ['#FF1F3D', '#FFFFFF'],
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
  purpleTint:    'rgba(255,31,61,0.14)',
  purpleBorder:  'rgba(255,31,61,0.28)',
  successTint:   'rgba(255,255,255,0.10)',
  successBorder: 'rgba(255,255,255,0.22)',
  warningTint:   'rgba(255,255,255,0.10)',
  errorTint:     'rgba(255,31,61,0.10)',
  cyanTint:      'rgba(255,255,255,0.10)',
}
