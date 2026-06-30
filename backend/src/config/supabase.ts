import { createClient, SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'
import { env } from './env'
import { logger } from './logger'

// ── Cliente con service_role (para operaciones admin del backend) ─────────────
export const supabase: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
    realtime: {
      transport: ws,
    },
  }
)

// ── Cliente con anon key (para operaciones públicas) ──────────────────────────
export const supabasePublic: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
    realtime: {
      transport: ws,
    },
  }
)

export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('users').select('count').limit(1)
    if (error && error.code !== 'PGRST116') {
      logger.error('Supabase conexión fallida:', error.message)
      return false
    }
    logger.info('✅ Supabase conectado correctamente')
    return true
  } catch (error) {
    logger.error('Supabase error de conexión:', error)
    return false
  }
}

// ── Helpers de query reutilizables ────────────────────────────────────────────

export async function findById<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Error en ${table}.findById: ${error.message}`)
  }

  return data as T
}

export async function findOneBy<T>(
  table: string,
  field: string,
  value: string | number | boolean
): Promise<T | null> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(field, value)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Error en ${table}.findOneBy: ${error.message}`)
  }

  return data as T
}

export async function insertRow<T>(table: string, row: Partial<T>): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .insert(row)
    .select()
    .single()

  if (error) throw new Error(`Error en ${table}.insert: ${error.message}`)
  return data as T
}

export async function updateRow<T>(
  table: string,
  id: string,
  updates: Partial<T>
): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Error en ${table}.update: ${error.message}`)
  return data as T
}

export async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw new Error(`Error en ${table}.delete: ${error.message}`)
}

export async function countRows(
  table: string,
  filters?: Record<string, unknown>
): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }
  }

  const { count, error } = await query
  if (error) throw new Error(`Error en ${table}.count: ${error.message}`)
  return count || 0
}
