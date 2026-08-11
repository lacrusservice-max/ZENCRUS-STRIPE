import dotenv from 'dotenv'
import path from 'path'
import { z } from 'zod'

// __dirname es backend/src/config, así que dos niveles arriba está backend/.
// Antes subía tres y apuntaba a la raíz del repo, donde no hay ningún .env:
// dotenv no encontraba nada y el arranque moría con "Required" en todas las
// variables aunque backend/.env estuviera completo.
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  APP_SECRET: z.string().min(32),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // ── Cloudflare R2 · medios de la comunidad ────────────────────────────────
  // Opcionales a propósito: sin ellas la app arranca igual y solo se cae la
  // subida de fotos y vídeos, que responde 503. Obligarlas dejaría el servidor
  // sin arrancar en cualquier entorno donde aún no se hayan configurado.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),

  // FatSecret — catálogo de alimentos. Solo aquí: la API exige lista blanca de
  // IP, así que las llamadas salen del backend y el secreto nunca toca la app.
  FATSECRET_CLIENT_ID: z.string().optional(),
  FATSECRET_CLIENT_SECRET: z.string().optional(),

  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_API_URL: z.string().url().default('https://api.deepseek.com/v1'),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),

  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('ZENCRUS <noreply@zencrus.com>'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ANNUAL_INDIVIDUAL: z.string().optional(),
  STRIPE_PRICE_ANNUAL_DUO: z.string().optional(),
  STRIPE_PRICE_ANNUAL_FAMILIAR: z.string().optional(),
  STRIPE_PRICE_EXTRA_MEMBER: z.string().optional(),

  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(5),
  ENCRYPTION_KEY: z.string().length(64),
  SALT_ROUNDS: z.coerce.number().default(12),

  FRONTEND_URL: z.string().default('http://localhost:3000'),
  BACKEND_URL: z.string().url().default('http://localhost:5000'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8081'),

  SENTRY_DSN: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
