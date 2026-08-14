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
import { useNutritionStore } from '@/store/nutritionStore'
import { useRecipesStore } from '@/store/recipesStore'
import { useDuelStore } from '@/store/duelStore'
import { useMealPlanStore } from '@/store/mealPlanStore'
import { useMenstrualStore } from '@/store/menstrualStore'
import { useMacroCyclingStore } from '@/store/macroCyclingStore'
import { useHabitsStore } from '@/store/habitsStore'
import { useRecoveryStore } from '@/store/recoveryStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { NetworkBanner } from '@/components/NetworkBanner'
import { BotonZena } from '@/components/ui/BotonZena'
import { migrarSeguimiento, vaciarCola } from '@/store/trackingSync'
import { migrarHistorico, vaciarCola as vaciarColaNutricion } from '@/store/nutritionSync'

const STRIPE_PK = Constants.expoConfig?.extra?.stripePublishableKey as string ?? ''

export default function RootLayout() {
  const initialize = useAuthStore(s => s.initialize)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const loadChallenges = useChallengeStore(s => s.load)
  const loadPremium = usePremiumStore(s => s.load)
  const loadAchievements = useAchievementStore(s => s.load)
  const loadHealthTracker = useHealthTrackerStore(s => s.load)
  const loadMeasurements = useBodyMeasurementsStore(s => s.load)
  // Solo para refrescar el día después de migrar; el diario lo carga su pantalla.
  const loadNutrition = useNutritionStore(s => s.loadToday)
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
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold })

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

  /**
   * El histórico del teléfono sube a Supabase. Necesita sesión —va a la cuenta
   * de quien esté dentro— así que espera a que la haya en vez de correr con los
   * demás `load` del arranque.
   *
   * Cada migración se ejecuta una sola vez por instalación, lo controla su
   * bandera en AsyncStorage, y ninguna borra nada del móvil. Al terminar se
   * recargan los stores que ya se cargaron arriba para que lo subido aparezca
   * sin reiniciar la app.
   *
   * Van en serie y la de nutrición primero porque es la que arrastra más
   * peticiones: lanzarlas a la vez en la peor red del usuario multiplicaría los
   * tiempos de espera de las dos.
   *
   * Lo último es vaciar las colas: quien haya apuntado cosas sin señal las
   * tiene esperando, y volver a entrar es la mejor pista de que hay red.
   */
  useEffect(() => {
    if (!isAuthenticated) return
    void (async () => {
      const n = await migrarHistorico().catch(() => null)
      if (n && n.entradas) loadNutrition()

      const r = await migrarSeguimiento().catch(() => null)
      if (r && (r.mediciones || r.registrosHabitos || r.dias || r.semanas || r.metas || r.ciclo)) {
        loadMeasurements()
        loadHabits()
        loadMealPlan()
        loadMacroCycling()
      }

      void vaciarColaNutricion()
      void vaciarCola()
    })()
  }, [isAuthenticated])

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
            {/* Encima del navegador y una sola vez: así el acceso a ZENA está
                en el mismo sitio en todas las pantallas, también en las que se
                añadan después. */}
            <BotonZena />
            <NetworkBanner />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
      </StripeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
