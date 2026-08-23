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
import {
  listConversations, openConversation, openSchema, getConversation,
  listMessages, sendMessage, sendSchema, markRead, deleteMessage,
  acceptConversation, rejectConversation, blockConversation,
} from '../controllers/socialMessagesController'
import {
  listNotifications, markAllRead, markOneRead, deleteNotification, getBadges,
} from '../controllers/socialNotificationsController'
import {
  savePost, unsavePost, listSaved,
  blockUser, unblockUser, listBlocked,
  createReport, reportSchema,
} from '../controllers/socialSafetyController'

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

// ── Notificaciones ───────────────────────────────────────────────────────────
// `/notifications/read` va antes que `/notifications/:id/read`, o «read» se
// colaría como identificador de notificación.
router.get('/badges', getBadges)

router.get('/notifications', listNotifications)
router.post('/notifications/read', markAllRead)
router.post('/notifications/:id/read', markOneRead)
router.delete('/notifications/:id', deleteNotification)

// ── Guardados, bloqueos y denuncias ──────────────────────────────────────────
// Literales, así que van aquí arriba: `/social/saved` por debajo de
// `/social/users/:id` no llegaría nunca, y `/social/blocked` tampoco.
router.get('/saved', listSaved)
router.get('/blocked', listBlocked)
router.post('/reports', validate(reportSchema), createReport)

// ── Medios y publicaciones ───────────────────────────────────────────────────
router.post('/media/ticket', validate(ticketSchema), mediaTicket)
router.post('/posts', validate(createPostSchema), createPost)
router.get('/posts/:id', getPost)
router.delete('/posts/:id', deletePost)
router.post('/posts/:id/like', like)
router.delete('/posts/:id/like', unlike)
router.post('/posts/:id/save', savePost)
router.delete('/posts/:id/save', unsavePost)
router.get('/posts/:id/comments', getComments)
router.post('/posts/:id/comments', validate(commentSchema), addComment)
router.delete('/comments/:id', deleteComment)

// ── Mensajes directos ────────────────────────────────────────────────────────
// La bandeja trae los chats y las solicitudes en la misma respuesta: la app las
// enseña juntas y separarlas serían dos viajes para pintar una sola pantalla.
router.get('/conversations', listConversations)
router.post('/conversations', validate(openSchema), openConversation)
router.get('/conversations/:id', getConversation)
router.get('/conversations/:id/messages', listMessages)
router.post('/conversations/:id/messages', validate(sendSchema), sendMessage)
router.post('/conversations/:id/read', markRead)
router.post('/conversations/:id/accept', acceptConversation)
router.post('/conversations/:id/reject', rejectConversation)
router.post('/conversations/:id/block', blockConversation)
router.delete('/messages/:id', deleteMessage)

// ── Otras personas ───────────────────────────────────────────────────────────
router.get('/users/:id', getProfile)
router.get('/users/:id/posts', getUserPosts)
router.get('/users/:id/followers', listFollowers)
router.get('/users/:id/following', listFollowing)
router.post('/users/:id/follow', follow)
router.delete('/users/:id/follow', unfollow)
router.post('/users/:id/block', blockUser)
router.delete('/users/:id/block', unblockUser)

export default router
