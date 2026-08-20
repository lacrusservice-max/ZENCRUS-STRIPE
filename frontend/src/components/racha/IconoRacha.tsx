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
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BotonIA } from '@/constants/layout'
import { tocar } from '@/utils/haptica'
import { hitoDe } from '@/constants/hitosRacha'

/**
 * Una llama, no el logo.
 *
 * El logo de ZENCRUS identifica la marca, no la idea: en la cabecera, junto al
 * avatar de ZENA, dos marcas de la casa a tres centímetros no dicen qué es cada
 * una. Una llama se entiende sin leer nada — es el signo universal de racha, y
 * además es literalmente lo que hace el personaje del vídeo.
 *
 * Trazada a mano sobre retícula de 24: cuerpo asimétrico con la punta cayendo a
 * la derecha —una llama simétrica parece una gota— y un corazón interior que se
 * recorta para dar profundidad a 26 px, que es donde se ve.
 */
const LLAMA =
  'M13.4 1.2c.5 3.4-.9 4.6-2.3 6.4-1.5 1.9-3.2 4-3.2 7.2 0 3.9 2.8 6.9 6.1 6.9' +
  's6.1-2.7 6.1-6.6c0-2.4-1-4.3-2.1-5.9-.4 1.3-1.2 2.2-2.2 2.5.8-3.4-.4-7.3-2.4-10.5z'
const CORAZON =
  'M13.1 10.9c.3 2 .9 2.7 1.7 3.9.5.8.8 1.6.8 2.5 0 1.7-1.2 2.9-2.6 2.9' +
  's-2.6-1.2-2.6-3c0-1.9 1.5-3.1 2.7-6.3z'

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
          <Svg width={MARCA} height={MARCA} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id="fuegoIcono" x1="0" y1="1" x2="0.35" y2="0">
                <Stop offset="0" stopColor={hito.neon} />
                <Stop offset="1" stopColor={hito.claro} />
              </LinearGradient>
            </Defs>
            <Path d={LLAMA} fill={encendida ? 'url(#fuegoIcono)' : 'rgba(255,255,255,0.26)'} />
            {/* El corazón va del color del fondo, no blanco: así el hueco se lee
                como profundidad y no como una segunda llama pegada dentro. */}
            <Path d={CORAZON} fill={encendida ? hito.fondo : '#17171A'} opacity={encendida ? 1 : 0.85} />
          </Svg>
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
