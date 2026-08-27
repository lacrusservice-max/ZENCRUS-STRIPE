/**
 * CICLO · EL ANILLO DE FASES
 * ═══════════════════════════════════════════════════════════════════════════
 * Los cuatro arcos del mockup, el marcador de hoy y la cifra del día en medio.
 *
 * ── Los arcos NO son cuatro cuartos ────────────────────────────────────────
 * Es la tentación obvia —90° cada uno, queda simétrico— y es falso. En un
 * ciclo de 30 días la lútea ocupa catorce y la ovulatoria tres: dibujarlas
 * iguales le enseña a la usuaria una anatomía que no es la suya. Cada arco
 * mide lo que mide su fase en SU ciclo, sacado de `marco.limites`, así que un
 * ciclo largo se ve distinto de uno corto — que es justo la información.
 *
 * ── Por qué empieza arriba y gira a la derecha ─────────────────────────────
 * Porque es como se lee un reloj, y el ciclo es tiempo. El día 1 arriba, y el
 * marcador de hoy avanza como una aguja.
 *
 * ── El círculo punteado de dentro ──────────────────────────────────────────
 * Está en el mockup y no es adorno: separa el aro de la cifra para que «Día 3»
 * no parezca flotar sobre los colores. Se dibuja con `strokeDasharray`, no con
 * treinta puntos sueltos.
 */

import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle, Path, G } from 'react-native-svg'
import { FASE } from '@/theme/salud/cicloClaro'
import { TEXTO, FUENTE, TABULAR } from '@/theme/salud/cicloClaro'
import { PHASE_ORDER, type Phase } from '@/features/salud/ciclo/fases'
import type { MarcoFases } from '@/features/salud/ciclo/prediccion'

const TAM = 250
const GROSOR = 19
const R = (TAM - GROSOR) / 2
const CX = TAM / 2
const CY = TAM / 2

/** Un hueco pequeño entre arcos para que se distingan sin parecer rotos. */
const HUECO_GRADOS = 2.4

const rad = (g: number) => ((g - 90) * Math.PI) / 180
const punto = (g: number, r = R) => ({
  x: CX + r * Math.cos(rad(g)),
  y: CY + r * Math.sin(rad(g)),
})

/** Un arco de circunferencia entre dos ángulos, en grados desde arriba. */
function arco(desde: number, hasta: number): string {
  const a = punto(desde)
  const b = punto(hasta)
  const largo = hasta - desde > 180 ? 1 : 0
  return `M ${a.x} ${a.y} A ${R} ${R} 0 ${largo} 1 ${b.x} ${b.y}`
}

export function AnilloFases({ marco, diaDeCiclo, fase, subtitulo }: {
  marco: MarcoFases
  /** 1..duración. Si es null no se dibuja el marcador: no sabemos dónde está. */
  diaDeCiclo: number | null
  fase: Phase
  subtitulo: string
}) {
  const total = Math.max(1, marco.duracion)
  const grados = (dia: number) => ((dia - 1) / total) * 360

  /* Cada fase va de su límite al límite de la siguiente. La última cierra
     contra el final del ciclo, no contra el límite de menstrual —que es 1— o
     el arco saldría del revés. */
  const tramos = PHASE_ORDER.map((f, i) => {
    const sig = PHASE_ORDER[(i + 1) % PHASE_ORDER.length]
    const ini = marco.limites[f]
    const fin = i === PHASE_ORDER.length - 1 ? total + 1 : marco.limites[sig]
    return { fase: f, desde: grados(ini), hasta: grados(fin) }
  }).filter(t => t.hasta > t.desde)

  const anguloHoy = diaDeCiclo === null ? null : grados(diaDeCiclo)
  const pos = anguloHoy === null ? null : punto(anguloHoy, R)

  return (
    <View style={s.caja}>
      <Svg width={TAM} height={TAM}>
        <G>
          {/* El punteado va DEBAJO de los arcos: si se pintara encima, el
              marcador de hoy quedaría partido por una línea de puntos. */}
          <Circle
            cx={CX} cy={CY} r={R - GROSOR / 2 - 9}
            stroke={FASE.ovulatoria.arco} strokeOpacity={0.45}
            strokeWidth={2} strokeDasharray="2 7" strokeLinecap="round"
            fill="none"
          />
          {tramos.map(t => (
            <Path
              key={t.fase}
              d={arco(t.desde + HUECO_GRADOS / 2, t.hasta - HUECO_GRADOS / 2)}
              stroke={FASE[t.fase].arco}
              strokeWidth={GROSOR}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </G>
      </Svg>

      {/* La cifra del día, centrada sobre el hueco del anillo. */}
      <View style={s.centro} pointerEvents="none">
        <Text style={s.dia} numberOfLines={1}>
          {diaDeCiclo === null ? '—' : `Día ${diaDeCiclo}`}
        </Text>
        <Text style={s.subtitulo}>{subtitulo}</Text>
      </View>

      {/* El marcador de hoy y la píldora de fase, colgados del ángulo. */}
      {pos ? (
        <>
          <View
            style={[s.pildora, {
              left: pos.x, top: pos.y,
              backgroundColor: FASE[fase].arco,
            }]}
            pointerEvents="none"
          >
            <Text style={s.pildoraTxt}>{FASE[fase].etiqueta}</Text>
          </View>
          <View style={[s.hoy, { left: pos.x, top: pos.y }]} pointerEvents="none">
            <Text style={s.hoyTxt}>Hoy</Text>
          </View>
        </>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  caja: { width: TAM, height: TAM, alignSelf: 'center' },

  centro: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 46,
  },
  dia: {
    fontFamily: FUENTE.titulo, fontSize: 40, color: TEXTO.fuerte,
    letterSpacing: -1.4, ...TABULAR,
  },
  subtitulo: {
    fontFamily: FUENTE.medio, fontSize: 13.5, color: TEXTO.medio,
    textAlign: 'center', lineHeight: 19, marginTop: 2,
  },

  /* Se anclan al punto del arco y se recentran con `translate`, que es lo que
     permite colgarlos de un ángulo sin recalcular su ancho. */
  pildora: {
    position: 'absolute',
    paddingHorizontal: 13, height: 30, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ translateX: -46 }, { translateY: -15 }],
    minWidth: 92,
  },
  pildoraTxt: {
    fontFamily: FUENTE.fuerte, fontSize: 13, color: '#FFFFFF',
  },
  hoy: {
    position: 'absolute',
    transform: [{ translateX: -16 }, { translateY: -46 }],
  },
  hoyTxt: {
    fontFamily: FUENTE.fuerte, fontSize: 13.5, color: TEXTO.medio,
  },
})
