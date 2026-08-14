import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt'
import {
  decidir, abrir, rotar, cerrar, nombreDeAparato,
} from '../utils/familiaTokens'
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
    .select('id, full_name, role, subscription_tier, email_verification_code, email_verification_expires, refresh_token_family')
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
  const aparato = nombreDeAparato(req.headers['x-device-fingerprint'])
  await supabase.from('users').update({
    email_verified: true,
    email_verification_code: null,
    email_verification_expires: null,
    refresh_token_family: abrir(user.refresh_token_family, aparato, tokenFamily),
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
    // `refresh_token_family` viene porque entrar añade ESTE aparato a lo que ya
    // hubiera: sin leerlo primero se borrarían las sesiones de los demás.
    .select('id, email, password_hash, full_name, role, subscription_tier, email_verified, is_active, failed_login_attempts, locked_until, fcm_token, refresh_token_family')
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

  /**
   * Entrar abre la sesión de ESTE aparato y deja las de los demás en paz.
   *
   * Antes se sobrescribía la única familia que había, así que entrar en el
   * móvil echaba del simulador y al revés. Ahora cada instalación tiene la suya,
   * identificada por la huella que el cliente ya manda en cada petición.
   */
  const tokenFamily = uuidv4()
  const aparato = nombreDeAparato(
    req.headers['x-device-fingerprint'] ?? (req.body as { deviceFingerprint?: string }).deviceFingerprint,
  )
  await supabase.from('users').update({
    failed_login_attempts: 0,
    locked_until: null,
    last_login: new Date().toISOString(),
    fcm_token: fcmToken || user.fcm_token,
    refresh_token_family: abrir(user.refresh_token_family, aparato, tokenFamily),
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
    /**
     * El refresco se resuelve DENTRO DEL APARATO que lo pide.
     *
     * `decidir` busca la familia que llega entre las de todos los aparatos y
     * dice de cuál es. A partir de ahí, todo lo que se haga —rotar, dar gracia
     * o cerrar— toca solo a ese, y las sesiones de los demás siguen intactas.
     */
    const decision = decidir(user.refresh_token_family, payload.tokenFamily)

    if (decision.tipo === 'reutilizado') {
      // Hay dos copias del token de ESTE aparato. Se cierra este y solo este:
      // echar a alguien de todos sus dispositivos por uno comprometido es
      // desproporcionado y hace que la gente acabe desactivando lo que protege.
      await supabase.from('users')
        .update({ refresh_token_family: cerrar(user.refresh_token_family, decision.aparato) })
        .eq('id', user.id)
      logger.warn(`Token reutilizado en el aparato ${decision.aparato} de ${user.id}: se cierra esa sesión`)
      throw new AppError(401, 'Token de refresco comprometido. Inicia sesión nuevamente.')
    }

    if (decision.tipo === 'desconocido') {
      // No es de ningún aparato conocido: se rechaza sin tocar nada. Un token
      // viejo no prueba nada y no puede costarle la sesión a nadie.
      logger.info(`Refresco con familia desconocida para ${user.id}: se rechaza sin anular nada`)
      throw new AppError(401, 'Token inválido. Inicia sesión nuevamente.')
    }

    const aparato = decision.aparato
    let familiaVigente: string

    if (decision.tipo === 'gracia') {
      familiaVigente = decision.familiaActual
      logger.info(`Refresco en gracia para ${user.id} · aparato ${aparato}`)
    } else {
      /**
       * La rotación sigue siendo CONDICIONAL sobre el valor leído.
       *
       * Dos peticiones simultáneas del MISMO aparato leen lo mismo, las dos
       * deciden rotar y la segunda escritura pisa a la primera: uno de los dos
       * tokens nacería muerto respondiendo 200. Con `eq` sobre lo leído, decide
       * la base quién gana y el que pierde relee y se va por la gracia.
       */
      const nueva = uuidv4()
      const leido = user.refresh_token_family

      const { data: cambiadas } = await supabase
        .from('users')
        .update({ refresh_token_family: rotar(leido, aparato, nueva) })
        .eq('id', user.id)
        .eq('refresh_token_family', leido as string)
        .select('id')

      if (cambiadas && cambiadas.length > 0) {
        familiaVigente = nueva
      } else {
        const { data: recargado } = await supabase
          .from('users').select('refresh_token_family').eq('id', user.id).maybeSingle()
        const segunda = decidir(recargado?.refresh_token_family, payload.tokenFamily)

        if (segunda.tipo === 'reutilizado') {
          await supabase.from('users')
            .update({ refresh_token_family: cerrar(recargado?.refresh_token_family, segunda.aparato) })
            .eq('id', user.id)
          throw new AppError(401, 'Token de refresco comprometido. Inicia sesión nuevamente.')
        }
        if (segunda.tipo !== 'gracia') {
          throw new AppError(401, 'Token inválido. Inicia sesión nuevamente.')
        }
        familiaVigente = segunda.familiaActual
        logger.info(`Refresco simultáneo en ${aparato} de ${user.id}: se le da la familia buena`)
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
    /**
     * Cerrar sesión cierra ESTE aparato, no todos.
     *
     * Salir en el móvil no puede echarte del iPad: son sesiones distintas y el
     * usuario solo pidió cerrar una. Para cerrar todas está el cambio de
     * contraseña, que sí lo hace a propósito.
     */
    const { data: u } = await supabase
      .from('users').select('refresh_token_family').eq('id', userId).maybeSingle()
    const aparato = nombreDeAparato(req.headers['x-device-fingerprint'])
    await supabase.from('users')
      .update({ refresh_token_family: cerrar(u?.refresh_token_family, aparato) })
      .eq('id', userId)
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
