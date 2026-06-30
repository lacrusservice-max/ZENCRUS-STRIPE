import { logger } from '../config/logger'

interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
  imageUrl?: string
}

// Firebase Admin SDK se conectará aquí cuando se configure
// Por ahora: estructura completa lista para activar

let firebaseAdmin: any = null

export function initializeFirebase(): void {
  try {
    // const admin = require('firebase-admin')
    // firebaseAdmin = admin.initializeApp({
    //   credential: admin.credential.cert({
    //     projectId: env.FIREBASE_PROJECT_ID,
    //     privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    //     clientEmail: env.FIREBASE_CLIENT_EMAIL,
    //   }),
    // })
    logger.info('Firebase inicializado (modo placeholder)')
  } catch (error) {
    logger.warn('Firebase no configurado — notificaciones push desactivadas')
  }
}

export async function sendPushNotification(
  fcmToken: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!firebaseAdmin || !fcmToken) {
    logger.info(`Push (placeholder): "${payload.title}" → ${fcmToken?.slice(0, 20)}...`)
    return true
  }

  try {
    await firebaseAdmin.messaging().send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      android: {
        priority: 'high' as const,
        notification: { channelId: 'nutriai_default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    })
    return true
  } catch (error) {
    logger.error(`Error enviando push a ${fcmToken?.slice(0, 20)}...`, error)
    return false
  }
}

export async function sendMealReminder(fcmToken: string, mealName: string): Promise<boolean> {
  return sendPushNotification(fcmToken, {
    title: '🍽️ Hora de tu comida',
    body: `Es momento de tu ${mealName}. ¡Mantén tu plan!`,
    data: { type: 'meal_reminder', meal: mealName },
  })
}

export async function sendWorkoutReminder(
  fcmToken: string,
  workoutName: string
): Promise<boolean> {
  return sendPushNotification(fcmToken, {
    title: '💪 ¡Es hora de entrenar!',
    body: `Tu sesión de ${workoutName} te espera. ¡Tú puedes!`,
    data: { type: 'workout_reminder', workout: workoutName },
  })
}

export async function sendHydrationReminder(fcmToken: string): Promise<boolean> {
  return sendPushNotification(fcmToken, {
    title: '💧 Hidratación',
    body: '¿Ya tomaste agua? Recuerda mantenerte hidratado.',
    data: { type: 'hydration_reminder' },
  })
}

export async function sendWeighInReminder(fcmToken: string): Promise<boolean> {
  return sendPushNotification(fcmToken, {
    title: '⚖️ Registro semanal',
    body: 'Es momento de registrar tu peso y medidas para ver tu progreso.',
    data: { type: 'weigh_in_reminder' },
  })
}
