/**
 * EL ANILLO DE SUEÑO
 * ═══════════════════════════════════════════════════════════════════════════
 * Un reloj de 24 horas con dos tiradores: a qué hora te acuestas y a qué hora
 * te levantas. El arco entre ellos ES lo que vas a dormir.
 *
 * ── Por qué un anillo y no dos campos de hora ──────────────────────────────
 * Porque lo que se decide aquí no son dos horas sueltas: es una VENTANA. Con
 * dos campos hay que restar mentalmente para saber cuánto duermes, y ajustar
 * «media hora antes» son cuatro toques. Arrastrando, la duración se ve mientras
 * la mueves.
 *
 * ── Se mide en minutos desde medianoche ────────────────────────────────────
 * 0 a 1440, y la vuelta entera son 360°. Que la hora de levantarse sea MENOR
 * que la de acostarse no es un error: de 23:00 a 07:00 se cruza la medianoche,
 * y por eso la duración se calcula con módulo y nunca restando a secas.
 *
 * ── El giro empieza arriba ─────────────────────────────────────────────────
 * Medianoche a las 12 en punto y las horas en el sentido del reloj, como el
 * despertador de iOS. En SVG el ángulo cero apunta a la derecha, así que cada
 * punto se calcula con `sin` para la x y `-cos` para la y en vez de al revés.
 *
 * ── Salta de cinco en cinco ────────────────────────────────────────────────
 * Al minuto exacto es imposible parar con el dedo, y una hora de dormir a las
 * 23:07 no la quiere nadie.
 */

import { useMemo, useRef, useState } from 'react'
import { View, StyleSheet, PanResponder, type GestureResponderEvent } from 'react-native'
import Svg, { Circle, Path, Line, Text as SvgText, G } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'

const ROJO = '#FF5C00'
const ROJO_HONDO = '#B33D00'

const LADO = 300
const C = LADO / 2
const R_PISTA = 122        // radio de la línea media del anillo
const GROSOR = 44
const R_ESFERA = 88        // la cara interior con las horas
const TIRADOR = 40
const PASO = 5             // minutos

const DIA = 1440

const HORAS = [
  { h: 0,  et: '12A.M.' }, { h: 2,  et: '2' },  { h: 4,  et: '4' },
  { h: 6,  et: '6A.M.' },  { h: 8,  et: '8' },  { h: 10, et: '10' },
  { h: 12, et: '12P.M.' }, { h: 14, et: '2' },  { h: 16, et: '4' },
  { h: 18, et: '6P.M.' },  { h: 20, et: '8' },  { h: 22, et: '10' },
]

/**
 * Qué se está moviendo.
 *
 *   'inicio' / 'fin'  un extremo: alarga o recorta, como en Salud de Apple
 *   'todo'            el bloque entero: la duración NO cambia, solo se corre
 */
type Modo = 'inicio' | 'fin' | 'todo' | null

/** Cuánto arco, en minutos, cuenta como «has tocado el icono». */
const CERCA_TIRADOR = 40

const rad = (grados: number) => (grados * Math.PI) / 180
const punto = (grados: number, r: number) => ({
  x: C + r * Math.sin(rad(grados)),
  y: C - r * Math.cos(rad(grados)),
})
const gradosDe = (min: number) => (min / DIA) * 360

/** La duración de la ventana, cruzando medianoche sin restar a secas. */
export function duracionMin(inicio: number, fin: number): number {
  const d = (fin - inicio + DIA) % DIA
  return d === 0 ? DIA : d
}

/**
 * La misma hora, en 12 y con AM/PM, para ENSEÑARLA.
 *
 * `comoHora` se queda en 24 porque es lo que se guarda —la columna es `time`—,
 * pero la esfera del anillo está rotulada «12 A.M.» y «12 P.M.», y poner 22:55
 * encima obliga a traducir entre lo que lees y lo que ves. Medianoche y
 * mediodía son las 12, nunca las 0.
 */
export function comoHora12(min: number): { hora: string; ampm: string } {
  const m = ((min % DIA) + DIA) % DIA
  const h = Math.floor(m / 60)
  return {
    hora: `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')}`,
    ampm: h < 12 ? 'AM' : 'PM',
  }
}

export function comoHora(min: number): string {
  const m = ((min % DIA) + DIA) % DIA
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** «8 h», «5 h 45 min», «45 min». */
export function comoDuracion(min: number): string {
  const h = Math.floor(min / 60), r = min % 60
  if (!h) return `${r} min`
  return r ? `${h} h ${r} min` : `${h} h`
}

interface Props {
  /** Minutos desde medianoche. */
  inicio: number
  fin: number
  onChange: (inicio: number, fin: number) => void
  /**
   * Avisa de que hay un dedo puesto en el anillo.
   *
   * La pantalla lo usa para APAGAR su propio scroll mientras dura: el anillo
   * vive dentro de una lista que también quiere el movimiento vertical, y sin
   * esto arrastrar el tirador hacia arriba desplaza la página en vez de mover
   * la hora.
   */
  onArrastre?: (activo: boolean) => void
}

export function AnilloSueno({ inicio, fin, onChange, onArrastre }: Props) {
  const [arrastrando, setArrastrando] = useState<Modo>(null)
  // En refs porque el PanResponder se crea una vez y sus manejadores capturarían
  // los valores de la primera pintada.
  const val = useRef({ inicio, fin })
  val.current = { inicio, fin }
  /* Cuál se está arrastrando, aparte del estado.
     El estado sirve para PINTAR; este ref para decidir. Leerlo dentro del
     actualizador de `setArrastrando` y avisar al padre desde ahí era actualizar
     un componente mientras se renderiza otro —React lo avisaba— porque el
     cuerpo de un actualizador corre en fase de render. */
  const cual = useRef<Modo>(null)
  /** Al mover el bloque entero: qué distancia había del dedo al inicio. */
  const asa = useRef(0)

  /** Dónde está el dedo: en qué minuto del anillo y a qué distancia del centro. */
  const dedo = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent
    const dx = locationX - C, dy = locationY - C
    let g = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (g < 0) g += 360
    return {
      min: Math.round((g / 360) * DIA / PASO) * PASO % DIA,
      radio: Math.hypot(dx, dy),
    }
  }

  /** ¿Va el dedo sobre la banda del anillo, y no en la esfera del centro? */
  const enLaBanda = (radio: number) =>
    radio >= R_PISTA - GROSOR / 2 - 6 && radio <= R_PISTA + GROSOR / 2 + 6

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    /* Con `Capture` el anillo reclama el gesto ANTES de que suba al scroll.
       Sin esto la lista gana en cuanto el dedo se mueve un poco en vertical
       —que es justo lo que hace falta para llevar un tirador de las 3 a las 9—
       y el arrastre se convierte en un desplazamiento de la página. */
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: e => {
      const { min: m, radio } = dedo(e)
      if (!enLaBanda(radio)) { cual.current = null; return }

      const v = val.current
      // La distancia se mide por el ARCO y no restando números: a las 23:50 y a
      // las 00:10 les separan veinte minutos, no veintitrés horas y media.
      const cerca = (a: number) => Math.min((m - a + DIA) % DIA, (a - m + DIA) % DIA)
      const dIni = cerca(v.inicio), dFin = cerca(v.fin)

      let elegido: Modo
      if (dIni <= CERCA_TIRADOR || dFin <= CERCA_TIRADOR) {
        // Un icono: alarga o recorta ese extremo.
        elegido = dIni <= dFin ? 'inicio' : 'fin'
      } else if ((m - v.inicio + DIA) % DIA < duracionMin(v.inicio, v.fin)) {
        // La barra por en medio: se corre el bloque entero sin cambiar cuánto
        // duermes. Es lo que hace Salud de Apple, y es la diferencia entre
        // «quiero dormir media hora más» y «quiero acostarme media hora antes».
        elegido = 'todo'
        asa.current = (m - v.inicio + DIA) % DIA
      } else {
        // Fuera de la ventana: se acerca el extremo más próximo.
        elegido = dIni <= dFin ? 'inicio' : 'fin'
      }

      cual.current = elegido
      setArrastrando(elegido)
      onArrastre?.(true)
    },
    onPanResponderMove: e => {
      if (!cual.current) return
      const { min: m } = dedo(e)
      const v = val.current

      if (cual.current === 'todo') {
        const dur = duracionMin(v.inicio, v.fin)
        const ini = ((m - asa.current) % DIA + DIA) % DIA
        onChange(ini, (ini + dur) % DIA)
        return
      }
      // La ventana nunca se cierra del todo: media hora es el mínimo con el que
      // el arco se sigue viendo y se puede volver a agarrar.
      if (cual.current === 'inicio' && duracionMin(m, v.fin) >= 30) onChange(m, v.fin)
      if (cual.current === 'fin' && duracionMin(v.inicio, m) >= 30) onChange(v.inicio, m)
    },
    onPanResponderRelease: () => { cual.current = null; setArrastrando(null); onArrastre?.(false) },
    onPanResponderTerminate: () => { cual.current = null; setArrastrando(null); onArrastre?.(false) },
    // Que nadie se lo quite a media faena: el scroll de la lista intentará
    // reclamarlo en cuanto el dedo suba o baje.
    onPanResponderTerminationRequest: () => false,
  }), [onChange, onArrastre])

  const gi = gradosDe(inicio), gf = gradosDe(fin)
  const delta = (gf - gi + 360) % 360
  const p1 = punto(gi, R_PISTA), p2 = punto(gf, R_PISTA)
  const arco = `M ${p1.x} ${p1.y} A ${R_PISTA} ${R_PISTA} 0 ${delta > 180 ? 1 : 0} 1 ${p2.x} ${p2.y}`

  const pos = (g: number) => {
    const p = punto(g, R_PISTA)
    return { left: p.x - TIRADOR / 2, top: p.y - TIRADOR / 2 }
  }

  return (
    <View style={s.caja}>
      <View style={s.lienzo} {...pan.panHandlers}>
        <Svg width={LADO} height={LADO}>
          {/* la pista */}
          <Circle cx={C} cy={C} r={R_PISTA} stroke="rgba(255,255,255,0.06)"
                  strokeWidth={GROSOR} fill="none" />
          {/* la ventana de sueño */}
          <Path d={arco} stroke={arrastrando ? ROJO : ROJO_HONDO} strokeWidth={GROSOR}
                strokeLinecap="round" fill="none" opacity={arrastrando ? 1 : 0.9} />

          {/* la cara: marcas cada 30 min, más largas en las horas */}
          <G>
            {Array.from({ length: 48 }, (_, i) => {
              const g = (i / 48) * 360
              const larga = i % 2 === 0
              const a = punto(g, R_ESFERA - (larga ? 9 : 5))
              const b = punto(g, R_ESFERA)
              return (
                <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke="rgba(255,255,255,0.22)" strokeWidth={larga ? 1.4 : 1} />
              )
            })}
            {HORAS.map(({ h, et }) => {
              const p = punto(gradosDe(h * 60), R_ESFERA - 24)
              return (
                <SvgText key={h} x={p.x} y={p.y + 4} fill="rgba(255,255,255,0.55)"
                         fontSize={et.length > 2 ? 11 : 13} fontWeight="600"
                         textAnchor="middle">{et}</SvgText>
              )
            })}
          </G>
        </Svg>

        {/* Los tiradores van como vistas y no dentro del SVG: así llevan
            Ionicons de verdad y no una silueta dibujada a mano. */}
        <View pointerEvents="none" style={[s.tirador, pos(gi), arrastrando === 'inicio' && s.tiradorVivo]}>
          <Ionicons name="bed" size={19} color={arrastrando ? '#fff' : 'rgba(255,255,255,0.85)'} />
        </View>
        <View pointerEvents="none" style={[s.tirador, pos(gf), arrastrando === 'fin' && s.tiradorVivo]}>
          <Ionicons name="alarm" size={19} color={arrastrando ? '#fff' : 'rgba(255,255,255,0.85)'} />
        </View>

        {/* El sol y la luna, como en el reloj de iOS: dicen de un vistazo qué
            mitad del anillo es de noche. */}
        {/* Bien adentro: antes caían a la misma altura que «12A.M.» y «12P.M.»
            y se montaban encima de la etiqueta. */}
        <View pointerEvents="none" style={[s.astro, { left: C - 9, top: C - 40 }]}>
          <Ionicons name="sparkles" size={16} color="#6FD6E0" />
        </View>
        <View pointerEvents="none" style={[s.astro, { left: C - 9, top: C + 24 }]}>
          <Ionicons name="sunny" size={16} color="#FFC542" />
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  caja: { alignItems: 'center' },
  lienzo: { width: LADO, height: LADO },
  tirador: {
    position: 'absolute', width: TIRADOR, height: TIRADOR, borderRadius: TIRADOR / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tiradorVivo: { backgroundColor: 'rgba(5,5,5,0.35)' },
  astro: { position: 'absolute', width: 18, alignItems: 'center' },
})
