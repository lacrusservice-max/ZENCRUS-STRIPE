import admin from 'firebase-admin'
import { env } from './env'
import { logger } from './logger'

let app: admin.app.App | null = null

if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
  try {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        // Railway/env vars store \n as literal backslash-n — restore real newlines
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    })
    logger.info('🔥 Firebase Admin inicializado — push notifications activas')
  } catch (err) {
    logger.error('Error inicializando Firebase Admin:', err)
  }
} else {
  logger.warn('Firebase no configurado — push notifications deshabilitadas')
}

export interface PushResult {
  sent: number
  failed: number
  invalidTokens: string[]
}

export async function sendPushToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<PushResult> {
  if (!app || tokens.length === 0) return { sent: 0, failed: tokens.length, invalidTokens: [] }

  const result = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  })

  const invalidTokens: string[] = []
  result.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code ?? ''
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
        invalidTokens.push(tokens[i])
      }
    }
  })

  return { sent: result.successCount, failed: result.failureCount, invalidTokens }
}

export const firebaseEnabled = !!app
