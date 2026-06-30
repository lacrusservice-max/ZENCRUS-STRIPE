import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, TokenPayload } from '../utils/jwt'
import { ApiResponse, UserRole } from '../models/types'

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Token de acceso requerido',
    } satisfies ApiResponse)
    return
  }

  const token = authHeader.slice(7)

  try {
    req.user = verifyAccessToken(token)
    next()
  } catch {
    res.status(401).json({
      success: false,
      message: 'Token inválido o expirado',
    } satisfies ApiResponse)
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      } satisfies ApiResponse)
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción',
      } satisfies ApiResponse)
      return
    }

    next()
  }
}

export function requireSubscription(...tiers: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse)
      return
    }

    if (!tiers.includes(req.user.subscriptionTier)) {
      res.status(403).json({
        success: false,
        message: `Esta función requiere un plan ${tiers.join(' o ')}`,
      } satisfies ApiResponse)
      return
    }

    next()
  }
}
