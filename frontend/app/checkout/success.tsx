import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated'
import { usePremiumStore } from '../../src/store/premiumStore'

export default function CheckoutSuccess() {
  const router = useRouter()
  const { session_id } = useLocalSearchParams<{ session_id: string }>()
  const { load: fetchSubscription } = usePremiumStore()
  const scale = useSharedValue(0)
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12 })
    fetchSubscription().catch(() => {})
    const t = setTimeout(() => router.replace('/(tabs)/profile'), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        <Ionicons name="checkmark-circle" size={96} color="#A78BFA" />
      </Animated.View>
      <Text style={styles.title}>¡Suscripción activada!</Text>
      <Text style={styles.sub}>Bienvenido a ZENCRUS Premium.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center', gap: 16 },
  iconWrap: { marginBottom: 8 },
  title: { color: '#F0F0F5', fontSize: 26, fontWeight: '700' },
  sub: { color: '#A8A8B8', fontSize: 16 },
})
