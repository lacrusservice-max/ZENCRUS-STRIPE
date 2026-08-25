import { useEffect, useCallback, useState } from 'react'
import { cargarPreferenciaHaptica } from '@/utils/haptica'
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
// Las dos familias de la sección Running: Michroma para los títulos de módulo y
// el número del Núcleo; Geist Mono para TODO dato medido, que necesita ancho de
// dígito fijo para no temblar al actualizarse en vivo. Se piden aquí, al
// arrancar, y no al entrar en la sección: pedirlas allí dejaría el primer render
// con la tipografía de respaldo.
import { Michroma_400Regular } from '@expo-google-fonts/michroma'
import {
  GeistMono_400Regular, GeistMono_500Medium, GeistMono_700Bold,
} from '@expo-google-fonts/geist-mono'
// La voz editorial del módulo de Ciclo. Es la única familia propia de esa
// sección: para el dato medido reusa GeistMono, la misma que Running, porque
// dos monoespaciadas distintas en la misma app se leen como dos apps.
import {
  Fraunces_400Regular, Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces'

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
import { BotonPerfil } from '@/components/ui/BotonPerfil'
import { BarraDeSeccion } from '@/components/ui/BarraDeSeccion'
import { RachaFlotante } from '@/components/racha/RachaFlotante'
import { migrarSeguimiento, vaciarCola } from '@/store/trackingSync'
import { vigilarHabitosAutomaticos } from '@/features/salud/autoHabitos'
import { escucharRecordatorios } from '@/features/salud/recordatorios'
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

  /**
   * LAS QUE HACEN FALTA PARA EL PRIMER PÍXEL, Y LAS QUE NO.
   * ──────────────────────────────────────────────────────
   * Las trece pesan 2,9 MB y antes se esperaban TODAS antes de enseñar nada: el
   * splash no se quitaba hasta que la última estuviera montada. Pero solo dos
   * familias se ven al abrir —Rajdhani en los titulares e Inter en el resto—, y
   * son 2,4 MB de esos 2,9. Las otras tres (Michroma y Geist Mono en Running,
   * Fraunces en Ciclo) son 508 KB que nadie mira hasta que navega a una sección
   * que está a dos toques como mínimo.
   *
   * Así que se piden en dos grupos. El primero manda sobre el splash; el
   * segundo se carga por detrás mientras la persona ya está usando la app.
   *
   * ── Y no se cambia lo que costó aprender ────────────────────────────────────
   * La razón por la que las de sección se piden AQUÍ y no al entrar en Running
   * sigue en pie: al entrar sería tarde y el primer render saldría con la
   * tipografía de respaldo. Se siguen pidiendo al arrancar. Lo único que cambia
   * es que ya no retrasan lo que se ve.
   */
  const [fuentesBase, errorFuentes] = useFonts({
    Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold })

  // Sin leer el resultado a propósito: si se mirara y se usara para decidir
  // cuándo pintar, volveríamos a bloquear el arranque, que es justo lo que se
  // está quitando.
  useFonts({
    Michroma_400Regular,
    GeistMono_400Regular, GeistMono_500Medium, GeistMono_700Bold,
    Fraunces_400Regular, Fraunces_600SemiBold,
    // ZENCRUS: la tipografía propia de la marca, dibujada a partir del
    // logotipo. Vive en assets/fonts, no en Google Fonts, así que carga de
    // disco y no de red. Va en el grupo diferido por la misma razón que las
    // demás: no debe retrasar el primer pintado.
    'Zencrus-Light': require('../assets/fonts/Zencrus-Light.ttf'),
    'Zencrus-Regular': require('../assets/fonts/Zencrus-Regular.ttf'),
    'Zencrus-Medium': require('../assets/fonts/Zencrus-Medium.ttf'),
    'Zencrus-SemiBold': require('../assets/fonts/Zencrus-SemiBold.ttf'),
    'Zencrus-Bold': require('../assets/fonts/Zencrus-Bold.ttf'),
    'Zencrus-Black': require('../assets/fonts/Zencrus-Black.ttf') })

  /* ── Las fuentes NO pueden secuestrar el arranque ────────────────────────
     Abajo hay un `if (!fontsLoaded) return null`, y el splash se esconde solo
     cuando algo se pinta. Juntando las dos cosas, una fuente que no llegue
     dejaba la app clavada en el logo PARA SIEMPRE, sin mensaje, sin redbox y
     sin manera de saber qué pasaba: exactamente lo que se veía al abrirla en
     un móvil de verdad mientras en el simulador iba bien.

     Y el error ni se miraba: `useFonts` devuelve `[cargadas, error]` y aquí
     solo se leía el primero, así que un fallo era indistinguible de «todavía
     está cargando».

     Ahora se sale del bloqueo por tres caminos: cargan, fallan, o se acaba el
     tiempo. Arrancar con la tipografía de respaldo es un problema de aspecto;
     no arrancar es que la app no existe. */
  const [seAcaboLaEspera, setSeAcaboLaEspera] = useState(false)
  useEffect(() => {
    if (fuentesBase || errorFuentes) return
    const t = setTimeout(() => setSeAcaboLaEspera(true), 6000)
    return () => clearTimeout(t)
  }, [fuentesBase, errorFuentes])

  const fontsLoaded = fuentesBase || !!errorFuentes || seAcaboLaEspera

  useEffect(() => {
    if (errorFuentes) console.warn('[arranque] las fuentes no cargaron:', errorFuentes)
    else if (seAcaboLaEspera) console.warn('[arranque] las fuentes tardaron demasiado; se sigue sin ellas')
  }, [errorFuentes, seAcaboLaEspera])

  // La háptica se puede apagar; hay a quien le molesta y hay que respetarlo.
  useEffect(() => { void cargarPreferenciaHaptica() }, [])

  /* Entrenar, la proteína y el agua se marcan solos. Se escucha a Nutrición
     una vez y para toda la vida de la app: hacerlo en la pantalla de Hábitos
     solo marcaría los días en que entras a mirarla, y entonces la racha
     mentiría por no haber abierto una pantalla. */
  useEffect(() => vigilarHabitosAutomaticos(), [])

  /* Tocar el recordatorio de un hábito con cronómetro abre la sesión, no una
     lista: avisar a las siete de que tocan cinco minutos solo sirve si al
     segundo toque ya estás respirando. */
  useEffect(() => escucharRecordatorios(), [])

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
            {/* Encima del navegador y una sola vez: así el acceso al perfil
                está en el mismo sitio en todas las pantallas, también en las
                que se añadan después.

                Aquí estaba `BotonZena` hasta el rediseño de la barra: ZENA se
                mudó a la píldora de abajo, elevada y en el eje, y el perfil
                —que salió de la barra para hacerle sitio— ocupó su esquina. */}
            <BotonPerfil />
            {/* La píldora dentro de las secciones de Entrena, que son rutas
                del Stack y hasta ahora se quedaban sin barra ninguna. */}
            <BarraDeSeccion />
            <RachaFlotante />
            <NetworkBanner />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
      </StripeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
