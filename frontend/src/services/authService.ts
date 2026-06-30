import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import * as Crypto from 'expo-crypto'
import Constants from 'expo-constants'
import api from './api'

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export async function generateDeviceFingerprint(): Promise<string> {
  const existing = await SecureStore.getItemAsync('deviceFingerprint')
  if (existing) return existing

  const deviceId = Constants.deviceId || Math.random().toString(36)
  const raw = `${deviceId}-${Constants.expoConfig?.version || '1.0.0'}`
  const fingerprint = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw
  )

  await SecureStore.setItemAsync('deviceFingerprint', fingerprint, SECURE_STORE_OPTIONS)
  return fingerprint
}

export async function register(data: {
  email: string
  password: string
  fullName: string
}): Promise<void> {
  await api.post('/auth/register', data)
}

export async function login(data: {
  email: string
  password: string
}): Promise<{ accessToken: string; refreshToken: string }> {
  const fingerprint = await generateDeviceFingerprint()
  const fcmToken = await SecureStore.getItemAsync('fcmToken')

  const response = await api.post('/auth/login', {
    ...data,
    deviceFingerprint: fingerprint,
    fcmToken,
  })

  const { accessToken, refreshToken } = response.data.data

  await SecureStore.setItemAsync('accessToken', accessToken, SECURE_STORE_OPTIONS)
  await SecureStore.setItemAsync('refreshToken', refreshToken, SECURE_STORE_OPTIONS)

  return { accessToken, refreshToken }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } finally {
    await SecureStore.deleteItemAsync('accessToken')
    await SecureStore.deleteItemAsync('refreshToken')
  }
}

export async function verifyEmail(email: string, code: string): Promise<void> {
  const response = await api.post('/auth/verify-email', { email, code })
  const { accessToken, refreshToken } = response.data.data

  await SecureStore.setItemAsync('accessToken', accessToken, SECURE_STORE_OPTIONS)
  await SecureStore.setItemAsync('refreshToken', refreshToken, SECURE_STORE_OPTIONS)
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email })
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password })
}

export async function resendVerification(email: string): Promise<void> {
  await api.post('/auth/resend-verification', { email })
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync('accessToken')
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  const isEnrolled = await LocalAuthentication.isEnrolledAsync()

  if (!hasHardware || !isEnrolled) return false

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirma tu identidad para acceder',
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar contraseña',
    disableDeviceFallback: false,
  })

  return result.success
}
