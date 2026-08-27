/**
 * CICLO · EL SISTEMA VISUAL CLARO
 * ═══════════════════════════════════════════════════════════════════════════
 * La única isla clara de ZENCRUS. El resto de la app es `#08080A` con rojo y
 * glass; aquí se entra a tema claro con un fondo distinto por pantalla.
 *
 * ── Por qué rompe con el resto de la app, a propósito ──────────────────────
 * Es una decisión de producto de Sergio, no un descuido: el ciclo es un
 * espacio propio, y el cambio de temperatura al entrar es lo que lo señala.
 * Es el mismo camino que toman Flo y Clue. Que sea deliberado significa que
 * hay que sostenerlo entero: una sola pantalla que se olvide de pintar su
 * fondo se verá negra y parecerá un fallo de carga.
 *
 * ── Los colores NO están estimados a ojo ───────────────────────────────────
 * Salen de muestrear los PNG del mockup: un barrido por franjas quedándose
 * con los píxeles que tienen saturación real, para no confundir el color de
 * un punto de leyenda con el blanco del texto que lleva al lado. Por eso hay
 * valores raros como `#EA6666` en vez de un `#EE6666` redondo.
 *
 * ── Dos familias de color que no se mezclan ────────────────────────────────
 * `FASE` es el dominio: qué fase del ciclo es. `ACENTO` es la función: qué
 * hace un control. El rojo de la fase menstrual (`#EA6666`) y el rojo de un
 * chip seleccionado (`#E44E5A`) son distintos y deben seguir siéndolo, porque
 * un chip rojo de síntoma no significa «estás menstruando».
 */

import type { TextStyle } from 'react-native'

import type { Phase } from '@/features/salud/ciclo/fases'

/* ── Las cuatro fases ───────────────────────────────────────────────────── */

export interface TonoFase {
  /**
   * El arco del anillo y el punto de la leyenda.
   *
   * En la ventana fértil el anillo usa violeta sólido mientras el calendario
   * usa lila claro: es la misma fase tratada con el detalle que permite cada
   * componente, y el prompt maestro lo dice explícitamente.
   */
  arco: string
  /** El relleno de una casilla de calendario. */
  celda: string
  /**
   * El mismo color, oscurecido lo justo para leerse como TEXTO sobre blanco.
   *
   * El documento no da estos valores porque solo define rellenos, y un lila
   * `#D9CCF5` de 12 px sobre fondo blanco no se lee. Son derivados del color de
   * fase, no colores nuevos: la regla de oro sigue intacta.
   */
  texto: string
  etiqueta: string
}

/**
 * Los cuatro colores de fase. Única fuente de verdad.
 *
 * Vienen del prompt maestro y sustituyen a los del mockup: rojo `#D93B3B`,
 * lila `#D9CCF5`, violeta `#8B5CF6` y celeste `#AEE0F0`.
 */
export const FASE: Record<Phase, TonoFase> = {
  menstrual:  { arco: '#D93B3B', celda: '#D93B3B', texto: '#B32E2E', etiqueta: 'Menstrual' },
  folicular:  { arco: '#D9CCF5', celda: '#EFE9FB', texto: '#7A6AAE', etiqueta: 'Folicular' },
  ovulatoria: { arco: '#8B5CF6', celda: '#D9CCF5', texto: '#7A4FD6', etiqueta: 'Ovulación' },
  lutea:      { arco: '#AEE0F0', celda: '#E4F4FA', texto: '#3F8FA8', etiqueta: 'Lútea' },
}

/** El día pico de fertilidad: más intenso que el resto de la ventana. */
export const PICO_FERTIL = { celda: '#B49CE8', arco: '#8B5CF6' } as const

/**
 * Los colores de categoría de los badges del calendario.
 *
 * Nutrición y piel comparten verde a propósito: es lo que dice el documento, y
 * las dos hablan de lo mismo —lo que entra y cómo se refleja fuera—.
 */
export const CATEGORIA = {
  sintomas: '#E4525F',
  animo: '#E9711B',
  energia: '#2FA9AC',
  nutricion: '#1F9E6A',
  entrenamiento: '#6C4FD9',
  piel: '#1F9E6A',
  vidaSexual: '#D6538F',
} as const

/** El orden de prioridad al recortar a tres badges por casilla. */
export const ORDEN_CATEGORIAS = [
  'sintomas', 'animo', 'energia', 'nutricion', 'entrenamiento', 'piel',
] as const

/** El borde de «hoy», en cualquier pantalla. */
export const ACENTO_HOY = '#6C4FD9'

/* ── Los acentos funcionales ────────────────────────────────────────────── */

export const ACENTO = {
  /** El color de acción: botones activos, pestaña seleccionada, barras. */
  morado: '#6C4ED8',
  moradoSuave: '#DCD0F7',
  moradoFondo: '#ECE5FA',

  /** Selección dentro del registro: flujo, síntomas. */
  rojo: '#E44E5A',
  rojoSuave: '#FDECEC',

  /** Vida sexual y deseo. */
  rosa: '#D24E8A',
  rosaSuave: '#FCDEEA',

  /** Nutrición: apetito, antojos, tarjetas de comida. */
  verde: '#1E9C66',
  verdeSuave: '#D8F0E4',

  /** Energía. */
  teal: '#2AA8A8',
  tealSuave: '#D8F0F0',

  /** Destacados y ánimo. */
  naranja: '#F1791E',
  naranjaClaro: '#F8963E',
  naranjaSuave: '#FFE4C8',

  /** Sangre en el calendario: más hondo que la fase, para que se lea sobre blanco. */
  periodo: '#B23A63',
  fertil: '#2A8A8D',
  fertilSuave: '#D8F0F0',
} as const

/* ── Los fondos, uno por pantalla ───────────────────────────────────────── */

/**
 * El mockup cambia de fondo en cada pantalla. No es decoración: es la manera
 * de saber dónde estás sin leer el título, igual que las secciones de una
 * revista. Se guardan aquí y no dentro de cada pantalla para que se puedan
 * ver los ocho de un vistazo y detectar dos demasiado parecidos.
 */
export const FONDO = {
  seguridad:  '#10ABC1',
  prediccion: '#F8B376',
  bienvenida: '#F9B3C1',
  portada:    '#FBB5C3',
  calendario: '#E7E1F7',
  registro:   '#F8F4FA',
  estadisticas: '#F7F4FC',
  comunidad:  '#F7F4FC',
  ajustes:    '#F7F4FC',
} as const

/* ── Superficies y texto ────────────────────────────────────────────────── */

export const SUP = {
  tarjeta: '#FFFFFF',
  tarjetaCrema: '#FDF8F1',
  borde: 'rgba(17,12,34,0.08)',
  bordeChip: 'rgba(17,12,34,0.12)',
} as const

export const TEXTO = {
  /** Títulos y cifras. Casi negro, nunca negro puro: sobre blanco vibra. */
  fuerte: '#1A1024',
  /** Cuerpo. */
  medio: '#6B6280',
  /** Etiquetas y unidades. */
  suave: '#9C93B0',
  /** Sobre fondos de color saturado. */
  sobreColor: '#FFFFFF',
} as const

/* ── Medidas ────────────────────────────────────────────────────────────── */

export const RADIO = { tarjeta: 26, chip: 999, celda: 14, icono: 16, boton: 999 } as const

export const HUECO = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 } as const

/**
 * La sombra de tarjeta.
 *
 * En claro una tarjeta blanca sobre fondo claro solo se distingue por la
 * sombra; sin ella el mockup se convierte en una mancha. Es suave y muy
 * abierta a propósito: una sombra dura sobre pastel se ve sucia.
 */
export const SOMBRA = {
  shadowColor: '#2A1A44',
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const

/* ── Tipografía ─────────────────────────────────────────────────────────── */

/**
 * El mockup usa una grotesca de palo seco en todo. Inter es la que ya carga la
 * app y encaja; Rajdhani se queda FUERA de esta sección, porque su forma
 * condensada es la voz de la parte deportiva y aquí sonaría a otra marca.
 */
export const FUENTE = {
  titulo: 'Inter_800ExtraBold',
  fuerte: 'Inter_700Bold',
  medio: 'Inter_600SemiBold',
  cuerpo: 'Inter_500Medium',
  suave: 'Inter_400Regular',
} as const

/**
 * Cifras que no bailan al cambiar de valor.
 *
 * Va tipado como `TextStyle` y SIN `as const`: con `as const` el array queda de
 * solo lectura, React Native espera uno mutable, y el estilo entero deja de
 * encajar. El síntoma es desconcertante —`StyleSheet.create` empieza a
 * devolver una unión de TextStyle|ViewStyle|ImageStyle y fallan veinte líneas
 * que no tienen nada que ver con la tipografía—, así que conviene dejarlo
 * dicho aquí.
 */
export const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] }
