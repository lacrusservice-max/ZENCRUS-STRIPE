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
  // Todo lo que ZENA propone sobre el plan del usuario, y qué se hizo con
  // ello. El §16 quiere ver justo esto en el panel: lo que la validación
  // clínica paró, y la proporción entre lo confirmado, lo cancelado y lo
  // deshecho — que es como se mide si ZENA entiende lo que le piden.
  | 'ia_accion_propuesta'
  | 'ia_accion_confirmada'
  | 'ia_accion_cancelada'
  | 'ia_accion_deshecha'
  | 'ia_accion_rechazada'
  // §12. `contencion_activada` es la única de todo este tipo que el §16 marca
  // como urgencia inmediata; las otras dos son revisión diaria.
  | 'contencion_activada'
  | 'tca_nivel_2'
  | 'tca_nivel_3'

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
