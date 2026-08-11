/**
 * COMUNIDAD · AUTORIZACIÓN
 * ────────────────────────
 * Punto único por el que pasa toda decisión de «¿esta persona puede ver o hacer
 * esto?». Ningún controlador de comunidad consulta permisos por su cuenta.
 *
 * ── Por qué un solo módulo ──────────────────────────────────────────────────
 * La autenticación de la app es propia (JWT del backend), no Supabase Auth, así
 * que dentro de Postgres no existe `auth.uid()` y las políticas RLS no pueden
 * saber quién pregunta. RLS queda como cierre general —nadie lee nada con la
 * clave pública— pero el reparto fino de privacidad no puede vivir ahí.
 *
 * Eso deja al backend como único guardián. Con veinte endpoints comprobando
 * permisos cada uno a su manera, la pregunta no es SI se olvidará una
 * comprobación, sino cuándo. Aquí están todas juntas: se leen de una vez, se
 * prueban de una vez, y añadir un endpoint es llamar a una función, no
 * reinventar la regla.
 *
 * ── La regla de oro de los datos ────────────────────────────────────────────
 * La tabla `users` tiene 39 columnas: hash de contraseña, correo, token de
 * recuperación, peso, condiciones de salud, huella del dispositivo. Nada de eso
 * puede salir jamás en una respuesta social.
 *
 * Por eso `PUBLIC_FIELDS` es una lista BLANCA. Con una lista negra, el día que
 * alguien añada una columna sensible a `users` se filtraría sola por no estar
 * en la lista de exclusión. Con lista blanca, una columna nueva es invisible
 * hasta que alguien decide, a mano, que puede verse.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'

/** Lo ÚNICO que puede salir de `users` hacia otra persona. Lista blanca. */
export const PUBLIC_FIELDS = 'id, username, full_name, profile_picture, bio, is_private' as const

export interface PublicProfile {
  id: string
  username: string | null
  fullName: string | null
  avatar: string | null
  bio: string | null
  isPrivate: boolean
}

/** Traduce la fila cruda al perfil público. Nada que no esté aquí sale. */
export function toPublicProfile(row: any): PublicProfile {
  return {
    id: row.id,
    username: row.username ?? null,
    fullName: row.full_name ?? null,
    avatar: row.profile_picture ?? null,
    bio: row.bio ?? null,
    isPrivate: !!row.is_private,
  }
}

/** Relación del que mira con el mirado. */
export type Relation =
  | 'self'        // es su propio perfil
  | 'following'   // le sigue y la solicitud está aceptada
  | 'requested'   // ha pedido seguirle y está pendiente
  | 'none'        // no hay relación

export interface Viewer {
  id: string
}

/**
 * Estado de la relación entre dos personas.
 *
 * Una sola consulta: quién sigue a quién y en qué estado. El resto de funciones
 * se apoyan en esta para no repetir viajes a la base.
 */
export async function relationOf(viewerId: string, targetId: string): Promise<Relation> {
  if (viewerId === targetId) return 'self'

  const { data, error } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', viewerId)
    .eq('following_id', targetId)
    .maybeSingle()

  if (error) {
    // Ante la duda, se niega. Un error de red no puede abrir una cuenta privada.
    logger.error(`social · relationOf ${viewerId}→${targetId}: ${error.message}`)
    return 'none'
  }
  if (!data) return 'none'
  return data.status === 'accepted' ? 'following' : 'requested'
}

/** Ficha básica de la persona mirada, con su privacidad. */
async function loadTarget(targetId: string) {
  const { data, error } = await supabase
    .from('users')
    .select(PUBLIC_FIELDS)
    .eq('id', targetId)
    .maybeSingle()
  if (error) {
    logger.error(`social · loadTarget ${targetId}: ${error.message}`)
    return null
  }
  return data
}

export interface Access {
  /** Existe y se puede nombrar: foto, usuario, biografía. */
  profile: boolean
  /** Se puede ver lo que publica, sus historias y sus listas de seguidores. */
  content: boolean
  relation: Relation
  target: PublicProfile | null
}

/**
 * Qué puede ver alguien de otra persona.
 *
 * El perfil BÁSICO de una cuenta privada sí se ve —nombre, foto, biografía y el
 * hecho de que es privada—: si no, no habría forma de encontrarla para pedirle
 * seguirla, que es justo lo que la persona quiere que pase. Lo que se cierra es
 * el CONTENIDO: publicaciones, historias y listas de seguidores.
 */
export async function accessTo(viewerId: string, targetId: string): Promise<Access> {
  const row = await loadTarget(targetId)
  if (!row) return { profile: false, content: false, relation: 'none', target: null }

  const relation = await relationOf(viewerId, targetId)
  const target = toPublicProfile(row)

  const content =
    relation === 'self' || !target.isPrivate || relation === 'following'

  return { profile: true, content, relation, target }
}

/**
 * Identificadores cuyo contenido puede ver esta persona.
 *
 * Lo usa el muro para filtrar en una sola consulta en vez de preguntar por cada
 * publicación: se piden los autores permitidos y se acota la búsqueda a ellos.
 */
export async function visibleAuthorIds(viewerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', viewerId)
    .eq('status', 'accepted')

  if (error) {
    logger.error(`social · visibleAuthorIds ${viewerId}: ${error.message}`)
    return [viewerId]
  }
  return [viewerId, ...(data ?? []).map(r => r.following_id)]
}

export interface MessagePermission {
  /** Se le puede escribir. */
  allowed: boolean
  /** El primer mensaje queda como solicitud hasta que la otra parte acepte. */
  needsRequest: boolean
  reason?: string
}

/**
 * Si esta persona puede escribir a la otra.
 *
 * Cuenta pública: se escribe sin más. Cuenta privada: el mensaje se guarda pero
 * la conversación nace `pending` y no aparece en la bandeja del destinatario
 * hasta que la acepta — que es lo que pediste, y también lo que impide usar los
 * mensajes para colarse en una cuenta cerrada.
 *
 * Excepción razonable: si la persona privada YA te sigue, ha decidido tenerte
 * cerca, así que no hay solicitud.
 */
export async function canMessage(viewerId: string, targetId: string): Promise<MessagePermission> {
  if (viewerId === targetId) {
    return { allowed: false, needsRequest: false, reason: 'No puedes escribirte a ti mismo' }
  }

  const row = await loadTarget(targetId)
  if (!row) return { allowed: false, needsRequest: false, reason: 'Ese usuario no existe' }

  if (!row.is_private) return { allowed: true, needsRequest: false }

  // ¿El destinatario me sigue? Entonces ya me ha dejado entrar.
  const inverse = await relationOf(targetId, viewerId)
  if (inverse === 'following') return { allowed: true, needsRequest: false }

  return { allowed: true, needsRequest: true }
}

/**
 * Comprueba que alguien pertenece a una conversación.
 *
 * Es la única puerta a los mensajes directos y no admite matices: o eres uno de
 * los dos, o no existe para ti. Aquí no hay «amigo de», ni administrador, ni
 * cuenta pública que valga.
 */
export async function isConversationMember(
  userId: string,
  conversationId: string,
): Promise<{ ok: boolean; other?: string; status?: string }> {
  const { data, error } = await supabase
    .from('conversations')
    .select('user_lo, user_hi, status')
    .eq('id', conversationId)
    .maybeSingle()

  if (error || !data) return { ok: false }
  if (data.user_lo !== userId && data.user_hi !== userId) return { ok: false }

  return {
    ok: true,
    other: data.user_lo === userId ? data.user_hi : data.user_lo,
    status: data.status,
  }
}

/**
 * Par ordenado para la clave única de `conversations`.
 *
 * El orden lo fija el propio identificador, no quién escribió primero: así dos
 * personas no pueden acabar con dos conversaciones distintas entre ellas según
 * quién abriera el chat.
 */
export function conversationPair(a: string, b: string): { lo: string; hi: string } {
  return a < b ? { lo: a, hi: b } : { lo: b, hi: a }
}
