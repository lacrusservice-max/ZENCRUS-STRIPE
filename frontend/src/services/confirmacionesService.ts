import api from './api'

/**
 * Las propuestas de ZENA que espera confirmación. §10.
 *
 * Este servicio manda IDs, nunca valores. Lo que se va a aplicar ya está
 * calculado y validado en el servidor desde que ZENA lo propuso; si desde aquí
 * se pudieran mandar los números, la tarjeta enseñaría una cosa y se guardaría
 * otra — y la tarjeta es justo lo que el usuario está aprobando.
 */

/** Una fila del antes y el después. */
export interface CambioPropuesto {
  etiqueta: string
  antes: string | number | null
  despues: string | number | null
  unidad?: string
}

export interface Confirmacion {
  id: string
  herramienta: string
  resumen: string
  cambios: CambioPropuesto[]
  /** Cuándo deja de poder confirmarse. */
  expira_at: string
  /** Solo en las ya aplicadas: desde cuándo corren las 24 h para deshacer. */
  resuelta_at?: string
  /**
   * Debajo de qué mensaje de ZENA va la tarjeta.
   *
   * Viene vacío en la respuesta al propio mensaje —ahí la app ya sabe dónde
   * ponerla— y lleno al recuperar el hilo, que es cuando hace falta para
   * volver a colocarla en su sitio.
   */
  message_id?: string | null
}

export interface Confirmaciones {
  pendientes: Confirmacion[]
  deshacibles: Confirmacion[]
}

/**
 * Las tarjetas al volver al chat: lo que sigue abierto y lo que aún se puede
 * deshacer.
 *
 * Se cuelgan por `message_id`, debajo del mensaje de ZENA que las explica. Una
 * tarjeta suelta, sin la frase que la justifica, sería un botón que cambia tus
 * calorías sin decir por qué — por eso las que no traen `message_id` no se
 * pintan en ningún sitio. La usa `cargarHilo` en `aiCoachService`.
 */
export async function listarConfirmaciones(): Promise<Confirmaciones> {
  const { data } = await api.get('/confirmaciones')
  return data?.data ?? { pendientes: [], deshacibles: [] }
}

/**
 * El resultado de responder a una propuesta.
 *
 * `ok: false` no siempre es un fallo: lo normal es que la propuesta caducara o
 * que ya se hubiera resuelto en otro sitio. El servidor manda el texto que hay
 * que enseñar en cada caso, así que la app no lo inventa.
 */
export interface Respuesta {
  ok: boolean
  mensaje: string
}

async function responder(id: string, accion: 'confirmar' | 'cancelar' | 'deshacer'): Promise<Respuesta> {
  try {
    const { data } = await api.post(`/confirmaciones/${id}/${accion}`)
    return { ok: true, mensaje: data?.message ?? 'Listo.' }
  } catch (err: any) {
    const mensaje = err?.response?.data?.message
    if (mensaje) return { ok: false, mensaje }
    return { ok: false, mensaje: 'No se pudo completar. Revisa tu conexión y vuelve a intentarlo.' }
  }
}

export const confirmar = (id: string) => responder(id, 'confirmar')
export const cancelar = (id: string) => responder(id, 'cancelar')
export const deshacer = (id: string) => responder(id, 'deshacer')
