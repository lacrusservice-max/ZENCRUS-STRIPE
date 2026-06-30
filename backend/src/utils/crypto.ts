import crypto from 'crypto'
import { env } from '../config/env'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex')

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(':')

  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('Formato de cifrado inválido')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}

export function generateDeviceFingerprint(deviceInfo: {
  deviceId: string
  osVersion: string
  appVersion: string
}): string {
  return crypto
    .createHash('sha256')
    .update(deviceInfo.deviceId + deviceInfo.osVersion + deviceInfo.appVersion + env.APP_SECRET)
    .digest('hex')
}

export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data + env.APP_SECRET).digest('hex')
}
