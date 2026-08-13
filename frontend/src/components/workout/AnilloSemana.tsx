/**
 * EL ANILLO DE LA SEMANA
 * ──────────────────────
 * Cuántos días has entrenado esta semana, cuáles, y cuánto has gastado.
 *
 * ── Siete segmentos, uno por día. No es un porcentaje ───────────────────────
 * Un anillo continuo al 57 % insinúa que hay algo que crece poco a poco. Aquí
 * no: entrenaste el martes o no lo entrenaste. Siete arcos separados se pueden
 * CONTAR de un vistazo, y además dicen CUÁNDO, que es la mitad del dato —tres
 * días seguidos y tres alternos son la misma cifra y no son lo mismo—.
 *
 * Eso es lo que ganó `TiraSemana` cuando sustituyó al anillo que había, y es lo
 * que este conserva. Lo que añade es lo que a la tira le faltaba: el objetivo
 * SALE DE TU PLAN —`days_per_week` de tu inscripción, no un 4 escrito a mano— y
 * el gasto de la semana. Por eso vuelve el anillo: no porque sea más bonito,
 * sino porque dice dos cosas más sin dejar de decir las de antes.
 *
 * ── Semana de CALENDARIO ────────────────────────────────────────────────────
 * De lunes a domingo, en el huso del teléfono. La semana del PROGRAMA avanza
 * por días completados y puede durar doce; para medir constancia eso no vale.
 * El servidor ya manda el reparto resuelto: aquí no se calcula ninguna fecha.
 *
 * ── Hoy se marca con un punto, no con color ─────────────────────────────────
 * Cada segmento contesta a UNA pregunta: ¿entrenaste ese día? Hoy sin entrenar
 * es un «no» y se pinta como un «no». Pintarlo de rojo a media luz se probó y
 * salía peor de dos formas: la mancha granate se veía MENOS que un gris
 * pendiente, y contaba una verdad a medias. Lo que marca hoy es el punto por
 * dentro y la letra encendida por fuera.
 *
 * ── Y los vacíos se DIBUJAN ─────────────────────────────────────────────────
 * A un 16 % de blanco, no a un 10 %: con 10 una semana en blanco desaparecía
 * entera y ni siquiera se veía que hubiera siete días esperando. Un anillo
 * vacío tiene que parecer algo que se quiere rellenar, no un hueco.
 *
 * Dibujado y MIRADO fuera de la app antes de entrar aquí, a tamaño real y en
 * los cuatro casos: semana en blanco, media, pasada de largo y completa.
 */

import { View, Text, StyleSheet } from 'react-native'
import Svg, { Path, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { Colors, Typography, Spacing } from '@/constants/theme'

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// El lienzo. 130 de lado deja sitio a las letras FUERA del anillo: dentro se
// peleaban con la cifra del centro y las dos se leían peor.
const LADO = 130
const C = LADO / 2
const R = 46
const GROSOR = 9
const HUECO = 5      // grados de aire entre un día y el siguiente
const PASO = 360 / 7

/** Un punto del anillo. 0° es arriba y se avanza en el sentido del reloj. */
function punto(grados: number, radio: number): [number, number] {
  const rad = (grados * Math.PI) / 180
  return [C + radio * Math.sin(rad), C - radio * Math.cos(rad)]
}

/** El arco de un día. */
function arco(i: number): string {
  const [x0, y0] = punto(i * PASO + HUECO / 2, R)
  const [x1, y1] = punto((i + 1) * PASO - HUECO / 2, R)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

const VACIO = 'rgba(255,255,255,0.16)'

interface Props {
  /** Lunes a domingo: entrenado sí o no. Lo resuelve el servidor. */
  dias: boolean[]
  /** Qué día es hoy, de 0 (lunes) a 6 (domingo). */
  hoy: number
  hechos: number
  objetivo: number
  /** De dónde sale el objetivo: de tu plan, o sugerido por no tener ninguno. */
  origen: 'plan' | 'defecto'
  /** Gasto activo acumulado de la semana. */
  kcal: number
  tamano?: number
}

export function AnilloSemana({
  dias, hoy, hechos, objetivo, origen, kcal, tamano = 148,
}: Props) {
  /**
   * Con valores por defecto y recortado a siete.
   *
   * Una pantalla entera no puede caerse porque una lista llegue corta un
   * instante —ya pasó con `TiraSemana` y un desajuste de recarga en caliente se
   * llevó Progreso por delante—. Sin datos se dibuja la semana vacía, que es
   * exactamente lo que hay que enseñar cuando no se sabe nada.
   */
  const semana = Array.from({ length: 7 }, (_, i) => dias?.[i] === true)
  const cumplido = hechos >= objetivo

  return (
    <View style={s.wrap}>
      <Svg width={tamano} height={tamano} viewBox={`0 0 ${LADO} ${LADO}`}>
        <Defs>
          <LinearGradient id="anilloHecho" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.neon.redSoft} />
            <Stop offset="1" stopColor={Colors.neon.red} />
          </LinearGradient>
        </Defs>

        {semana.map((entrenado, i) => (
          <Path
            key={i}
            d={arco(i)}
            stroke={entrenado ? 'url(#anilloHecho)' : VACIO}
            strokeWidth={GROSOR}
            strokeLinecap="round"
            fill="none"
          />
        ))}

        {/* Hoy: el punto va por DENTRO y la letra por fuera, uno a cada lado de
            la banda. Con los dos fuera se tocaban y parecían una i mayúscula. */}
        {hoy >= 0 && hoy < 7 && (() => {
          const [px, py] = punto((hoy + 0.5) * PASO, R - 9)
          return <Circle cx={px} cy={py} r={2.2} fill={Colors.neon.red} />
        })()}

        {semana.map((entrenado, i) => {
          const [x, y] = punto((i + 0.5) * PASO, R + 15)
          return (
            <SvgText
              key={`d${i}`}
              x={x}
              y={y + 2.4}
              textAnchor="middle"
              fontSize={7.5}
              fontWeight="700"
              fill={entrenado || i === hoy ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.30)'}
            >
              {DIAS[i]}
            </SvgText>
          )
        })}

        <SvgText
          x={C} y={C - 1} textAnchor="middle"
          fontSize={26} fontWeight="800" fill={Colors.neon.white}
        >
          {String(hechos)}
        </SvgText>
        <SvgText
          x={C} y={C + 11} textAnchor="middle"
          fontSize={8.5} fontWeight="600" fill={Colors.neon.w3}
        >
          {`de ${objetivo}`}
        </SvgText>
      </Svg>

      <View style={s.pie}>
        <Text style={s.titulo}>
          {cumplido ? 'Semana cumplida' : hechos === 0 ? 'Semana en blanco' : 'Vas por buen camino'}
        </Text>
        <Text style={s.sub}>
          {origen === 'plan'
            ? `${objetivo} días a la semana, los que pide tu plan`
            : `${objetivo} días a la semana, objetivo sugerido`}
        </Text>
        {/* El gasto solo aparece cuando hay algo que contar. Un «0 kcal» junto a
            una semana en blanco es ruido: ya lo dice el anillo. */}
        {kcal > 0 && (
          <Text style={s.kcal}>
            <Text style={s.kcalCifra}>{kcal.toLocaleString('es-MX')}</Text>
            <Text style={s.kcalUnidad}>{'  kcal gastadas entrenando'}</Text>
          </Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  pie: {
    flex: 1,
    gap: 3,
  },
  titulo: {
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
    color: Colors.neon.white,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.neon.w3,
    lineHeight: 16,
  },
  kcal: {
    marginTop: 4,
  },
  kcalCifra: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.neon.red,
    letterSpacing: -0.5,
  },
  kcalUnidad: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.neon.w2,
  },
})
