import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Animated, Image, useColorScheme,
} from 'react-native'
import { Link, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { Colors, Glass, Spacing, Typography, BorderRadius } from '@/constants/theme'

export default function LoginScreen() {
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [loading, setLoading]         = useState(false)
  const [focused, setFocused]         = useState<string | null>(null)
  const login = useAuthStore(s => s.login)
  const colorScheme = useColorScheme()
  const logoSource = colorScheme === 'light'
    ? require('@/assets/images/logo-negro.png')
    : require('@/assets/images/logo-blanco.png')

  const fade  = useRef(new Animated.Value(0)).current
  const slide = useRef(new Animated.Value(32)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, tension: 100, friction: 14, useNativeDriver: true }),
    ]).start()
  }, [])

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Campos requeridos', 'Ingresa tu correo y contraseña')
      return
    }
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
      router.replace('/(tabs)')
    } catch (err: any) {
      console.error('[LOGIN_ERROR]', JSON.stringify({ status: err?.response?.status, data: err?.response?.data, msg: err?.message, isCircuit: err?.isCircuitOpen, isOffline: err?.isOffline }))
      const msg = err?.response?.data?.message || err?.message || 'Error al iniciar sesión'
      if (err?.response?.data?.data?.requiresVerification) {
        Alert.alert('Verifica tu correo', msg, [
          { text: 'Verificar ahora', onPress: () => router.push({ pathname: '/(auth)/verify-email', params: { email: email.trim() } }) },
          { text: 'Cancelar', style: 'cancel' },
        ])
      } else {
        Alert.alert('Error', msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={s.bg}>
      {/* Ambient glow blobs */}
      <View style={[s.blob, { top: -100, right: -60, backgroundColor: Colors.primary[500], width: 320, height: 320 }]} />
      <View style={[s.blob, { bottom: 60, left: -80, backgroundColor: Colors.secondary[600], width: 260, height: 260 }]} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <Animated.View style={[s.header, { opacity: fade, transform: [{ translateY: slide }] }]}>
              <View style={s.logoContainer}>
                <Image
                  source={logoSource}
                  style={s.logoImg}
                  resizeMode="contain"
                />
              </View>
              <Text style={s.tagline}>Tu compañero de salud inteligente</Text>
            </Animated.View>

            {/* Form card */}
            <Animated.View style={[s.card, { opacity: fade, transform: [{ translateY: slide }] }]}>
              <View style={s.cardHighlight} pointerEvents="none" />

              {/* Email */}
              <Text style={s.label}>Correo electrónico</Text>
              <View style={[s.inputWrap, focused === 'email' && s.inputActive]}>
                <Ionicons name="mail-outline" size={17} color="rgba(255,255,255,0.36)" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@correo.com"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              {/* Password */}
              <Text style={s.label}>Contraseña</Text>
              <View style={[s.inputWrap, focused === 'pass' && s.inputActive]}>
                <Ionicons name="lock-closed-outline" size={17} color="rgba(255,255,255,0.36)" style={s.inputIcon} />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  secureTextEntry={!showPass}
                  autoComplete="password"
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={17}
                    color="rgba(255,255,255,0.36)"
                  />
                </TouchableOpacity>
              </View>

              {/* Forgot password */}
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={s.forgotWrap}>
                <Text style={s.forgotText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              {/* Login button */}
              <TouchableOpacity
                style={[s.btn, loading && { opacity: 0.65 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.82}
              >
                <View style={s.btnShine} pointerEvents="none" />
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Iniciar sesión</Text>
                }
              </TouchableOpacity>

              {/* Divider */}
              <View style={s.divider}>
                <View style={s.divLine} />
                <Text style={s.divLabel}>o</Text>
                <View style={s.divLine} />
              </View>

              {/* Register */}
              <View style={s.regRow}>
                <Text style={s.regText}>¿No tienes cuenta? </Text>
                <Link href="/(auth)/register" asChild>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={s.regLink}>Regístrate gratis</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080808' },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.15,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[10],
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing[10],
  },
  logoContainer: {
    marginBottom: Spacing[3],
  },
  logoImg: {
    width: 210,
    height: 72,
  },
  tagline: {
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: Glass.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Glass.cardBorder,
    padding: Spacing[6],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  cardHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: Glass.cardHighlight,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Glass.cardBorder,
    paddingHorizontal: Spacing[4],
    paddingVertical: 14,
    marginBottom: Spacing[5],
  },
  inputActive: {
    borderColor: `${Colors.primary[400]}55`,
    backgroundColor: `rgba(37,99,235,0.07)`,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: '#fff',
    padding: 0,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: -Spacing[2],
    marginBottom: Spacing[6],
  },
  forgotText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary[400],
    fontWeight: '600',
  },
  btn: {
    backgroundColor: Colors.primary[500],
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 14,
  },
  btnShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  btnText: {
    color: '#fff',
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing[5],
  },
  divLine: { flex: 1, height: 1, backgroundColor: Glass.cardBorder },
  divLabel: {
    fontSize: Typography.fontSize.xs,
    color: 'rgba(255,255,255,0.25)',
    paddingHorizontal: Spacing[3],
  },
  regRow: { flexDirection: 'row', justifyContent: 'center' },
  regText: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.38)' },
  regLink: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '700' },
})
