import './config/env'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import path from 'path'
import { env } from './config/env'
import { logger } from './config/logger'
import helmet from 'helmet'
import { securityHeaders, apiLimiter, suspiciousActivityLogger, enforceHTTPS } from './middleware/security'
import { errorHandler, notFound } from './middleware/errorHandler'
import routes from './routes'
import { initializeFirebase } from './services/notificationService'
import { testConnection } from './config/supabase'
import { raw } from 'express'
import { handleStripeWebhook } from './controllers/subscriptionController'

const app = express()

// ── Seguridad ─────────────────────────────────────────────────────────────────
app.set('trust proxy', 1)
app.use(enforceHTTPS)
app.use(securityHeaders)

// ── CORS ──────────────────────────────────────────────────────────────────────
const baseOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
const allowedOrigins = new Set([
  ...baseOrigins,
  'https://zencrus.com',
  'https://www.zencrus.com',
  // Vercel preview URLs
])
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) { callback(null, true); return }
    // Always allow zencrus.com and Vercel preview/prod deployments
    if (
      allowedOrigins.has(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('zencrus.com')
    ) {
      callback(null, true)
    } else {
      callback(new Error('Origen no permitido por CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-fingerprint'],
}))

// ── Webhook de Stripe — necesita el body crudo para verificar la firma HMAC,
// por eso se registra ANTES de express.json() (que si no, ya lo habría parseado).
app.post('/api/subscriptions/webhooks/stripe', raw({ type: 'application/json' }), handleStripeWebhook)

// ── Middleware base ───────────────────────────────────────────────────────────
app.use(compression())
app.use(cookieParser())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.url === '/api/health',
}))
app.use(suspiciousActivityLogger)
app.use('/api', apiLimiter)

// ── Panel Admin — CSP relajado para CDNs (solo /admin) ───────────────────────
const adminPath = path.join(__dirname, '../../admin')
const adminCsp = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'", 'cdn.jsdelivr.net', 'cdn.tailwindcss.com', 'unpkg.com'],
      styleSrc:  ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdn.tailwindcss.com', 'unpkg.com'],
      imgSrc:    ["'self'", 'data:', 'blob:'],
      connectSrc:["'self'", '*.supabase.co', 'wss://*.supabase.co', 'api.supabase.com'],
      fontSrc:   ["'self'", 'cdn.jsdelivr.net'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: false,
})
app.use('/admin', adminCsp, express.static(adminPath))
app.get('/admin', adminCsp, (_req, res) => res.sendFile(path.join(adminPath, 'index.html')))

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api', routes)

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ── Inicio ────────────────────────────────────────────────────────────────────
async function startServer(): Promise<void> {
  try {
    initializeFirebase()
    await Promise.race([
      testConnection(),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ])

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 NutriAI Fit API corriendo en puerto ${env.PORT}`)
      logger.info(`📋 Entorno: ${env.NODE_ENV}`)
      logger.info(`🔒 CORS: ${[...allowedOrigins].join(', ')}`)
    })

    const shutdown = (signal: string) => {
      logger.info(`${signal} recibido. Cerrando servidor...`)
      server.close(() => {
        logger.info('Servidor cerrado correctamente')
        process.exit(0)
      })
      setTimeout(() => {
        logger.error('Forzando cierre por timeout')
        process.exit(1)
      }, 10000)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

    process.on('unhandledRejection', (reason) => {
      logger.error('Promise rechazada sin manejar:', reason)
    })

    process.on('uncaughtException', (error) => {
      logger.error('Excepción no capturada:', error)
      process.exit(1)
    })
  } catch (error) {
    logger.error('Error iniciando servidor:', error)
    process.exit(1)
  }
}

startServer()

export { app }
