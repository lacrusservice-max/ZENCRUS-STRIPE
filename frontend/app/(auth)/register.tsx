import { useState, useRef, useEffect, useCallback } from 'react'
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
import api from '@/services/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5

const GOALS = [
  { id: 'muscle_gain',   icon: 'barbell-outline',      label: 'Ganar músculo',     desc: 'Aumentar masa muscular y fuerza' },
  { id: 'weight_loss',   icon: 'trending-down-outline', label: 'Perder grasa',      desc: 'Reducir peso y definir el cuerpo' },
  { id: 'strength',      icon: 'flash-outline',         label: 'Ganar fuerza',      desc: 'Mejorar rendimiento y potencia' },
  { id: 'endurance',     icon: 'bicycle-outline',       label: 'Resistencia',       desc: 'Correr más, aguantar más' },
  { id: 'maintenance',   icon: 'shield-outline',        label: 'Mantenimiento',     desc: 'Mantener el estado actual' },
  { id: 'health',        icon: 'heart-outline',         label: 'Salud general',     desc: 'Sentirme bien y con energía' },
] as const

const ACTIVITY_LEVELS = [
  { id: 'sedentary',         label: 'Sedentario',    desc: 'Sin ejercicio regular',              icon: 'bed-outline' },
  { id: 'lightly_active',    label: 'Ligero',         desc: '1-2 días/semana',                   icon: 'walk-outline' },
  { id: 'moderately_active', label: 'Moderado',       desc: '3-4 días/semana',                   icon: 'bicycle-outline' },
  { id: 'very_active',       label: 'Muy activo',     desc: '5-6 días/semana',                   icon: 'fitness-outline' },
  { id: 'extremely_active',  label: 'Atleta',         desc: 'Dobles sesiones o trabajo físico',  icon: 'trophy-outline' },
] as const

const TRAINING_TYPES = [
  { id: 'gym',          label: 'Gym / Pesas' },
  { id: 'crossfit',     label: 'CrossFit / HIIT' },
  { id: 'running',      label: 'Running' },
  { id: 'cycling',      label: 'Ciclismo' },
  { id: 'swimming',     label: 'Natación' },
  { id: 'yoga',         label: 'Yoga / Pilates' },
  { id: 'combat',       label: 'Artes Marciales' },
  { id: 'calisthenics', label: 'Calistenia' },
  { id: 'sports',       label: 'Deportes equipo' },
  { id: 'none',         label: 'Sin entreno aún' },
]

const GENDERS = [
  { id: 'male',   label: 'Hombre', icon: 'male-outline' },
  { id: 'female', label: 'Mujer',  icon: 'female-outline' },
  { id: 'other',  label: 'Otro',   icon: 'person-outline' },
] as const

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
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[0,1,2,3].map(i => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < score ? color : 'rgba(255,255,255,0.1)' }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        {checks.map(c => (
          <Text key={c.label} style={{ fontSize: 10, color: c.ok ? '#22c55e' : 'rgba(255,255,255,0.28)', fontWeight: '600' }}>
            {c.ok ? '✓' : '○'} {c.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const { register } = useAuthStore()
  const colorScheme = useColorScheme()
  const logoSource = colorScheme === 'light'
    ? require('@/assets/images/logo-negro.png')
    : require('@/assets/images/logo-blanco.png')

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(1)).current

  // Step 0 — Personal
  const [fullName, setFullName]       = useState('')
  const [username, setUsername]       = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle')
  const [age, setAge]                 = useState('')
  const [gender, setGender]           = useState<'male' | 'female' | 'other' | null>(null)
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 1 — Goal
  const [goal, setGoal] = useState<string | null>(null)

  // Step 2 — Physical
  const [currentWeight, setCurrentWeight] = useState('')
  const [targetWeight, setTargetWeight]   = useState('')
  const [height, setHeight]               = useState('')

  // Step 3 — Activity
  const [activityLevel, setActivityLevel] = useState<string | null>(null)
  const [trainingTypes, setTrainingTypes] = useState<string[]>([])

  // Step 4 — Credentials
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass]         = useState(false)
  const [focused, setFocused]           = useState<string | null>(null)

  // ── Username check ───────────────────────────────────────────────────────────

  const checkUsernameAvailability = useCallback((val: string) => {
    if (checkTimer.current) clearTimeout(checkTimer.current)
    if (!val || val.length < 3) { setUsernameStatus('idle'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) { setUsernameStatus('invalid'); return }
    setUsernameStatus('checking')
    checkTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/auth/check-username?username=${encodeURIComponent(val)}`)
        setUsernameStatus(data.data.available ? 'ok' : 'taken')
      } catch {
        setUsernameStatus('idle')
      }
    }, 600)
  }, [])

  const handleUsernameChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
    setUsername(clean)
    checkUsernameAvailability(clean)
  }

  // ── Step navigation ──────────────────────────────────────────────────────────

  const animateToStep = (direction: 'forward' | 'back') => {
    const toValue = direction === 'forward' ? -20 : 20
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(direction === 'forward' ? 20 : -20)
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start()
    })
  }

  const validateStep = (): string | null => {
    switch (step) {
      case 0:
        if (!fullName.trim() || fullName.trim().length < 2) return 'Ingresa tu nombre completo'
        if (username.length < 3) return 'El username debe tener al menos 3 caracteres'
        if (usernameStatus === 'taken') return 'Ese username ya está en uso'
        if (usernameStatus === 'invalid') return 'Username inválido — solo letras, números y _'
        if (!age || isNaN(Number(age)) || Number(age) < 12 || Number(age) > 100) return 'Ingresa una edad válida (12-100)'
        if (!gender) return 'Selecciona tu género'
        return null
      case 1:
        if (!goal) return 'Selecciona tu objetivo principal'
        return null
      case 2:
        if (!currentWeight || isNaN(Number(currentWeight))) return 'Ingresa tu peso actual'
        if (!height || isNaN(Number(height))) return 'Ingresa tu estatura'
        return null
      case 3:
        if (!activityLevel) return 'Selecciona tu nivel de actividad'
        return null
      case 4:
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Ingresa un correo válido'
        if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))
          return 'La contraseña necesita 8+ caracteres, mayúscula, número y símbolo'
        if (password !== confirmPassword) return 'Las contraseñas no coinciden'
        return null
    }
    return null
  }

  const goNext = () => {
    const err = validateStep()
    if (err) { Alert.alert('Completa este paso', err); return }
    if (step < TOTAL_STEPS - 1) {
      animateToStep('forward')
      setStep(s => s + 1)
    } else {
      handleRegister()
    }
  }

  const goBack = () => {
    if (step === 0) { router.back(); return }
    animateToStep('back')
    setStep(s => s - 1)
  }

  // ── Register ─────────────────────────────────────────────────────────────────

  const handleRegister = async () => {
    setLoading(true)
    try {
      const profileData = {
        peso: Number(currentWeight),
        talla: Number(height),
        edad: Number(age),
        sexo: gender === 'female' ? 'female' : 'male',
        objetivo: goal,
        nivelActividad: activityLevel,
        pesoObjetivo: targetWeight ? Number(targetWeight) : undefined,
        tipoEntrenamiento: trainingTypes.join(','),
      }
      const emailClean = email.trim().toLowerCase()
      await register(emailClean, password, fullName.trim(), username || undefined, profileData)
      router.push({ pathname: '/(auth)/verify-email', params: { email: emailClean } })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al crear la cuenta'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Toggle training type ─────────────────────────────────────────────────────

  const toggleTraining = (id: string) => {
    setTrainingTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={s.bg}>
      <View style={[s.blob, { top: -80, right: -60, backgroundColor: Colors.primary[500] }]} />
      <View style={[s.blob, { bottom: 100, left: -80, backgroundColor: Colors.secondary[600], width: 200, height: 200 }]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          {/* Progress bar */}
          <View style={s.progressWrap}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[s.progressDot, {
                  backgroundColor: i <= step ? Colors.primary[400] : 'rgba(255,255,255,0.12)',
                  flex: 1,
                }]}
              />
            ))}
          </View>

          <Text style={s.stepLabel}>{step + 1}/{TOTAL_STEPS}</Text>
        </View>

        {/* Logo (solo en paso 0) */}
        {step === 0 && (
          <View style={s.logoWrap}>
            <Image source={logoSource} style={s.logo} resizeMode="contain" />
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

              {/* ── STEP 0: Personal info ── */}
              {step === 0 && (
                <View style={s.card}>
                  <View style={s.cardHighlight} pointerEvents="none" />
                  <Text style={s.stepTitle}>Cuéntanos sobre ti</Text>
                  <Text style={s.stepSubtitle}>Esta información personaliza tu experiencia</Text>

                  <FieldLabel>Nombre completo</FieldLabel>
                  <GlassInput
                    icon="person-outline"
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Carlos García"
                    autoCapitalize="words"
                    focused={focused === 'name'}
                    onFocus={() => setFocused('name')}
                    onBlur={() => setFocused(null)}
                  />

                  <FieldLabel>Nombre de usuario</FieldLabel>
                  <View style={[s.inputWrap, focused === 'user' && s.inputActive]}>
                    <Text style={s.atSign}>@</Text>
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      value={username}
                      onChangeText={handleUsernameChange}
                      placeholder="carlos_garcia"
                      placeholderTextColor="rgba(255,255,255,0.22)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setFocused('user')}
                      onBlur={() => setFocused(null)}
                    />
                    {usernameStatus === 'checking' && <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />}
                    {usernameStatus === 'ok' && <Ionicons name="checkmark-circle" size={18} color="#22c55e" />}
                    {usernameStatus === 'taken' && <Ionicons name="close-circle" size={18} color="#ef4444" />}
                  </View>
                  {usernameStatus === 'taken' && <Text style={s.fieldError}>Username no disponible</Text>}
                  {usernameStatus === 'ok' && <Text style={s.fieldOk}>¡Disponible!</Text>}

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <FieldLabel>Edad</FieldLabel>
                      <GlassInput
                        icon="calendar-outline"
                        value={age}
                        onChangeText={setAge}
                        placeholder="25"
                        keyboardType="numeric"
                        maxLength={3}
                        focused={focused === 'age'}
                        onFocus={() => setFocused('age')}
                        onBlur={() => setFocused(null)}
                      />
                    </View>
                  </View>

                  <FieldLabel>Género</FieldLabel>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {GENDERS.map(g => (
                      <TouchableOpacity
                        key={g.id}
                        style={[s.genderChip, gender === g.id && s.chipActive]}
                        onPress={() => setGender(g.id as 'male' | 'female' | 'other')}
                      >
                        <Ionicons name={g.icon as any} size={16} color={gender === g.id ? '#fff' : 'rgba(255,255,255,0.5)'} />
                        <Text style={[s.chipLabel, gender === g.id && { color: '#fff' }]}>{g.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* ── STEP 1: Goal ── */}
              {step === 1 && (
                <View style={s.card}>
                  <View style={s.cardHighlight} pointerEvents="none" />
                  <Text style={s.stepTitle}>¿Cuál es tu objetivo?</Text>
                  <Text style={s.stepSubtitle}>ZENCRUS ajustará tu plan completo a esto</Text>

                  {GOALS.map(g => (
                    <TouchableOpacity
                      key={g.id}
                      style={[s.optionRow, goal === g.id && s.optionActive]}
                      onPress={() => setGoal(g.id)}
                    >
                      <View style={[s.optionIcon, goal === g.id && { backgroundColor: `${Colors.primary[500]}33` }]}>
                        <Ionicons name={g.icon as any} size={22} color={goal === g.id ? Colors.primary[400] : 'rgba(255,255,255,0.45)'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.optionLabel, goal === g.id && { color: '#fff' }]}>{g.label}</Text>
                        <Text style={s.optionDesc}>{g.desc}</Text>
                      </View>
                      {goal === g.id && <Ionicons name="checkmark-circle" size={20} color={Colors.primary[400]} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* ── STEP 2: Physical stats ── */}
              {step === 2 && (
                <View style={s.card}>
                  <View style={s.cardHighlight} pointerEvents="none" />
                  <Text style={s.stepTitle}>Medidas actuales</Text>
                  <Text style={s.stepSubtitle}>Calculamos tu plan nutricional y de entrenamiento</Text>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <FieldLabel>Peso actual (kg)</FieldLabel>
                      <GlassInput
                        icon="scale-outline"
                        value={currentWeight}
                        onChangeText={setCurrentWeight}
                        placeholder="75"
                        keyboardType="decimal-pad"
                        focused={focused === 'cw'}
                        onFocus={() => setFocused('cw')}
                        onBlur={() => setFocused(null)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FieldLabel>Estatura (cm)</FieldLabel>
                      <GlassInput
                        icon="resize-outline"
                        value={height}
                        onChangeText={setHeight}
                        placeholder="175"
                        keyboardType="decimal-pad"
                        focused={focused === 'ht'}
                        onFocus={() => setFocused('ht')}
                        onBlur={() => setFocused(null)}
                      />
                    </View>
                  </View>

                  <FieldLabel>Peso objetivo (kg) <Text style={{ color: 'rgba(255,255,255,0.3)', fontWeight: '400' }}>opcional</Text></FieldLabel>
                  <GlassInput
                    icon="flag-outline"
                    value={targetWeight}
                    onChangeText={setTargetWeight}
                    placeholder="70"
                    keyboardType="decimal-pad"
                    focused={focused === 'tw'}
                    onFocus={() => setFocused('tw')}
                    onBlur={() => setFocused(null)}
                  />

                  <View style={s.infoBox}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.primary[400]} />
                    <Text style={s.infoText}>
                      Tus datos son privados y se usan solo para calcular tu plan personalizado.
                    </Text>
                  </View>
                </View>
              )}

              {/* ── STEP 3: Activity ── */}
              {step === 3 && (
                <View style={s.card}>
                  <View style={s.cardHighlight} pointerEvents="none" />
                  <Text style={s.stepTitle}>Nivel de actividad</Text>
                  <Text style={s.stepSubtitle}>¿Cuánto te mueves actualmente?</Text>

                  {ACTIVITY_LEVELS.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[s.optionRow, activityLevel === a.id && s.optionActive]}
                      onPress={() => setActivityLevel(a.id)}
                    >
                      <View style={[s.optionIcon, activityLevel === a.id && { backgroundColor: `${Colors.primary[500]}33` }]}>
                        <Ionicons name={a.icon as any} size={20} color={activityLevel === a.id ? Colors.primary[400] : 'rgba(255,255,255,0.45)'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.optionLabel, activityLevel === a.id && { color: '#fff' }]}>{a.label}</Text>
                        <Text style={s.optionDesc}>{a.desc}</Text>
                      </View>
                      {activityLevel === a.id && <Ionicons name="checkmark-circle" size={20} color={Colors.primary[400]} />}
                    </TouchableOpacity>
                  ))}

                  <Text style={[s.stepSubtitle, { marginTop: 20, marginBottom: 10 }]}>Tipo de entrenamiento <Text style={{ color: 'rgba(255,255,255,0.35)' }}>(opcional)</Text></Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {TRAINING_TYPES.map(t => (
                      <TouchableOpacity
                        key={t.id}
                        style={[s.tagChip, trainingTypes.includes(t.id) && s.tagChipActive]}
                        onPress={() => toggleTraining(t.id)}
                      >
                        <Text style={[s.tagLabel, trainingTypes.includes(t.id) && { color: '#fff' }]}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* ── STEP 4: Credentials ── */}
              {step === 4 && (
                <View style={s.card}>
                  <View style={s.cardHighlight} pointerEvents="none" />
                  <Text style={s.stepTitle}>Crea tu cuenta</Text>
                  <Text style={s.stepSubtitle}>El último paso — te prometemos que vale la pena</Text>

                  <FieldLabel>Correo electrónico</FieldLabel>
                  <GlassInput
                    icon="mail-outline"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="tu@correo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    focused={focused === 'email'}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                  />

                  <FieldLabel>Contraseña</FieldLabel>
                  <View style={[s.inputWrap, focused === 'pass' && s.inputActive]}>
                    <Ionicons name="lock-closed-outline" size={17} color="rgba(255,255,255,0.36)" style={s.icon} />
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Mínimo 8 caracteres"
                      placeholderTextColor="rgba(255,255,255,0.22)"
                      secureTextEntry={!showPass}
                      onFocus={() => setFocused('pass')}
                      onBlur={() => setFocused(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={17} color="rgba(255,255,255,0.36)" />
                    </TouchableOpacity>
                  </View>
                  {password.length > 0 && <PasswordStrength password={password} />}

                  <FieldLabel style={{ marginTop: 16 }}>Confirmar contraseña</FieldLabel>
                  <View style={[s.inputWrap, focused === 'confirm' && s.inputActive,
                    confirmPassword.length > 0 && confirmPassword !== password && { borderColor: '#ef444455' }
                  ]}>
                    <Ionicons name="shield-checkmark-outline" size={17} color="rgba(255,255,255,0.36)" style={s.icon} />
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Repite tu contraseña"
                      placeholderTextColor="rgba(255,255,255,0.22)"
                      secureTextEntry={!showPass}
                      onFocus={() => setFocused('confirm')}
                      onBlur={() => setFocused(null)}
                    />
                    {confirmPassword.length > 0 && (
                      <Ionicons
                        name={confirmPassword === password ? 'checkmark-circle' : 'close-circle'}
                        size={18}
                        color={confirmPassword === password ? '#22c55e' : '#ef4444'}
                      />
                    )}
                  </View>

                  <View style={s.termsRow}>
                    <Text style={s.termsText}>Al crear tu cuenta aceptas nuestros </Text>
                    <Text style={s.termsLink}>Términos de Uso</Text>
                  </View>
                </View>
              )}

              {/* ── CTA Button ── */}
              <TouchableOpacity
                style={[s.btn, loading && { opacity: 0.65 }]}
                onPress={goNext}
                disabled={loading}
                activeOpacity={0.82}
              >
                <View style={s.btnShine} pointerEvents="none" />
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={s.btnText}>
                        {step < TOTAL_STEPS - 1 ? 'Continuar' : 'Crear mi cuenta'}
                      </Text>
                      <Ionicons name={step < TOTAL_STEPS - 1 ? 'arrow-forward' : 'checkmark'} size={18} color="#fff" />
                    </View>
                  )
                }
              </TouchableOpacity>

              {step === 0 && (
                <View style={s.loginRow}>
                  <Text style={s.loginText}>¿Ya tienes cuenta? </Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
                    <Text style={s.loginLink}>Inicia sesión</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FieldLabel({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text style={[{
      fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)',
      letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
    }, style]}>
      {children}
    </Text>
  )
}

function GlassInput({
  icon, value, onChangeText, placeholder, keyboardType, autoCapitalize,
  autoComplete, secureTextEntry, maxLength, focused, onFocus, onBlur,
}: {
  icon: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  keyboardType?: any; autoCapitalize?: any; autoComplete?: any; secureTextEntry?: boolean;
  maxLength?: number; focused: boolean; onFocus: () => void; onBlur: () => void;
}) {
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center',
      borderRadius: 14, borderWidth: 1,
      borderColor: focused ? `${Colors.primary[400]}55` : Glass.cardBorder,
      backgroundColor: focused ? 'rgba(37,99,235,0.07)' : 'rgba(255,255,255,0.04)',
      paddingHorizontal: Spacing[4], paddingVertical: 14, marginBottom: Spacing[4],
    }]}>
      <Ionicons name={icon as any} size={17} color="rgba(255,255,255,0.36)" style={{ marginRight: 10 }} />
      <TextInput
        style={{ flex: 1, fontSize: Typography.fontSize.base, color: '#fff', padding: 0 }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.22)"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080808' },
  blob: {
    position: 'absolute', borderRadius: 9999, opacity: 0.13, width: 260, height: 260,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing[5], paddingTop: Spacing[2], paddingBottom: Spacing[3],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  progressWrap: { flex: 1, flexDirection: 'row', gap: 6 },
  progressDot: { height: 4, borderRadius: 2 },
  stepLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  logoWrap: { alignItems: 'center', paddingBottom: Spacing[4] },
  logo: { width: 160, height: 50 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[10],
  },
  card: {
    backgroundColor: Glass.card,
    borderRadius: 24, borderWidth: 1, borderColor: Glass.cardBorder,
    padding: Spacing[6], overflow: 'hidden', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5, shadowRadius: 40, elevation: 20,
  },
  cardHighlight: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: Glass.cardHighlight,
  },
  stepTitle: {
    fontSize: Typography.fontSize['2xl'], fontWeight: '700', color: '#fff',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.4)',
    marginBottom: Spacing[5], lineHeight: 20,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 1, borderColor: Glass.cardBorder,
    paddingHorizontal: Spacing[4], paddingVertical: 14, marginBottom: Spacing[4],
  },
  inputActive: {
    borderColor: `${Colors.primary[400]}55`,
    backgroundColor: 'rgba(37,99,235,0.07)',
  },
  icon: { marginRight: 10 },
  input: { fontSize: Typography.fontSize.base, color: '#fff', padding: 0 },
  atSign: { fontSize: 16, color: 'rgba(255,255,255,0.36)', marginRight: 6 },
  fieldError: { fontSize: 11, color: '#ef4444', marginTop: -12, marginBottom: 10, marginLeft: 4 },
  fieldOk: { fontSize: 11, color: '#22c55e', marginTop: -12, marginBottom: 10, marginLeft: 4 },
  genderChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)', paddingVertical: 12,
  },
  chipActive: {
    backgroundColor: `${Colors.primary[500]}33`,
    borderColor: `${Colors.primary[400]}88`,
  },
  chipLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14, marginBottom: 8,
  },
  optionActive: {
    borderColor: `${Colors.primary[400]}66`,
    backgroundColor: `${Colors.primary[500]}18`,
  },
  optionIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  optionLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  optionDesc: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  tagChip: {
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  tagChipActive: {
    backgroundColor: `${Colors.primary[500]}33`,
    borderColor: `${Colors.primary[400]}88`,
  },
  tagLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: `${Colors.primary[500]}15`,
    borderRadius: 12, padding: 12, marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  termsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 },
  termsText: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  termsLink: { fontSize: 11, color: Colors.primary[400], fontWeight: '600' },
  btn: {
    backgroundColor: Colors.primary[500], borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', overflow: 'hidden', marginBottom: 12,
    shadowColor: Colors.primary[500], shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45, shadowRadius: 24, elevation: 14,
  },
  btnShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  btnText: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '700', letterSpacing: 0.3 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  loginText: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.38)' },
  loginLink: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '700' },
})
