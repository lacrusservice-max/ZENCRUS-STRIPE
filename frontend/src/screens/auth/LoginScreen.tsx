import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, Image, TouchableOpacity, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { login, authenticateWithBiometrics, getStoredToken } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import { decodeJwt } from '../../utils/jwt'
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme'

export default function LoginScreen(): JSX.Element {
  const { setUser, refreshUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})

  const validate = useCallback((): boolean => {
    const newErrors: typeof errors = {}

    if (!email.trim()) {
      newErrors.email = 'El correo es requerido'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Ingresa un correo válido'
    }

    if (!password) {
      newErrors.password = 'La contraseña es requerida'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [email, password])

  const handleLogin = useCallback(async () => {
    if (!validate()) return

    setLoading(true)
    setErrors({})

    try {
      const { accessToken } = await login({ email: email.toLowerCase().trim(), password })
      const decoded = decodeJwt(accessToken)

      if (decoded) {
        setUser({
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          subscriptionTier: decoded.subscriptionTier,
        })
      }

      router.replace('/(tabs)/home')
    } catch (error: any) {
      const status = error?.response?.status
      const message = error?.response?.data?.message

      if (status === 401) {
        setErrors({ general: 'Correo o contraseña incorrectos' })
      } else if (status === 423) {
        setErrors({ general: message || 'Cuenta temporalmente bloqueada' })
      } else if (status === 403 && error?.response?.data?.data?.requiresVerification) {
        router.push({ pathname: '/verify-email', params: { email } })
      } else {
        setErrors({ general: 'No pudimos conectar. Intenta de nuevo.' })
      }
    } finally {
      setLoading(false)
    }
  }, [email, password, validate, setUser])

  const handleBiometricLogin = useCallback(async () => {
    const token = await getStoredToken()
    if (!token) {
      Alert.alert('Inicio biométrico', 'Primero inicia sesión con tu contraseña para activar el acceso biométrico.')
      return
    }

    const authenticated = await authenticateWithBiometrics()
    if (authenticated) {
      await refreshUser()
      router.replace('/(tabs)/home')
    }
  }, [refreshUser])

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
        {/* Logo + Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🥗</Text>
          </View>
          <Text style={styles.title}>ZENCRUS</Text>
          <Text style={styles.subtitle}>Tu salud, personalizada con IA</Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          {errors.general ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {errors.general}</Text>
            </View>
          ) : null}

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
            placeholder="Tu contraseña segura"
            value={password}
            onChangeText={(t) => { setPassword(t); setErrors(e => ({ ...e, password: undefined })) }}
            error={errors.password}
            isPassword
            autoComplete="current-password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            onPress={() => router.push('/forgot-password')}
            style={styles.forgotPassword}
          >
            <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <Button
            label="Iniciar sesión"
            onPress={handleLogin}
            loading={loading}
            size="lg"
            style={styles.loginButton}
          />

          <Button
            label="🔐  Acceso biométrico"
            onPress={handleBiometricLogin}
            variant="outline"
            size="lg"
          />
        </View>

        {/* Registro */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Aún no tienes cuenta?</Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.registerLink}> Crear cuenta gratis</Text>
          </TouchableOpacity>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Al continuar aceptas nuestros{' '}
          <Text style={styles.link}>Términos de servicio</Text> y{' '}
          <Text style={styles.link}>Aviso de privacidad</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing[6], paddingTop: 60, paddingBottom: 40 },

  header: { alignItems: 'center', marginBottom: Spacing[10] },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[4],
  },
  logoEmoji: { fontSize: 40 },
  title: {
    fontSize: Typography.fontSize['4xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary[600],
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.neutral[500],
    marginTop: 4,
    fontFamily: Typography.fontFamily.regular,
  },

  form: { marginBottom: Spacing[8] },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderRadius: BorderRadius.base,
    padding: Spacing[3],
    marginBottom: Spacing[4],
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  errorBannerText: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
  },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: Spacing[5] },
  forgotPasswordText: {
    color: Colors.primary[500],
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
  },
  loginButton: { marginBottom: Spacing[3] },

  footer: { flexDirection: 'row', justifyContent: 'center', marginBottom: Spacing[6] },
  footerText: { color: Colors.neutral[500], fontSize: Typography.fontSize.sm },
  registerLink: {
    color: Colors.primary[500],
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
  },

  disclaimer: {
    textAlign: 'center',
    color: Colors.neutral[400],
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
  },
  link: { color: Colors.primary[500] },
})
