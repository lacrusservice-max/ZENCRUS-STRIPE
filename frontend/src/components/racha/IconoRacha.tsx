/**
 * LA RACHA, JUNTO A ZENA
 * ══════════════════════
 * Tu marca en pequeño con los días al lado. Flota en la misma fila que el botón
 * de ZENA, a su izquierda, y solo en Nutrición y Entrena — que son las dos
 * pantallas donde se hace algo que alimenta la racha.
 *
 * ── El trazado es tu logo de verdad ─────────────────────────────────────────
 * Sale de vectorizar `logo-blanco.png`: la misma silueta, 373 bytes, nítida a
 * cualquier tamaño. Un PNG de 40 px se vería blando en pantallas @3x, y uno
 * grande escalado hacia abajo pesaría de más para lo poco que ocupa.
 *
 * ── Encendida y apagada ─────────────────────────────────────────────────────
 * En fuego cuando el día ya cuenta; en gris cuando aún no se ha hecho nada hoy.
 * La diferencia se lee al vuelo y convierte la cabecera en un recordatorio que
 * no dice nada: no hay texto que leer, solo una marca que está apagada.
 *
 * Ojo con esto —y por eso el número cambia de color con ella—: una racha viva
 * pintada en gris puede leerse como «la perdiste». Lo que está apagado es el
 * DÍA DE HOY, no la racha; el número sigue ahí, y sigue siendo el tuyo.
 */

import { Pressable, View, Text, StyleSheet } from 'react-native'
import { useSegments, router } from 'expo-router'
import { Llama } from './Llama'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BotonIA } from '@/constants/layout'
import { tocar } from '@/utils/haptica'
import { hitoDe } from '@/constants/hitosRacha'

/* Solo donde se puede alimentar la racha. En Salud o Perfil sería un adorno. */
const PANTALLAS = ['nutrition', 'workout']

const MARCA = 19

interface Props {
  dias: number
  /** true si el día de hoy ya cuenta. */
  encendida: boolean
  /** Pulsación larga: vuelve a poner la celebración, sin gastar el día. */
  onRepetir?: () => void
}

export function IconoRacha({ dias, encendida, onRepetir }: Props) {
  const insets = useSafeAreaInsets()
  const segmentos = useSegments()
  /* El icono lleva el color del hito al que has llegado: rojo al empezar, azul
     a los 100, morado a los 200… El mismo tono que tendrá la celebración. */
  const hito = hitoDe(dias)

  if (!PANTALLAS.includes(segmentos[segmentos.length - 1] ?? '')) return null
  if (dias <= 0) return null

  return (
    <View
      style={[r.wrap, { top: insets.top + 6 }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => { tocar(); router.push('/streaks') }}
        onLongPress={() => { if (onRepetir) { tocar(); onRepetir() } }}
        delayLongPress={450}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Racha de ${dias} ${dias === 1 ? 'día' : 'días'}`}
        style={{ alignItems: 'center' }}
      >
        <View style={[
          r.caja,
          encendida
            ? { backgroundColor: hito.fondo, borderColor: hito.neon + '80' }
            : r.cajaOff,
        ]}>
          <Llama
            tam={MARCA}
            neon={hito.neon}
            claro={hito.claro}
            apagada={!encendida}
            fondo={encendida ? hito.fondo : '#17171A'}
          />
          <Text style={[r.dias, !encendida && r.diasOff]}>{dias}</Text>
        </View>
      </Pressable>
    </View>
  )
}

const r = StyleSheet.create({
  wrap: {
    position: 'absolute',
    /* A la izquierda de ZENA, con el mismo aire que ZENA deja con el borde. */
    right: BotonIA.gap + BotonIA.size + 10,
    zIndex: 40,
    elevation: 40,
  },
  caja: {
    height: BotonIA.size,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: BotonIA.size / 2,
    borderWidth: 1,
  },
  /* OPACOS a propósito. Esto flota sobre el scroll: con fondo translúcido se
     leía a través el texto de la tarjeta que pasa por debajo, y la palabra
     «RACHA» se cruzaba con las kcal de la comida. Lo que flota, tapa. */
  cajaOn: { borderWidth: 1 },
  cajaOff: { backgroundColor: '#17171A', borderColor: 'rgba(255,255,255,0.14)' },
  dias: {
    fontSize: 14, fontWeight: '900', color: '#fff',
    fontVariant: ['tabular-nums'], letterSpacing: -0.3,
  },
  diasOff: { color: 'rgba(255,255,255,0.45)' },
})
