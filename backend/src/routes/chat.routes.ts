import { Router } from 'express'
import {
  createSession, getSessions, getSession,
  sendMessage, archiveSession, createSessionSchema, sendMessageSchema,
} from '../controllers/chatController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { exigirCuota } from '../middleware/aiQuota'

const router = Router()

router.use(authenticate)

router.post('/sessions', validate(createSessionSchema), createSession)
router.get('/sessions', getSessions)
router.get('/sessions/:id', getSession)

// `exigirCuota` va DESPUÉS de validar y ANTES del controlador: no tiene
// sentido gastarle un mensaje a alguien por una petición mal formada, ni
// llamar al modelo sin haber comprobado que le queda cuota.
router.post(
  '/sessions/:id/messages',
  validate(sendMessageSchema),
  exigirCuota('chat'),
  sendMessage,
)
router.patch('/sessions/:id/archive', archiveSession)

export default router
