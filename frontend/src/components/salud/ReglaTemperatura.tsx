/**
 * LA REGLA DE TEMPERATURA
 * ═══════════════════════════════════════════════════════════════════════════
 * Una escala que se arrastra, no un campo de texto.
 *
 * ── Por qué no un teclado numérico ─────────────────────────────────────────
 * Esto se hace medio dormida, a la misma hora, todos los días, antes de
 * levantarse. Un campo de texto pide abrir el teclado, acertar el punto
 * decimal y confirmar. Una regla que se empuja con el pulgar se hace con una
 * mano y sin mirar del todo, y es la diferencia entre un registro que dura
 * seis meses y uno que se abandona en dos semanas.
 *
 * ── Y por qué salta de cinco en cinco centésimas ───────────────────────────
 * El escalón que confirma la ovulación mide unas dos décimas. Con pasos de una
 * décima el dato entra justo con tres niveles de resolución y se pierde en el
 * redondeo; con pasos de una centésima la regla se hace larguísima de arrastrar.
 * Cinco centésimas es lo que dan los termómetros basales y es la resolución
 * que el método necesita.
 */

import { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, useWindowDimensions,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { base, family, type as tipo, numeric, radius, space } from '@/theme/salud/tokens'
import { elegir } from '@/utils/haptica'

const MIN = 35.5
const MAX = 38.0
const PASO = 0.05
const ANCHO_MARCA = 12

const PASOS = Math.round((MAX - MIN) / PASO) + 1
const valorDe = (i: number) => Math.round((MIN + i * PASO) * 100) / 100
const indiceDe = (v: number) => Math.round((v - MIN) / PASO)

export function ReglaTemperatura({ valor, onChange, tono }: {
  valor: number | null
  onChange: (v: number) => void
  tono: string
}) {
  const { width } = useWindowDimensions()
  const ref = useRef<ScrollView>(null)
  const ultimo = useRef<number | null>(valor)
  /* Dónde estaba la regla al empezar a arrastrar. Sin esto, un desplazamiento
     VERTICAL que roce la regla la deja marcada: el ScrollView horizontal
     reclama el gesto, dispara `onScrollEndDrag` sin haberse movido y se
     guardaría un valor que nadie eligió —36,50, que es donde nace—. Es
     exactamente la regla de «nada nace contestado», y aquí se rompía sola. */
  const alEmpezar = useRef<number | null>(null)
  const relleno = width / 2 - ANCHO_MARCA / 2

  /* Solo se coloca al montar y cuando el valor cambia DESDE FUERA. Sin este
     control, cada cambio propio volvería a empujar el scroll y la regla
     pelearía contra el dedo. */
  useEffect(() => {
    if (valor == null || valor === ultimo.current) return
    ultimo.current = valor
    ref.current?.scrollTo({ x: indiceDe(valor) * ANCHO_MARCA, animated: false })
  }, [valor])

  useEffect(() => {
    const inicial = valor ?? 36.5
    requestAnimationFrame(() => {
      ref.current?.scrollTo({ x: indiceDe(inicial) * ANCHO_MARCA, animated: false })
    })
  }, [])

  const alEmpezarArrastre = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    alEmpezar.current = e.nativeEvent.contentOffset.x
  }

  const alSoltar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x
    // Menos de media marca de recorrido no es una elección, es un roce.
    if (alEmpezar.current != null && Math.abs(x - alEmpezar.current) < ANCHO_MARCA / 2) return
    alEmpezar.current = null

    const i = Math.max(0, Math.min(PASOS - 1, Math.round(x / ANCHO_MARCA)))
    const v = valorDe(i)
    if (v === ultimo.current) return
    ultimo.current = v
    elegir()
    onChange(v)
  }

  return (
    <View>
      <View style={s.lectura}>
        <Text style={[s.numero, valor == null && s.sinMarcar]}>
          {valor != null ? valor.toFixed(2) : '--.--'}
        </Text>
        <Text style={s.unidad}>°C</Text>
      </View>

      <View style={s.reglaWrap}>
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ANCHO_MARCA}
          decelerationRate="fast"
          onScrollBeginDrag={alEmpezarArrastre}
          onMomentumScrollEnd={alSoltar}
          onScrollEndDrag={alSoltar}
          contentContainerStyle={{ paddingHorizontal: relleno }}
        >
          {Array.from({ length: PASOS }, (_, i) => {
            const v = valorDe(i)
            // Marca alta en cada grado y media alta en cada media décima.
            const entero = Math.abs(v - Math.round(v)) < 0.001
            const media = Math.abs(v * 10 - Math.round(v * 10)) < 0.001
            return (
              <View key={i} style={s.marcaWrap}>
                <View style={[
                  s.marca,
                  { height: entero ? 26 : media ? 18 : 10 },
                  entero && { backgroundColor: base.textMid },
                ]} />
                {entero ? <Text style={s.marcaTxt}>{v.toFixed(0)}</Text> : null}
              </View>
            )
          })}
        </ScrollView>

        {/* Los bordes se desvanecen.
            Sin esto, la marca del extremo se corta a media cifra —«37» se leía
            «3'»— y parece un fallo de dibujo en vez de lo que es: una escala
            que sigue más allá del borde. El degradado dice «esto continúa». */}
        <LinearGradient
          colors={[base.surface1, `${base.surface1}00`]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={[s.velo, { left: 0 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[`${base.surface1}00`, base.surface1]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={[s.velo, { right: 0 }]}
          pointerEvents="none"
        />

        {/* El cursor no se mueve: se mueve la escala. */}
        <View style={s.cursorWrap} pointerEvents="none">
          <View style={[s.cursor, { backgroundColor: tono }]} />
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  lectura: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 },
  numero: {
    fontFamily: family.dataMedium, fontSize: tipo.data.xl,
    color: base.textHi, ...numeric,
  },
  sinMarcar: { color: base.textLow },
  unidad: { fontFamily: family.data, fontSize: tipo.ui.md, color: base.textMid },

  reglaWrap: { height: 46, marginTop: space.sm, justifyContent: 'center' },
  marcaWrap: { width: ANCHO_MARCA, alignItems: 'center', justifyContent: 'flex-start', height: 44 },
  marca: { width: 1.5, borderRadius: 1, backgroundColor: base.hairline },
  /* Absoluta y más ancha que la marca: «37» no cabe en 12 px y se recortaba
     a «3'». Centrada sobre su marca con un desplazamiento de medio ancho. */
  marcaTxt: {
    position: 'absolute', top: 30, width: 30, left: (ANCHO_MARCA - 30) / 2,
    textAlign: 'center',
    fontFamily: family.data, fontSize: 9, color: base.textLow, ...numeric,
  },

  velo: { position: 'absolute', top: 0, bottom: 0, width: 26 },
  cursorWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-start' },
  cursor: { width: 2.5, height: 30, borderRadius: radius.sm },
})
