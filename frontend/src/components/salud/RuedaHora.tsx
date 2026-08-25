/**
 * LA RUEDA DE LA HORA
 * ═══════════════════════════════════════════════════════════════════════════
 * Dos columnas que se giran, como el reloj de iOS. Sustituye a los dos campos
 * numéricos donde había que teclear la hora.
 *
 * ── Por qué no se teclea ───────────────────────────────────────────────────
 * Escribir una hora obliga a cambiar de teclado para los dos puntos, y en el
 * simulador ni siquiera llegan —salen como «Ñ»—. Girar no tiene ese problema y
 * además impide escribir una hora imposible: no hay un 25 al que llegar.
 *
 * ── De cinco en cinco ──────────────────────────────────────────────────────
 * Los minutos van a saltos de cinco. Nadie pone el despertador a las 22:37, y
 * con sesenta posiciones el giro se vuelve interminable.
 *
 * ── La banda va DENTRO de las columnas ─────────────────────────────────────
 * Y no en la caja de fuera, que incluye el pie de texto: medida contra la caja
 * entera, la banda queda por debajo de la cifra que debe enmarcar.
 */

import { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native'

const ROJO = '#FF1F3D'

const ITEM = 46
const VISIBLES = 5
const ALTO = ITEM * VISIBLES
const HUECO = (ALTO - ITEM) / 2

const HORAS = Array.from({ length: 24 }, (_, i) => i)
const MINUTOS = Array.from({ length: 12 }, (_, i) => i * 5)

const dos = (n: number) => String(n).padStart(2, '0')

function Columna({ valores, valor, onValor }: {
  valores: number[]
  valor: number
  onValor: (v: number) => void
}) {
  const ref = useRef<ScrollView>(null)
  const indice = Math.max(0, valores.indexOf(valor))

  // Se coloca en su valor al montar y cuando cambia desde fuera —al elegir una
  // plantilla, por ejemplo—, pero nunca mientras el dedo la está girando.
  const girando = useRef(false)
  useEffect(() => {
    if (girando.current) return
    ref.current?.scrollTo({ y: indice * ITEM, animated: false })
  }, [indice])

  const alParar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    girando.current = false
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM)
    const v = valores[Math.max(0, Math.min(valores.length - 1, i))]
    if (v !== valor) onValor(v)
  }

  return (
    <ScrollView
      ref={ref}
      style={s.col}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM}
      decelerationRate="fast"
      contentContainerStyle={{ paddingVertical: HUECO }}
      onScrollBeginDrag={() => { girando.current = true }}
      onMomentumScrollEnd={alParar}
      // Un giro corto sin inercia no dispara `onMomentumScrollEnd`, y la cifra
      // se quedaría sin actualizar aunque la rueda sí se hubiera movido.
      onScrollEndDrag={alParar}
    >
      {valores.map(v => (
        <View key={v} style={s.celda}>
          <Text style={[s.cifra, v === valor && s.cifraFoco]}>{dos(v)}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

export function RuedaHora({ hora, minuto, onCambio, pie }: {
  hora: number
  minuto: number
  onCambio: (h: number, m: number) => void
  pie?: string
}) {
  return (
    <View style={s.caja}>
      <View style={s.cols}>
        <View style={s.banda} pointerEvents="none" />
        <Columna valores={HORAS} valor={hora} onValor={h => onCambio(h, minuto)} />
        <Text style={s.dosPuntos}>:</Text>
        <Columna valores={MINUTOS} valor={minuto} onValor={m => onCambio(hora, m)} />
      </View>
      {!!pie && <Text style={s.pie}>{pie}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  caja: {
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  cols: {
    height: ALTO, flexDirection: 'row',
    alignItems: 'stretch', justifyContent: 'center',
  },
  banda: {
    position: 'absolute', left: 14, right: 14,
    top: HUECO, height: ITEM, borderRadius: 14,
    backgroundColor: 'rgba(255,31,61,0.13)',
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.4)',
  },
  col: { width: 88 },
  celda: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  cifra: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 30,
    color: 'rgba(255,255,255,0.28)', letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  cifraFoco: { color: '#fff' },
  dosPuntos: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 28,
    color: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginTop: -3,
  },
  pie: {
    textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 12.5,
    color: 'rgba(255,255,255,0.32)', paddingBottom: 16, paddingTop: 2,
  },
})

export { ROJO as ROJO_RUEDA }
