import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native'
import { Tabs, Redirect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { COBRO_ACTIVO } from '@/constants/acceso'
import { useAuthStore } from '@/store/authStore'
import { Colors, Glass } from '@/constants/theme'
import { getCurrentSubscription } from '@/services/stripeService'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemeStore } from '@/store/themeStore'
import { final } from '@/theme/remap'

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
  profile:   { outline: 'person-outline',       filled: 'person',       label: 'Perfil' },
}

/**
 * `index` queda fuera a propósito: es solo la redirección de entrada.
 *
 * Recetas tampoco es pestaña: vive dentro de Nutrición, en la consola de
 * captura. Es donde se decide qué comer, así que es donde tiene que estar —
 * sacarla a la barra la separaría del momento en que se usa.
 */
const VISIBLE = new Set(['nutrition', 'workout', 'salud', 'social', 'profile'])

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

function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const T = useAppTheme()
  const isDark = useThemeStore(s => s.isDark)
  const insets = useSafeAreaInsets()

  return (
    <View style={[tb.wrapper, { bottom: Math.max(insets.bottom, 14) + 6 }]}>
      <View style={[tb.pill, { borderColor: isDark ? T.tabBorder : LIGHT_TAB.border }]}>
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

        {state.routes.map((route, index) => {
          if (!VISIBLE.has(route.name)) return null
          const focused = state.index === index
          const config = TAB_CONFIG[route.name]
          if (!config) return null

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
            <TouchableOpacity
              key={route.key}
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
          )
        })}
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
    shadowColor: '#000',
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

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  // Sin plan activo no se entra (o con la prueba de 5 días y tarjeta ya
  // registrada) — mientras `EXIGIR_PLAN` esté en `true`. Ahora mismo NO lo está.
  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#080808', alignItems: 'center', justifyContent: 'center' }}>
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
