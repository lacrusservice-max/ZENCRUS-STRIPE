/**
 * LOS AVISOS DEL CICLO · PROGRAMARLOS
 * ═══════════════════════════════════════════════════════════════════════════
 * La mitad que habla con iOS. Qué avisos tocan y qué dicen se decide en
 * `avisosPlan.ts`; aquí solo se ponen, se quitan y se escuchan.
 *
 * ── Los de fecha NO se repiten, y los de hora sí ───────────────────────────
 * Los recordatorios de hábitos son alarmas semanales que se repiten para
 * siempre. Aquí la mitad cuelgan de una predicción que se mueve: el día
 * probable del próximo periodo cambia cada vez que registra sangrado. Así que
 * los tres que dependen de la predicción se programan como fecha suelta y se
 * recalculan en cada guardado; los dos que son «todos los días a las ocho»
 * —registro y temperatura— sí se repiten, porque no dependen de nada.
 *
 * ── Y el de retraso se cancela solo ────────────────────────────────────────
 * No porque se compruebe al dispararlo —eso no se puede—, sino porque al
 * registrar el sangrado la predicción cambia, la sincronización se vuelve a
 * ejecutar y ese aviso se reprograma para el ciclo siguiente. Es la misma
 * cadena de recalcular → repintar → reprogramar de después de cada guardado.
 */

import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { requestPermissions } from '@/services/notificationService'
import { PREFIJO, avisosDe, type AjustesAvisos, type ContextoAvisos } from './avisosPlan'

export {
  PREFIJO, TOPE_AVISOS, AVISOS_POR_DEFECTO, avisosDe, textoDelAviso,
} from './avisosPlan'
export type { AjustesAvisos, ContextoAvisos, ClaveAviso } from './avisosPlan'

/* ── Programarlos de verdad ──────────────────────────────────────────────── */

/**
 * Deja programado exactamente lo que dicen los ajustes, ni más ni menos.
 *
 * Se compara con lo que ya hay antes de tocar nada, igual que en los hábitos:
 * borrar y volver a poner cinco avisos en cada guardado es pedirle trabajo a
 * iOS para nada, y cada reprogramación es una ventana en la que el aviso no
 * existe.
 */
export async function sincronizarAvisos(
  ajustes: AjustesAvisos, ctx: ContextoAvisos,
): Promise<void> {
  try {
    /* El permiso no se pide aquí. Pedirlo al entrar en una pantalla, sin que
       nadie lo haya buscado, es la forma más rápida de que te lo denieguen
       para siempre: lo pide `pedirPermisoAvisos()` al encender un aviso. */
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') return

    const quiero = avisosDe(ajustes, ctx)
    const puestas = await Notifications.getAllScheduledNotificationsAsync()
    const mias = puestas.filter(n => n.identifier.startsWith(PREFIJO))

    for (const n of mias) {
      if (!quiero.some(a => a.id === n.identifier)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})
      }
    }

    for (const a of quiero) {
      const ya = mias.find(n => n.identifier === a.id)
      const t = ya?.trigger as
        { hour?: number; minute?: number; value?: number } | undefined
      const igual = ya
        && ya.content.title === a.titulo
        && ya.content.body === a.cuerpo
        && (a.cuando
          ? t?.value === a.cuando.getTime()
          : t?.hour === a.hora?.hour && t?.minute === a.hora?.minute)
      if (igual) continue

      if (ya) await Notifications.cancelScheduledNotificationAsync(a.id).catch(() => {})
      await Notifications.scheduleNotificationAsync({
        identifier: a.id,
        content: {
          title: a.titulo,
          body: a.cuerpo,
          /* Sin sonido y sin prioridad alta. Estos avisos no son una alarma:
             ninguno pide hacer algo en ese minuto, y uno que suena a las nueve
             de la mañana delante de gente es exactamente lo que el modo
             discreto trata de evitar. */
          interruptionLevel: 'passive',
          data: { tipo: 'ciclo' },
        },
        trigger: a.cuando
          ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.cuando }
          : {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: a.hora!.hour,
            minute: a.hora!.minute,
            repeats: true,
          },
      })
    }
  } catch {
    // Un aviso que no se programa no puede tumbar la pantalla.
  }
}

/** Pide el permiso, y solo al encender un aviso. Devuelve si quedó concedido. */
export async function pedirPermisoAvisos(): Promise<boolean> {
  try {
    return await requestPermissions()
  } catch {
    return false
  }
}

/**
 * Cancela todos los avisos del ciclo.
 *
 * Se llama al cerrar sesión y al apagar el módulo. Lo segundo importa tanto
 * como lo primero: si alguien desactiva el ciclo y le sigue llegando «tienes
 * algo que revisar» cada mañana, la función fantasma deja de serlo por la
 * puerta de atrás.
 */
export async function olvidarAvisos(): Promise<void> {
  try {
    const puestas = await Notifications.getAllScheduledNotificationsAsync()
    for (const n of puestas) {
      if (n.identifier.startsWith(PREFIJO)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})
      }
    }
  } catch { /* nada que cancelar */ }
}

/**
 * Qué pasa al tocar un aviso del ciclo.
 *
 * Siempre a la portada del módulo, nunca a la pantalla concreta. Y no es
 * pereza: el módulo tiene su puerta biométrica en el layout, así que entrar
 * por ahí la hace pasar. Un enlace directo al calendario también pasaría por
 * el layout, pero la portada es donde está la frase de arriba que explica el
 * aviso que acaba de leer.
 */
export function escucharAvisos(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(res => {
    const data = res.notification.request.content.data as Record<string, unknown>
    if (data?.tipo !== 'ciclo') return
    router.push('/salud/ciclo')
  })

  /* Y si la app estaba CERRADA del todo, el evento en vivo no llega: el toque
     ya ocurrió antes de que hubiera nadie escuchando. */
  void Notifications.getLastNotificationResponseAsync().then(res => {
    const data = res?.notification.request.content.data as Record<string, unknown>
    if (data?.tipo === 'ciclo') router.push('/salud/ciclo')
  })

  return () => sub.remove()
}
