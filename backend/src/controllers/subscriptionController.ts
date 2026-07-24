import { Request, Response } from 'express'
import { z } from 'zod'
import Stripe from 'stripe'
import { ApiResponse, SubscriptionTier } from '../models/types'
import { logger } from '../config/logger'
import { env } from '../config/env'
import { supabase } from '../config/supabase'
import { sendWelcomeEmail, sendInvoiceEmail } from '../services/emailService'

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null

export const createCheckoutSchema = z.object({
  body: z.object({
    tier: z.enum(['monthly', 'annual_individual', 'annual_duo', 'annual_familiar']),
    provider: z.enum(['stripe', 'mercadopago']),
    extraMembers: z.number().int().min(0).max(2).optional().default(0),
  }),
})

interface PlanInfo {
  label: string
  price: number
  priceId: string | undefined
  recurring: 'month' | 'year'
}

const SUBSCRIPTION_PLANS: Record<Exclude<SubscriptionTier, 'free'>, PlanInfo> = {
  monthly: { label: 'ZENCRUS Mensual', price: 200, priceId: env.STRIPE_PRICE_MONTHLY, recurring: 'month' },
  annual_individual: { label: 'ZENCRUS Anual Individual', price: 1999, priceId: env.STRIPE_PRICE_ANNUAL_INDIVIDUAL, recurring: 'year' },
  annual_duo: { label: 'ZENCRUS Anual Dúo', price: 3399, priceId: env.STRIPE_PRICE_ANNUAL_DUO, recurring: 'year' },
  annual_familiar: { label: 'ZENCRUS Anual Familiar', price: 5799, priceId: env.STRIPE_PRICE_ANNUAL_FAMILIAR, recurring: 'year' },
}

const EXTRA_MEMBER_PRICE_ID = env.STRIPE_PRICE_EXTRA_MEMBER

// El ENUM de Postgres (subscription_tier) solo acepta free/basic/premium/corporate —
// no conoce los planes reales de ZENCRUS (monthly/annual_*). El plan exacto se
// determina siempre desde Stripe (metadata.tier vía stripe_subscription_id);
// aquí solo se mapea al bucket más cercano para que el ENUM lo acepte.
const DB_TIER_BUCKET: Record<Exclude<SubscriptionTier, 'free'>, 'basic' | 'premium' | 'corporate'> = {
  monthly: 'basic',
  annual_individual: 'premium',
  annual_duo: 'premium',
  annual_familiar: 'corporate',
}

export async function getCurrentSubscription(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!subscription) {
    res.status(200).json({
      success: true,
      data: { tier: 'free', status: 'active', payment_provider: 'none' },
    } satisfies ApiResponse)
    return
  }

  // La columna `tier` solo guarda el bucket del ENUM (basic/premium/corporate) —
  // el plan real de ZENCRUS vive en el metadata de la suscripción de Stripe.
  let realTier: string = subscription.tier
  if (stripe && subscription.stripe_subscription_id) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
      if (stripeSub.metadata?.tier) realTier = stripeSub.metadata.tier
    } catch (err) {
      logger.error(`No se pudo obtener el tier real desde Stripe (${subscription.stripe_subscription_id}):`, err)
    }
  }

  res.status(200).json({
    success: true,
    data: { ...subscription, tier: realTier },
  } satisfies ApiResponse)
}

export async function startTrial(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  // Verificar si ya usó el trial — identificado por payment_provider='none' y start_date existente
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id, tier, end_date')
    .eq('user_id', userId)
    .eq('payment_provider', 'none')
    .eq('tier', 'premium')
    .maybeSingle()

  if (existing) {
    res.status(400).json({
      success: false,
      message: 'Ya usaste tu período de prueba gratuito. Elige un plan para continuar.',
    } satisfies ApiResponse)
    return
  }

  const now = new Date()
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 5)

  const { error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      tier: 'premium',
      status: 'active',
      payment_provider: 'none',
      start_date: now.toISOString(),
      end_date: trialEndsAt.toISOString(),
      auto_renew: false,
    })

  if (error) {
    logger.error('Error creando trial:', error.message)
    res.status(500).json({ success: false, message: 'No se pudo iniciar el período de prueba' } satisfies ApiResponse)
    return
  }

  // Actualizar subscription_tier y fecha de expiración del usuario
  await supabase
    .from('users')
    .update({
      subscription_tier: 'premium',
      subscription_expires_at: trialEndsAt.toISOString(),
    })
    .eq('id', userId)

  logger.info(`Trial iniciado para usuario ${userId} — vence ${trialEndsAt.toISOString().slice(0, 10)}`)

  res.status(200).json({
    success: true,
    message: '¡Prueba gratuita activada! Tienes 5 días de acceso Premium completo.',
    data: { trialEndsAt: trialEndsAt.toISOString(), tier: 'premium', status: 'active' },
  } satisfies ApiResponse)
}

export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const userEmail = req.user!.email
  const { tier, provider, extraMembers } = req.body as {
    tier: Exclude<SubscriptionTier, 'free'>
    provider: 'stripe' | 'mercadopago'
    extraMembers: number
  }

  const plan = SUBSCRIPTION_PLANS[tier]
  if (!plan) {
    res.status(400).json({ success: false, message: 'Plan no válido' } satisfies ApiResponse)
    return
  }

  if (extraMembers > 0 && tier !== 'annual_familiar') {
    res.status(400).json({ success: false, message: 'Los integrantes extra solo aplican al plan Anual Familiar' } satisfies ApiResponse)
    return
  }

  if (provider === 'stripe') {
    if (!stripe || !plan.priceId) {
      logger.error(`Stripe no configurado o falta priceId para el plan ${tier}`)
      res.status(503).json({ success: false, message: 'Pagos con Stripe no disponibles temporalmente' } satisfies ApiResponse)
      return
    }

    try {
      // Obtener o crear Customer de Stripe para este usuario
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .maybeSingle()

      let customerId = sub?.stripe_customer_id as string | undefined

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { userId },
        })
        customerId = customer.id
      }

      // Ephemeral key para el Payment Sheet nativo
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2024-06-20' }
      )

      // Construir items de suscripción
      const items: Stripe.SubscriptionCreateParams.Item[] = [{ price: plan.priceId }]
      if (extraMembers > 0 && EXTRA_MEMBER_PRICE_ID) {
        items.push({ price: EXTRA_MEMBER_PRICE_ID, quantity: extraMembers })
      }

      // Suscripción con 5 días de prueba gratis — como no hay cobro inmediato (invoice $0),
      // Stripe genera un SetupIntent (no PaymentIntent) para capturar la tarjeta.
      // Al terminar el trial, Stripe cobra automáticamente con esa tarjeta guardada.
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items,
        trial_period_days: 5,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['pending_setup_intent', 'latest_invoice.payment_intent'],
        metadata: { userId, tier, extraMembers: String(extraMembers) },
      })

      const setupIntent = subscription.pending_setup_intent as Stripe.SetupIntent | null
      const invoice = subscription.latest_invoice as (Stripe.Invoice & { payment_intent: Stripe.PaymentIntent | null }) | null
      const clientSecret = setupIntent?.client_secret ?? invoice?.payment_intent?.client_secret

      if (!clientSecret) {
        logger.error(`Stripe no devolvió setupIntent ni paymentIntent para ${userId} → ${tier}`)
        res.status(502).json({ success: false, message: 'No se pudo iniciar el pago' } satisfies ApiResponse)
        return
      }

      logger.info(`PaymentSheet Stripe creado (trial 5 días): ${userId} → ${tier}`)
      res.status(200).json({
        success: true,
        data: {
          provider: 'stripe',
          mode: setupIntent ? 'setup' : 'payment',
          clientSecret,
          ephemeralKey: ephemeralKey.secret,
          customerId,
          subscriptionId: subscription.id,
          tier,
          price: plan.price,
          currency: 'MXN',
          trialDays: 5,
        },
      } satisfies ApiResponse)
    } catch (error) {
      logger.error('Error creando PaymentSheet de Stripe', error)
      res.status(502).json({ success: false, message: 'No se pudo iniciar el pago' } satisfies ApiResponse)
    }
    return
  }

  if (provider === 'mercadopago') {
    const mockCheckoutUrl = `${env.FRONTEND_URL}/checkout/mercadopago?plan=${tier}&price=${plan.price}`
    logger.info(`Checkout iniciado (MercadoPago placeholder): ${userId} → ${tier}`)
    res.status(200).json({
      success: true,
      data: { provider: 'mercadopago', checkoutUrl: mockCheckoutUrl, tier, price: plan.price, currency: 'MXN' },
    } satisfies ApiResponse)
    return
  }

  res.status(400).json({ success: false, message: 'Proveedor de pago no válido' } satisfies ApiResponse)
}

// ── Web checkout (Stripe Checkout Session con redirección) ──────────────────────
export async function createWebCheckout(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const userEmail = req.user!.email
  const { tier, extraMembers = 0 } = req.body as { tier: Exclude<SubscriptionTier, 'free'>; extraMembers?: number }

  const plan = SUBSCRIPTION_PLANS[tier]
  if (!plan) { res.status(400).json({ success: false, message: 'Plan no válido' } satisfies ApiResponse); return }
  if (extraMembers > 0 && tier !== 'annual_familiar') {
    res.status(400).json({ success: false, message: 'Los integrantes extra solo aplican al plan Anual Familiar' } satisfies ApiResponse); return
  }
  if (!stripe || !plan.priceId) {
    res.status(503).json({ success: false, message: 'Pagos con Stripe no disponibles temporalmente' } satisfies ApiResponse); return
  }

  try {
    // Reutilizar Customer existente
    const { data: sub } = await supabase
      .from('subscriptions').select('stripe_customer_id').eq('user_id', userId)
      .not('stripe_customer_id', 'is', null).limit(1).maybeSingle()
    let customerId = sub?.stripe_customer_id as string | undefined
    if (!customerId) {
      const customer = await stripe.customers.create({ email: userEmail, metadata: { userId } })
      customerId = customer.id
    }

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: plan.priceId, quantity: 1 }]
    if (extraMembers > 0 && EXTRA_MEMBER_PRICE_ID) {
      line_items.push({ price: EXTRA_MEMBER_PRICE_ID, quantity: extraMembers })
    }

    const base = env.FRONTEND_URL || 'https://zencrus.com'
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items,
      success_url: `${base}/checkout/success?tier=${tier}`,
      cancel_url: `${base}/subscription?canceled=1`,
      locale: 'es',
      // Tarjeta obligatoria desde el inicio + 5 días de prueba gratis, cobro automático al terminar
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: 5,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
        metadata: { userId, tier, extraMembers: String(extraMembers) },
      },
      metadata: { userId, tier, extraMembers: String(extraMembers) },
      allow_promotion_codes: true,
    })

    logger.info(`Checkout web Stripe: ${userId} → ${tier}`)
    res.status(200).json({ success: true, data: { url: session.url, tier } } satisfies ApiResponse)
  } catch (err) {
    logger.error('createWebCheckout error:', err)
    res.status(502).json({ success: false, message: 'No se pudo iniciar el pago' } satisfies ApiResponse)
  }
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    logger.error('Webhook de Stripe recibido pero STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET no están configurados')
    res.status(503).json({ received: false })
    return
  }

  const signature = req.headers['stripe-signature']
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, signature as string, env.STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    logger.error('Firma de webhook de Stripe inválida', error)
    res.status(400).json({ received: false })
    return
  }

  // Trialing y active dan acceso Premium completo — el trial de 5 días requiere tarjeta,
  // y Stripe cobra automáticamente al terminar (o cancela si el método de pago falla).
  const upsertSubscription = async (subscription: Stripe.Subscription) => {
    if (subscription.status !== 'active' && subscription.status !== 'trialing') return

    const userId = subscription.metadata?.userId
    const tier = subscription.metadata?.tier as SubscriptionTier | undefined

    if (!userId || !tier) {
      logger.error(`Stripe subscription sin metadata.userId/tier: ${subscription.id}`)
      return
    }

    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    const plan = SUBSCRIPTION_PLANS[tier as Exclude<SubscriptionTier, 'free'>]

    const now = new Date()
    // end_date real: fin de la prueba si está en trial, o fin del periodo pagado
    const periodEndTs = subscription.trial_end ?? (subscription as unknown as { current_period_end?: number }).current_period_end
    const endDate = periodEndTs ? new Date(periodEndTs * 1000) : (() => {
      const d = new Date(now)
      if (plan?.recurring === 'year') d.setFullYear(d.getFullYear() + 1)
      else d.setMonth(d.getMonth() + 1)
      return d
    })()

    // DB enum de status no incluye 'trialing' — trial y active se guardan como 'active'
    // (el usuario tiene acceso Premium real durante la prueba; end_date marca cuándo se cobra o expira)
    const dbStatus = 'active'
    const dbTier = DB_TIER_BUCKET[tier as Exclude<SubscriptionTier, 'free'>]

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle()

    if (existing) {
      const { error: updateErr } = await supabase.from('subscriptions')
        .update({ status: dbStatus, stripe_customer_id: customerId, end_date: endDate.toISOString() })
        .eq('stripe_subscription_id', subscription.id)
      if (updateErr) logger.error(`Error actualizando subscriptions (${subscription.id}):`, updateErr)
    } else {
      const { error: insertErr } = await supabase.from('subscriptions').insert({
        user_id: userId,
        tier: dbTier,
        status: dbStatus,
        payment_provider: 'stripe',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        auto_renew: true,
      })
      if (insertErr) logger.error(`Error insertando subscriptions (${subscription.id}):`, insertErr)

      // Primera vez que se crea esta suscripción → correo de bienvenida/activación
      // (nunca al registrarse ni al verificar el correo — solo al contratar un plan)
      const { data: u } = await supabase.from('users').select('email,full_name').eq('id', userId).maybeSingle()
      if (u?.email) {
        const trialEndFmt = endDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
        sendWelcomeEmail(u.email, u.full_name || 'Atleta', plan?.label ?? tier, trialEndFmt).catch((err) => logger.error('sendWelcomeEmail error:', err))
      }
    }

    await supabase.from('users').update({ subscription_tier: dbTier, subscription_expires_at: endDate.toISOString() }).eq('id', userId)
    logger.info(`Suscripción Stripe ${subscription.status}: ${userId} → ${tier}`)
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await upsertSubscription(event.data.object as Stripe.Subscription)
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.userId

      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', auto_renew: false, cancelled_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscription.id)

      if (userId) {
        await supabase.from('users').update({ subscription_tier: 'free' }).eq('id', userId)
      }

      logger.info(`Suscripción Stripe cancelada: ${subscription.id}`)
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = invoice.parent?.subscription_details?.subscription
        ? typeof invoice.parent.subscription_details.subscription === 'string'
          ? invoice.parent.subscription_details.subscription
          : invoice.parent.subscription_details.subscription.id
        : undefined
      if (subscriptionId) {
        const { data: sub } = await supabase.from('subscriptions').select('user_id').eq('stripe_subscription_id', subscriptionId).maybeSingle()
        await supabase.from('subscriptions').update({ status: 'expired' }).eq('stripe_subscription_id', subscriptionId)
        if (sub?.user_id) await supabase.from('users').update({ subscription_tier: 'free' }).eq('id', sub.user_id)
      }
      logger.info(`Pago de Stripe fallido para suscripción: ${subscriptionId}`)
      break
    }
    case 'invoice.paid': {
      // Se dispara con cada cobro real: fin del trial de 5 días o cada renovación.
      // Aquí (y solo aquí) se manda el correo de factura/recibo.
      const invoice = event.data.object as Stripe.Invoice
      const amountPaid = (invoice.amount_paid ?? 0) / 100
      if (amountPaid <= 0) break // facturas de $0 (ej. la del propio trial) no generan recibo

      const subscriptionId = invoice.parent?.subscription_details?.subscription
        ? typeof invoice.parent.subscription_details.subscription === 'string'
          ? invoice.parent.subscription_details.subscription
          : invoice.parent.subscription_details.subscription.id
        : undefined
      if (!subscriptionId) break

      const { data: sub } = await supabase.from('subscriptions').select('user_id,tier').eq('stripe_subscription_id', subscriptionId).maybeSingle()
      if (!sub?.user_id) break

      const { data: u } = await supabase.from('users').select('email,full_name').eq('id', sub.user_id).maybeSingle()
      if (!u?.email) break

      const plan = SUBSCRIPTION_PLANS[sub.tier as Exclude<SubscriptionTier, 'free'>]
      const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined

      sendInvoiceEmail(u.email, u.full_name || 'Atleta', {
        planLabel: plan?.label ?? sub.tier,
        amount: amountPaid,
        currency: invoice.currency ?? 'mxn',
        invoiceUrl: invoice.hosted_invoice_url ?? undefined,
        periodEnd,
      }).catch((err) => logger.error('sendInvoiceEmail error:', err))

      logger.info(`Factura pagada — recibo enviado: ${u.email} · $${amountPaid} ${invoice.currency}`)
      break
    }
    default:
      logger.info(`Evento Stripe no manejado: ${event.type}`)
  }

  res.status(200).json({ received: true })
}

export async function handleMercadoPagoWebhook(req: Request, res: Response): Promise<void> {
  logger.info('Webhook MercadoPago recibido (placeholder)')
  res.status(200).json({ received: true })
}

export async function cancelSubscription(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      auto_renew: false,
      cancelled_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('status', 'active')
    .select()
    .maybeSingle()

  if (error || !sub) {
    res.status(404).json({ success: false, message: 'No tienes una suscripción activa' } satisfies ApiResponse)
    return
  }

  if (stripe && sub.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id)
    } catch (error) {
      logger.error('Error cancelando suscripción en Stripe', error)
    }
  }

  await supabase
    .from('users')
    .update({ subscription_tier: 'free' })
    .eq('id', userId)

  logger.info(`Suscripción cancelada: ${userId}`)

  res.status(200).json({
    success: true,
    message: 'Suscripción cancelada. Tendrás acceso hasta el fin del período actual.',
    data: sub,
  } satisfies ApiResponse)
}

export async function getPlans(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    success: true,
    data: [
      {
        id: 'free',
        name: 'Gratuito',
        price: 0,
        currency: 'MXN',
        features: ['1 plan de dieta por mes', '1 rutina de entrenamiento', 'Chat IA (5 mensajes/día)', 'Recordatorios básicos'],
        limitations: ['Sin validación por nutrióloga', 'Sin reportes avanzados'],
      },
      {
        id: 'monthly',
        name: 'Mensual',
        price: 200,
        period: 'mes',
        currency: 'MXN',
        features: ['Planes de dieta ilimitados', 'Rutinas ilimitadas', 'Chat IA ilimitado', 'Validación por ZENCRUS (nutrióloga)', 'Reportes de progreso avanzados'],
      },
      {
        id: 'annual_individual',
        name: 'Anual Individual',
        price: 1999,
        period: 'año',
        currency: 'MXN',
        popular: true,
        features: ['Todo lo del plan Mensual', '1 integrante', 'Ahorra vs. pago mensual'],
      },
      {
        id: 'annual_duo',
        name: 'Anual Dúo',
        price: 3399,
        period: 'año',
        currency: 'MXN',
        features: ['Todo lo del plan Anual Individual', '2 integrantes'],
      },
      {
        id: 'annual_familiar',
        name: 'Anual Familiar',
        price: 5799,
        period: 'año',
        currency: 'MXN',
        features: ['Todo lo del plan Anual Individual', '4 integrantes incluidos', 'Integrante extra: $850 MXN/año c/u (máx. 6 integrantes totales)'],
      },
    ],
  } satisfies ApiResponse)
}
