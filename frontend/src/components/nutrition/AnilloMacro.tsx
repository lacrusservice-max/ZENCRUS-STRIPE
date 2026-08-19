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
 * ── El mismo semáforo que las kcal ──────────────────────────────────────────
 * Gris por debajo del mínimo, ámbar dentro del mínimo, verde en la meta y rojo
 * pasado el tope: exactamente los cuatro tramos del arco grande.
 *
 * Antes cada macro tenía un color fijo —rosa, azul, turquesa— y eso tenía dos
 * problemas. Uno de marca: tres colores que no son de ZENCRUS, y la pantalla
 * dejaba de parecer suya. Y otro de información: con un color fijo, el anillo
 * solo dice CUÁNTO llevas; para saber si eso es bueno o malo hay que mirar la
 * rayita y hacer la cuenta. Con el semáforo, el color ya lo dice.
 *
 * El «+21 g» se queda porque da la cifra exacta, que el color no puede dar.
 */

import { useEffect, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Path, Circle, Line } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from 'react-native-reanimated'
import { Colors, Typography } from '@/constants/theme'
import { limitesDeMacro, tramoDe, COLOR_TRAMO, FRACCION_TECHO, finDeEscala, fraccion } from '@/utils/tramoCalorico'

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

/**
 * Remates redondeados y exactos, igual que el plato.
 *
 * Una punta redonda se extiende medio grosor más allá del punto donde acaba el
 * recorrido. Con la pista redondeada y el progreso cuadrado, la pista asomaba
 * por los extremos y dejaba huecos oscuros sin rellenar. Se redondea todo Y se
 * descuenta ese medio trazo, así que la punta cae donde toca y no sobra nada.
 */
const DELTA = ((SW / 2) / R) * (180 / Math.PI)

const ARCO_COMPLETO = camino(INICIO + DELTA, BARRIDO - DELTA * 2)
const ARCO_EXCESO = camino(
  INICIO + BARRIDO * FRACCION_TECHO + DELTA,
  BARRIDO * (1 - FRACCION_TECHO) - DELTA * 2,
)
const LARGO = ((BARRIDO - DELTA * 2) / 360) * 2 * Math.PI * R

/** Donde nace el arco: sin esto, los primeros gramos no se ven. */
const ARRANQUE = polar(INICIO + DELTA)

/**
 * De la fracción del RECORRIDO a la fracción del TRAZO.
 *
 * No son la misma. El recorrido lógico va de 0 a BARRIDO; el trazo pintado
 * empieza δ después y acaba δ antes, porque sus puntas redondas cubren esos δ.
 *
 * Para que el borde de la punta caiga justo en `BARRIDO · f`, el trazo tiene que
 * acabar δ ANTES de ese punto. Sin esta conversión la punta cae bien solo al
 * 100 %, y en el resto se adelanta — que es el error que tenía la versión de
 * puntas cuadradas, solo que al revés.
 */
function fraccionDeTrazo(f: number): number {
  const util = BARRIDO - DELTA * 2
  if (util <= 0) return 0
  return Math.min(1, Math.max(0, (BARRIDO * f - DELTA * 2) / util))
}


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
}

export function AnilloMacro({ nombre, valor, meta }: Props) {
  /* Memoizado porque entra en las dependencias del efecto: sin esto es un
     objeto nuevo en cada render y la animación se relanzaría sin parar. */
  const limites = useMemo(() => limitesDeMacro(meta), [meta])
  const tramo = tramoDe(valor, limites)
  const color = COLOR_TRAMO[tramo]
  const pasado = valor > meta
  const deMas = Math.round(valor - meta)

  const avance = useSharedValue(0)
  useEffect(() => {
    avance.value = withTiming(fraccionDeTrazo(fraccion(valor, limites)), { duration: DURACION, easing: CURVA })
  }, [valor, limites, avance])

  const props = useAnimatedProps(() => ({
    strokeDashoffset: LARGO * (1 - avance.value),
  }))

  /* Las tres marcas, en la misma proporción que el arco grande. Sin etiqueta:
     en 74 px no cabe texto, y el color del anillo ya dice en qué tramo vas. */
  const fin = finDeEscala(limites)
  const marcas = [limites.minimo / fin, limites.meta / fin, limites.techo / fin].map((f, i) => ({
    a: polar(INICIO + BARRIDO * f, R - MEDIA_MARCA),
    b: polar(INICIO + BARRIDO * f, R + MEDIA_MARCA),
    fuerte: i === 2,
  }))

  return (
    <View style={s.caja}>
      <View style={s.anillo}>
        <Svg viewBox={`0 0 ${VB} ${VB}`} width="100%" height="100%">
          <Path d={ARCO_COMPLETO} fill="none" stroke="rgba(255,255,255,0.10)"
                strokeWidth={SW} strokeLinecap="round" />
          {/* El terreno de más allá de la meta, para que se vea antes de llegar. */}
          <Path d={ARCO_EXCESO} fill="none" stroke="rgba(255,59,71,0.28)"
                strokeWidth={SW} strokeLinecap="round" />
          {/* El arco nace de un punto: una punta redonda no puede dibujarse más
              estrecha que ella misma, así que sin esto los primeros gramos
              dejaban el anillo quieto. */}
          {valor > 0 && <Circle cx={ARRANQUE.x} cy={ARRANQUE.y} r={SW / 2} fill={color} />}
          <AnimatedPath
            d={ARCO_COMPLETO} fill="none" stroke={color}
            strokeWidth={SW} strokeLinecap="round"
            strokeDasharray={LARGO} animatedProps={props}
          />
          {marcas.map((m, i) => (
            <Line
              key={i}
              x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y}
              stroke={m.fuerte ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'}
              strokeWidth={m.fuerte ? 2 : 1.4} strokeLinecap="butt"
            />
          ))}
        </Svg>

        {/* El hueco de abajo del arco es donde cabe el texto. */}
        <View style={s.centro} pointerEvents="none">
          <Text style={[s.gramos, { color }]}>{Math.round(valor)}</Text>
          <Text style={[s.de, pasado && { color, fontWeight: '800' }]}>
            {pasado ? `+${deMas} g` : `/${meta} g`}
          </Text>
        </View>
      </View>
      <Text style={s.nombre}>{nombre}</Text>
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

