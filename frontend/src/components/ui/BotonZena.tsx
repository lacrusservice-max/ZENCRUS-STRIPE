/**
 * EL ACCESO A ZENA
 * ────────────────
 * Un botón flotante arriba a la derecha, en todas las pantallas de la app, que
 * lleva al chat con la coach. Debajo, su nombre alternando con lo que es.
 *
 * ── Por qué flotante y no dentro de cada cabecera ───────────────────────────
 * Porque no hay «una» cabecera: 29 pantallas usan `ScreenHeader` y las otras
 * cuarenta se dibujan cada una a su manera. Meter el botón en cada una serían
 * cincuenta y cinco ediciones distintas, con cincuenta y cinco alineaciones
 * ligeramente diferentes, y la pantalla que se añada mañana nacería sin él.
 *
 * ── Por qué nunca se desmonta ───────────────────────────────────────────────
 * En las pantallas donde no toca, el botón se APAGA —opacidad a cero y sin
 * recoger toques— pero se queda montado.
 *
 * Devolver `null` parecía lo natural y era justo lo que lo hacía tardar en
 * aparecer: al desmontarse se llevaba la imagen consigo, y al volver a entrar
 * en otra pantalla había que resolverla y decodificarla otra vez. En desarrollo,
 * con el bundle sirviéndose por un túnel, eso son segundos de retraso cada vez
 * y el botón parpadea al navegar. Montado siempre, la imagen se carga una vez y
 * ya no se mueve.
 */

import { useEffect, useRef, useState } from 'react'
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useSegments } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { LOGIN_ACTIVO } from '@/constants/acceso'
import { useAppTheme } from '@/context/ThemeContext'
import { BotonIA } from '@/constants/layout'

/**
 * Se miran los SEGMENTOS y no la ruta: `usePathname()` borra los grupos entre
 * paréntesis, así que la pantalla de alta —`app/(onboarding)/index.tsx`— se
 * vería como `/` y no habría forma de distinguirla de la portada.
 */
const GRUPOS_SIN_BOTON = ['(onboarding)', '(auth)']

/**
 * Rutas exactas donde no sale.
 *
 * Se comparan enteras a propósito: buscar un segmento llamado `chat` a secas
 * también encontraría `social/chat/[id]`, que es una conversación con otra
 * persona y sí debe poder abrir a ZENA.
 */
const RUTAS_SIN_BOTON = new Set([
  '(tabs)/chat',      // ya estás dentro
  '(tabs)/profile',
  '(tabs)/social',
])

/** Lo que se lee debajo del icono, turnándose. */
const ETIQUETAS = ['ZENA', 'Coach IA']
const CADA_MS = 2000

export function BotonZena() {
  const T = useAppTheme()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const insets = useSafeAreaInsets()
  const segmentos = useSegments()
  const escala = useRef(new Animated.Value(1)).current

  const [cual, setCual] = useState(0)
  const fundido = useRef(new Animated.Value(1)).current

  /**
   * El relevo de la etiqueta: se desvanece, se cambia la palabra y vuelve.
   *
   * El cambio ocurre con la opacidad ya en cero, así que nunca se ve una
   * palabra encima de la otra ni un salto seco a media transición.
   */
  useEffect(() => {
    const t = setInterval(() => {
      Animated.sequence([
        Animated.timing(fundido, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(fundido, { toValue: 1, duration: 260, delay: 40, useNativeDriver: true }),
      ]).start()
      setTimeout(() => setCual(i => (i + 1) % ETIQUETAS.length), 280)
    }, CADA_MS)
    return () => clearInterval(t)
  }, [])

  const ruta = segmentos.join('/')
  const visible =
    (isAuthenticated || !LOGIN_ACTIVO) &&
    !RUTAS_SIN_BOTON.has(ruta) &&
    !segmentos.some(s => GRUPOS_SIN_BOTON.includes(s))

  const pulsar = (hacia: number) =>
    Animated.spring(escala, { toValue: hacia, useNativeDriver: true, tension: 300, friction: 12 }).start()

  return (
    <View
      style={[z.wrap, { top: insets.top + 6, opacity: visible ? 1 : 0 }]}
      // Apagado no estorba: sin esto seguiría robando toques a lo que haya
      // debajo en las pantallas donde no se ve.
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <Animated.View style={{ transform: [{ scale: escala }], alignItems: 'center' }}>
        <Pressable
          onPress={() => router.push('/(tabs)/chat')}
          onPressIn={() => pulsar(0.92)}
          onPressOut={() => pulsar(1)}
          // El área táctil real es mayor que el dibujo: 44 puntos es el mínimo
          // que se puede tocar sin apuntar.
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Abrir el chat con ZENA"
        >
          {/*
            La imagen va sola, sin cristal ni borde: ya trae su propio aro de
            neón y fondo transparente. Cualquier cosa detrás le dibujaría un
            segundo círculo alrededor del suyo.
          */}
          <Image source={require('@/assets/images/zena.png')} style={z.cara} resizeMode="contain" />
        </Pressable>

        <Animated.Text
          style={[z.etiqueta, { color: T.ink3, opacity: fundido }]}
          numberOfLines={1}
        >
          {ETIQUETAS[cual]}
        </Animated.Text>
      </Animated.View>
    </View>
  )
}

const z = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: BotonIA.gap,
    // Por encima de las pantallas y por debajo de los modales, que se montan
    // en su propia capa.
    zIndex: 40,
    elevation: 40,
  },
  cara: {
    width: BotonIA.size,
    height: BotonIA.size,
  },
  etiqueta: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 1,
    // Fijo para que la caja no cambie de ancho entre «ZENA» y «Coach IA»: si
    // se encogiera, el texto bailaría de sitio en cada relevo.
    width: BotonIA.reserva + 14,
    textAlign: 'center',
  },
})
