import { Request, Response } from 'express'
import { z } from 'zod'
import { DeepSeekClient } from '../../ai-integration/deepseek-client'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'

const aiClient = new DeepSeekClient(process.env.DEEPSEEK_API_KEY || '')

export const generateDietPlanSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    targetCalories: z.number().min(800).max(6000).optional(),
    targetMacros: z.object({
      protein: z.number().min(0).max(500),
      carbs: z.number().min(0).max(1000),
      fat: z.number().min(0).max(300),
    }).optional(),
    durationDays: z.number().min(1).max(30).default(7),
    requestValidation: z.boolean().default(false),
  }),
})

export const updateDietPlanSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    isActive: z.boolean().optional(),
    endDate: z.string().optional(),
  }),
})

export async function generateDietPlan(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { name, targetCalories, targetMacros, durationDays, requestValidation } = req.body

  const { data: profile } = await supabase
    .from('users')
    .select('weight, height, gender, activity_level, goals, dietary_preferences, health_conditions, birth_date')
    .eq('id', userId)
    .maybeSingle()

  const age = profile?.birth_date
    ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 30

  const userProfile = {
    age,
    weight: profile?.weight || 75,
    height: profile?.height || 170,
    gender: profile?.gender || 'male',
    goal: (profile?.goals as any)?.primary || 'maintenance',
    activityLevel: profile?.activity_level || 'moderate',
    restrictions: JSON.stringify(profile?.dietary_preferences || {}),
    healthConditions: JSON.stringify(profile?.health_conditions || {}),
  }

  const plan = await aiClient.generateDietPlan({
    ...userProfile,
    targetCalories,
    targetMacros,
    durationDays,
  })

  const { data: dietPlan, error } = await supabase
    .from('diet_plans')
    .insert({
      user_id: userId,
      name: name || `Plan de dieta — ${new Date().toLocaleDateString('es-MX')}`,
      description: 'Plan generado con IA personalizado para tu perfil',
      total_calories: plan.totalCalories,
      macros: plan.macros,
      days: plan.days || [],
      generated_by: 'ai',
      start_date: new Date().toISOString().split('T')[0],
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    logger.error('Error guardando plan de dieta:', error.message)
    res.status(500).json({ success: false, message: 'Error generando plan' } satisfies ApiResponse)
    return
  }

  if (requestValidation) {
    logger.info(`Plan de dieta pendiente de validación: ${dietPlan.id}`)
  }

  logger.info(`Plan de dieta generado para usuario: ${userId}`)

  res.status(201).json({
    success: true,
    message: requestValidation ? 'Plan generado. ZENCRUS lo revisará pronto.' : 'Plan de dieta generado exitosamente',
    data: dietPlan,
  } satisfies ApiResponse)
}

export async function getDietPlans(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: plans, error } = await supabase
    .from('diet_plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo planes' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: plans } satisfies ApiResponse)
}

export async function getActiveDietPlan(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: plan } = await supabase
    .from('diet_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!plan) {
    res.status(404).json({
      success: false,
      message: 'No tienes un plan de dieta activo. ¡Genera uno!',
    } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: plan } satisfies ApiResponse)
}

export async function getDietPlan(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.userId

  const { data: plan } = await supabase
    .from('diet_plans')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!plan) {
    res.status(404).json({ success: false, message: 'Plan de dieta no encontrado' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: plan } satisfies ApiResponse)
}

export async function updateDietPlan(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.userId
  const { name, isActive, endDate } = req.body

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (isActive !== undefined) updates.is_active = isActive
  if (endDate !== undefined) updates.end_date = endDate

  const { data: plan, error } = await supabase
    .from('diet_plans')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (error || !plan) {
    res.status(404).json({ success: false, message: 'Plan de dieta no encontrado' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, message: 'Plan actualizado', data: plan } satisfies ApiResponse)
}

export async function getPendingValidation(req: Request, res: Response): Promise<void> {
  const { data: pending, error } = await supabase
    .from('diet_plans')
    .select('*, users!user_id(full_name, email)')
    .is('validated_by', null)
    .eq('generated_by', 'ai')
    .order('created_at', { ascending: true })

  if (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo planes' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: pending } satisfies ApiResponse)
}

export async function validateDietPlan(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const nutritionistId = req.user!.userId

  const { data: plan, error } = await supabase
    .from('diet_plans')
    .update({ validated_by: nutritionistId })
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error || !plan) {
    res.status(404).json({ success: false, message: 'Plan no encontrado' } satisfies ApiResponse)
    return
  }

  logger.info(`Plan ${id} validado por nutrióloga ${nutritionistId}`)

  res.status(200).json({ success: true, message: 'Plan validado correctamente', data: plan } satisfies ApiResponse)
}
