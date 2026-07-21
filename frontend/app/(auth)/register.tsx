import { useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Animated, Image, useColorScheme,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { Colors, Spacing, Typography } from '@/constants/theme'
import api from '@/services/api'

// ── Password strength ─────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { ok: password.length >= 8, label: '8+' },
    { ok: /[A-Z]/.test(password), label: 'A-Z' },
    { ok: /[0-9]/.test(password), label: '0-9' },
    { ok: /[^A-Za-z0-9]/.test(password), label: '!@#' },
  ]
  const score = checks.filter(c => c.ok).length
  const color = score <= 1 ? '#ef4444' : score <= 2 ? '#f97316' : score <= 3 ? '#eab308' : '#22c55e'
  return (
    <View style={{ marginTop: 8, marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < score ? color : 'rgba(255,255,255,0.08)' }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
        {checks.map(c => (
          <Text key={c.label} style={{ fontSize: 10, color: c.ok ? '#22c55e' : 'rgba(255,255,255,0.25)', fontWeight: '600' }}>
            {c.ok ? '✓' : '○'} {c.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const { register } = useAuthStore()
  const colorScheme = useColorScheme()
  const logoSource = colorScheme === 'light'
    ? require('@/assets/images/logo-negro.png')
    : require('@/assets/images/logo-blanco.png')

  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current

  // Step 0 — identity
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle')
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 1 — credentials
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  // ── Username check ────────────────────────────────────────────────────────

  const checkUsername = useCallback((val: string) => {
    if (checkTimer.current) clearTimeout(checkTimer.current)
    if (!val || val.length < 3) { setUsernameStatus('idle'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) { setUsernameStatus('invalid'); return }
    setUsernameStatus('checking')
    checkTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/auth/check-username?username=${encodeURIComponent(val)}`)
        setUsernameStatus(data.data.available ? 'ok' : 'taken')
      } catch { setUsernameStatus('idle') }
    }, 600)
  }, [])

  const handleUsername = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
    setUsername(clean)
    checkUsername(clean)
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const animateStep = (dir: 'forward' | 'back') => {
    const out = dir === 'forward' ? -24 : 24
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: out, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(-out)
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start()
    })
  }

  const validateStep0 = (): string | null => {
    if (!fullName.trim() || fullName.trim().length < 2) return 'Ingresa tu nombre completo'
    if (username.length > 0 && username.length < 3) return 'El username debe tener mínimo 3 caracteres'
    if (usernameStatus === 'taken') return 'Ese username ya está en uso'
    if (usernameStatus === 'invalid') return 'Username solo puede tener letras, números y _'
    return null
  }

  const goNext = () => {
    if (step === 0) {
      const err = validateStep0()
      if (err) { Alert.alert('Completa este paso', err); return }
      animateStep('forward')
      setStep(1)
    } else {
      handleRegister()
    }
  }

  const goBack = () => {
    if (step === 0) { router.back(); return }
    animateStep('back')
    setStep(0)
  }

  // ── Register ──────────────────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Correo inválido', 'Ingresa un correo electrónico válido'); return
    }
    const passErrors = []
    if (password.length < 8) passErrors.push('mínimo 8 caracteres')
    if (!/[A-Z]/.test(password)) passErrors.push('una mayúscula')
    if (!/[0-9]/.test(password)) passErrors.push('un número')
    if (!/[^A-Za-z0-9]/.test(password)) passErrors.push('un símbolo (!@#...)')
    if (passErrors.length > 0) {
      Alert.alert('Contraseña débil', `Tu contraseña necesita: ${passErrors.join(', ')}`); return
    }
    if (password !== confirmPassword) {
      Alert.alert('Las contraseñas no coinciden', 'Verifica que ambas contraseñas sean iguales'); return
    }

    setLoading(true)
    try {
      const emailClean = email.trim().toLowerCase()
      await register(emailClean, password, fullName.trim(), username || undefined)
      router.push({ pathname: '/(auth)/verify-email', params: { email: emailClean } })
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (field: string) => [
    s.input,
    focused === field && s.inputFocused,
  ]

  return (
    <View style={s.bg}>
      {/* Decorative blobs */}
      <View style={[s.blob, { top: -100, right: -80 }]} />
      <View style={[s.blob, { bottom: -60, left: -60, opacity: 0.06 }]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={goBack} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: step === 0 ? '50%' : '100%' }]} />
          </View>
          <Text style={s.stepCount}>{step + 1}/2</Text>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Logo */}
            {step === 0 && (
              <View style={s.logoWrap}>
                <Image source={logoSource} style={s.logo} resizeMode="contain" />
              </View>
            )}

            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

              {/* ── STEP 0: Name & username ── */}
              {step === 0 && (
                <View>
                  <Text style={s.title}>Crear cuenta</Text>
                  <Text style={s.subtitle}>Tu perfil deportivo empieza aquí</Text>

                  <View style={s.card}>
                    <Text style={s.fieldLabel}>Nombre completo</Text>
                    <View style={inputStyle('name')}>
                      <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 10 }} />
                      <TextInput
                        style={s.textInput}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Carlos García"
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        autoCapitalize="words"
                        onFocus={() => setFocused('name')}
                        onBlur={() => setFocused(null)}
                      />
                    </View>

                    <Text style={s.fieldLabel}>
                      Username <Text style={s.optional}>(opcional)</Text>
                    </Text>
                    <View style={inputStyle('user')}>
                      <Text style={s.atSign}>@</Text>
                      <TextInput
                        style={[s.textInput, { flex: 1 }]}
                        value={username}
                        onChangeText={handleUsername}
                        placeholder="carlos_garcia"
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setFocused('user')}
                        onBlur={() => setFocused(null)}
                      />
                      {usernameStatus === 'checking' && <ActivityIndicator size="small" color="rgba(255,255,255,0.35)" />}
                      {usernameStatus === 'ok' && <Ionicons name="checkmark-circle" size={18} color="#22c55e" />}
                      {usernameStatus === 'taken' && <Ionicons name="close-circle" size={18} color="#ef4444" />}
                    </View>
                    {usernameStatus === 'taken' && <Text style={s.errorNote}>Username no disponible</Text>}
                    {usernameStatus === 'ok' && <Text style={s.successNote}>¡Disponible!</Text>}

                    <View style={s.privacyNote}>
                      <Ionicons name="lock-closed-outline" size={13} color="rgba(255,255,255,0.3)" />
                      <Text style={s.privacyText}>
                        Tus datos son privados. Solo usamos tu nombre para personalizar tu experiencia.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* ── STEP 1: Credentials ── */}
              {step === 1 && (
                <View>
                  <Text style={s.title}>Crea tu acceso</Text>
                  <Text style={s.subtitle}>El último paso — ya casi estás dentro</Text>

                  <View style={s.card}>
                    <Text style={s.fieldLabel}>Correo electrónico</Text>
                    <View style={inputStyle('email')}>
                      <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 10 }} />
                      <TextInput
                        style={s.textInput}
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

                    <Text style={s.fieldLabel}>Contraseña</Text>
                    <View style={inputStyle('pass')}>
                      <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 10 }} />
                      <TextInput
                        style={[s.textInput, { flex: 1 }]}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Mínimo 8 caracteres"
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        secureTextEntry={!showPass}
                        autoComplete="new-password"
                        onFocus={() => setFocused('pass')}
                        onBlur={() => setFocused(null)}
                      />
                      <TouchableOpacity onPress={() => setShowPass(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.35)" />
                      </TouchableOpacity>
                    </View>
                    {password.length > 0 && <PasswordStrength password={password} />}

                    <Text style={s.fieldLabel}>Confirmar contraseña</Text>
                    <View style={inputStyle('confirm')}>
                      <Ionicons name="shield-checkmark-outline" size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 10 }} />
                      <TextInput
                        style={[s.textInput, { flex: 1 }]}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Repite tu contraseña"
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        secureTextEntry={!showConfirm}
                        onFocus={() => setFocused('confirm')}
                        onBlur={() => setFocused(null)}
                      />
                      <TouchableOpacity onPress={() => setShowConfirm(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.35)" />
                      </TouchableOpacity>
                    </View>
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                      <Text style={s.errorNote}>Las contraseñas no coinciden</Text>
                    )}
                    {confirmPassword.length > 0 && password === confirmPassword && password.length >= 8 && (
                      <Text style={s.successNote}>¡Contraseñas coinciden!</Text>
                    )}
                  </View>

                  <Text style={s.legalText}>
                    Al continuar aceptas los{' '}
                    <Text style={s.legalLink}>Términos de Servicio</Text>{' '}y la{' '}
                    <Text style={s.legalLink}>Política de Privacidad</Text> de ZENCRUS.
                  </Text>
                </View>
              )}

            </Animated.View>

            {/* CTA */}
            <TouchableOpacity
              style={[s.ctaBtn, loading && { opacity: 0.7 }]}
              onPress={goNext}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : (
                  <>
                    <Text style={s.ctaText}>
                      {step === 0 ? 'Continuar' : 'Crear mi cuenta'}
                    </Text>
                    <Ionicons name={step === 0 ? 'arrow-forward' : 'checkmark'} size={18} color="#fff" />
                  </>
                )
              }
            </TouchableOpacity>

            {step === 0 && (
              <TouchableOpacity style={s.loginLink} onPress={() => router.replace('/(auth)/login')}>
                <Text style={s.loginText}>¿Ya tienes cuenta? <Text style={s.loginAccent}>Inicia sesión</Text></Text>
              </TouchableOpacity>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080808' },
  blob: {
    position: 'absolute', width: 280, height: 280, borderRadius: 9999,
    backgroundColor: Colors.primary[500], opacity: 0.10,
  },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing[5], paddingTop: Spacing[2], paddingBottom: Spacing[3], gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  progressBar: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2,
    backgroundColor: Colors.primary[400],
  },
  stepCount: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '600', minWidth: 24 },

  logoWrap: { alignItems: 'center', paddingVertical: Spacing[4] },
  logo: { width: 120, height: 36 },

  scroll: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[10] },

  title: {
    fontSize: 28, fontWeight: '800', color: '#fff',
    marginBottom: Spacing[1], marginTop: Spacing[2],
  },
  subtitle: {
    fontSize: Typography.fontSize.base, color: 'rgba(255,255,255,0.4)',
    marginBottom: Spacing[5], lineHeight: 22,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: Spacing[5], marginBottom: Spacing[4],
  },

  fieldLabel: {
    fontSize: Typography.fontSize.sm, fontWeight: '600',
    color: 'rgba(255,255,255,0.55)', marginBottom: 8, marginTop: 14,
  },
  optional: { fontWeight: '400', color: 'rgba(255,255,255,0.25)' },

  input: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, paddingVertical: 14,
  },
  inputFocused: {
    borderColor: `${Colors.primary[500]}60`,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  textInput: {
    flex: 1, fontSize: Typography.fontSize.base,
    color: '#fff',
  },
  atSign: {
    fontSize: 16, color: 'rgba(255,255,255,0.4)',
    fontWeight: '600', marginRight: 6,
  },

  errorNote: { fontSize: 12, color: '#ef4444', marginTop: 5, fontWeight: '500' },
  successNote: { fontSize: 12, color: '#22c55e', marginTop: 5, fontWeight: '500' },

  privacyNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: Spacing[4], padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
  },
  privacyText: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 16 },

  legalText: {
    fontSize: 11, color: 'rgba(255,255,255,0.25)',
    textAlign: 'center', lineHeight: 18, marginBottom: Spacing[4],
  },
  legalLink: { color: Colors.primary[400], fontWeight: '600' },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary[500],
    borderRadius: 16, paddingVertical: 17,
    shadowColor: Colors.primary[500], shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45, shadowRadius: 28, elevation: 16,
    marginTop: Spacing[2],
  },
  ctaText: { fontSize: Typography.fontSize.base, fontWeight: '700', color: '#fff' },

  loginLink: { alignItems: 'center', paddingVertical: 16 },
  loginText: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.3)' },
  loginAccent: { color: Colors.primary[400], fontWeight: '600' },
})
