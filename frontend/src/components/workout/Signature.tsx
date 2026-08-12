/**
 * FIRMA DE LA SESIÓN
 * ──────────────────
 * Cada entrenamiento genera una imagen que no se parece a ninguna otra, porque
 * se dibuja CON SUS DATOS: un rayo por serie, largo según lo que se movió,
 * ángulo según el orden y color según el músculo.
 *
 * ── Es un retrato, no un adorno ─────────────────────────────────────────────
 * Un día de pierna sale como una estrella corta y densa de morados; un día de
 * empuje, como un abanico rojo y ancho. Dos sesiones distintas no pueden dar la
 * misma figura, y la misma sesión da siempre la misma: el azar está sembrado
 * con el identificador de la sesión, así que la firma es estable y se puede
 * volver a ella dentro de un año y encontrarla igual.
 *
 * ── Por qué esto y no una foto de archivo ───────────────────────────────────
 * Una foto de un gimnasio es de otro y no dice nada de lo que hiciste tú. Esto
 * solo existe porque entrenaste, y solo así.
 *
 * ── Sin lienzo: SVG ─────────────────────────────────────────────────────────
 * Es lo que hay en Expo Go —Skia no está—, y para un centenar de trazos
 * vectoriales sobra. Además queda nítido a cualquier tamaño, que es lo que hace
 * falta si algún día se comparte en la comunidad.
 */

import { useMemo } from 'react'
import { View } from 'react-native'
import Svg, { Path, Circle, G, Defs, RadialGradient, Stop, Line } from 'react-native-svg'
import { COLOR_GRUPO } from '@/services/exerciseService'
import { Colors } from '@/constants/theme'

export interface SerieFirma {
  muscle: string | null
  kind: string
  load_type: string
  weight_kg: number | null
  reps: number | null
  duration_seconds: number | null
  rir: number | null
  order_index: number
}

/**
 * Azar sembrado.
 *
 * `Math.random()` daría una figura distinta en cada render y la firma dejaría
 * de ser la firma de nada. Con la semilla sacada del identificador de la
 * sesión, el mismo entrenamiento se dibuja igual hoy, en otro teléfono y dentro
 * de dos años.
 */
function sembrar(semilla: string) {
  let h = 2166136261
  for (let i = 0; i < semilla.length; i++) {
    h ^= semilla.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5
    return ((h >>> 0) % 100000) / 100000
  }
}

interface Props {
  sessionId: string
  series: SerieFirma[]
  tam?: number
}

export function Signature({ sessionId, series, tam = 260 }: Props) {
  const trazos = useMemo(() => {
    const azar = sembrar(sessionId)
    const centro = 100
    const rMin = 22
    const rMax = 92

    // La intensidad de cada serie, normalizada CONTRA LA PROPIA SESIÓN. Se
    // compara consigo misma y no con un máximo absoluto: si no, una sesión
    // suave de peso corporal saldría como un punto y no como el dibujo de lo
    // que fue ese día.
    const intensidad = (s: SerieFirma): number => {
      if (s.load_type === 'weight' && s.weight_kg && s.reps) return s.weight_kg * s.reps
      if (s.reps) return s.reps * 8
      if (s.duration_seconds) return s.duration_seconds * 2
      return 10
    }

    const valores = series.map(intensidad)
    const max = Math.max(...valores, 1)

    return series.map((s, i) => {
      // Los ángulos se reparten por toda la vuelta y se desordenan un poco con
      // el azar sembrado: en rejilla perfecta parece un gráfico, y con
      // desorden total parece ruido. La mezcla es lo que lo hace orgánico.
      const base = (i / Math.max(series.length, 1)) * Math.PI * 2
      const angulo = base - Math.PI / 2 + (azar() - 0.5) * 0.22

      const t = valores[i] / max
      const largo = rMin + t * (rMax - rMin)

      // El calentamiento se dibuja corto y tenue: estuvo, pero no fue el
      // trabajo del día.
      const esCalent = s.kind === 'warmup'
      const opacidad = esCalent ? 0.22
        : s.rir === 0 ? 0.95              // al fallo: lo más marcado
        : s.rir != null ? 0.5 + (5 - Math.min(s.rir, 5)) * 0.09
        : 0.7

      const x1 = centro + Math.cos(angulo) * rMin
      const y1 = centro + Math.sin(angulo) * rMin
      const x2 = centro + Math.cos(angulo) * (esCalent ? rMin + 10 : largo)
      const y2 = centro + Math.sin(angulo) * (esCalent ? rMin + 10 : largo)

      return {
        x1, y1, x2, y2, opacidad,
        color: COLOR_GRUPO[s.muscle ?? ''] ?? Colors.neon.steelSoft,
        grosor: esCalent ? 1.2 : 1.6 + t * 2.6,
        // El remate en la punta solo en las series fuertes: marca dónde estuvo
        // el esfuerzo de verdad sin llenar el dibujo de puntos.
        remate: !esCalent && t > 0.55,
      }
    })
  }, [sessionId, series])

  /**
   * El anillo exterior, partido por ejercicio.
   *
   * Cuenta cuántos huecos tuvo la sesión sin necesidad de contar rayos: seis
   * arcos son seis ejercicios.
   */
  const arcos = useMemo(() => {
    const huecos = [...new Set(series.map(s => s.order_index))].sort((a, b) => a - b)
    const n = huecos.length || 1
    return huecos.map((h, i) => {
      const desde = (i / n) * 360 - 90 + 1.5
      const hasta = ((i + 1) / n) * 360 - 90 - 1.5
      const r = 97
      const p = (g: number) => [
        100 + Math.cos((g * Math.PI) / 180) * r,
        100 + Math.sin((g * Math.PI) / 180) * r,
      ]
      const [x1, y1] = p(desde)
      const [x2, y2] = p(hasta)
      const largo = hasta - desde > 180 ? 1 : 0
      const musculo = series.find(s => s.order_index === h)?.muscle
      return {
        d: `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${largo} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`,
        color: COLOR_GRUPO[musculo ?? ''] ?? Colors.neon.steel,
      }
    })
  }, [series])

  if (series.length === 0) return null

  return (
    <View style={{ width: tam, height: tam }}>
      <Svg width={tam} height={tam} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="nucleo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16" />
            <Stop offset="70%" stopColor="#FF1F3D" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#FF1F3D" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Circle cx={100} cy={100} r={96} fill="url(#nucleo)" />

        {/* Los rayos: uno por serie. */}
        <G>
          {trazos.map((t, i) => (
            <Line
              key={`r-${i}`}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.color} strokeWidth={t.grosor}
              strokeOpacity={t.opacidad} strokeLinecap="round"
            />
          ))}
        </G>

        {/* Los remates de las series fuertes. */}
        <G>
          {trazos.filter(t => t.remate).map((t, i) => (
            <Circle key={`p-${i}`} cx={t.x2} cy={t.y2} r={2} fill={t.color} fillOpacity={t.opacidad} />
          ))}
        </G>

        {/* El anillo por ejercicio. */}
        <G>
          {arcos.map((a, i) => (
            <Path key={`a-${i}`} d={a.d} fill="none" stroke={a.color}
              strokeWidth={2.4} strokeOpacity={0.55} strokeLinecap="round" />
          ))}
        </G>

        {/* El núcleo: el centro del que sale todo. */}
        <Circle cx={100} cy={100} r={18} fill="rgba(255,255,255,0.05)"
          stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
        <Circle cx={100} cy={100} r={3.4} fill={Colors.neon.red} />
      </Svg>
    </View>
  )
}
