/**
 * EL ACCESO AL PERFIL
 * ───────────────────
 * Un botón flotante arriba a la derecha, en todas las pantallas de la app, que
 * lleva al perfil. Ocupa el sitio que antes tenía ZENA.
 *
 * ── Por qué el perfil dejó de ser pestaña ───────────────────────────────────
 * Porque en la píldora de abajo hay que meter seis cosas —cuatro destinos, la
 * coach y el perfil— y solo caben cinco sin que se aprieten. ZENA se queda en
 * la barra, elevada y en el eje; el perfil, que es a donde menos se entra,
 * sube aquí. La decisión se tomó comparando maquetas, no de oído.
 *
 * ── Por qué flotante y no dentro de cada cabecera ───────────────────────────
 * El mismo motivo que tenía `BotonZena`, y sigue valiendo: no hay «una»
 * cabecera. 41 pantallas usan `ScreenHeader` y el resto se dibuja cada una a
 * su manera. Aquí se monta una vez, en `app/_layout.tsx`, y la pantalla que se
 * añada mañana nace con él.
 *
 * ── Por qué nunca se desmonta ───────────────────────────────────────────────
 * En las pantallas donde no toca se APAGA —opacidad a cero y sin recoger
 * toques— pero se queda montado, para no rehacer el trazado en cada
 * navegación.
 *
 * ── Por qué la inicial y no la foto ─────────────────────────────────────────
 * La foto vive en el perfil social (`socialService`), que es una consulta a
 * red. Este botón está en todas las pantallas desde el primer fotograma: si
 * dependiera de esa consulta, parpadearía en cada arranque. La inicial sale
 * del usuario que ya está en memoria y no tarda nada.
 */

import { useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useSegments } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { LOGIN_ACTIVO } from '@/constants/acceso'
import { useAppTheme } from '@/context/ThemeContext'
import { BotonIA } from '@/constants/layout'
import { Typography } from '@/constants/theme'

/**
 * Se miran los SEGMENTOS y no la ruta: `usePathname()` borra los grupos entre
 * paréntesis, así que la pantalla de alta —`app/(onboarding)/index.tsx`— se
 * vería como `/` y no habría forma de distinguirla de la portada.
 */
/**
 * Grupos enteros donde no sale, con todo lo que cuelgue de ellos.
 *
 * `social` está aquí porque Comunidad ES otra cuenta: dentro se navega entre
 * perfiles ajenos, chats y publicaciones, y un botón con MI inicial flotando
 * en la esquina se lee como si fuera el perfil que estás mirando. En el chat
 * llegaba a montarse encima del «⋯» de bloquear.
 */
const GRUPOS_SIN_BOTON = ['(onboarding)', '(auth)', 'social']

/**
 * Rutas exactas donde no sale.
 *
 * Se comparan enteras a propósito: buscar un segmento llamado `profile` a
 * secas también encontraría `social/profile/[id]`, que es el perfil de OTRA
 * persona y desde ahí sí se quiere poder volver al propio.
 *
 * ── Por qué estas tres y no otras ───────────────────────────────────────────
 * Son las que dibujan su cabecera a mano y ya ponen algo en esa esquina, sin
 * reservar los 44 puntos de `BotonIA.reserva`. Sin excluirlas quedan dos
 * botones exactamente uno encima del otro: el de arriba es este, translúcido,
 * así que se ve el de debajo asomando y se toca el que no era. Pasa en el
 * chat, donde cae sobre el botón de redactar, y en Social, sobre la foto de
 * perfil. Era la misma lista que tenía `BotonZena` cuando ocupaba este sitio.
 */
const RUTAS_SIN_BOTON = new Set([
  '(tabs)/profile',   // ya estás dentro
  '(tabs)/social',
  '(tabs)/chat',
  'settings',
  // Una sesión en marcha pide la pantalla entera: mientras cuentas cinco
  // minutos de respiración, un acceso al perfil flotando en la esquina es
  // justo la invitación a irse que la pantalla trata de no dar.
  'salud/sesion',
  'salud/habito',
])

/**
 * Y las secciones enteras que dibujan su propia cabecera.
 *
 * El ciclo son ocho rutas y cada una pone algo en esa esquina —la campana en
 * Inicio, el selector 3M/6M/1A en Estadísticas, la lupa en Comunidad—. Con
 * coincidencia exacta habría que acordarse de añadir cada pantalla nueva a la
 * lista de arriba; por prefijo, la novena nace ya sin el botón encima.
 */
const RAMAS_SIN_BOTON = ['salud/ciclo']

/** La letra del botón: nombre, y si no hay, correo. */
function inicialDe(nombre?: string, correo?: string) {
  const fuente = (nombre ?? '').trim() || (correo ?? '').trim()
  return (fuente[0] ?? '?').toUpperCase()
}

/**
 * ¿Está ocupada la esquina de arriba a la derecha?
 *
 * La preguntan dos sitios: este botón, para pintarse o no, y `ScreenHeader`,
 * para decidir si deja el hueco libre. Está aquí y no duplicada porque cuando
 * las dos respuestas dejaron de ir a la par —al sacar el botón de Comunidad—
 * las cabeceras de esa sección se quedaron reservando sitio para nadie, y su
 * rueda de ajustes no llegaba al borde.
 */
export function useEsquinaOcupada(): boolean {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const segmentos = useSegments()
  const ruta = segmentos.join('/')
  return (
    (isAuthenticated || !LOGIN_ACTIVO) &&
    !RUTAS_SIN_BOTON.has(ruta) &&
    !RAMAS_SIN_BOTON.some(r => ruta === r || ruta.startsWith(`${r}/`)) &&
    !segmentos.some(s => GRUPOS_SIN_BOTON.includes(s))
  )
}

export function BotonPerfil() {
  const T = useAppTheme()
  const user = useAuthStore(s => s.user)
  const insets = useSafeAreaInsets()
  const escala = useRef(new Animated.Value(1)).current

  const visible = useEsquinaOcupada()

  const pulsar = (hacia: number) =>
    Animated.spring(escala, { toValue: hacia, useNativeDriver: true, tension: 300, friction: 12 }).start()

  return (
    <View
      style={[p.wrap, { top: insets.top + 6, opacity: visible ? 1 : 0 }]}
      // Apagado no estorba: sin esto seguiría robando toques a lo que haya
      // debajo en las pantallas donde no se ve.
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <Animated.View style={{ transform: [{ scale: escala }] }}>
        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          onPressIn={() => pulsar(0.92)}
          onPressOut={() => pulsar(1)}
          // El área táctil real es mayor que el dibujo: 44 puntos es el mínimo
          // que se puede tocar sin apuntar.
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Abrir tu perfil"
        >
          <View style={[p.disco, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
            <Text style={[p.letra, { color: T.ink2 }]}>
              {inicialDe(user?.full_name, user?.email)}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const p = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: BotonIA.gap,
    zIndex: 50,
    elevation: 50,
    alignItems: 'center',
  },
  disco: {
    width: BotonIA.size,
    height: BotonIA.size,
    borderRadius: BotonIA.size / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letra: {
    fontFamily: Typography.fontFamily.display,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0.5,
  },
})
