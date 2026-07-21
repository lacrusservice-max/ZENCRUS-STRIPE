import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, useColorScheme, Animated,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { Colors, Glass, Spacing, Typography } from '@/constants/theme'

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const inputs = useRef<(TextInput | null)[]>([])
  const { verifyEmail, resendVerification } = useAuthStore()
  const colorScheme = useColorScheme()
  const logoSource = colorScheme === 'light'
    ? require('@/assets/images/logo-negro.png')
    : require('@/assets/images/logo-blanco.png')

  const shakeAnim = useRef(new Animated.Value(0)).current

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }

  const handleChange = (val: string, idx: number) => {
    if (!/^\d*$/.test(val)) return
    const next = [...code]
    next[idx] = val.slice(-1)
    setCode(next)
    if (val && idx < 5) inputs.current[idx + 1]?.focus()
    if (next.every(d => d !== '')) handleVerify(next.join(''))
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
      router.replace('/(onboarding)')
    } catch (err: any) {
      shake()
      Alert.alert('Código incorrecto', err?.response?.data?.message || 'Verifica el código e intenta de nuevo')
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
      Alert.alert('Código enviado', 'Revisa tu bandeja de entrada y spam')
    } catch {
      Alert.alert('Error', 'No se pudo reenviar el código')
    } finally {
      setResending(false)
    }
  }

  return (
    <View style={s.bg}>
      <View style={[s.blob, { top: -80, right: -60, backgroundColor: Colors.primary[500] }]} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <View style={s.content}>
          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: Spacing[6] }}>
            <Image source={logoSource} style={s.logo} resizeMode="contain" />
          </View>

          {/* Icon */}
          <View style={s.iconWrap}>
            <Ionicons name="mail" size={32} color={Colors.primary[400]} />
          </View>

          <Text style={s.title}>Revisa tu correo</Text>
          <Text style={s.subtitle}>
            Enviamos un código de verificación a{'\n'}
            <Text style={s.emailHighlight}>{email}</Text>
          </Text>

          {/* Code inputs */}
          <Animated.View style={[s.codeRow, { transform: [{ translateX: shakeAnim }] }]}>
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
          </Animated.View>

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.65 }]}
            onPress={() => handleVerify()}
            disabled={loading}
            activeOpacity={0.82}
          >
            <View style={s.btnShine} pointerEvents="none" />
            {loading
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.btnText}>Verificar correo</Text>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </View>
              )
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.resendBtn} onPress={handleResend} disabled={resending}>
            <Text style={s.resendText}>
              {resending ? 'Enviando...' : '¿No llegó? Reenviar código'}
            </Text>
          </TouchableOpacity>

          <View style={s.spamNote}>
            <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.3)" />
            <Text style={s.spamText}>Revisa también tu carpeta de spam</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080808' },
  blob: { position: 'absolute', borderRadius: 9999, opacity: 0.12, width: 260, height: 260 },
  header: {
    paddingHorizontal: Spacing[5], paddingTop: Spacing[2], paddingBottom: Spacing[3],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  content: {
    flex: 1, paddingHorizontal: Spacing[6], paddingTop: Spacing[2], alignItems: 'center',
  },
  logo: { width: 140, height: 44 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: `${Colors.primary[500]}25`,
    borderWidth: 1, borderColor: `${Colors.primary[400]}33`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[5],
  },
  title: {
    fontSize: Typography.fontSize['3xl'], fontWeight: '700', color: '#fff',
    textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    fontSize: Typography.fontSize.base, color: 'rgba(255,255,255,0.45)',
    textAlign: 'center', lineHeight: 24, marginBottom: Spacing[8],
  },
  emailHighlight: { color: Colors.primary[400], fontWeight: '600' },
  codeRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: Spacing[8] },
  codeInput: {
    width: 48, height: 58,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, textAlign: 'center',
    fontSize: Typography.fontSize['2xl'], fontWeight: '700', color: '#fff',
  },
  codeInputFilled: {
    borderColor: `${Colors.primary[400]}88`,
    backgroundColor: `${Colors.primary[500]}20`,
  },
  btn: {
    width: '100%', backgroundColor: Colors.primary[500],
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    overflow: 'hidden', marginBottom: 16,
    shadowColor: Colors.primary[500], shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45, shadowRadius: 24, elevation: 14,
  },
  btnShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  btnText: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '700' },
  resendBtn: { alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '600' },
  spamNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20,
  },
  spamText: { fontSize: 11, color: 'rgba(255,255,255,0.28)' },
})
