/**
 * COMUNIDAD · MÓDULO ANTIGUO (compatibilidad)
 * ───────────────────────────────────────────
 * Estas rutas son las de la primera versión de la comunidad, anterior a las
 * cuentas privadas. El web de producción todavía las consume
 * (`web/lib/api.ts`), así que no se pueden borrar sin tumbarlo — pero tal y
 * como estaban eran una puerta trasera a todo lo demás:
 *
 *   · `/community/feed?scope=all` devolvía TODAS las publicaciones de la base,
 *     las de cuentas privadas incluidas, y también las historias caducadas.
 *   · `/community/users/:id/follow` insertaba en `follows` sin mirar
 *     `is_private`, y como la columna `status` vale `accepted` por defecto,
 *     cualquiera se metía dentro de una cuenta cerrada sin pedir permiso. Y una
 *     vez dentro, el resto de la comunidad ya le abría la puerta de par en par.
 *   · Dar me gusta y comentar no comprobaban nada en absoluto.
 *
 * Ahora cada una de estas funciones aplica LA MISMA regla que su equivalente
 * nueva, llamando a `socialAccess` y a `loadVisible`. No se reescribe ninguna
 * comprobación aquí: si la regla cambia, cambia en un solo sitio y cambia para
 * las dos puertas. Lo único propio de este archivo es la FORMA de la respuesta,
 * que se mantiene igual para no romper el web.
 *
 * Cuando el web migre a `/social`, este archivo y sus rutas se borran enteros.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import { accessTo, visibleAuthorIds, relationOf } from '../services/socialAccess'
import { readUrls, removeMany, isStoredKey } from '../services/media'
import { loadVisible } from './socialContentController'
import { notify, unnotify } from './socialController'

const uid = (req: Request) => req.user?.userId ?? req.user?.id

// ── Schemas ───────────────────────────────────────────────────────────────────
export const createPostSchema = z.object({
  body: z.object({
    content: z.string().max(2000).optional(),
    imageUrl: z.string().url().max(1000).optional(),
    kind: z.enum(['post', 'progress', 'achievement', 'meal', 'workout']).default('post'),
    metadata: z.record(z.any()).optional(),
  }).refine(b => (b.content && b.content.trim().length > 0) || b.imageUrl, {
    message: 'La publicación necesita texto o una imagen',
  }),
})

export const addCommentSchema = z.object({
  body: z.object({ content: z.string().min(1).max(1000) }),
})

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * `!inner` no es decorativo: sin él, filtrar por `author.is_private` no descarta
 * la publicación, solo deja el autor a null. Con el cruce interno, la fila
 * entera desaparece — que es lo que hace falta para que una cuenta privada no
 * asome por este muro.
 */
const AUTHOR = 'author:users!posts_user_id_fkey!inner(id, full_name, username, profile_picture)'

const noAuth = (res: Response) => {
  res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse)
}

/**
 * Firma las fotos de perfil que sean claves del bucket.
 *
 * Desde que se pueden subir avatares a R2, `profile_picture` puede guardar una
 * clave en vez de una dirección. Devolverla en crudo pintaría una imagen rota.
 * Las direcciones externas de siempre pasan sin tocarse.
 */
/**
 * Rellena `image_url` con la primera foto de la publicación, firmada.
 *
 * Esta puerta solo entiende de una imagen por publicación y guardada como
 * dirección. Las que se crean desde la app tienen sus medios en `post_media`
 * como claves de un bucket privado y dejan `image_url` a null, así que el web
 * las enseñaba SIN FOTO: solo el texto.
 *
 * Poner aquí el enlace firmado —que caduca en una hora, como cualquier otra
 * lectura— hace que el web las vea sin tocar una línea del web. Es una
 * traducción de la puerta vieja, no un cambio de modelo: la columna de la base
 * sigue a null, porque una clave privada ahí sería una imagen rota para
 * cualquiera que la leyera directamente.
 */
async function rellenarPortada(posts: any[]): Promise<void> {
  const sinFoto = posts.filter(p => !p.image_url).map(p => p.id)
  if (!sinFoto.length) return

  const { data: medios } = await supabase.from('post_media')
    .select('post_id, url').in('post_id', sinFoto).eq('position', 1)
  if (!medios?.length) return

  const firmadas = await readUrls(medios.map(m => m.url))
  const porPost = new Map(medios.map(m => [m.post_id, firmadas.get(m.url) ?? null]))
  for (const p of posts) {
    if (!p.image_url && porPost.has(p.id)) p.image_url = porPost.get(p.id)
  }
}

async function firmarAutores(autores: any[]): Promise<void> {
  const claves = [...new Set(autores.map(a => a?.profile_picture).filter(isStoredKey))]
  if (!claves.length) return
  const firmadas = await readUrls(claves)
  for (const a of autores) {
    if (a && isStoredKey(a.profile_picture)) {
      a.profile_picture = firmadas.get(a.profile_picture) ?? null
    }
  }
}

// ── Feed ──────────────────────────────────────────────────────────────────────
/**
 * GET /community/feed?scope=all|following&limit=&before=
 *
 * `all` ya no es «todo lo que hay»: son las publicaciones marcadas como
 * públicas de cuentas que no son privadas, igual que el muro «Para ti».
 * `following` son las de quien sigues CON LA SOLICITUD ACEPTADA, más las tuyas.
 *
 * También se excluyen las historias: caducan, y este muro no las entiende.
 */
export async function getFeed(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) return noAuth(res)

    const limit = Math.min(parseInt(String(req.query.limit ?? '20')) || 20, 50)
    const before = typeof req.query.before === 'string' ? req.query.before : null
    const scope = req.query.scope === 'following' ? 'following' : 'all'

    let query = supabase
      .from('posts')
      .select(`id, user_id, content, image_url, kind, metadata, likes_count, comments_count, created_at, ${AUTHOR}`)
      .is('expires_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) query = query.lt('created_at', before)

    if (scope === 'following') {
      query = query.in('user_id', await visibleAuthorIds(userId))
    } else {
      query = query
        .eq('visibility', 'public')
        .eq('author.is_private', false)
        .eq('author.is_active', true)
    }

    const { data: posts, error } = await query
    if (error) throw error

    // ¿Cuáles likeó el usuario actual?
    const postIds = (posts ?? []).map(p => p.id)
    let likedSet = new Set<string>()
    if (postIds.length) {
      const { data: likes } = await supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds)
      likedSet = new Set((likes ?? []).map(l => l.post_id))
    }

    await firmarAutores((posts ?? []).map((p: any) => p.author))
    await rellenarPortada(posts ?? [])
    const result = (posts ?? []).map(p => ({ ...p, liked: likedSet.has(p.id) }))
    res.json({ success: true, data: result } satisfies ApiResponse)
  } catch (err) {
    logger.error('getFeed error:', err)
    res.status(500).json({ success: false, message: 'No se pudo cargar el feed' } satisfies ApiResponse)
  }
}

// POST /community/posts
export async function createPost(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) return noAuth(res)
    const b = req.body ?? {}

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content: b.content?.trim() || null,
        image_url: b.imageUrl || null,
        kind: b.kind || 'post',
        metadata: b.metadata || {},
        // Esta puerta no sabe de visibilidad: nació cuando todo era de todos.
        // Se marca `public` para que la publicación siga apareciendo en el muro
        // como siempre; si la cuenta es privada, el filtro por autor la esconde
        // igual, así que marcarla pública no abre nada.
        visibility: 'public',
      })
      .select(`id, user_id, content, image_url, kind, metadata, likes_count, comments_count, created_at, ${AUTHOR}`)
      .single()
    if (error) throw error

    await firmarAutores([(data as any)?.author])
    res.status(201).json({ success: true, data: { ...data, liked: false } } satisfies ApiResponse)
  } catch (err) {
    logger.error('createPost error:', err)
    res.status(500).json({ success: false, message: 'No se pudo publicar' } satisfies ApiResponse)
  }
}

/**
 * DELETE /community/posts/:id  (solo el autor)
 *
 * Borra también los archivos del bucket. Antes no lo hacía: la fila de
 * `post_media` se iba en cascada, pero el vídeo se quedaba en R2 para siempre
 * sin nada que lo enlazara.
 */
export async function deletePost(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) return noAuth(res)

    const { data: media } = await supabase.from('post_media')
      .select('url').eq('post_id', req.params.id)

    const { data, error } = await supabase.from('posts').delete()
      .eq('id', req.params.id).eq('user_id', userId).select('id').maybeSingle()
    if (error) throw error
    if (!data) {
      res.status(404).json({ success: false, message: 'Esa publicación no existe o no es tuya' } satisfies ApiResponse)
      return
    }

    await removeMany((media ?? []).map(m => m.url))

    res.json({ success: true, message: 'Publicación eliminada' } satisfies ApiResponse)
  } catch (err) {
    logger.error('deletePost error:', err)
    res.status(500).json({ success: false, message: 'No se pudo eliminar' } satisfies ApiResponse)
  }
}

// POST /community/posts/:id/like
export async function likePost(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) return noAuth(res)

    // La misma puerta que en `/social`: no se le da me gusta a lo que no se
    // puede ver, aunque se acierte el identificador.
    const { post } = await loadVisible(userId, req.params.id)
    if (!post) {
      res.status(404).json({ success: false, message: 'No encontramos esa publicación' } satisfies ApiResponse)
      return
    }

    const { error } = await supabase.from('post_likes').upsert(
      { post_id: post.id, user_id: userId },
      { onConflict: 'post_id,user_id', ignoreDuplicates: true },
    )
    if (error) throw error

    await notify(post.user_id, userId, 'like', { postId: post.id })
    res.json({ success: true, data: { liked: true } } satisfies ApiResponse)
  } catch (err) {
    logger.error('likePost error:', err)
    res.status(500).json({ success: false, message: 'No se pudo dar like' } satisfies ApiResponse)
  }
}

// DELETE /community/posts/:id/like
export async function unlikePost(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) return noAuth(res)

    const { error } = await supabase.from('post_likes').delete().eq('post_id', req.params.id).eq('user_id', userId)
    if (error) throw error

    const { data: p } = await supabase.from('posts')
      .select('user_id').eq('id', req.params.id).maybeSingle()
    if (p) await unnotify(p.user_id, userId, 'like', { postId: req.params.id })

    res.json({ success: true, data: { liked: false } } satisfies ApiResponse)
  } catch (err) {
    logger.error('unlikePost error:', err)
    res.status(500).json({ success: false, message: 'No se pudo quitar el like' } satisfies ApiResponse)
  }
}

// GET /community/posts/:id/comments
export async function getComments(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) return noAuth(res)

    const { post } = await loadVisible(userId, req.params.id)
    if (!post) {
      res.status(404).json({ success: false, message: 'No encontramos esa publicación' } satisfies ApiResponse)
      return
    }

    const { data, error } = await supabase
      .from('post_comments')
      .select(`id, post_id, content, created_at, author:users!post_comments_user_id_fkey(id, full_name, username, profile_picture)`)
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    if (error) throw error
    await firmarAutores((data ?? []).map((c: any) => c.author))
    res.json({ success: true, data: data ?? [] } satisfies ApiResponse)
  } catch (err) {
    logger.error('getComments error:', err)
    res.status(500).json({ success: false, message: 'No se pudieron cargar los comentarios' } satisfies ApiResponse)
  }
}

// POST /community/posts/:id/comments
export async function addComment(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) return noAuth(res)

    const { post } = await loadVisible(userId, req.params.id)
    if (!post) {
      res.status(404).json({ success: false, message: 'No encontramos esa publicación' } satisfies ApiResponse)
      return
    }

    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: post.id, user_id: userId, content: String(req.body.content).trim() })
      .select(`id, post_id, content, created_at, author:users!post_comments_user_id_fkey(id, full_name, username, profile_picture)`)
      .single()
    if (error) throw error

    await notify(post.user_id, userId, 'comment', { postId: post.id, commentId: data.id })
    await firmarAutores([(data as any)?.author])
    res.status(201).json({ success: true, data } satisfies ApiResponse)
  } catch (err) {
    logger.error('addComment error:', err)
    res.status(500).json({ success: false, message: 'No se pudo comentar' } satisfies ApiResponse)
  }
}

/**
 * POST /community/users/:id/follow
 *
 * Era el agujero más grave: insertaba la relación directamente y, como `status`
 * vale `accepted` por defecto, servía para entrar en cualquier cuenta privada
 * sin que su dueño se enterara. Ahora una cuenta privada deja la solicitud en
 * `pending`, igual que por la puerta nueva.
 *
 * La respuesta sigue diciendo `{ following: true }` para no romper el web, pero
 * lleva además `pending` para quien quiera distinguirlo.
 */
export async function followUser(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) return noAuth(res)
    if (req.params.id === userId) {
      res.status(400).json({ success: false, message: 'No puedes seguirte a ti mismo' } satisfies ApiResponse)
      return
    }

    const acceso = await accessTo(userId, req.params.id)
    if (!acceso.profile || !acceso.target) {
      res.status(404).json({ success: false, message: 'Ese usuario no existe' } satisfies ApiResponse)
      return
    }

    const previa = await relationOf(userId, req.params.id)
    if (previa === 'following' || previa === 'requested') {
      res.json({
        success: true,
        data: { following: previa === 'following', pending: previa === 'requested' },
      } satisfies ApiResponse)
      return
    }

    const status = acceso.target.isPrivate ? 'pending' : 'accepted'
    const { error } = await supabase.from('follows').insert({
      follower_id: userId,
      following_id: req.params.id,
      status,
      responded_at: status === 'accepted' ? new Date().toISOString() : null,
    })
    if (error) throw error

    await notify(req.params.id, userId, status === 'pending' ? 'follow_request' : 'follow')
    res.json({
      success: true,
      data: { following: status === 'accepted', pending: status === 'pending' },
    } satisfies ApiResponse)
  } catch (err) {
    logger.error('followUser error:', err)
    res.status(500).json({ success: false, message: 'No se pudo seguir' } satisfies ApiResponse)
  }
}

// DELETE /community/users/:id/follow
export async function unfollowUser(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) return noAuth(res)

    const { error } = await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', req.params.id)
    if (error) throw error
    res.json({ success: true, data: { following: false } } satisfies ApiResponse)
  } catch (err) {
    logger.error('unfollowUser error:', err)
    res.status(500).json({ success: false, message: 'No se pudo eliminar el seguimiento' } satisfies ApiResponse)
  }
}
