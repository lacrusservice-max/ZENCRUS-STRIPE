import { Request, Response } from 'express'
import { z } from 'zod'
import Stripe from 'stripe'
import { ApiResponse, SubscriptionTier } from '../models/types'
import { logger } from '../config/logger'
import { env } from '../config/env'
import { supabase } from '../config/supabase'

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

  res.status(200).json({
    success: true,
    data: subscription || { tier: 'free', status: 'active', payment_provider: 'none' },
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

      // Crear suscripción con pago pendiente para obtener el PaymentIntent
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: { userId, tier, extraMembers: String(extraMembers) },
      })

      const invoice = subscription.latest_invoice as Stripe.Invoice & { payment_intent: Stripe.PaymentIntent }
      const paymentIntent = invoice.payment_intent

      logger.info(`PaymentSheet Stripe creado: ${userId} → ${tier}`)
      res.status(200).json({
        success: true,
        data: {
          provider: 'stripe',
          paymentIntent: paymentIntent.client_secret,
          ephemeralKey: ephemeralKey.secret,
          customerId,
          subscriptionId: subscription.id,
          tier,
          price: plan.price,
          currency: 'MXN',
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

  switch (event.type) {
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      if (subscription.status !== 'active') break

      const userId = subscription.metadata?.userId
      const tier = subscription.metadata?.tier as SubscriptionTier | undefined
      const extraMembers = Number(subscription.metadata?.extraMembers ?? 0)

      if (!userId || !tier) {
        logger.error('customer.subscription.updated sin metadata.userId/tier', subscription.id)
        break
      }

      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
      const plan = SUBSCRIPTION_PLANS[tier as Exclude<SubscriptionTier, 'free'>]

      const now = new Date()
      const endDate = new Date(now)
      if (plan?.recurring === 'year') endDate.setFullYear(endDate.getFullYear() + 1)
      else endDate.setMonth(endDate.getMonth() + 1)

      // Upsert: actualizar si ya existe, insertar si no
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle()

      if (existing) {
        await supabase.from('subscriptions')
          .update({ status: 'active', stripe_customer_id: customerId, end_date: endDate.toISOString() })
          .eq('stripe_subscription_id', subscription.id)
      } else {
        await supabase.from('subscriptions').insert({
          user_id: userId,
          tier,
          status: 'active',
          payment_provider: 'stripe',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          stripe_price_id: plan?.priceId,
          extra_members: extraMembers,
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          auto_renew: true,
        })
      }

      await supabase.from('users').update({ subscription_tier: tier }).eq('id', userId)
      logger.info(`Suscripción activada/actualizada vía Stripe: ${userId} → ${tier}`)
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
        await supabase.from('subscriptions').update({ status: 'expired' }).eq('stripe_subscription_id', subscriptionId)
      }
      logger.info(`Pago de Stripe fallido para suscripción: ${subscriptionId}`)
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
        features: ['Planes de dieta ilimitados', 'Rutinas ilimitadas', 'Chat IA ilimitado', 'Validación por Eunice (nutrióloga)', 'Reportes de progreso avanzados'],
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
