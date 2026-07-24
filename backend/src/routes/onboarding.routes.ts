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

    // Compatibilidad: dos formularios de onboarding distintos mandan campos con nombres diferentes
    // (gender/age vs. sex/birthDate). Aceptamos ambos.
    const gender = (typeof b.gender === 'string' ? b.gender : typeof b.sex === 'string' ? b.sex : undefined)
    let age = num(b.age)
    if (age === undefined && typeof b.birthDate === 'string' && b.birthDate) {
      const parsed = Math.floor((Date.now() - new Date(b.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      if (!isNaN(parsed) && parsed > 0 && parsed < 120) age = parsed
    }
    const activityLevel = (typeof b.activityLevel === 'string' ? b.activityLevel : undefined)

    // Datos extendidos (sin columna propia) → JSONB "goals"
    const goalsJson = {
      primary: goal,
      goal_weight: num(b.goalWeight),
      training_type: b.trainingType,
      training_types: b.trainingTypes,
      meals_per_day: b.mealsPerDay,
    }

    const core: Record<string, unknown> = {
      profile_completed: true,
      goals: goalsJson,
      updated_at: new Date().toISOString(),
    }
    if (num(b.weight) !== undefined) core.weight = num(b.weight)
    if (num(b.height) !== undefined) core.height = num(b.height)
    if (age !== undefined) core.age = age
    if (gender) core.gender = gender
    if (activityLevel) core.activity_level = activityLevel
    if (goal) core.fitness_goals = [goal]
    if (dietary.length) core.dietary_restrictions = dietary

    // Intento 1: perfil completo
    let { error } = await supabase.from('users').update(core).eq('id', userId)

    // Intento 2 (mínimo garantizado): marcar perfil completado
    if (error) {
      logger.warn('Onboarding update completo falló, reintentando mínimo:', error.message)
      const retry = await supabase.from('users').update({ profile_completed: true, updated_at: new Date().toISOString() }).eq('id', userId)
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
