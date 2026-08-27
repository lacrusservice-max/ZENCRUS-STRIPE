import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator, Image, Easing,
  PanResponder,
} from 'react-native'
import { Tabs, Redirect, router, useSegments } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { COBRO_ACTIVO, LOGIN_ACTIVO } from '@/constants/acceso'
import { useAuthStore } from '@/store/authStore'
import { Colors, Glass } from '@/constants/theme'
import { getCurrentSubscription } from '@/services/stripeService'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemeStore } from '@/store/themeStore'
import { useSocialStore } from '@/store/socialStore'
import { useMenuBarra } from '@/store/menuBarraStore'
import { Badge } from '@/components/social/Bits'
import { sitioDe, entradasDeMenu, type EntradaDeMenu, type DestinoApp } from '@/constants/menusDeSeccion'
import { final } from '@/theme/remap'
import { tocar } from '@/utils/haptica'

// Colores propios del tema claro para la barra: vidrio esmerilado claro con los
// iconos en el azul de marca. Van marcados con `final()` porque ya pertenecen al
// tema claro y el interceptor de color no debe volver a convertirlos.
const LIGHT_TAB = {
  scrim:     final('rgba(255,255,255,0.72)'),
  border:    final('rgba(15,68,139,0.16)'),
  highlight: final('rgba(255,255,255,0.94)'),
  accent:    final('#0F448B'),
  pill:      final('rgba(15,68,139,0.12)'),
  idle:      final('rgba(15,68,139,0.42)'),
}

type IconName = React.ComponentProps<typeof Ionicons>['name']

// ── Tab Configuration ──────────────────────────────────────────────────────────

const TAB_CONFIG: Record<string, { outline: IconName; filled: IconName; label: string }> = {
  nutrition: { outline: 'restaurant-outline',   filled: 'restaurant',   label: 'Nutrición' },
  workout:   { outline: 'barbell-outline',      filled: 'barbell',      label: 'Entrena' },
  salud:     { outline: 'pulse-outline',        filled: 'pulse',        label: 'Salud' },
  social:    { outline: 'people-outline',       filled: 'people',       label: 'Social' },
}

/**
 * `index` queda fuera a propósito: es solo la redirección de entrada.
 *
 * Recetas tampoco es pestaña: vive dentro de Nutrición, en la consola de
 * captura. Es donde se decide qué comer, así que es donde tiene que estar —
 * sacarla a la barra la separaría del momento en que se usa.
 *
 * ── Y `profile` tampoco, desde el rediseño de la barra ──────────────────────
 * En la píldora hay que meter seis cosas: cuatro destinos, la coach y el
 * perfil. Con seis huecos el centro cae ENTRE dos, y ZENA dejaba de estar en
 * el eje. Sacando el perfil —que es a donde menos se entra— quedan cuatro
 * destinos, dos a cada lado, y el círculo de ZENA vuelve a caer en el medio.
 *
 * El perfil no desaparece: sube a la esquina superior derecha, en
 * `BotonPerfil`, montado una sola vez sobre todas las pantallas.
 */
const VISIBLE = new Set(['nutrition', 'workout', 'salud', 'social'])

/**
 * El hueco central que se deja libre en la fila para que el círculo de ZENA
 * —que se dibuja ENCIMA de la píldora, no dentro— no se coma el área táctil
 * de las pestañas que tiene al lado.
 *
 * Va aquí y no en el estilo del círculo porque son dos cosas distintas: esto
 * es lo que se reserva en la fila, y el círculo puede ser mayor porque
 * sobresale por arriba.
 */
const HUECO_ZENA = 64
const CARA_ZENA = 56

// ── Animated Icon ──────────────────────────────────────────────────────────────

function AnimatedTabIcon({ name, focused }: { name: string; focused: boolean }) {
  const T = useAppTheme()
  const isDark = useThemeStore(s => s.isDark)
  const scale = useRef(new Animated.Value(focused ? 1.12 : 1)).current
  const opacity = useRef(new Animated.Value(focused ? 1 : 0.4)).current
  const glowOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.14 : 1,
        useNativeDriver: true,
        tension: 320,
        friction: 18,
      }),
      Animated.timing(opacity, {
        toValue: focused ? 1 : 0.4,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: focused ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [focused])

  const config = TAB_CONFIG[name]
  if (!config) return null

  const iconName = focused ? config.filled : config.outline
  const accent = isDark ? T.accent : LIGHT_TAB.accent
  const tint = focused ? accent : (isDark ? T.ink3 : LIGHT_TAB.idle)
  const pill = isDark ? `${T.accent}1E` : LIGHT_TAB.pill

  return (
    <View style={tb.iconWrap}>
      <Animated.View
        style={[tb.activePill, { opacity: glowOpacity, backgroundColor: pill }]}
        pointerEvents="none"
      />
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Ionicons name={iconName} size={22} color={tint} />
      </Animated.View>
      {focused && <View style={[tb.activeDot, { backgroundColor: accent }]} />}
    </View>
  )
}

// ── Glass Tab Bar ──────────────────────────────────────────────────────────────

/**
 * Cuánto hay que arrastrar para que el deslizamiento cuente, en puntos. El
 * mismo número que usa `BarraDeSeccion`: las dos píldoras son la misma barra
 * para quien la usa, y un gesto que pide distinto esfuerzo en cada pantalla se
 * siente roto.
 */
const UMBRAL_GESTO = 18

/**
 * FUNDIDO DE ENTRADA QUE NO PUEDE QUEDARSE A MEDIAS
 * ─────────────────────────────────────────────────
 * El de antes vivia en el padre y era UN SOLO valor compartido: al cambiar
 * `abiertoEn` se ponia la opacidad a cero y se lanzaba la animacion. El fallo
 * es que `abiertoEn` cambia tambien estando en una pestana SIN menu, donde
 * esta fila ni siquiera esta montada. La opacidad se quedaba en cero, y al
 * volver despues a una pestana con menu la fila se montaba ya invisible y
 * nadie la volvia a animar, porque `abiertoEn` no habia vuelto a cambiar.
 * Resultado: el menu abierto y vacio, sin ninguna forma de recuperarlo.
 *
 * Aqui el valor NACE CON LA FILA. Cuando el efecto corre, la vista nativa ya
 * existe, que es lo que `useNativeDriver` necesita para arrancar. Y al soltar
 * se fuerza el 1: si la animacion se interrumpe a medio camino, la fila se
 * queda VISIBLE. El unico estado imposible es el invisible.
 */
function FundidoAlEntrar({ children, style }: { children: React.ReactNode; style?: any }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    })
    anim.start(({ finished }) => { if (!finished) v.setValue(1) })
    return () => { anim.stop(); v.setValue(1) }
  }, [v])
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  )
}

function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const T = useAppTheme()
  const isDark = useThemeStore(s => s.isDark)
  const insets = useSafeAreaInsets()
  const segmentos = useSegments()
  const badges = useSocialStore(s => s.badges)
  /* Hace falta para el registro: el menú de Salud filtra Ciclo con la llave
     del usuario. Hoy solo Social se pinta aquí y daría igual, pero pasar
     `null` era dejar una trampa para el día que Salud use este mismo camino. */
  const usuario = useAuthStore(s => s.user)

  /**
   * El galón, también aquí.
   *
   * Social no tiene portada con tarjetas que enseñen sus secciones —tiene un
   * muro—, así que su menú tiene que estar disponible desde el primer momento,
   * y el primer momento es una raíz de pestaña. La tabla es la misma que usa
   * `BarraDeSeccion`; lo único que dice `enPestana` es quién de las dos lo
   * dibuja, para que no salgan las dos píldoras a la vez.
   */
  const aqui = sitioDe(segmentos.join('/'))
  const conMenu = aqui?.enPestana ? aqui : undefined
  /* El mismo estado que usa la barra flotante: si cada una guardara el suyo,
     tocar una entrada que lleva a una ruta del stack cerraría el menú solo. */
  const abiertoEn = useMenuBarra(s => s.abiertoEn)
  const alternarMenu = useMenuBarra(s => s.alternar)
  const cerrarMenu = useMenuBarra(s => s.cerrar)

  /**
   * El menú de sección solo está abierto si además HAY menú que enseñar.
   *
   * Sin esta condición, quedarse en modo sección y saltar a una pestaña sin
   * galón —Entrena o Salud— dejaba a ZENA con opacidad cero y sin ninguna
   * flecha con la que volver a encenderla: invisible y sin arreglo posible.
   */

  /* El fundido ya no vive aquí: lo lleva `FundidoAlEntrar`, que crea su propio
     valor al montarse. Tenerlo en el padre era justo lo que dejaba el menú en
     blanco —ver la explicación en ese componente—. */

  /**
   * DESLIZAR DE LADO, EL ATAJO DEL GALÓN
   * ────────────────────────────────────
   * Gemelo del de `BarraDeSeccion`, y por el mismo motivo: el galón se queda
   * para quien lo descubre, esto es para quien ya lo sabe. Izquierda entra en
   * el menú de la sección, derecha vuelve al de la app — la misma dirección a
   * la que apunta el galón y en la que ya entraba la fila al cambiar.
   *
   * Va en captura porque la píldora está llena de `TouchableOpacity` y el
   * primero que toca el dedo se queda de responsable: sin la fase de captura
   * el padre no vuelve a pedir el gesto y el arrastre muere encima de la
   * pestaña. Y lee de un ref y de `getState()` porque el `PanResponder` se
   * crea una sola vez y lo que capturase al nacer se le quedaría congelado.
   *
   * En las pestañas sin menú —Entrena, Salud— `destino` es `null` y el gesto
   * no hace nada: ahí tampoco hay galón que imitar.
   */
  const gesto = useRef<{ enSeccion: boolean; destino: DestinoApp | null }>({
    enSeccion: false, destino: null,
  })
  const deslizar = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_e, g) =>
      Math.abs(g.dx) > UMBRAL_GESTO && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_e, g) => {
      const { enSeccion, destino } = gesto.current
      if (!destino) return
      if (g.dx < 0 && !enSeccion) { tocar(); useMenuBarra.getState().alternar(destino) }
      if (g.dx > 0 && enSeccion)  { tocar(); useMenuBarra.getState().cerrar() }
    },
  }), [])

  const alternar = () => { if (conMenu) { tocar(); alternarMenu(conMenu.destino) } }

  const enSeccion = !!conMenu && abiertoEn === conMenu.destino

  /* Lo que el gesto necesita saber, refrescado en cada pintada. */
  gesto.current = { enSeccion, destino: conMenu?.destino ?? null }

  const contadorDe = (d: EntradaDeMenu) => {
    if (d.contador === 'avisos')   return badges.notifications + badges.followRequests
    if (d.contador === 'mensajes') return badges.messages + badges.messageRequests
    return 0
  }

  const irASeccion = (d: EntradaDeMenu) => {
    tocar()
    /* Sin `setModo('app')`: el menú se queda abierto para poder seguir saltando
       entre hermanas. Se cierra con el galón, o tocando la que ya está. */
    if (d.id === conMenu?.activo) { cerrarMenu(); return }
    /* `navigate` y nunca `replace` ni `push`: si la pantalla ya está en la
       pila vuelve a ella, y si no, la abre. `replace` sustituía la pantalla de
       encima —y con la barra visible también en pantallas hondas, eso te sacaba
       de donde estabas y dejaba el botón de atrás llevando a cualquier sitio. */
    router.navigate(d.ruta as never)
  }

  return (
    <View style={[tb.wrapper, { bottom: Math.max(insets.bottom, 14) + 6 }]}>
      <View
        style={[tb.pill, { borderColor: isDark ? T.tabBorder : LIGHT_TAB.border }]}
        {...deslizar.panHandlers}
      >
        <BlurView
          intensity={isDark ? 80 : 55}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? T.tabBar : LIGHT_TAB.scrim }]}
          pointerEvents="none"
        />
        <View
          style={[tb.pillHighlight, { backgroundColor: isDark ? T.tabHighlight : LIGHT_TAB.highlight }]}
          pointerEvents="none"
        />

        {/* 20 puntos, no 34: un disco con borde le quitaría a las etiquetas el
            ancho que necesitan para no cortarse. */}
        {conMenu && (
          <TouchableOpacity
            style={tb.galon}
            onPress={alternar}
            activeOpacity={0.6}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={enSeccion ? 'Volver al menú de la app' : 'Abrir el menú de esta sección'}
          >
            {/* Siempre en el acento —rojo neón en oscuro—, abierto o cerrado.
                Cerrado se pintaba con `ink3`, blanco al 35% sobre el desenfoque:
                invisible para quien abre la app por primera vez y no sabe que
                ahí hay algo que tocar. El rojo no rompe el sistema, lo aplica:
                el tema lo reserva para «lo que exige atención». */}
            <Ionicons
              name={enSeccion ? 'chevron-back' : 'chevron-forward'}
              size={19}
              color={isDark ? T.accent : LIGHT_TAB.accent}
              style={{
                /* El halo es lo que lo hace NEÓN y no solo rojo. */
                textShadowColor: isDark ? T.accent : LIGHT_TAB.accent,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 9,
              }}
            />
          </TouchableOpacity>
        )}

        {enSeccion ? (
          <FundidoAlEntrar style={tb.fila}>
            {(() => {
              const es = entradasDeMenu(conMenu.menu, { user: usuario, lugar: conMenu.lugar ?? 'gym' })
              /*
               * EL ANCHO ENTERO: AQUÍ ZENA NO SE VE
               * ───────────────────────────────────
               * Dentro del menú de una sección ZENA se apaga, así que no hay
               * sitio que guardarle: las entradas ocupan la píldora entera y
               * todas miden lo mismo.
               *
               * Aquí hubo dos mitades con el hueco de ZENA en medio, y era lo
               * correcto MIENTRAS ella seguía encendida en este menú. Al
               * apagarla, ese hueco se quedó sin motivo: un agujero en el
               * centro y las entradas apretadas a los lados. La barra flotante
               * nunca tuvo el problema porque siempre hizo esto mismo.
               */
              return es.map(d => {
                const on = d.id === conMenu.activo
                const tinte = on ? (isDark ? T.accent : LIGHT_TAB.accent) : (isDark ? T.ink3 : LIGHT_TAB.idle)
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={tb.tab}
                    onPress={() => irASeccion(d)}
                    activeOpacity={0.72}
                    hitSlop={{ top: 10, bottom: 10 }}
                  >
                    <View>
                      <Ionicons name={d.icono} size={22} color={tinte} />
                      <View style={tb.contador} pointerEvents="none"><Badge count={contadorDe(d)} /></View>
                    </View>
                    <Text style={[tb.label, { color: tinte }, on && { fontWeight: '700' }]} numberOfLines={1}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                )
              })
            })()}
          </FundidoAlEntrar>
        ) : (
        state.routes.map((route, index) => {
          if (!VISIBLE.has(route.name)) return null
          const focused = state.index === index
          const config = TAB_CONFIG[route.name]
          if (!config) return null

          /* Cuántas pestañas visibles van antes que esta: es lo que dice si
             toca abrir el hueco de ZENA después de pintarla. Se cuenta sobre
             las rutas y no sobre el índice del map porque en medio hay rutas
             ocultas (`index`, `chat`) que no ocupan sitio en la fila. */
          const puesto = state.routes
            .slice(0, index)
            .filter(r => VISIBLE.has(r.name)).length

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name as any)
            }
          }

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key })
          }

          return (
            <React.Fragment key={route.key}>
              <TouchableOpacity
                onPress={onPress}
                onLongPress={onLongPress}
                style={tb.tab}
                activeOpacity={0.72}
              >
                <AnimatedTabIcon name={route.name} focused={focused} />
                <Text style={[
                  tb.label,
                  { color: isDark ? T.ink3 : LIGHT_TAB.idle },
                  focused && { color: isDark ? T.accent : LIGHT_TAB.accent, fontWeight: '700' },
                ]}>
                  {config.label}
                </Text>
              </TouchableOpacity>
              {puesto === 1 && <View style={tb.hueco} pointerEvents="none" />}
            </React.Fragment>
          )
        }))}
      </View>

      {/*
        ZENA, elevada y en el eje.

        Va FUERA de la píldora a propósito: la píldora lleva `overflow:
        'hidden'` para que el desenfoque no se salga de sus esquinas, y
        cualquier hijo que sobresaliera por arriba quedaría cortado. Aquí es
        hermana, así que puede asomar.

        La imagen va sola, sin cristal ni borde: ya trae su propio aro de neón
        y fondo transparente. Cualquier cosa detrás le dibujaría un segundo
        círculo alrededor del suyo.
      */}
      {/*
        ZENA SOLO ESTÁ EN EL MENÚ DE LA APP. Y NO SE DESMONTA NUNCA.
        ───────────────────────────────────────────────────────────
        Las dos cosas a la vez, que es lo que costaba: dentro del menú de una
        sección no pinta nada y no debe verse, pero desmontarla la rompía.

        Antes iba tras `{!enSeccion && ...}` y se desmontaba al abrir el menú:
        cada montaje es un `require` que en desarrollo Metro tiene que servir
        otra vez, y por eso parpadeaba y a veces tardaba en volver. Se arregló
        dejándola siempre montada — pero eso la dejó VISIBLE también en los
        menús de sección, con un hueco reservado para ella en medio de las
        entradas.

        La salida es apagarla sin quitarla: sigue montada —no hay `require`
        que rehacer, no parpadea— y se va a opacidad cero con los toques
        desactivados, así que no tapa la entrada que tenga debajo.

        Lo que NO puede pasar es que se quede invisible sin menú abierto. Por
        eso se mira `enSeccion`, que se calcula contra el destino de ESTA
        pantalla: al saltar a una pestaña sin galón —Entrena, Salud— deja de
        coincidir, y ella vuelve sola.
      */}
      <View
        style={[tb.zenaFila, enSeccion && { opacity: 0 }]}
        pointerEvents={enSeccion ? 'none' : 'box-none'}
      >
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/chat')}
          activeOpacity={0.85}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Abrir el chat con ZENA"
          style={[
            tb.zenaBoton,
            { shadowColor: isDark ? T.accent : LIGHT_TAB.accent },
          ]}
        >
          <Image
            source={require('@/assets/images/zena.png')}
            style={tb.zenaCara}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const tb = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 34,
    borderWidth: 1,
    borderColor: Glass.tabBorder,
    paddingVertical: 10,
    paddingHorizontal: 6,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 20,
    overflow: 'hidden',
  },
  pillHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: Glass.tabHighlight,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingTop: 2,
  },
  /* El sitio que se le guarda a ZENA en la fila. Sin él, el círculo cae encima
     de Entrena y de Salud y esas dos pestañas dejan de poder tocarse en su
     mitad interior. */
  hueco: {
    width: HUECO_ZENA,
  },
  galon: {
    width: 20,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fila: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  /* Cada mitad del menú de sección. El `flex: 1` va aquí y no en las entradas
     para que el hueco de ZENA caiga en el centro exacto de la píldora aunque
     el número de entradas sea impar. */
  mitad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contador: {
    position: 'absolute',
    top: -7,
    right: -13,
    transform: [{ scale: 0.82 }],
  },
  zenaFila: {
    position: 'absolute',
    left: 0,
    right: 0,
    /* Medido desde el suelo de la píldora, que mide 66 de alto (10 de relleno
       + 32 de icono + 3 + 11 de etiqueta + 10). Con 30, un círculo de 56 asoma
       unos 20 puntos por encima del borde: un tercio fuera, que es la
       proporción que lo hace leerse como elevado sin despegarse de la barra.

       Subirlo más lo separa y empieza a parecer un botón suelto encima; menos,
       y deja de distinguirse de las otras pestañas. */
    bottom: 30,
    alignItems: 'center',
    zIndex: 2,
  },
  zenaBoton: {
    width: CARA_ZENA,
    height: CARA_ZENA,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 24,
  },
  zenaCara: {
    width: '100%',
    height: '100%',
  },
  iconWrap: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: `${Colors.primary[500]}1E`,
    borderRadius: 10,
  },
  activeDot: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary[400],
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: Colors.primary[400],
    fontWeight: '700',
  },
})

// ── Root Layout ────────────────────────────────────────────────────────────────

/**
 * ⚠️ TEMPORAL — EL MURO DE PAGO ESTÁ APAGADO
 *
 * Con esto en `false` cualquiera con sesión entra en la app sin plan activo.
 * Se apagó a propósito para poder trabajar y probar; **hay que volver a
 * ponerlo en `true` antes de publicar**.
 *
 * Se deja como interruptor y no se borra el código a propósito: reactivarlo es
 * cambiar esta palabra, y así la comprobación sigue a la vista de cualquiera
 * que abra el archivo. Borrarlo lo convertiría en algo que hay que reescribir
 * —y recordar— dentro de unos meses.
 */
const EXIGIR_PLAN = COBRO_ACTIVO

export default function TabsLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const user = useAuthStore(s => s.user)
  // Con el muro apagado se entra directo: ni pantalla de espera ni consulta al
  // servidor de suscripciones, que sería un viaje en cada apertura para nada.
  const [checking, setChecking] = useState(EXIGIR_PLAN)
  const [hasAccess, setHasAccess] = useState(!EXIGIR_PLAN)

  useEffect(() => {
    if (!EXIGIR_PLAN) return
    if (!isAuthenticated) { setChecking(false); return }
    if (user?.role === 'admin') { setHasAccess(true); setChecking(false); return }
    let cancelled = false
    getCurrentSubscription()
      .then((sub) => {
        if (cancelled) return
        const tier = sub?.tier
        setHasAccess(!!tier && tier !== 'free')
      })
      .catch(() => { if (!cancelled) setHasAccess(false) })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [isAuthenticated, user?.role])

  if (LOGIN_ACTIVO && !isAuthenticated) return <Redirect href="/(auth)/login" />

  // Sin plan activo no se entra (o con la prueba de 5 días y tarjeta ya
  // registrada) — mientras `EXIGIR_PLAN` esté en `true`. Ahora mismo NO lo está.
  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary[400]} size="large" />
      </View>
    )
  }
  if (!hasAccess) return <Redirect href="/subscription-intro" />

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="nutrition" />
      <Tabs.Screen name="workout" />
      <Tabs.Screen name="salud" />
      <Tabs.Screen name="social" />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}
