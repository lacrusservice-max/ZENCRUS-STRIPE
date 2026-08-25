/**
 * LA BARRA, DENTRO DE UNA SECCIÓN
 * ═══════════════════════════════
 * La misma píldora flotante de la app, pero en las pantallas de dentro de un
 * destino —gimnasio, recetas, hábitos, mensajes…—, donde hasta ahora no había
 * ninguna: son rutas del Stack, fuera de `(tabs)`, y se quedaban sin barra.
 *
 * Trae un galón a la izquierda: al tocarlo, los cuatro destinos de la app se
 * van y en su sitio entran los de ESTA sección. Qué enseña cada una está en
 * `constants/menusDeSeccion.ts`; aquí solo se dibuja.
 *
 * ── Por qué la barra y no el riel de arriba ─────────────────────────────────
 * `MenuSeccion` decía, con razón, que meter cuatro destinos MÁS en la barra de
 * la app la convertiría en un listado. Aquí no se añade nada: la barra se
 * SUSTITUYE. Mientras estás en el menú de la sección no se ven los destinos de
 * la app, y por eso caben cuatro sin apretarse. Esa es la diferencia que hace
 * que el argumento de entonces ya no aplique.
 *
 * Y lo que se gana: las opciones dejan de estar arriba, a dos dedos de donde
 * está el pulgar, y la pantalla recupera los 54 puntos del riel.
 *
 * ── Por qué se monta en `app/_layout.tsx` y no en cada pantalla ─────────────
 * Por lo mismo que `BotonPerfil`: son seis pantallas hoy y las que vengan
 * mañana. Montada una vez, la que se añada nace con ella.
 *
 * ── Por qué un galón desnudo y no un botón redondo ──────────────────────────
 * Un disco con borde ocupa 34 puntos de la fila; el galón solo, 20. Con cuatro
 * destinos y ZENA elevada en el eje, esos 14 puntos son la diferencia entre
 * que las etiquetas quepan y que se corten.
 */

import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  Animated, Easing, Platform, Keyboard, PanResponder,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { router, useSegments, useLocalSearchParams } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { useSocialStore } from '@/store/socialStore'
import { useMenuBarra } from '@/store/menuBarraStore'
import { Badge } from '@/components/social/Bits'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemeStore } from '@/store/themeStore'
import { Colors } from '@/constants/theme'
import { final } from '@/theme/remap'
import { tocar } from '@/utils/haptica'
import { LOGIN_ACTIVO } from '@/constants/acceso'
import { type LugarEntreno } from '@/components/workout/MenuSeccion'
import {
  sitioDe,
  entradasDeMenu,
  type EntradaDeMenu,
  type DestinoApp,
} from '@/constants/menusDeSeccion'

/* Los mismos colores del tema claro que usa la barra de pestañas. Van con
   `final()` porque ya pertenecen al tema claro y el interceptor no debe volver
   a convertirlos. */
const LIGHT_TAB = {
  scrim:     final('rgba(255,255,255,0.72)'),
  border:    final('rgba(15,68,139,0.16)'),
  highlight: final('rgba(255,255,255,0.94)'),
  accent:    final('#0F448B'),
  idle:      final('rgba(15,68,139,0.42)'),
}

/*
 * Aquí había un `LayoutAnimation` para suavizar el reflujo de anchos al
 * cambiar de menú. Se quitó: anima TODO lo que cambie de disposición en ese
 * fotograma, no solo la barra, y con listas y pantallas que se montan a la vez
 * dejaba la barra a medio camino —trabada— hasta el siguiente toque. El
 * fundido de la fila ya cuenta el cambio sin tocar la disposición de nadie.
 */

/** El cambio de menú, en milisegundos. Lo bastante para verse, no tanto como para esperar. */
const CAMBIO_MS = 240

/**
 * Cuánto hay que arrastrar para que el deslizamiento cuente, en puntos.
 *
 * Por debajo de esto el toque sigue siendo un toque y llega entero a la
 * pestaña que haya debajo. Es el número que separa «he tocado Entrena» de «he
 * deslizado para cambiar de menú», y por eso no puede ser pequeno: un dedo
 * nunca cae del todo quieto, y con 4 o 5 puntos cada toque se comería el
 * gesto.
 */
const UMBRAL_GESTO = 18

type IconName = React.ComponentProps<typeof Ionicons>['name']

/** Los cuatro destinos de la app, en el mismo orden que en la barra de pestañas. */
const APP: { id: DestinoApp; ruta: string; icono: IconName; lleno: IconName; label: string }[] = [
  { id: 'nutricion', ruta: '/(tabs)/nutrition', icono: 'restaurant-outline', lleno: 'restaurant', label: 'Nutrición' },
  { id: 'entrena',   ruta: '/(tabs)/workout',   icono: 'barbell-outline',    lleno: 'barbell',    label: 'Entrena' },
  { id: 'salud',     ruta: '/(tabs)/salud',     icono: 'pulse-outline',      lleno: 'pulse',      label: 'Salud' },
  { id: 'social',    ruta: '/(tabs)/social',    icono: 'people-outline',     lleno: 'people',     label: 'Social' },
]

export function BarraDeSeccion() {
  const T = useAppTheme()
  const isDark = useThemeStore(s => s.isDark)
  const insets = useSafeAreaInsets()
  const segmentos = useSegments()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  /* Hace falta para el menú de Salud: Ciclo solo entra si el usuario lo tiene
     activado, con la misma llave que usa la portada. */
  const user = useAuthStore(s => s.user)

  /* Los contadores de Avisos y Mensajes salen del MISMO store que los de la
     cabecera del Muro. Si se calcularan aquí, algún día dirían cosas
     distintas y nadie sabría cuál creer. */
  const badges = useSocialStore(s => s.badges)
  const loadBadges = useSocialStore(s => s.loadBadges)
  const params = useLocalSearchParams<{ mode?: string }>()

  /* Qué menú se enseña. Compartido con la barra de pestañas: si cada una
     guardara el suyo, saltar de una raíz de pestaña a una ruta del stack
     cerraría el menú solo. */
  const abiertoEn = useMenuBarra(s => s.abiertoEn)
  const alternarMenu = useMenuBarra(s => s.alternar)
  const cerrarMenu = useMenuBarra(s => s.cerrar)

  /**
   * Con el teclado abierto la barra no se dibuja.
   *
   * No es cosmético: en Buscar de Social el teclado se abre solo al entrar y
   * se come la píldora entera, así que el galón queda inalcanzable sin cerrar
   * el teclado primero. Y en las pantallas que empujan el contenido, la barra
   * acababa flotando a media pantalla.
   */
  const [tecladoAbierto, setTecladoAbierto] = useState(false)
  useEffect(() => {
    const abre = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTecladoAbierto(true))
    const cierra = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTecladoAbierto(false))
    return () => { abre.remove(); cierra.remove() }
  }, [])

  /**
   * La transición del cambio de menú.
   *
   * Sin ella el cambio era un salto seco: los iconos se reordenaban de golpe,
   * el hueco de ZENA desaparecía en el mismo fotograma y la barra parecía
   * romperse en vez de cambiar. Son tres cosas a la vez, y hacen falta las
   * tres:
   *   · `fundido` desvanece y desliza la fila que entra;
   *   · `zenaViva` encoge y apaga a ZENA, que vive FUERA de la píldora y por
   *     eso no la arrastra el fundido;
   *   · `LayoutAnimation` suaviza el reflujo de anchos al desaparecer su hueco.
   */
  const fundido = useRef(new Animated.Value(1)).current
  const estrenando = useRef(true)

  const ruta = segmentos.join('/')
  const aqui = sitioDe(ruta)

  /* El reinicio sale gratis: el estado guarda EN QUÉ destino está abierto el
     menú, así que al cambiar de destino deja de coincidir y se cierra solo.
     Sin efectos ni dependencias que mantener. */

  /* Al entrar en cualquier pantalla de Social se refrescan los contadores.
     Sin esto, quien llega por un enlace profundo —o quien lleva rato dentro de
     Mensajes— vería la cifra congelada, y una cifra vieja es peor que ninguna.
     `loadBadges` se traga sus propios errores: no merece molestar a nadie. */
  useEffect(() => {
    if (sitioDe(ruta)?.destino === 'social') void loadBadges()
  }, [ruta])

  useEffect(() => {
    /* La primera pintada no se anima: si no, la barra entra deslizándose cada
       vez que se abre una pantalla de sección, que no es un cambio de menú. */
    if (estrenando.current) { estrenando.current = false; return }
    fundido.setValue(0)
    Animated.timing(fundido, {
      toValue: 1, duration: CAMBIO_MS,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start()
  }, [abiertoEn])

  /**
   * DESLIZAR DE LADO, EL ATAJO DEL GALÓN
   * ────────────────────────────────────
   * El galón sigue estando y hace lo mismo; esto es la vía rápida para quien
   * ya sabe que el menú existe. La dirección no es un capricho: va con el
   * galón y con la animación que ya había. En el menú de la app el galón
   * apunta a la derecha y la fila de sección entra desde +18 —la sección está
   * «a la derecha»—, así que se llega a ella deslizando hacia la IZQUIERDA,
   * como se pasa de página. Volver es al revés.
   *
   * ── Por qué en captura y no en burbuja ──────────────────────────────────
   * `onMoveShouldSetPanResponderCapture` y no `onMoveShouldSetPanResponder`:
   * dentro de la píldora hay `TouchableOpacity`, y el primero que toca el dedo
   * se queda de responsable. Sin la fase de captura el padre no vuelve a
   * pedirlo nunca y el arrastre se pierde encima de cualquier pestaña — que es
   * justo por donde la gente va a deslizar. Con captura, el toque empieza en
   * la pestaña y el padre se lo arrebata en cuanto el dedo pasa el umbral: la
   * pestaña cancela su pulsación sola y no navega a ningún sitio.
   *
   * ── Por qué lee de un ref y del estado global ───────────────────────────
   * El `PanResponder` se crea una vez. Si sus funciones capturaran `modo` o
   * `destino` de la pintada en la que nacieron, seguirían viendo esos valores
   * para siempre. Por eso el modo se lee de un ref que se refresca en cada
   * pintada y las acciones salen de `getState()`, que siempre da lo vigente.
   */
  const gesto = useRef<{ modo: 'app' | 'seccion'; destino: DestinoApp | null }>({
    modo: 'app', destino: null,
  })
  const deslizar = React.useMemo(() => PanResponder.create({
    /* Un toque quieto no es asunto suyo: que lo cojan las pestañas. */
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_e, g) =>
      Math.abs(g.dx) > UMBRAL_GESTO && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    /* Ya es nuestro: nadie nos lo quita a mitad del arrastre. */
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_e, g) => {
      const { modo, destino } = gesto.current
      if (!destino) return
      if (g.dx < 0 && modo === 'app')     { tocar(); useMenuBarra.getState().alternar(destino) }
      if (g.dx > 0 && modo === 'seccion') { tocar(); useMenuBarra.getState().cerrar() }
    },
  }), [])

  /* `enPestana` significa que ahí manda la barra de pestañas, que pinta su
     propio galón leyendo esta misma tabla. Sin esta salida se dibujarían las
     dos píldoras, una sobre la otra. */
  if ((LOGIN_ACTIVO && !isAuthenticated) || !aqui || aqui.enPestana || tecladoAbierto) return null

  const modo: 'app' | 'seccion' = abiertoEn === aqui.destino ? 'seccion' : 'app'

  /* Lo que el gesto necesita saber, refrescado en cada pintada. */
  gesto.current = { modo, destino: aqui.destino }

  /* El lugar decide a dónde va «Hoy» y con qué filtro entra «Descubre». En las
     pantallas que no son de un lugar concreto —progreso, récords— se lee del
     parámetro si viene, y si no se queda en gimnasio, que es lo que hacía el
     riel de arriba. */
  const lugar: LugarEntreno = aqui.lugar ?? ((params.mode as LugarEntreno) || 'gym')
  const destinos = entradasDeMenu(aqui.menu, { user, lugar })

  const accent = isDark ? T.accent : LIGHT_TAB.accent
  const apagado = isDark ? T.ink3 : LIGHT_TAB.idle

  const irADestino = (ruta: string) => { tocar(); router.navigate(ruta as never) }

  /** El número que va encima del icono. Cero significa que no hay contador. */
  const contadorDe = (d: EntradaDeMenu) => {
    if (d.contador === 'avisos')   return badges.notifications + badges.followRequests
    if (d.contador === 'mensajes') return badges.messages + badges.messageRequests
    return 0
  }

  const irASeccion = (d: EntradaDeMenu) => {
    tocar()
    /* Tocar la que ya está abierta cierra el menú: es la única forma de
       cerrarlo sin ir a ningún sitio, aparte del galón. */
    if (d.id === aqui.activo) { cerrarMenu(); return }
    /* Una raíz de pestaña se NAVEGA. Reemplazar una ruta del stack por una
       pestaña deja la pila en un estado del que no se sale con el gesto de
       atrás — le pasa a «Hoy» de Nutrición, que es la portada de su pestaña. */
    /* Una acción se APILA: de publicar se vuelve, y hay que poder volver. */
    if (d.tipo === 'accion') { router.push(d.ruta as never); return }
    /*
     * `navigate` para todo lo demás — nunca `replace`.
     *
     * `replace` SUSTITUYE la pantalla de encima. Mientras el menú vivía solo
     * en las portadas daba igual, porque siempre estabas en la de arriba; en
     * cuanto la barra apareció también en pantallas hondas, elegir una sección
     * te sacaba de donde estabas y dejaba el botón de atrás apuntando a
     * cualquier cosa. `navigate` vuelve a la pantalla si ya está en la pila y
     * la abre si no: no destruye nada.
     */
    router.navigate(d.ruta as never)
  }

  return (
    <View style={[b.wrap, { bottom: Math.max(insets.bottom, 14) + 6 }]} pointerEvents="box-none">
      <View
        style={[b.pill, { borderColor: isDark ? T.tabBorder : LIGHT_TAB.border }]}
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
          style={[b.brillo, { backgroundColor: isDark ? T.tabHighlight : LIGHT_TAB.highlight }]}
          pointerEvents="none"
        />

        {/* El galón. Abre el menú de la sección y, ya abierto, lo cierra. */}
        <TouchableOpacity
          style={b.galon}
          onPress={() => { tocar(); alternarMenu(aqui.destino) }}
          activeOpacity={0.6}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={modo === 'app' ? 'Abrir el menú de esta sección' : 'Volver al menú de la app'}
        >
          {/* Siempre en el acento —rojo neón en oscuro—, abierto o cerrado.
              Antes, cerrado se pintaba con `apagado`: un gris al 35% sobre el
              desenfoque de la píldora, que es tanto como no dibujarlo. Quien
              abría la app por primera vez no tenía forma de saber que ahí
              había nada que tocar. Y el rojo no rompe el sistema: el tema lo
              reserva justo para «lo que exige atención». */}
          <Ionicons
            name={modo === 'app' ? 'chevron-forward' : 'chevron-back'}
            size={19}
            color={accent}
            style={{
              /* El halo es lo que lo hace NEÓN y no solo rojo: a 19 puntos y
                 sobre el desenfoque, el rojo plano se lee como un detalle más
                 de la píldora. */
              textShadowColor: accent,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 9,
            }}
          />
        </TouchableOpacity>

        <Animated.View
          style={[
            b.fila,
            {
              opacity: fundido,
              transform: [{
                translateX: fundido.interpolate({
                  inputRange: [0, 1],
                  outputRange: [modo === 'seccion' ? 18 : -18, 0],
                }),
              }],
            },
          ]}
        >
        {modo === 'app' ? (
          <>
            {APP.slice(0, 2).map(d => (
              <Pestana key={d.ruta} {...d} activo={d.id === aqui.destino}
                accent={accent} apagado={apagado} onPress={() => irADestino(d.ruta)} />
            ))}

            {/* El sitio que se le guarda a ZENA, que se dibuja FUERA de la
                píldora. Sin este hueco el círculo cae encima de Entrena y de
                Salud y esas dos dejan de poder tocarse en su mitad interior. */}
            <View style={b.hueco} pointerEvents="none" />

            {APP.slice(2).map(d => (
              <Pestana key={d.ruta} {...d} activo={d.id === aqui.destino}
                accent={accent} apagado={apagado} onPress={() => irADestino(d.ruta)} />
            ))}
          </>
        ) : (
          /* Sin hueco: dentro del menú de la sección ZENA no se ve, así que
             las entradas usan el ancho entero. */
          destinos.map(d => (
            <Pestana
              key={d.id}
              icono={d.icono}
              lleno={d.icono}
              label={d.label}
              activo={d.id === aqui.activo}
              accent={accent}
              apagado={apagado}
              contador={contadorDe(d)}
              onPress={() => irASeccion(d)}
            />
          ))
        )}
        </Animated.View>
      </View>

      {/*
        ZENA, elevada y en el eje — FUERA de la píldora a propósito.

        La píldora lleva `overflow: 'hidden'` para que el desenfoque se recorte
        a sus esquinas; metida dentro, ZENA quedaría cortada por arriba, y
        quitando el recorte el cristal deja de ser una píldora y se convierte en
        un rectángulo de lado a lado. Pasó exactamente eso al montarla.

        El `paddingLeft` compensa el galón: sin él, «centrado» sería el centro
        de la píldora, que con 20 puntos de galón a la izquierda ya no coincide
        con el hueco que le hemos guardado.
      */}
      {/*
        ZENA solo está en el menú de la app.
        Dentro del menú de la sección desaparece —no pinta nada ahí— y el hueco
        se cierra con ella. Lo que NO puede pasar es que se quede invisible sin
        menú abierto: por eso `modo` se calcula contra el destino de ESTA
        pantalla, y si no hay menú abierto aquí, ella está.
      */}
      {modo === 'app' && (
      <View style={b.zenaFila} pointerEvents="box-none">
          <TouchableOpacity
            style={[b.zena, { shadowColor: accent }]}
            onPress={() => { tocar(); router.push('/(tabs)/chat') }}
            activeOpacity={0.85}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Abrir el chat con ZENA"
          >
            <Image source={require('@/assets/images/zena.png')} style={b.zenaCara} resizeMode="contain" />
          </TouchableOpacity>
      </View>
      )}
    </View>
  )
}

function Pestana({ icono, lleno, label, activo, accent, apagado, contador = 0, onPress }: {
  icono: IconName
  lleno: IconName
  label: string
  activo: boolean
  accent: string
  apagado: string
  /** Lo que va encima del icono. Cero no pinta nada. */
  contador?: number
  onPress: () => void
}) {
  return (
    /* El `hitSlop` cubre los 7 puntos de relleno de la píldora arriba y abajo:
       toda la altura del cristal responde, que es lo que espera cualquiera que
       apunte al borde inferior. */
    <TouchableOpacity style={b.tab} onPress={onPress} activeOpacity={0.72} hitSlop={{ top: 7, bottom: 7 }}>
      <View>
        <Ionicons name={activo ? lleno : icono} size={22} color={activo ? accent : apagado} />
        {/*
          El mismo `Badge` que la cabecera del Muro, encogido con un `scale` en
          el contenedor y no en su propio estilo: `Badge` anima su entrada con
          un `transform` y sobrescribírselo desde fuera le quitaría el rebote.

          Al lado de un icono de 22 el globo de 18 se comía la pestaña; a 0,82
          se lee igual y deja respirar a la etiqueta.
        */}
        <View style={b.contador} pointerEvents="none">
          <Badge count={contador} />
        </View>
      </View>
      <Text
        style={[b.label, { color: activo ? accent : apagado }, activo && { fontWeight: '700' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const b = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 34,
    borderWidth: 1,
    /* 7 y no 10: con 10, la pestaña medía 38 puntos de alto y los 6 de abajo
       parecían tocables sin serlo — un toque en el borde inferior de la
       píldora no hacía nada. Con 7, la pestaña llega a los 44 que Apple pide
       como mínimo y la franja muerta desaparece. */
    paddingVertical: 7,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 20,
    /* Con recorte: es lo que mantiene el desenfoque dentro de la píldora. ZENA
       vive fuera justamente por esto. */
    overflow: 'hidden',
  },
  brillo: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
  },
  /* 20 puntos, que es lo que ocupa el galón solo. Un disco con borde serían 34
     y las etiquetas de los cuatro destinos empezarían a cortarse. */
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
  tab: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 0,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  contador: {
    position: 'absolute',
    top: -7,
    right: -13,
    transform: [{ scale: 0.82 }],
  },
  hueco: {
    width: 64,
  },
  zenaFila: {
    position: 'absolute',
    left: 0,
    right: 0,
    /* Medido desde el suelo de la píldora, que mide 58 de alto. Con 24, un
       círculo de 54 asoma unos 20 puntos: un tercio fuera, la proporción que
       lo hace leerse como elevado sin despegarse de la barra. */
    bottom: 24,
    paddingLeft: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  zena: {
    width: 54,
    height: 54,
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
})
