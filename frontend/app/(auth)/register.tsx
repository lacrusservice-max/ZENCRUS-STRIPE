import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Animated, Image, useColorScheme,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { Colors, Glass, Spacing, Typography } from '@/constants/theme'

// ── Password strength indicator ───────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { ok: password.length >= 8, label: '8 chars' },
    { ok: /[A-Z]/.test(password), label: 'Mayúsc.' },
    { ok: /[0-9]/.test(password), label: 'Número' },
    { ok: /[^A-Za-z0-9]/.test(password), label: 'Especial' },
  ]
  const score = checks.filter(c => c.ok).length
  const barColor =
    score <= 1 ? Colors.accent.red :
    score <= 2 ? Colors.accent.orange :
    score <= 3 ? Colors.warning :
    Colors.success

  return (
    <View style={{ marginBottom: Spacing[4] }}>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              backgroundColor: i < score ? barColor : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {checks.map(c => (
          <Text key={c.label} style={{ fontSize: 10, color: c.ok ? Colors.success : 'rgba(255,255,255,0.28)', fontWeight: '600' }}>
            {c.ok ? '✓' : '○'} {c.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

// ── Register Screen ───────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const [fullName,        setFullName]        = useState('')
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass,        setShowPass]        = useState(false)
  const [loading,         setLoading]         = useState(false)
  const [focused,         setFocused]         = useState<string | null>(null)
  const { register } = useAuthStore()
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

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert('Campos requeridos', 'Por favor completa todos los campos')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden')
      return
    }
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      Alert.alert('Contraseña débil', 'Necesitas 8+ caracteres, una mayúscula, un número y un carácter especial')
      return
    }
    setLoading(true)
    try {
      await register(email.trim().toLowerCase(), password, fullName.trim())
      router.push({ pathname: '/(auth)/verify-email', params: { email: email.trim().toLowerCase() } })
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  const field = (name: string) => ({
    onFocus: () => setFocused(name),
    onBlur:  () => setFocused(null),
  })

  return (
    <View style={s.bg}>
      <View style={[s.blob, { top: -80, right: -50, backgroundColor: Colors.primary[500] }]} />
      <View style={[s.blob, { bottom: 80, left: -70, backgroundColor: Colors.secondary[600], width: 220, height: 220 }]} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back */}
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.6)" />
              <Text style={s.backText}>Volver</Text>
            </TouchableOpacity>

            {/* Logo */}
            <Animated.View style={[s.header, { opacity: fade, transform: [{ translateY: slide }] }]}>
              <Image
                source={logoSource}
                style={s.logoImg}
                resizeMode="contain"
              />
              <Text style={s.tagline}>Únete gratis y transforma tu salud</Text>
            </Animated.View>

            {/* Form card */}
            <Animated.View style={[s.card, { opacity: fade, transform: [{ translateY: slide }] }]}>
              <View style={s.cardHighlight} pointerEvents="none" />

              {/* Full name */}
              <Text style={s.label}>Nombre completo</Text>
              <View style={[s.inputWrap, focused === 'name' && s.inputActive]}>
                <Ionicons name="person-outline" size={17} color="rgba(255,255,255,0.36)" style={s.icon} />
                <TextInput
                  style={s.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Carlos García"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  autoCapitalize="words"
                  autoComplete="name"
                  {...field('name')}
                />
              </View>

              {/* Email */}
              <Text style={s.label}>Correo electrónico</Text>
              <View style={[s.inputWrap, focused === 'email' && s.inputActive]}>
                <Ionicons name="mail-outline" size={17} color="rgba(255,255,255,0.36)" style={s.icon} />
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@correo.com"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  {...field('email')}
                />
              </View>

              {/* Password */}
              <Text style={s.label}>Contraseña</Text>
              <View style={[s.inputWrap, focused === 'pass' && s.inputActive]}>
                <Ionicons name="lock-closed-outline" size={17} color="rgba(255,255,255,0.36)" style={s.icon} />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  secureTextEntry={!showPass}
                  {...field('pass')}
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={17}
                    color="rgba(255,255,255,0.36)"
                  />
                </TouchableOpacity>
              </View>
              {password.length > 0 && <PasswordStrength password={password} />}

              {/* Confirm password */}
              <Text style={s.label}>Confirmar contraseña</Text>
              <View style={[s.inputWrap, focused === 'confirm' && s.inputActive,
                confirmPassword.length > 0 && confirmPassword !== password && { borderColor: `${Colors.accent.red}55` }
              ]}>
                <Ionicons name="shield-checkmark-outline" size={17} color="rgba(255,255,255,0.36)" style={s.icon} />
                <TextInput
                  style={s.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repite tu contraseña"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  secureTextEntry={!showPass}
                  {...field('confirm')}
                />
                {confirmPassword.length > 0 && (
                  <Ionicons
                    name={confirmPassword === password ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={confirmPassword === password ? Colors.success : Colors.accent.red}
                  />
                )}
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={[s.btn, loading && { opacity: 0.65 }]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.82}
              >
                <View style={s.btnShine} pointerEvents="none" />
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Crear cuenta gratuita</Text>
                }
              </TouchableOpacity>

              {/* Login link */}
              <View style={s.loginRow}>
                <Text style={s.loginText}>¿Ya tienes cuenta? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
                  <Text style={s.loginLink}>Inicia sesión</Text>
                </TouchableOpacity>
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
    opacity: 0.14,
    width: 280,
    height: 280,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[10],
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing[6],
  },
  backText: {
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing[8],
  },
  logoImg: {
    width: 180,
    height: 60,
    marginBottom: Spacing[3],
  },
  tagline: {
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.3,
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
    marginBottom: Spacing[4],
  },
  inputActive: {
    borderColor: `${Colors.primary[400]}55`,
    backgroundColor: 'rgba(37,99,235,0.07)',
  },
  icon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: '#fff',
    padding: 0,
  },
  btn: {
    backgroundColor: Colors.primary[500],
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: Spacing[2],
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
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing[5],
  },
  loginText: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.38)' },
  loginLink: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '700' },
})
