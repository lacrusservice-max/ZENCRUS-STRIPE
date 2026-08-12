/**
 * LA SEMANA, EN UNA TIRA
 * ──────────────────────
 * Siete columnas —una por día— con la altura de lo que se entrenó, y el día de
 * hoy marcado.
 *
 * ── Por qué esto y no el anillo que había ───────────────────────────────────
 * Un anillo dice UNA cosa: cuánto llevas de cuatro. Está bien y no dice nada
 * más. Esta tira dice lo mismo —cuántos días llenos hay— y además CUÁNDO
 * fueron: tres seguidos y cuatro vacíos no es lo mismo que uno cada dos días,
 * aunque el anillo los pinte idénticos.
 *
 * ── Los días futuros se dibujan ─────────────────────────────────────────────
 * Vacíos y con el borde marcado, no ausentes. Es lo que convierte la tira en
 * algo que se quiere rellenar en vez de en un informe de lo que ya no tiene
 * arreglo.
 */

import { View, Text, StyleSheet } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Dia } from '@/services/statsService'
import { Colors, Typography, Spacing } from '@/constants/theme'

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface Props {
  /**
   * Los siete últimos días, del servidor y ya en huso local.
   *
   * Con valor por defecto a propósito. Una pantalla entera no puede caerse
   * porque una lista llegue vacía un instante —pasó con un desajuste de recarga
   * en caliente, y el ErrorBoundary se tragó Progreso entera—. Sin datos la
   * tira se dibuja vacía, que es exactamente lo que hay que enseñar.
   */
  dias?: Dia[]
  sesionesSemana: number
  objetivo: number
  racha: number
}

export function TiraSemana({ dias = [], sesionesSemana, objetivo, racha }: Props) {
  /**
   * Los siete días REALES, no un reparto aproximado.
   *
   * La primera versión rellenaba de izquierda a derecha con el total de la
   * semana: marcaba el lunes cuando se había entrenado el miércoles. Un dato
   * aproximado que se ve a simple vista no es una aproximación, es un error, y
   * en una tira de siete casillas se ve a la primera.
   *
   * El servidor los devuelve en orden y con la fecha ya en el huso del móvil.
   */
  const ultimos = (dias ?? []).slice(-7)
  const hoy = ultimos.length - 1

  const frase = sesionesSemana === 0
    ? 'Todavía sin entrenar esta semana'
    : sesionesSemana >= objetivo
      ? 'Semana cerrada. Así se construye.'
      : `Te ${objetivo - sesionesSemana === 1 ? 'falta' : 'faltan'} ${objetivo - sesionesSemana} para cerrar la semana`

  return (
    <View style={s.wrap}>
      <View style={s.cabecera}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>
            {sesionesSemana}<Text style={s.de}> de {objetivo}</Text>
          </Text>
          <Text style={s.frase}>{frase}</Text>
        </View>
        {racha > 1 && (
          <View style={s.racha}>
            <Text style={s.rachaNum}>{racha}</Text>
            <Text style={s.rachaTxt}>días{'\n'}seguidos</Text>
          </View>
        )}
      </View>

      <View style={s.tira}>
        {ultimos.map((dia, i) => {
          const lleno = dia.sesiones > 0
          const esHoy = i === hoy
          const pasado = i <= hoy
          // La inicial del día sale de la FECHA, no de una lista fija: la tira
          // son los últimos siete días, no la semana natural, así que el
          // primero no es siempre lunes.
          const inicial = DIAS[(new Date(dia.fecha + 'T12:00:00').getDay() + 6) % 7]
          return (
            <Animated.View
              key={dia.fecha}
              entering={FadeInDown.delay(i * 40).duration(320)}
              style={s.columna}
            >
              <View style={[
                s.barra,
                lleno && s.barraLlena,
                !lleno && pasado && s.barraVacia,
                esHoy && s.barraHoy,
              ]}>
                {lleno && <View style={s.brillo} />}
              </View>
              <Text style={[s.dia, esHoy && s.diaHoy]}>{inicial}</Text>
            </Animated.View>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    gap: Spacing[4], padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 22,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  titulo: { fontSize: 34, fontWeight: '800', color: Colors.neon.white, letterSpacing: -1.4, lineHeight: 38 },
  de: { fontSize: 16, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 0 },
  frase: { fontSize: Typography.fontSize.sm, color: Colors.neon.w2, marginTop: 2 },

  racha: {
    alignItems: 'center', paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: 14,
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.32)',
  },
  rachaNum: { fontSize: 20, fontWeight: '800', color: Colors.neon.red, lineHeight: 22 },
  rachaTxt: { fontSize: 8.5, fontWeight: '700', color: Colors.neon.redCore, textAlign: 'center', lineHeight: 10 },

  tira: { flexDirection: 'row', gap: Spacing[2], alignItems: 'flex-end' },
  columna: { flex: 1, alignItems: 'center', gap: 7 },
  barra: {
    width: '100%', height: 52, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  // Ya pasó y está vacío: se marca con una línea, no con color. El día que no
  // se entrenó no necesita un reproche, necesita distinguirse del que no ha
  // llegado todavía.
  barraVacia: { borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.13)' },
  barraLlena: {
    backgroundColor: Colors.neon.red,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  barraHoy: { borderColor: Colors.neon.white, borderWidth: 1.5 },
  // Una franja clara arriba: da volumen a la barra sin una sombra, que en RN
  // cuesta cara y se ve distinta en cada sistema.
  brillo: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '38%',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  dia: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3 },
  diaHoy: { color: Colors.neon.white },
})
