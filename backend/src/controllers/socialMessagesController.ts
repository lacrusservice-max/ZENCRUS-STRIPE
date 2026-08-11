/**
 * COMUNIDAD · MENSAJES DIRECTOS
 * ─────────────────────────────
 * Conversaciones de dos, con solicitudes para las cuentas privadas.
 *
 * ── Ninguna decisión de permiso se toma aquí ────────────────────────────────
 * Quién puede escribir a quién lo dice `canMessage`; quién puede leer o
 * escribir en una conversación concreta lo dice `conversationAccess`. Este
 * archivo consulta, ordena y responde. Si algún día hay que cambiar la regla,
 * se cambia en `services/socialAccess` y cambia en todas partes a la vez.
 *
 * ── Cómo empieza una conversación ───────────────────────────────────────────
 * Cuenta pública: se escribe y ya está. Cuenta privada: la conversación nace
 * `pending` y vive en la bandeja de SOLICITUDES del destinatario, no en su
 * bandeja normal, hasta que la acepta. La excepción es que esa persona ya te
 * siga: si te ha dejado entrar en su cuenta, no tiene sentido pedirle permiso
 * para escribirle.
 *
 * ── Una conversación vacía no se ve ─────────────────────────────────────────
 * Abrir el chat de alguien crea la fila, pero las bandejas filtran por
 * `last_message_at is not null`. Así, entrar en un perfil y salir sin escribir
 * no le deja a nadie un chat fantasma en la lista.
 *
 * ── Los medios ──────────────────────────────────────────────────────────────
 * Igual que en las publicaciones: el archivo viaja directo a R2 con una URL
 * firmada, el backend comprueba después lo que se subió de verdad, y cada
 * lectura firma una URL nueva que caduca. Un adjunto de un chat privado no
 * puede quedar colgando en una URL fija para siempre.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import {
  PUBLIC_FIELDS, toPublicProfile, canMessage, signAvatar, signAvatars,
  conversationAccess, conversationPair, ConversationRow,
} from '../services/socialAccess'
import {
  confirmUpload, isAllowedType, kindOf, readUrls, remove, AllowedType,
} from '../services/media'

const uid = (req: Request) => req.user?.userId ?? req.user?.id

const noAuth = (res: Response) => {
  res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse)
}
const fail = (res: Response, code: number, message: string) => {
  res.status(code).json({ success: false, message } satisfies ApiResponse)
}

/**
 * Un identificador que no es un UUID no llega a la base.
 *
 * Postgres respondería 22P02 y acabaría en un 500 sin sentido, pero sobre todo:
 * el identificador de quien mira se interpola dentro de un filtro `or(...)` de
 * PostgREST, que es texto en crudo. Ahí no entra nada sin comprobar.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

/** Cuántas conversaciones trae la bandeja de una vez. */
const INBOX_LIMIT = 60
/** Cuántos mensajes por página de chat. */
const PAGE = 40

// ── Esquemas ─────────────────────────────────────────────────────────────────

export const openSchema = z.object({
  body: z.object({ userId: z.string().uuid('Identificador inválido') }),
})

export const sendSchema = z.object({
  body: z.object({
    body: z.string().max(2000).optional(),
    media: z.object({
      key: z.string().min(1).max(300),
      contentType: z.string(),
    }).optional(),
  }).refine(
    b => (b.body && b.body.trim()) || b.media,
    { message: 'El mensaje necesita texto o un archivo' },
  ),
})

// ── Forma de la respuesta ────────────────────────────────────────────────────

interface Preview {
  id: string
  mine: boolean
  body: string | null
  mediaType: string | null
  createdAt: string
}

/**
 * Traduce una conversación a lo que la app necesita pintar una fila.
 *
 * `canWrite` es una pista para la interfaz —enseñar el campo de texto o un
 * aviso—, no una autorización: el envío lo vuelve a comprobar el servidor con
 * `conversationAccess`, que además sabe del cupo de una solicitud sin aceptar.
 */
function shapeConversation(
  conv: ConversationRow,
  me: string,
  profile: ReturnType<typeof toPublicProfile> | null,
  unread: number,
  last: Preview | null,
) {
  const iRequested = conv.status !== 'accepted' && conv.requested_by === me
  return {
    id: conv.id,
    other: profile,
    status: conv.status,
    /** Está esperando MI respuesta. */
    isRequest: conv.status === 'pending' && !iRequested,
    /** La abrí yo y aún no me han aceptado. */
    iRequested,
    unread,
    lastMessage: last,
    lastMessageAt: conv.last_message_at,
    canWrite: conv.status !== 'blocked',
  }
}

/** Traduce un mensaje, con su archivo ya firmado si lo tiene. */
function shapeMessage(m: any, me: string, signed: Map<string, string>) {
  return {
    id: m.id,
    mine: m.sender_id === me,
    body: m.body ?? null,
    media: m.media_url
      ? { url: signed.get(m.media_url) ?? null, type: m.media_type }
      : null,
    readAt: m.read_at ?? null,
    createdAt: m.created_at,
  }
}

// ── Bandeja ──────────────────────────────────────────────────────────────────

/**
 * GET /social/conversations
 *
 * Devuelve las dos listas de una vez —chats y solicitudes— porque la app las
 * enseña juntas y separarlas serían dos viajes para pintar una sola pantalla.
 * Las bloqueadas no salen en ninguna: para reabrir una, se entra por el perfil.
 */
export async function listConversations(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!isUuid(me)) return noAuth(res)

  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_lo, user_hi, status, requested_by, last_message_at')
    .or(`user_lo.eq.${me},user_hi.eq.${me}`)
    .in('status', ['accepted', 'pending'])
    .not('last_message_at', 'is', null)
    .order('last_message_at', { ascending: false })
    .limit(INBOX_LIMIT)

  if (error) {
    logger.error(`social · listConversations ${me}: ${error.message}`)
    return fail(res, 500, 'No pudimos cargar tus mensajes')
  }

  const convs = (data ?? []) as ConversationRow[]
  if (!convs.length) {
    return res.json({
      success: true,
      data: { chats: [], requests: [], unread: { chats: 0, requests: 0 } },
    } satisfies ApiResponse) as never
  }

  const ids = convs.map(c => c.id)
  const otros = convs.map(c => (c.user_lo === me ? c.user_hi : c.user_lo))

  const [{ data: users }, { data: sinLeer }, previews] = await Promise.all([
    supabase.from('users').select(PUBLIC_FIELDS).in('id', [...new Set(otros)]),
    // Solo los identificadores: se cuentan aquí porque PostgREST no agrupa.
    supabase.from('direct_messages').select('conversation_id')
      .in('conversation_id', ids).neq('sender_id', me).is('read_at', null).limit(2000),
    lastMessagesOf(convs, me),
  ])

  const perfiles = await signAvatars((users ?? []).map(toPublicProfile))
  const porId = new Map(perfiles.map(p => [p.id, p]))
  const cuenta = new Map<string, number>()
  for (const r of sinLeer ?? []) {
    cuenta.set(r.conversation_id, (cuenta.get(r.conversation_id) ?? 0) + 1)
  }

  const chats: any[] = []
  const requests: any[] = []
  for (const c of convs) {
    const otro = c.user_lo === me ? c.user_hi : c.user_lo
    const fila = shapeConversation(
      c, me, porId.get(otro) ?? null, cuenta.get(c.id) ?? 0, previews.get(c.id) ?? null,
    )
    // Una solicitud que espera mi respuesta va a su propia bandeja; la que
    // mandé yo se queda en la lista normal, que es donde la busco.
    ;(fila.isRequest ? requests : chats).push(fila)
  }

  const suma = (xs: any[]) => xs.reduce((n, x) => n + x.unread, 0)
  res.json({
    success: true,
    data: {
      chats, requests,
      unread: { chats: suma(chats), requests: suma(requests) },
    },
  } satisfies ApiResponse)
}

/**
 * El último mensaje de cada conversación, en una sola consulta.
 *
 * PostgREST no sabe hacer «el más reciente de cada grupo», y preguntar una vez
 * por conversación son sesenta viajes para pintar una lista. El atajo: al
 * enviar, `last_message_at` se guarda con la fecha EXACTA del mensaje, así que
 * basta pedir los mensajes de esas conversaciones cuya fecha esté entre esas
 * fechas. Si alguna se queda sin pareja —una fila antigua, un reloj raro— se
 * pregunta solo por ella; lo normal es que no haga falta ninguna consulta más.
 */
async function lastMessagesOf(convs: ConversationRow[], me: string): Promise<Map<string, Preview>> {
  const out = new Map<string, Preview>()
  const fechas = convs.map(c => c.last_message_at).filter(Boolean) as string[]
  if (!fechas.length) return out

  const { data, error } = await supabase
    .from('direct_messages')
    .select('id, conversation_id, sender_id, body, media_type, created_at')
    .in('conversation_id', convs.map(c => c.id))
    .in('created_at', [...new Set(fechas)])

  if (error) logger.warn(`social · lastMessagesOf: ${error.message}`)

  const esperado = new Map(convs.map(c => [c.id, c.last_message_at]))
  for (const m of data ?? []) {
    // La misma fecha puede pertenecer a otra conversación de la lista: solo
    // vale la fila cuya fecha coincide con la de SU conversación.
    if (m.created_at !== esperado.get(m.conversation_id)) continue
    out.set(m.conversation_id, {
      id: m.id, mine: m.sender_id === me,
      body: m.body ?? null, mediaType: m.media_type ?? null, createdAt: m.created_at,
    })
  }

  const faltan = convs.filter(c => c.last_message_at && !out.has(c.id))
  await Promise.all(faltan.map(async c => {
    const { data: uno } = await supabase
      .from('direct_messages')
      .select('id, sender_id, body, media_type, created_at')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    if (uno) {
      out.set(c.id, {
        id: uno.id, mine: uno.sender_id === me,
        body: uno.body ?? null, mediaType: uno.media_type ?? null, createdAt: uno.created_at,
      })
    }
  }))

  return out
}

// ── Abrir una conversación ───────────────────────────────────────────────────

/**
 * POST /social/conversations  { userId }
 *
 * Devuelve la conversación con esa persona, creándola si no existía. Es
 * idempotente: pulsar dos veces no deja dos chats. Si dos personas se abren
 * el chat a la vez, la clave única de `(user_lo, user_hi)` decide y quien
 * pierde vuelve a leer la fila del otro en vez de fallar.
 */
export async function openConversation(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!isUuid(me)) return noAuth(res)

  const targetId = (req.body as z.infer<typeof openSchema>['body']).userId
  const permiso = await canMessage(me, targetId)
  if (!permiso.allowed) return fail(res, 403, permiso.reason ?? 'No puedes escribir a esta persona')

  const { lo, hi } = conversationPair(me, targetId)

  const { data: ya, error: e1 } = await supabase
    .from('conversations')
    .select('id, user_lo, user_hi, status, requested_by, last_message_at')
    .eq('user_lo', lo).eq('user_hi', hi).maybeSingle()

  if (e1) {
    logger.error(`social · openConversation ${me}→${targetId}: ${e1.message}`)
    return fail(res, 500, 'No pudimos abrir la conversación')
  }

  let conv = ya as ConversationRow | null

  if (!conv) {
    const { data: nueva, error } = await supabase.from('conversations').insert({
      user_lo: lo, user_hi: hi,
      status: permiso.needsRequest ? 'pending' : 'accepted',
      requested_by: permiso.needsRequest ? me : null,
    }).select('id, user_lo, user_hi, status, requested_by, last_message_at').maybeSingle()

    if (error?.code === '23505') {
      // Carrera: el otro la creó entre la consulta y la inserción.
      const { data: suya } = await supabase
        .from('conversations')
        .select('id, user_lo, user_hi, status, requested_by, last_message_at')
        .eq('user_lo', lo).eq('user_hi', hi).maybeSingle()
      conv = suya as ConversationRow | null
    } else if (error || !nueva) {
      logger.error(`social · openConversation insert ${me}→${targetId}: ${error?.message}`)
      return fail(res, 500, 'No pudimos abrir la conversación')
    } else {
      conv = nueva as ConversationRow
    }
  }

  if (!conv) return fail(res, 500, 'No pudimos abrir la conversación')

  // Una conversación bloqueada no se reabre entrando en ella: eso convertiría
  // el bloqueo en un adorno. Solo la reabre quien bloqueó, aceptándola.
  if (conv.status === 'blocked' && conv.requested_by === me) {
    return fail(res, 403, 'Esta persona no acepta tus mensajes')
  }

  const { data: perfil } = await supabase
    .from('users').select(PUBLIC_FIELDS).eq('id', targetId).maybeSingle()

  res.json({
    success: true,
    data: shapeConversation(
      conv, me, perfil ? await signAvatar(toPublicProfile(perfil)) : null, 0, null,
    ),
  } satisfies ApiResponse)
}

/** GET /social/conversations/:id — la cabecera del chat, para abrirlo directo. */
export async function getConversation(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!isUuid(me)) return noAuth(res)

  const acc = await conversationAccess(me, req.params.id)
  if (!acc.member || !acc.conv) return fail(res, 404, 'Esa conversación no existe')

  const [{ data: perfil }, { count }] = await Promise.all([
    supabase.from('users').select(PUBLIC_FIELDS).eq('id', acc.other!).maybeSingle(),
    supabase.from('direct_messages').select('id', { count: 'exact', head: true })
      .eq('conversation_id', acc.conv.id).neq('sender_id', me).is('read_at', null),
  ])

  const fila = shapeConversation(
    acc.conv, me, perfil ? await signAvatar(toPublicProfile(perfil)) : null, count ?? 0, null,
  )
  res.json({
    success: true,
    // El permiso real manda sobre la comodidad de la interfaz.
    data: { ...fila, canWrite: acc.canWrite, writeBlockedReason: acc.reason ?? null },
  } satisfies ApiResponse)
}

// ── Mensajes ─────────────────────────────────────────────────────────────────

/**
 * GET /social/conversations/:id/messages?before=&limit=
 *
 * Del más reciente al más antiguo, que es como los pinta una lista invertida, y
 * con cursor por fecha en vez de por número de página: si llega un mensaje
 * mientras alguien sube a leer lo viejo, las páginas no se desplazan.
 */
export async function listMessages(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!isUuid(me)) return noAuth(res)

  const acc = await conversationAccess(me, req.params.id)
  if (!acc.member || !acc.conv) return fail(res, 404, 'Esa conversación no existe')

  const limit = Math.min(Number(req.query.limit ?? PAGE) || PAGE, 100)
  const before = typeof req.query.before === 'string' ? req.query.before : null

  let q = supabase.from('direct_messages')
    .select('id, sender_id, body, media_url, media_type, read_at, created_at')
    .eq('conversation_id', acc.conv.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (before) q = q.lt('created_at', before)

  const { data, error } = await q
  if (error) {
    logger.error(`social · listMessages ${acc.conv.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos cargar los mensajes')
  }

  const rows = data ?? []
  const firmadas = await readUrls(rows.map(m => m.media_url).filter(Boolean) as string[])
  const msgs = rows.map(m => shapeMessage(m, me, firmadas))

  res.json({
    success: true,
    data: {
      messages: msgs,
      nextBefore: msgs.length === limit ? msgs[msgs.length - 1].createdAt : null,
    },
  } satisfies ApiResponse)
}

/**
 * POST /social/conversations/:id/messages
 *
 * El archivo se comprueba ANTES de escribir el mensaje: si el adjunto no es lo
 * que dice ser, no queda un mensaje apuntando a nada.
 */
export async function sendMessage(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!isUuid(me)) return noAuth(res)

  const acc = await conversationAccess(me, req.params.id)
  if (!acc.member || !acc.conv) return fail(res, 404, 'Esa conversación no existe')
  if (!acc.canWrite) return fail(res, acc.code ?? 403, acc.reason ?? 'No puedes escribir aquí')

  /**
   * El estado guardado al abrir el chat no vale para el PRIMER mensaje.
   *
   * Abrir una conversación con una cuenta pública la deja `accepted`. Si esa
   * persona se vuelve privada después, esa fila sería un salvoconducto: bastaba
   * con abrir el chat de todas las cuentas públicas y esperar. Mientras no haya
   * ningún mensaje la conversación no ha empezado, así que el permiso se vuelve
   * a preguntar aquí y el estado se recalcula con la respuesta de ahora.
   *
   * A cambio, un caso raro sale perdiendo: si alguien borra los únicos mensajes
   * que había y vuelve a escribir a una cuenta privada, le tocará solicitar otra
   * vez. Es el lado correcto por el que equivocarse.
   */
  const estado: Record<string, unknown> = {}
  if (acc.conv.last_message_at === null) {
    const p = await canMessage(me, acc.other!)
    if (!p.allowed) return fail(res, 403, p.reason ?? 'No puedes escribir a esta persona')
    estado.status = p.needsRequest ? 'pending' : 'accepted'
    estado.requested_by = p.needsRequest ? me : null
  } else if (acc.accepting) {
    estado.status = 'accepted'
    estado.requested_by = null
  }

  const b = req.body as z.infer<typeof sendSchema>['body']
  let mediaUrl: string | null = null
  let mediaType: string | null = null

  if (b.media) {
    if (!isAllowedType(b.media.contentType)) {
      return fail(res, 415, 'Ese tipo de archivo no se admite')
    }
    // Dos condiciones, y las dos importan: la carpeta con mi identificador
    // impide reclamar el archivo recién subido de otro, y el prefijo `dm/`
    // impide adjuntar aquí la foto de una publicación mía —borrar el mensaje
    // se llevaría por delante el archivo de la publicación—.
    if (!b.media.key.startsWith('dm/') || !b.media.key.includes(`/${me}/`)) {
      return fail(res, 403, 'Ese archivo no es tuyo')
    }
    const ok = await confirmUpload(b.media.key, b.media.contentType as AllowedType)
    if (!ok.ok) return fail(res, 400, ok.reason ?? 'El archivo no se subió correctamente')

    mediaUrl = b.media.key
    mediaType = kindOf(b.media.contentType)
  }

  const { data: msg, error } = await supabase.from('direct_messages').insert({
    conversation_id: acc.conv.id,
    sender_id: me,
    body: b.body?.trim() || null,
    media_url: mediaUrl,
    media_type: mediaType,
  }).select('id, sender_id, body, media_url, media_type, read_at, created_at').single()

  if (error || !msg) {
    logger.error(`social · sendMessage ${acc.conv.id}: ${error?.message}`)
    if (mediaUrl) await remove(mediaUrl)
    return fail(res, 500, 'No pudimos enviar el mensaje')
  }

  // `last_message_at` se guarda con la fecha EXACTA del mensaje: es lo que
  // permite recuperar después el último de cada conversación de una sola vez.
  const { error: e2 } = await supabase.from('conversations')
    .update({ ...estado, last_message_at: msg.created_at })
    .eq('id', acc.conv.id)
  if (e2) logger.warn(`social · sendMessage bump ${acc.conv.id}: ${e2.message}`)

  const firmadas = mediaUrl ? await readUrls([mediaUrl]) : new Map<string, string>()
  res.status(201).json({
    success: true,
    data: {
      ...shapeMessage(msg, me, firmadas),
      // Para que la app sepa, sin volver a preguntar, si acaba de mandar un
      // mensaje o de dejar una solicitud esperando.
      conversationStatus: (estado.status as string) ?? acc.conv.status,
    },
  } satisfies ApiResponse)
}

/**
 * POST /social/conversations/:id/read
 *
 * Marca como leídos los mensajes del otro. Los míos no se tocan: el «leído» que
 * ve quien escribió tiene que significar que lo leyó la otra persona.
 */
export async function markRead(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!isUuid(me)) return noAuth(res)

  const acc = await conversationAccess(me, req.params.id)
  if (!acc.member || !acc.conv) return fail(res, 404, 'Esa conversación no existe')

  const { data, error } = await supabase.from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', acc.conv.id)
    .neq('sender_id', me)
    .is('read_at', null)
    .select('id')

  if (error) {
    logger.error(`social · markRead ${acc.conv.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos marcar los mensajes')
  }
  res.json({ success: true, data: { read: (data ?? []).length } } satisfies ApiResponse)
}

/** DELETE /social/messages/:id — solo el propio. */
export async function deleteMessage(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!isUuid(me)) return noAuth(res)

  const { data: m } = await supabase.from('direct_messages')
    .select('id, conversation_id, media_url, created_at')
    .eq('id', req.params.id).eq('sender_id', me).maybeSingle()

  // Mismo mensaje si no existe que si es de otro: quien prueba identificadores
  // ajenos no puede distinguir «no existe» de «no es tuyo».
  if (!m) return fail(res, 404, 'Ese mensaje no existe o no es tuyo')

  const { error } = await supabase.from('direct_messages').delete().eq('id', m.id)
  if (error) {
    logger.error(`social · deleteMessage ${m.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos borrar el mensaje')
  }
  if (m.media_url) await remove(m.media_url)

  // Si era el último, la conversación se queda con una fecha que ya no apunta a
  // ningún mensaje y la bandeja mostraría una vista previa vacía.
  const { data: ahora } = await supabase.from('direct_messages')
    .select('created_at').eq('conversation_id', m.conversation_id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  await supabase.from('conversations')
    .update({ last_message_at: ahora?.created_at ?? null })
    .eq('id', m.conversation_id)

  res.json({ success: true, data: { deleted: true } } satisfies ApiResponse)
}

// ── Solicitudes y bloqueo ────────────────────────────────────────────────────

/**
 * POST /social/conversations/:id/accept
 *
 * Acepta una solicitud, y sirve también para reabrir una conversación
 * bloqueada. Solo puede hacerlo quien NO figura en `requested_by`: quien pide
 * permiso no se lo da a sí mismo.
 */
export async function acceptConversation(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!isUuid(me)) return noAuth(res)

  const acc = await conversationAccess(me, req.params.id)
  if (!acc.member || !acc.conv) return fail(res, 404, 'Esa conversación no existe')
  if (acc.conv.status === 'accepted') {
    return res.json({ success: true, data: { status: 'accepted' } } satisfies ApiResponse) as never
  }
  if (acc.conv.requested_by === me) {
    return fail(res, 403, 'Solo la otra persona puede aceptar')
  }

  const { error } = await supabase.from('conversations')
    .update({ status: 'accepted', requested_by: null })
    .eq('id', acc.conv.id)

  if (error) {
    logger.error(`social · acceptConversation ${acc.conv.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos aceptar la conversación')
  }
  res.json({ success: true, data: { status: 'accepted' } } satisfies ApiResponse)
}

/**
 * POST /social/conversations/:id/reject
 *
 * Rechaza una solicitud. La fila NO se borra: se queda bloqueada, que es lo que
 * impide que quien fue rechazado vuelva a solicitar acto seguido, y otra vez, y
 * otra. Los mensajes se marcan leídos para que el aviso desaparezca del icono.
 */
export async function rejectConversation(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!isUuid(me)) return noAuth(res)

  const acc = await conversationAccess(me, req.params.id)
  if (!acc.member || !acc.conv) return fail(res, 404, 'Esa conversación no existe')
  if (acc.conv.status !== 'pending') return fail(res, 409, 'Esa solicitud ya no está pendiente')
  if (acc.conv.requested_by === me) return fail(res, 403, 'Esa solicitud la enviaste tú')

  const { error } = await supabase.from('conversations')
    .update({ status: 'blocked' }).eq('id', acc.conv.id)

  if (error) {
    logger.error(`social · rejectConversation ${acc.conv.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos rechazar la solicitud')
  }

  await supabase.from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', acc.conv.id).neq('sender_id', me).is('read_at', null)

  res.json({ success: true, data: { status: 'blocked' } } satisfies ApiResponse)
}

/**
 * POST /social/conversations/:id/block
 *
 * Cierra el canal con esa persona. `requested_by` pasa a ser ella: es quien
 * necesitará que yo consienta para volver a escribir, y por eso solo yo puedo
 * reabrirlo.
 *
 * Es un bloqueo de CONVERSACIÓN, no de cuenta: la otra persona sigue viendo el
 * perfil y lo que corresponda por su relación de seguimiento. Bloquear una
 * cuenta entera es otra cosa y no se hace aquí.
 */
export async function blockConversation(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!isUuid(me)) return noAuth(res)

  const acc = await conversationAccess(me, req.params.id)
  if (!acc.member || !acc.conv) return fail(res, 404, 'Esa conversación no existe')

  const { error } = await supabase.from('conversations')
    .update({ status: 'blocked', requested_by: acc.other })
    .eq('id', acc.conv.id)

  if (error) {
    logger.error(`social · blockConversation ${acc.conv.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos bloquear la conversación')
  }
  res.json({ success: true, data: { status: 'blocked' } } satisfies ApiResponse)
}
