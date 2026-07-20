import { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../config/supabase'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { calcularNutricion, PerfilUsuario, calcularFaseCiclo } from '../services/nutritionCalculator'

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

export async function getNutritionPlan(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: user } = await supabase
    .from('users')
    .select('weight, height, birth_date, gender, activity_level, goals, onboarding_data')
    .eq('id', userId)
    .maybeSingle()

  if (!user?.weight || !user?.height) {
    res.status(200).json({
      success: true,
      data: null,
      message: 'Completa tu perfil para ver tu plan nutricional',
    } satisfies ApiResponse)
    return
  }

  const ob = user.onboarding_data ?? {}
  const edad = user.birth_date
    ? Math.floor((Date.now() - new Date(user.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : ob.edad ?? 25

  const perfil: PerfilUsuario = {
    peso: user.weight,
    talla: user.height,
    edad,
    sexo: user.gender === 'female' ? 'female' : 'male',
    objetivo: ob.objetivo ?? 'mantenimiento',
    nivelActividad: ob.nivelActividad ?? 'moderado',
    sesionesEntrenamiento: ob.sesionesEntrenamiento ?? 3,
    minutosEntrenamiento: ob.minutosEntrenamiento ?? 45,
    tipoEntrenamiento: ob.tipoEntrenamiento ?? 'mixto',
    nivelEstrés: ob.nivelEstres ?? 5,
    horasSueno: ob.horasSueno ?? 7,
    calidadSueno: ob.calidadSueno ?? 'regular',
    porcentajeGrasa: ob.porcentajeGrasa,
    diaInicioCiclo: ob.diaInicioCiclo ? new Date(ob.diaInicioCiclo) : undefined,
    usaAnticonceptivos: ob.usaAnticonceptivos,
    presupuestoSemanal: ob.presupuestoSemanal,
  }

  const resultado = calcularNutricion(perfil)

  res.status(200).json({ success: true, data: { perfil, resultado } } satisfies ApiResponse)
}

export async function saveOnboardingData(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const onboardingData = req.body

  const { error } = await supabase
    .from('users')
    .update({
      onboarding_data: onboardingData,
      profile_completed: true,
      weight: onboardingData.peso,
      height: onboardingData.talla,
      gender: onboardingData.sexo,
      activity_level: onboardingData.nivelActividad,
    })
    .eq('id', userId)

  if (error) {
    logger.error('Error guardando onboarding:', error.message)
    res.status(500).json({ success: false, message: 'Error guardando perfil' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, message: 'Perfil de onboarding guardado' } satisfies ApiResponse)
}
