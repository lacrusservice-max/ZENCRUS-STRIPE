import { Request, Response, NextFunction } from 'express'
import { logger } from '../config/logger'
import { env } from '../config/env'
import { ApiResponse } from '../models/types'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isOperational = err instanceof AppError && err.isOperational

  logger.error(`${req.method} ${req.path}`, {
    error: err.message,
    stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
    ip: req.ip,
    userId: req.user?.userId,
  })

  if (err instanceof AppError && isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    } satisfies ApiResponse)
    return
  }

  res.status(500).json({
    success: false,
    message: 'Ocurrió un error interno. Nuestro equipo fue notificado.',
  } satisfies ApiResponse)
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
  } satisfies ApiResponse)
}
