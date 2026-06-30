-- ============================================================
-- NutriAI Fit — Migración 003: tabla audit_logs + vista admin
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

-- Tabla principal de auditoría de autenticación
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  ip_address   INET,
  user_agent   TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Vista enriquecida para el panel admin
CREATE OR REPLACE VIEW admin_audit_view AS
  SELECT
    al.id,
    al.action,
    al.ip_address::TEXT,
    al.user_agent,
    al.metadata,
    al.created_at,
    u.email        AS user_email,
    u.full_name    AS user_name,
    u.role         AS user_role,
    u.is_active    AS user_active
  FROM audit_logs al
  LEFT JOIN users u ON u.id = al.user_id
  ORDER BY al.created_at DESC;

-- Vista de usuarios enriquecida para el admin
CREATE OR REPLACE VIEW admin_users_view AS
  SELECT
    u.*,
    COUNT(DISTINCT s.id)  FILTER (WHERE s.status = 'active') AS active_subscriptions,
    COUNT(DISTINCT cs.id)                                     AS total_chat_sessions,
    COUNT(DISTINCT dp.id)                                     AS total_diet_plans,
    MAX(al.created_at)                                        AS last_activity
  FROM users u
  LEFT JOIN subscriptions s   ON s.user_id = u.id
  LEFT JOIN chat_sessions cs  ON cs.user_id = u.id
  LEFT JOIN diet_plans dp     ON dp.user_id = u.id
  LEFT JOIN audit_logs al     ON al.user_id = u.id
  GROUP BY u.id;
