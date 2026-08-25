import AsyncStorage from '@react-native-async-storage/async-storage'
import api from './api'
import { listarConfirmaciones, type Confirmacion } from './confirmacionesService'

/**
 * ── Lo que ya NO se manda ───────────────────────────────────────────────────
 *
 * Aquí había un `CoachContext` —calorías de hoy, agua, racha, ánimo— que la
 * pantalla componía en cada mensaje y el servidor tiraba sin leer: su esquema
 * de validación solo acepta `content`. Dos de sus campos, además, eran
 * literales escritos a mano (`caloriesTarget: 2000`, `proteinTarget: 150`), o
 * sea que si alguien llegaba a leerlos, leía la meta de otra persona.
 *
 * El día del usuario lo lee el servidor de la base, que es donde está de
 * verdad. Lo mismo con `history`: el servidor recupera los últimos mensajes
 * guardados, así que mandárselos desde aquí solo era peso en cada petición.
 */

export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  /**
   * Lo que ZENA propuso en este mensaje y aún no está aplicado (§10).
   *
   * Va colgado del mensaje y no en una lista aparte porque la tarjeta tiene
   * que salir DEBAJO de lo que ZENA acaba de decir. Separadas, el texto
   * («te bajo 150 kcal, ¿lo confirmas?») y el botón acaban a distinta altura
   * en cuanto la conversación sigue.
   */
  confirmaciones?: Confirmacion[]
}

/** Lo que contesta el servidor a un mensaje: el texto y lo que haya propuesto. */
export interface RespuestaCoach {
  texto: string
  confirmaciones: Confirmacion[]
}

const SESSION_KEY = 'coach_session_id'

async function getOrCreateSession(): Promise<string> {
  const cached = await AsyncStorage.getItem(SESSION_KEY)
  if (cached) return cached

  const title = `Coach ${new Date().toLocaleDateString('es-MX')}`
  const { data } = await api.post('/chat/sessions', { title })
  const sessionId: string = data?.data?.session?.id
  if (!sessionId) throw new Error('No se pudo crear la sesión de chat')
  await AsyncStorage.setItem(SESSION_KEY, sessionId)
  return sessionId
}

export async function resetSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY)
}

/**
 * Cierra la conversación de hoy y deja una en blanco para la próxima.
 *
 * Se archiva en vez de borrarse: `buscar_en_memoria` lee también las cerradas,
 * así que lo que el usuario ya contó —una lesión, que no come pescado— sigue
 * estando cuando lo mencione dentro de tres semanas. Borrarla lo perdería sin
 * que nadie hubiera pedido olvidarlo.
 *
 * Si el archivado falla, la sesión local se suelta igual: lo que el usuario
 * pidió es empezar de cero, y una fila marcada `active` en el servidor no es
 * motivo para negárselo.
 */
export async function cerrarConversacion(): Promise<void> {
  const id = await AsyncStorage.getItem(SESSION_KEY)
  if (id) {
    try { await api.patch(`/chat/sessions/${id}/archive`) } catch { /* da igual */ }
  }
  await AsyncStorage.removeItem(SESSION_KEY)
}

// ── Recuperar la conversación ────────────────────────────────────────────────

/** Lo que hay al abrir el chat: el hilo y lo que sigue pudiendo deshacerse. */
export interface HiloCargado {
  mensajes: CoachMessage[]
  /**
   * Cambios ya aplicados dentro de sus 24 h de gracia. Vienen aparte porque la
   * pantalla necesita saber que esas tarjetas nacen resueltas — con su botón
   * de deshacer— y no abiertas esperando un sí que ya se dio.
   */
  deshacibles: Confirmacion[]
}

/** Una fila de `messages` tal y como la devuelve el servidor. */
interface MensajeServidor {
  id: string
  sender_type: 'ai' | 'user'
  content: string
  created_at: string
}

/**
 * El hilo entero, con sus tarjetas en su sitio.
 *
 * Hasta ahora esta pantalla arrancaba con un saludo inventado y nada más,
 * mientras el servidor mandaba al modelo los diez últimos mensajes de la base:
 * ZENA se acordaba de una conversación que el usuario ya no tenía delante, y
 * respondía a un «¿y entonces?» sin que en pantalla hubiera un «entonces».
 *
 * Las propuestas se cuelgan por `message_id`, que es lo que las ata al mensaje
 * de ZENA que las explica. Una tarjeta suelta, sin la frase que la justifica,
 * es un botón que cambia tus calorías sin decir por qué.
 */
export async function cargarHilo(): Promise<HiloCargado> {
  const sessionId = await getOrCreateSession()

  let mensajes: MensajeServidor[]
  try {
    mensajes = await leerMensajes(sessionId)
  } catch (err: any) {
    // La sesión guardada ya no existe —se archivó, se borró, o es de la cuenta
    // que usaba antes este teléfono—. Se abre una nueva y se sigue.
    if (err?.response?.status !== 404) throw err
    await AsyncStorage.removeItem(SESSION_KEY)
    mensajes = await leerMensajes(await getOrCreateSession())
  }

  /**
   * Las tarjetas son un extra: si esta llamada falla, el hilo se enseña igual.
   *
   * Perder las propuestas pendientes es una molestia —vuelven en cuanto haya
   * red—; perder la conversación entera por ellas sería un fallo.
   */
  let pendientes: Confirmacion[] = []
  let deshacibles: Confirmacion[] = []
  try {
    const c = await listarConfirmaciones()
    pendientes = c.pendientes
    deshacibles = c.deshacibles
  } catch { /* el hilo va sin tarjetas */ }

  const porMensaje = new Map<string, Confirmacion[]>()
  for (const c of [...pendientes, ...deshacibles]) {
    if (!c.message_id) continue
    porMensaje.set(c.message_id, [...(porMensaje.get(c.message_id) ?? []), c])
  }

  const visibles: CoachMessage[] = mensajes.filter(esVisible).map(m => ({
    id: m.id,
    role: m.sender_type === 'ai' ? 'assistant' : 'user',
    content: m.content,
    timestamp: Date.parse(m.created_at) || Date.now(),
    confirmaciones: porMensaje.get(m.id),
  }))

  return {
    mensajes: visibles.length ? visibles : [createMessage('assistant', SALUDO_LOCAL)],
    deshacibles,
  }
}

/**
 * El aviso legal viejo no se enseña.
 *
 * Las conversaciones abiertas antes de agosto de 2026 empiezan con un párrafo
 * en markdown crudo —«⚕️ **Aviso importante:**…»— que además se presentaba como
 * ZENCRUS, que es la app y no la coach. Estaba escondido porque el chat no
 * recuperaba su historial; en cuanto lo recupera, es lo primero que se lee.
 *
 * No se borra de la base: el modelo lo sigue recibiendo como contexto y borrar
 * mensajes de una conversación para maquillarla es peor que ocultar uno al
 * pintarla. Los hilos nuevos ya nacen con el saludo bueno.
 */
const esVisible = (m: MensajeServidor) =>
  !(m.sender_type === 'ai' && m.content.startsWith('⚕️'))

/**
 * El saludo cuando el hilo se queda sin nada que enseñar.
 *
 * Pasa en las conversaciones viejas: su único mensaje era el aviso legal que
 * acabamos de ocultar, así que la pantalla salía en blanco — justo lo que este
 * trabajo venía a quitar, un chat vacío que parece una conversación perdida.
 *
 * Es un mensaje LOCAL: no se guarda ni se le manda al modelo. El saludo de
 * verdad lo escribe el servidor al crear una sesión, y los hilos nuevos ya
 * nacen con él; este solo tapa el hueco de los que nacieron antes.
 */
const SALUDO_LOCAL = [
  'Hola, soy ZENA, tu coach de nutrición y fitness en ZENCRUS.',
  '',
  'Conozco tu registro, tu entrenamiento y tus metas, así que no hace falta que',
  'me pongas al día: pregúntame directamente.',
].join('\n')

async function leerMensajes(sessionId: string): Promise<MensajeServidor[]> {
  const { data } = await api.get(`/chat/sessions/${sessionId}`)
  return data?.data?.messages ?? []
}

/**
 * Cuánto se espera a ZENA.
 *
 * Los 15 s del resto de la app se le quedan cortos y eso rompía el chat de la
 * peor manera posible: el servidor terminaba —a veces en 15,4 s— guardaba la
 * respuesta, y el móvil ya se había rendido. El usuario veía «Ocurrió un
 * error» mientras la contestación estaba escrita en la base de datos.
 *
 * Con herramientas es peor: cada ronda es otra llamada al modelo, y pedirle que
 * busque un alimento y lo apunte son dos como mínimo.
 *
 * El número no es al azar: el servidor corta su bucle a los 55 s, así que aquí
 * se espera un poco más. Al revés —cliente por debajo del servidor— es
 * precisamente lo que producía el error fantasma.
 */
const ESPERA_CHAT_MS = 70_000

/** La fecha del usuario, para que el día en que ZENA apunte sea el suyo. */
const cabeceraFecha = () => ({
  'X-Zona-Fecha': new Date().toLocaleDateString('en-CA'),
})

export async function sendMessage(message: string): Promise<RespuestaCoach> {
  const sessionId = await getOrCreateSession()

  try {
    const { data } = await api.post(`/chat/sessions/${sessionId}/messages`, {
      content: message,
    }, { timeout: ESPERA_CHAT_MS, headers: cabeceraFecha() })
    return leerRespuesta(data)
  } catch (err: any) {
    if (err?.response?.status === 404) {
      await AsyncStorage.removeItem(SESSION_KEY)
      const newSessionId = await getOrCreateSession()
      const { data } = await api.post(`/chat/sessions/${newSessionId}/messages`, {
        content: message,
      }, { timeout: ESPERA_CHAT_MS, headers: cabeceraFecha() })
      return leerRespuesta(data)
    }
    throw err
  }
}

function leerRespuesta(data: any): RespuestaCoach {
  return {
    texto: data?.data?.aiMessage?.content ?? 'No pude generar una respuesta. Intenta de nuevo.',
    confirmaciones: data?.data?.confirmaciones ?? [],
  }
}

export function createMessage(
  role: 'user' | 'assistant',
  content: string,
  confirmaciones?: Confirmacion[],
): CoachMessage {
  return { id: Date.now().toString() + Math.random(), role, content, timestamp: Date.now(), confirmaciones }
}
