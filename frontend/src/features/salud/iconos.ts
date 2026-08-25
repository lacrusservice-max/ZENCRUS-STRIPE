/**
 * LOS ICONOS, POR CATEGORÍA
 * ═══════════════════════════════════════════════════════════════════════════
 * Ionicons trae más de mil trescientos. Enseñarlos todos de golpe no es dar
 * libertad, es dar un muro: nadie recorre mil iconos para elegir uno.
 *
 * ── Se filtra por el NOMBRE, no por una lista a mano ───────────────────────
 * Cada categoría es un puñado de palabras que se buscan dentro del nombre del
 * icono. Así una categoría no se queda anticuada cuando Ionicons añade uno
 * nuevo, y no hay que mantener listas de cuarenta nombres.
 *
 * ── Y nada queda fuera ─────────────────────────────────────────────────────
 * Las categorías son un atajo, no el límite. El buscador atraviesa los mil
 * trescientos y «ver todos» despliega la rejilla entera.
 */

import { Ionicons } from '@expo/vector-icons'

type IconName = React.ComponentProps<typeof Ionicons>['name']

export const TODOS_LOS_ICONOS = Object.keys(Ionicons.glyphMap).sort() as IconName[]

interface Categoria {
  id: string
  etiqueta: string
  /** Se busca cada palabra DENTRO del nombre del icono. */
  claves: string[]
}

export const CATEGORIAS: Categoria[] = [
  { id: 'deporte',  etiqueta: 'DEPORTE',  claves: ['barbell', 'bicycle', 'football', 'basketball', 'tennis', 'golf', 'walk', 'body', 'fitness', 'baseball', 'american-football', 'bowling'] },
  { id: 'salud',    etiqueta: 'SALUD',    claves: ['heart', 'pulse', 'medkit', 'medical', 'bandage', 'thermometer', 'fitness', 'water', 'eyedrop', 'flask'] },
  { id: 'comida',   etiqueta: 'COMIDA',   claves: ['restaurant', 'nutrition', 'cafe', 'pizza', 'wine', 'beer', 'egg', 'fish', 'ice-cream', 'fast-food', 'basket'] },
  { id: 'descanso', etiqueta: 'DESCANSO', claves: ['moon', 'bed', 'sunny', 'partly-sunny', 'cloud', 'star', 'hourglass', 'time', 'alarm'] },
  { id: 'mente',    etiqueta: 'MENTE',    claves: ['leaf', 'book', 'bulb', 'library', 'musical', 'headset', 'flower', 'sparkles', 'infinite', 'school'] },
  { id: 'casa',     etiqueta: 'CASA',     claves: ['home', 'shirt', 'tv', 'key', 'bed', 'bulb', 'trash', 'cart', 'construct', 'hammer'] },
  { id: 'trabajo',  etiqueta: 'TRABAJO',  claves: ['briefcase', 'laptop', 'desktop', 'mail', 'calendar', 'stats', 'bar-chart', 'create', 'document', 'clipboard'] },
  { id: 'ocio',     etiqueta: 'OCIO',     claves: ['game', 'camera', 'film', 'mic', 'color-palette', 'airplane', 'boat', 'car', 'map', 'globe'] },
]

/**
 * Los iconos de una categoría.
 *
 * Se dejan primero las variantes rellenas —las que no acaban en `-outline` ni
 * en `-sharp`—: son las que se leen mejor a 21 px dentro de un azulejo, y
 * poner las tres variantes seguidas del mismo dibujo llena la rejilla de
 * repeticiones que parecen un fallo.
 */
export function iconosDe(catId: string): IconName[] {
  const cat = CATEGORIAS.find(c => c.id === catId)
  if (!cat) return []
  const coincide = (n: string) => cat.claves.some(k => n.includes(k))
  const rellenos = TODOS_LOS_ICONOS.filter(n =>
    coincide(n) && !n.endsWith('-outline') && !n.endsWith('-sharp'))
  return rellenos.length ? rellenos : TODOS_LOS_ICONOS.filter(n => coincide(n))
}

/**
 * En qué categoría cae un icono.
 *
 * Para abrir la rejilla donde está el icono que ya tiene puesto en vez de en
 * la primera categoría, donde no se ve por ninguna parte y parece que no hay
 * ninguno elegido.
 */
export function categoriaDe(icono: string): string {
  const cat = CATEGORIAS.find(c => c.claves.some(k => icono.includes(k)))
  return cat?.id ?? CATEGORIAS[0].id
}

/** Lo que toca enseñar según lo que se haya buscado o desplegado. */
export function iconosVisibles(
  busca: string, categoria: string, verTodos: boolean,
): IconName[] {
  const q = busca.trim().toLowerCase()
  if (q) return TODOS_LOS_ICONOS.filter(n => n.includes(q))
  return verTodos ? TODOS_LOS_ICONOS : iconosDe(categoria)
}
