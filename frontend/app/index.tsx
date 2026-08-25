import { View, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/theme'
import { LOGIN_ACTIVO, ONBOARDING_ACTIVO } from '@/constants/acceso'

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuthStore()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.dark.background }}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    )
  }

  if (LOGIN_ACTIVO && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />
  }

  // Route to onboarding if profile not completed
  if (ONBOARDING_ACTIVO && user && !(user as any).profile_completed) {
    return <Redirect href="/(onboarding)" />
  }

  return <Redirect href="/(tabs)" />
}
