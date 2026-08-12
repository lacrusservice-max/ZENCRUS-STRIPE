/**
 * GRÁFICOS DE ENTRENAMIENTO
 * ─────────────────────────
 * Barras, curvas y anillos. Todo SVG dibujado a mano: no hay ninguna librería
 * de gráficos porque las que hay traen ejes, rejillas y leyendas que aquí
 * sobran, y porque las buenas dependen de Skia, que Expo Go no lleva.
 *
 * ── Reglas comunes ──────────────────────────────────────────────────────────
 * · Nada de eje Y con números. El valor exacto va en el punto que se toca; la
 *   forma de la curva es lo que se lee de un vistazo.
 * · Los ceros se DIBUJAN. Una semana sin entrenar es una barra a ras de suelo,
 *   no un hueco: el hueco lo rellena el ojo con una línea recta y esconde justo
 *   el parón que hay que ver.
 * · Un solo punto no es una tendencia y se dice, en vez de pintar una recta
 *   que sugiere una progresión inventada.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Svg, { Path, Rect, Circle, Line, Defs, LinearGradient, Stop, G } from 'react-native-svg'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

// ── Barras ───────────────────────────────────────────────────────────────────

export interface Barra {
  etiqueta: string
  valor: number
  /** Se pinta distinto: es la semana en curso y todavía no ha terminado. */
  enCurso?: boolean
}

/**
 * Barras de volumen por semana.
 *
 * La semana en curso va rayada, no llena: comparar un miércoles contra semanas
 * completas hace creer que se ha bajado el ritmo cuando quedan cuatro días.
 */
export function Barras({ datos, alto = 132, color = Colors.neon.red, onTocar }: {
  datos: Barra[]
  alto?: number
  color?: string
  onTocar?: (i: number) => void
}) {
  const max = Math.max(...datos.map(d => d.valor), 1)
  const n = datos.length || 1
  const ancho = 300
  const hueco = 4
  const anchoBarra = Math.max(3, (ancho - hueco * (n - 1)) / n)
  const alturaUtil = alto - 20

  return (
    <View>
      <Svg width="100%" height={alto} viewBox={`0 0 ${ancho} ${alto}`}>
        <Defs>
          <LinearGradient id="barra" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.35" />
          </LinearGradient>
        </Defs>

        {/* Suelo: da referencia sin necesidad de una rejilla entera. */}
        <Line x1="0" y1={alturaUtil} x2={ancho} y2={alturaUtil}
          stroke="rgba(255,255,255,0.10)" strokeWidth={1} />

        {datos.map((d, i) => {
          const h = d.valor > 0 ? Math.max(2, (d.valor / max) * (alturaUtil - 6)) : 2
          const x = i * (anchoBarra + hueco)
          return (
            <Rect
              key={i}
              x={x} y={alturaUtil - h}
              width={anchoBarra} height={h}
              rx={Math.min(3, anchoBarra / 2)}
              fill={d.valor === 0 ? 'rgba(255,255,255,0.10)' : 'url(#barra)'}
              opacity={d.enCurso ? 0.5 : 1}
              onPress={onTocar ? () => onTocar(i) : undefined}
            />
          )
        })}
      </Svg>

      {/* Solo la primera y la última etiqueta: doce fechas no caben y nadie
          las lee. El rango es lo que sitúa la gráfica. */}
      <View style={c.piePie}>
        <Text style={c.pieTxt}>{datos[0]?.etiqueta ?? ''}</Text>
        <Text style={c.pieTxt}>{datos[datos.length - 1]?.etiqueta ?? ''}</Text>
      </View>
    </View>
  )
}

// ── Curva ────────────────────────────────────────────────────────────────────

export interface Punto { x: string; y: number }

/**
 * Curva de progresión con área bajo la línea.
 *
 * El eje Y NO empieza en cero: en una curva de 1RM que va de 100 a 110 kg,
 * empezar en cero convierte una mejora del 10 % en una línea plana. Se acota al
 * rango real con un margen, y el rango se dice con letras encima.
 */
export function Curva({ puntos, alto = 150, color = Colors.neon.red, unidad = 'kg' }: {
  puntos: Punto[]
  alto?: number
  color?: string
  unidad?: string
}) {
  if (puntos.length === 0) {
    return <Vacio texto="Sin datos todavía" />
  }
  if (puntos.length === 1) {
    return (
      <Vacio texto={`Un solo registro: ${puntos[0].y} ${unidad}. Con dos ya hay tendencia que enseñar.`} />
    )
  }

  const ancho = 300
  const pad = 10
  const valores = puntos.map(p => p.y)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1
  // Un 12 % de aire arriba y abajo: pegar la curva a los bordes hace que el
  // máximo parezca un techo y el mínimo un suelo.
  const lo = min - rango * 0.12
  const hi = max + rango * 0.12

  const px = (i: number) => pad + (i / (puntos.length - 1)) * (ancho - pad * 2)
  const py = (v: number) => alto - pad - ((v - lo) / (hi - lo)) * (alto - pad * 2)

  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ')
  const area = `${linea} L${px(puntos.length - 1).toFixed(1)},${alto - pad} L${px(0).toFixed(1)},${alto - pad} Z`

  const ultimo = puntos[puntos.length - 1]
  const primero = puntos[0]
  const delta = ultimo.y - primero.y

  return (
    <View>
      <View style={c.cabecera}>
        <Text style={c.valorGrande}>
          {ultimo.y}<Text style={c.unidad}> {unidad}</Text>
        </Text>
        <Text style={[c.delta, { color: delta >= 0 ? Colors.neon.white : Colors.neon.steelSoft }]}>
          {delta >= 0 ? '+' : ''}{Math.round(delta * 10) / 10} {unidad} desde el principio
        </Text>
      </View>

      <Svg width="100%" height={alto} viewBox={`0 0 ${ancho} ${alto}`}>
        <Defs>
          <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Path d={area} fill="url(#area)" />
        <Path d={linea} fill="none" stroke={color} strokeWidth={2.4}
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Solo se marcan los extremos. Un punto por sesión en seis meses son
            ochenta círculos que tapan la línea que vienen a explicar. */}
        <Circle cx={px(0)} cy={py(primero.y)} r={3.2} fill={Colors.neon.void} stroke={color} strokeWidth={2} />
        <Circle cx={px(puntos.length - 1)} cy={py(ultimo.y)} r={4.5} fill={color} />
      </Svg>

      <View style={c.piePie}>
        <Text style={c.pieTxt}>{primero.x}</Text>
        <Text style={c.pieTxt}>{ultimo.x}</Text>
      </View>
    </View>
  )
}

// ── Anillo ───────────────────────────────────────────────────────────────────

/**
 * Anillo de progreso con hueco arriba, tipo velocímetro.
 *
 * Abierto y no cerrado a propósito: un círculo completo se lee como «esto se
 * llena y ya está», y aquí no hay un tope que alcanzar sino un ritmo que
 * mantener. El hueco deja claro que la escala sigue.
 */
export function Anillo({ pct, tam = 96, grosor = 8, color = Colors.neon.red, children }: {
  pct: number
  tam?: number
  grosor?: number
  color?: string
  children?: React.ReactNode
}) {
  const r = (tam - grosor) / 2
  const centro = tam / 2
  // 280° de recorrido, con el hueco de 80° centrado abajo.
  const arco = 280
  const inicio = 130
  const largo = (arco / 360) * 2 * Math.PI * r
  const vuelta = 2 * Math.PI * r
  const avance = Math.max(0, Math.min(1, pct))

  return (
    <View style={{ width: tam, height: tam, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={tam} height={tam} style={StyleSheet.absoluteFill}>
        <G transform={`rotate(${inicio} ${centro} ${centro})`}>
          <Circle cx={centro} cy={centro} r={r} fill="none"
            stroke="rgba(255,255,255,0.09)" strokeWidth={grosor}
            strokeDasharray={`${largo} ${vuelta}`} strokeLinecap="round" />
          <Circle cx={centro} cy={centro} r={r} fill="none"
            stroke={color} strokeWidth={grosor}
            strokeDasharray={`${largo * avance} ${vuelta}`} strokeLinecap="round" />
        </G>
      </Svg>
      {children}
    </View>
  )
}

// ── Reparto ──────────────────────────────────────────────────────────────────

export interface Porcion { etiqueta: string; valor: number; color: string }

/**
 * Barra de reparto: una sola línea partida en trozos.
 *
 * En vez de un gráfico de tarta. Una tarta de once grupos musculares son once
 * porciones que nadie sabe comparar; una barra apilada se lee de izquierda a
 * derecha y los trozos minúsculos siguen viéndose porque tienen ancho mínimo.
 */
export function Reparto({ porciones, alto = 12 }: { porciones: Porcion[]; alto?: number }) {
  const total = porciones.reduce((a, p) => a + p.valor, 0)
  if (total === 0) return <Vacio texto="Nada registrado en esta ventana" />

  return (
    <View style={{ gap: Spacing[3] }}>
      <View style={[c.reparto, { height: alto }]}>
        {porciones.filter(p => p.valor > 0).map((p, i) => (
          <View key={i} style={{ flex: p.valor, backgroundColor: p.color, minWidth: 3 }} />
        ))}
      </View>
      <View style={c.leyenda}>
        {porciones.filter(p => p.valor > 0).map((p, i) => (
          <View key={i} style={c.leyendaItem}>
            <View style={[c.leyendaPunto, { backgroundColor: p.color }]} />
            <Text style={c.leyendaTxt}>
              {p.etiqueta} <Text style={c.leyendaPct}>{Math.round((p.valor / total) * 100)}%</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

export function Vacio({ texto }: { texto: string }) {
  return (
    <View style={c.vacio}>
      <Text style={c.vacioTxt}>{texto}</Text>
    </View>
  )
}

/** Una cifra con su etiqueta. La unidad mínima de todos los paneles. */
export function Cifra({ valor, etiqueta, sufijo, onPress }: {
  valor: string
  etiqueta: string
  sufijo?: string
  onPress?: () => void
}) {
  const dentro = (
    <>
      <Text style={c.cifraValor} numberOfLines={1}>
        {valor}{sufijo ? <Text style={c.cifraSufijo}>{sufijo}</Text> : null}
      </Text>
      <Text style={c.cifraEtiqueta}>{etiqueta}</Text>
    </>
  )

  // Dos ramas en vez de un componente elegido en tiempo de ejecución: el
  // componente dinámico compilaba mal y, sobre todo, una cifra que no lleva a
  // ningún sitio no debe responder al toque ni atenuarse al pulsarla.
  return onPress
    ? <TouchableOpacity style={c.cifra} onPress={onPress} activeOpacity={0.8}>{dentro}</TouchableOpacity>
    : <View style={c.cifra}>{dentro}</View>
}

const c = StyleSheet.create({
  cabecera: { marginBottom: Spacing[2] },
  valorGrande: { fontSize: 30, fontWeight: '800', color: Colors.neon.white, letterSpacing: -1 },
  unidad: { fontSize: 15, fontWeight: '700', color: Colors.neon.w3 },
  delta: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  piePie: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  pieTxt: { fontSize: 10, color: Colors.neon.w3, fontWeight: '600' },

  reparto: { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', gap: 1 },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  leyendaPunto: { width: 8, height: 8, borderRadius: 4 },
  leyendaTxt: { fontSize: 11, color: Colors.neon.w2, fontWeight: '600' },
  leyendaPct: { color: Colors.neon.w3 },

  vacio: {
    paddingVertical: Spacing[5], paddingHorizontal: Spacing[4], alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.neon.edge, borderStyle: 'dashed',
  },
  vacioTxt: { fontSize: Typography.fontSize.sm, color: Colors.neon.w3, textAlign: 'center', lineHeight: 19 },

  cifra: {
    flex: 1, alignItems: 'center', gap: 2,
    paddingVertical: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  cifraValor: { fontSize: 19, fontWeight: '800', color: Colors.neon.white },
  cifraSufijo: { fontSize: 11, fontWeight: '700', color: Colors.neon.w3 },
  cifraEtiqueta: { fontSize: 9, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 0.8 },
})
