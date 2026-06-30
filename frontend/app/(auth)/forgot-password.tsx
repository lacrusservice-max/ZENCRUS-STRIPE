import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/store/authStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const forgotPassword = useAuthStore(s => s.forgotPassword)

  const handleSend = async () => {
    if (!email.trim()) { Alert.alert('Requerido', 'Ingresa tu correo'); return }
    setLoading(true)
    try {
      await forgotPassword(email.trim().toLowerCase())
      setSent(true)
    } catch {
      setSent(true) // Always show success for security
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.content}>
          <Text style={s.emoji}>✉️</Text>
          <Text style={s.title}>Revisa tu correo</Text>
          <Text style={s.subtitle}>Si el correo existe, recibirás instrucciones para restablecer tu contraseña.</Text>
          <TouchableOpacity style={s.btn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.btnText}>Volver al inicio de sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={s.emoji}>🔑</Text>
        <Text style={s.title}>Recuperar contraseña</Text>
        <Text style={s.subtitle}>Ingresa tu correo y te enviaremos instrucciones para crear una nueva contraseña.</Text>
        <Text style={s.label}>Correo electrónico</Text>
        <TextInput
          style={s.input} value={email} onChangeText={setEmail}
          placeholder="tu@correo.com" placeholderTextColor={Colors.neutral[400]}
          keyboardType="email-address" autoCapitalize="none"
        />
        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleSend} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Enviar instrucciones</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { flex: 1, padding: Spacing[6] },
  backBtn: { marginBottom: Spacing[8] },
  backText: { fontSize: Typography.fontSize.base, color: Colors.primary[500], fontWeight: '500' },
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: Spacing[4] },
  title: { fontSize: Typography.fontSize['3xl'], fontWeight: '700', color: Colors.neutral[900], textAlign: 'center', marginBottom: Spacing[3] },
  subtitle: { fontSize: Typography.fontSize.base, color: Colors.neutral[500], textAlign: 'center', marginBottom: Spacing[8], lineHeight: 24 },
  label: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.neutral[700], marginBottom: 4 },
  input: {
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: BorderRadius.base,
    padding: Spacing[4], fontSize: Typography.fontSize.base, color: Colors.neutral[900],
    backgroundColor: Colors.light.surface, marginBottom: Spacing[6],
  },
  btn: { backgroundColor: Colors.primary[500], padding: Spacing[4], borderRadius: BorderRadius.base, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '700' },
})
