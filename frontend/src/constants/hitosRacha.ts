/**
 * LOS SEIS HITOS DE LA RACHA
 * ══════════════════════════
 * Cada uno con su color, su vídeo y su nombre. Un solo componente los pinta
 * todos: lo único que cambia entre el primer día y los mil es esta fila.
 *
 * ── Los colores salen del personaje, no al revés ────────────────────────────
 * `neon` es el tono del fuego de ZENA en cada vídeo, sacado de sus fotogramas.
 * Todo lo demás de la tarjeta —el filo, el aura, las chispas, la cifra, los
 * días y el botón— se deriva de él. La primera versión hacía lo contrario:
 * ponía marcos dorados sobre un personaje rojo, y peleaban. Si el personaje ya
 * trae color, la pieza tiene que ser una extensión suya.
 *
 * ── Por qué van empaquetados y no en R2 ─────────────────────────────────────
 * Los 206 vídeos de ejercicios se sirven de R2 porque se ven cuando toca y
 * pesan 2 GB juntos. Estos seis son 5,5 MB y se ven en el instante exacto en
 * que alguien acaba de conseguir algo: bajarlos por red en ese momento
 * significaría que el premio llega tarde. Los originales pesaban 31 MB; a
 * 480 px y con la duración justa caben en la app sin que se note.
 */

export interface Hito {
  /** A partir de cuántos días seguidos se enciende este hito. */
  desde: number
  /** El tono del fuego del personaje. De aquí sale TODO el color de la pieza. */
  neon: string
  /** El mismo tono aclarado, para textos y filos. */
  claro: string
  /** Un fondo muy oscuro del mismo matiz, para el texto sobre color. */
  fondo: string
  titulo: string
  video: number
  /**
   * El primer fotograma, como imagen.
   *
   * El vídeo tarda un segundo o dos en abrirse —más por el tunnel de Expo Go—
   * y hasta entonces se veía un hueco negro. El póster pesa 11 KB, aparece al
   * instante y el vídeo lo tapa cuando arranca: el corte no se nota porque es
   * exactamente el mismo fotograma.
   */
  poster: number
}

/**
 * De mayor a menor a propósito: `hitoDe` devuelve el primero que se cumple, y
 * al revés todo el mundo se quedaría en «primera racha» para siempre.
 */
export const HITOS: Hito[] = [
  { desde: 1000, neon: '#E4E8F0', claro: '#FFFFFF', fondo: '#14161C', titulo: 'Mil días',      video: require('@/assets/video/racha-blanca.mp4') , poster: require('@/assets/video/poster-blanca.jpg') },
  { desde: 600,  neon: '#FFB01F', claro: '#FFD98A', fondo: '#2E1B00', titulo: 'Seiscientos',   video: require('@/assets/video/racha-dorada.mp4') , poster: require('@/assets/video/poster-dorada.jpg') },
  { desde: 400,  neon: '#39D353', claro: '#93F0A2', fondo: '#04220C', titulo: 'Cuatrocientos', video: require('@/assets/video/racha-verde.mp4') , poster: require('@/assets/video/poster-verde.jpg') },
  { desde: 200,  neon: '#A855F7', claro: '#D6ABFF', fondo: '#1B0A2E', titulo: 'Doscientos',    video: require('@/assets/video/racha-morada.mp4') , poster: require('@/assets/video/poster-morada.jpg') },
  { desde: 100,  neon: '#2E9BFF', claro: '#8FD0FF', fondo: '#04182E', titulo: 'Cien días',     video: require('@/assets/video/racha-azul.mp4') , poster: require('@/assets/video/poster-azul.jpg') },
  { desde: 1,    neon: '#FF4A2E', claro: '#FF9166', fondo: '#2A0E06', titulo: 'Primera racha', video: require('@/assets/video/racha-roja.mp4') , poster: require('@/assets/video/poster-roja.jpg') },
]

/** El hito que corresponde a una racha. Nunca devuelve undefined con días ≥ 1. */
export function hitoDe(dias: number): Hito {
  return HITOS.find(h => dias >= h.desde) ?? HITOS[HITOS.length - 1]
}

/**
 * ¿Este día merece celebración de HITO?
 *
 * Cruzar los 100 no es lo mismo que sumar el día 47. El vídeo azul debe verse
 * el día que se llega a 100 y no volver a salir hasta los 200 — si apareciera
 * cada día a partir de entonces, dejaría de significar nada.
 */
export const esDiaDeHito = (dias: number): boolean => HITOS.some(h => h.desde === dias)
