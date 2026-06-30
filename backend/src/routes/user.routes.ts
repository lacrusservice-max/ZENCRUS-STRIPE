import { Router } from 'express'
import {
  getProfile, updateProfile, deleteAccount,
  exportData, updateFcmToken, updateProfileSchema,
} from '../controllers/userController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { z } from 'zod'

const router = Router()

router.use(authenticate)

// Alias /profile para compatibilidad con el cliente móvil
router.get('/profile', getProfile)
router.put('/profile', validate(updateProfileSchema), updateProfile)

// Rutas originales /me
router.get('/me', getProfile)
router.patch('/me', validate(updateProfileSchema), updateProfile)
router.delete('/me', deleteAccount)
router.get('/me/export', exportData)
router.patch('/me/fcm-token', validate(z.object({
  body: z.object({ fcmToken: z.string().min(1) }),
})), updateFcmToken)

export default router
