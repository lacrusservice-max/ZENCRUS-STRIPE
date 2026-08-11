/**
 * COMUNIDAD · PERFILES, BÚSQUEDA Y SEGUIMIENTO
 * ────────────────────────────────────────────
 * Todo lo que responde a «quién es esta persona» y «quién sigue a quién».
 *
 * Ninguna de estas funciones decide por su cuenta qué puede verse: eso vive
 * entero en `services/socialAccess`. Aquí solo se consulta, se ordena y se
 * devuelve — y siempre a través de `toPublicProfile`, que es lo que garantiza
 * que de la tabla `users` no salga nada más que los seis campos públicos.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import {
  PUBLIC_FIELDS, toPublicProfile, relationOf, accessTo, signAvatar, signAvatars,
} from '../services/socialAccess'
import { confirmUpload, typeFromKey, isStoredKey, remove } from '../services/media'

const uid = (req: Request) => req.user?.userId ?? req.user?.id

const noAuth = (res: Response) => {
  res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse)
}
const fail = (res: Response, code: number, message: string) => {
  res.status(code).json({ success: false, message } satisfies ApiResponse)
}

// ── Esquemas ─────────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  body: z.object({
    username: z.string()
      .min(3, 'El usuario necesita al menos 3 caracteres')
      .max(24, 'El usuario no puede pasar de 24 caracteres')
      // Sin espacios ni acentos: es un identificador que la gente teclea y
      // comparte, no un nombre para mostrar. Para eso está `full_name`.
      .regex(/^[a-zA-Z0-9._]+$/, 'Solo letras, números, punto y guion bajo')
      .optional(),
    fullName: z.string().max(60).optional(),
    bio: z.string().max(160).optional(),
    // Dos formas válidas: la CLAVE de un archivo recién subido al bucket
    // (`avatar/<mi id>/<algo>.jpg`) o una dirección de internet, que es lo que
    // se guardaba antes de que existiera el bucket. `null` quita la foto.
    avatar: z.string().min(1).max(1000).nullable().optional(),
    isPrivate: z.boolean().optional(),
  }),
})

export const searchSchema = z.object({
  query: z.object({
    q: z.string().min(2, 'Escribe al menos 2 caracteres').max(40),
    limit: z.coerce.number().int().min(1).max(30).optional(),
  }),
})

// ── Contadores ───────────────────────────────────────────────────────────────

/**
 * Seguidores, seguidos y publicaciones de una persona.
 *
 * Solo cuenta relaciones `accepted`: una solicitud pendiente no infla el número
 * de seguidores de nadie, que es justo lo que la gente miraría para saber si le
 * han aceptado.
 */
async function statsOf(userId: string) {
  const [followers, following, posts] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true })
      .eq('following_id', userId).eq('status', 'accepted'),
    supabase.from('follows').select('*', { count: 'exact', head: true })
      .eq('follower_id', userId).eq('status', 'accepted'),
    supabase.from('posts').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).is('expires_at', null),
  ])
  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
    posts: posts.count ?? 0,
  }
}

// ── Mi perfil ────────────────────────────────────────────────────────────────

/** GET /social/me */
export async function getMyProfile(req: Request, res: Response): Promise<void> {
  const userId = uid(req)
  if (!userId) return noAuth(res)

  const { data, error } = await supabase
    .from('users').select(PUBLIC_FIELDS).eq('id', userId).maybeSingle()

  if (error || !data) {
    logger.error(`social · getMyProfile ${userId}: ${error?.message}`)
    return fail(res, 404, 'No encontramos tu perfil')
  }

  res.json({
    success: true,
    data: { ...await signAvatar(toPublicProfile(data)), stats: await statsOf(userId) },
  } satisfies ApiResponse)
}

/** PATCH /social/me */
export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  const userId = uid(req)
  if (!userId) return noAuth(res)

  const { username, fullName, bio, avatar, isPrivate } = req.body as
    z.infer<typeof updateProfileSchema>['body']

  const patch: Record<string, unknown> = {}
  if (username !== undefined) patch.username = username.toLowerCase()
  if (fullName !== undefined) patch.full_name = fullName
  if (bio !== undefined) patch.bio = bio
  if (isPrivate !== undefined) patch.is_private = isPrivate

  if (avatar !== undefined) {
    if (avatar === null) {
      patch.profile_picture = null
    } else if (isStoredKey(avatar)) {
      // El prefijo impide poner de avatar la foto de una publicación mía:
      // cambiar el avatar después borraría el archivo de esa publicación. Lo
      // que no empieza por `avatar/` ni es una dirección no es nada — y decir
      // «no es válida» es más cierto que decir «no es tuyo».
      if (!avatar.startsWith('avatar/')) {
        return fail(res, 422, 'Esa foto de perfil no es válida')
      }
      // La carpeta con mi identificador impide reclamar el archivo recién
      // subido de otra persona.
      if (!avatar.includes(`/${userId}/`)) return fail(res, 403, 'Ese archivo no es tuyo')

      const tipo = typeFromKey(avatar)
      if (!tipo || !tipo.startsWith('image/')) {
        return fail(res, 415, 'La foto de perfil tiene que ser una imagen')
      }
      const ok = await confirmUpload(avatar, tipo)
      if (!ok.ok) return fail(res, 400, ok.reason ?? 'La foto no se subió correctamente')
      patch.profile_picture = avatar
    } else {
      // Dirección de internet: se acepta por compatibilidad con lo ya guardado.
      patch.profile_picture = avatar
    }
  }

  if (!Object.keys(patch).length) return fail(res, 400, 'No hay nada que cambiar')

  // Con qué se queda antes de cambiarlo: si era un archivo del bucket y deja de
  // serlo, hay que borrarlo o se queda ocupando sitio para siempre.
  const anterior = patch.profile_picture !== undefined
    ? (await supabase.from('users').select('profile_picture').eq('id', userId).maybeSingle())
        .data?.profile_picture as string | null
    : null

  const { data, error } = await supabase
    .from('users').update(patch).eq('id', userId).select(PUBLIC_FIELDS).maybeSingle()

  if (error) {
    // 23505 es la violación del índice único sobre lower(username). Merece un
    // mensaje propio: «ese usuario ya está cogido» es accionable, un 500 no.
    if (error.code === '23505') return fail(res, 409, 'Ese nombre de usuario ya está en uso')
    logger.error(`social · updateMyProfile ${userId}: ${error.message}`)
    return fail(res, 500, 'No pudimos guardar los cambios')
  }
  if (!data) return fail(res, 404, 'No encontramos tu perfil')

  // Solo después de que el cambio se haya guardado: al revés, un fallo al
  // guardar dejaría el perfil apuntando a un archivo ya borrado.
  if (isStoredKey(anterior) && anterior !== patch.profile_picture) await remove(anterior)

  res.json({ success: true, data: await signAvatar(toPublicProfile(data)) } satisfies ApiResponse)
}

// ── Perfil de otra persona ───────────────────────────────────────────────────

/**
 * GET /social/users/:id
 *
 * Devuelve siempre el perfil básico —para poder encontrar a alguien y pedirle
 * seguirle— y añade `canViewContent` para que la app sepa si ha de enseñar la
 * rejilla de publicaciones o el candado. Los números de seguidores solo salen
 * cuando el contenido es visible: en una cuenta cerrada también son privados.
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const access = await accessTo(viewerId, req.params.id)
  if (!access.profile || !access.target) return fail(res, 404, 'Ese usuario no existe')

  res.json({
    success: true,
    data: {
      ...await signAvatar(access.target),
      relation: access.relation,
      canViewContent: access.content,
      stats: access.content ? await statsOf(req.params.id) : null,
    },
  } satisfies ApiResponse)
}

// ── Búsqueda ─────────────────────────────────────────────────────────────────

/**
 * GET /social/search?q=
 *
 * Busca por nombre de usuario y por nombre visible. Las cuentas privadas SÍ
 * aparecen: ocultarlas haría imposible encontrar a alguien para pedirle
 * seguirle, y su contenido sigue cerrado de todas formas.
 */
export async function searchUsers(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const q = String(req.query.q).trim().toLowerCase()
  const limit = Number(req.query.limit ?? 20)

  /**
   * Lo que se busca acaba DENTRO de un filtro `or(...)`, que PostgREST recibe
   * como texto en crudo. Eso obliga a dos limpiezas distintas:
   *
   *  · La coma, los paréntesis y la comilla doble son la gramática del propio
   *    filtro. Sin quitarlos, buscar `a,is_private.eq.true` no busca: añade una
   *    condición al `or` y devuelve lo que le dé la gana. Se eliminan.
   *    El punto y el apóstrofo NO: PostgREST parte por los dos primeros puntos
   *    y el resto es el valor, así que «juan.perez» y «O'Brien» son inofensivos
   *    — y quitarlos sería no poder buscar a esas personas.
   *  · `%` y `_` son comodines de ILIKE. Se escapan, no se quitan: quien busque
   *    «juan_perez» quiere ese guion bajo, no un comodín.
   */
  const limpio = q.replace(/[,()"]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!limpio) return res.json({ success: true, data: [] } satisfies ApiResponse) as never
  const safe = limpio.replace(/[%_\\]/g, ch => `\\${ch}`)

  const { data, error } = await supabase
    .from('users')
    .select(PUBLIC_FIELDS)
    .or(`username.ilike.%${safe}%,full_name.ilike.%${safe}%`)
    .eq('is_active', true)
    .neq('id', viewerId)
    .limit(limit)

  if (error) {
    logger.error(`social · searchUsers "${q}": ${error.message}`)
    return fail(res, 500, 'No pudimos buscar ahora mismo')
  }

  const rows = data ?? []
  // Una sola consulta para todas las relaciones en vez de una por resultado.
  const { data: rel } = await supabase
    .from('follows').select('following_id, status')
    .eq('follower_id', viewerId)
    .in('following_id', rows.map(r => r.id))

  const byId = new Map((rel ?? []).map(r => [r.following_id, r.status]))

  // Quien empieza por lo buscado va antes que quien solo lo contiene.
  const out = rows
    .map(r => ({
      ...toPublicProfile(r),
      relation: byId.get(r.id) === 'accepted' ? 'following'
        : byId.get(r.id) === 'pending' ? 'requested' : 'none',
    }))
    .sort((a, b) => {
      const ap = (a.username ?? '').toLowerCase().startsWith(limpio) ? 0 : 1
      const bp = (b.username ?? '').toLowerCase().startsWith(limpio) ? 0 : 1
      return ap - bp || (a.username ?? '').localeCompare(b.username ?? '')
    })

  res.json({ success: true, data: await signAvatars(out) } satisfies ApiResponse)
}

// ── Seguir ───────────────────────────────────────────────────────────────────

/**
 * POST /social/users/:id/follow
 *
 * Cuenta pública: queda aceptado al momento. Cuenta privada: se guarda
 * `pending` y el dueño decide. Es idempotente — pulsar dos veces no crea dos
 * filas ni degrada una relación ya aceptada a pendiente.
 */
export async function follow(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const targetId = req.params.id
  if (viewerId === targetId) return fail(res, 400, 'No puedes seguirte a ti mismo')

  const { data: target, error: e1 } = await supabase
    .from('users').select('id, is_private').eq('id', targetId).maybeSingle()
  if (e1 || !target) return fail(res, 404, 'Ese usuario no existe')

  const existing = await relationOf(viewerId, targetId)
  if (existing === 'following' || existing === 'requested') {
    return res.json({ success: true, data: { relation: existing } } satisfies ApiResponse) as never
  }

  const status = target.is_private ? 'pending' : 'accepted'
  const { error } = await supabase.from('follows').insert({
    follower_id: viewerId,
    following_id: targetId,
    status,
    responded_at: status === 'accepted' ? new Date().toISOString() : null,
  })

  if (error) {
    logger.error(`social · follow ${viewerId}→${targetId}: ${error.message}`)
    return fail(res, 500, 'No pudimos completar la acción')
  }

  await notify(targetId, viewerId, status === 'pending' ? 'follow_request' : 'follow')

  res.json({
    success: true,
    data: { relation: status === 'pending' ? 'requested' : 'following' },
  } satisfies ApiResponse)
}

/** DELETE /social/users/:id/follow — sirve también para retirar una solicitud. */
export async function unfollow(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const { error } = await supabase.from('follows').delete()
    .eq('follower_id', viewerId).eq('following_id', req.params.id)

  if (error) {
    logger.error(`social · unfollow ${viewerId}→${req.params.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos completar la acción')
  }
  res.json({ success: true, data: { relation: 'none' } } satisfies ApiResponse)
}

// ── Solicitudes recibidas ────────────────────────────────────────────────────

/** GET /social/requests — las que esperan MI respuesta. */
export async function listRequests(req: Request, res: Response): Promise<void> {
  const userId = uid(req)
  if (!userId) return noAuth(res)

  // `!inner` con el filtro por cuenta activa: una cuenta suspendida no debe
  // dejar una solicitud pendiente esperando respuesta en la bandeja de nadie.
  const { data, error } = await supabase
    .from('follows')
    .select(`created_at, requester:users!follows_follower_id_fkey!inner(${PUBLIC_FIELDS})`)
    .eq('following_id', userId)
    .eq('status', 'pending')
    .eq('requester.is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error(`social · listRequests ${userId}: ${error.message}`)
    return fail(res, 500, 'No pudimos cargar las solicitudes')
  }

  res.json({
    success: true,
    data: await signAvatars((data ?? []).map((r: any) => ({
      ...toPublicProfile(r.requester),
      requestedAt: r.created_at,
    }))),
  } satisfies ApiResponse)
}

/**
 * POST /social/requests/:id/accept
 *
 * El `:id` es quien pidió seguirme. La condición `following_id = yo` es lo que
 * impide que alguien acepte solicitudes ajenas: aunque adivine el
 * identificador, la fila no es suya y no se actualiza nada.
 */
export async function acceptRequest(req: Request, res: Response): Promise<void> {
  const userId = uid(req)
  if (!userId) return noAuth(res)

  const { data, error } = await supabase
    .from('follows')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('follower_id', req.params.id)
    .eq('following_id', userId)
    .eq('status', 'pending')
    .select('follower_id')
    .maybeSingle()

  if (error) {
    logger.error(`social · acceptRequest ${userId}←${req.params.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos aceptar la solicitud')
  }
  if (!data) return fail(res, 404, 'Esa solicitud ya no existe')

  // La solicitud ya está respondida: su aviso deja de tener botones que pulsar.
  await unnotify(userId, req.params.id, 'follow_request')
  await notify(req.params.id, userId, 'follow_accepted')
  res.json({ success: true, data: { accepted: true } } satisfies ApiResponse)
}

/** POST /social/requests/:id/reject */
export async function rejectRequest(req: Request, res: Response): Promise<void> {
  const userId = uid(req)
  if (!userId) return noAuth(res)

  const { error } = await supabase.from('follows').delete()
    .eq('follower_id', req.params.id)
    .eq('following_id', userId)
    .eq('status', 'pending')

  if (error) {
    logger.error(`social · rejectRequest ${userId}←${req.params.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos rechazar la solicitud')
  }
  await unnotify(userId, req.params.id, 'follow_request')
  res.json({ success: true, data: { rejected: true } } satisfies ApiResponse)
}

// ── Seguidores y seguidos ────────────────────────────────────────────────────

/**
 * GET /social/users/:id/followers  ·  GET /social/users/:id/following
 *
 * Las listas de una cuenta privada solo las ve quien ya está dentro: saber a
 * quién sigue alguien también es información sobre esa persona.
 */
async function listRelations(req: Request, res: Response, kind: 'followers' | 'following') {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const access = await accessTo(viewerId, req.params.id)
  if (!access.profile) return fail(res, 404, 'Ese usuario no existe')
  if (!access.content) return fail(res, 403, 'Esta cuenta es privada')

  const mine = kind === 'followers'
  const { data, error } = await supabase
    .from('follows')
    .select(mine
      ? `person:users!follows_follower_id_fkey!inner(${PUBLIC_FIELDS})`
      : `person:users!follows_following_id_fkey!inner(${PUBLIC_FIELDS})`)
    .eq(mine ? 'following_id' : 'follower_id', req.params.id)
    .eq('status', 'accepted')
    .eq('person.is_active', true)
    .limit(200)

  if (error) {
    logger.error(`social · ${kind} ${req.params.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos cargar la lista')
  }

  res.json({
    success: true,
    data: await signAvatars((data ?? []).map((r: any) => toPublicProfile(r.person))),
  } satisfies ApiResponse)
}

export const listFollowers = (req: Request, res: Response) => listRelations(req, res, 'followers')
export const listFollowing = (req: Request, res: Response) => listRelations(req, res, 'following')

// ── Aviso ────────────────────────────────────────────────────────────────────

/**
 * Deja una notificación social.
 *
 * No se propaga el error a propósito: que falle el aviso no puede tumbar la
 * acción que lo provocó. Si el seguimiento se guardó, se guardó — la persona
 * lo verá igual en su perfil aunque no le llegue la campanita.
 */
export async function notify(
  userId: string,
  actorId: string,
  type: 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accepted' | 'mention',
  extra: { postId?: string; commentId?: string } = {},
): Promise<void> {
  if (userId === actorId) return
  const { error } = await supabase.from('social_notifications').insert({
    user_id: userId, actor_id: actorId, type,
    post_id: extra.postId ?? null, comment_id: extra.commentId ?? null,
  })
  if (error) logger.warn(`social · notify ${type} → ${userId}: ${error.message}`)
}

/**
 * Retira un aviso que ya no es cierto.
 *
 * Un me gusta que alguien quita, o una solicitud ya respondida, dejan en la
 * bandeja una frase que dice algo que no pasó. Borrarlo es tan importante como
 * escribirlo: una lista de avisos en la que no se puede confiar deja de mirarse.
 */
export async function unnotify(
  userId: string,
  actorId: string,
  type: 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accepted' | 'mention',
  extra: { postId?: string } = {},
): Promise<void> {
  let q = supabase.from('social_notifications').delete()
    .eq('user_id', userId).eq('actor_id', actorId).eq('type', type)
  if (extra.postId) q = q.eq('post_id', extra.postId)

  const { error } = await q
  if (error) logger.warn(`social · unnotify ${type} → ${userId}: ${error.message}`)
}
