/**
 * LA LLAMA
 * ════════
 * El signo de la racha, en un solo sitio. La usan el icono de la cabecera, los
 * peldaños del reactor y la ficha de cada hito.
 *
 * Trazada a mano sobre retícula de 24: cuerpo asimétrico con la punta cayendo a
 * la derecha —una llama simétrica parece una gota— y un corazón interior que se
 * recorta en el color del fondo para dar profundidad a tamaños pequeños.
 *
 * El corazón va del color del FONDO y no blanco: así el hueco se lee como
 * profundidad y no como una segunda llama pegada dentro.
 */

import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'

const CUERPO =
  'M13.4 1.2c.5 3.4-.9 4.6-2.3 6.4-1.5 1.9-3.2 4-3.2 7.2 0 3.9 2.8 6.9 6.1 6.9' +
  's6.1-2.7 6.1-6.6c0-2.4-1-4.3-2.1-5.9-.4 1.3-1.2 2.2-2.2 2.5.8-3.4-.4-7.3-2.4-10.5z'

const CORAZON =
  'M13.1 10.9c.3 2 .9 2.7 1.7 3.9.5.8.8 1.6.8 2.5 0 1.7-1.2 2.9-2.6 2.9' +
  's-2.6-1.2-2.6-3c0-1.9 1.5-3.1 2.7-6.3z'

let contador = 0

interface Props {
  tam: number
  /** El tono base del fuego. */
  neon: string
  /** El mismo tono aclarado, para la punta. */
  claro: string
  /** Apagada: gris, sin degradado. */
  apagada?: boolean
  /** El color sobre el que se dibuja, para el hueco interior. */
  fondo?: string
}

export function Llama({ tam, neon, claro, apagada, fondo = '#0D0D10' }: Props) {
  /* Cada instancia necesita su propio id de degradado: con uno compartido, la
     primera llama que se monte define el color de todas las demás. */
  const id = `llama${contador++}`
  return (
    /* El viewBox va ceñido al trazado, no a la retícula: el dibujo ocupa de
       7,9 a 20,1 en X, así que con `0 0 24 24` quedaba descentrado dos unidades
       a la derecha y con aire de sobra arriba. Cuadrado —20,5 de lado— para que
       no se deforme, y centrado en el propio contenido. */
    <Svg width={tam} height={tam} viewBox="3.75 1.2 20.5 20.5">
      <Defs>
        <LinearGradient id={id} x1="0" y1="1" x2="0.3" y2="0">
          <Stop offset="0" stopColor={neon} />
          <Stop offset="1" stopColor={claro} />
        </LinearGradient>
      </Defs>
      <Path d={CUERPO} fill={apagada ? 'rgba(255,255,255,0.2)' : `url(#${id})`} />
      <Path d={CORAZON} fill={fondo} opacity={0.93} />
    </Svg>
  )
}
