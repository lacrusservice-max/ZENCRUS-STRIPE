/**
 * SELLO DE ALIMENTO VERIFICADO
 * ────────────────────────────
 * Roseta de once lóbulos con una palomita recortada dentro. Marca los alimentos
 * que vienen de una fuente oficial —SMAE o USDA— frente a los que alguien ha
 * tecleado a mano.
 *
 * Un tilde verde suelto, que es lo que usa media competencia, no dice de dónde
 * sale el dato ni se distingue de un icono de sistema. Esta forma sí: se lee
 * como un sello de garantía y es la misma en toda la app.
 *
 * ── Por qué solo dos colores ────────────────────────────────────────────────
 * La palomita no lleva color propio: se recorta en el color del fondo sobre el
 * que se pinta. Así el mismo componente vale para el tema oscuro (roseta blanca,
 * palomita negra) y para el claro (roseta negra, palomita blanca) sin tocar el
 * dibujo — solo se le pasan los dos colores al revés.
 */

import Svg, { Path } from 'react-native-svg'
import Animated, { FadeIn } from 'react-native-reanimated'

/**
 * Trazo generado sobre retícula de 24, centro en 12,12. Los vértices caen en un
 * radio de 8.4 y los puntos de control en 11.1, que es lo que redondea cada
 * pétalo sin que la silueta se vuelva una flor.
 */
const ROSETTE =
  'M12.00 3.60Q15.13 1.35 16.54 4.93Q20.39 4.73 19.64 8.51Q22.99 10.42 20.31 13.20' +
  'Q22.10 16.61 18.35 17.50Q18.00 21.34 14.37 20.06Q12.00 23.10 9.63 20.06' +
  'Q6.00 21.34 5.65 17.50Q1.90 16.61 3.69 13.20Q1.01 10.42 4.36 8.51' +
  'Q3.61 4.73 7.46 4.93Q8.87 1.35 12.00 3.60Z'

const CHECK = 'M7.6 12.3 L10.6 15.2 L16.4 9.1'

export function VerifiedSeal({
  size = 16,
  color = '#FFFFFF',
  checkColor = '#050505',
  delay = 0,
}: {
  size?: number
  /** Color de la roseta. Blanco sobre fondo oscuro, casi negro sobre claro. */
  color?: string
  /** Color de la palomita. Es el color del FONDO sobre el que se pinta el sello. */
  checkColor?: string
  /** Retraso de la entrada, para escalonar la lista. */
  delay?: number
}) {
  return (
    <Animated.View entering={FadeIn.delay(delay).duration(220)}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={ROSETTE} fill={color} />
        <Path
          d={CHECK}
          stroke={checkColor}
          strokeWidth={3.1}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  )
}
