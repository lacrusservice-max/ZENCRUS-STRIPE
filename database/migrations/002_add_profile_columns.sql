-- ============================================================
-- NutriAI Fit — Migración 002: columnas de perfil extendido
-- ============================================================

-- Agregar columnas que necesita el cliente móvil
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fitness_goals TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[] DEFAULT '{}';

-- Agregar nuevos valores al enum activity_level si no existen
DO $$ BEGIN
  ALTER TYPE activity_level ADD VALUE IF NOT EXISTS 'lightly_active';
  ALTER TYPE activity_level ADD VALUE IF NOT EXISTS 'moderately_active';
  ALTER TYPE activity_level ADD VALUE IF NOT EXISTS 'extremely_active';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Índice para buscar por perfil completado
CREATE INDEX IF NOT EXISTS idx_users_profile_completed ON users(profile_completed) WHERE profile_completed = TRUE;
