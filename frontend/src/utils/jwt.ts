export interface JwtPayload {
  userId: string
  email: string
  role: 'user' | 'admin' | 'nutritionist'
  subscriptionTier: 'free' | 'basic' | 'premium' | 'corporate'
  exp: number
  iat: number
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = parts[1]
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded) as JwtPayload
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const decoded = decodeJwt(token)
  if (!decoded) return true
  return decoded.exp * 1000 < Date.now()
}

export function getTokenExpiresIn(token: string): number {
  const decoded = decodeJwt(token)
  if (!decoded) return 0
  return Math.max(0, decoded.exp * 1000 - Date.now())
}
