import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'

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
const AUTHOR = 'author:users!posts_user_id_fkey(id, full_name, username, profile_picture)'

// ── Feed ──────────────────────────────────────────────────────────────────────
// GET /community/feed?scope=all|following&limit=&before=
export async function getFeed(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) { res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse); return }

    const limit = Math.min(parseInt(String(req.query.limit ?? '20')) || 20, 50)
    const before = typeof req.query.before === 'string' ? req.query.before : null
    const scope = req.query.scope === 'following' ? 'following' : 'all'

    let query = supabase
      .from('posts')
      .select(`id, user_id, content, image_url, kind, metadata, likes_count, comments_count, created_at, ${AUTHOR}`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) query = query.lt('created_at', before)

    if (scope === 'following') {
      const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
      const ids = (follows ?? []).map(f => f.following_id)
      ids.push(userId) // incluir mis propias publicaciones
      query = query.in('user_id', ids)
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
    if (!userId) { res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse); return }
    const b = req.body ?? {}

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content: b.content?.trim() || null,
        image_url: b.imageUrl || null,
        kind: b.kind || 'post',
        metadata: b.metadata || {},
      })
      .select(`id, user_id, content, image_url, kind, metadata, likes_count, comments_count, created_at, ${AUTHOR}`)
      .single()
    if (error) throw error

    res.status(201).json({ success: true, data: { ...data, liked: false } } satisfies ApiResponse)
  } catch (err) {
    logger.error('createPost error:', err)
    res.status(500).json({ success: false, message: 'No se pudo publicar' } satisfies ApiResponse)
  }
}

// DELETE /community/posts/:id  (solo el autor)
export async function deletePost(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) { res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse); return }

    const { error } = await supabase.from('posts').delete().eq('id', req.params.id).eq('user_id', userId)
    if (error) throw error
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
    if (!userId) { res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse); return }

    const { error } = await supabase.from('post_likes').upsert(
      { post_id: req.params.id, user_id: userId },
      { onConflict: 'post_id,user_id', ignoreDuplicates: true },
    )
    if (error) throw error
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
    if (!userId) { res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse); return }

    const { error } = await supabase.from('post_likes').delete().eq('post_id', req.params.id).eq('user_id', userId)
    if (error) throw error
    res.json({ success: true, data: { liked: false } } satisfies ApiResponse)
  } catch (err) {
    logger.error('unlikePost error:', err)
    res.status(500).json({ success: false, message: 'No se pudo quitar el like' } satisfies ApiResponse)
  }
}

// GET /community/posts/:id/comments
export async function getComments(req: Request, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('post_comments')
      .select(`id, post_id, content, created_at, author:users!post_comments_user_id_fkey(id, full_name, username, profile_picture)`)
      .eq('post_id', req.params.id)
      .order('created_at', { ascending: true })
    if (error) throw error
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
    if (!userId) { res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse); return }

    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: req.params.id, user_id: userId, content: String(req.body.content).trim() })
      .select(`id, post_id, content, created_at, author:users!post_comments_user_id_fkey(id, full_name, username, profile_picture)`)
      .single()
    if (error) throw error
    res.status(201).json({ success: true, data } satisfies ApiResponse)
  } catch (err) {
    logger.error('addComment error:', err)
    res.status(500).json({ success: false, message: 'No se pudo comentar' } satisfies ApiResponse)
  }
}

// POST /community/users/:id/follow
export async function followUser(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) { res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse); return }
    if (req.params.id === userId) { res.status(400).json({ success: false, message: 'No puedes seguirte a ti mismo' } satisfies ApiResponse); return }

    const { error } = await supabase.from('follows').upsert(
      { follower_id: userId, following_id: req.params.id },
      { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
    )
    if (error) throw error
    res.json({ success: true, data: { following: true } } satisfies ApiResponse)
  } catch (err) {
    logger.error('followUser error:', err)
    res.status(500).json({ success: false, message: 'No se pudo seguir' } satisfies ApiResponse)
  }
}

// DELETE /community/users/:id/follow
export async function unfollowUser(req: Request, res: Response): Promise<void> {
  try {
    const userId = uid(req)
    if (!userId) { res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse); return }

    const { error } = await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', req.params.id)
    if (error) throw error
    res.json({ success: true, data: { following: false } } satisfies ApiResponse)
  } catch (err) {
    logger.error('unfollowUser error:', err)
    res.status(500).json({ success: false, message: 'No se pudo dejar de seguir' } satisfies ApiResponse)
  }
}
