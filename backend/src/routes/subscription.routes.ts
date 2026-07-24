import { Router } from 'express'
import {
  getCurrentSubscription, createCheckoutSession, cancelSubscription,
  handleMercadoPagoWebhook, getPlans, createCheckoutSchema,
  startTrial, createWebCheckout,
} from '../controllers/subscriptionController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

router.get('/plans', getPlans)

// El webhook de Stripe se registra en server.ts (antes de express.json()),
// porque necesita el body crudo para verificar la firma HMAC.
router.post('/webhooks/mercadopago', handleMercadoPagoWebhook)

router.use(authenticate)

router.get('/current', getCurrentSubscription)
router.post('/start-trial', startTrial)
router.post('/checkout', validate(createCheckoutSchema), createCheckoutSession)
router.post('/checkout-web', createWebCheckout)
router.post('/cancel', cancelSubscription)

export default router
