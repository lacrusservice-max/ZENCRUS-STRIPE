import { Request, Response } from 'express'
import { z } from 'zod'
import { DeepSeekClient } from '../../ai-integration/deepseek-client'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import { construirSystemPrompt } from '../services/aiSystemPrompt'
import { calcularNutricion, PerfilUsuario } from '../services/nutritionCalculator'
import { AI_TOOLS, executeAiTool } from '../services/aiTools'

const aiClient = new DeepSeekClient(process.env.DEEPSEEK_API_KEY || '')

async function obtenerPerfilParaIA(userId: string): Promise<{
  perfil: PerfilUsuario | null
  nombre: string | null
}> {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('full_name, weight, height, birth_date, gender, activity_level, goals, health_conditions, onboarding_data')
      .eq('id', userId)
      .maybeSingle()

    if (!user) return { perfil: null, nombre: null }

    const ob = user.onboarding_data ?? {}
    const edad = user.birth_date
      ? Math.floor((Date.now() - new Date(user.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : ob.edad ?? 25

    if (!user.weight || !user.height) return { perfil: null, nombre: user.full_name }

    const perfil: PerfilUsuario = {
      peso: user.weight,
      talla: user.height,
      edad,
      sexo: user.gender === 'female' ? 'female' : 'male',
      objetivo: mapearObjetivo(user.goals?.primary ?? ob.objetivo),
      nivelActividad: mapearActividad(user.activity_level ?? ob.nivelActividad),
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

    return { perfil, nombre: user.full_name }
  } catch {
    return { perfil: null, nombre: null }
  }
}

function mapearObjetivo(raw: string | undefined): PerfilUsuario['objetivo'] {
  const map: Record<string, PerfilUsuario['objetivo']> = {
    weight_loss: 'perdida_grasa',
    muscle_gain: 'ganancia_muscular',
    maintenance: 'mantenimiento',
    performance: 'rendimiento',
    recomposicion: 'recomposicion',
  }
  return map[raw ?? ''] ?? 'mantenimiento'
}

function mapearActividad(raw: string | undefined): PerfilUsuario['nivelActividad'] {
  const map: Record<string, PerfilUsuario['nivelActividad']> = {
    sedentary: 'sedentario',
    light: 'ligero',
    moderate: 'moderado',
    active: 'activo',
    very_active: 'muy_activo',
  }
  return map[raw ?? ''] ?? 'moderado'
}

export const createSessionSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).optional(),
  }),
})

export const sendMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
  }),
})

const DISCLAIMER = '⚕️ **Aviso importante:** Soy un asistente de IA con conocimiento en nutrición y fitness. Mis recomendaciones son informativas y no sustituyen la consulta con un profesional de la salud. Siempre consulta con tu médico o nutriólogo antes de hacer cambios significativos en tu dieta o entrenamiento.\n\n¡Hola! Soy ZENCRUS, tu asistente personal de nutrición y fitness. ¿En qué puedo ayudarte hoy? 😊'

export async function createSession(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { title } = req.body

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      title: title || `Chat ${new Date().toLocaleDateString('es-MX')}`,
      status: 'active',
    })
    .select()
    .single()

  if (error) {
    logger.error('Error creando sesión de chat:', error.message)
    res.status(500).json({ success: false, message: 'Error creando conversación' } satisfies ApiResponse)
    return
  }

  const { data: disclaimerMessage } = await supabase
    .from('messages')
    .insert({
      session_id: session.id,
      sender_type: 'ai',
      content: DISCLAIMER,
    })
    .select()
    .single()

  res.status(201).json({
    success: true,
    data: { session, messages: [disclaimerMessage] },
  } satisfies ApiResponse)
}

export async function getSessions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: sessions, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo conversaciones' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: sessions } satisfies ApiResponse)
}

export async function getSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.userId

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!session) {
    res.status(404).json({ success: false, message: 'Conversación no encontrada' } satisfies ApiResponse)
    return
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', id)
    .order('created_at', { ascending: true })

  res.status(200).json({
    success: true,
    data: { session, messages: messages || [] },
  } satisfies ApiResponse)
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.userId
  const { content } = req.body

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!session) {
    res.status(404).json({ success: false, message: 'Conversación no encontrada' } satisfies ApiResponse)
    return
  }

  const { data: userMessage } = await supabase
    .from('messages')
    .insert({ session_id: id, sender_type: 'user', content })
    .select()
    .single()

  const { data: previousMessages } = await supabase
    .from('messages')
    .select('sender_type, content')
    .eq('session_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Obtener perfil del usuario y construir system prompt personalizado
  const { perfil, nombre } = await obtenerPerfilParaIA(userId)
  const resultadoNutricional = perfil ? calcularNutricion(perfil) : null
  const systemPrompt = construirSystemPrompt(perfil, resultadoNutricional, nombre ?? undefined)

  const history = (previousMessages || []).reverse().map((m: any) => ({
    role: m.sender_type === 'ai' ? 'assistant' : 'user',
    content: m.content,
  }))

  // System prompt + aviso de que ZENA puede ejecutar cambios reales con herramientas.
  const toolsHint = `\n\nPUEDES EJECUTAR CAMBIOS REALES en la app del usuario mediante herramientas: cambiar su objetivo, actualizar su peso/actividad, ajustar sus targets nutricionales (calorías/macros/comidas) y regenerar su plan. Cuando el usuario pida un cambio de este tipo, USA la herramienta correspondiente en lugar de solo describirlo. Después confirma con lenguaje natural y cálido lo que hiciste.`

  const messages = [
    { role: 'system', content: systemPrompt + toolsHint },
    ...history,
    { role: 'user', content },
  ]

  let finalText: string

  try {
    const first = await aiClient.chatWithTools(messages, AI_TOOLS as any)

    if (first.toolCalls?.length) {
      // La IA pidió ejecutar acciones — las corremos y le devolvemos los resultados.
      const toolResultMessages: any[] = []
      for (const call of first.toolCalls) {
        let args: Record<string, any> = {}
        try { args = JSON.parse(call.function?.arguments || '{}') } catch { /* args vacíos */ }
        const result = await executeAiTool(call.function?.name, args, userId)
        toolResultMessages.push({ role: 'tool', tool_call_id: call.id, content: result })
      }
      const followup = await aiClient.chatContinuation([
        ...messages,
        first.assistantMessage ?? { role: 'assistant', content: first.content ?? '', tool_calls: first.toolCalls },
        ...toolResultMessages,
      ])
      finalText = followup.content
    } else {
      finalText = first.content
    }
  } catch (err) {
    logger.error('sendMessage IA error:', err)
    finalText = 'Tuve un problema procesando tu mensaje. Intenta de nuevo en un momento.'
  }

  const { data: aiMessage } = await supabase
    .from('messages')
    .insert({ session_id: id, sender_type: 'ai', content: finalText })
    .select()
    .single()

  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)

  res.status(200).json({
    success: true,
    data: { userMessage, aiMessage },
  } satisfies ApiResponse)
}

export async function archiveSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.userId

  const { data: session } = await supabase
    .from('chat_sessions')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (!session) {
    res.status(404).json({ success: false, message: 'Conversación no encontrada' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, message: 'Conversación archivada' } satisfies ApiResponse)
}
