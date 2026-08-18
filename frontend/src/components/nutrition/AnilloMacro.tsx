/**
 * ANILLO DE UN MACRO
 * ══════════════════
 * Proteína, carbos y grasas, cada uno con su arco.
 *
 * ── La misma forma que el plato, a propósito ────────────────────────────────
 * Arco de 270° con el mismo origen, las mismas puntas redondeadas y la misma
 * proporción de trazo que el medidor de kcal. Un círculo cerrado junto a un
 * arco abierto se leen como dos piezas traídas de sitios distintos.
 *
 * Y de paso arregla algo que el círculo escondía: en una vuelta completa, el 0 %
 * y el 100 % se distinguen mal porque no se ve dónde empieza. Un arco abierto
 * tiene principio y final a la vista.
 *
 * ── Por qué la meta NO está al final ────────────────────────────────────────
 * La rayita de la meta cae al 85 % del arco y el 15 % que sobra es sitio para
 * pasarse. Con la meta al final, cumplirla clavada y pasarse cien gramos
 * dejaban el anillo idéntico —lleno— y ese dato se perdía. Pasarse de proteína
 * suele ser buena noticia y pasarse de grasas no tanto: hay que poder verlo.
 *
 * ── Y lo dice con palabras, no solo con la rayita ───────────────────────────
 * Al pasarse, el «/150 g» se convierte en «+21 g» en rojo y el nombre del macro
 * también se pone rojo. La rayita sola no avisa: hay que estar mirando el arco y
 * saber qué significa esa marca. Con tres anillos pequeños en fila, lo que se lee
 * de un vistazo es el texto — así que el texto es el que tiene que decirlo.
 */

import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Path, Line } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from 'react-native-reanimated'
import { Colors, Typography } from '@/constants/theme'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const N = Colors.neon
const T = Typography

// Geometría, en unidades del viewBox.
const VB = 100
const C = 50
const R = 39
const SW = 6.5
const INICIO = 135        // grados absolutos: extremo inferior izquierdo
const BARRIDO = 270
const FRACCION_META = 0.85

/** Punto del arco para un ángulo absoluto, con 0° arriba. */
function polar(grados: number, radio = R) {
  const rad = ((grados - 90) * Math.PI) / 180
  return { x: C + radio * Math.cos(rad), y: C + radio * Math.sin(rad) }
}

function camino(desde: number, barrido: number, radio = R) {
  const a = polar(desde, radio)
  const b = polar(desde + barrido, radio)
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)} A${radio},${radio} 0 ${barrido > 180 ? 1 : 0},1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`
}

const LARGO = (BARRIDO / 360) * 2 * Math.PI * R
const ARCO_COMPLETO = camino(INICIO, BARRIDO)
const ARCO_EXCESO = camino(INICIO + BARRIDO * FRACCION_META, BARRIDO * (1 - FRACCION_META))

/**
 * La marca del límite mide EXACTAMENTE lo que mide el trazo.
 *
 * Iba de R-6 a R+6 sobre un trazo de 6,5 de grosor, así que asomaba por los dos
 * lados como un palito clavado. Y esa punta que sobresalía mentía: el límite
 * parecía empezar antes de donde empieza. Una marca que cruza el trazo justo de
 * borde a borde lo corta en el punto exacto y no añade nada que interpretar.
 */
const MEDIA_MARCA = SW / 2

/**
 * La duración es corta a propósito.
 *
 * Apuntar una comida y esperar a que el anillo termine de crecer convierte un
 * gesto de un segundo en una espera. 440 ms se ven como movimiento; a partir de
 * ahí se sienten como lentitud.
 */
const DURACION = 440
const CURVA = Easing.bezier(0.34, 1.12, 0.4, 1)

interface Props {
  nombre: string
  /** Gramos consumidos. */
  valor: number
  /** Gramos objetivo. */
  meta: number
  color: string
}

/** El rojo del exceso: el mismo que usa el techo de las kcal. */
const EXCESO = '#FF3B47'

export function AnilloMacro({ nombre, valor, meta, color }: Props) {
  const pasado = meta > 0 && valor > meta
  const deMas = Math.round(valor - meta)
  const avance = useSharedValue(0)

  useEffect(() => {
    const f = meta > 0 ? Math.min(1, (valor / meta) * FRACCION_META) : 0
    avance.value = withTiming(f, { duration: DURACION, easing: CURVA })
  }, [valor, meta, avance])

  const props = useAnimatedProps(() => ({
    strokeDashoffset: LARGO * (1 - avance.value),
  }))

  const marca = polar(INICIO + BARRIDO * FRACCION_META, R - MEDIA_MARCA)
  const marcaFin = polar(INICIO + BARRIDO * FRACCION_META, R + MEDIA_MARCA)

  return (
    <View style={s.caja}>
      <View style={s.anillo}>
        <Svg viewBox={`0 0 ${VB} ${VB}`} width="100%" height="100%">
          <Path d={ARCO_COMPLETO} fill="none" stroke="rgba(255,255,255,0.10)"
                strokeWidth={SW} strokeLinecap="round" />
          {/* El terreno de más allá de la meta, para que se vea antes de llegar.
              Con punta cuadrada: la redonda lo adelantaba medio trazo y el rojo
              invadía el lado bueno de la marca. */}
          <Path d={ARCO_EXCESO} fill="none" stroke="rgba(255,59,71,0.28)"
                strokeWidth={SW} strokeLinecap="butt" />
          {/* Lo consumido. Punta cuadrada también: con la redonda, la punta se
              adelantaba medio trazo y parecía que llevabas más de lo que llevas. */}
          <AnimatedPath
            d={ARCO_COMPLETO} fill="none" stroke={color}
            strokeWidth={SW} strokeLinecap="butt"
            strokeDasharray={LARGO} animatedProps={props}
          />
          <Line
            x1={marca.x} y1={marca.y} x2={marcaFin.x} y2={marcaFin.y}
            stroke="rgba(255,255,255,0.9)" strokeWidth={1.8} strokeLinecap="butt"
          />
        </Svg>

        {/* El hueco de abajo del arco es donde cabe el texto. */}
        <View style={s.centro} pointerEvents="none">
          <Text style={[s.gramos, { color }]}>{Math.round(valor)}</Text>
          <Text style={[s.de, pasado && { color: EXCESO, fontWeight: '800' }]}>
            {pasado ? `+${deMas} g` : `/${meta} g`}
          </Text>
        </View>
      </View>
      <Text style={[s.nombre, pasado && { color: EXCESO }]}>{nombre}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  caja: {
    flex: 1,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: N.edge,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 4,
  },
  anillo: { width: '100%', maxWidth: 74, aspectRatio: 1 },
  centro: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  gramos: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
  de: { fontSize: 8, fontWeight: '600', color: N.w3, marginTop: 2 },
  nombre: {
    fontSize: 8, fontWeight: '700', color: N.w2,
    letterSpacing: 1, textTransform: 'uppercase',
  },
})

/** Los tres colores, aparte de los semánticos para no confundirse con ellos. */
export const COLOR_MACRO = {
  proteina: '#FF2D78',
  carbos: '#5B8DEF',
  grasas: '#22E0C8',
} as const
