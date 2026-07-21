import { Router, raw } from 'express'
import {
  getCurrentSubscription, createCheckoutSession, cancelSubscription,
  handleStripeWebhook, handleMercadoPagoWebhook, getPlans, createCheckoutSchema,
  startTrial,
} from '../controllers/subscriptionController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

router.get('/plans', getPlans)

// Webhooks — sin autenticación JWT, verifican firma propia
router.post('/webhooks/stripe', raw({ type: 'application/json' }), handleStripeWebhook)
router.post('/webhooks/mercadopago', handleMercadoPagoWebhook)

router.use(authenticate)

router.get('/current', getCurrentSubscription)
router.post('/start-trial', startTrial)
router.post('/checkout', validate(createCheckoutSchema), createCheckoutSession)
router.post('/cancel', cancelSubscription)

export default router
