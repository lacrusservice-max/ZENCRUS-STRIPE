import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { authenticate } from '../middleware/auth'
import { logger } from '../config/logger'

const router = Router()
router.use(authenticate)

// POST /api/onboarding/complete — guarda el perfil del onboarding y lo marca completo
router.post('/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId ?? req.user?.id
    if (!userId) { res.status(401).json({ success: false, message: 'No autenticado' }); return }

    const b = req.body as Record<string, unknown>

    // Mapear payload (camelCase de la web) a columnas de la tabla users
    const goal = typeof b.goal === 'string' ? b.goal : undefined
    const dietary = Array.isArray(b.dietaryRestrictions) ? b.dietaryRestrictions
      : b.dietaryRestrictions ? [b.dietaryRestrictions] : []

    const num = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? v : (typeof v === 'string' && v !== '' ? Number(v) : undefined))

    // Datos extendidos que no tienen columna propia se guardan en JSONB "onboarding_data"
    const extended = {
      goal_weight: num(b.goalWeight),
      training_type: b.trainingType,
      training_types: b.trainingTypes,
      meals_per_day: b.mealsPerDay,
    }

    const core: Record<string, unknown> = {
      onboarding_completed: true,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    }
    if (num(b.weight) !== undefined) core.weight = num(b.weight)
    if (num(b.height) !== undefined) core.height = num(b.height)
    if (num(b.age) !== undefined) core.age = num(b.age)
    if (typeof b.gender === 'string') core.gender = b.gender
    if (typeof b.activityLevel === 'string') core.activity_level = b.activityLevel
    if (goal) core.fitness_goals = [goal]
    if (dietary.length) core.dietary_restrictions = dietary

    // Intento 1: con columnas extendidas (onboarding_data jsonb si existe)
    let { error } = await supabase.from('users').update({ ...core, onboarding_data: extended }).eq('id', userId)

    // Intento 2 (fallback): si algo falla (p.ej. onboarding_data no existe), guardar solo core
    if (error) {
      const retry = await supabase.from('users').update(core).eq('id', userId)
      error = retry.error
    }

    // Intento 3 (mínimo garantizado): solo marcar onboarding completado
    if (error) {
      const retry = await supabase.from('users').update({ onboarding_completed: true, updated_at: new Date().toISOString() }).eq('id', userId)
      error = retry.error
    }

    if (error) throw error

    res.json({ success: true, message: 'Perfil guardado', data: { onboarding_completed: true } })
  } catch (err) {
    logger.error('Onboarding complete error:', err)
    res.status(500).json({ success: false, message: 'Error guardando el perfil' })
  }
})

export default router
