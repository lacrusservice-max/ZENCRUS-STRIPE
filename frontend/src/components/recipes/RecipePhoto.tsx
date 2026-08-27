/**
 * FOTO DE RECETA · ZENCRUS
 * ════════════════════════
 *
 * Marco que muestra el platillo entero, sin recortar y sin esperas.
 *
 * ── Por qué una sola capa ───────────────────────────────────────────────────
 * La versión anterior dibujaba la foto dos veces: una copia ampliada y
 * desenfocada de fondo, y la nítida encima en `contain`. El resultado era peor
 * de lo que parecía sobre el papel:
 *
 *   · Dos decodificaciones del mismo JPEG por cada tarjeta. Con una foto de
 *     1700 px eso son cientos de milisegundos por celda.
 *   · El desenfoque fuerza un submuestreo, así que la copia borrosa quedaba
 *     lista antes que la nítida. Durante ese hueco se veía la foto ampliada y
 *     movida — parecía un zoom mal hecho, y a veces se quedaba así.
 *
 * Ahora el fondo es un degradado plano y la foto se dibuja una sola vez. El
 * hueco que deja `contain` se lee como marco, no como imagen rota.
 *
 * ── Por qué expo-image ──────────────────────────────────────────────────────
 * `Image` de React Native no cachea entre montajes: al volver a una pantalla
 * vuelve a decodificar. `expo-image` guarda en memoria y disco, así que la
 * segunda vez es instantánea, y su `transition` evita el parpadeo blanco.
 */

import { View, Text, StyleSheet, DimensionValue } from 'react-native'
import { Image, type ImageSource } from '@/components/ui/Imagen'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path, G } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay, Easing,
} from 'react-native-reanimated'
import { useEffect } from 'react'
import { Colors } from '@/constants/theme'

const N = Colors.neon

interface RecipePhotoProps {
  /** Foto ya resuelta: `{uri}` del usuario o el `require` de una empaquetada. */
  source?: ImageSource | number
  /** Crédito del autor, impreso discretamente sobre la imagen. */
  credit?: string
  /** Respaldo cuando no hay foto. */
  emoji?: string
  height: number
  radius?: number
  /** Tinte de marca para unificar fotos de fuentes distintas. */
  duotone?: boolean
  /** Vapor animado, para platos que se sirven calientes. */
  steam?: boolean
  /** Degradado inferior que sostiene texto sobre la imagen. */
  scrim?: boolean
  /**
   * La primera foto visible de la pantalla. Se decodifica antes que el resto:
   * el héroe tiene que estar listo cuando la pantalla aparece, las tarjetas de
   * más abajo pueden llegar un instante después.
   */
  priority?: boolean
  children?: React.ReactNode
}

export function RecipePhoto({
  source, credit, emoji = '🍽️', height, radius = 18,
  duotone = false, steam = false, scrim = true, priority = false, children,
}: RecipePhotoProps) {
  return (
    <View style={[s.frame, { height, borderRadius: radius }]}>
      {/* Fondo del marco: barato y siempre listo, a diferencia de una copia
          desenfocada de la propia foto. */}
      <LinearGradient
        colors={['#17181c', '#0d0d10']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {source ? (
        <>
          <Image
            source={source}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            // En memoria y disco: volver a una pantalla ya no vuelve a decodificar.
            cachePolicy="memory-disk"
            priority={priority ? 'high' : 'normal'}
            // Fundido corto: sin él se ve un salto; más largo se siente lento.
            transition={140}
            recyclingKey={typeof source === 'number' ? String(source) : undefined}
          />
          {duotone && (
            <LinearGradient
              colors={['rgba(255,92,0,0.55)', 'rgba(179,61,0,0.5)', 'rgba(13,13,16,0.45)']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          )}
        </>
      ) : (
        <View style={s.blank}>
          <Text style={[s.emoji, { fontSize: Math.min(height * 0.42, 76), marginBottom: height * 0.3 }]}>
            {emoji}
          </Text>
        </View>
      )}

      {/* El vapor solo sobre fotografía: encima de un emoji plano parece un
          artefacto de render. */}
      {steam && !!source && <Steam />}

      {scrim && (
        <LinearGradient
          colors={['rgba(5,5,5,0.34)', 'rgba(5,5,5,0)', 'rgba(5,5,5,0.78)']}
          locations={[0, 0.38, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {!!credit && !!source && <Text style={s.credit}>{credit}</Text>}

      {children}
    </View>
  )
}

// ── Vapor ─────────────────────────────────────────────────────────────────────

/**
 * Tres volutas desfasadas: sin el desfase parpadearían a la vez y se leería
 * como un fallo de render, no como vapor.
 *
 * Cada voluta va en su propia vista animada en lugar de animar el `Path`: los
 * atributos de SVG no aceptan estilos de Reanimated, y mover el contenedor es
 * además más barato porque no vuelve a trazar la ruta en cada fotograma.
 */
function Steam() {
  return (
    <View style={s.steam} pointerEvents="none">
      <Curl left="38%" d="M10 22c-3.5-5 3.5-8 0-13" delay={0} />
      <Curl left="50%" d="M10 22c-3.5-5.5 3.5-9 0-14" delay={900} />
      <Curl left="62%" d="M10 22c-3.5-5 3.5-8 0-13" delay={1700} />
    </View>
  )
}

function Curl({ d, delay, left }: { d: string; delay: number; left: DimensionValue }) {
  const t = useSharedValue(0)

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 3000, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    )
  }, [delay])

  const anim = useAnimatedStyle(() => ({
    // Entra rápido y se desvanece al subir, como el vapor real.
    opacity: t.value < 0.3 ? (t.value / 0.3) * 0.8 : ((1 - t.value) / 0.7) * 0.8,
    transform: [{ translateY: -20 * t.value }],
  }))

  return (
    <Animated.View style={[s.curl, { left }, anim]} pointerEvents="none">
      <Svg width={20} height={26} viewBox="0 0 20 26">
        <G stroke="rgba(255,255,255,0.85)" strokeWidth={2.2} strokeLinecap="round" fill="none">
          <Path d={d} />
        </G>
      </Svg>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden', backgroundColor: '#0d0d10', position: 'relative' },
  blank: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  emoji: { opacity: 0.9 },
  steam: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  curl: { position: 'absolute', top: '22%' },
  // A la derecha: los títulos y las píldoras se alinean a la izquierda y abajo.
  credit: {
    position: 'absolute', right: 10, bottom: 6,
    fontSize: 7.5, color: 'rgba(255,255,255,0.32)',
    textShadowColor: 'rgba(5,5,5,0.9)', textShadowRadius: 3,
  },
})
