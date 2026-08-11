/**
 * COMUNIDAD · PUBLICACIONES E HISTORIAS
 * ─────────────────────────────────────
 * Crear, ver, dar me gusta y comentar. Las historias son publicaciones con
 * fecha de caducidad: mismo almacén, mismo código, una columna de diferencia.
 *
 * ── Ninguna URL de medio se devuelve sin comprobar antes ────────────────────
 * Los archivos viven en un bucket privado. Cada respuesta que incluye una foto
 * o un vídeo firma su URL en ese momento, y solo después de que `socialAccess`
 * haya confirmado que quien pregunta puede ver ese contenido. Devolver una URL
 * fija sería regalar acceso permanente a algo que la persona puede cerrar
 * mañana.
 *
 * ── Los dos muros ───────────────────────────────────────────────────────────
 * «Para ti» son publicaciones marcadas como públicas de cuentas públicas. Basta
 * con que una de las dos condiciones falle para que no salga: una cuenta
 * privada no aparece ahí aunque marque algo como público, y una cuenta pública
 * tampoco si eligió que esa publicación fuera solo para seguidores.
 *
 * «Amigos» son las de quien sigues con la solicitud aceptada, más las tuyas.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import {
  PUBLIC_FIELDS, toPublicProfile, accessTo, visibleAuthorIds, signAvatars,
} from '../services/socialAccess'
import {
  createUploadTicket, confirmUpload, readUrls, removeMany, removeByPrefix,
  isAllowedType, kindOf, mediaReady, MAX_VIDEO_SECONDS, AllowedType,
} from '../services/media'
import { notify, unnotify } from './socialController'

const uid = (req: Request) => req.user?.userId ?? req.user?.id
const noAuth = (res: Response) => {
  res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse)
}
const fail = (res: Response, code: number, message: string) => {
  res.status(code).json({ success: false, message } satisfies ApiResponse)
}

/** Cuánto vive una historia. */
const STORY_HOURS = 24
/** Tope de piezas por publicación. */
const MAX_MEDIA = 5

// ── Esquemas ─────────────────────────────────────────────────────────────────

export const ticketSchema = z.object({
  body: z.object({
    contentType: z.string(),
    scope: z.enum(['post', 'story', 'avatar', 'dm']),
  }),
})

export const createPostSchema = z.object({
  body: z.object({
    content: z.string().max(2200).optional(),
    kind: z.enum(['post', 'story']).default('post'),
    visibility: z.enum(['public', 'followers']).default('followers'),
    media: z.array(z.object({
      key: z.string().min(1).max(300),
      contentType: z.string(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      durationMs: z.number().int().positive().optional(),
    })).max(MAX_MEDIA).optional(),
  }).refine(
    b => (b.content && b.content.trim()) || (b.media && b.media.length),
    { message: 'La publicación necesita texto o al menos un archivo' },
  ).refine(
    // Una historia sin medio no es una historia: es un estado de texto, y eso
    // no es lo que se pidió.
    b => b.kind !== 'story' || (b.media && b.media.length === 1),
    { message: 'Una historia lleva exactamente una foto o un vídeo' },
  ),
})

export const commentSchema = z.object({
  body: z.object({ content: z.string().min(1).max(1000) }),
})

// ── Permiso de subida ────────────────────────────────────────────────────────

/**
 * POST /social/media/ticket
 *
 * Devuelve una URL firmada para que el teléfono suba directo a R2. El tipo va
 * dentro de la firma, así que subir otra cosa lo rechaza el propio almacén.
 */
export async function mediaTicket(req: Request, res: Response): Promise<void> {
  const userId = uid(req)
  if (!userId) return noAuth(res)
  if (!mediaReady()) return fail(res, 503, 'La subida de archivos no está disponible ahora mismo')

  const { contentType, scope } = req.body as z.infer<typeof ticketSchema>['body']
  if (!isAllowedType(contentType)) {
    return fail(res, 415, 'Ese tipo de archivo no se admite. Solo JPG, PNG, WEBP, MP4 o MOV')
  }

  try {
    const ticket = await createUploadTicket(userId, contentType as AllowedType, scope)
    res.json({
      success: true,
      data: { ...ticket, maxVideoSeconds: MAX_VIDEO_SECONDS },
    } satisfies ApiResponse)
  } catch (e) {
    logger.error(`social · mediaTicket ${userId}: ${(e as Error).message}`)
    fail(res, 500, 'No pudimos preparar la subida')
  }
}

// ── Crear ────────────────────────────────────────────────────────────────────

/** POST /social/posts */
export async function createPost(req: Request, res: Response): Promise<void> {
  const userId = uid(req)
  if (!userId) return noAuth(res)

  const b = req.body as z.infer<typeof createPostSchema>['body']
  const media = b.media ?? []

  // Se comprueba TODO antes de escribir nada: si una pieza falla, no queda una
  // publicación a medias con las otras ya enlazadas.
  for (const m of media) {
    if (!isAllowedType(m.contentType)) {
      return fail(res, 415, 'Uno de los archivos no es de un tipo admitido')
    }
    // La clave la generó el backend con el id de quien pide; que empiece por su
    // carpeta impide que alguien reclame el archivo recién subido de otro.
    if (!m.key.includes(`/${userId}/`)) {
      return fail(res, 403, 'Ese archivo no es tuyo')
    }
    const ok = await confirmUpload(m.key, m.contentType as AllowedType)
    if (!ok.ok) return fail(res, 400, ok.reason ?? 'El archivo no se subió correctamente')
  }

  const expiresAt = b.kind === 'story'
    ? new Date(Date.now() + STORY_HOURS * 3600_000).toISOString()
    : null

  const { data: post, error } = await supabase.from('posts').insert({
    user_id: userId,
    content: b.content?.trim() || null,
    kind: b.kind,
    visibility: b.visibility,
    expires_at: expiresAt,
    // `image_url` es la columna vieja de una sola imagen y se queda a null a
    // propósito: guardaba una dirección pública, y aquí los archivos son claves
    // de un bucket privado que no se pueden servir sin firmar. Escribir una
    // clave ahí haría que lo que aún lee esa columna pintara una imagen rota.
    // Los medios de una publicación viven en `post_media`.
    image_url: null,
  // Se piden TODAS las columnas, no solo el id: la respuesta pasa por
  // `hydrate`, y con un select corto la publicación recién creada volvía sin
  // `kind`, `visibility` ni `expiresAt`. La app no sabría ni que acaba de
  // publicar una historia ni cuándo caduca.
  }).select(POST_COLS).single()

  if (error || !post) {
    logger.error(`social · createPost ${userId}: ${error?.message}`)
    // Los archivos ya están en R2 y la publicación no existe: se limpian para
    // que no queden huérfanos ocupando sitio para siempre.
    await removeMany(media.map(m => m.key))
    return fail(res, 500, 'No pudimos publicar')
  }

  if (media.length) {
    const rows = media.map((m, i) => ({
      post_id: post.id,
      url: m.key,
      media_type: kindOf(m.contentType)!,
      width: m.width ?? null,
      height: m.height ?? null,
      duration_ms: m.durationMs ?? null,
      position: i + 1,
    }))
    const { error: me } = await supabase.from('post_media').insert(rows)
    if (me) {
      logger.error(`social · createPost media ${post.id}: ${me.message}`)
      await supabase.from('posts').delete().eq('id', post.id)
      await removeMany(media.map(m => m.key))
      return fail(res, 500, 'No pudimos guardar los archivos')
    }
  }

  const full = await hydrate([{ ...post, user_id: userId }], userId)
  res.status(201).json({ success: true, data: full[0] } satisfies ApiResponse)
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/**
 * Completa las publicaciones con autor, medios firmados y estado de me gusta.
 *
 * Se hace en bloque —tres consultas para N publicaciones, no tres por
 * publicación— porque un muro de veinte haría sesenta viajes a la base.
 */
async function hydrate(rows: any[], viewerId: string) {
  if (!rows.length) return []
  const ids = rows.map(r => r.id)
  const autores = [...new Set(rows.map(r => r.user_id))]

  const [{ data: users }, { data: medios }, { data: likes }] = await Promise.all([
    supabase.from('users').select(PUBLIC_FIELDS).in('id', autores),
    supabase.from('post_media').select('post_id, url, media_type, width, height, duration_ms, position')
      .in('post_id', ids).order('position'),
    supabase.from('post_likes').select('post_id').eq('user_id', viewerId).in('post_id', ids),
  ])

  const perfiles = await signAvatars((users ?? []).map(toPublicProfile))
  const porAutor = new Map(perfiles.map(p => [p.id, p]))
  const miosLike = new Set((likes ?? []).map(l => l.post_id))

  // Todas las URLs de una tacada: una firma por archivo, no una por consulta.
  const claves = (medios ?? []).map(m => m.url)
  const firmadas = await readUrls(claves)

  const porPost = new Map<string, any[]>()
  for (const m of medios ?? []) {
    const arr = porPost.get(m.post_id) ?? []
    arr.push({
      url: firmadas.get(m.url) ?? null,
      type: m.media_type,
      width: m.width, height: m.height, durationMs: m.duration_ms,
    })
    porPost.set(m.post_id, arr)
  }

  return rows.map(r => ({
    id: r.id,
    author: porAutor.get(r.user_id) ?? null,
    content: r.content ?? null,
    kind: r.kind,
    visibility: r.visibility,
    media: porPost.get(r.id) ?? [],
    likes: r.likes_count ?? 0,
    comments: r.comments_count ?? 0,
    likedByMe: miosLike.has(r.id),
    isMine: r.user_id === viewerId,
    expiresAt: r.expires_at ?? null,
    createdAt: r.created_at,
  }))
}

const POST_COLS = 'id, user_id, content, kind, visibility, likes_count, comments_count, expires_at, created_at'

/**
 * GET /social/feed?scope=foryou|friends&before=&limit=
 */
export async function getFeed(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const scope = req.query.scope === 'foryou' ? 'foryou' : 'friends'
  const limit = Math.min(Number(req.query.limit ?? 20) || 20, 50)
  const before = typeof req.query.before === 'string' ? req.query.before : null

  // El muro «Para ti» necesita filtrar por la cuenta del autor, y para eso hay
  // que traerla en la misma consulta; el de amigos no, pero pedirla también
  // ahorra tener dos variantes del mismo `select` que se desincronizan.
  let q = supabase.from('posts')
    .select(`${POST_COLS}, author:users!posts_user_id_fkey!inner(is_private, is_active)`)
    .eq('kind', 'post')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (before) q = q.lt('created_at', before)

  if (scope === 'friends') {
    q = q.in('user_id', await visibleAuthorIds(viewerId))
  } else {
    /**
     * Público de verdad: la publicación marcada como pública Y de una cuenta
     * que no es privada. Basta con que falle una de las dos para que no salga.
     *
     * Se resuelve CRUZANDO con `users` en la misma consulta. Antes se pedía la
     * lista de cuentas públicas y se metía en un `in(...)`, y eso se rompe solo:
     * con unos cientos de usuarios la dirección de la petición pasa de los
     * kilobytes y el servidor la rechaza. El cruce interno no crece con el
     * número de cuentas.
     */
    q = q.eq('visibility', 'public')
      .eq('author.is_private', false)
      .eq('author.is_active', true)
  }

  const { data, error } = await q
  if (error) {
    logger.error(`social · getFeed ${scope} ${viewerId}: ${error.message}`)
    return fail(res, 500, 'No pudimos cargar el muro')
  }

  const posts = await hydrate(data ?? [], viewerId)
  // El cursor va DENTRO de `data` y no como campo aparte: `ApiResponse` no
  // tiene sitio para metadatos, y `PaginatedResponse` pagina por número de
  // página — que en un muro se rompe solo. Si llegan publicaciones nuevas
  // mientras alguien baja, las páginas se desplazan y vería repetidos. Con un
  // cursor sobre la fecha eso no puede pasar.
  res.json({
    success: true,
    data: {
      posts,
      nextBefore: posts.length === limit ? posts[posts.length - 1].createdAt : null,
    },
  } satisfies ApiResponse)
}

/**
 * GET /social/stories
 *
 * Las historias vivas de quien sigues y las tuyas, agrupadas por persona. Filtra
 * por `expires_at > ahora`, así que una historia vencida desaparece sola sin
 * que haga falta que nadie la borre a tiempo.
 */
export async function getStories(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const { data, error } = await supabase.from('posts').select(POST_COLS)
    .eq('kind', 'story')
    .gt('expires_at', new Date().toISOString())
    .in('user_id', await visibleAuthorIds(viewerId))
    .order('created_at', { ascending: true })

  if (error) {
    logger.error(`social · getStories ${viewerId}: ${error.message}`)
    return fail(res, 500, 'No pudimos cargar las historias')
  }

  const items = await hydrate(data ?? [], viewerId)
  const porPersona = new Map<string, any>()
  for (const it of items) {
    if (!it.author) continue
    const g = porPersona.get(it.author.id) ?? { author: it.author, isMine: it.isMine, stories: [] }
    g.stories.push(it)
    porPersona.set(it.author.id, g)
  }
  // Las mías primero; el resto por historia más reciente.
  const grupos = [...porPersona.values()].sort((a, b) =>
    Number(b.isMine) - Number(a.isMine) ||
    b.stories[b.stories.length - 1].createdAt.localeCompare(a.stories[a.stories.length - 1].createdAt))

  res.json({ success: true, data: grupos } satisfies ApiResponse)
}

/** GET /social/users/:id/posts — la rejilla de un perfil. */
export async function getUserPosts(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const access = await accessTo(viewerId, req.params.id)
  if (!access.profile) return fail(res, 404, 'Ese usuario no existe')
  if (!access.content) return fail(res, 403, 'Esta cuenta es privada')

  const { data, error } = await supabase.from('posts').select(POST_COLS)
    .eq('user_id', req.params.id).eq('kind', 'post')
    .order('created_at', { ascending: false }).limit(60)

  if (error) {
    logger.error(`social · getUserPosts ${req.params.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos cargar las publicaciones')
  }
  res.json({ success: true, data: await hydrate(data ?? [], viewerId) } satisfies ApiResponse)
}

// ── Una publicación ──────────────────────────────────────────────────────────

/**
 * Carga una publicación comprobando que quien pregunta puede verla.
 *
 * Se exporta porque el módulo antiguo `communityController` —que el web de
 * producción todavía usa— tiene que aplicar exactamente esta misma regla. Que
 * la llame en vez de reescribirla es lo que garantiza que las dos puertas se
 * cierren con la misma llave.
 */
export async function loadVisible(viewerId: string, postId: string) {
  const { data, error } = await supabase.from('posts').select(POST_COLS).eq('id', postId).maybeSingle()
  if (error || !data) return { post: null as any, why: 'no existe' }

  const access = await accessTo(viewerId, data.user_id)
  if (!access.content) return { post: null as any, why: 'privada' }
  // Una publicación solo para seguidores no se ve por ser la cuenta pública.
  if (data.visibility === 'followers' && access.relation === 'none') {
    return { post: null as any, why: 'privada' }
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { post: null as any, why: 'caducada' }
  }
  return { post: data, why: '' }
}

/** GET /social/posts/:id */
export async function getPost(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const { post, why } = await loadVisible(viewerId, req.params.id)
  if (!post) return fail(res, why === 'privada' ? 403 : 404, 'No encontramos esa publicación')

  const [full] = await hydrate([post], viewerId)
  res.json({ success: true, data: full } satisfies ApiResponse)
}

/** DELETE /social/posts/:id — solo la propia. */
export async function deletePost(req: Request, res: Response): Promise<void> {
  const userId = uid(req)
  if (!userId) return noAuth(res)

  const { data: media } = await supabase.from('post_media')
    .select('url').eq('post_id', req.params.id)

  // La condición `user_id = yo` es lo que impide borrar la de otro: aunque
  // adivine el identificador, la fila no le pertenece y no se borra nada.
  const { data, error } = await supabase.from('posts').delete()
    .eq('id', req.params.id).eq('user_id', userId).select('id').maybeSingle()

  if (error) {
    logger.error(`social · deletePost ${req.params.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos borrar la publicación')
  }
  if (!data) return fail(res, 404, 'Esa publicación no existe o no es tuya')

  await removeMany((media ?? []).map(m => m.url))
  res.json({ success: true, data: { deleted: true } } satisfies ApiResponse)
}

// ── Me gusta ─────────────────────────────────────────────────────────────────

/** POST /social/posts/:id/like */
export async function like(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const { post } = await loadVisible(viewerId, req.params.id)
  if (!post) return fail(res, 404, 'No encontramos esa publicación')

  const { error } = await supabase.from('post_likes')
    .upsert({ post_id: post.id, user_id: viewerId }, { onConflict: 'post_id,user_id' })
  if (error) {
    logger.error(`social · like ${post.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos registrar el me gusta')
  }

  await notify(post.user_id, viewerId, 'like', { postId: post.id })
  res.json({ success: true, data: { liked: true } } satisfies ApiResponse)
}

/** DELETE /social/posts/:id/like */
export async function unlike(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  await supabase.from('post_likes').delete()
    .eq('post_id', req.params.id).eq('user_id', viewerId)

  // Se retira también el aviso: dejar «a fulano le gustó tu foto» después de
  // que fulano lo quitara es enseñar algo que ya no es verdad. Hace falta saber
  // a quién avisamos, y eso es el autor de la publicación.
  const { data: p } = await supabase.from('posts')
    .select('user_id').eq('id', req.params.id).maybeSingle()
  if (p) await unnotify(p.user_id, viewerId, 'like', { postId: req.params.id })

  res.json({ success: true, data: { liked: false } } satisfies ApiResponse)
}

// ── Comentarios ──────────────────────────────────────────────────────────────

/** GET /social/posts/:id/comments */
export async function getComments(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const { post } = await loadVisible(viewerId, req.params.id)
  if (!post) return fail(res, 404, 'No encontramos esa publicación')

  const { data, error } = await supabase.from('post_comments')
    .select(`id, content, created_at, user_id, author:users!post_comments_user_id_fkey(${PUBLIC_FIELDS})`)
    .eq('post_id', post.id).order('created_at', { ascending: true }).limit(200)

  if (error) {
    logger.error(`social · getComments ${post.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos cargar los comentarios')
  }

  const autores = await signAvatars(
    (data ?? []).filter((c: any) => c.author).map((c: any) => toPublicProfile(c.author)),
  )
  const porAutor = new Map(autores.map(a => [a.id, a]))

  res.json({
    success: true,
    data: (data ?? []).map((c: any) => ({
      id: c.id, content: c.content, createdAt: c.created_at,
      author: c.author ? porAutor.get(c.author.id) ?? null : null,
      isMine: c.user_id === viewerId,
    })),
  } satisfies ApiResponse)
}

/** POST /social/posts/:id/comments */
export async function addComment(req: Request, res: Response): Promise<void> {
  const viewerId = uid(req)
  if (!viewerId) return noAuth(res)

  const { post } = await loadVisible(viewerId, req.params.id)
  if (!post) return fail(res, 404, 'No encontramos esa publicación')

  const { data, error } = await supabase.from('post_comments')
    .insert({ post_id: post.id, user_id: viewerId, content: req.body.content.trim() })
    .select('id, content, created_at').single()

  if (error || !data) {
    logger.error(`social · addComment ${post.id}: ${error?.message}`)
    return fail(res, 500, 'No pudimos publicar el comentario')
  }

  await notify(post.user_id, viewerId, 'comment', { postId: post.id, commentId: data.id })
  res.status(201).json({
    success: true,
    data: { id: data.id, content: data.content, createdAt: data.created_at, isMine: true },
  } satisfies ApiResponse)
}

/** DELETE /social/comments/:id — el propio, o cualquiera de mi publicación. */
export async function deleteComment(req: Request, res: Response): Promise<void> {
  const userId = uid(req)
  if (!userId) return noAuth(res)

  const { data: c } = await supabase.from('post_comments')
    .select('id, user_id, post_id').eq('id', req.params.id).maybeSingle()
  if (!c) return fail(res, 404, 'Ese comentario no existe')

  // Quien publicó puede moderar su propia publicación; el resto solo lo suyo.
  let permitido = c.user_id === userId
  if (!permitido) {
    const { data: p } = await supabase.from('posts').select('user_id').eq('id', c.post_id).maybeSingle()
    permitido = p?.user_id === userId
  }
  if (!permitido) return fail(res, 403, 'No puedes borrar ese comentario')

  await supabase.from('post_comments').delete().eq('id', c.id)
  res.json({ success: true, data: { deleted: true } } satisfies ApiResponse)
}

// ── Baja de una cuenta ───────────────────────────────────────────────────────

/**
 * Retira el rastro de alguien que se da de baja.
 *
 * `DELETE /users/me` decía «Tu cuenta ha sido eliminada» y solo apagaba
 * `is_active`: las fotos, los vídeos, las historias y los adjuntos de sus chats
 * se quedaban en el bucket para siempre. Esto lo cumple.
 *
 * ── Qué se borra y qué no ───────────────────────────────────────────────────
 * Se borra lo que es SUYO y solo suyo: publicaciones, historias, avatar y todos
 * sus archivos. De los mensajes se borra el archivo adjunto, pero el texto se
 * queda: lo que le escribiste a alguien también es la conversación de esa otra
 * persona, y vaciársela sin avisar es decidir por ella.
 *
 * ── Por qué NO se llama desde la suspensión del administrador ───────────────
 * Suspender y darse de baja apagan la misma columna, pero no son lo mismo: la
 * suspensión se revierte, y borrar los archivos de alguien a quien mañana vas a
 * readmitir es destruir lo que no toca. Esto se llama solo desde la baja
 * voluntaria, que sí es definitiva.
 */
export async function purgeUserContent(userId: string): Promise<{ posts: number; files: number }> {
  // Las publicaciones primero: la cascada se lleva medios, me gusta,
  // comentarios y avisos asociados.
  const { data: borradas, error } = await supabase.from('posts')
    .delete().eq('user_id', userId).select('id')
  if (error) logger.error(`social · purgeUserContent posts ${userId}: ${error.message}`)

  // Los mensajes se quedan, pero sin apuntar a un archivo que ya no existe.
  const { error: e2 } = await supabase.from('direct_messages')
    .update({ media_url: null, media_type: null })
    .eq('sender_id', userId).not('media_url', 'is', null)
  if (e2) logger.error(`social · purgeUserContent mensajes ${userId}: ${e2.message}`)

  // Se pregunta al almacén en vez de seguir las filas: así también caen las
  // subidas que quedaron a medias y nunca llegaron a enlazarse con nada.
  let files = 0
  for (const ambito of ['post', 'story', 'avatar', 'dm']) {
    files += await removeByPrefix(`${ambito}/${userId}/`)
  }

  logger.info(`social · baja de ${userId}: ${(borradas ?? []).length} publicaciones, ${files} archivos`)
  return { posts: (borradas ?? []).length, files }
}

// ── Limpieza de historias vencidas ───────────────────────────────────────────

/**
 * Borra las historias caducadas y sus archivos.
 *
 * Filtrar por fecha ya las oculta, así que esto no afecta a lo que se ve: lo
 * que hace es liberar el almacenamiento. Sin esta limpieza el bucket crece para
 * siempre con vídeos que nadie puede ver — que es exactamente lo que encarece
 * una app de medios.
 */
export async function purgeExpiredStories(): Promise<{ posts: number; files: number }> {
  const { data: viejas } = await supabase.from('posts')
    .select('id').eq('kind', 'story').lt('expires_at', new Date().toISOString()).limit(500)

  const ids = (viejas ?? []).map(p => p.id)
  if (!ids.length) return { posts: 0, files: 0 }

  const { data: media } = await supabase.from('post_media').select('url').in('post_id', ids)
  const files = await removeMany((media ?? []).map(m => m.url))
  await supabase.from('posts').delete().in('id', ids)

  logger.info(`social · historias caducadas: ${ids.length} publicaciones, ${files} archivos`)
  return { posts: ids.length, files }
}
