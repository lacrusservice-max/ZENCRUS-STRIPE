import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth'
import {
  getDashboard,
  getUsers, getUserDetail, updateUserStatus, updateUserRole, deleteUser, unlockUser,
  grantSubscription, revokeSubscription, verifyUserEmail, resetUserPassword, impersonateUser,
  getMessages, deleteMessage,
  getAuditLogs, getActivityLogs,
  getSubscriptions, getRevenue, getTrials, extendSubscription, cancelSubscriptionAdmin,
  getDietPlans, deleteDietPlan,
  getUserSocialStats, getSocialPosts, deleteSocialPost,
  getAnalytics,
  sendNotificationToUser, sendNotificationToAll,
  exportUsers,
  streamEvents,
} from '../controllers/adminController'

const router = Router()

// All admin routes require authentication + admin role
router.use(authenticate, authorize('admin'))

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', getDashboard)

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users',                  getUsers)
router.get('/users/:id',              getUserDetail)
router.patch('/users/:id/status',     updateUserStatus)
router.patch('/users/:id/role',       updateUserRole)
router.patch('/users/:id/unlock',     unlockUser)
router.delete('/users/:id',           deleteUser)

// ── Fase 2: gestión avanzada ──────────────────────────────────────────────────
router.post('/users/:id/grant-subscription',  grantSubscription)
router.post('/users/:id/revoke-subscription', revokeSubscription)
router.post('/users/:id/verify-email',        verifyUserEmail)
router.post('/users/:id/reset-password',       resetUserPassword)
router.post('/users/:id/impersonate',          impersonateUser)

// ── Content ───────────────────────────────────────────────────────────────────
router.get('/content/messages',       getMessages)
router.delete('/content/messages/:id', deleteMessage)

// ── Logs ──────────────────────────────────────────────────────────────────────
router.get('/logs/audit',             getAuditLogs)
router.get('/logs/activity',          getActivityLogs)

// ── Subscriptions ─────────────────────────────────────────────────────────────
router.get('/subscriptions',          getSubscriptions)
router.get('/subscriptions/revenue',  getRevenue)

// ── Plans ─────────────────────────────────────────────────────────────────────
router.get('/plans/diet',             getDietPlans)
router.delete('/plans/diet/:id',      deleteDietPlan)

// ── Social ────────────────────────────────────────────────────────────────────
router.get('/users/:id/social',       getUserSocialStats)
router.get('/social/posts',           getSocialPosts)
router.delete('/social/posts/:id',    deleteSocialPost)

// ── Trials ────────────────────────────────────────────────────────────────────
router.get('/subscriptions/trials',           getTrials)
router.patch('/subscriptions/:id/extend',     extendSubscription)
router.patch('/subscriptions/:id/cancel',     cancelSubscriptionAdmin)

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics',              getAnalytics)

// ── Notifications ──────────────────────────────────────────────────────────────
router.post('/notify/user/:id',       sendNotificationToUser)
router.post('/notify/all',            sendNotificationToAll)

// ── Export ────────────────────────────────────────────────────────────────────
router.get('/export/users',           exportUsers)

// ── Real-time SSE (auth via query token for EventSource compatibility) ────────
router.get('/stream', (req, _res, next) => {
  // EventSource can't set headers — accept token in query param
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`
  }
  next()
}, authenticate, authorize('admin'), streamEvents)

export default router
