/**
 * COMUNIDAD · NOTIFICACIONES
 * ──────────────────────────
 * La bandeja de avisos de persona a persona: quién te dio me gusta, quién
 * comentó, quién quiere seguirte.
 *
 * Las escribe `notify()` desde los controladores que provocan el aviso; aquí
 * solo se leen, se marcan y se borran.
 *
 * ── Una notificación no puede enseñar lo que no se puede ver ────────────────
 * Casi todas apuntan a una publicación PROPIA —te comentaron A TI—, así que la
 * comprobación parece de sobra. No lo es: en cuanto exista la mención, el aviso
 * apuntará a la publicación de otra persona, que mañana puede cerrar su cuenta.
 * Por eso cada publicación referida pasa por `accessTo` igual que en cualquier
 * otro sitio, y la que ya no se puede ver se cae de la lista en vez de dejar un
 * aviso que lleva a una puerta cerrada.
 *
 * ── Por qué los avisos también se retiran ───────────────────────────────────
 * Un me gusta que se quita, o una solicitud ya respondida, dejan un aviso que
 * miente. Se borran donde ocurre la acción, con `unnotify()`.
 */

import { Request, Response } from 'express'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import { PUBLIC_FIELDS, toPublicProfile, accessTo, signAvatars } from '../services/socialAccess'
import { readUrls } from '../services/media'

const uid = (req: Request) => req.user?.userId ?? req.user?.id
const noAuth = (res: Response) => {
  res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse)
}
const fail = (res: Response, code: number, message: string) => {
  res.status(code).json({ success: false, message } satisfies ApiResponse)
}

/** Cuántos avisos por página. */
const PAGE = 30

/**
 * Un identificador que no es un UUID no llega a la base.
 *
 * Postgres respondería 22P02 y el usuario vería un 500, como si el servidor se
 * hubiera roto. No se ha roto nada: esa notificación sencillamente no existe.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

// ── Lista ────────────────────────────────────────────────────────────────────

/**
 * GET /social/notifications?before=&limit=
 *
 * Del más reciente al más antiguo, con cursor por fecha. No marca nada como
 * leído: abrir la pantalla y leer son dos cosas distintas, y mezclarlas hace
 * que un aviso desaparezca sin que nadie lo haya mirado.
 */
export async function listNotifications(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!me) return noAuth(res)

  const limit = Math.min(Number(req.query.limit ?? PAGE) || PAGE, 60)
  const before = typeof req.query.before === 'string' ? req.query.before : null

  let q = supabase.from('social_notifications')
    .select('id, actor_id, type, post_id, comment_id, is_read, created_at')
    .eq('user_id', me)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (before) q = q.lt('created_at', before)

  const { data, error } = await q
  if (error) {
    logger.error(`social · listNotifications ${me}: ${error.message}`)
    return fail(res, 500, 'No pudimos cargar tus notificaciones')
  }

  const filas = data ?? []
  if (!filas.length) {
    return res.json({ success: true, data: { items: [], nextBefore: null } } satisfies ApiResponse) as never
  }

  const actorIds = [...new Set(filas.map(n => n.actor_id))]
  const postIds = [...new Set(filas.map(n => n.post_id).filter(Boolean))] as string[]
  const comentIds = [...new Set(filas.map(n => n.comment_id).filter(Boolean))] as string[]

  const [{ data: actores }, { data: posts }, { data: comentarios }] = await Promise.all([
    supabase.from('users').select(PUBLIC_FIELDS).in('id', actorIds),
    postIds.length
      ? supabase.from('posts').select('id, user_id, visibility, expires_at').in('id', postIds)
      : Promise.resolve({ data: [] as any[] }),
    comentIds.length
      ? supabase.from('post_comments').select('id, content').in('id', comentIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Un permiso por AUTOR, no por publicación: lo normal es que todas sean mías
  // y eso sea una sola comprobación.
  const autores = [...new Set((posts ?? []).map(p => p.user_id))]
  const permisos = new Map(
    await Promise.all(autores.map(async a => [a, await accessTo(me, a)] as const)),
  )

  const visibles = new Map<string, any>()
  for (const p of posts ?? []) {
    const acc = permisos.get(p.user_id)
    if (!acc?.content) continue
    if (p.visibility === 'followers' && acc.relation === 'none') continue
    if (p.expires_at && new Date(p.expires_at) < new Date()) continue
    visibles.set(p.id, p)
  }

  // La miniatura: la primera pieza de cada publicación, firmada al momento.
  const { data: medios } = visibles.size
    ? await supabase.from('post_media').select('post_id, url, media_type, position')
        .in('post_id', [...visibles.keys()]).eq('position', 1)
    : { data: [] as any[] }
  const firmadas = await readUrls((medios ?? []).map(m => m.url))
  const portada = new Map((medios ?? []).map(m => [
    m.post_id, { url: firmadas.get(m.url) ?? null, type: m.media_type },
  ]))

  const perfiles = await signAvatars((actores ?? []).map(toPublicProfile))
  const porActor = new Map(perfiles.map(p => [p.id, p]))
  const porComentario = new Map((comentarios ?? []).map(c => [c.id, c.content]))

  const items = filas
    // Un aviso sobre algo que ya no se puede ver no es un aviso, es un callejón.
    .filter(n => !n.post_id || visibles.has(n.post_id))
    .map(n => ({
      id: n.id,
      type: n.type,
      isRead: n.is_read,
      createdAt: n.created_at,
      actor: porActor.get(n.actor_id) ?? null,
      post: n.post_id ? { id: n.post_id, preview: portada.get(n.post_id) ?? null } : null,
      comment: n.comment_id
        ? { id: n.comment_id, content: porComentario.get(n.comment_id) ?? null }
        : null,
    }))

  res.json({
    success: true,
    data: {
      items,
      // El cursor sale de las filas SIN filtrar: si se tomara del resultado
      // visible, una página entera de avisos ocultos cortaría la paginación y
      // lo que hay detrás no se cargaría nunca.
      nextBefore: filas.length === limit ? filas[filas.length - 1].created_at : null,
    },
  } satisfies ApiResponse)
}

// ── Marcar y borrar ──────────────────────────────────────────────────────────

/** POST /social/notifications/read — todas las mías de una vez. */
export async function markAllRead(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!me) return noAuth(res)

  const { data, error } = await supabase.from('social_notifications')
    .update({ is_read: true })
    .eq('user_id', me).eq('is_read', false)
    .select('id')

  if (error) {
    logger.error(`social · markAllRead ${me}: ${error.message}`)
    return fail(res, 500, 'No pudimos marcar las notificaciones')
  }
  res.json({ success: true, data: { read: (data ?? []).length } } satisfies ApiResponse)
}

/**
 * POST /social/notifications/:id/read
 *
 * La condición `user_id = yo` es lo que impide tocar el aviso de otro: aunque
 * acierte el identificador, la fila no es suya y no se actualiza nada.
 */
export async function markOneRead(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!me) return noAuth(res)
  if (!isUuid(req.params.id)) return fail(res, 404, 'Esa notificación no existe')

  const { data, error } = await supabase.from('social_notifications')
    .update({ is_read: true })
    .eq('id', req.params.id).eq('user_id', me)
    .select('id').maybeSingle()

  if (error) {
    logger.error(`social · markOneRead ${req.params.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos marcar la notificación')
  }
  if (!data) return fail(res, 404, 'Esa notificación no existe')
  res.json({ success: true, data: { read: true } } satisfies ApiResponse)
}

/** DELETE /social/notifications/:id */
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!me) return noAuth(res)
  if (!isUuid(req.params.id)) return fail(res, 404, 'Esa notificación no existe')

  const { data, error } = await supabase.from('social_notifications')
    .delete().eq('id', req.params.id).eq('user_id', me)
    .select('id').maybeSingle()

  if (error) {
    logger.error(`social · deleteNotification ${req.params.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos borrar la notificación')
  }
  if (!data) return fail(res, 404, 'Esa notificación no existe')
  res.json({ success: true, data: { deleted: true } } satisfies ApiResponse)
}

// ── Avisos de la barra ───────────────────────────────────────────────────────

/**
 * GET /social/badges
 *
 * Los cuatro números que la app pinta encima de los iconos. Van juntos porque
 * se piden juntos: cada vez que alguien abre la aplicación, o vuelve a ella,
 * hacen falta los cuatro, y separarlos serían cuatro viajes para dibujar dos
 * puntitos rojos.
 *
 * Se piden con `head: true`: cuenta sin traerse las filas.
 */
export async function getBadges(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  // La comprobación es de forma, no de sesión: el identificador se interpola
  // dentro de un filtro `or(...)`, que PostgREST recibe como texto en crudo.
  if (!isUuid(me)) return noAuth(res)

  const [avisos, solicitudes, convs] = await Promise.all([
    supabase.from('social_notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', me).eq('is_read', false),
    supabase.from('follows').select('follower_id', { count: 'exact', head: true })
      .eq('following_id', me).eq('status', 'pending'),
    supabase.from('conversations').select('id, status, requested_by')
      .or(`user_lo.eq.${me},user_hi.eq.${me}`)
      .in('status', ['accepted', 'pending'])
      .not('last_message_at', 'is', null)
      .limit(200),
  ])

  // Los mensajes sin leer se cuentan DENTRO de mis conversaciones. Sin acotar
  // por ellas, la consulta se traería los mensajes sin leer de toda la app:
  // `direct_messages` no sabe quién participa en cada conversación, eso solo
  // está en `conversations`.
  const conSolicitud = new Set(
    (convs.data ?? []).filter(c => c.status === 'pending' && c.requested_by !== me).map(c => c.id),
  )
  const ids = (convs.data ?? []).map(c => c.id)
  let mensajes = 0
  let solicitudesMensaje = 0

  if (ids.length) {
    const { data: sinLeer } = await supabase.from('direct_messages')
      .select('conversation_id')
      .in('conversation_id', ids)
      .neq('sender_id', me).is('read_at', null)
      .limit(2000)
    for (const m of sinLeer ?? []) {
      if (conSolicitud.has(m.conversation_id)) solicitudesMensaje++
      else mensajes++
    }
  }

  const data = {
    notifications: avisos.count ?? 0,
    followRequests: solicitudes.count ?? 0,
    messages: mensajes,
    messageRequests: solicitudesMensaje,
  }
  res.json({
    success: true,
    data: { ...data, total: Object.values(data).reduce((a, b) => a + b, 0) },
  } satisfies ApiResponse)
}
