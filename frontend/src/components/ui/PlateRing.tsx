/**
 * MEDIDOR DEL DÍA · ZENCRUS
 * ═════════════════════════
 *
 * Arco de 270° con tres marcas etiquetadas —mínimo, meta y techo— y un tramo
 * final reservado a pasarse. El color del arco es el del tramo en el que va el
 * día, y sale de `tramoCalorico`: aquí no se decide, aquí se dibuja.
 *
 * ── Por qué el techo NO está al final del arco ──────────────────────────────
 * Cae al 85 % del recorrido, y el 15 % que sobra es terreno de exceso. Con el
 * techo al final, pasarse por 5 kcal y pasarse por 600 dejaban el arco igual
 * —lleno— y el dato solo vivía en el texto. Lo que hace falta ver de un vistazo
 * es CUÁNTO te has pasado.
 *
 * ── Por qué cada marca lleva su nombre ──────────────────────────────────────
 * Tres rayitas sin etiqueta obligan a adivinar cuál es cuál. Estuvieron un rato
 * como una fila de números debajo del arco y era peor: había que saltar la vista
 * de la marca al número y volver.
 *
 * ── Por qué no hay halo ─────────────────────────────────────────────────────
 * Una versión anterior envolvía el anillo en un degradado rojo que latía. Teñía
 * el centro de granate, competía con la cifra y convertía tres estados distintos
 * en la misma mancha. El color aquí significa una sola cosa: en qué tramo vas.
 */

import React, { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from 'react-native-reanimated'
import { Colors } from '@/constants/theme'
import {
  Limites, Tramo, tramoDe, COLOR_TRAMO, FRACCION_TECHO, finDeEscala, fraccion,
} from '@/utils/tramoCalorico'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const N = Colors.neon

/*
 * Geometría del arco. El radio es 79 y no 88 POR LAS ETIQUETAS.
 *
 * Con 88, la etiqueta «mín» —que cae a la izquierda y se alinea por su
 * derecha— empezaba en x = -3: fuera del lienzo. El SVG la recortaba y en
 * pantalla se leía «nín». Un fallo que solo se ve ampliando la captura, porque
 * a tamaño real parece una letra mal dibujada y no un texto cortado.
 *
 * El radio de las etiquetas (R + 15) deja además hueco entre el trazo y el
 * texto: pegadas al arco se leen como parte de él.
 */
const VB = 232
const C = 116
const R = 79
const SW = 13
const INICIO = 135
const BARRIDO = 270

/** Punto del arco para un ángulo absoluto, con 0° arriba y sentido horario. */
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

/**
 * REMATES REDONDEADOS, PERO EXACTOS
 * ─────────────────────────────────
 * Una punta redonda se extiende medio grosor de trazo MÁS ALLÁ del punto donde
 * acaba el recorrido. Eso obliga a elegir entre dos cosas malas:
 *
 *   · todo en punta cuadrada — exacto, pero la pista redondeada de fondo asoma
 *     por los extremos y deja huecos oscuros sin rellenar;
 *   · todo en punta redonda — bonito, pero cada extremo miente medio trazo:
 *     unas 49 kcal en esta escala, y el rojo del exceso invade el lado bueno
 *     del techo.
 *
 * No hay que elegir: se redondea Y se descuenta. Cada arco se acorta δ por cada
 * extremo redondeado, y la punta vuelve a caer justo donde toca. δ es el ángulo
 * que ocupa medio trazo sobre este radio.
 */
const DELTA = ((SW / 2) / R) * (180 / Math.PI)

/** El recorrido completo, acortado para que sus remates caigan en los bordes. */
const ARCO = camino(INICIO + DELTA, BARRIDO - DELTA * 2)

/** El exceso: empieza EN el techo, no medio trazo antes. */
const ARCO_EXCESO = camino(
  INICIO + BARRIDO * FRACCION_TECHO + DELTA,
  BARRIDO * (1 - FRACCION_TECHO) - DELTA * 2,
)

/** Y su longitud, que ya no es la del recorrido entero. */
const LARGO_PINTADO = ((BARRIDO - DELTA * 2) / 360) * 2 * Math.PI * R

/** Donde nace el arco, para el punto de arranque. */
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
 * Las marcas miden EXACTAMENTE el grosor del trazo.
 *
 * Iban de R-9 a R+9 sobre un trazo de 13, así que asomaban por los dos lados
 * como palitos clavados. Y esa punta mentía: el límite parecía empezar antes de
 * donde empieza. Cruzando el trazo justo de borde a borde, la marca lo corta en
 * el punto exacto y no hay nada que interpretar.
 */
const MEDIA_MARCA = SW / 2

/**
 * 440 ms, no 1.100.
 *
 * Apuntar una comida y esperar a que el arco termine de crecer convierte un
 * gesto de un segundo en una espera. Poco más de cuatro décimas se leen como
 * movimiento; a partir de ahí se sienten como lentitud.
 */
const DURACION = 440
const CURVA = Easing.bezier(0.34, 1.12, 0.4, 1)

interface Props {
  /** Consumido hoy. */
  consumed: number
  limites: Limites
  size?: number
}

export function PlateRing({ consumed, limites, size = 268 }: Props) {
  const tramo: Tramo = tramoDe(consumed, limites)
  const color = COLOR_TRAMO[tramo]
  const objetivo = fraccion(consumed, limites)
  const fin = finDeEscala(limites)

  const avance = useSharedValue(0)
  useEffect(() => {
    avance.value = withTiming(fraccionDeTrazo(objetivo), { duration: DURACION, easing: CURVA })
  }, [objetivo, avance])

  const props = useAnimatedProps(() => ({
    strokeDashoffset: LARGO_PINTADO * (1 - avance.value),
  }))

  /** Las tres marcas, cada una con su nombre al lado. */
  const marcas: { f: number; texto: string; op: number; grosor: number; tope?: boolean }[] = [
    { f: limites.minimo / fin, texto: 'mín',  op: 0.5,  grosor: 2 },
    { f: limites.meta   / fin, texto: 'meta', op: 0.5,  grosor: 2 },
    { f: limites.techo  / fin, texto: 'techo', op: 0.85, grosor: 3, tope: true },
  ]


  return (
    <View style={[s.marco, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
        <Path d={ARCO} fill="none" stroke="rgba(255,255,255,0.09)"
              strokeWidth={SW} strokeLinecap="round" />

        <Path d={ARCO_EXCESO} fill="none" stroke="rgba(255,59,71,0.30)"
              strokeWidth={SW} strokeLinecap="round" />

        {/*
          EL PUNTO DE ARRANQUE.

          Una punta redonda mide 9,4° de ancho: eso es lo mínimo que el SVG puede
          dibujar de este arco. Por debajo de ahí no pinta nada — o sea que los
          primeros 99 kcal del día dejaban el anillo quieto, y apuntar un café
          parecía no registrarse.

          El punto lo resuelve: en cuanto hay algo apuntado, el arco nace. Cuando
          crece, queda debajo y no se nota.
        */}
        {consumed > 0 && (
          <Circle cx={ARRANQUE.x} cy={ARRANQUE.y} r={SW / 2} fill={color} />
        )}
        <AnimatedPath
          d={ARCO} fill="none" stroke={color}
          strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={LARGO_PINTADO} animatedProps={props}
        />

        {marcas.map(m => {
          const ang = INICIO + BARRIDO * m.f
          const a = polar(ang, R - MEDIA_MARCA)
          const b = polar(ang, R + MEDIA_MARCA)
          const t = polar(ang, R + 15)
          const izquierda = t.x < C - 2
          return (
            <React.Fragment key={m.texto}>
              <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={`rgba(255,255,255,${m.op})`} strokeWidth={m.grosor} strokeLinecap="butt" />
              <SvgText
                x={t.x} y={t.y + 3.5}
                textAnchor={izquierda ? 'end' : 'start'}
                fill={m.tope ? 'rgba(255,90,100,0.92)' : 'rgba(255,255,255,0.5)'}
                fontSize={10} fontWeight="700"
              >
                {m.texto}
              </SvgText>
            </React.Fragment>
          )
        })}

      </Svg>
    </View>
  )
}

const s = StyleSheet.create({
  marco: { alignItems: 'center', justifyContent: 'center' },
})
