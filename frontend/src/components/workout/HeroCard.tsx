/**
 * TARJETA HÉROE
 * ─────────────
 * La pieza grande: un programa o una colección, con su imagen, sus cuatro datos
 * y su botón. Es lo primero que se ve al entrar en Entrena.
 *
 * ── La imagen sale de TU catálogo, no de un banco de fotos ──────────────────
 * El fondo se compone con los pósters reales de los ejercicios que contiene:
 * las figuras anatómicas grises con el músculo en rojo. Tres motivos, y el
 * tercero es el que importa:
 *
 *   1 · Son tuyos. Cero riesgo de licencias en una app con pasarela de pago.
 *   2 · Coinciden con la marca sin retocar nada: gris y rojo ya son ZENCRUS.
 *   3 · Son ESPECÍFICOS. La tarjeta de un programa de empuje enseña press y
 *       fondos de verdad; una foto de archivo de un señor sin camiseta podría
 *       ir delante de cualquier cosa, y por eso no dice nada.
 *
 * ── Los pósters vienen de fondo claro y esto es una app negra ───────────────
 * Puestos tal cual, un collage de tres imágenes blancas es una linterna en
 * medio de la pantalla. Van al 32 % bajo un velo negro y un tinte rojo: se
 * reconoce el movimiento, se lee el texto encima y el conjunto sigue siendo
 * oscuro.
 *
 * ── Las cuatro cifras ───────────────────────────────────────────────────────
 * Tiempo, nivel, zona y material. Son las cuatro preguntas que decide alguien
 * ANTES de tocar nada: cuánto me lleva, si me viene grande, qué trabajo y si
 * necesito algo que no tengo. Una tarjeta que no las contesta obliga a entrar
 * para descartar.
 */

import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, Extrapolation, SharedValue,
} from 'react-native-reanimated'
import { ImageSourcePropType } from 'react-native'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const MuelleSuave = { damping: 15, stiffness: 180, mass: 0.6 }

export interface DatoHero {
  icono: keyof typeof Ionicons.glyphMap
  valor: string
  etiqueta: string
}

interface Props {
  badge?: string
  titulo: string
  subtitulo?: string
  datos: DatoHero[]
  cta: string
  onPress: () => void
  /**
   * Fotografía de marca, ya tratada con el duotono. Es lo PRIMERO que se busca:
   * una foto de verdad manda sobre un collage de fichas, y como va empaquetada
   * aparece sin esperar a la red.
   */
  foto?: ImageSourcePropType
  /** URLs firmadas de pósters del catálogo. El respaldo cuando no hay foto. */
  posters?: (string | null)[]
  /** Progreso 0..1. Si va, se dibuja una barra fina bajo el título. */
  avance?: number
  alto?: number
  /**
   * Desplazamiento vertical de la lista que la contiene. Si llega, la imagen se
   * mueve más despacio que la tarjeta y se gana profundidad sin una sola
   * imagen extra.
   */
  scroll?: SharedValue<number>
  /** A qué altura de la lista está, para calcular su parallax. */
  offsetY?: number
}

export function HeroCard({
  badge, titulo, subtitulo, datos, cta, onPress,
  foto, posters = [], avance, alto = 340, scroll, offsetY = 0,
}: Props) {
  const presion = useSharedValue(0)

  // Muelle al pulsar. Un `activeOpacity` apaga la tarjeta; un muelle la hunde,
  // que es lo que hace un botón físico y lo que el pulgar espera.
  const estiloPresion = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - presion.value * 0.022 }],
  }))

  const estiloParallax = useAnimatedStyle(() => {
    if (!scroll) return {}
    const rel = scroll.value - offsetY
    return {
      transform: [{
        translateY: interpolate(rel, [-alto, alto], [-24, 24], Extrapolation.CLAMP),
      }, {
        // Un pelín de zoom para que el desplazamiento no descubra los bordes.
        scale: 1.14,
      }],
    }
  })

  const usables = posters.filter((p): p is string => !!p).slice(0, 3)

  return (
    <Animated.View style={estiloPresion}>
      <Pressable
        onPressIn={() => { presion.value = withSpring(1, MuelleSuave) }}
        onPressOut={() => { presion.value = withSpring(0, MuelleSuave) }}
        onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress() }}
        style={[s.marco, { height: alto }]}
      >
        {/* ── Fondo ──────────────────────────────────────────────────────── */}
        <Animated.View style={[StyleSheet.absoluteFill, estiloParallax]}>
          {foto ? (
            // La foto va casi entera: ya viene oscurecida y con viñeta del
            // proceso, así que aquí no hace falta apagarla otra vez.
            <Image source={foto} style={{ flex: 1, opacity: 0.92 }} contentFit="cover" transition={280} />
          ) : usables.length > 0 ? (
            <View style={s.collage}>
              {usables.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri }}
                  style={[
                    s.trozo,
                    // El del medio manda: más ancho y sin recortar por arriba.
                    i === 1 && { flex: 1.5 },
                  ]}
                  contentFit="cover"
                  transition={240}
                />
              ))}
            </View>
          ) : (
            // Sin pósters, el fondo se genera: dos degradados cruzados. Nunca
            // hay un hueco gris esperando a que llegue una imagen.
            <View style={s.generado}>
              <LinearGradient
                colors={['#2A0A12', '#12060A', '#050506']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(255,31,61,0.35)', 'transparent']}
                start={{ x: 0.9, y: 0 }} end={{ x: 0.2, y: 0.8 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          )}
        </Animated.View>

        {/* Velo: sin esto el texto blanco sobre pósters claros no se lee. */}
        <LinearGradient
          colors={['rgba(5,5,6,0.40)', 'rgba(5,5,6,0.78)', 'rgba(5,5,6,0.97)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(255,31,61,0.22)', 'transparent']}
          start={{ x: 1, y: 0 }} end={{ x: 0.15, y: 0.7 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* ── Contenido ──────────────────────────────────────────────────── */}
        <View style={s.dentro}>
          {badge ? (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{badge.toUpperCase()}</Text>
            </View>
          ) : <View />}

          <View style={{ gap: Spacing[3] }}>
            <View>
              <Text style={s.titulo}>{titulo}</Text>
              {subtitulo ? <Text style={s.subtitulo}>{subtitulo}</Text> : null}
            </View>

            {avance !== undefined && (
              <View style={s.barra}>
                <View style={[s.barraLlena, { width: `${Math.round(Math.max(0, Math.min(1, avance)) * 100)}%` }]} />
              </View>
            )}

            {/* Rejilla 2×2. Dos filas de dos y no una de cuatro: en un móvil,
                cuatro columnas dejan cada dato en dos líneas partidas. */}
            <View style={s.datos}>
              {datos.slice(0, 4).map((d, i) => (
                <View key={i} style={s.dato}>
                  <View style={s.datoIcono}>
                    <Ionicons name={d.icono} size={14} color={Colors.neon.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.datoValor} numberOfLines={1}>{d.valor}</Text>
                    <Text style={s.datoEtiqueta} numberOfLines={1}>{d.etiqueta}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={s.cta}>
              <Text style={s.ctaTxt}>{cta}</Text>
              <View style={s.ctaFlecha}>
                <Ionicons name="arrow-forward" size={16} color={Colors.neon.void} />
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
}

// ── Tarjeta de colección ─────────────────────────────────────────────────────

/**
 * La hermana pequeña: para carruseles de colecciones.
 *
 * Sin rejilla de datos —no cabe— pero con la misma composición de fondo, para
 * que una fila de colecciones y el héroe se lean como la misma familia.
 */
export function ColeccionCard({ titulo, cuenta, foto, posters = [], onPress, ancho = 220 }: {
  titulo: string
  cuenta: string
  foto?: ImageSourcePropType
  posters?: (string | null)[]
  onPress: () => void
  ancho?: number
}) {
  const presion = useSharedValue(0)
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: 1 - presion.value * 0.03 }] }))
  const usables = posters.filter((p): p is string => !!p).slice(0, 2)

  return (
    <Animated.View style={estilo}>
      <Pressable
        onPressIn={() => { presion.value = withSpring(1, MuelleSuave) }}
        onPressOut={() => { presion.value = withSpring(0, MuelleSuave) }}
        onPress={() => { void Haptics.selectionAsync(); onPress() }}
        style={[c.marco, { width: ancho }]}
      >
        <View style={c.fondo}>
          {foto ? (
            <Image source={foto} style={{ flex: 1, opacity: 0.9 }} contentFit="cover" transition={240} />
          ) : usables.length > 0 ? (
            <View style={{ flex: 1, flexDirection: 'row' }}>
              {usables.map((uri, i) => (
                <Image key={i} source={{ uri }} style={{ flex: 1, opacity: 0.34 }} contentFit="cover" transition={200} />
              ))}
            </View>
          ) : (
            <LinearGradient
              colors={['#2A0A12', '#0C0508']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(5,5,6,0.94)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>

        <View style={c.pie}>
          <Text style={c.cuenta}>{cuenta.toUpperCase()}</Text>
          <Text style={c.titulo} numberOfLines={2}>{titulo}</Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  marco: {
    borderRadius: 26, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: Colors.neon.void,
  },
  /**
   * 0,45 tras probarlo en pantalla.
   *
   * A 0,32 los pósters se leían como textura y la tarjeta parecía un degradado
   * con ruido; por encima de 0,55 el fondo claro de las fichas se come el texto
   * blanco. Aquí se reconoce el movimiento y el título sigue teniendo contraste.
   */
  collage: { flex: 1, flexDirection: 'row', opacity: 0.45 },
  trozo: { flex: 1, height: '100%' },
  generado: { flex: 1 },

  dentro: { flex: 1, justifyContent: 'space-between', padding: Spacing[4] },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing[3], paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  badgeTxt: { fontSize: 9.5, fontWeight: '800', color: Colors.neon.void, letterSpacing: 1.1 },

  titulo: {
    fontSize: 30, fontWeight: '800', color: Colors.neon.white,
    letterSpacing: -0.8, lineHeight: 34,
  },
  subtitulo: { fontSize: Typography.fontSize.sm, color: Colors.neon.w2, marginTop: 4, lineHeight: 19 },

  barra: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  barraLlena: { height: 3, borderRadius: 2, backgroundColor: Colors.neon.red },

  datos: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing[3] },
  dato: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: Spacing[2], paddingRight: Spacing[2] },
  datoIcono: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  datoValor: { fontSize: 13, fontWeight: '800', color: Colors.neon.white },
  datoEtiqueta: { fontSize: 10, color: Colors.neon.w3, marginTop: -1 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.neon.white,
    borderRadius: BorderRadius.full,
    paddingLeft: Spacing[5], paddingRight: 5, paddingVertical: 5,
  },
  ctaTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.void },
  ctaFlecha: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neon.redCore,
  },
})

const c = StyleSheet.create({
  marco: {
    height: 168, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: Colors.neon.void,
  },
  fondo: { ...StyleSheet.absoluteFillObject },
  pie: { flex: 1, justifyContent: 'flex-end', padding: Spacing[3], gap: 2 },
  cuenta: { fontSize: 9, fontWeight: '800', color: Colors.neon.red, letterSpacing: 1.2 },
  titulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white, lineHeight: 20 },
})
