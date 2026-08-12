/**
 * MAPA ANATÓMICO
 * ──────────────
 * La figura del cuerpo teñida por lo que se ha entrenado. Es la pantalla que
 * contesta de un vistazo la única pregunta que importa antes de entrenar: qué
 * llevo machacado y qué llevo abandonado.
 *
 * ── Por qué un cuerpo y no una lista de barras ──────────────────────────────
 * Una lista de doce grupos con su número obliga a leer doce filas y a saberse
 * de memoria cuáles son «espalda». Un cuerpo se lee entero de una vez, sin
 * traducir, y los huecos saltan solos: tres semanas sin piernas es una mitad
 * inferior apagada, y eso no hay tabla que lo diga igual de rápido.
 *
 * ── Dos lecturas del mismo dibujo ───────────────────────────────────────────
 * · CARGA: cuánto se ha trabajado cada grupo en la ventana. Contesta «¿estoy
 *   repartiendo bien?».
 * · FRESCURA: cuánto se ha recuperado desde la última vez. Contesta «¿qué puedo
 *   entrenar hoy?».
 * Son preguntas distintas y por eso no se mezclan en un solo color: el mismo
 * pecho puede estar muy trabajado esta semana Y estar ya recuperado.
 *
 * ── Lo que nunca se ha entrenado NO se pinta de verde ───────────────────────
 * «Fresco» y «sin datos» no son lo mismo. Un principiante que abre la app
 * vería el cuerpo entero en verde y entendería «todo listo», cuando lo que
 * pasa es que no sabemos nada. Sin datos se queda en el gris de la silueta.
 */

import { useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Svg, { Path, G, Defs, LinearGradient, Stop, RadialGradient, Ellipse } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, withTiming, withRepeat, withSequence, Easing,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import {
  LIENZO, ESPEJO, SILUETA, TRAZOS, DETALLES, NOMBRE_GRUPO, Vista,
} from './anatomy'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

export type Lectura = 'carga' | 'frescura'

export interface CargaGrupo {
  grupo: string
  series: number
  volumen: number
  cuota: number
  recuperacion: number | null
  horasDesde: number | null
}

interface Props {
  grupos: CargaGrupo[]
  vista: Vista
  lectura: Lectura
  onVista: (v: Vista) => void
  seleccionado?: string | null
  onSeleccionar?: (grupo: string | null) => void
  ancho?: number
}

// ── Color ────────────────────────────────────────────────────────────────────

/**
 * Mezcla dos colores. Se hace a mano en vez de con una librería porque son seis
 * líneas y porque `interpolateColor` de Reanimated solo sirve dentro de un
 * estilo animado, y aquí el color va en un atributo de SVG.
 */
function mezclar(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  const [r1, g1, b1] = p(a)
  const [r2, g2, b2] = p(b)
  const k = Math.max(0, Math.min(1, t))
  const c = (x: number, y: number) => Math.round(x + (y - x) * k)
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`
}

const APAGADO = '#1A1A1E'   // el gris de «no hay datos»

/**
 * El color de un grupo.
 *
 * En CARGA la escala va del gris al rojo por la CUOTA, no por el volumen
 * absoluto: quien mueve 12.000 kg de pierna y 3.000 de bíceps no tiene el
 * bíceps abandonado, tiene un bíceps. Lo que se compara es el reparto.
 *
 * En FRESCURA es al revés y a propósito: el rojo es lo que NO se puede tocar
 * hoy. En las dos lecturas el rojo significa «atención aquí», que es lo que el
 * rojo significa en el resto de ZENCRUS.
 */
function colorDe(g: CargaGrupo | undefined, lectura: Lectura, maxCuota: number): string {
  if (!g) return APAGADO

  if (lectura === 'carga') {
    if (g.series === 0) return APAGADO
    const t = maxCuota > 0 ? g.cuota / maxCuota : 0
    return mezclar('#3A3A42', '#FF1F3D', 0.25 + t * 0.75)
  }

  if (g.recuperacion === null) return APAGADO
  // 0 = recién entrenado (rojo) · 1 = recuperado (blanco)
  return mezclar('#FF1F3D', '#FFFFFF', g.recuperacion)
}

// ── Figura ───────────────────────────────────────────────────────────────────

const AnimatedG = Animated.createAnimatedComponent(G)

export function BodyMap({
  grupos, vista, lectura, onVista, seleccionado, onSeleccionar, ancho = 260,
}: Props) {
  const alto = (ancho / LIENZO.ancho) * LIENZO.alto

  const porGrupo = useMemo(
    () => new Map(grupos.map(g => [g.grupo, g])), [grupos],
  )
  const maxCuota = useMemo(
    () => grupos.reduce((m, g) => Math.max(m, g.cuota), 0), [grupos],
  )

  // Entrada: la figura sube un poco y aparece. Una sola animación al montar,
  // no un bucle: la pantalla se mira, no se contempla.
  const entrada = useSharedValue(0)
  useEffect(() => {
    entrada.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })
  }, [entrada])

  const estiloEntrada = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateY: (1 - entrada.value) * 14 }],
  }))

  // Latido del grupo seleccionado. Es la única animación en bucle de la
  // pantalla y solo corre cuando hay algo seleccionado: un dibujo que respira
  // todo el rato cansa y se lleva la atención de los datos.
  const latido = useSharedValue(1)
  useEffect(() => {
    if (!seleccionado) { latido.value = 1; return }
    latido.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, false,
    )
  }, [seleccionado, latido])

  // Se anima la PROPIEDAD `opacity` del grupo SVG, no un estilo: un `<G>` de
  // react-native-svg no acepta estilos animados, y pasárselos compila en unos
  // sitios y no pinta nada en otros.
  const propsLatido = useAnimatedProps(() => ({ opacity: latido.value }))

  const tocar = (grupo: string | null) => {
    void Haptics.selectionAsync()
    onSeleccionar?.(seleccionado === grupo ? null : grupo)
  }

  const trazos = TRAZOS[vista]
  const silueta = SILUETA[vista]

  const dibujarTrazo = (d: string, fill: string, grupo: string | null, key: string) => (
    <Path
      key={key}
      d={d}
      fill={fill}
      stroke="rgba(0,0,0,0.55)"
      strokeWidth={0.7}
      // El trazo espejado recibe el mismo toque: si solo respondiera la mitad
      // izquierda, tocar el pectoral derecho no haría nada y parecería roto.
      onPress={grupo ? () => tocar(grupo) : undefined}
    />
  )

  return (
    <View style={s.wrap}>
      {/* ── Frente / espalda ─────────────────────────────────────────── */}
      <View style={s.vistas}>
        {(['frente', 'espalda'] as Vista[]).map(v => (
          <TouchableOpacity
            key={v}
            style={[s.vistaChip, vista === v && s.vistaChipOn]}
            onPress={() => { void Haptics.selectionAsync(); onVista(v) }}
            activeOpacity={0.85}
          >
            <Text style={[s.vistaTxt, vista === v && s.vistaTxtOn]}>
              {v === 'frente' ? 'Frente' : 'Espalda'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.View style={[{ width: ancho, height: alto }, estiloEntrada]}>
        <Svg width={ancho} height={alto} viewBox={`0 0 ${LIENZO.ancho} ${LIENZO.alto}`}>
          <Defs>
            {/* Halo de suelo: separa la figura del fondo sin dibujarle un marco. */}
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FF1F3D" stopOpacity="0.13" />
              <Stop offset="100%" stopColor="#FF1F3D" stopOpacity="0" />
            </RadialGradient>
            {/* La silueta no es plana: se aclara un punto hacia el centro, que
                es lo que da volumen sin tener que sombrear a mano. */}
            <LinearGradient id="piel" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#141418" />
              <Stop offset="55%" stopColor="#1E1E24" />
              <Stop offset="100%" stopColor="#141418" />
            </LinearGradient>
          </Defs>

          <Ellipse cx={100} cy={220} rx={110} ry={190} fill="url(#halo)" />

          {/* Silueta */}
          <G>
            {silueta.map((t, i) => dibujarTrazo(t.d, 'url(#piel)', null, `sil-${i}`))}
            <G transform={ESPEJO}>
              {silueta.filter(t => t.par).map((t, i) => dibujarTrazo(t.d, 'url(#piel)', null, `sil-esp-${i}`))}
            </G>
          </G>

          {/* Músculos */}
          <G>
            {trazos.map((t, i) =>
              dibujarTrazo(t.d, colorDe(porGrupo.get(t.grupo!), lectura, maxCuota), t.grupo, `m-${i}`))}
            <G transform={ESPEJO}>
              {trazos.filter(t => t.par).map((t, i) =>
                dibujarTrazo(t.d, colorDe(porGrupo.get(t.grupo!), lectura, maxCuota), t.grupo, `m-esp-${i}`))}
            </G>
          </G>

          {/* Surcos. Encima de todo y sin toque: son detalle, no piezas. */}
          <G pointerEvents="none">
            {DETALLES[vista].map((d, i) => (
              <Path key={`det-${i}`} d={d} fill="none"
                stroke="rgba(0,0,0,0.42)" strokeWidth={1.1} strokeLinecap="round" />
            ))}
          </G>

          {/* Realce del seleccionado: un contorno claro encima, latiendo. */}
          {seleccionado && (
            <AnimatedG animatedProps={propsLatido}>
              {trazos.filter(t => t.grupo === seleccionado).map((t, i) => (
                <Path key={`sel-${i}`} d={t.d} fill="none" stroke="#FFFFFF" strokeWidth={2} />
              ))}
              <G transform={ESPEJO}>
                {trazos.filter(t => t.grupo === seleccionado && t.par).map((t, i) => (
                  <Path key={`sel-esp-${i}`} d={t.d} fill="none" stroke="#FFFFFF" strokeWidth={2} />
                ))}
              </G>
            </AnimatedG>
          )}
        </Svg>
      </Animated.View>

      {/* ── Escala ───────────────────────────────────────────────────── */}
      <Escala lectura={lectura} />
    </View>
  )
}

/**
 * La leyenda.
 *
 * Va siempre, no escondida detrás de un botón de ayuda: un dibujo con colores
 * que no se explican es decoración, y quien no sepa qué significa el rojo no va
 * a buscar una interrogación para averiguarlo.
 */
function Escala({ lectura }: { lectura: Lectura }) {
  const pasos = lectura === 'carga'
    ? [
        { c: APAGADO, t: 'Sin tocar' },
        { c: mezclar('#3A3A42', '#FF1F3D', 0.4), t: 'Poco' },
        { c: mezclar('#3A3A42', '#FF1F3D', 0.7), t: 'Bastante' },
        { c: '#FF1F3D', t: 'Lo que más' },
      ]
    : [
        { c: '#FF1F3D', t: 'Cargado' },
        { c: mezclar('#FF1F3D', '#FFFFFF', 0.5), t: 'A medias' },
        { c: '#FFFFFF', t: 'Listo' },
        { c: APAGADO, t: 'Sin datos' },
      ]

  return (
    <View style={s.escala}>
      {pasos.map(p => (
        <View key={p.t} style={s.escalaItem}>
          <View style={[s.escalaPunto, { backgroundColor: p.c }]} />
          <Text style={s.escalaTxt}>{p.t}</Text>
        </View>
      ))}
    </View>
  )
}

/** La tarjeta que sale al tocar un músculo. */
export function FichaMusculo({ grupo, datos, onCerrar, onVerEjercicios }: {
  grupo: string
  datos: CargaGrupo | undefined
  onCerrar: () => void
  onVerEjercicios: () => void
}) {
  const horas = datos?.horasDesde
  const cuando = horas === null || horas === undefined ? 'Nunca registrado'
    : horas < 1 ? 'Hace menos de una hora'
    : horas < 24 ? `Hace ${horas} h`
    : `Hace ${Math.floor(horas / 24)} d`

  const estado = datos?.recuperacion === null || datos?.recuperacion === undefined ? 'Sin datos'
    : datos.recuperacion >= 1 ? 'Recuperado'
    : datos.recuperacion >= 0.6 ? 'Casi listo'
    : 'Todavía cargado'

  return (
    <View style={fm.wrap}>
      <View style={fm.cabecera}>
        <Text style={fm.titulo}>{NOMBRE_GRUPO[grupo] ?? grupo}</Text>
        <TouchableOpacity onPress={onCerrar} hitSlop={10}>
          <Text style={fm.cerrar}>Cerrar</Text>
        </TouchableOpacity>
      </View>

      <View style={fm.datos}>
        <Bloque valor={String(datos?.series ?? 0)} etiqueta="SERIES" />
        <Bloque valor={datos?.volumen ? `${Math.round(datos.volumen / 1000 * 10) / 10}k` : '—'} etiqueta="KG" />
        <Bloque valor={estado} etiqueta="ESTADO" pequeno />
      </View>

      <Text style={fm.cuando}>Última vez: {cuando}</Text>

      <TouchableOpacity style={fm.boton} onPress={onVerEjercicios} activeOpacity={0.85}>
        <Text style={fm.botonTxt}>Ver ejercicios de {NOMBRE_GRUPO[grupo]?.toLowerCase() ?? grupo}</Text>
      </TouchableOpacity>
    </View>
  )
}

function Bloque({ valor, etiqueta, pequeno }: { valor: string; etiqueta: string; pequeno?: boolean }) {
  return (
    <View style={fm.bloque}>
      <Text style={[fm.bloqueValor, pequeno && { fontSize: 13 }]} numberOfLines={1}>{valor}</Text>
      <Text style={fm.bloqueEtiqueta}>{etiqueta}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing[3] },
  vistas: {
    flexDirection: 'row', gap: 4, padding: 3,
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  vistaChip: { paddingHorizontal: Spacing[4], paddingVertical: 7, borderRadius: BorderRadius.full },
  vistaChipOn: { backgroundColor: Colors.neon.paneHi },
  vistaTxt: { fontSize: 12, fontWeight: '700', color: Colors.neon.w3 },
  vistaTxtOn: { color: Colors.neon.white },
  escala: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing[3] },
  escalaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  escalaPunto: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  escalaTxt: { fontSize: 10, color: Colors.neon.w3, fontWeight: '600' },
})

const fm = StyleSheet.create({
  wrap: {
    gap: Spacing[3], padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.neon.white },
  cerrar: { fontSize: 12, fontWeight: '700', color: Colors.neon.w3 },
  datos: { flexDirection: 'row', gap: Spacing[2] },
  bloque: {
    flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing[3],
    backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: BorderRadius.md,
  },
  bloqueValor: { fontSize: 18, fontWeight: '800', color: Colors.neon.white },
  bloqueEtiqueta: { fontSize: 9, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 1 },
  cuando: { fontSize: 12, color: Colors.neon.w2 },
  boton: {
    alignItems: 'center', paddingVertical: Spacing[3],
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.35)',
    backgroundColor: Colors.neon.redDim,
  },
  botonTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.redCore },
})
