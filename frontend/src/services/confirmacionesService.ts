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
}

export interface Confirmaciones {
  pendientes: Confirmacion[]
  deshacibles: Confirmacion[]
}

/**
 * ⚠️ NADIE LA LLAMA TODAVÍA, y no es un olvido.
 *
 * Sirve para repintar las tarjetas al volver al chat: las propuestas que
 * siguen abiertas y los cambios que aún se pueden deshacer. Pero la pantalla
 * de chat hoy no recupera su conversación —arranca con un saludo y nada más—,
 * así que no hay mensajes debajo de los cuales colgarlas.
 *
 * Colgarlas de cualquier sitio sería peor que no enseñarlas: una tarjeta suelta
 * sin la frase de ZENA que la explica es un botón que cambia tus calorías sin
 * decir por qué. Se conecta cuando el chat cargue su historial.
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
