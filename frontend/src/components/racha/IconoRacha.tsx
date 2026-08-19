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

/** El logo, vectorizado del PNG. viewBox 700×646. */
const LOGO =
  'M260,182 L576,182 L454,309 L440,318 L428,321 L373,320 L429,257 L430,253 L179,253 ' +
  'L238,190 L254,183 L260,183 Z M575,232 L517,320 L450,409 L410,453 L375,480 L344,491 ' +
  'L128,491 L279,307 L292,302 L372,301 L262,432 L262,435 L332,434 L353,427 L373,416 ' +
  'L439,367 L502,310 L575,233 Z'

/* Solo donde se puede alimentar la racha. En Salud o Perfil sería un adorno. */
const PANTALLAS = ['nutrition', 'workout']

const MARCA = 26

interface Props {
  dias: number
  /** true si el día de hoy ya cuenta. */
  encendida: boolean
}

export function IconoRacha({ dias, encendida }: Props) {
  const insets = useSafeAreaInsets()
  const segmentos = useSegments()

  if (!PANTALLAS.includes(segmentos[segmentos.length - 1] ?? '')) return null
  if (dias <= 0) return null

  return (
    <View
      style={[r.wrap, { top: insets.top + 6 }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => { tocar(); router.push('/streaks') }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Racha de ${dias} ${dias === 1 ? 'día' : 'días'}`}
        style={{ alignItems: 'center' }}
      >
        <View style={[r.caja, encendida ? r.cajaOn : r.cajaOff]}>
          <Svg width={MARCA} height={MARCA * 646 / 700} viewBox="0 0 700 646">
            <Defs>
              <LinearGradient id="fuegoIcono" x1="0" y1="1" x2="0.35" y2="0">
                <Stop offset="0" stopColor="#FF2A00" />
                <Stop offset="0.5" stopColor="#FF7A18" />
                <Stop offset="1" stopColor="#FFD36A" />
              </LinearGradient>
            </Defs>
            <Path
              d={LOGO}
              fillRule="evenodd"
              fill={encendida ? 'url(#fuegoIcono)' : 'rgba(255,255,255,0.26)'}
            />
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
  cajaOn: { backgroundColor: '#2A1206', borderColor: 'rgba(255,122,24,0.5)' },
  cajaOff: { backgroundColor: '#17171A', borderColor: 'rgba(255,255,255,0.14)' },
  dias: {
    fontSize: 14, fontWeight: '900', color: '#fff',
    fontVariant: ['tabular-nums'], letterSpacing: -0.3,
  },
  diasOff: { color: 'rgba(255,255,255,0.45)' },
})
