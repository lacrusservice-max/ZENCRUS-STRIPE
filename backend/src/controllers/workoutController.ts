import { Request, Response } from 'express'
import { z } from 'zod'
import { DeepSeekClient } from '../../ai-integration/deepseek-client'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'

const aiClient = new DeepSeekClient(process.env.DEEPSEEK_API_KEY || '')

export const generateWorkoutSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    goal: z.enum(['strength', 'hypertrophy', 'endurance', 'functional']).default('strength'),
    daysPerWeek: z.number().min(2).max(6).default(3),
    sessionDuration: z.number().min(20).max(120).default(60),
    equipment: z.array(z.string()).default(['bodyweight']),
    injuries: z.array(z.string()).default([]),
    requestValidation: z.boolean().default(false),
  }),
})

export async function generateWorkoutRoutine(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { name, level, goal, daysPerWeek, sessionDuration, equipment, injuries, requestValidation } = req.body

  const routine = await aiClient.generateWorkoutRoutine({
    level,
    goal,
    daysPerWeek,
    sessionDuration,
    equipment,
    injuries,
  })

  const { data: workoutRoutine, error } = await supabase
    .from('workout_routines')
    .insert({
      user_id: userId,
      name: name || `Rutina ${goal} — ${level}`,
      description: routine.notes || 'Rutina generada con IA',
      level,
      goal,
      days_per_week: daysPerWeek,
      days: routine.days || [],
      generated_by: 'ai',
      start_date: new Date().toISOString().split('T')[0],
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    logger.error('Error guardando rutina:', error.message)
    res.status(500).json({ success: false, message: 'Error generando rutina' } satisfies ApiResponse)
    return
  }

  logger.info(`Rutina generada para usuario: ${userId}`)

  res.status(201).json({
    success: true,
    message: requestValidation ? 'Rutina generada. El entrenador la revisará pronto.' : 'Rutina de entrenamiento generada exitosamente',
    data: workoutRoutine,
  } satisfies ApiResponse)
}

export async function getWorkoutRoutines(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: routines, error } = await supabase
    .from('workout_routines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo rutinas' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: routines } satisfies ApiResponse)
}

export async function getActiveRoutine(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: routine } = await supabase
    .from('workout_routines')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!routine) {
    res.status(404).json({
      success: false,
      message: 'No tienes una rutina activa. ¡Genera una!',
    } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: routine } satisfies ApiResponse)
}

export async function getWorkoutRoutine(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.userId

  const { data: routine } = await supabase
    .from('workout_routines')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!routine) {
    res.status(404).json({ success: false, message: 'Rutina no encontrada' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: routine } satisfies ApiResponse)
}
