/**
 * ZONAS DEL CUERPO, CON FOTOGRAFÍA
 * ────────────────────────────────
 * Las ocho zonas por las que se elige un entrenamiento, cada una con su imagen.
 *
 * ── Sustituyen a los iconos anatómicos ──────────────────────────────────────
 * La versión anterior dibujaba una figura por zona con el músculo encendido.
 * Era ingeniosa y era un diagrama: ocho monigotes casi iguales que hay que leer
 * uno por uno. Una fotografía se reconoce antes de terminar de mirarla, y ocho
 * fotografías distintas se distinguen de un vistazo sin leer una etiqueta.
 *
 * ── La foto de cada zona NO cambia ──────────────────────────────────────────
 * Fija por zona, siempre la misma. La gente vuelve a un sitio por su aspecto
 * antes que por su nombre: si la tarjeta de «Pecho» cambiara de foto cada vez,
 * habría que leer las ocho etiquetas en cada visita.
 *
 * ── La grande manda ─────────────────────────────────────────────────────────
 * «Todo el cuerpo» ocupa el doble que las demás. Es la opción por defecto para
 * quien no sabe qué elegir, que es la mayoría de los días, y ponerla del mismo
 * tamaño que las otras siete la esconde entre ellas.
 */

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated'
import { FOTOS, FOTO_REGION } from '@/constants/imagenes'
import { Colors, Typography, Spacing } from '@/constants/theme'

const Muelle = { damping: 15, stiffness: 190, mass: 0.6 }

export interface Zona {
  id: string
  label: string
  /** Lo que se dice debajo: para qué sirve, no qué músculos toca. */
  pie: string
  /** Ocupa la fila entera. */
  ancha?: boolean
}

export const ZONAS: Zona[] = [
  { id: 'fullbody', label: 'Cuerpo entero', pie: 'Lo más equilibrado si no sabes qué toca', ancha: true },
  { id: 'upper',    label: 'Tren superior', pie: 'Pecho, espalda y hombros' },
  { id: 'legs',     label: 'Pierna',        pie: 'Glúteo, cuádriceps y femoral' },
  { id: 'chest',    label: 'Pecho',         pie: 'Empuje horizontal' },
  { id: 'back',     label: 'Espalda',       pie: 'Tracción y postura' },
  { id: 'arms',     label: 'Brazos',        pie: 'Bíceps y tríceps' },
  { id: 'shoulders',label: 'Hombros',       pie: 'Deltoides y manguito' },
  { id: 'core',     label: 'Core',          pie: 'Abdomen y lumbares' },
]

export function RegionCards({ elegida, onElegir }: {
  elegida: string | null
  onElegir: (z: Zona) => void
}) {
  return (
    <View style={s.rejilla}>
      {ZONAS.map((z, i) => (
        <Animated.View
          key={z.id}
          entering={FadeInDown.delay(i * 55).duration(360)}
          style={z.ancha ? s.slotAncho : s.slot}
        >
          <Tarjeta zona={z} activa={elegida === z.id} onPress={() => onElegir(z)} />
        </Animated.View>
      ))}
    </View>
  )
}

function Tarjeta({ zona, activa, onPress }: { zona: Zona; activa: boolean; onPress: () => void }) {
  const presion = useSharedValue(0)
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: 1 - presion.value * 0.035 }] }))

  const foto = FOTOS[FOTO_REGION[zona.id] ?? 'gimnasio']?.fuente

  return (
    <Animated.View style={estilo}>
      <Pressable
        onPressIn={() => { presion.value = withSpring(1, Muelle) }}
        onPressOut={() => { presion.value = withSpring(0, Muelle) }}
        onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress() }}
        style={[
          s.tarjeta,
          zona.ancha ? s.tarjetaAncha : s.tarjetaAlta,
          activa && s.tarjetaActiva,
        ]}
      >
        <Image source={foto} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        <LinearGradient
          colors={activa
            ? ['rgba(255,31,61,0.30)', 'rgba(5,5,6,0.92)']
            : ['rgba(5,5,6,0.20)', 'rgba(5,5,6,0.90)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={s.texto}>
          <Text style={s.label} numberOfLines={1}>{zona.label}</Text>
          <Text style={[s.pie, zona.ancha && { fontSize: 11 }]} numberOfLines={2}>{zona.pie}</Text>
        </View>

        {/* La marca de elegida es un punto, no un borde de color: un borde
            rojo sobre una foto ya roja no se ve. */}
        {activa && <View style={s.marca} />}
      </Pressable>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  slot: { width: '47.5%' },
  slotAncho: { width: '100%' },

  tarjeta: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    justifyContent: 'flex-end',
    backgroundColor: Colors.neon.void,
  },
  tarjetaAlta: { height: 118 },
  tarjetaAncha: { height: 128 },
  tarjetaActiva: { borderColor: 'rgba(255,255,255,0.55)' },

  texto: { padding: Spacing[3] },
  label: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  pie: { fontSize: 10, color: Colors.neon.w2, marginTop: 1, lineHeight: 13 },

  marca: {
    position: 'absolute', top: 10, right: 10,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.neon.white,
  },
})
