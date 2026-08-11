/**
 * COMUNIDAD · RUTAS
 * ─────────────────
 * Todas exigen sesión. No hay ninguna pública: incluso buscar a alguien revela
 * quién existe en la app, y eso no se enseña a quien no ha entrado.
 *
 * El orden importa: las rutas literales van antes que las paramétricas, o
 * `/social/requests` acabaría entrando por `/social/users/:id` y buscando a un
 * usuario llamado «requests».
 */

import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'
import {
  getMyProfile, updateMyProfile, updateProfileSchema,
  getProfile, searchUsers, searchSchema,
  follow, unfollow,
  listRequests, acceptRequest, rejectRequest,
  listFollowers, listFollowing,
} from '../controllers/socialController'
import {
  mediaTicket, ticketSchema,
  createPost, createPostSchema, getPost, deletePost,
  getFeed, getStories, getUserPosts,
  like, unlike,
  getComments, addComment, commentSchema, deleteComment,
} from '../controllers/socialContentController'

const router = Router()

router.use(authenticate)

// ── Yo ───────────────────────────────────────────────────────────────────────
router.get('/me', getMyProfile)
router.patch('/me', validate(updateProfileSchema), updateMyProfile)

// ── Búsqueda y solicitudes (literales, antes de :id) ─────────────────────────
router.get('/search', validate(searchSchema), searchUsers)
router.get('/requests', listRequests)
router.post('/requests/:id/accept', acceptRequest)
router.post('/requests/:id/reject', rejectRequest)

// ── Muros e historias ────────────────────────────────────────────────────────
router.get('/feed', getFeed)
router.get('/stories', getStories)

// ── Medios y publicaciones ───────────────────────────────────────────────────
router.post('/media/ticket', validate(ticketSchema), mediaTicket)
router.post('/posts', validate(createPostSchema), createPost)
router.get('/posts/:id', getPost)
router.delete('/posts/:id', deletePost)
router.post('/posts/:id/like', like)
router.delete('/posts/:id/like', unlike)
router.get('/posts/:id/comments', getComments)
router.post('/posts/:id/comments', validate(commentSchema), addComment)
router.delete('/comments/:id', deleteComment)

// ── Otras personas ───────────────────────────────────────────────────────────
router.get('/users/:id', getProfile)
router.get('/users/:id/posts', getUserPosts)
router.get('/users/:id/followers', listFollowers)
router.get('/users/:id/following', listFollowing)
router.post('/users/:id/follow', follow)
router.delete('/users/:id/follow', unfollow)

export default router
