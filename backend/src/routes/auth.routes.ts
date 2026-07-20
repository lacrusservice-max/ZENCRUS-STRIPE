import { Router } from 'express'
import {
  register, login, logout, verifyEmail, forgotPassword,
  resetPassword, refreshTokens, resendVerification, checkUsername,
  registerSchema, loginSchema, verifyEmailSchema,
  forgotPasswordSchema, resetPasswordSchema,
} from '../controllers/authController'
import { authLimiter } from '../middleware/security'
import { validate } from '../middleware/validate'
import { authenticate } from '../middleware/auth'
import { z } from 'zod'

const router = Router()

router.get('/check-username', checkUsername)
router.post('/register', authLimiter, validate(registerSchema), register)
router.post('/login', authLimiter, validate(loginSchema), login)
router.post('/logout', authenticate, logout)
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail)
router.post('/resend-verification', authLimiter, validate(forgotPasswordSchema), resendVerification)
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword)
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword)
router.post('/refresh', validate(z.object({ body: z.object({ refreshToken: z.string().optional() }) })), refreshTokens)

export default router
