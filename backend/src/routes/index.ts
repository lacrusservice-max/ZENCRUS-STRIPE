import { Router } from 'express'
import authRoutes from './auth.routes'
import userRoutes from './user.routes'
import dietRoutes from './diet.routes'
import workoutRoutes from './workout.routes'
import chatRoutes from './chat.routes'
import subscriptionRoutes from './subscription.routes'
import adminRoutes from './admin.routes'
import setupRoutes from './setup.routes'
import { getPublicFlags } from '../controllers/adminController'
import { ApiResponse } from '../models/types'
import { supabase } from '../config/supabase'
import { logger } from '../config/logger'

const router = Router()

// ── Health check con verificación real de dependencias ────────────────────────
router.get('/health', async (_req, res) => {
  const start = Date.now()

  const checks = await Promise.allSettled([
    supabase.from('users').select('id').limit(1),
  ])

  const dbOk = checks[0].status === 'fulfilled' && !(checks[0].value as any)?.error
  const allOk = dbOk

  const status = {
    status: allOk ? 'ok' : 'degraded',
    service: 'ZENCRUS API',
    version: process.env.APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - start,
    checks: {
      database: dbOk ? 'ok' : 'error',
    },
  }

  if (!allOk) logger.warn('Health check degradado:', status)

  res.status(allOk ? 200 : 503).json({
    success: allOk,
    data: status,
  } satisfies ApiResponse)
})

// Endpoint público de feature flags (la app lo lee sin autenticación)
router.get('/flags', getPublicFlags)

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/diet', dietRoutes)
router.use('/workout', workoutRoutes)
router.use('/chat', chatRoutes)
router.use('/subscriptions', subscriptionRoutes)
router.use('/admin', adminRoutes)
router.use('/setup', setupRoutes)

export default router
