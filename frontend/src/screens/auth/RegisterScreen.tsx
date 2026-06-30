import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native'
import { router } from 'expo-router'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { register } from '../../services/authService'
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme'

interface FormErrors {
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
  general?: string
}

export default function RegisterScreen(): JSX.Element {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const getPasswordStrength = useCallback((pass: string): { score: number; label: string; color: string } => {
    let score = 0
    if (pass.length >= 8) score++
    if (/[A-Z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++

    const levels = [
      { score: 0, label: '', color: Colors.neutral[300] },
      { score: 1, label: 'Débil', color: Colors.error },
      { score: 2, label: 'Regular', color: Colors.warning },
      { score: 3, label: 'Buena', color: Colors.accent.orange },
      { score: 4, label: '¡Fuerte!', color: Colors.success },
    ]

    return levels[score] || levels[0]
  }, [])

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!fullName.trim()) newErrors.fullName = 'Tu nombre es requerido'
    else if (fullName.trim().length < 2) newErrors.fullName = 'Nombre muy corto'

    if (!email.trim()) newErrors.email = 'El correo es requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Correo inválido'

    if (!password) newErrors.password = 'La contraseña es requerida'
    else if (password.length < 8) newErrors.password = 'Mínimo 8 caracteres'
    else if (!/[A-Z]/.test(password)) newErrors.password = 'Necesita al menos una mayúscula'
    else if (!/[0-9]/.test(password)) newErrors.password = 'Necesita al menos un número'
    else if (!/[^A-Za-z0-9]/.test(password)) newErrors.password = 'Necesita al menos un carácter especial'

    if (password !== confirmPassword) newErrors.confirmPassword = 'Las contraseñas no coinciden'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [fullName, email, password, confirmPassword])

  const handleRegister = useCallback(async () => {
    if (!validate()) return

    if (!acceptedTerms) {
      setErrors(e => ({ ...e, general: 'Debes aceptar los términos y aviso de privacidad' }))
      return
    }

    setLoading(true)
    setErrors({})

    try {
      await register({ email: email.toLowerCase().trim(), password, fullName: fullName.trim() })
      router.replace({ pathname: '/verify-email', params: { email: email.toLowerCase().trim() } })
    } catch (error: any) {
      const status = error?.response?.status
      const message = error?.response?.data?.message

      if (status === 409) {
        setErrors({ email: 'Ya existe una cuenta con este correo' })
      } else if (status === 422) {
        setErrors({ general: message || 'Revisa los datos ingresados' })
      } else {
        setErrors({ general: 'No pudimos crear tu cuenta. Intenta de nuevo.' })
      }
    } finally {
      setLoading(false)
    }
  }, [validate, acceptedTerms, email, password, fullName])

  const strength = getPasswordStrength(password)

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Gratis · Sin tarjeta de crédito</Text>
        </View>

        {errors.general ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {errors.general}</Text>
          </View>
        ) : null}

        <Input
          label="Nombre completo"
          placeholder="María García"
          value={fullName}
          onChangeText={(t) => { setFullName(t); setErrors(e => ({ ...e, fullName: undefined })) }}
          error={errors.fullName}
          autoComplete="name"
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Input
          label="Correo electrónico"
          placeholder="tu@correo.com"
          value={email}
          onChangeText={(t) => { setEmail(t); setErrors(e => ({ ...e, email: undefined })) }}
          error={errors.email}
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="next"
        />

        <Input
          label="Contraseña"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChangeText={(t) => { setPassword(t); setErrors(e => ({ ...e, password: undefined })) }}
          error={errors.password}
          isPassword
          hint="Usa mayúsculas, números y símbolos"
          returnKeyType="next"
        />

        {password.length > 0 ? (
          <View style={styles.strengthContainer}>
            <View style={styles.strengthBar}>
              {[1, 2, 3, 4].map(level => (
                <View
                  key={level}
                  style={[
                    styles.strengthSegment,
                    { backgroundColor: level <= strength.score ? strength.color : Colors.neutral[200] },
                  ]}
                />
              ))}
            </View>
            {strength.label ? (
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            ) : null}
          </View>
        ) : null}

        <Input
          label="Confirmar contraseña"
          placeholder="Repite tu contraseña"
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); setErrors(e => ({ ...e, confirmPassword: undefined })) }}
          error={errors.confirmPassword}
          isPassword
          returnKeyType="done"
          onSubmitEditing={handleRegister}
        />

        {/* Consentimiento explícito — LFPDPPP */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setAcceptedTerms(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
            {acceptedTerms ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.termsText}>
            Acepto los{' '}
            <Text style={styles.termsLink}>Términos de servicio</Text>
            {' '}y el{' '}
            <Text style={styles.termsLink}>Aviso de privacidad</Text>
            {' '}de ZENCRUS
          </Text>
        </TouchableOpacity>

        <Button
          label="Crear mi cuenta gratis"
          onPress={handleRegister}
          loading={loading}
          size="lg"
          style={styles.createButton}
        />

        <Text style={styles.privacyNote}>
          🔒 Tus datos están protegidos con cifrado AES-256 y nunca los compartimos sin tu consentimiento.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing[6], paddingTop: 60, paddingBottom: 40 },

  header: { marginBottom: Spacing[8] },
  backButton: { marginBottom: Spacing[6] },
  backText: { color: Colors.primary[500], fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.medium },
  title: { fontSize: Typography.fontSize['4xl'], fontFamily: Typography.fontFamily.bold, color: Colors.neutral[900] },
  subtitle: { fontSize: Typography.fontSize.sm, color: Colors.neutral[500], marginTop: 4 },

  errorBanner: {
    backgroundColor: '#fef2f2',
    borderRadius: BorderRadius.base,
    padding: Spacing[3],
    marginBottom: Spacing[4],
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  errorBannerText: { color: Colors.error, fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.medium },

  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: Spacing[4],
    gap: 8,
  },
  strengthBar: { flex: 1, flexDirection: 'row', gap: 3 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.medium },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Spacing[6] },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[500] },
  checkmark: { color: '#fff', fontSize: 13, fontFamily: Typography.fontFamily.bold },
  termsText: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.neutral[600], lineHeight: 20 },
  termsLink: { color: Colors.primary[500], fontFamily: Typography.fontFamily.medium },

  createButton: { marginBottom: Spacing[4] },
  privacyNote: {
    textAlign: 'center',
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[400],
    lineHeight: 18,
  },
})
