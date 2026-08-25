/**
 * FILO · LA NUMERACIÓN DE RUNNING
 * ═══════════════════════════════
 * Los números de esta sección NO son una fuente: se trazan.
 *
 * ── Por qué ────────────────────────────────────────────────────────────────
 * Toda la app usa Rajdhani e Inter, que están bien para leer. Pero un dato
 * medido —un ritmo, una distancia— no se lee: se mira medio segundo mientras
 * corres. Con la tipografía del sistema, ese número parece exactamente lo que
 * es: la fuente que trae el teléfono. Por muy bien compuesto que esté.
 *
 * Aquí cada dígito es un ESQUELETO —su línea central, definida a mano— y el
 * grosor se calcula tramo a tramo según el ángulo: cuanto más vertical, más
 * gordo; cuanto más horizontal, más fino hasta el pelo. Es la lógica de una
 * didona, y el eje de contraste es horizontal.
 *
 * ── La regla, que es una sola ──────────────────────────────────────────────
 *     vertical = |dy| / largo          → 1 en vertical, 0 en horizontal
 *     grosor   = PELO + (ASTA − PELO) × vertical^0.72
 *
 * El exponente 0,72 no es decorativo: sin él los tramos a 45° se quedan
 * demasiado finos y las curvas de 0, 3, 6 y 8 se parten por la mitad.
 *
 * ── Y el grosor es CONSTANTE ───────────────────────────────────────────────
 * ASTA y PELO están en unidades del ojo (160 de alto), no en píxeles. Lo que
 * escala es el ojo entero, como en cualquier tipografía. Al principio los puse
 * distintos en cada sitio, tratando el peso como un ajuste suelto, y a cuerpo
 * grande los dígitos se comían unos a otros.
 */

import { memo, useMemo } from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import Svg, { Line } from 'react-native-svg'

/** Alto del ojo. Todas las coordenadas de los glifos viven en 100 × 160. */
const OJO = 160
const ASTA = 20
const PELO = 3
/** Aire entre glifos: el asta se sale del cuadratín por los dos lados. */
const TRACKING = 16

type Punto = readonly [number, number]

/** Muestrea una elipse. Casi todas las curvas de los dígitos salen de aquí. */
function elipse(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 52): Punto[] {
  const p: Punto[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
  }
  return p
}

const CIRCULO = { a0: -Math.PI / 2, a1: Math.PI * 1.5 }

/** Los esqueletos. Cada glifo es una lista de trazos, y cada trazo una polilínea. */
const GLIFOS: Record<string, Punto[][]> = {
  '0': [elipse(50, 80, 40, 70, CIRCULO.a0, CIRCULO.a1)],
  '1': [[[14, 42], [52, 6]], [[52, 6], [52, 154]]],
  '2': [[...elipse(48, 50, 40, 42, Math.PI * 0.96, Math.PI * 2.1), [8, 152]], [[8, 152], [94, 152]]],
  '3': [elipse(50, 46, 36, 38, Math.PI * 0.96, Math.PI * 1.62), elipse(50, 110, 40, 44, Math.PI * 1.44, Math.PI * 2.96)],
  '4': [[[72, 6], [6, 108], [96, 108]], [[72, 6], [72, 154]]],
  '5': [[[90, 8], [26, 8], [21, 62]], elipse(50, 104, 40, 48, Math.PI * 1.3, Math.PI * 3.02)],
  '6': [elipse(50, 102, 40, 50, CIRCULO.a0, CIRCULO.a1), [[84, 16], [36, 56]]],
  '7': [[[6, 10], [94, 10]], [[94, 10], [32, 154]]],
  '8': [elipse(50, 42, 33, 36, CIRCULO.a0, CIRCULO.a1), elipse(50, 112, 40, 44, CIRCULO.a0, CIRCULO.a1)],
  '9': [elipse(50, 58, 40, 50, CIRCULO.a0, CIRCULO.a1), [[16, 144], [64, 104]]],
  '.': [elipse(16, 146, 9, 9, CIRCULO.a0, CIRCULO.a1, 16)],
  ':': [elipse(16, 52, 8, 8, CIRCULO.a0, CIRCULO.a1, 16), elipse(16, 124, 8, 8, CIRCULO.a0, CIRCULO.a1, 16)],
  '%': [
    elipse(26, 32, 20, 22, CIRCULO.a0, CIRCULO.a1, 26),
    elipse(76, 128, 20, 22, CIRCULO.a0, CIRCULO.a1, 26),
    [[92, 14], [10, 148]],
  ],
  '/': [[[86, 6], [16, 156]]],
  '-': [[[16, 80], [84, 80]]],
  ' ': [],
}

/** Anchos de avance. El 1 y la puntuación ocupan menos que un dígito normal. */
const ANCHOS: Record<string, number> = { '1': 66, '.': 34, ':': 34, '%': 104, '/': 100, '-': 100, ' ': 40 }
const anchoDe = (c: string): number => ANCHOS[c] ?? 100

interface Tramo {
  x1: number; y1: number; x2: number; y2: number; w: number
}

/** Convierte una cadena en tramos ya posicionados, con su grosor calculado. */
function tramosDe(texto: string): { tramos: Tramo[]; ancho: number } {
  const tramos: Tramo[] = []
  let cursor = 0
  for (const ch of texto) {
    const glifo = GLIFOS[ch]
    if (glifo) {
      for (const trazo of glifo) {
        for (let i = 1; i < trazo.length; i++) {
          const [x0, y0] = trazo[i - 1]
          const [x1, y1] = trazo[i]
          const dx = x1 - x0
          const dy = y1 - y0
          const largo = Math.hypot(dx, dy) || 1
          const vertical = Math.pow(Math.abs(dy) / largo, 0.72)
          tramos.push({
            x1: x0 + cursor, y1: y0, x2: x1 + cursor, y2: y1,
            w: PELO + (ASTA - PELO) * vertical,
          })
        }
      }
    }
    cursor += anchoDe(ch) + TRACKING
  }
  return { tramos, ancho: Math.max(0, cursor - TRACKING) }
}

export interface FiloProps {
  /** Solo dígitos y `.`, `:`, `%`, `/`, `-`. Cualquier otra cosa se ignora. */
  children: string
  /** Alto del ojo en píxeles. */
  alto: number
  color?: string
  style?: ViewStyle
}

/**
 * Una cifra trazada.
 *
 * Se memoiza porque el cálculo de tramos recorre cientos de puntos y la
 * pantalla de grabación repinta el ritmo cada fotograma: sin memo, cada
 * segundo se recalculaban los mismos diez glifos sesenta veces.
 */
export const Filo = memo(function Filo({ children, alto, color = '#EDF1F6', style }: FiloProps) {
  const { tramos, ancho } = useMemo(() => tramosDe(children), [children])
  const escala = alto / OJO
  const anchoPx = ancho * escala

  return (
    <View style={[{ width: anchoPx, height: alto }, style]}>
      <Svg width={anchoPx} height={alto} viewBox={`0 0 ${ancho} ${OJO}`}>
        {tramos.map((t, i) => (
          <Line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={color}
            strokeWidth={t.w}
            strokeLinecap="round"
          />
        ))}
      </Svg>
    </View>
  )
})

/**
 * Cifra con unidad al lado, que es como aparece casi siempre.
 *
 * La unidad va en monoespaciada, muy espaciada, gris y pequeña: nunca compite
 * con el número. Si la unidad pesa lo mismo que la cifra, deja de haber
 * jerarquía y vuelve a parecer una plantilla.
 */
export function FiloConUnidad({ valor, unidad, alto, color, style }: {
  valor: string
  unidad?: string
  alto: number
  color?: string
  style?: ViewStyle
}) {
  return (
    <View style={[s.fila, style]}>
      <Filo alto={alto} color={color}>{valor}</Filo>
      {unidad ? (
        <View style={s.unidadCaja}>
          <Text style={[s.unidad, { fontSize: Math.max(9, alto * 0.19) }]} numberOfLines={1}>
            {unidad}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start' },
  unidadCaja: { justifyContent: 'flex-start', paddingLeft: 6, paddingTop: 2 },
  unidad: {
    fontFamily: 'Inter_500Medium',
    letterSpacing: 2,
    color: 'rgba(237,241,246,0.30)',
  },
})
