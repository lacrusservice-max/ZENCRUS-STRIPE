import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/store/authStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const inputs = useRef<(TextInput | null)[]>([])
  const { verifyEmail, resendVerification } = useAuthStore()

  const handleChange = (val: string, idx: number) => {
    if (!/^\d*$/.test(val)) return
    const next = [...code]
    next[idx] = val.slice(-1)
    setCode(next)
    if (val && idx < 5) inputs.current[idx + 1]?.focus()
    if (next.every(d => d !== '') && next.join('').length === 6) {
      handleVerify(next.join(''))
    }
  }

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus()
    }
  }

  const handleVerify = async (codeStr?: string) => {
    const finalCode = codeStr || code.join('')
    if (finalCode.length !== 6) {
      Alert.alert('Código incompleto', 'Ingresa el código de 6 dígitos')
      return
    }
    setLoading(true)
    try {
      await verifyEmail(email || '', finalCode)
      router.replace('/(tabs)')
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Código incorrecto')
      setCode(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await resendVerification(email || '')
      Alert.alert('Código enviado', 'Revisa tu bandeja de entrada')
    } catch {
      Alert.alert('Error', 'No se pudo reenviar el código')
    } finally {
      setResending(false)
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Volver</Text>
        </TouchableOpacity>

        <Text style={s.emoji}>📧</Text>
        <Text style={s.title}>Verifica tu correo</Text>
        <Text style={s.subtitle}>
          Enviamos un código de 6 dígitos a{'\n'}
          <Text style={s.emailText}>{email}</Text>
        </Text>

        <View style={s.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={el => { inputs.current[i] = el }}
              style={[s.codeInput, digit && s.codeInputFilled]}
              value={digit}
              onChangeText={v => handleChange(v, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[s.btn, loading && s.btnDisabled]}
          onPress={() => handleVerify()}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verificar correo</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.resendBtn} onPress={handleResend} disabled={resending}>
          <Text style={s.resendText}>
            {resending ? 'Enviando...' : '¿No llegó? Reenviar código'}
          </Text>
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
  title: { fontSize: Typography.fontSize['3xl'], fontWeight: '700', color: Colors.neutral[900], textAlign: 'center' },
  subtitle: { fontSize: Typography.fontSize.base, color: Colors.neutral[500], textAlign: 'center', marginTop: Spacing[2], marginBottom: Spacing[10], lineHeight: 24 },
  emailText: { color: Colors.primary[500], fontWeight: '600' },
  codeRow: { flexDirection: 'row', gap: Spacing[3], justifyContent: 'center', marginBottom: Spacing[8] },
  codeInput: {
    width: 48, height: 56, borderWidth: 1.5, borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.base, textAlign: 'center', fontSize: Typography.fontSize['2xl'],
    fontWeight: '700', color: Colors.neutral[900], backgroundColor: Colors.light.surface,
  },
  codeInputFilled: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[50] },
  btn: {
    backgroundColor: Colors.primary[500], padding: Spacing[4], borderRadius: BorderRadius.base,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '700' },
  resendBtn: { alignItems: 'center', marginTop: Spacing[6] },
  resendText: { fontSize: Typography.fontSize.sm, color: Colors.primary[500], fontWeight: '500' },
})
