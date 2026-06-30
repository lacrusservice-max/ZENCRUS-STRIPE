import { Request, Response } from 'express'
import { z } from 'zod'
import { DeepSeekClient } from '../../ai-integration/deepseek-client'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'

const aiClient = new DeepSeekClient(process.env.DEEPSEEK_API_KEY || '')

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

const DISCLAIMER = '⚕️ **Aviso importante:** Soy un asistente de IA con conocimiento en nutrición y fitness. Mis recomendaciones son informativas y no sustituyen la consulta con un profesional de la salud. Siempre consulta con tu médico o nutriólogo antes de hacer cambios significativos en tu dieta o entrenamiento.\n\n¡Hola! Soy EuniceAI, tu asistente personal de nutrición y fitness. ¿En qué puedo ayudarte hoy? 😊'

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

  const context = {
    userId,
    messageHistory: (previousMessages || []).reverse().map((m: any) => ({
      role: m.sender_type,
      content: m.content,
    })),
  }

  const aiResponse = await aiClient.chat(content, context)

  const { data: aiMessage } = await supabase
    .from('messages')
    .insert({ session_id: id, sender_type: 'ai', content: aiResponse.response })
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
