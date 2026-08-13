import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { decidir, desempaquetar, empaquetar } from '../utils/familiaTokens'
import { generateVerificationCode, generateSecureToken } from '../utils/crypto'
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService'
import { AppError } from '../middleware/errorHandler'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'

// ── Schemas de validación ─────────────────────────────────────────────────────

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').max(254).toLowerCase(),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(128)
      .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
      .regex(/[0-9]/, 'Debe incluir al menos un número')
      .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial'),
    fullName: z
      .string()
      .min(2, 'Nombre demasiado corto')
      .max(100)
      .trim()
      .regex(/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+$/, 'Solo letras y espacios'),
    username: z
      .string()
      .min(3, 'Mínimo 3 caracteres')
      .max(20, 'Máximo 20 caracteres')
      .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y _')
      .optional(),
    profileData: z.any().optional(),
  }),
})

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase(),
    password: z.string().min(1),
    deviceFingerprint: z.string().optional(),
    fcmToken: z.string().optional(),
  }),
})

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase(),
    code: z.string().length(6).regex(/^\d+$/),
  }),
})

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase(),
  }),
})

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),
  }),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 10 // ~100ms en Railway — seguro y rápido

function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }
}

// ── Controllers ───────────────────────────────────────────────────────────────

export async function checkUsername(req: Request, res: Response): Promise<void> {
  const { username } = req.query
  if (!username || typeof username !== 'string') {
    res.status(400).json({ success: false, message: 'Username requerido' } satisfies ApiResponse)
    return
  }
  const clean = username.toLowerCase().trim()
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    res.status(200).json({ success: true, data: { available: false, reason: 'formato_invalido' } } satisfies ApiResponse)
    return
  }
  const { data } = await supabase.from('users').select('id').eq('username', clean).maybeSingle()
  res.status(200).json({ success: true, data: { available: !data } } satisfies ApiResponse)
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, fullName, username, profileData } = req.body

  // Check email uniqueness
  const { data: existingEmail } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
  if (existingEmail) {
    res.status(409).json({ success: false, message: 'Ya existe una cuenta con este correo electrónico' } satisfies ApiResponse)
    return
  }

  // Check username uniqueness if provided
  if (username) {
    const { data: existingUsername } = await supabase.from('users').select('id').eq('username', username.toLowerCase()).maybeSingle()
    if (existingUsername) {
      res.status(409).json({ success: false, message: 'Este nombre de usuario ya está en uso' } satisfies ApiResponse)
      return
    }
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const verificationCode = generateVerificationCode()
  const codeExpires = new Date(Date.now() + 10 * 60 * 1000)

  const insertData: Record<string, unknown> = {
    email,
    password_hash: passwordHash,
    full_name: fullName,
    email_verification_code: verificationCode,
    email_verification_expires: codeExpires.toISOString(),
  }
  if (username) insertData.username = username.toLowerCase()
  if (profileData) {
    if (profileData.peso)           insertData.weight = profileData.peso
    if (profileData.talla)          insertData.height = profileData.talla
    if (profileData.edad)           insertData.age = profileData.edad
    if (profileData.sexo)           insertData.gender = profileData.sexo
    if (profileData.nivelActividad) insertData.activity_level = profileData.nivelActividad
    if (profileData.objetivo)       insertData.goals = { main_goal: profileData.objetivo, target_weight: profileData.pesoObjetivo }
    if (profileData.peso && profileData.talla && profileData.sexo && profileData.nivelActividad) {
      insertData.profile_completed = true
    }
  }

  const { error } = await supabase.from('users').insert(insertData)
  if (error) {
    logger.error('Error registrando usuario:', error.message)
    res.status(500).json({ success: false, message: 'Error creando cuenta. Intenta de nuevo.' } satisfies ApiResponse)
    return
  }

  // Fire-and-forget — no bloquear la respuesta esperando el email
  sendVerificationEmail(email, fullName, verificationCode).catch(err =>
    logger.error('Error enviando email de verificación:', err)
  )
  logger.info(`Nuevo usuario registrado: ${email}`)

  res.status(201).json({
    success: true,
    message: 'Cuenta creada. Revisa tu correo para verificar tu cuenta.',
    data: { email, requiresVerification: true },
  } satisfies ApiResponse)
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { email, code } = req.body

  const { data: user } = await supabase
    .from('users')
    .select('id, full_name, role, subscription_tier, email_verification_code, email_verification_expires')
    .eq('email', email)
    .maybeSingle()

  if (!user || !user.email_verification_code) {
    res.status(400).json({
      success: false,
      message: 'Código de verificación inválido o expirado',
    } satisfies ApiResponse)
    return
  }

  if (
    user.email_verification_code !== code ||
    new Date(user.email_verification_expires) < new Date()
  ) {
    res.status(400).json({
      success: false,
      message: 'Código incorrecto o expirado. Solicita uno nuevo.',
    } satisfies ApiResponse)
    return
  }

  const tokenFamily = uuidv4()
  await supabase.from('users').update({
    email_verified: true,
    email_verification_code: null,
    email_verification_expires: null,
    refresh_token_family: tokenFamily,
  }).eq('id', user.id)

  // El correo de bienvenida/activación se envía solo tras contratar un plan y pagar
  // (ver subscriptionController: se dispara en el webhook de Stripe, no aquí).

  const accessToken = signAccessToken({
    userId: user.id,
    email,
    role: user.role,
    subscriptionTier: user.subscription_tier,
  })
  const refreshToken = signRefreshToken({ userId: user.id, tokenFamily })

  res.status(200).json({
    success: true,
    message: '¡Correo verificado! Bienvenido a ZENCRUS.',
    data: { accessToken, refreshToken },
  } satisfies ApiResponse)
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, fcmToken } = req.body

  const { data: user } = await supabase
    .from('users')
    .select('id, email, password_hash, full_name, role, subscription_tier, email_verified, is_active, failed_login_attempts, locked_until, fcm_token')
    .eq('email', email)
    .maybeSingle()

  if (!user) {
    res.status(401).json({ success: false, message: 'Credenciales incorrectas' } satisfies ApiResponse)
    return
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000)
    res.status(423).json({
      success: false,
      message: `Cuenta bloqueada temporalmente. Intenta en ${minutes} minutos.`,
    } satisfies ApiResponse)
    return
  }

  if (!user.is_active) {
    res.status(403).json({
      success: false,
      message: 'Tu cuenta ha sido desactivada. Contacta soporte.',
    } satisfies ApiResponse)
    return
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash)

  if (!passwordValid) {
    const newAttempts = (user.failed_login_attempts || 0) + 1
    const updates: Record<string, unknown> = { failed_login_attempts: newAttempts }
    if (newAttempts >= 5) {
      updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      logger.warn(`Cuenta bloqueada por intentos fallidos: ${email}`)
    }
    await supabase.from('users').update(updates).eq('id', user.id)
    res.status(401).json({ success: false, message: 'Credenciales incorrectas' } satisfies ApiResponse)
    return
  }

  if (!user.email_verified) {
    const verificationCode = generateVerificationCode()
    await supabase.from('users').update({
      email_verification_code: verificationCode,
      email_verification_expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }).eq('id', user.id)
    sendVerificationEmail(email, user.full_name, verificationCode).catch(()=>{})
    res.status(403).json({
      success: false,
      message: 'Por favor verifica tu correo electrónico. Te enviamos un nuevo código.',
      data: { requiresVerification: true },
    } satisfies ApiResponse)
    return
  }

  const tokenFamily = uuidv4()
  await supabase.from('users').update({
    failed_login_attempts: 0,
    locked_until: null,
    last_login: new Date().toISOString(),
    fcm_token: fcmToken || user.fcm_token,
    refresh_token_family: tokenFamily,
  }).eq('id', user.id)

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    subscriptionTier: user.subscription_tier,
  })
  const refreshToken = signRefreshToken({ userId: user.id, tokenFamily })

  res.cookie('refreshToken', refreshToken, cookieOptions())
  logger.info(`Login exitoso: ${email}`)

  res.status(200).json({
    success: true,
    data: { accessToken, refreshToken },
  } satisfies ApiResponse)
}

export async function refreshTokens(req: Request, res: Response): Promise<void> {
  const token = req.body.refreshToken || req.cookies?.refreshToken

  if (!token) {
    res.status(401).json({ success: false, message: 'Refresh token requerido' } satisfies ApiResponse)
    return
  }

  try {
    const payload = verifyRefreshToken(token)

    const { data: user } = await supabase
      .from('users')
      .select('id, email, role, subscription_tier, refresh_token_family, is_active')
      .eq('id', payload.userId)
      .maybeSingle()

    if (!user) throw new AppError(401, 'Usuario no encontrado')

    /**
     * Tres respuestas posibles, y solo una es «te han robado el token».
     *
     * Antes solo había dos —coincide o no coincide— y eso convertía una carrera
     * legítima en un robo: dos peticiones del mismo móvil refrescando a la vez
     * y la segunda echaba al usuario de su propia cuenta. Ver
     * `utils/familiaTokens.ts`.
     */
    const decision = decidir(user.refresh_token_family, payload.tokenFamily)

    if (decision.tipo === 'robo') {
      await supabase.from('users').update({ refresh_token_family: null }).eq('id', user.id)
      throw new AppError(401, 'Token de refresco comprometido. Inicia sesión nuevamente.')
    }

    // El inicio de sesión ya lo comprobaba, pero el refresco no, y sin esto la
    // suspensión no suspendía nada: quien tuviera un token de refresco seguía
    // renovando sesión indefinidamente y usando la app entera aunque el
    // administrador le hubiera cerrado la cuenta o él mismo la hubiera borrado.
    //
    // Va DESPUÉS de la comprobación de token comprometido para no saltársela:
    // que la cuenta esté apagada no es motivo para dejar de invalidar una
    // familia de tokens que ha sido robada.
    //
    // Quien se queda fuera no ve aquí el motivo —este endpoint responde igual
    // ante cualquier fallo de token, a propósito— pero lo lee en cuanto vuelve
    // a iniciar sesión, que es a donde va la app a continuación.
    if (!user.is_active) throw new AppError(401, 'Esta cuenta está desactivada')

    /**
     * En gracia NO se rota.
     *
     * Se devuelve un token de la familia que ya está vigente, así que el que
     * perdió la carrera acaba con el MISMO token bueno que el que la ganó y los
     * dos siguen. Si aquí se rotara otra vez, se invalidaría el token del que
     * ganó y la carrera volvería a empezar: dos clientes turnándose para
     * echarse el uno al otro, que es peor que el fallo original.
     */
    let familiaVigente: string

    if (decision.tipo === 'gracia') {
      familiaVigente = decision.familiaActual
      logger.info(`Refresco en gracia para ${user.id}: llegó con la familia anterior`)
    } else {
      /**
       * La rotación es CONDICIONAL, y esto no es una precaución teórica.
       *
       * Dos peticiones simultáneas leen la misma familia, las dos deciden
       * rotar y las dos escriben: la segunda pisa a la primera y el token que
       * ya se había entregado deja de valer. La ventana de gracia sola no lo
       * cubre —cubre la carrera en la que una llega después, no la que llega a
       * la vez— y se vio en la prueba: las dos respondían 200 y uno de los dos
       * tokens nacía muerto.
       *
       * Con `eq` sobre el valor leído, la base decide quién gana: solo una
       * escritura encuentra la fila como la dejó su lectura. Quien pierde no
       * rota nada, vuelve a leer y se va por la gracia.
       */
      const nueva = uuidv4()
      const leido = user.refresh_token_family
      const anterior = desempaquetar(leido)?.actual ?? null

      const { data: cambiadas } = await supabase
        .from('users')
        .update({ refresh_token_family: empaquetar(nueva, anterior) })
        .eq('id', user.id)
        .eq('refresh_token_family', leido as string)
        .select('id')

      if (cambiadas && cambiadas.length > 0) {
        familiaVigente = nueva
      } else {
        // Perdió la carrera. Se relee y se decide otra vez: si el que ganó
        // acaba de rotar, esto cae en gracia y los dos acaban con lo mismo.
        const { data: recargado } = await supabase
          .from('users').select('refresh_token_family').eq('id', user.id).maybeSingle()
        const segunda = decidir(recargado?.refresh_token_family, payload.tokenFamily)

        if (segunda.tipo !== 'gracia') {
          await supabase.from('users').update({ refresh_token_family: null }).eq('id', user.id)
          throw new AppError(401, 'Token de refresco comprometido. Inicia sesión nuevamente.')
        }
        familiaVigente = segunda.familiaActual
        logger.info(`Refresco simultáneo para ${user.id}: perdió la carrera y se le da la familia buena`)
      }
    }

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      subscriptionTier: user.subscription_tier,
    })
    const refreshToken = signRefreshToken({ userId: user.id, tokenFamily: familiaVigente })

    res.cookie('refreshToken', refreshToken, cookieOptions())
    res.status(200).json({ success: true, data: { accessToken, refreshToken } } satisfies ApiResponse)
  } catch (e) {
    /**
     * QUE EL 401 DIGA POR QUÉ, aunque solo sea en el registro.
     *
     * La respuesta al cliente sigue siendo la misma para cualquier fallo —a
     * propósito: distinguir «token caducado» de «token de otro» le da pistas a
     * quien esté probando—. Pero aquí dentro se apuntaba NADA, y eso convirtió
     * una tarde entera en adivinar: se veía un 401 en el registro de acceso y
     * no había forma de saber si era una firma mala, un token vencido, una
     * familia que no cuadra o una cuenta apagada.
     *
     * Un catch que se traga el error esconde el fallo durante horas.
     */
    const err = e as { name?: string; message?: string; statusCode?: number }
    logger.warn(
      `Refresco rechazado: ${err?.name ?? 'Error'} — ${err?.message ?? 'sin mensaje'}`,
    )
    res.status(401).json({
      success: false,
      message: 'Token inválido o expirado. Por favor inicia sesión.',
    } satisfies ApiResponse)
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId
  if (userId) {
    await supabase.from('users').update({ refresh_token_family: null }).eq('id', userId)
  }
  res.clearCookie('refreshToken')
  res.status(200).json({ success: true, message: 'Sesión cerrada correctamente' } satisfies ApiResponse)
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body

  const { data: user } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('email', email)
    .maybeSingle()

  if (!user) {
    res.status(200).json({
      success: true,
      message: 'Si el correo existe, recibirás instrucciones en breve.',
    } satisfies ApiResponse)
    return
  }

  const resetToken = generateSecureToken(32)
  await supabase.from('users').update({
    password_reset_token: resetToken,
    password_reset_expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }).eq('id', user.id)

  sendPasswordResetEmail(email, user.full_name, resetToken).catch(()=>{})

  res.status(200).json({
    success: true,
    message: 'Si el correo existe, recibirás instrucciones en breve.',
  } satisfies ApiResponse)
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body

  const { data: user } = await supabase
    .from('users')
    .select('id, email, password_reset_expires')
    .eq('password_reset_token', token)
    .maybeSingle()

  if (!user || !user.password_reset_expires || new Date(user.password_reset_expires) < new Date()) {
    res.status(400).json({
      success: false,
      message: 'Enlace inválido o expirado. Solicita uno nuevo.',
    } satisfies ApiResponse)
    return
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  await supabase.from('users').update({
    password_hash: passwordHash,
    password_reset_token: null,
    password_reset_expires: null,
    refresh_token_family: null,
  }).eq('id', user.id)

  logger.info(`Contraseña restablecida: ${user.email}`)

  res.status(200).json({
    success: true,
    message: 'Contraseña restablecida correctamente. Inicia sesión.',
  } satisfies ApiResponse)
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  const { email } = req.body

  const { data: user } = await supabase
    .from('users')
    .select('id, full_name, email_verified')
    .eq('email', email)
    .maybeSingle()

  if (!user || user.email_verified) {
    res.status(200).json({
      success: true,
      message: 'Si el correo existe y no está verificado, recibirás un nuevo código.',
    } satisfies ApiResponse)
    return
  }

  const verificationCode = generateVerificationCode()
  await supabase.from('users').update({
    email_verification_code: verificationCode,
    email_verification_expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }).eq('id', user.id)

  sendVerificationEmail(email, user.full_name, verificationCode).catch(() => {})

  res.status(200).json({
    success: true,
    message: 'Nuevo código enviado. Revisa tu correo.',
  } satisfies ApiResponse)
}
