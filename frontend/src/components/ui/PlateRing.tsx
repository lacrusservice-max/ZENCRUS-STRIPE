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

// Geometría del arco, en unidades del viewBox. El lienzo es más ancho que el
// arco porque las etiquetas viven fuera de él y necesitan sitio.
const VB = 232
const C = 116
const R = 88
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
const ARCO = camino(INICIO, BARRIDO)
const ARCO_EXCESO = camino(INICIO + BARRIDO * FRACCION_TECHO, BARRIDO * (1 - FRACCION_TECHO))

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
    avance.value = withTiming(objetivo, { duration: DURACION, easing: CURVA })
  }, [objetivo, avance])

  const props = useAnimatedProps(() => ({
    strokeDashoffset: LARGO * (1 - avance.value),
  }))

  /** Las tres marcas, cada una con su nombre al lado. */
  const marcas: { f: number; texto: string; op: number; grosor: number; tope?: boolean }[] = [
    { f: limites.minimo / fin, texto: 'mín',  op: 0.5,  grosor: 2 },
    { f: limites.meta   / fin, texto: 'meta', op: 0.5,  grosor: 2 },
    { f: limites.techo  / fin, texto: 'techo', op: 0.85, grosor: 3, tope: true },
  ]

  const punta = polar(INICIO + BARRIDO * objetivo)

  return (
    <View style={[s.marco, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
        <Path d={ARCO} fill="none" stroke="rgba(255,255,255,0.09)"
              strokeWidth={SW} strokeLinecap="round" />
        <Path d={ARCO_EXCESO} fill="none" stroke="rgba(255,59,71,0.30)"
              strokeWidth={SW} strokeLinecap="round" />

        <AnimatedPath
          d={ARCO} fill="none" stroke={color}
          strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={LARGO} animatedProps={props}
        />

        {marcas.map(m => {
          const ang = INICIO + BARRIDO * m.f
          const a = polar(ang, R - 9)
          const b = polar(ang, R + 9)
          const t = polar(ang, R + 22)
          const izquierda = t.x < C - 2
          return (
            <React.Fragment key={m.texto}>
              <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={`rgba(255,255,255,${m.op})`} strokeWidth={m.grosor} strokeLinecap="round" />
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

        {consumed > 0 && (
          <Circle cx={punta.x} cy={punta.y} r={4.5} fill={color} />
        )}
      </Svg>
    </View>
  )
}

const s = StyleSheet.create({
  marco: { alignItems: 'center', justifyContent: 'center' },
})
