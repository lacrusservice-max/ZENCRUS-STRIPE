import { Router } from 'express'
import {
  createSession, getSessions, getSession,
  sendMessage, archiveSession, createSessionSchema, sendMessageSchema,
} from '../controllers/chatController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

router.use(authenticate)

router.post('/sessions', validate(createSessionSchema), createSession)
router.get('/sessions', getSessions)
router.get('/sessions/:id', getSession)
router.post('/sessions/:id/messages', validate(sendMessageSchema), sendMessage)
router.patch('/sessions/:id/archive', archiveSession)

export default router
