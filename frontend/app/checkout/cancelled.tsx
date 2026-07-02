import { useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function CheckoutCancelled() {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => router.replace('/subscription'), 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <View style={styles.container}>
      <Ionicons name="close-circle-outline" size={80} color="#6B6B7E" />
      <Text style={styles.title}>Pago cancelado</Text>
      <Text style={styles.sub}>No se realizó ningún cargo.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/subscription')}>
        <Text style={styles.btnText}>Ver planes</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: '#F0F0F5', fontSize: 24, fontWeight: '700' },
  sub: { color: '#A8A8B8', fontSize: 16 },
  btn: { marginTop: 16, backgroundColor: '#7C3AED', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
})
