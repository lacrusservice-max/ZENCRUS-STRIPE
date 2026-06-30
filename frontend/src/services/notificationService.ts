// Notification Service — expo-notifications
// Local notifications que funcionan sin Firebase
// TODO: agregar FCM para push remotas (requiere firebase.json + Google Services)

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

export interface NotificationPreferences {
  morningCheckIn: boolean
  morningCheckInHour: number
  morningCheckInMinute: number
  waterReminders: boolean
  waterIntervalHours: number
  workoutReminder: boolean
  workoutHour: number
  workoutMinute: number
  streakProtection: boolean
  streakProtectionHour: number
}

export const DEFAULT_PREFS: NotificationPreferences = {
  morningCheckIn: true,
  morningCheckInHour: 7,
  morningCheckInMinute: 0,
  waterReminders: true,
  waterIntervalHours: 2,
  workoutReminder: true,
  workoutHour: 18,
  workoutMinute: 0,
  streakProtection: true,
  streakProtectionHour: 21,
}

// Configurar cómo se muestran las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function scheduleMorningCheckIn(hour: number, minute: number): Promise<string | null> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '☀️ Buenos días, atleta',
        body: 'Tu check-in matutino te espera. 2 minutos para activar tu día al 100%.',
        data: { type: 'check_in', screen: '/(tabs)/index' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
      },
    })
    return id
  } catch {
    return null
  }
}

export async function scheduleWaterReminders(intervalHours: number): Promise<void> {
  const startHour = 8
  const endHour = 22
  for (let h = startHour; h < endHour; h += intervalHours) {
    const messages = [
      '💧 Hora de hidratarte. Tu cuerpo te lo agradece.',
      '💧 ¿Ya tomaste agua? Un vaso ahora hace la diferencia.',
      '💧 Hidratación = energía. Dale agua a tu máquina.',
    ]
    const msg = messages[Math.floor(Math.random() * messages.length)]
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Recordatorio de agua',
          body: msg,
          data: { type: 'water', screen: '/(tabs)/index' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: h,
          minute: 0,
          repeats: true,
        },
      })
    } catch {}
  }
}

export async function scheduleWorkoutReminder(hour: number, minute: number): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🏋️ Hora de entrenar',
        body: 'Tu rutina te espera. 30 min de trabajo hoy son 10 años de salud mañana.',
        data: { type: 'workout', screen: '/(tabs)/workout' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
      },
    })
    return id
  } catch {
    return null
  }
}

export async function scheduleStreakProtection(hour: number): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔥 Tu racha está en peligro',
        body: 'Tienes hasta la medianoche. Registra algo hoy — no rompas lo que construiste.',
        data: { type: 'streak', screen: '/(tabs)/index' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute: 0,
        repeats: true,
      },
    })
    return id
  } catch {
    return null
  }
}

export async function scheduleAll(prefs: NotificationPreferences): Promise<void> {
  const granted = await requestPermissions()
  if (!granted) return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('zencrus', {
      name: 'ZENCRUS',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#5B4FFF',
    })
  }

  if (prefs.morningCheckIn) {
    await scheduleMorningCheckIn(prefs.morningCheckInHour, prefs.morningCheckInMinute)
  }
  if (prefs.waterReminders) {
    await scheduleWaterReminders(prefs.waterIntervalHours)
  }
  if (prefs.workoutReminder) {
    await scheduleWorkoutReminder(prefs.workoutHour, prefs.workoutMinute)
  }
  if (prefs.streakProtection) {
    await scheduleStreakProtection(prefs.streakProtectionHour)
  }
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

export async function getScheduledCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  return scheduled.length
}
