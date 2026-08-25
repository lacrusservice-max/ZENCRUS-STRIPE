/**
 * LA CINTA
 * ═══════════════════════════════════════════════════════════════════════════
 * La pantalla principal del ciclo. El elemento que la usuaria ve todos los días.
 *
 * ── Por qué NO es un anillo ────────────────────────────────────────────────
 * Flo, Clue, Apple Fitness, Oura y Whoop usan un anillo. Es el default absoluto
 * de la categoría, y además comunica «ciclo cerrado y perfecto», que es justo
 * lo que un ciclo real no es.
 *
 * La Cinta es una escala horizontal de precisión —un dial de instrumento— que
 * se lee de izquierda a derecha, porque un ciclo se VIVE hacia adelante, no en
 * círculo.
 *
 * ── La banda de confianza es el argumento del módulo ───────────────────────
 * Su anchura es literalmente el intervalo estadístico de la predicción.
 * Estrecha = el sistema está seguro. Ancha = no lo está. La usuaria VE la
 * certeza en vez de leer un porcentaje, y ninguna app de la categoría lo hace:
 * todas dan una fecha exacta que finge una precisión que no existe.
 *
 * ── Rendimiento ────────────────────────────────────────────────────────────
 * Todo se dibuja en Skia y la respiración vive en un `useSharedValue` sobre el
 * UI thread. Nada de esto pasa por JS en cada frame.
 */

import { useCallback, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import {
  Canvas, Group, RoundedRect, Circle, Blur, LinearGradient, vec,
} from '@shopify/react-native-skia'
import {
  useSharedValue, withRepeat, withTiming, cancelAnimation,
  useDerivedValue, Easing,
} from 'react-native-reanimated'
import {
  base, PHASE_ORDER, mixPhases, nextPhase, type Phase,
} from '@/theme/salud/tokens'

const ALTO = 132
const MARGEN = 20

export interface CintaProps {
  /** Día actual dentro del ciclo, empezando en 1. */
  diaDeCiclo: number
  /** Duración estimada del ciclo. */
  duracion: number
  /** Fase de hoy. */
  fase: Phase
  /** Día en que empieza cada fase, para colocar las marcas altas. */
  limites: Record<Phase, number>
  /**
   * Intervalo del próximo periodo, en días de ciclo.
   * La distancia entre `low` y `high` ES la anchura de la banda.
   */
  prediccion: { low: number; likely: number; high: number } | null
  /** Si el sistema respeta reduce-motion, la respiración se apaga. */
  reduceMotion?: boolean
}

export function Cinta({
  diaDeCiclo, duracion, fase, limites, prediccion, reduceMotion,
}: CintaProps) {
  const { width } = useWindowDimensions()
  const ancho = width - MARGEN * 2

  /**
   * El tema de hoy, interpolado con el de la fase siguiente.
   *
   * Un ciclo no salta de fase a fase, así que el color tampoco: el progreso
   * dentro de la fase mezcla ambos temas día a día.
   */
  const tema = useMemo(() => {
    const inicio = limites[fase]
    const sig = nextPhase(fase)
    const finFase = limites[sig] > inicio ? limites[sig] : duracion + limites[PHASE_ORDER[0]]
    const t = Math.max(0, Math.min(1, (diaDeCiclo - inicio) / Math.max(1, finFase - inicio)))
    return mixPhases(fase, sig, t)
  }, [fase, limites, diaDeCiclo, duracion])

  /** Respiración del cursor: 0.05 Hz, el ritmo de una respiración en reposo. */
  const latido = useSharedValue(0)
  useEffect(() => {
    if (reduceMotion) { latido.value = 0.5; return }
    latido.value = withRepeat(
      withTiming(1, { duration: 20000 / 5, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    )
    return () => cancelAnimation(latido)
  }, [reduceMotion, latido])

  const radioHalo = useDerivedValue(() => 16 + latido.value * 9, [latido])
  const opacidadHalo = useDerivedValue(() => 0.45 + latido.value * 0.4, [latido])

  /* Memoizada porque las marcas dependen de ella: sin memo, `x` es una función
     nueva en cada render y el memo de las marcas no memoiza nada. */
  const x = useCallback(
    (dia: number) => ((dia - 1) / Math.max(1, duracion - 1)) * ancho,
    [duracion, ancho],
  )
  const cursorX = x(diaDeCiclo)
  const yBase = 74

  /** Las marcas de cambio de fase son más altas: la escala tiene relieve. */
  const marcas = useMemo(() => {
    const cambios = new Set(Object.values(limites))
    return Array.from({ length: duracion }, (_, i) => {
      const dia = i + 1
      const esCambio = cambios.has(dia)
      return { dia, x: x(dia), alto: esCambio ? 26 : dia % 7 === 0 ? 17 : 11, esCambio }
    })
  }, [duracion, limites, x])

  const banda = prediccion
    ? { x: x(prediccion.low), w: Math.max(10, x(prediccion.high) - x(prediccion.low)) }
    : null

  return (
    <View style={s.wrap}>
      <Canvas style={{ width: ancho, height: ALTO }}>
        {/* Banda de confianza. Va detrás de todo y difuminada a propósito: es
            una zona probable, no una fecha, y no debe leerse como un borde. */}
        {banda && (
          <Group>
            <RoundedRect
              x={banda.x} y={yBase - 20} width={banda.w} height={40} r={12}
              color={tema.accent} opacity={0.22}
            >
              <Blur blur={9} />
            </RoundedRect>
          </Group>
        )}

        {/* La escala. */}
        <Group>
          {marcas.map(m => (
            <RoundedRect
              key={m.dia}
              x={m.x} y={yBase - m.alto / 2}
              width={m.esCambio ? 2.4 : 1.6} height={m.alto} r={1.2}
              color={m.dia <= diaDeCiclo ? tema.accent : base.hairline}
              opacity={m.dia <= diaDeCiclo ? 0.9 : 0.55}
            />
          ))}
        </Group>

        {/* Línea de recorrido: lo vivido tiene color, lo que falta no. */}
        <RoundedRect x={0} y={yBase - 1} width={cursorX} height={2} r={1}>
          <LinearGradient
            start={vec(0, 0)} end={vec(cursorX, 0)}
            colors={[`${tema.accent}22`, tema.accent]}
          />
        </RoundedRect>

        {/* Cursor de hoy: el único elemento con brillo pleno de la pantalla. */}
        <Group>
          <Circle cx={cursorX} cy={yBase} r={radioHalo} color={tema.accent} opacity={opacidadHalo}>
            <Blur blur={12} />
          </Circle>
          <Circle cx={cursorX} cy={yBase} r={6} color="#FFFFFF" />
        </Group>
      </Canvas>

      {/* El color nunca viaja solo: la fase lleva SIEMPRE su nombre. */}
      <View style={s.textos}>
        <Text style={[s.eyebrow, { color: tema.accent }]}>
          FASE {tema.label.toUpperCase()} · DÍA {diaDeCiclo}
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: MARGEN },
  textos: { marginTop: 4 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 2.4 },
})
