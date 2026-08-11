import { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../config/supabase'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { calcularNutricion, PerfilUsuario } from '../services/nutritionCalculator'
import { listByPrefix, readUrls } from '../services/media'
import { purgeUserContent } from './socialContentController'

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

/**
 * DELETE /users/me
 *
 * La cuenta se apaga y se anonimiza el correo. Además se retira el contenido de
 * la comunidad —publicaciones, historias y TODOS los archivos del bucket—:
 * antes esto decía «Tu cuenta ha sido eliminada» y dejaba cada foto y cada
 * vídeo en el almacén para siempre, que es una promesa a medias.
 *
 * `refresh_token_family` a null cierra la sesión en el acto: sin eso, el token
 * de refresco que ya tuviera seguiría sirviendo.
 */
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { error } = await supabase
    .from('users')
    .update({
      is_active: false,
      email: `deleted_${userId}@deleted.com`,
      profile_picture: null,
      refresh_token_family: null,
    })
    .eq('id', userId)

  if (error) {
    res.status(500).json({ success: false, message: 'Error eliminando cuenta' } satisfies ApiResponse)
    return
  }

  // Después de apagar la cuenta, nunca antes: si la baja fallara, se habrían
  // borrado los archivos de alguien que sigue dentro.
  const { posts, files } = await purgeUserContent(userId)

  logger.info(`Cuenta dada de baja: ${userId} · ${posts} publicaciones, ${files} archivos`)
  res.status(200).json({ success: true, message: 'Tu cuenta ha sido eliminada.' } satisfies ApiResponse)
}

/**
 * GET /users/me/export
 *
 * Se anunciaba como «exportación completa» y traía solo perfil, dietas y
 * entrenamientos: desde que existe la comunidad, eso dejaba fuera todo lo que
 * la gente escribe, publica y conversa. Ahora va también.
 *
 * Las conversaciones incluyen lo que la otra persona escribió: forma parte de
 * TU conversación tanto como lo tuyo, y sin ello la exportación es un
 * monólogo. Los archivos no se meten dentro del fichero —serían cientos de
 * megas— sino como enlaces firmados, que caducan en una hora; el aviso lo dice.
 */
export async function exportData(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const [userRes, dietRes, workoutRes, postsRes, comentRes, seguidoresRes, siguiendoRes, convRes, avisosRes] =
    await Promise.all([
      supabase.from('users').select(SAFE_COLUMNS).eq('id', userId).single(),
      supabase.from('diet_plans').select('*').eq('user_id', userId),
      supabase.from('workout_plans').select('*').eq('user_id', userId),
      supabase.from('posts')
        .select('id, content, kind, visibility, likes_count, comments_count, expires_at, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('post_comments').select('id, post_id, content, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('follows').select('follower_id, status, created_at').eq('following_id', userId),
      supabase.from('follows').select('following_id, status, created_at').eq('follower_id', userId),
      supabase.from('conversations').select('id, user_lo, user_hi, status, created_at')
        .or(`user_lo.eq.${userId},user_hi.eq.${userId}`),
      supabase.from('social_notifications')
        .select('id, actor_id, type, post_id, is_read, created_at').eq('user_id', userId),
    ])

  const convIds = (convRes.data ?? []).map(c => c.id)
  const { data: mensajes } = convIds.length
    ? await supabase.from('direct_messages')
        .select('id, conversation_id, sender_id, body, media_type, read_at, created_at')
        .in('conversation_id', convIds).order('created_at', { ascending: true })
    : { data: [] as any[] }

  // Los archivos, como enlaces temporales. Se piden al almacén y no a la base
  // para que salgan también los que quedaron sin enlazar.
  const claves: string[] = []
  for (const ambito of ['post', 'story', 'avatar', 'dm']) {
    claves.push(...await listByPrefix(`${ambito}/${userId}/`))
  }
  const firmadas = await readUrls(claves)

  const exportData = {
    profile: userRes.data,
    dietPlans: dietRes.data ?? [],
    workoutRoutines: workoutRes.data ?? [],
    community: {
      posts: postsRes.data ?? [],
      comments: comentRes.data ?? [],
      followers: seguidoresRes.data ?? [],
      following: siguiendoRes.data ?? [],
      conversations: convRes.data ?? [],
      messages: mensajes ?? [],
      notifications: avisosRes.data ?? [],
    },
    files: claves.map(k => ({ key: k, url: firmadas.get(k) ?? null })),
    exportedAt: new Date().toISOString(),
    note: 'Exportación completa de tus datos — ZENCRUS. Los enlaces de «files» caducan una hora después de la fecha de exportación.',
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
