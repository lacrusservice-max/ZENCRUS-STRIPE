/**
 * AVISOS PUSH
 * ───────────
 * Manda avisos al teléfono cuando la app está cerrada.
 *
 * ── Por qué Expo y no Firebase ──────────────────────────────────────────────
 * `notificationService.ts` dejó preparado un hueco para Firebase Admin, pero
 * ese camino exige una cuenta de servicio de Firebase, `google-services.json` y
 * los certificados APNs de Apple, y hay que renovarlos. Esta app se construye y
 * se distribuye con Expo, que ya tiene su propio servicio de envío: el teléfono
 * pide un identificador y el servidor manda a una dirección pública. **Cero
 * credenciales que guardar, rotar o filtrar.**
 *
 * Si algún día se sale de Expo, se cambia este archivo y nada más: los
 * controladores llaman a `pushTo`, no al proveedor.
 *
 * ── Dónde se guarda el identificador ────────────────────────────────────────
 * En `users.fcm_token`, que ya existía. El nombre se queda por no migrar una
 * columna que hace exactamente lo mismo: guardar a qué aparato se avisa. Lo que
 * cambia es quién la lee.
 *
 * ── Lo que este archivo NO hace ─────────────────────────────────────────────
 * No decide a quién se avisa ni de qué. Eso lo deciden `notify()` y el
 * controlador de mensajes, que ya saben de privacidad. Aquí solo se entrega.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send'

/** Expo acepta cien mensajes por petición. */
const LOTE = 100

export interface PushPayload {
  title: string
  body: string
  /** Viaja con el aviso: la app lo usa para abrir la pantalla que toca. */
  data?: Record<string, string>
  /** Suma al globito del icono. */
  badge?: number
}

/** Un identificador de Expo tiene esta forma. Cualquier otra cosa no se manda. */
const VALIDO = /^ExponentPushToken\[[^\]]+\]$/

/**
 * Avisa a una persona.
 *
 * Nunca lanza: que falle un aviso no puede tumbar la acción que lo provocó. Si
 * alguien te escribe y el push se cae, el mensaje se guardó igual y lo verás al
 * abrir la app — al revés sería imperdonable.
 */
export async function pushTo(userId: string, payload: PushPayload): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('fcm_token')
    .eq('id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data?.fcm_token) return false
  return pushToTokens([data.fcm_token], payload)
}

/**
 * Avisa a varios aparatos de una tacada.
 *
 * Los identificadores caducados o revocados se borran de la base con lo que
 * responde Expo: si no, cada aviso siguiente vuelve a intentarlo contra un
 * teléfono que ya no existe, y la lista de destinos solo crece.
 */
export async function pushToTokens(tokens: string[], payload: PushPayload): Promise<boolean> {
  const limpios = [...new Set(tokens.filter(t => VALIDO.test(t)))]
  if (!limpios.length) return false

  let ok = true
  for (let i = 0; i < limpios.length; i += LOTE) {
    const lote = limpios.slice(i, i + LOTE)
    try {
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept-encoding': 'gzip, deflate' },
        body: JSON.stringify(lote.map(to => ({
          to,
          sound: 'default',
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
          badge: payload.badge,
          // Los avisos de la comunidad se agrupan aparte de los recordatorios
          // de comida o entreno: son cosas distintas y el teléfono no debe
          // apilarlas juntas.
          channelId: 'comunidad',
        }))),
      })

      if (!res.ok) {
        logger.warn(`push · Expo respondió ${res.status}`)
        ok = false
        continue
      }

      const cuerpo = await res.json() as { data?: { status: string; details?: { error?: string } }[] }
      const muertos: string[] = []
      cuerpo.data?.forEach((r, j) => {
        if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') {
          muertos.push(lote[j])
        }
      })
      if (muertos.length) await olvidarTokens(muertos)
    } catch (e) {
      logger.warn(`push · no se pudo entregar: ${(e as Error).message}`)
      ok = false
    }
  }
  return ok
}

/** Borra de la base los aparatos que Expo dice que ya no existen. */
async function olvidarTokens(tokens: string[]): Promise<void> {
  const { error } = await supabase
    .from('users').update({ fcm_token: null }).in('fcm_token', tokens)
  if (error) logger.warn(`push · limpiando tokens: ${error.message}`)
  else logger.info(`push · ${tokens.length} aparato(s) dados de baja`)
}

// ── Textos ───────────────────────────────────────────────────────────────────

/**
 * Qué dice cada aviso.
 *
 * Están juntos para que se lean de una vez y suenen a la misma app. El nombre
 * de quien lo provoca va SIEMPRE delante: en la pantalla bloqueada solo se leen
 * las primeras palabras.
 *
 * El texto del mensaje NO se incluye en el push de un chat: aparecería en la
 * pantalla bloqueada de un teléfono que puede estar sobre una mesa. Se dice que
 * hay mensaje, no lo que dice.
 */
export const TEXTOS = {
  like:            (quien: string) => ({ title: quien, body: 'le gustó tu publicación' }),
  comment:         (quien: string, texto?: string) => ({
    title: quien, body: texto ? `comentó: ${recorta(texto, 80)}` : 'comentó tu publicación',
  }),
  follow:          (quien: string) => ({ title: quien, body: 'empezó a seguirte' }),
  follow_request:  (quien: string) => ({ title: quien, body: 'quiere seguirte' }),
  follow_accepted: (quien: string) => ({ title: quien, body: 'aceptó tu solicitud' }),
  mention:         (quien: string) => ({ title: quien, body: 'te mencionó' }),
  message:         (quien: string) => ({ title: quien, body: 'te envió un mensaje' }),
  message_request: (quien: string) => ({ title: quien, body: 'quiere escribirte' }),
}

const recorta = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

/** El nombre con el que se anuncia a alguien en un aviso. */
export async function nombreDe(userId: string): Promise<string> {
  const { data } = await supabase
    .from('users').select('username, full_name').eq('id', userId).maybeSingle()
  return data?.full_name || (data?.username ? `@${data.username}` : 'Alguien')
}
