/**
 * AL AIRE LIBRE · LA CIFRA
 * ════════════════════════
 * El dato medido. Es la pieza que más veces aparece en el módulo y la que más
 * fácil es hacer mal, así que vive en un solo sitio.
 *
 * ── Tres decisiones que no son de adorno ────────────────────────────────────
 *
 * 1. **Los decimales pesan menos.** «7,42 km» leído a un metro y en marcha es
 *    «siete y pico». El entero manda y la fracción acompaña, así que la parte
 *    decimal va en un peso más fino. Si pesaran igual, el ojo tiene que leer
 *    los cuatro dígitos antes de saber cuánto llevas.
 *
 * 2. **La unidad se levanta y se apaga.** Va al 30 % del tamaño, alineada
 *    arriba. Una unidad a la misma altura y peso compite con el número, y
 *    nadie mira una pantalla en carrera para leer «KM».
 *
 * 3. **GeistMono, no la fuente del cuerpo.** Las cifras de una carrera cambian
 *    cada segundo. Con una fuente proporcional, un `1` ocupa menos que un `8`
 *    y el número entero se desplaza a cada tic: parece que tiembla. La
 *    monoespaciada lo clava.
 *
 * El separador decimal acepta coma y punto: la app formatea en es-MX (coma),
 * pero los datos crudos llegan con punto y no se puede confiar en cuál viene.
 */

import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native'
import { RunningFonts } from '@/constants/running-tokens'
import { Etiqueta } from './Material'

export function Cifra({
  valor, unidad, tam = 34, color = '#fff', style,
}: {
  valor: string | number
  unidad?: string
  tam?: number
  color?: string
  style?: StyleProp<TextStyle>
}) {
  const txt = String(valor)
  // Solo parte el ÚLTIMO separador y solo si le siguen dígitos hasta el final.
  // Así «1:22:14» y «5:24» quedan intactos, que son horas y no decimales.
  const m = txt.match(/^(.*?)([.,]\d+)$/)

  return (
    <Text
      style={[
        c.base,
        { fontSize: tam, lineHeight: tam * 1.04, color },
        style,
      ]}
      allowFontScaling={false}
    >
      {m ? m[1] : txt}
      {m ? <Text style={[c.decimal, { fontSize: tam, lineHeight: tam * 1.04 }]}>{m[2]}</Text> : null}
      {unidad ? (
        <Text style={[c.unidad, { fontSize: tam * 0.3, lineHeight: tam * 1.04 }]}>
          {' '}{unidad.toUpperCase()}
        </Text>
      ) : null}
    </Text>
  )
}

/** Rótulo encima, cifra debajo. La fila de tres que llevan casi todas las tarjetas. */
export function Metrica({
  etiqueta, valor, unidad, tam = 19, color, style,
}: {
  etiqueta: string
  valor: string | number
  unidad?: string
  tam?: number
  color?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[{ flex: 1, minWidth: 0 }, style]}>
      <Etiqueta style={{ marginBottom: 3 }}>{etiqueta}</Etiqueta>
      <Cifra valor={valor} unidad={unidad} tam={tam} color={color} />
    </View>
  )
}

/** Envuelve dos o tres `Metrica` en la fila repartida de siempre. */
export function FilaMetricas({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[c.fila, style]}>{children}</View>
}

const c = StyleSheet.create({
  base: {
    fontFamily: RunningFonts.mono,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.2,
  },
  decimal: {
    fontFamily: RunningFonts.mono,
    opacity: 0.62,
  },
  unidad: {
    fontFamily: RunningFonts.body,
    fontWeight: '600',
    opacity: 0.46,
    letterSpacing: 0.4,
  },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
})
