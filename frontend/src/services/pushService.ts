/**
 * AVISOS PUSH · LADO DE LA APP
 * ────────────────────────────
 * Pide permiso, registra el aparato y lleva a la pantalla correcta al pulsar
 * un aviso.
 *
 * ── Cuándo se pide el permiso ───────────────────────────────────────────────
 * Al ENTRAR en la comunidad, no al abrir la app por primera vez. Un permiso
 * pedido nada más instalar, sin que se entienda para qué, se deniega — y en iOS
 * solo se puede preguntar UNA vez: después hay que mandar a la persona a los
 * ajustes del sistema, que casi nadie hace. Pedirlo cuando ya hay motivo
 * (mensajes, seguidores) es la diferencia entre que digan que sí o que no.
 *
 * ── En Expo Go no funciona ──────────────────────────────────────────────────
 * Desde SDK 53 Expo Go no recibe avisos push en iOS. Esto necesita una
 * compilación de desarrollo o una de EAS. El código es correcto y silencioso
 * mientras tanto: no revienta ni molesta.
 */

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { apiPatch } from '@/services/api'

/**
 * Qué hace un aviso que llega con la app abierta.
 *
 * Se enseña el globo pero NO suena: la persona ya está mirando la pantalla y un
 * sonido por cada me gusta mientras usa la app es insoportable.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
})

let registrado = false

/**
 * Registra este teléfono para recibir avisos.
 *
 * Es idempotente y silenciosa: si no hay permiso, si es un emulador o si
 * estamos en Expo Go, no pasa nada y la app sigue igual. Devuelve si quedó
 * registrado, por si alguna pantalla quiere enseñar el estado.
 */
export async function registerForPush(): Promise<boolean> {
  if (registrado) return true

  try {
    // Android necesita el canal declarado ANTES de pedir permiso, o los avisos
    // llegan sin sonido ni prioridad.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('comunidad', {
        name: 'Comunidad',
        description: 'Mensajes, seguidores y reacciones',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 180, 90, 180],
        lightColor: '#FF1F3D',
      })
    }

    const actual = await Notifications.getPermissionsAsync()
    let concedido = actual.granted
    // Solo se pregunta si no se ha preguntado antes. Volver a pedir un permiso
    // ya denegado no abre ningún diálogo: gasta la llamada y no hace nada.
    if (!concedido && actual.canAskAgain) {
      concedido = (await Notifications.requestPermissionsAsync()).granted
    }
    if (!concedido) return false

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId
    if (!projectId) return false   // sin proyecto de EAS no hay identificador

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    if (!token) return false

    await apiPatch('/users/me/fcm-token', { fcmToken: token })
    registrado = true
    return true
  } catch {
    // Expo Go, emulador sin servicios, red caída: nada de esto merece un aviso
    // de error encima de la app.
    return false
  }
}

/** Se llama al cerrar sesión: este teléfono deja de recibir sus avisos. */
export async function unregisterPush(): Promise<void> {
  registrado = false
  try { await apiPatch('/users/me/fcm-token', { fcmToken: null }) } catch { /* da igual */ }
}

/**
 * Lleva a la pantalla que corresponde al aviso pulsado.
 *
 * El `data` lo pone el servidor en `services/push.ts`; los dos extremos tienen
 * que hablar del mismo vocabulario, así que si aquí se añade un caso, allí hay
 * que mandarlo.
 */
function abrir(data: Record<string, any>) {
  switch (data?.tipo) {
    case 'message':
      if (data.conversacion) router.push(`/social/chat/${data.conversacion}`)
      else router.push('/social/messages')
      break
    case 'follow_request':
      router.push('/social/requests')
      break
    case 'like':
    case 'comment':
    case 'mention':
      if (data.post) router.push(`/social/comments/${data.post}`)
      else router.push('/social/notifications')
      break
    case 'follow':
    case 'follow_accepted':
      if (data.actor) router.push(`/social/profile/${data.actor}`)
      else router.push('/social/notifications')
      break
    default:
      router.push('/social/notifications')
  }
}

/**
 * Engancha la respuesta al toque. Devuelve la función para desengancharla.
 *
 * También mira si la app se ABRIÓ desde un aviso —estaba cerrada del todo—,
 * que es un caso distinto y se pierde si solo se escucha el evento en vivo.
 */
export function listenToPushTaps(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(res => {
    abrir(res.notification.request.content.data as Record<string, any>)
  })

  Notifications.getLastNotificationResponseAsync()
    .then(res => { if (res) abrir(res.notification.request.content.data as Record<string, any>) })
    .catch(() => {})

  return () => sub.remove()
}
