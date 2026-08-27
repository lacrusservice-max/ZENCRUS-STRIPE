/**
 * CICLO · LA RUEDA
 * ═══════════════════════════════════════════════════════════════════════════
 * 360° = un ciclo. Cuatro arcos, una burbuja que se arrastra y la cifra del día
 * en medio.
 *
 * ── Los arcos NO son cuatro cuartos ────────────────────────────────────────
 * Cada uno mide lo que mide su fase en SU ciclo. En un ciclo de 30 la lútea
 * ocupa catorce días y la ovulatoria uno solo; dibujarlas iguales le enseñaría
 * a la usuaria una anatomía que no es la suya.
 *
 * ── La ovulatoria dura un día, así que se dibuja la VENTANA ────────────────
 * Un arco de 1/28 del círculo son doce grados: invisible. El anillo pinta la
 * ventana fértil —seis días— en violeta y reserva el halo para el día pico.
 * Es lo que dice el prompt maestro, y no es una licencia: la fase ovulatoria y
 * la ventana fértil son cosas distintas, y el anillo enseña la que se puede ver.
 *
 * ── La burbuja se mueve mientras el dedo se mueve ──────────────────────────
 * No al soltar. Un control que solo responde al final del gesto se siente
 * roto: no hay forma de saber dónde va a caer hasta que ya cayó. El texto
 * central se actualiza en cada frame, con el día ya enganchado al entero más
 * cercano.
 *
 * ── Y el scroll se apaga mientras dura el arrastre ─────────────────────────
 * En iOS ningún `PanResponder` le gana a un `UIScrollView` que lo contiene: el
 * gesto se lo lleva el scroll y la burbuja no se mueve. La única cura es que la
 * pantalla desactive su scroll mientras dura el gesto, y por eso existe
 * `onArrastre`.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, PanResponder } from 'react-native'
import Svg, { Circle, Path, G } from 'react-native-svg'
import {
  FASE, PICO_FERTIL, ACENTO_HOY, TEXTO, FUENTE, TABULAR, SUP,
} from '@/theme/salud/cicloClaro'
import { PHASE_ORDER } from '@/features/salud/ciclo/fases'
import { faseDeDia, type MarcoFases } from '@/nucleo/ciclo/fases'
import { elegir } from '@/utils/haptica'

const TAM = 260
const GROSOR = 20
const R = (TAM - GROSOR) / 2
const CX = TAM / 2
const CY = TAM / 2

/** Un hueco pequeño entre arcos para que se distingan sin parecer rotos. */
const HUECO_GRADOS = 2.2

/** Radio de la burbuja arrastrable. */
const BURBUJA = 17

const rad = (g: number) => ((g - 90) * Math.PI) / 180
const punto = (g: number, r = R) => ({
  x: CX + r * Math.cos(rad(g)),
  y: CY + r * Math.sin(rad(g)),
})

function arco(desde: number, hasta: number, r = R): string {
  const a = punto(desde, r)
  const b = punto(hasta, r)
  const largo = hasta - desde > 180 ? 1 : 0
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${largo} 1 ${b.x} ${b.y}`
}

export function AnilloFases({
  marco, diaDeCiclo, diaSeleccionado, onDia, onArrastre, subtitulo,
}: {
  marco: MarcoFases
  /** El día real de hoy. `null` si no hay periodo del que contar. */
  diaDeCiclo: number | null
  /** El día que mira la burbuja. Puede no ser hoy. */
  diaSeleccionado: number
  onDia: (dia: number) => void
  /** Avisa a la pantalla para que apague su scroll durante el gesto. */
  onArrastre?: (moviendo: boolean) => void
  subtitulo: string
}) {
  const total = Math.max(1, marco.duracion)
  const grados = useCallback((dia: number) => ((dia - 1) / total) * 360, [total])

  /* Se guarda en una ref además del estado: el `PanResponder` se crea una vez
     y sus manejadores capturarían el primer valor para siempre. */
  const diaRef = useRef(diaSeleccionado)
  diaRef.current = diaSeleccionado
  const [arrastrando, setArrastrando] = useState(false)

  /** De coordenada dentro del anillo a día entero. */
  const diaDesdeToque = useCallback((x: number, y: number): number => {
    const dx = x - CX
    const dy = y - CY
    // `atan2` da 0 a la derecha; se rota para que 0 sea arriba.
    let g = (Math.atan2(dy, dx) * 180) / Math.PI + 90
    if (g < 0) g += 360
    const dia = Math.round((g / 360) * total) + 1
    // El día `total + 1` es el 1 del ciclo siguiente: se cierra el círculo.
    return dia > total ? 1 : dia
  }, [total])

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    /* Que el scroll no pueda robar el gesto a media caricia. */
    onPanResponderTerminationRequest: () => false,

    onPanResponderGrant: e => {
      setArrastrando(true)
      onArrastre?.(true)
      const d = diaDesdeToque(e.nativeEvent.locationX, e.nativeEvent.locationY)
      if (d !== diaRef.current) { elegir(); onDia(d) }
    },
    onPanResponderMove: e => {
      const d = diaDesdeToque(e.nativeEvent.locationX, e.nativeEvent.locationY)
      /* Solo cuando cambia de día: llamar en cada frame con el mismo valor
         dispararía un render por frame y un golpe de háptica continuo. */
      if (d !== diaRef.current) { elegir(); onDia(d) }
    },
    onPanResponderRelease: () => { setArrastrando(false); onArrastre?.(false) },
    onPanResponderTerminate: () => { setArrastrando(false); onArrastre?.(false) },
  }), [diaDesdeToque, onDia, onArrastre])

  /* Los cuatro arcos. La ovulatoria se dibuja como la VENTANA fértil, que es lo
     que se puede ver; el día pico lleva su propio realce encima. */
  const tramos = useMemo(() => {
    const [fIni, fFin] = marco.ventanaFertil
    return PHASE_ORDER.map((f, i) => {
      if (f === 'ovulatoria') {
        return { fase: f, desde: grados(fIni), hasta: grados(fFin + 1) }
      }
      const sig = PHASE_ORDER[(i + 1) % PHASE_ORDER.length]
      let ini = marco.limites[f]
      let fin = i === PHASE_ORDER.length - 1 ? total + 1 : marco.limites[sig]
      // Folicular y lútea ceden el terreno que ocupa la ventana fértil.
      if (f === 'folicular') fin = Math.min(fin, fIni)
      if (f === 'lutea') ini = Math.max(ini, fFin + 1)
      return { fase: f, desde: grados(ini), hasta: grados(fin) }
    }).filter(t => t.hasta > t.desde + HUECO_GRADOS)
  }, [marco, total, grados])

  const posBurbuja = punto(grados(diaSeleccionado), R)
  const posPico = punto(grados(marco.diaOvulacion), R)
  const faseSel = faseDeDia(Math.min(diaSeleccionado, total), marco)
  const esHoy = diaDeCiclo !== null && diaSeleccionado === diaDeCiclo

  return (
    <View style={s.caja} {...pan.panHandlers}>
      <Svg width={TAM} height={TAM} pointerEvents="none">
        <G>
          {/* El punteado interior, debajo de todo. */}
          <Circle
            cx={CX} cy={CY} r={R - GROSOR / 2 - 9}
            stroke={FASE.ovulatoria.arco} strokeOpacity={0.28}
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

          {/* El día pico: un segmento más ancho encima de la ventana. */}
          <Path
            d={arco(grados(marco.diaOvulacion) - 4, grados(marco.diaOvulacion) + 4)}
            stroke={PICO_FERTIL.arco}
            strokeWidth={GROSOR + 6}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>

      {/* El halo del día más fértil. Va fuera del SVG porque `shadow` de React
          Native da un desenfoque real y `filter` de SVG no está soportado. */}
      <View
        style={[s.halo, { left: posPico.x, top: posPico.y }]}
        pointerEvents="none"
      />

      {/* La cifra del día seleccionado. */}
      <View style={s.centro} pointerEvents="none">
        <Text style={s.dia} numberOfLines={1}>{`Día ${diaSeleccionado}`}</Text>
        <Text style={s.deTuCiclo}>de tu ciclo</Text>
        <View style={[s.chipFase, { backgroundColor: FASE[faseSel].celda }]}>
          <Text style={[s.chipFaseTxt, { color: FASE[faseSel].texto }]}>
            {FASE[faseSel].etiqueta}
          </Text>
        </View>
        {subtitulo ? <Text style={s.subtitulo}>{subtitulo}</Text> : null}
      </View>

      {/* La burbuja. */}
      <View
        style={[
          s.burbuja,
          { left: posBurbuja.x, top: posBurbuja.y },
          arrastrando && s.burbujaViva,
        ]}
        pointerEvents="none"
      >
        <Text style={s.burbujaTxt}>{diaSeleccionado}</Text>
      </View>

      {/* El marcador de hoy, si la burbuja está en otro sitio. */}
      {diaDeCiclo !== null && !esHoy ? (
        <View
          style={[s.marcaHoy, {
            left: punto(grados(diaDeCiclo), R).x,
            top: punto(grados(diaDeCiclo), R).y,
          }]}
          pointerEvents="none"
        />
      ) : null}
    </View>
  )
}

/**
 * El botón «volver a hoy».
 *
 * Vive fuera del anillo: dentro tendría que competir por el sitio con la cifra,
 * y además el anillo entero es zona de arrastre — un botón ahí dentro se
 * pulsaría sin querer al soltar la burbuja.
 */
export function VolverAHoy({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={() => { elegir(); onPress() }}
      style={({ pressed }) => [s.volver, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
    >
      <Text style={s.volverTxt}>Volver a hoy</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  caja: { width: TAM, height: TAM, alignSelf: 'center' },

  centro: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 52,
  },
  dia: {
    fontFamily: FUENTE.titulo, fontSize: 34, color: TEXTO.fuerte,
    letterSpacing: -1.1, ...TABULAR,
  },
  deTuCiclo: {
    fontFamily: FUENTE.cuerpo, fontSize: 12.5, color: TEXTO.suave, marginTop: -2,
  },
  chipFase: {
    marginTop: 7, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999,
  },
  chipFaseTxt: { fontFamily: FUENTE.fuerte, fontSize: 12 },
  subtitulo: {
    fontFamily: FUENTE.cuerpo, fontSize: 11.5, color: TEXTO.suave,
    textAlign: 'center', marginTop: 6,
  },

  halo: {
    position: 'absolute',
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#FFFFFF',
    opacity: 0.6,
    transform: [{ translateX: -15 }, { translateY: -15 }],
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.9,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
  },

  burbuja: {
    position: 'absolute',
    width: BURBUJA * 2, height: BURBUJA * 2, borderRadius: BURBUJA,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SUP.tarjeta,
    borderWidth: 2.5, borderColor: ACENTO_HOY,
    transform: [{ translateX: -BURBUJA }, { translateY: -BURBUJA }],
    shadowColor: '#2A1A44', shadowOpacity: 0.22,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  /* Al arrastrar crece un poco: confirma que el dedo la lleva, que es lo que
     hace que el control se sienta agarrado y no perseguido. */
  burbujaViva: {
    transform: [{ translateX: -BURBUJA }, { translateY: -BURBUJA }, { scale: 1.18 }],
  },
  burbujaTxt: {
    fontFamily: FUENTE.titulo, fontSize: 13, color: ACENTO_HOY, ...TABULAR,
  },

  marcaHoy: {
    position: 'absolute',
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: ACENTO_HOY,
    borderWidth: 2, borderColor: SUP.tarjeta,
    transform: [{ translateX: -4.5 }, { translateY: -4.5 }],
  },

  volver: {
    alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#ECE5FA',
  },
  volverTxt: { fontFamily: FUENTE.fuerte, fontSize: 13, color: ACENTO_HOY },
})
