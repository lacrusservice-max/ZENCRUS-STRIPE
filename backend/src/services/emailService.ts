import nodemailer from 'nodemailer'
import { env } from '../config/env'
import { logger } from '../config/logger'

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
})

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    })
    logger.info(`Email enviado a ${to}: ${subject}`)
  } catch (error) {
    logger.error(`Error enviando email a ${to}:`, error)
    // No bloqueamos el flujo — el SMTP se configura con App Password de Gmail
  }
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  code: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f7f0; padding: 40px 20px; margin: 0;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #2d8a4e, #4caf7d); padding: 40px 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">NutriAI Fit</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Tu compañero de salud y fitness</p>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 12px;">Hola, ${name} 👋</h2>
          <p style="color: #555; line-height: 1.6; margin: 0 0 28px;">Usa el siguiente código para verificar tu correo electrónico. Expira en <strong>10 minutos</strong>.</p>
          <div style="background: #f0f9f4; border: 2px solid #2d8a4e; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 28px;">
            <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #2d8a4e; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 0;">Si no creaste una cuenta en NutriAI Fit, ignora este correo. Nadie más puede ver este código.</p>
        </div>
        <div style="background: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #aaa; font-size: 12px; margin: 0;">© 2024 NutriAI Fit · <a href="#" style="color: #2d8a4e; text-decoration: none;">Aviso de privacidad</a></p>
        </div>
      </div>
    </body>
    </html>
  `
  await sendEmail(email, 'Verifica tu correo — NutriAI Fit', html)
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
): Promise<void> {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f7f0; padding: 40px 20px; margin: 0;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #2d8a4e, #4caf7d); padding: 40px 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">NutriAI Fit</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 12px;">Restablecer contraseña</h2>
          <p style="color: #555; line-height: 1.6; margin: 0 0 28px;">Hola ${name}, recibimos una solicitud para restablecer la contraseña de tu cuenta. El enlace expira en <strong>1 hora</strong>.</p>
          <a href="${resetUrl}" style="display: block; background: linear-gradient(135deg, #2d8a4e, #4caf7d); color: white; text-decoration: none; padding: 16px 24px; border-radius: 10px; text-align: center; font-size: 16px; font-weight: 600; margin: 0 0 28px;">Restablecer contraseña</a>
          <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 0;">Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.</p>
        </div>
      </div>
    </body>
    </html>
  `
  await sendEmail(email, 'Restablece tu contraseña — NutriAI Fit', html)
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f7f0; padding: 40px 20px; margin: 0;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #2d8a4e, #4caf7d); padding: 40px 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">¡Bienvenido a NutriAI Fit! 🎉</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 12px;">Hola, ${name} 👋</h2>
          <p style="color: #555; line-height: 1.6; margin: 0 0 20px;">Tu cuenta ha sido creada exitosamente. Estás a un paso de transformar tu salud con un plan 100% personalizado con IA.</p>
          <div style="background: #f0f9f4; border-radius: 12px; padding: 20px; margin: 0 0 28px;">
            <p style="color: #2d8a4e; font-weight: 600; margin: 0 0 12px;">Lo que puedes hacer ahora:</p>
            <ul style="color: #555; margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Completar tu perfil de salud</li>
              <li>Generar tu primer plan de dieta personalizado</li>
              <li>Crear tu rutina de entrenamiento</li>
              <li>Chatear con tu asistente de IA 24/7</li>
            </ul>
          </div>
          <a href="${env.FRONTEND_URL}" style="display: block; background: linear-gradient(135deg, #2d8a4e, #4caf7d); color: white; text-decoration: none; padding: 16px 24px; border-radius: 10px; text-align: center; font-size: 16px; font-weight: 600;">Comenzar mi viaje de salud →</a>
        </div>
      </div>
    </body>
    </html>
  `
  await sendEmail(email, '¡Tu viaje de salud comienza hoy! — NutriAI Fit', html)
}
