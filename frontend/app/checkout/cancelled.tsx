import { useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COBRO_ACTIVO } from '@/constants/acceso'

export default function CheckoutCancelled() {
  const router = useRouter()

  /* Con el cobro apagado esta pantalla no debe devolver a la tarifa: era la
     única de la app que empujaba a pagar SOLA, con un temporizador que a los
     4 s te plantaba en el selector de planes sin haber tocado nada. */
  const destino = COBRO_ACTIVO ? '/subscription' : '/(tabs)'

  useEffect(() => {
    const t = setTimeout(() => router.replace(destino), 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <View style={styles.container}>
      <Ionicons name="close-circle-outline" size={80} color="#5C5F66" />
      <Text style={styles.title}>Pago cancelado</Text>
      <Text style={styles.sub}>No se realizó ningún cargo.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.replace(destino)}>
        <Text style={styles.btnText}>{COBRO_ACTIVO ? 'Ver planes' : 'Volver a la app'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D10', alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: '#F2F3F5', fontSize: 24, fontWeight: '700' },
  sub: { color: '#A1A3A9', fontSize: 16 },
  btn: { marginTop: 16, backgroundColor: '#7C3AED', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
})
