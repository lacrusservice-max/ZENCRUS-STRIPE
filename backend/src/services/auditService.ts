import { supabase } from '../config/supabase'
import { logger } from '../config/logger'

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'register'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'email_verified'
  | 'profile_updated'
  | 'token_refreshed'
  | 'token_refresh_failed'
  | 'suspicious_activity'
  | 'rate_limit_hit'
  | 'unauthorized_access'

interface AuditEntry {
  userId?: string
  action: AuditAction
  ip?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: entry.userId ?? null,
      action: entry.action,
      ip_address: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
      metadata: entry.metadata ?? {},
    })
    if (error) {
      logger.warn('Error guardando audit log:', error.message)
    }
  } catch (err) {
    // Nunca dejar que un fallo de auditoría rompa el flujo principal
    logger.warn('Audit log silenciado:', err)
  }
}

export function getClientInfo(req: { ip?: string; headers: Record<string, string | string[] | undefined> }) {
  return {
    ip: req.ip ?? 'unknown',
    userAgent: String(req.headers['user-agent'] ?? 'unknown'),
  }
}
