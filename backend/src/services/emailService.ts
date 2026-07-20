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
  connectionTimeout: 5000,  // 5s máximo para conectar
  greetingTimeout: 5000,
  socketTimeout: 8000,
})

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html })
    logger.info(`Email enviado a ${to}: ${subject}`)
  } catch (error) {
    logger.error(`Error enviando email a ${to}:`, error)
  }
}

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #080808; padding: 40px 20px; margin: 0;
`
const headerGradient = `background: linear-gradient(135deg, #5B4FFF, #8B80FF);`

function emailWrapper(header: string, body: string, footer = ''): string {
  return `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="${baseStyle}">
  <div style="max-width:520px;margin:0 auto;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
    <div style="${headerGradient} padding:40px 32px;text-align:center;">
      <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.5px;margin-bottom:4px;">ZENCRUS</div>
      ${header}
    </div>
    <div style="background:#111117;padding:40px 32px;">${body}</div>
    <div style="background:#0d0d12;padding:20px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:0;">
        © 2025 ZENCRUS · Tu coach de fitness con IA
        ${footer}
      </p>
    </div>
  </div>
</body></html>`
}

export async function sendVerificationEmail(email: string, name: string, code: string): Promise<void> {
  const html = emailWrapper(
    `<p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:14px;">Verifica tu correo para empezar</p>`,
    `<h2 style="color:#fff;font-size:20px;margin:0 0 14px;font-weight:700;">Hola, ${name}</h2>
     <p style="color:rgba(255,255,255,0.55);line-height:1.7;margin:0 0 28px;">Usa el siguiente código para verificar tu correo. Expira en <strong style="color:#fff">10 minutos</strong>.</p>
     <div style="background:rgba(91,79,255,0.15);border:1.5px solid rgba(91,79,255,0.4);border-radius:16px;padding:28px;text-align:center;margin:0 0 28px;">
       <span style="font-size:44px;font-weight:900;letter-spacing:14px;color:#8B80FF;font-family:monospace;">${code}</span>
     </div>
     <p style="color:rgba(255,255,255,0.3);font-size:13px;line-height:1.6;margin:0;">Si no creaste una cuenta en ZENCRUS, ignora este correo.</p>`
  )
  await sendEmail(email, `${code} — Tu código de verificación ZENCRUS`, html)
}

export async function sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void> {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`
  const html = emailWrapper(
    `<p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:14px;">Solicitud de nueva contraseña</p>`,
    `<h2 style="color:#fff;font-size:20px;margin:0 0 14px;font-weight:700;">Hola, ${name}</h2>
     <p style="color:rgba(255,255,255,0.55);line-height:1.7;margin:0 0 28px;">Recibimos una solicitud para restablecer tu contraseña. El enlace expira en <strong style="color:#fff">1 hora</strong>.</p>
     <a href="${resetUrl}" style="display:block;background:linear-gradient(135deg,#5B4FFF,#8B80FF);color:#fff;text-decoration:none;padding:16px 24px;border-radius:12px;text-align:center;font-size:16px;font-weight:700;margin:0 0 28px;">Restablecer contraseña →</a>
     <p style="color:rgba(255,255,255,0.3);font-size:13px;line-height:1.6;margin:0;">Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.</p>`
  )
  await sendEmail(email, 'Restablece tu contraseña — ZENCRUS', html)
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const html = emailWrapper(
    `<p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:14px;">Tu coach de fitness con IA está listo</p>`,
    `<h2 style="color:#fff;font-size:20px;margin:0 0 14px;font-weight:700;">¡Bienvenido, ${name}! 🎉</h2>
     <p style="color:rgba(255,255,255,0.55);line-height:1.7;margin:0 0 24px;">Tu cuenta ZENCRUS está activa. Tu plan de nutrición y entrenamiento personalizado con IA ya está siendo generado.</p>
     <div style="background:rgba(91,79,255,0.1);border:1px solid rgba(91,79,255,0.25);border-radius:14px;padding:20px;margin:0 0 28px;">
       <p style="color:#8B80FF;font-weight:700;margin:0 0 12px;font-size:14px;">Lo que te espera en ZENCRUS:</p>
       <div style="color:rgba(255,255,255,0.6);font-size:13px;line-height:2;">
         ✓ Plan nutricional personalizado con IA<br>
         ✓ Rutina de entrenamiento adaptada a tus metas<br>
         ✓ Coach de IA disponible 24/7<br>
         ✓ Seguimiento de progreso en tiempo real
       </div>
     </div>
     <a href="${env.FRONTEND_URL}" style="display:block;background:linear-gradient(135deg,#5B4FFF,#8B80FF);color:#fff;text-decoration:none;padding:16px 24px;border-radius:12px;text-align:center;font-size:16px;font-weight:700;">Abrir ZENCRUS →</a>`
  )
  await sendEmail(email, '¡Bienvenido a ZENCRUS! Tu plan personalizado está listo', html)
}
