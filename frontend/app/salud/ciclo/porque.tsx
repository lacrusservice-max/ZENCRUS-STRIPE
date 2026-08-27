/**
 * CICLO · POR QUÉ TE DIGO ESTO
 * ═══════════════════════════════════════════════════════════════════════════
 * La explicación detrás de la recomendación de la portada.
 *
 * ── Por qué merece una pantalla ────────────────────────────────────────────
 * La tabla de síntomas tiene una columna que hasta ahora no se enseñaba en
 * ningún sitio: la fisiología. «El útero libera prostaglandinas para desprender
 * el endometrio; en exceso generan contracciones más dolorosas.» Sin eso, la
 * tarjeta dice «come semillas de calabaza» y suena a consejo de revista. Con
 * eso, se entiende por qué, y lo que se entiende se sigue.
 *
 * Y hay un segundo motivo, menos evidente: saber que el dolor tiene una causa
 * conocida y un mecanismo descrito cambia cómo se vive el día. Buena parte de
 * lo que hace pesados estos días es no saber si lo que te pasa es normal.
 *
 * ── Enseña la ficha que produjo la recomendación, no una genérica ──────────
 * La portada guarda en cada consejo la `fuente` que lo generó —un id de síntoma
 * o una fase— justamente para esto. Si la tarjeta salió de los cólicos, aquí se
 * lee sobre los cólicos; si salió de la fase, sobre la fase. Enseñar siempre la
 * fase convertiría el enlace en decorado.
 *
 * ── Y termina con lo que NO se sabe ────────────────────────────────────────
 * La nota de evidencia va al pie, siempre, sin importar qué ficha se abra.
 * Estaba escondida dentro de un prompt del servidor, así que la usuaria nunca
 * la leía: se la contaba el modelo si le apetecía. Una app que presume de ser
 * honesta con su nivel de evidencia tiene que enseñarlo donde se toman las
 * decisiones, no en su documentación interna.
 */

import { useLocalSearchParams, router } from 'expo-router'
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import {
  SINTOMA_POR_ID, FASES, NOTA_EVIDENCIA,
} from '@/nucleo/ciclo/recomendaciones'
import type { Fase } from '@/nucleo/ciclo/fases'
import { Pantalla, Tarjeta, Azulejo } from '@/components/salud/ciclo/Claro'
import { ALTO_BARRA } from '@/components/salud/ciclo/BarraCiclo'
import {
  FONDO, FASE, ACENTO, TEXTO, FUENTE, SUP, HUECO,
} from '@/theme/salud/cicloClaro'
import { elegir } from '@/utils/haptica'

const ES_FASE = (x: string): x is Fase =>
  x === 'menstrual' || x === 'folicular' || x === 'ovulatoria' || x === 'lutea'

interface Bloque { rotulo: string; texto: string }

export default function PorQue() {
  const { fuente } = useLocalSearchParams<{ fuente?: string }>()
  const id = fuente ?? ''

  const ficha = SINTOMA_POR_ID.get(id)
  const esFase = ES_FASE(id)

  const titulo = ficha?.etiqueta
    ?? (esFase ? `Fase ${FASES[id].etiqueta.toLowerCase()}` : 'Por qué te digo esto')

  const color = esFase ? FASE[id].arco : ACENTO.rojo

  const bloques: Bloque[] = ficha
    ? [
      { rotulo: 'Por qué pasa', texto: ficha.fisiologia },
      { rotulo: 'Qué comer', texto: ficha.nutricion },
      {
        rotulo: 'Cómo moverte',
        /* Dos fichas no tienen recomendación de movimiento, y se dice. Poner
           una frase genérica de relleno para que la sección no quede coja es
           inventarse un consejo que nadie respalda. */
        texto: ficha.entrenamiento
          ?? 'Para esto no hay una recomendación de movimiento con respaldo suficiente. '
            + 'Mejor guiarte por cómo te sientes hoy.',
      },
    ]
    : esFase
      ? [
        { rotulo: 'Qué pasa con tus hormonas', texto: FASES[id].hormonas },
        { rotulo: 'Qué favorece esta fase', texto: FASES[id].favorece },
        { rotulo: 'Qué comer', texto: FASES[id].comer },
        { rotulo: 'Cómo moverte', texto: FASES[id].entrenar },
      ]
      : []

  return (
    <Pantalla salida={false} fondo={FONDO.registro}>
      <View style={s.cab}>
        <Pressable
          onPress={() => { elegir(); router.back() }}
          style={({ pressed }) => [s.redondo, pressed && s.pulsado]}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Text style={s.flecha}>‹</Text>
        </Pressable>
        <Text style={s.cabTit} numberOfLines={2}>{titulo}</Text>
        <View style={s.hueco} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: ALTO_BARRA + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {bloques.length ? (
          bloques.map(b => (
            <Tarjeta key={b.rotulo} style={s.tarjeta}>
              <View style={s.filaRotulo}>
                <View style={[s.punto, { backgroundColor: color }]} />
                <Text style={s.rotulo}>{b.rotulo}</Text>
              </View>
              <Text style={s.texto}>{b.texto}</Text>
            </Tarjeta>
          ))
        ) : (
          <Text style={s.texto}>
            No encuentro de dónde salió esa recomendación. Vuelve a la portada y
            tócala otra vez.
          </Text>
        )}

        <View style={s.evidencia}>
          <Azulejo icono="stats_insight" fondo={SUP.tarjeta} tam={38} />
          <View style={s.flex}>
            <Text style={s.evidenciaTit}>Hasta dónde llega lo que se sabe</Text>
            <Text style={s.evidenciaTxt}>{NOTA_EVIDENCIA}</Text>
          </View>
        </View>
      </ScrollView>
    </Pantalla>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  cab: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10,
  },
  redondo: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SUP.tarjeta,
  },
  hueco: { width: 46, height: 46 },
  pulsado: { opacity: 0.7 },
  flecha: { fontFamily: FUENTE.titulo, fontSize: 26, color: TEXTO.fuerte, marginTop: -3 },
  cabTit: {
    flex: 1, textAlign: 'center',
    fontFamily: FUENTE.titulo, fontSize: 17, color: TEXTO.fuerte,
  },

  scroll: { paddingHorizontal: 20, gap: HUECO.md },

  tarjeta: { gap: 9 },
  filaRotulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  punto: { width: 9, height: 9, borderRadius: 5 },
  rotulo: {
    fontFamily: FUENTE.fuerte, fontSize: 11, letterSpacing: 0.6,
    color: TEXTO.medio, textTransform: 'uppercase',
  },
  texto: {
    fontFamily: FUENTE.cuerpo, fontSize: 14.5, lineHeight: 22, color: TEXTO.fuerte,
  },

  evidencia: {
    flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20,
    backgroundColor: ACENTO.moradoFondo, marginTop: 4,
  },
  evidenciaTit: { fontFamily: FUENTE.fuerte, fontSize: 13.5, color: TEXTO.fuerte },
  evidenciaTxt: {
    fontFamily: FUENTE.cuerpo, fontSize: 12.5, lineHeight: 19,
    color: '#5B4B86', marginTop: 4,
  },
})
