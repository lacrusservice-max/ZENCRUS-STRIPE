/**
 * CRONÓMETRO DE DESCANSO
 * ──────────────────────
 * Un anillo que se vacía mientras dura el descanso entre series.
 *
 * ── Cuenta contra una hora de fin ───────────────────────────────────────────
 * No resta un segundo cada segundo. iOS congela los temporizadores de una app
 * que está en segundo plano, así que un contador que resta se queda parado
 * mientras alguien contesta un mensaje y al volver marca dos minutos de menos.
 * Guardando CUÁNDO acaba, volver a la pantalla calcula lo que queda de verdad.
 * Por eso la hora de fin vive en el store y no aquí: sobrevive a salir de la
 * pantalla, que es justo lo que se hace para mirar el vídeo del ejercicio.
 *
 * ── El anillo está dibujado, no es una imagen ───────────────────────────────
 * Es un arco de SVG con el trazo recortado. Se lee de un vistazo desde el suelo
 * con la barra encima, que es la distancia real a la que se mira.
 */

import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, AppState, Vibration } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const TAMANO = 168
const GROSOR = 9
const RADIO = (TAMANO - GROSOR) / 2
const VUELTA = 2 * Math.PI * RADIO

interface Props {
  /** Momento en el que acaba, en milisegundos. */
  hasta: number
  /** Cuánto duraba en total, para saber qué fracción queda. */
  total: number
  onSaltar: () => void
  onSumar: (segundos: number) => void
}

export function RestTimer({ hasta, total, onSaltar, onSumar }: Props) {
  const [restan, setRestan] = useState(() => Math.max(0, Math.ceil((hasta - Date.now()) / 1000)))
  const yaAviso = useRef(false)

  useEffect(() => {
    yaAviso.current = false

    const recalcular = () => {
      const quedan = Math.max(0, (hasta - Date.now()) / 1000)
      setRestan(Math.ceil(quedan))

      if (quedan <= 0 && !yaAviso.current) {
        yaAviso.current = true
        // Vibración larga Y háptica: el móvil está en el suelo o en el bolsillo,
        // no mirándose. Un aviso silencioso en pantalla no lo ve nadie.
        Vibration.vibrate([0, 380, 180, 380])
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    }

    // Cien milisegundos: el anillo se mueve sin escalones y el coste es una
    // ecuación y un redibujado de un arco.
    const t = setInterval(recalcular, 100)

    // Al volver del segundo plano el intervalo puede haber estado congelado.
    // Esto vuelve a poner el número donde le toca en el primer fotograma.
    const sub = AppState.addEventListener('change', e => { if (e === 'active') recalcular() })

    recalcular()
    return () => { clearInterval(t); sub.remove() }
  }, [hasta])

  const fraccion = total > 0 ? Math.max(0, Math.min(1, (hasta - Date.now()) / (total * 1000))) : 0
  const minutos = Math.floor(restan / 60)
  const segundos = restan % 60

  // Blanco casi todo el rato y rojo en los últimos quince segundos: el color
  // solo se gasta cuando significa algo, que es «prepárate ya».
  const color = restan <= 15 ? Colors.neon.red : Colors.neon.white
  const acabado = restan <= 0

  return (
    <View style={s.wrap}>
      <View style={s.anillo}>
        <Svg width={TAMANO} height={TAMANO}>
          <Circle
            cx={TAMANO / 2} cy={TAMANO / 2} r={RADIO}
            stroke="rgba(255,255,255,0.08)" strokeWidth={GROSOR} fill="none"
          />
          <Circle
            cx={TAMANO / 2} cy={TAMANO / 2} r={RADIO}
            stroke={color} strokeWidth={GROSOR} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${VUELTA} ${VUELTA}`}
            strokeDashoffset={VUELTA * (1 - fraccion)}
            // Arranca arriba en vez de a la derecha, que es como se lee un reloj.
            transform={`rotate(-90 ${TAMANO / 2} ${TAMANO / 2})`}
          />
        </Svg>

        <View style={s.centro} pointerEvents="none">
          <Text style={[s.tiempo, { color }]}>
            {minutos > 0 ? `${minutos}:${String(segundos).padStart(2, '0')}` : segundos}
          </Text>
          <Text style={s.etiqueta}>{acabado ? 'A LA BARRA' : 'DESCANSO'}</Text>
        </View>
      </View>

      <View style={s.botones}>
        <TouchableOpacity style={s.botonSecundario} onPress={() => onSumar(30)} activeOpacity={0.75}>
          <Ionicons name="add" size={15} color={Colors.neon.w2} />
          <Text style={s.botonSecundarioTxt}>30 s</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.botonPrincipal} onPress={onSaltar} activeOpacity={0.85}>
          <Text style={s.botonPrincipalTxt}>{acabado ? 'Seguir' : 'Saltar descanso'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing[4] },
  anillo: { width: TAMANO, height: TAMANO, alignItems: 'center', justifyContent: 'center' },
  centro: { position: 'absolute', alignItems: 'center' },
  tiempo: { fontSize: 52, fontWeight: '800', letterSpacing: -1.5, lineHeight: 58 },
  etiqueta: {
    fontSize: 10, fontWeight: '700', color: Colors.neon.w3,
    letterSpacing: 2, marginTop: 2,
  },
  botones: { flexDirection: 'row', gap: Spacing[2], alignItems: 'center' },
  botonSecundario: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[3],
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  botonSecundarioTxt: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.neon.w2 },
  botonPrincipal: {
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[3],
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.paneHi,
  },
  botonPrincipalTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
})
