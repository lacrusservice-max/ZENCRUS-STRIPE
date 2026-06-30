import { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../config/supabase'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'

export const updateProfileSchema = z.object({
  body: z.object({
    full_name: z.string().min(2).max(100).optional(),
    weight: z.number().min(20).max(300).optional(),
    height: z.number().min(100).max(250).optional(),
    age: z.number().min(10).max(120).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    activity_level: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active']).optional(),
    fitness_goals: z.array(z.string()).optional(),
    dietary_restrictions: z.array(z.string()).optional(),
    health_conditions: z.array(z.string()).optional(),
    fcm_token: z.string().optional(),
  }),
})

const SAFE_COLUMNS = [
  'id', 'email', 'full_name', 'role', 'subscription_tier',
  'email_verified', 'weight', 'height', 'age', 'gender',
  'activity_level', 'fitness_goals', 'dietary_restrictions',
  'health_conditions', 'dietary_preferences', 'goals',
  'profile_completed', 'last_login', 'created_at',
].join(', ')

export async function getProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data, error } = await supabase
    .from('users')
    .select(SAFE_COLUMNS)
    .eq('id', userId)
    .single()

  if (error || !data) {
    res.status(404).json({ success: false, message: 'Usuario no encontrado' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data } satisfies ApiResponse)
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const updates = req.body

  // Mark profile as completed if key fields are present
  const profileCompleted = !!(updates.weight && updates.height && updates.age && updates.gender && updates.activity_level)

  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, ...(profileCompleted ? { profile_completed: true } : {}), updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select(SAFE_COLUMNS)
    .single()

  if (error) {
    logger.error('Error actualizando perfil:', error)
    res.status(500).json({ success: false, message: 'Error actualizando perfil' } satisfies ApiResponse)
    return
  }

  logger.info(`Perfil actualizado: ${userId}`)
  res.status(200).json({ success: true, message: 'Perfil actualizado correctamente', data } satisfies ApiResponse)
}

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { error } = await supabase
    .from('users')
    .update({ is_active: false, email: `deleted_${userId}@deleted.com` })
    .eq('id', userId)

  if (error) {
    res.status(500).json({ success: false, message: 'Error eliminando cuenta' } satisfies ApiResponse)
    return
  }

  logger.info(`Cuenta desactivada: ${userId}`)
  res.status(200).json({ success: true, message: 'Tu cuenta ha sido eliminada.' } satisfies ApiResponse)
}

export async function exportData(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const [userRes, dietRes, workoutRes] = await Promise.all([
    supabase.from('users').select(SAFE_COLUMNS).eq('id', userId).single(),
    supabase.from('diet_plans').select('*').eq('user_id', userId),
    supabase.from('workout_plans').select('*').eq('user_id', userId),
  ])

  const exportData = {
    profile: userRes.data,
    dietPlans: dietRes.data ?? [],
    workoutRoutines: workoutRes.data ?? [],
    exportedAt: new Date().toISOString(),
    note: 'Exportación completa de tus datos — NutriAI Fit',
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="nutriai-datos-${userId}.json"`)
  res.status(200).json(exportData)
}

export async function updateFcmToken(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { fcmToken } = req.body

  await supabase.from('users').update({ fcm_token: fcmToken }).eq('id', userId)

  res.status(200).json({ success: true, message: 'Token de notificación actualizado' } satisfies ApiResponse)
}
