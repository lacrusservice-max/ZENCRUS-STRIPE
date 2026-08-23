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
import { readUrls, isStoredKey } from './media'

/** Lo ÚNICO que puede salir de `users` hacia otra persona. Lista blanca. */
export const PUBLIC_FIELDS = 'id, username, full_name, profile_picture, bio, is_private' as const

/**
 * Lo mismo MÁS la portada.
 *
 * La portada no está en `PUBLIC_FIELDS` a propósito: esa lista la usan las
 * listas de seguidores, la búsqueda y los autores de cada comentario, donde la
 * portada no se pinta. Traerla ahí obligaría a firmar una dirección más por
 * cada cara de la lista, y son direcciones firmadas que caducan: puro gasto.
 */
export const PROFILE_FIELDS = `${PUBLIC_FIELDS}, cover_image` as const

export interface PublicProfile {
  id: string
  username: string | null
  fullName: string | null
  avatar: string | null
  bio: string | null
  isPrivate: boolean
  /** Portada elegida. `null` = la pantalla cae a la última publicación. */
  coverImage: string | null
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
    // Sale `null` cuando la consulta no pidió la columna, que es lo correcto:
    // en una lista de caras no hay portada que enseñar.
    coverImage: row.cover_image ?? null,
  }
}

/**
 * Firma los avatares que viven en el bucket.
 *
 * La foto de perfil se guarda como CLAVE, no como dirección: el bucket es
 * privado y una dirección fija sería acceso permanente a algo que la persona
 * puede cambiar o borrar mañana. Se firman todas de una tacada porque una lista
 * de veinte comentarios trae veinte avatares, y firmarlos de uno en uno son
 * veinte esperas.
 *
 * Quien tenga guardada una dirección externa de antes se queda como está.
 *
 * Toda respuesta que lleve perfiles pasa por aquí. Si algún día aparece una que
 * no, se verá enseguida: el avatar sale como una ruta suelta que no carga.
 */
export async function signAvatars<T extends { avatar: string | null }>(perfiles: T[]): Promise<T[]> {
  const claves = [...new Set(perfiles.map(p => p.avatar).filter(isStoredKey))]
  if (!claves.length) return perfiles

  const firmadas = await readUrls(claves)
  for (const p of perfiles) {
    if (isStoredKey(p.avatar)) p.avatar = firmadas.get(p.avatar) ?? null
  }
  return perfiles
}

/**
 * Firma la portada. Aparte de `signAvatars` porque solo hacen falta las dos
 * pantallas de perfil, no las listas.
 */
export async function signCover<T extends { coverImage: string | null }>(perfil: T): Promise<T> {
  if (!isStoredKey(perfil.coverImage)) return perfil
  const firmadas = await readUrls([perfil.coverImage])
  perfil.coverImage = firmadas.get(perfil.coverImage) ?? null
  return perfil
}

/** Atajo para cuando solo hay uno. */
export async function signAvatar<T extends { avatar: string | null }>(perfil: T): Promise<T> {
  return (await signAvatars([perfil]))[0]
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

/**
 * Ficha básica de la persona mirada, con su privacidad.
 *
 * Una cuenta desactivada no existe para nadie: ni perfil, ni contenido, ni
 * mensajes. La búsqueda ya la escondía, pero entrando por el identificador
 * seguía apareciendo — y quien se da de baja espera desaparecer entero, no solo
 * de una lista.
 *
 * `is_active` se pide aparte y se tira antes de devolver: `PUBLIC_FIELDS` es la
 * lista blanca de lo que sale, y esta columna no está en ella.
 */
async function loadTarget(targetId: string) {
  const { data, error } = await supabase
    .from('users')
    .select(`${PROFILE_FIELDS}, is_active`)
    .eq('id', targetId)
    .maybeSingle()
  if (error) {
    logger.error(`social · loadTarget ${targetId}: ${error.message}`)
    return null
  }
  if (!data || data.is_active === false) return null

  const { is_active, ...publico } = data as Record<string, unknown>
  return publico
}

// ── Bloqueos ─────────────────────────────────────────────────────────────────

/**
 * Si hay un bloqueo entre dos personas, en cualquiera de los dos sentidos.
 *
 * La fila de `blocks` es dirigida —hace falta saber quién bloqueó para que solo
 * esa persona pueda deshacerlo—, pero para decidir qué se ve da igual el
 * sentido: si te bloqueé, tampoco quiero verte yo.
 *
 * ── Por qué esto REVIENTA en vez de devolver «no hay bloqueo» ───────────────
 * El resto del módulo, ante un error de consulta, niega el acceso. Aquí no se
 * puede hacer lo mismo devolviendo algo: «no hay bloqueo» es justamente la
 * respuesta que ABRE la puerta, y un fallo de red acabaría enseñándole a
 * alguien el perfil de quien le bloqueó. Así que se lanza, la petición muere
 * con un 500 y la app enseña «no pudimos cargar» con su botón de reintentar.
 * Ver de menos se arregla tocando otra vez; ver de más, no.
 */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  if (a === b) return false

  const { data, error } = await supabase
    .from('blocks')
    .select('blocker_id')
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1)

  if (error) {
    logger.error(`social · isBlockedBetween ${a}↔${b}: ${error.message}`)
    throw new Error('No pudimos comprobar el bloqueo')
  }
  return (data?.length ?? 0) > 0
}

/**
 * Todos los identificadores con los que esta persona tiene un bloqueo.
 *
 * Lo usan las listas —muros, historias, buscador— para descartar de una vez en
 * lugar de preguntar por cada fila. Revienta ante error por la misma razón que
 * `isBlockedBetween`.
 */
export async function blockedIds(viewerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`)

  if (error) {
    logger.error(`social · blockedIds ${viewerId}: ${error.message}`)
    throw new Error('No pudimos comprobar los bloqueos')
  }
  return (data ?? []).map(r => (r.blocker_id === viewerId ? r.blocked_id : r.blocker_id))
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

  // Un bloqueo devuelve exactamente lo mismo que una cuenta que no existe: ni
  // perfil, ni contenido, ni pista de que la cuenta esté ahí. Si dijera «te ha
  // bloqueado», el bloqueo sería una notificación —y quien bloquea suele querer
  // desaparecer, no anunciarse.
  if (await isBlockedBetween(viewerId, targetId)) {
    return { profile: false, content: false, relation: 'none', target: null }
  }

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
  // El cruce interno con `users` deja fuera a las cuentas desactivadas, para
  // que desaparezcan también del muro de amigos y de las historias, no solo del
  // buscador. Ante error se devuelve solo uno mismo: se ve de menos, nunca de más.
  const { data, error } = await supabase
    .from('follows')
    .select('following_id, seguido:users!follows_following_id_fkey!inner(is_active)')
    .eq('follower_id', viewerId)
    .eq('status', 'accepted')
    .eq('seguido.is_active', true)

  if (error) {
    logger.error(`social · visibleAuthorIds ${viewerId}: ${error.message}`)
    return [viewerId]
  }

  // Bloquear a alguien no borra el seguimiento —para poder devolverlo al
  // desbloquear—, así que hay que descartarlo aquí. Sin esto, quien bloqueaste
  // seguiría apareciendo en tu muro de amigos y en tus historias.
  const bloqueados = new Set(await blockedIds(viewerId))
  return [
    viewerId,
    ...(data ?? []).map(r => r.following_id).filter(id => !bloqueados.has(id)),
  ]
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

  // Mismo mensaje que si no existiera, por lo mismo que en `accessTo`: el
  // bloqueo no se anuncia.
  if (await isBlockedBetween(viewerId, targetId)) {
    return { allowed: false, needsRequest: false, reason: 'Ese usuario no existe' }
  }

  if (!row.is_private) return { allowed: true, needsRequest: false }

  // ¿El destinatario me sigue? Entonces ya me ha dejado entrar.
  const inverse = await relationOf(targetId, viewerId)
  if (inverse === 'following') return { allowed: true, needsRequest: false }

  return { allowed: true, needsRequest: true }
}

/**
 * Cuántos mensajes puede dejar quien aún no ha sido aceptado.
 *
 * Sin tope, una solicitud sin responder sería un canal libre para gritarle a
 * alguien indefinidamente: basta con no aceptar nunca y el otro sigue
 * escribiendo. Tres bastan para presentarse; a partir de ahí hace falta que la
 * otra persona diga que sí.
 */
export const MAX_PENDING_MESSAGES = 3

/** Fila de `conversations` tal y como se necesita para decidir. */
export interface ConversationRow {
  id: string
  user_lo: string
  user_hi: string
  status: 'pending' | 'accepted' | 'blocked'
  requested_by: string | null
  last_message_at: string | null
}

export interface ConversationAccess {
  /** Existe y quien pregunta es uno de los dos. Si no, no existe para él. */
  member: boolean
  conv: ConversationRow | null
  /** El otro participante. */
  other?: string
  /** Puede leer lo que ya hay: los dos pueden, también con la solicitud sin responder. */
  canRead: boolean
  /** Puede enviar ahora mismo. */
  canWrite: boolean
  /** Enviar aquí convierte la solicitud en conversación aceptada. */
  accepting: boolean
  /** Qué responder cuando no se puede escribir. */
  code?: number
  reason?: string
}

/**
 * Todo lo que hay que saber para dejar a alguien leer o escribir en un chat.
 *
 * ── Qué significa `requested_by` ────────────────────────────────────────────
 * «Quien necesita permiso del otro». Es una sola columna y cubre los dos casos
 * sin inventarse ninguna más:
 *
 *   · A escribe a B, que es privada  → `pending`, `requested_by = A`.
 *     A puede dejar hasta tres mensajes; B los ve en su bandeja de solicitudes.
 *   · B rechaza                      → `blocked`, `requested_by = A`.
 *     A deja de poder escribir. B puede reabrirla aceptando.
 *   · B bloquea una conversación ya aceptada → `blocked`, `requested_by = A`,
 *     el bloqueado. Quien figura en esa columna es siempre el que no puede
 *     escribir mientras el otro no consienta, y por eso solo el otro reabre.
 *
 * Con `blocked` no escribe nadie, ni siquiera quien bloqueó: reabrir es un acto
 * explícito, no un descuido al teclear.
 *
 * ── Por qué rechazar no borra ───────────────────────────────────────────────
 * Si rechazar borrase la fila, el rechazado podría volver a solicitar acto
 * seguido, y otra vez, y otra. La fila bloqueada es justamente lo que recuerda
 * que ya dijiste que no.
 */
export async function conversationAccess(
  userId: string,
  conversationId: string,
): Promise<ConversationAccess> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_lo, user_hi, status, requested_by, last_message_at')
    .eq('id', conversationId)
    .maybeSingle()

  // Ante error de consulta se niega, igual que en el resto del módulo.
  if (error) logger.error(`social · conversationAccess ${conversationId}: ${error.message}`)
  if (error || !data) {
    return { member: false, conv: null, canRead: false, canWrite: false, accepting: false }
  }
  if (data.user_lo !== userId && data.user_hi !== userId) {
    return { member: false, conv: null, canRead: false, canWrite: false, accepting: false }
  }

  const conv = data as ConversationRow
  const other = conv.user_lo === userId ? conv.user_hi : conv.user_lo
  const base = { member: true, conv, other, canRead: true }

  if (conv.status === 'blocked') {
    return {
      ...base, canWrite: false, accepting: false, code: 403,
      reason: conv.requested_by === userId
        ? 'Esta persona no acepta tus mensajes'
        : 'Has bloqueado esta conversación',
    }
  }

  if (conv.status === 'accepted') {
    return { ...base, canWrite: true, accepting: false }
  }

  // Pendiente. Quien la abrió tiene cupo; quien la recibió, al contestar, la
  // acepta — responder a alguien es la forma más clara de decir que sí.
  if (conv.requested_by !== userId) {
    return { ...base, canWrite: true, accepting: true }
  }

  const { count, error: e2 } = await supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conv.id)
    .eq('sender_id', userId)

  if (e2) {
    logger.error(`social · conversationAccess cupo ${conv.id}: ${e2.message}`)
    return { ...base, canWrite: false, accepting: false, code: 500, reason: 'No pudimos comprobarlo' }
  }
  if ((count ?? 0) >= MAX_PENDING_MESSAGES) {
    return {
      ...base, canWrite: false, accepting: false, code: 429,
      reason: 'Espera a que acepte tu solicitud para seguir escribiendo',
    }
  }
  return { ...base, canWrite: true, accepting: false }
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
  const a = await conversationAccess(userId, conversationId)
  if (!a.member || !a.conv) return { ok: false }
  return { ok: true, other: a.other, status: a.conv.status }
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
