import { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env'
import { logger } from '../config/logger'
import { ApiResponse } from '../models/types'

// ── Helmet (headers de seguridad) ─────────────────────────────────────────────
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", '*.supabase.co', 'wss://*.supabase.co'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
})

// ── Rate limiting general ─────────────────────────────────────────────────────
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
  } satisfies ApiResponse,
  handler: (req, res, _next, options) => {
    logger.warn(`Rate limit alcanzado: ${req.ip} ${req.path}`)
    res.status(429).json(options.message)
  },
})

// ── Rate limiting para auth (estricto) ───────────────────────────────────────
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Demasiados intentos fallidos. Espera 15 minutos.',
  } satisfies ApiResponse,
  handler: (req, res, _next, options) => {
    logger.warn(`Auth rate limit: ${req.ip} intentando ${req.path}`)
    res.status(429).json(options.message)
  },
})

// ── Validar fingerprint del dispositivo ───────────────────────────────────────
export function validateDeviceFingerprint(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const fingerprint = req.headers['x-device-fingerprint']
  if (!fingerprint || typeof fingerprint !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Dispositivo no identificado',
    } satisfies ApiResponse)
    return
  }
  next()
}

// ── Log de actividad sospechosa ───────────────────────────────────────────────
export function suspiciousActivityLogger(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const suspiciousPatterns = [
    /(<script|javascript:|on\w+\s*=)/i,
    /(union\s+select|drop\s+table|insert\s+into|delete\s+from)/i,
    /(\.\.\/|\.\.\\|%2e%2e)/i,
  ]

  const body = JSON.stringify(req.body)
  const query = JSON.stringify(req.query)

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(body) || pattern.test(query)) {
      logger.warn(`Actividad sospechosa detectada: ${req.ip} → ${req.path}`, {
        body: body.slice(0, 200),
        query,
      })
      break
    }
  }

  next()
}

// ── Forzar HTTPS en producción ────────────────────────────────────────────────
export function enforceHTTPS(req: Request, res: Response, next: NextFunction): void {
  if (env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    res.redirect(301, `https://${req.hostname}${req.originalUrl}`)
    return
  }
  next()
}
