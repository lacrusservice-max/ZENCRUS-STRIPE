/**
 * LOS CINCO ÁNIMOS
 * ═══════════════════════════════════════════════════════════════════════════
 * Vivían copiados en `hoy.tsx` y en `registrar.tsx`, con los mismos diez
 * números escritos dos veces. Aquí solo hay una copia, porque el día que
 * alguien mueva «sensible» un poco hacia arriba en una de las dos pantallas,
 * el mismo toque quedaría guardado como dos ánimos distintos según por dónde
 * se registrara, y las estadísticas por fase repartirían ese ánimo en dos.
 *
 * ── Por qué el ánimo se guarda como dos números y se enseña como palabra ───
 * El esquema guarda valencia (mal↔bien) y activación (apagada↔acelerada), que
 * es lo que permite correlacionarlo con la fase. Pero nadie piensa en
 * coordenadas: lo que se toca es una cara, y lo que se lee de vuelta tiene que
 * ser esa misma palabra. Estas cinco parejas son el puente entre las dos
 * cosas, y `animoMasCercano` lo cruza en sentido inverso.
 */

import type { NombreIcono } from './iconos'

export interface Animo {
  id: string
  etiqueta: string
  icono: NombreIcono
  valence: number
  arousal: number
}

export const ANIMOS: Animo[] = [
  { id: 'feliz',     etiqueta: 'Feliz',     icono: 'mood_feliz',     valence: 0.8,  arousal: 0.4 },
  { id: 'tranquila', etiqueta: 'Tranquila', icono: 'mood_tranquila', valence: 0.4,  arousal: -0.5 },
  { id: 'sensible',  etiqueta: 'Sensible',  icono: 'mood_sensible',  valence: -0.2, arousal: 0.2 },
  { id: 'irritable', etiqueta: 'Irritable', icono: 'mood_irritable', valence: -0.5, arousal: 0.7 },
  { id: 'triste',    etiqueta: 'Triste',    icono: 'mood_triste',    valence: -0.8, arousal: -0.4 },
]

/**
 * El ánimo exacto que se tocó, si se tocó uno.
 *
 * Tolerancia mínima a propósito: esto NO es «el ánimo más parecido». Solo
 * reconoce lo que salió de tocar una de las cinco caras, y devuelve `null`
 * ante cualquier otra pareja de números. El pad continuo de `PadAnimo` puede
 * guardar coordenadas intermedias, y ponerles la etiqueta de la cara más
 * cercana sería inventarse una palabra que ella nunca eligió.
 */
export function animoExacto(valence: number, arousal: number): Animo | null {
  return ANIMOS.find(a =>
    Math.abs(valence - a.valence) < 0.05 && Math.abs(arousal - a.arousal) < 0.05) ?? null
}

/**
 * El ánimo más cercano en el plano, para agrupar.
 *
 * Este sí acepta cualquier punto, y es el que usan las estadísticas: para
 * contar cuál es el ánimo dominante de una fase hace falta meter también los
 * puntos intermedios en alguna cesta, o quien use el pad continuo no
 * aparecería en sus propias estadísticas. La diferencia con `animoExacto` es
 * deliberada: uno responde «¿qué tocó?» y el otro «¿a qué se parece?».
 */
export function animoMasCercano(valence: number, arousal: number): Animo {
  let mejor = ANIMOS[0]
  let d = Infinity
  for (const a of ANIMOS) {
    const dist = (valence - a.valence) ** 2 + (arousal - a.arousal) ** 2
    if (dist < d) { d = dist; mejor = a }
  }
  return mejor
}
