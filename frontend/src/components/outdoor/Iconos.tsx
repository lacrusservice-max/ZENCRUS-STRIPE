/**
 * AL AIRE LIBRE · DEPORTES E ICONOS
 * ═════════════════════════════════
 * Los cuatro deportes del módulo, con lo único que de verdad los diferencia:
 * **qué miden**. La carcasa de las pantallas es la misma para los cuatro.
 *
 * ── Ningún deporte tiene color propio ───────────────────────────────────────
 * La tentación es pintar la bici de ámbar y el senderismo de cian para que se
 * distingan de un vistazo. Es un error, y del caro: en este módulo el color ya
 * significa **esfuerzo** —las cinco zonas—, y el ámbar ya quiere decir «umbral».
 * Si además quisiera decir «bici», la escala deja de servir para lo que existe.
 *
 * Se distinguen por icono y por la cifra que mandan. Eso basta y no gasta el
 * único recurso que aquí es información.
 */

import { Ionicons } from '@expo/vector-icons'

export type Deporte = 'correr' | 'bici' | 'caminar' | 'senderismo'

type Ion = keyof typeof Ionicons.glyphMap

export const DEPORTES: Record<Deporte, {
  nombre: string
  icono: Ion
  /** Lo que se enseña grande mientras te mueves. */
  principal: string
  /** El resto de lo que tiene sentido medir en ese deporte. */
  metricas: string[]
  lema: string
}> = {
  correr: {
    nombre: 'Correr',
    icono: 'walk',
    principal: 'distancia',
    metricas: ['ritmo', 'cadencia', 'zancada', 'pulso'],
    lema: 'Ritmo por km · cadencia · zancada',
  },
  bici: {
    nombre: 'Bici',
    icono: 'bicycle',
    principal: 'velocidad',
    metricas: ['potencia', 'cadencia de pedaleo', 'velocidad media', 'pulso'],
    lema: 'Velocidad · potencia · cadencia de pedaleo',
  },
  caminar: {
    nombre: 'Caminar',
    icono: 'footsteps',
    principal: 'pasos',
    metricas: ['ritmo', 'tiempo activo', 'distancia'],
    lema: 'Pasos · ritmo suave · tiempo activo',
  },
  senderismo: {
    nombre: 'Senderismo',
    icono: 'trail-sign',
    principal: 'desnivel',
    metricas: ['altitud', 'pendiente', 'distancia', 'tiempo'],
    lema: 'Desnivel acumulado · altitud · pendiente',
  },
}

export const ORDEN_DEPORTES: Deporte[] = ['correr', 'bici', 'caminar', 'senderismo']

/**
 * Qué unidad manda en cada deporte. Correr piensa en minutos por kilómetro;
 * la bici, en kilómetros por hora. Son la misma magnitud invertida, y
 * enseñarle a un ciclista su ritmo en min/km es enseñarle un número que no usa.
 */
export function unidadPrincipal(d: Deporte): { etiqueta: string; unidad: string } {
  switch (d) {
    case 'bici': return { etiqueta: 'Velocidad', unidad: 'km/h' }
    case 'caminar': return { etiqueta: 'Pasos', unidad: '' }
    case 'senderismo': return { etiqueta: 'Desnivel', unidad: 'm' }
    default: return { etiqueta: 'Distancia', unidad: 'km' }
  }
}
