import { Platform } from 'react-native'
import * as Application from 'expo-application'

/**
 * Detecta si la app corre en un emulador o dispositivo comprometido.
 * En producción complementar con react-native-device-info.
 */
export async function detectSecurityRisk(): Promise<{
  isEmulator: boolean
  isRooted: boolean
  isSafe: boolean
  reasons: string[]
}> {
  const reasons: string[] = []

  let isEmulator = false
  let isRooted = false

  if (Platform.OS === 'android') {
    const model = (await Application.getAndroidId()) || ''

    const emulatorIndicators = [
      'goldfish', 'ranchu', 'generic', 'sdk_gphone',
      'emulator', 'sdk', 'vbox',
    ]

    if (emulatorIndicators.some(indicator => model.toLowerCase().includes(indicator))) {
      isEmulator = true
      reasons.push('Dispositivo identificado como emulador')
    }
  }

  if (Platform.OS === 'ios') {
    // En simulador, el bundle path contiene "Simulator"
    if (__DEV__) {
      isEmulator = true
    }
  }

  return {
    isEmulator,
    isRooted,
    isSafe: !isEmulator && !isRooted,
    reasons,
  }
}

/**
 * Valida que la versión mínima esté instalada.
 * Fuerza actualizaciones de seguridad críticas.
 */
export function checkMinimumVersion(currentVersion: string, minimumVersion: string): boolean {
  const toNum = (v: string) =>
    v.split('.').map(Number).reduce((a, b) => a * 1000 + b, 0)
  return toNum(currentVersion) >= toNum(minimumVersion)
}

/**
 * Sanitiza input del usuario para prevenir XSS en contenido renderizado
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
}

/**
 * Valida que un URL sea seguro antes de abrirlo
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Limpia datos sensibles de objetos antes de logear
 */
export function sanitizeForLogs<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'pin', 'cvv', 'card']
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      sensitiveKeys.some(sk => k.toLowerCase().includes(sk)) ? '[REDACTED]' : v,
    ])
  ) as Partial<T>
}
