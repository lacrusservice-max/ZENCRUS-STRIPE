import { useEffect, useCallback } from 'react'
import { View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ThemeProvider } from '@/context/ThemeContext'
import { useThemeStore } from '@/store/themeStore'
import { installThemePatch, setLightMode } from '@/theme/patch'

// Debe instalarse antes del primer render: reescribe el color de todo lo que se
// renderiza cuando el tema claro está activo.
installThemePatch()
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StripeProvider } from '@stripe/stripe-react-native'
import Constants from 'expo-constants'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import {
  Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani'
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter'

SplashScreen.preventAutoHideAsync().catch(() => {})
import { useAuthStore } from '@/store/authStore'
import { useChallengeStore } from '@/store/challengeStore'
import { usePremiumStore } from '@/store/premiumStore'
import { useSocialStore } from '@/store/socialStore'
import { useAchievementStore } from '@/store/achievementStore'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { useBodyMeasurementsStore } from '@/store/bodyMeasurementsStore'
import { useRecipesStore } from '@/store/recipesStore'
import { useDuelStore } from '@/store/duelStore'
import { useMealPlanStore } from '@/store/mealPlanStore'
import { useMenstrualStore } from '@/store/menstrualStore'
import { useMacroCyclingStore } from '@/store/macroCyclingStore'
import { useHabitsStore } from '@/store/habitsStore'
import { useRecoveryStore } from '@/store/recoveryStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { NetworkBanner } from '@/components/NetworkBanner'

const STRIPE_PK = Constants.expoConfig?.extra?.stripePublishableKey as string ?? ''

export default function RootLayout() {
  const initialize = useAuthStore(s => s.initialize)
  const loadChallenges = useChallengeStore(s => s.load)
  const loadPremium = usePremiumStore(s => s.load)
  const loadAchievements = useAchievementStore(s => s.load)
  const loadHealthTracker = useHealthTrackerStore(s => s.load)
  const loadMeasurements = useBodyMeasurementsStore(s => s.load)
  const loadRecipes = useRecipesStore(s => s.load)
  const loadDuels = useDuelStore(s => s.load)
  const loadMealPlan = useMealPlanStore(s => s.load)
  const loadMenstrual = useMenstrualStore(s => s.load)
  const loadMacroCycling = useMacroCyclingStore(s => s.load)
  const loadHabits = useHabitsStore(s => s.load)
  const loadRecovery = useRecoveryStore(s => s.load)
  const loadTheme = useThemeStore(s => s.load)
  const isDark = useThemeStore(s => s.isDark)

  const [fontsLoaded] = useFonts({
    Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  })

  useEffect(() => {
    initialize()
    loadChallenges()
    loadPremium()
    // La comunidad NO se carga aquí: necesita sesión, sus datos no se guardan
    // en disco y solo hacen falta al entrar en la sección. Cargarla al arrancar
    // era una petición desperdiciada en cada apertura de la app.
    loadAchievements()
    loadHealthTracker()
    loadMeasurements()
    loadRecipes()
    loadDuels()
    loadMealPlan()
    loadMenstrual()
    loadMacroCycling()
    loadHabits()
    loadRecovery()
    loadTheme()
  }, [])

  const onRootLayout = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  // El padre renderiza antes que los hijos, así que fijar el modo aquí garantiza
  // que todo el árbol de abajo se cree ya con la paleta correcta.
  setLightMode(!isDark)

  if (!fontsLoaded) return null

  return (
    <ErrorBoundary>
      <ThemeProvider>
      <StripeProvider publishableKey={STRIPE_PK} merchantIdentifier="merchant.com.lacruss.zencrus">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/* Los colores se escriben en paleta oscura: el interceptor los
              convierte a la clara. `style` de StatusBar no es un color. */}
          <View style={{ flex: 1, backgroundColor: '#070709' }} onLayout={onRootLayout}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="#0a0a0a" />
            {/* La key remonta el árbol al cambiar de tema, para que ningún
                subárbol memoizado se quede con la paleta anterior. */}
            <Stack key={isDark ? 'dark' : 'light'} screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
            <NetworkBanner />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
      </StripeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
