import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import Stripe from 'stripe'
import { supabase } from '../config/supabase'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { signAccessToken, signRefreshToken } from '../utils/jwt'
import { sendPushToTokens } from '../config/firebase'
import { Resend } from 'resend'
import { env } from '../config/env'

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null
const FROM_EMAIL = 'ZENCRUS <noreply@zencrus.com>'

// ── Helpers ───────────────────────────────────────────────────────────────────

function page(req: Request) {
  return {
    p:     Math.max(1, parseInt(String(req.query.page  ?? 1))),
    limit: Math.min(100, parseInt(String(req.query.limit ?? 20))),
  }
}

function range(p: number, limit: number) {
  const from = (p - 1) * limit
  return { from, to: from + limit - 1 }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date()
    const d7  = new Date(now.getTime() - 7  * 864e5).toISOString()
    const d30 = new Date(now.getTime() - 30 * 864e5).toISOString()

    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: newUsers7d },
      { count: newUsers30d },
      { count: totalSubs },
      { count: activeSubs },
      { count: totalMessages },
      { count: totalDietPlans },
      { count: totalWorkouts },
      { data: subsByTier },
      { data: recentLogs },
      { data: recentUsers },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', d7),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', d30),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('diet_plans').select('*', { count: 'exact', head: true }),
      supabase.from('workout_routines').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('tier').eq('status', 'active'),
      supabase.from('audit_logs').select('action,created_at,metadata,user_id,users(email,full_name)').order('created_at', { ascending: false }).limit(10),
      supabase.from('users').select('id,email,full_name,subscription_tier,created_at,is_active').order('created_at', { ascending: false }).limit(8),
    ])

    // Revenue estimate (basic: tier × count)
    const prices: Record<string, number> = { free: 0, basic: 199, premium: 499, corporate: 1499 }
    const tierCounts = (subsByTier ?? []).reduce((acc: Record<string, number>, s: any) => {
      acc[s.tier] = (acc[s.tier] ?? 0) + 1
      return acc
    }, {})
    const monthlyRevenue = Object.entries(tierCounts).reduce(
      (sum, [tier, count]) => sum + (prices[tier] ?? 0) * (count as number), 0
    )

    res.json({
      success: true,
      data: {
        users: {
          total:   totalUsers  ?? 0,
          active:  activeUsers ?? 0,
          new7d:   newUsers7d  ?? 0,
          new30d:  newUsers30d ?? 0,
        },
        subscriptions: {
          total:          totalSubs  ?? 0,
          active:         activeSubs ?? 0,
          byTier:         tierCounts,
          monthlyRevenue,
        },
        content: {
          messages:    totalMessages  ?? 0,
          dietPlans:   totalDietPlans ?? 0,
          workouts:    totalWorkouts  ?? 0,
        },
        recentLogs:  recentLogs  ?? [],
        recentUsers: recentUsers ?? [],
      },
    } satisfies ApiResponse)
  } catch (err) {
    logger.error('Admin dashboard error:', err)
    res.status(500).json({ success: false, message: 'Error obteniendo estadísticas' })
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const { p, limit } = page(req)
    const { from, to } = range(p, limit)
    const { search, role, tier, status } = req.query as Record<string, string>

    let q = supabase
      .from('users')
      .select('id,email,full_name,role,subscription_tier,is_active,email_verified,created_at,last_login,profile_picture,failed_login_attempts', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search)  q = q.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    if (role)    q = q.eq('role', role)
    if (tier)    q = q.eq('subscription_tier', tier)
    if (status === 'active')   q = q.eq('is_active', true)
    if (status === 'inactive') q = q.eq('is_active', false)
    if (status === 'locked')   q = q.not('locked_until', 'is', null)

    const { data, count, error } = await q
    if (error) throw error

    res.json({
      success: true,
      data,
      pagination: { page: p, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    })
  } catch (err) {
    logger.error('Admin getUsers error:', err)
    res.status(500).json({ success: false, message: 'Error obteniendo usuarios' })
  }
}

export async function getUserDetail(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const [
      { data: user },
      { data: subscriptions },
      { data: auditLogs },
      { data: dietPlans },
      { data: workouts },
      { count: chatCount },
    ] = await Promise.all([
      supabase.from('users').select('*').eq('id', id).single(),
      supabase.from('subscriptions').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('diet_plans').select('id,name,is_active,created_at,total_calories').eq('user_id', id).order('created_at', { ascending: false }).limit(5),
      supabase.from('workout_routines').select('id,name,is_active,created_at,goal').eq('user_id', id).order('created_at', { ascending: false }).limit(5),
      supabase.from('chat_sessions').select('*', { count: 'exact', head: true }).eq('user_id', id),
    ])

    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' })
      return
    }

    // Omit sensitive fields
    const { password_hash, email_verification_code, two_factor_secret, refresh_token_family, ...safeUser } = user as any

    res.json({
      success: true,
      data: { user: safeUser, subscriptions, auditLogs, dietPlans, workouts, chatCount },
    })
  } catch (err) {
    logger.error('Admin getUserDetail error:', err)
    res.status(500).json({ success: false, message: 'Error obteniendo usuario' })
  }
}

export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { isActive } = req.body as { isActive: boolean }

    const { error } = await supabase.from('users').update({ is_active: isActive, updated_at: new Date() }).eq('id', id)
    if (error) throw error

    // Log the admin action
    await supabase.from('audit_logs').insert({
      user_id: id,
      action: isActive ? 'admin_activate_user' : 'admin_deactivate_user',
      metadata: { admin_id: req.user?.id },
    })

    res.json({ success: true, message: `Usuario ${isActive ? 'activado' : 'desactivado'}` })
  } catch (err) {
    logger.error('Admin updateUserStatus error:', err)
    res.status(500).json({ success: false, message: 'Error actualizando usuario' })
  }
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { role } = req.body as { role: string }
    const valid = ['user', 'admin', 'nutritionist']
    if (!valid.includes(role)) {
      res.status(400).json({ success: false, message: 'Rol inválido' })
      return
    }

    const { error } = await supabase.from('users').update({ role, updated_at: new Date() }).eq('id', id)
    if (error) throw error

    await supabase.from('audit_logs').insert({
      user_id: id,
      action: 'admin_change_role',
      metadata: { new_role: role, admin_id: req.user?.id },
    })

    res.json({ success: true, message: `Rol actualizado a ${role}` })
  } catch (err) {
    logger.error('Admin updateUserRole error:', err)
    res.status(500).json({ success: false, message: 'Error cambiando rol' })
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    if (id === req.user?.id) {
      res.status(400).json({ success: false, message: 'No puedes eliminarte a ti mismo' })
      return
    }

    const { data: user } = await supabase.from('users').select('email,full_name').eq('id', id).single()

    await supabase.from('audit_logs').insert({
      action: 'admin_delete_user',
      metadata: { deleted_user_id: id, deleted_email: (user as any)?.email, admin_id: req.user?.id },
    })

    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) throw error

    res.json({ success: true, message: 'Usuario eliminado permanentemente' })
  } catch (err) {
    logger.error('Admin deleteUser error:', err)
    res.status(500).json({ success: false, message: 'Error eliminando usuario' })
  }
}

export async function unlockUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { error } = await supabase.from('users').update({
      locked_until: null,
      failed_login_attempts: 0,
      updated_at: new Date(),
    }).eq('id', id)
    if (error) throw error
    res.json({ success: true, message: 'Cuenta desbloqueada' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error desbloqueando cuenta' })
  }
}

// ── Fase 2: gestión avanzada de cuenta ─────────────────────────────────────────

// Regalar / activar suscripción manual (premium por X días, sin cobro)
export async function grantSubscription(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { tier = 'premium', days = 30 } = req.body as { tier?: string; days?: number }
    const d = Math.max(1, Math.min(3650, Number(days) || 30))

    const now = new Date()
    const end = new Date(now.getTime() + d * 864e5)

    // Cancelar suscripciones activas previas para no duplicar
    await supabase.from('subscriptions').update({ status: 'cancelled', auto_renew: false }).eq('user_id', id).eq('status', 'active')

    const { error: subErr } = await supabase.from('subscriptions').insert({
      user_id: id,
      tier,
      status: 'active',
      payment_provider: 'none', // regalo/manual
      start_date: now.toISOString(),
      end_date: end.toISOString(),
      auto_renew: false,
    })
    if (subErr) throw subErr

    await supabase.from('users').update({
      subscription_tier: tier,
      subscription_expires_at: end.toISOString(),
      updated_at: new Date(),
    }).eq('id', id)

    await supabase.from('audit_logs').insert({
      user_id: id,
      action: 'admin_grant_subscription',
      metadata: { tier, days: d, end: end.toISOString(), admin_id: req.user?.id },
    })

    res.json({ success: true, message: `${tier} activado por ${d} días (vence ${end.toISOString().slice(0, 10)})` })
  } catch (err) {
    logger.error('Admin grantSubscription error:', err)
    res.status(500).json({ success: false, message: 'Error otorgando suscripción' })
  }
}

// Quitar suscripción — vuelve a free
export async function revokeSubscription(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    await supabase.from('subscriptions').update({ status: 'cancelled', auto_renew: false, cancelled_at: new Date().toISOString() }).eq('user_id', id).eq('status', 'active')
    await supabase.from('users').update({ subscription_tier: 'free', subscription_expires_at: null, updated_at: new Date() }).eq('id', id)
    await supabase.from('audit_logs').insert({ user_id: id, action: 'admin_revoke_subscription', metadata: { admin_id: req.user?.id } })
    res.json({ success: true, message: 'Suscripción removida — usuario en plan Free' })
  } catch (err) {
    logger.error('Admin revokeSubscription error:', err)
    res.status(500).json({ success: false, message: 'Error removiendo suscripción' })
  }
}

// Verificar email manualmente (seguro, autenticado como admin)
export async function verifyUserEmail(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { error } = await supabase.from('users').update({ email_verified: true, email_verification_code: null, updated_at: new Date() }).eq('id', id)
    if (error) throw error
    await supabase.from('audit_logs').insert({ user_id: id, action: 'admin_verify_email', metadata: { admin_id: req.user?.id } })
    res.json({ success: true, message: 'Email verificado' })
  } catch (err) {
    logger.error('Admin verifyUserEmail error:', err)
    res.status(500).json({ success: false, message: 'Error verificando email' })
  }
}

// Resetear contraseña de cualquier usuario (bcrypt, compatible con login)
export async function resetUserPassword(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { password } = req.body as { password: string }
    if (!password || password.length < 6) {
      res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }
    const password_hash = await bcrypt.hash(password, 10)
    const { error } = await supabase.from('users').update({
      password_hash,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: new Date(),
    }).eq('id', id)
    if (error) throw error
    await supabase.from('audit_logs').insert({ user_id: id, action: 'admin_reset_password', metadata: { admin_id: req.user?.id } })
    res.json({ success: true, message: 'Contraseña restablecida' })
  } catch (err) {
    logger.error('Admin resetUserPassword error:', err)
    res.status(500).json({ success: false, message: 'Error restableciendo contraseña' })
  }
}

// Impersonar — genera un token válido para entrar como ese usuario (soporte)
export async function impersonateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { data: u, error } = await supabase.from('users').select('id,email,role,subscription_tier').eq('id', id).single()
    if (error || !u) { res.status(404).json({ success: false, message: 'Usuario no encontrado' }); return }

    const accessToken = signAccessToken({
      userId: (u as any).id,
      email: (u as any).email,
      role: (u as any).role,
      subscriptionTier: (u as any).subscription_tier,
    })
    const refreshToken = signRefreshToken({ userId: (u as any).id, tokenFamily: 'impersonation' })

    await supabase.from('audit_logs').insert({ user_id: id, action: 'admin_impersonate', metadata: { admin_id: req.user?.id, admin_email: req.user?.email } })
    res.json({ success: true, message: `Sesión como ${(u as any).email}`, data: { accessToken, refreshToken, email: (u as any).email } })
  } catch (err) {
    logger.error('Admin impersonateUser error:', err)
    res.status(500).json({ success: false, message: 'Error impersonando usuario' })
  }
}

// ── Content / Photos ──────────────────────────────────────────────────────────

export async function getMessages(req: Request, res: Response): Promise<void> {
  try {
    const { p, limit } = page(req)
    const { from, to } = range(p, limit)
    const { hasAttachment, search } = req.query as Record<string, string>

    let q = supabase
      .from('messages')
      .select(`
        id, sender_type, content, attachments, created_at,
        chat_sessions!inner(id, user_id, title, users(email, full_name, profile_picture))
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (hasAttachment === 'true') q = q.not('attachments', 'is', null)
    if (search) q = q.ilike('content', `%${search}%`)

    const { data, count, error } = await q
    if (error) throw error

    res.json({
      success: true,
      data,
      pagination: { page: p, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    })
  } catch (err) {
    logger.error('Admin getMessages error:', err)
    res.status(500).json({ success: false, message: 'Error obteniendo mensajes' })
  }
}

export async function deleteMessage(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (error) throw error

    await supabase.from('audit_logs').insert({
      action: 'admin_delete_message',
      metadata: { message_id: id, admin_id: req.user?.id },
    })

    res.json({ success: true, message: 'Mensaje eliminado' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error eliminando mensaje' })
  }
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const { p, limit } = page(req)
    const { from, to } = range(p, limit)
    const { action, userId, search } = req.query as Record<string, string>

    let q = supabase
      .from('audit_logs')
      .select('id,action,ip_address,user_agent,metadata,created_at,users(id,email,full_name,role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (action)  q = q.eq('action', action)
    if (userId)  q = q.eq('user_id', userId)
    if (search)  q = q.ilike('action', `%${search}%`)

    const { data, count, error } = await q
    if (error && error.code === '42P01') {
      // Table doesn't exist yet
      res.json({ success: true, data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } })
      return
    }
    if (error) throw error

    res.json({
      success: true,
      data,
      pagination: { page: p, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    })
  } catch (err) {
    logger.error('Admin getAuditLogs error:', err)
    res.status(500).json({ success: false, message: 'Error obteniendo logs' })
  }
}

export async function getActivityLogs(req: Request, res: Response): Promise<void> {
  try {
    const { p, limit } = page(req)
    const { from, to } = range(p, limit)

    const { data, count, error } = await supabase
      .from('activity_logs')
      .select('id,action,resource_type,details,ip_address,user_agent,created_at,users(id,email,full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    res.json({
      success: true,
      data,
      pagination: { page: p, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error obteniendo actividad' })
  }
}

// ── Subscriptions / Payments ──────────────────────────────────────────────────

export async function getSubscriptions(req: Request, res: Response): Promise<void> {
  try {
    const { p, limit } = page(req)
    const { from, to } = range(p, limit)
    const { status, tier, provider } = req.query as Record<string, string>

    let q = supabase
      .from('subscriptions')
      .select('id,tier,status,payment_provider,payment_id,start_date,end_date,auto_renew,created_at,users(id,email,full_name,subscription_tier)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (status)   q = q.eq('status', status)
    if (tier)     q = q.eq('tier', tier)
    if (provider) q = q.eq('payment_provider', provider)

    const { data, count, error } = await q
    if (error) throw error

    res.json({
      success: true,
      data,
      pagination: { page: p, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    })
  } catch (err) {
    logger.error('Admin getSubscriptions error:', err)
    res.status(500).json({ success: false, message: 'Error obteniendo suscripciones' })
  }
}

export async function getRevenue(_req: Request, res: Response): Promise<void> {
  try {
    const prices: Record<string, number> = { free: 0, basic: 199, premium: 499, corporate: 1499 }

    const [
      { data: activeSubs },
      { data: recentSubs },
      { data: cancelledSubs },
    ] = await Promise.all([
      supabase.from('subscriptions').select('tier,payment_provider').eq('status', 'active'),
      supabase.from('subscriptions').select('tier,created_at').gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString()),
      supabase.from('subscriptions').select('tier,cancelled_at').eq('status', 'cancelled').not('cancelled_at', 'is', null).gte('cancelled_at', new Date(Date.now() - 30 * 864e5).toISOString()),
    ])

    const mrr = (activeSubs ?? []).reduce((sum: number, s: any) => sum + (prices[s.tier] ?? 0), 0)
    const newRevenue30d = (recentSubs ?? []).reduce((sum: number, s: any) => sum + (prices[s.tier] ?? 0), 0)
    const byTier = (activeSubs ?? []).reduce((acc: Record<string, number>, s: any) => {
      acc[s.tier] = (acc[s.tier] ?? 0) + 1
      return acc
    }, {})
    const byProvider = (activeSubs ?? []).reduce((acc: Record<string, number>, s: any) => {
      acc[s.payment_provider] = (acc[s.payment_provider] ?? 0) + 1
      return acc
    }, {})

    res.json({
      success: true,
      data: {
        mrr,
        newRevenue30d,
        cancelled30d: cancelledSubs?.length ?? 0,
        byTier,
        byProvider,
        prices,
      },
    })
  } catch (err) {
    logger.error('Admin getRevenue error:', err)
    res.status(500).json({ success: false, message: 'Error calculando ingresos' })
  }
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function getDietPlans(req: Request, res: Response): Promise<void> {
  try {
    const { p, limit } = page(req)
    const { from, to } = range(p, limit)

    const { data, count, error } = await supabase
      .from('diet_plans')
      .select('id,name,total_calories,is_active,generated_by,validated_by,created_at,users(id,email,full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    res.json({
      success: true,
      data,
      pagination: { page: p, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error obteniendo planes' })
  }
}

export async function deleteDietPlan(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    await supabase.from('diet_plans').delete().eq('id', id)
    await supabase.from('audit_logs').insert({ action: 'admin_delete_diet_plan', metadata: { plan_id: id, admin_id: req.user?.id } })
    res.json({ success: true, message: 'Plan eliminado' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error eliminando plan' })
  }
}

// ── Social ────────────────────────────────────────────────────────────────────

export async function getUserSocialStats(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const [
      { count: followersCount },
      { count: followingCount },
      { data: posts, count: postsCount },
    ] = await Promise.all([
      supabase.from('social_follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
      supabase.from('social_follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
      supabase.from('social_posts')
        .select('id,type,caption,media_url,media_type,likes_count,comments_count,is_flagged,created_at', { count: 'exact' })
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(12),
    ])

    res.json({
      success: true,
      data: {
        followers:  followersCount  ?? 0,
        following:  followingCount  ?? 0,
        postsTotal: postsCount      ?? 0,
        recentPosts: posts          ?? [],
      },
    })
  } catch (err) {
    logger.error('Admin getUserSocialStats error:', err)
    res.status(500).json({ success: false, message: 'Error obteniendo estadísticas sociales' })
  }
}

export async function getSocialPosts(req: Request, res: Response): Promise<void> {
  try {
    const { p, limit } = page(req)
    const { from, to } = range(p, limit)
    const { type, flagged } = req.query as Record<string, string>

    let q = supabase
      .from('social_posts')
      .select(`
        id, type, caption, media_url, media_type,
        likes_count, comments_count, is_flagged, created_at,
        users(id, email, full_name, profile_picture)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (type)    q = q.eq('type', type)
    if (flagged === 'true') q = q.eq('is_flagged', true)

    const { data, count, error } = await q
    if (error && error.code === '42P01') {
      res.json({ success: true, data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } })
      return
    }
    if (error) throw error

    res.json({
      success: true,
      data,
      pagination: { page: p, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    })
  } catch (err) {
    logger.error('Admin getSocialPosts error:', err)
    res.status(500).json({ success: false, message: 'Error obteniendo posts' })
  }
}

export async function deleteSocialPost(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { error } = await supabase.from('social_posts').delete().eq('id', id)
    if (error) throw error

    await supabase.from('audit_logs').insert({
      action: 'admin_delete_post',
      metadata: { post_id: id, admin_id: req.user?.id },
    })

    res.json({ success: true, message: 'Post eliminado' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error eliminando post' })
  }
}

// ── Real-time SSE ─────────────────────────────────────────────────────────────

const sseClients = new Set<Response>()

export function streamEvents(req: Request, res: Response): void {
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  res.write('data: {"type":"connected"}\n\n')
  sseClients.add(res)

  const hb = setInterval(() => res.write(':heartbeat\n\n'), 25000)

  req.on('close', () => {
    clearInterval(hb)
    sseClients.delete(res)
  })
}

export function broadcastEvent(type: string, payload: unknown): void {
  const msg = `data: ${JSON.stringify({ type, payload, ts: Date.now() })}\n\n`
  sseClients.forEach(client => { try { client.write(msg) } catch { sseClients.delete(client) } })
}

// ── Trials ────────────────────────────────────────────────────────────────────

export async function getTrials(req: Request, res: Response): Promise<void> {
  try {
    const { p, limit } = page(req)
    const { from, to } = range(p, limit)

    const { data, count, error } = await supabase
      .from('subscriptions')
      .select('id,tier,status,start_date,end_date,created_at,users(id,email,full_name,username)', { count: 'exact' })
      .eq('payment_provider', 'none')
      .eq('tier', 'premium')
      .order('end_date', { ascending: true })
      .range(from, to)

    if (error) throw error

    res.json({
      success: true,
      data,
      pagination: { page: p, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    })
  } catch (err) {
    logger.error('Admin getTrials error:', err)
    res.status(500).json({ success: false, message: 'Error obteniendo trials' })
  }
}

export async function extendSubscription(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { days } = req.body as { days: number }

    const { data: sub } = await supabase.from('subscriptions').select('end_date,user_id').eq('id', id).single()
    if (!sub) { res.status(404).json({ success: false, message: 'Suscripción no encontrada' }); return }

    const newEnd = new Date((sub as any).end_date ?? new Date())
    newEnd.setDate(newEnd.getDate() + days)

    await supabase.from('subscriptions').update({ end_date: newEnd.toISOString(), status: 'active' }).eq('id', id)
    await supabase.from('users').update({ subscription_expires_at: newEnd.toISOString() }).eq('id', (sub as any).user_id)
    await supabase.from('audit_logs').insert({ action: 'admin_extend_subscription', metadata: { sub_id: id, days, new_end: newEnd, admin_id: req.user?.id } })

    res.json({ success: true, message: `Suscripción extendida ${days} días` })
  } catch (err) {
    logger.error('Admin extendSubscription error:', err)
    res.status(500).json({ success: false, message: 'Error extendiendo suscripción' })
  }
}

export async function cancelSubscriptionAdmin(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { data: sub } = await supabase.from('subscriptions').select('user_id').eq('id', id).single()
    if (!sub) { res.status(404).json({ success: false, message: 'Suscripción no encontrada' }); return }

    await supabase.from('subscriptions').update({ status: 'cancelled', auto_renew: false, cancelled_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('users').update({ subscription_tier: 'free' }).eq('id', (sub as any).user_id)
    await supabase.from('audit_logs').insert({ action: 'admin_cancel_subscription', metadata: { sub_id: id, admin_id: req.user?.id } })

    res.json({ success: true, message: 'Suscripción cancelada' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error cancelando suscripción' })
  }
}

// Reembolso real vía Stripe — refund del último pago + cancela la suscripción
export async function refundSubscription(req: Request, res: Response): Promise<void> {
  try {
    if (!stripe) { res.status(400).json({ success: false, message: 'Stripe no configurado' }); return }
    const { id } = req.params

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('user_id, stripe_subscription_id, payment_provider')
      .eq('id', id).single()
    if (!sub) { res.status(404).json({ success: false, message: 'Suscripción no encontrada' }); return }

    const stripeSubId = (sub as any).stripe_subscription_id
    if ((sub as any).payment_provider !== 'stripe' || !stripeSubId) {
      res.status(400).json({ success: false, message: 'Esta suscripción no tiene un pago de Stripe reembolsable (manual/trial)' })
      return
    }

    // Buscar la última factura pagada de la suscripción → su payment_intent
    const invoices = await stripe.invoices.list({ subscription: stripeSubId, limit: 1, status: 'paid' })
    const invoice = invoices.data[0]
    const paymentIntentId = (invoice as any)?.payment_intent as string | undefined
    if (!paymentIntentId) {
      res.status(400).json({ success: false, message: 'No se encontró un pago para reembolsar' })
      return
    }

    // Crear el reembolso
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId })

    // Cancelar la suscripción en Stripe (sin cobrar de nuevo)
    try { await stripe.subscriptions.cancel(stripeSubId) } catch { /* puede ya estar cancelada */ }

    // Actualizar DB
    await supabase.from('subscriptions').update({ status: 'cancelled', auto_renew: false, cancelled_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('users').update({ subscription_tier: 'free', subscription_expires_at: null }).eq('id', (sub as any).user_id)
    await supabase.from('audit_logs').insert({
      user_id: (sub as any).user_id,
      action: 'admin_refund_subscription',
      metadata: { sub_id: id, refund_id: refund.id, amount: refund.amount, currency: refund.currency, admin_id: req.user?.id },
    })

    res.json({ success: true, message: `Reembolso de $${(refund.amount / 100).toFixed(2)} ${refund.currency.toUpperCase()} procesado y suscripción cancelada` })
  } catch (err) {
    logger.error('Admin refundSubscription error:', err)
    res.status(500).json({ success: false, message: (err as any)?.message ?? 'Error procesando reembolso' })
  }
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getAnalytics(_req: Request, res: Response): Promise<void> {
  try {
    const days = 30
    const start = new Date(Date.now() - days * 864e5).toISOString()

    const [
      { data: userRows },
      { data: subRows },
    ] = await Promise.all([
      supabase.from('users').select('created_at').gte('created_at', start).order('created_at'),
      supabase.from('subscriptions').select('created_at,tier,payment_provider').gte('created_at', start).order('created_at'),
    ])

    // Build day-by-day buckets
    const registrationsPerDay: Record<string, number> = {}
    const subsPerDay: Record<string, number> = {}
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - (days - 1 - i) * 864e5).toISOString().slice(0, 10)
      registrationsPerDay[d] = 0
      subsPerDay[d] = 0
    }

    for (const u of userRows ?? []) {
      const d = (u as any).created_at.slice(0, 10)
      if (registrationsPerDay[d] !== undefined) registrationsPerDay[d]++
    }

    for (const s of subRows ?? []) {
      const d = (s as any).created_at.slice(0, 10)
      if (subsPerDay[d] !== undefined) subsPerDay[d]++
    }

    res.json({
      success: true,
      data: {
        registrationsPerDay,
        subsPerDay,
        totalUsers: userRows?.length ?? 0,
        totalSubs: subRows?.length ?? 0,
      },
    })
  } catch (err) {
    logger.error('Admin getAnalytics error:', err)
    res.status(500).json({ success: false, message: 'Error obteniendo analíticas' })
  }
}

// ── Cohortes de retención (semanales) ──────────────────────────────────────────

export async function getCohorts(_req: Request, res: Response): Promise<void> {
  try {
    const weeks = 8
    const now = Date.now()
    const msWeek = 7 * 864e5

    const { data: users } = await supabase
      .from('users')
      .select('created_at,last_login')
      .gte('created_at', new Date(now - weeks * msWeek).toISOString())

    // Cada cohorte = semana de registro. Retención = % con last_login posterior a N semanas
    const cohorts: { week: string; size: number; retention: number[] }[] = []
    for (let w = 0; w < weeks; w++) {
      const start = now - (weeks - w) * msWeek
      const end = start + msWeek
      const members = (users ?? []).filter((u: any) => {
        const c = new Date(u.created_at).getTime()
        return c >= start && c < end
      })
      const size = members.length
      const weeksSince = Math.floor((now - start) / msWeek)
      const retention: number[] = []
      for (let r = 0; r <= weeksSince; r++) {
        const cutoff = start + r * msWeek
        const active = members.filter((u: any) => u.last_login && new Date(u.last_login).getTime() >= cutoff).length
        retention.push(size ? Math.round((active / size) * 100) : 0)
      }
      cohorts.push({
        week: new Date(start).toISOString().slice(0, 10),
        size,
        retention,
      })
    }

    res.json({ success: true, data: { cohorts, weeks } })
  } catch (err) {
    logger.error('Admin getCohorts error:', err)
    res.status(500).json({ success: false, message: 'Error calculando cohortes' })
  }
}

// ── Notas internas (almacenadas en audit_logs) ─────────────────────────────────

export async function addUserNote(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { note } = req.body as { note: string }
    if (!note?.trim()) { res.status(400).json({ success: false, message: 'Nota vacía' }); return }
    await supabase.from('audit_logs').insert({
      user_id: id,
      action: 'admin_note',
      metadata: { note: note.trim(), admin_id: req.user?.id, admin_email: req.user?.email },
    })
    res.json({ success: true, message: 'Nota guardada' })
  } catch (err) {
    logger.error('Admin addUserNote error:', err)
    res.status(500).json({ success: false, message: 'Error guardando nota' })
  }
}

export async function getUserNotes(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { data } = await supabase
      .from('audit_logs')
      .select('id,metadata,created_at')
      .eq('user_id', id).eq('action', 'admin_note')
      .order('created_at', { ascending: false }).limit(50)
    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error obteniendo notas' })
  }
}

// ── Feature flags / modo mantenimiento ─────────────────────────────────────────

// Feature flags almacenados en audit_logs (action='feature_flag_set') — último valor por clave gana.
// No requiere tabla nueva.
export async function getFeatureFlags(_req: Request, res: Response): Promise<void> {
  try {
    const { data } = await supabase
      .from('audit_logs')
      .select('metadata,created_at')
      .eq('action', 'feature_flag_set')
      .order('created_at', { ascending: false })
      .limit(500)

    const seen = new Set<string>()
    const flags: { key: string; enabled: boolean; description?: string; updated_at: string }[] = []
    for (const row of data ?? []) {
      const m = (row as any).metadata ?? {}
      if (!m.key || seen.has(m.key)) continue
      seen.add(m.key)
      flags.push({ key: m.key, enabled: !!m.enabled, description: m.description, updated_at: (row as any).created_at })
    }
    res.json({ success: true, data: flags, tableExists: true })
  } catch (err) {
    logger.error('Admin getFeatureFlags error:', err)
    res.status(500).json({ success: false, message: 'Error obteniendo flags' })
  }
}

export async function updateFeatureFlag(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.params
    const { enabled, description } = req.body as { enabled: boolean; description?: string }
    const { error } = await supabase.from('audit_logs').insert({
      action: 'feature_flag_set',
      metadata: { key, enabled: !!enabled, description, admin_id: req.user?.id },
    })
    if (error) throw error
    res.json({ success: true, message: `Flag "${key}" ${enabled ? 'activado' : 'desactivado'}` })
  } catch (err) {
    logger.error('Admin updateFeatureFlag error:', err)
    res.status(500).json({ success: false, message: 'Error actualizando flag' })
  }
}

// Endpoint público — la app móvil/web lee los flags activos (ej. modo mantenimiento)
export async function getPublicFlags(_req: Request, res: Response): Promise<void> {
  try {
    const { data } = await supabase
      .from('audit_logs')
      .select('metadata,created_at')
      .eq('action', 'feature_flag_set')
      .order('created_at', { ascending: false })
      .limit(500)

    const seen = new Set<string>()
    const flags: Record<string, boolean> = {}
    for (const row of data ?? []) {
      const m = (row as any).metadata ?? {}
      if (!m.key || seen.has(m.key)) continue
      seen.add(m.key)
      flags[m.key] = !!m.enabled
    }
    res.json({ success: true, data: flags })
  } catch {
    res.json({ success: true, data: {} })
  }
}

// ── Notifications ──────────────────────────────────────────────────────────────

export async function sendNotificationToUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { subject, message } = req.body as { subject: string; message: string }

    const { data: user } = await supabase.from('users').select('email,full_name,fcm_token').eq('id', id).single()
    if (!user) { res.status(404).json({ success: false, message: 'Usuario no encontrado' }); return }

    // 1) Notificación in-app (siempre — no depende de Resend)
    await supabase.from('notifications').insert({
      user_id: id, type: 'system', title: subject, body: message, is_read: false, sent_at: new Date().toISOString(),
    })

    // 2) Push nativo (si el usuario tiene token FCM y Firebase está configurado)
    let pushSent = false
    const fcmToken = (user as any).fcm_token
    if (fcmToken) {
      const push = await sendPushToTokens([fcmToken], subject, message)
      pushSent = push.sent > 0
      if (push.invalidTokens.length) await supabase.from('users').update({ fcm_token: null }).eq('id', id)
    }

    // 3) Email (si Resend está configurado)
    let emailSent = false
    if (resend) {
      const name = (user as any).full_name || 'Usuario'
      const html = `
        <div style="background:#0a0a0a;padding:32px;font-family:sans-serif;color:#e2e8f0;max-width:600px;margin:0 auto;border-radius:12px">
          <div style="font-size:22px;font-weight:800;color:#a78bfa;margin-bottom:16px">ZENCRUS</div>
          <h2 style="font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:12px">${subject}</h2>
          <p style="font-size:15px;line-height:1.7;color:#94a3b8">Hola ${name},</p>
          <div style="font-size:15px;line-height:1.7;color:#cbd5e1;margin:16px 0;white-space:pre-line">${message}</div>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:24px 0"/>
          <p style="font-size:12px;color:#475569">El equipo de ZENCRUS — noreply@zencrus.com</p>
        </div>`
      try { await resend.emails.send({ from: FROM_EMAIL, to: (user as any).email, subject, html }); emailSent = true } catch { /* in-app ya enviada */ }
    }

    await supabase.from('audit_logs').insert({ action: 'admin_send_notification', user_id: id, metadata: { subject, emailSent, pushSent, admin_id: req.user?.id } })
    const parts = ['in-app', pushSent && 'push', emailSent && 'email'].filter(Boolean)
    res.json({ success: true, message: `Enviado por: ${parts.join(' + ')} a ${(user as any).email}` })
  } catch (err) {
    logger.error('Admin sendNotification error:', err)
    res.status(500).json({ success: false, message: 'Error enviando notificación' })
  }
}

export async function sendNotificationToAll(req: Request, res: Response): Promise<void> {
  try {
    const { subject, message, tierFilter } = req.body as { subject: string; message: string; tierFilter?: string }

    let q = supabase.from('users').select('id,email,full_name,fcm_token').eq('is_active', true)
    if (tierFilter) q = q.eq('subscription_tier', tierFilter)

    const { data: users } = await q
    const list = users ?? []

    // 1) Notificaciones in-app en lote (siempre)
    if (list.length) {
      await supabase.from('notifications').insert(
        list.map((u: any) => ({ user_id: u.id, type: 'system', title: subject, body: message, is_read: false, sent_at: new Date().toISOString() }))
      )
    }

    // 2) Push nativo en lote (Firebase multicast, máx 500 tokens por llamada)
    const tokens = list.map((u: any) => u.fcm_token).filter(Boolean)
    let pushSent = 0
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500)
      const push = await sendPushToTokens(batch, subject, message)
      pushSent += push.sent
      if (push.invalidTokens.length) await supabase.from('users').update({ fcm_token: null }).in('fcm_token', push.invalidTokens)
    }

    // 3) Emails (si Resend configurado)
    let emailsSent = 0
    if (resend) {
      for (const user of list) {
        try {
          const name = (user as any).full_name || 'Usuario'
          const html = `
            <div style="background:#0a0a0a;padding:32px;font-family:sans-serif;color:#e2e8f0;max-width:600px;margin:0 auto;border-radius:12px">
              <div style="font-size:22px;font-weight:800;color:#a78bfa;margin-bottom:16px">ZENCRUS</div>
              <h2 style="font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:12px">${subject}</h2>
              <p style="font-size:15px;line-height:1.7;color:#94a3b8">Hola ${name},</p>
              <div style="font-size:15px;line-height:1.7;color:#cbd5e1;margin:16px 0;white-space:pre-line">${message}</div>
              <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:24px 0"/>
              <p style="font-size:12px;color:#475569">El equipo de ZENCRUS</p>
            </div>`
          await resend.emails.send({ from: FROM_EMAIL, to: (user as any).email, subject, html })
          emailsSent++
        } catch { /* continue */ }
      }
    }

    await supabase.from('audit_logs').insert({ action: 'admin_send_mass_notification', metadata: { subject, inApp: list.length, pushSent, emailsSent, admin_id: req.user?.id } })
    res.json({ success: true, message: `In-app: ${list.length} · Push: ${pushSent} · Emails: ${emailsSent}` })
  } catch (err) {
    logger.error('Admin sendNotificationToAll error:', err)
    res.status(500).json({ success: false, message: 'Error enviando notificación masiva' })
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportUsers(req: Request, res: Response): Promise<void> {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id,email,full_name,username,role,subscription_tier,is_active,email_verified,created_at,last_login')
      .order('created_at', { ascending: false })
      .limit(5000)

    const header = ['ID','Email','Nombre','Username','Rol','Plan','Activo','Verificado','Registro','Último acceso']
    const rows = (users ?? []).map((u: any) => [
      u.id, u.email, u.full_name, u.username ?? '', u.role, u.subscription_tier,
      u.is_active ? 'Sí' : 'No', u.email_verified ? 'Sí' : 'No',
      u.created_at ? new Date(u.created_at).toLocaleDateString('es-MX') : '',
      u.last_login  ? new Date(u.last_login).toLocaleDateString('es-MX') : '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`))

    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="zencrus-usuarios-${new Date().toISOString().slice(0,10)}.csv"`)
    res.send('﻿' + csv) // BOM for Excel
  } catch (err) {
    logger.error('Admin exportUsers error:', err)
    res.status(500).json({ success: false, message: 'Error exportando usuarios' })
  }
}

// Poll every 10s for new entries and broadcast to connected admin clients
let lastPollTs = new Date().toISOString()
setInterval(async () => {
  try {
    const since = lastPollTs
    lastPollTs = new Date().toISOString()
    if (sseClients.size === 0) return

    const [{ data: newUsers }, { data: newLogs }, { data: newSubs }] = await Promise.all([
      supabase.from('users').select('id,email,full_name,subscription_tier,created_at').gte('created_at', since),
      supabase.from('audit_logs').select('action,created_at,users(email,full_name)').gte('created_at', since).order('created_at', { ascending: false }).limit(10),
      supabase.from('subscriptions').select('tier,status,created_at,users(email,full_name)').gte('created_at', since),
    ])

    if (newUsers?.length)  broadcastEvent('new_users',        newUsers)
    if (newLogs?.length)   broadcastEvent('new_audit_logs',   newLogs)
    if (newSubs?.length)   broadcastEvent('new_subscriptions', newSubs)
  } catch { /* silent */ }
}, 10000)
