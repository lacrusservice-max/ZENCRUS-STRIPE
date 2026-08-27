// ZENCRUS — Sistema de diseño
// Paleta: negro absoluto #050505 · naranja #FF5C00 · blanco puro #FFFFFF.
// Solo salen los 12 colores de la paleta de marca; nada más.

export const Colors = {
  // Marca principal — Naranja ZENCRUS
  primary: {
    50: '#ffffff',
    100: '#f2f3f5',
    200: '#ffa45c',
    300: '#ffa45c',
    400: '#ff7a1f',
    500: '#FF5C00',  // Naranja primario ZENCRUS
    600: '#ff5c00',
    700: '#b33d00',
    800: '#b33d00',
    900: '#b33d00',
  },

  // Secundario — blanco/gris neutro
  secondary: {
    50: '#ffffff',
    100: '#f2f3f5',
    200: '#f2f3f5',
    300: '#f2f3f5',
    400: '#a1a3a9',
    500: '#A1A3A9',  // Acero principal
    600: '#5C5F66',
    700: '#5C5F66',
    800: '#2a2c32',
    900: '#2a2c32',
  },

  // Acentos
  accent: {
    orange: '#FF5C00',
    red: '#FF5C00',
    green: '#FFFFFF',
    yellow: '#FFFFFF',
    pink: '#FF5C00',
  },

  /**
   * Paleta NEÓN — negro · blanco · naranja.
   * Dirección visual aprobada para Nutrición. El naranja se reserva para lo que
   * exige atención (pendiente, excedido, ZENA, acción principal); el blanco
   * es el dato primario y el acero el tercer macro.
   *
   * Las claves siguen llamándose `red*` a propósito: renombrarlas tocaría 200
   * usos en 60 archivos para no cambiar ni un píxel. Lo que valen es naranja.
   */
  neon: {
    void: '#050505',
    pane: 'rgba(255,255,255,0.045)',
    paneHi: 'rgba(255,255,255,0.075)',
    edge: 'rgba(255,255,255,0.11)',
    white: '#FFFFFF',
    w2: 'rgba(255,255,255,0.60)',
    w3: 'rgba(255,255,255,0.34)',
    w4: 'rgba(255,255,255,0.14)',
    red: '#FF5C00',
    redSoft: '#FF7A1F',
    redDeep: '#FF5C00',
    redCore: '#F2F3F5',
    redDim: 'rgba(255,92,0,0.14)',
    steel: '#5C5F66',
    steelSoft: '#A1A3A9',
  },

  // Semánticos
  success: '#FFFFFF',
  warning: '#FFFFFF',
  error: '#FF5C00',
  info: '#FF5C00',

  // Neutros
  neutral: {
    50: '#ffffff',
    100: '#f2f3f5',
    200: '#f2f3f5',
    300: '#f2f3f5',
    400: '#a1a3a9',
    500: '#5c5f66',
    600: '#5c5f66',
    700: '#2a2c32',
    800: '#2a2c32',
    900: '#17181c',
  },

  /**
   * Tema claro. NO se toca con la paleta de marca.
   *
   * La paleta de 12 colores está pensada para fondo negro: entre #A1A3A9 y
   * #F2F3F5 no hay ninguna parada, y ahí es justo donde vive el borde de una
   * tarjeta blanca. Al forzarla aquí, `border` acababa valiendo lo mismo que
   * `background` y los bordes desaparecían. Estos valores son los de siempre.
   */
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
    background: '#0d0d10',
    surface: '#0d0d10',
    surfaceElevated: '#17181c',
    border: '#2a2c32',
    text: '#f2f3f5',
    textSecondary: '#a1a3a9',
    textTertiary: '#5c5f66',
    icon: '#f2f3f5',
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
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  base: {
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  lg: {
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 10,
  },
}

export const Gradients = {
  primary: ['#FF5C00', '#ff7a1f'],
  secondary: ['#FFFFFF', '#f2f3f5'],
  warm: ['#FF5C00', '#ff7a1f'],
  cool: ['#FF5C00', '#FFFFFF'],
  dark: ['#0d0d10', '#17181c'],
  brand: ['#0d0d10', '#17181c'],
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
  tabBar:        'rgba(13,13,16,0.97)',
  tabBorder:     'rgba(255,255,255,0.07)',
  tabHighlight:  'rgba(255,255,255,0.14)',
  purpleTint:    'rgba(255,92,0,0.14)',
  purpleBorder:  'rgba(255,92,0,0.28)',
  successTint:   'rgba(255,255,255,0.10)',
  successBorder: 'rgba(255,255,255,0.22)',
  warningTint:   'rgba(255,255,255,0.10)',
  errorTint:     'rgba(255,92,0,0.10)',
  cyanTint:      'rgba(255,255,255,0.10)',
}
