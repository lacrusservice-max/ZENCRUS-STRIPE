import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { SubscriptionTier } from '../models/types'

export interface TokenPayload {
  id?: string
  userId: string
  email: string
  role: 'user' | 'admin' | 'nutritionist'
  subscriptionTier: SubscriptionTier
}

export interface RefreshTokenPayload {
  userId: string
  tokenFamily: string
}

export function signAccessToken(payload: TokenPayload): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRATION as any,
    issuer: 'nutriai-fit',
    audience: 'nutriai-fit-client',
  })
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRATION as any,
    issuer: 'nutriai-fit',
    audience: 'nutriai-fit-refresh',
  })
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: 'nutriai-fit',
    audience: 'nutriai-fit-client',
  }) as TokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'nutriai-fit',
    audience: 'nutriai-fit-refresh',
  }) as RefreshTokenPayload
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload
  } catch {
    return null
  }
}
