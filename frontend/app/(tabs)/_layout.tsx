import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Tabs, Redirect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useAuthStore } from '@/store/authStore'
import { Colors, Glass } from '@/constants/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

// ── Tab Configuration ──────────────────────────────────────────────────────────

const TAB_CONFIG: Record<string, { outline: IconName; filled: IconName; label: string }> = {
  index:     { outline: 'home-outline',         filled: 'home',         label: 'Inicio' },
  nutrition: { outline: 'restaurant-outline',   filled: 'restaurant',   label: 'Nutrición' },
  workout:   { outline: 'barbell-outline',      filled: 'barbell',      label: 'Entrena' },
  progress:  { outline: 'stats-chart-outline',  filled: 'stats-chart',  label: 'Progreso' },
  social:    { outline: 'people-outline',       filled: 'people',       label: 'Social' },
  profile:   { outline: 'person-outline',       filled: 'person',       label: 'Perfil' },
}

const VISIBLE = new Set(['index', 'nutrition', 'workout', 'progress', 'social', 'profile'])

// ── Animated Icon ──────────────────────────────────────────────────────────────

function AnimatedTabIcon({ name, focused }: { name: string; focused: boolean }) {
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
  const tint = focused ? Colors.primary[400] : 'rgba(255,255,255,0.4)'

  return (
    <View style={tb.iconWrap}>
      {/* Active pill glow */}
      <Animated.View
        style={[tb.activePill, { opacity: glowOpacity }]}
        pointerEvents="none"
      />
      {/* Animated icon */}
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Ionicons name={iconName} size={22} color={tint} />
      </Animated.View>
      {/* Active dot */}
      {focused && <View style={tb.activeDot} />}
    </View>
  )
}

// ── Glass Tab Bar ──────────────────────────────────────────────────────────────

function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[tb.wrapper, { bottom: Math.max(insets.bottom, 14) + 6 }]}>
      <View style={tb.pill}>
        {/* Real backdrop blur */}
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
        {/* Dark overlay on top of blur for depth */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(6,6,12,0.45)' }]} pointerEvents="none" />
        {/* Top specular highlight */}
        <View style={tb.pillHighlight} pointerEvents="none" />

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
              <Text style={[tb.label, focused && tb.labelActive]}>
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

export default function TabsLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="nutrition" />
      <Tabs.Screen name="workout" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="social" />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}
