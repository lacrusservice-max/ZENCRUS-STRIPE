import { useEffect } from 'react'
import { View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
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
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { NetworkBanner } from '@/components/NetworkBanner'

export default function RootLayout() {
  const initialize = useAuthStore(s => s.initialize)
  const loadChallenges = useChallengeStore(s => s.load)
  const loadPremium = usePremiumStore(s => s.load)
  const loadSocial = useSocialStore(s => s.load)
  const loadAchievements = useAchievementStore(s => s.load)
  const loadHealthTracker = useHealthTrackerStore(s => s.load)
  const loadMeasurements = useBodyMeasurementsStore(s => s.load)
  const loadRecipes = useRecipesStore(s => s.load)
  const loadDuels = useDuelStore(s => s.load)
  const loadMealPlan = useMealPlanStore(s => s.load)
  const loadMenstrual = useMenstrualStore(s => s.load)
  const loadMacroCycling = useMacroCyclingStore(s => s.load)

  useEffect(() => {
    initialize()
    loadChallenges()
    loadPremium()
    loadSocial()
    loadAchievements()
    loadHealthTracker()
    loadMeasurements()
    loadRecipes()
    loadDuels()
    loadMealPlan()
    loadMenstrual()
    loadMacroCycling()
  }, [])

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1 }}>
            <StatusBar style="light" backgroundColor="#0a0a0a" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
            {/* Banner de estado de red — flota sobre toda la app */}
            <NetworkBanner />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}
