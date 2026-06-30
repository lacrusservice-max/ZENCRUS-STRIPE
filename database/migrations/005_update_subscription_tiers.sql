-- ============================================================
-- ZENCRUS — Migración 005: Nuevos planes de suscripción (Stripe)
-- ============================================================
-- Reemplaza el modelo anterior (basic/premium/corporate) por el
-- modelo real vendido en Stripe: mensual + 3 anuales (individual,
-- dúo, familiar). El plan familiar admite integrantes extra.

-- 1. Agregar los nuevos valores al ENUM existente
--    (Postgres no permite eliminar valores de un ENUM in-place;
--    los valores viejos quedan sin uso pero no rompen nada)
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'monthly';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'annual_individual';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'annual_duo';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'annual_familiar';

-- 2. Columnas necesarias para el checkout real de Stripe
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS extra_members INTEGER NOT NULL DEFAULT 0;

-- extra_members: solo aplica a 'annual_familiar' (máx. 2 — el plan
-- familiar ya incluye 4 integrantes, tope total de 6 integrantes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'extra_members_range'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT extra_members_range CHECK (extra_members BETWEEN 0 AND 2);
  END IF;
END $$;
