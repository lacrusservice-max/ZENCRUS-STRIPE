-- ============================================================
-- NutriAI Fit — Schema inicial para Supabase (PostgreSQL)
-- Ejecutar en orden en el SQL Editor de Supabase
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ──────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('user', 'admin', 'nutritionist');
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other');
CREATE TYPE fitness_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'premium', 'corporate');
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled', 'pending');
CREATE TYPE payment_provider AS ENUM ('stripe', 'mercadopago', 'none');
CREATE TYPE plan_generated_by AS ENUM ('ai', 'nutritionist', 'user');
CREATE TYPE workout_goal AS ENUM ('strength', 'hypertrophy', 'endurance', 'functional');
CREATE TYPE message_sender AS ENUM ('user', 'ai', 'nutritionist');
CREATE TYPE chat_status AS ENUM ('active', 'resolved', 'archived');
CREATE TYPE notification_type AS ENUM ('reminder', 'alert', 'promotion', 'system');
CREATE TYPE activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');

-- ── TABLA: USUARIOS ────────────────────────────────────────────────────────────

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  birth_date DATE,
  gender gender_type,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'user',
  profile_picture TEXT,
  fitness_level fitness_level,
  activity_level activity_level DEFAULT 'moderate',
  weight NUMERIC(5,2),
  height NUMERIC(5,2),
  goals JSONB DEFAULT '{}',
  health_conditions JSONB DEFAULT '{}',
  dietary_preferences JSONB DEFAULT '{}',
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verification_code TEXT,
  email_verification_expires TIMESTAMPTZ,
  password_reset_token TEXT,
  password_reset_expires TIMESTAMPTZ,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret TEXT,
  device_fingerprint TEXT,
  fcm_token TEXT,
  refresh_token_family TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_expires_at);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- ── TABLA: PLANES DE DIETA ────────────────────────────────────────────────────

CREATE TABLE diet_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  total_calories INTEGER NOT NULL,
  macros JSONB NOT NULL DEFAULT '{"protein":0,"carbs":0,"fat":0}',
  days JSONB NOT NULL DEFAULT '[]',
  generated_by plan_generated_by NOT NULL DEFAULT 'ai',
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validation_notes TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diet_plans_user_id ON diet_plans(user_id);
CREATE INDEX idx_diet_plans_active ON diet_plans(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_diet_plans_pending ON diet_plans(validated_by) WHERE validated_by IS NULL AND generated_by = 'ai';

-- ── TABLA: RUTINAS DE ENTRENAMIENTO ──────────────────────────────────────────

CREATE TABLE workout_routines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  level fitness_level NOT NULL DEFAULT 'beginner',
  goal workout_goal NOT NULL DEFAULT 'strength',
  days_per_week INTEGER NOT NULL DEFAULT 3,
  days JSONB NOT NULL DEFAULT '[]',
  generated_by plan_generated_by NOT NULL DEFAULT 'ai',
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workout_routines_user_id ON workout_routines(user_id);
CREATE INDEX idx_workout_routines_active ON workout_routines(user_id, is_active) WHERE is_active = TRUE;

-- ── TABLA: EJERCICIOS ─────────────────────────────────────────────────────────

CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  equipment JSONB NOT NULL DEFAULT '[]',
  difficulty fitness_level NOT NULL DEFAULT 'beginner',
  video_url TEXT,
  image_url TEXT,
  instructions JSONB NOT NULL DEFAULT '[]',
  safety_tips TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exercises_muscle_group ON exercises(muscle_group);
CREATE INDEX idx_exercises_difficulty ON exercises(difficulty);
CREATE INDEX idx_exercises_verified ON exercises(is_verified) WHERE is_verified = TRUE;
CREATE INDEX idx_exercises_name_search ON exercises USING gin(to_tsvector('spanish', name || ' ' || description));

-- ── TABLA: SESIONES DE CHAT ───────────────────────────────────────────────────

CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Conversación',
  status chat_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(user_id, status);

-- ── TABLA: MENSAJES ───────────────────────────────────────────────────────────

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_type message_sender NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(session_id, created_at DESC);

-- ── TABLA: SUSCRIPCIONES ──────────────────────────────────────────────────────

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL,
  status subscription_status NOT NULL DEFAULT 'pending',
  payment_provider payment_provider NOT NULL DEFAULT 'none',
  payment_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  mercadopago_payment_id TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status, end_date);
CREATE INDEX idx_subscriptions_payment ON subscriptions(payment_provider, payment_id);

-- ── TABLA: NOTIFICACIONES ─────────────────────────────────────────────────────

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for) WHERE sent_at IS NULL;

-- ── TABLA: PROGRESO DEL USUARIO ───────────────────────────────────────────────

CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight NUMERIC(5,2),
  body_fat_percentage NUMERIC(4,1),
  measurements JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_user_progress_user_date ON user_progress(user_id, date DESC);

-- ── TABLA: REGISTRO DIARIO DE COMIDAS ────────────────────────────────────────

CREATE TABLE meal_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  diet_plan_id UUID REFERENCES diet_plans(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  meal_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_calories INTEGER NOT NULL DEFAULT 0,
  macros JSONB NOT NULL DEFAULT '{"protein":0,"carbs":0,"fat":0}',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meal_logs_user_date ON meal_logs(user_id, date DESC);

-- ── TABLA: REGISTRO DE ACTIVIDAD ──────────────────────────────────────────────

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

-- ── ROW LEVEL SECURITY (Supabase) ─────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

-- Política: usuarios solo ven sus propios datos
CREATE POLICY "users_own_data" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "diet_plans_own" ON diet_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "workout_routines_own" ON workout_routines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "chat_sessions_own" ON chat_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "messages_own_session" ON messages FOR ALL USING (
  EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid())
);
CREATE POLICY "subscriptions_own" ON subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_progress_own" ON user_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "meal_logs_own" ON meal_logs FOR ALL USING (auth.uid() = user_id);

-- Nutricionistas y admins pueden ver todos los planes para validación
CREATE POLICY "nutritionist_view_plans" ON diet_plans FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('nutritionist', 'admin'))
  );

-- ── TRIGGERS: updated_at automático ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_diet_plans_updated_at BEFORE UPDATE ON diet_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_workout_routines_updated_at BEFORE UPDATE ON workout_routines FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_meal_logs_updated_at BEFORE UPDATE ON meal_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── FUNCIÓN: Limpieza automática de datos expirados ──────────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
  DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '1 year';
  DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '6 months' AND is_read = TRUE;
  UPDATE users SET email_verification_code = NULL, email_verification_expires = NULL
    WHERE email_verification_expires < NOW();
  RAISE NOTICE 'Limpieza completada: %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
