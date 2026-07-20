import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { env } from '../config/env'
import { logger } from '../config/logger'

const LOGO_URL = 'https://bmawnpbazezbkevsfbte.supabase.co/storage/v1/object/public/assets/email/logo-zencrus.png'

// ── Proveedor de email: Resend (primario) o Nodemailer (fallback) ─────────────

let resend: Resend | null = null
if (env.RESEND_API_KEY) {
  resend = new Resend(env.RESEND_API_KEY)
  logger.info('📧 Email provider: Resend')
} else {
  logger.warn('📧 Email provider: Nodemailer SMTP (RESEND_API_KEY no configurado)')
}

const smtpTransporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.gmail.com',
  port: env.SMTP_PORT || 587,
  secure: (env.SMTP_PORT || 587) === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 8000,
})

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    if (resend) {
      const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to,
        subject,
        html,
      })
      if (error) throw new Error(error.message)
    } else {
      await smtpTransporter.sendMail({ from: env.EMAIL_FROM, to, subject, html })
    }
    logger.info(`✅ Email enviado a ${to}: ${subject}`)
  } catch (error) {
    logger.error(`❌ Error enviando email a ${to}:`, error)
    throw error
  }
}

// ── Base template ─────────────────────────────────────────────────────────────

function emailBase(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>ZENCRUS</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#080808;min-height:100vh;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;width:100%;">

        <!-- HEADER con logo -->
        <tr>
          <td style="background:linear-gradient(135deg,#5B4FFF 0%,#8B80FF 100%);border-radius:20px 20px 0 0;padding:36px 40px;text-align:center;">
            <img src="${LOGO_URL}" alt="ZENCRUS" width="160" style="display:block;margin:0 auto;max-width:160px;height:auto;" />
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background:#111117;padding:40px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);">
            ${content}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#0d0d12;border-radius:0 0 20px 20px;padding:24px 40px;text-align:center;border:1px solid rgba(255,255,255,0.06);border-top:none;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.2);font-size:12px;line-height:1.6;">
              © 2025 ZENCRUS · Tu coach de fitness con inteligencia artificial
            </p>
            <p style="margin:0;color:rgba(255,255,255,0.12);font-size:11px;">
              Este correo fue enviado a tu dirección registrada en ZENCRUS.<br/>
              Si no creaste una cuenta, puedes ignorar este mensaje.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

// ── Emails ────────────────────────────────────────────────────────────────────

export async function sendVerificationEmail(email: string, name: string, code: string): Promise<void> {
  const firstName = name.split(' ')[0]
  const digits = code.split('').map(d =>
    `<td style="width:48px;height:60px;background:rgba(91,79,255,0.12);border:2px solid rgba(91,79,255,0.45);border-radius:12px;text-align:center;vertical-align:middle;">
       <span style="font-size:32px;font-weight:900;color:#8B80FF;font-family:monospace;">${d}</span>
     </td>`
  ).join('<td style="width:8px;"></td>')

  const html = emailBase(`
    <h1 style="margin:0 0 8px;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;">
      Hola, ${firstName} 👋
    </h1>
    <p style="margin:0 0 32px;color:rgba(255,255,255,0.5);font-size:15px;line-height:1.7;">
      Gracias por unirte a <strong style="color:#8B80FF;">ZENCRUS</strong>. Usa el código de abajo para verificar tu correo electrónico. Expira en <strong style="color:#fff;">10 minutos</strong>.
    </p>

    <!-- Código de verificación -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:32px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>${digits}</tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Tip -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="background:rgba(91,79,255,0.08);border:1px solid rgba(91,79,255,0.2);border-radius:12px;padding:16px 20px;">
          <p style="margin:0;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;">
            🔒 <strong style="color:rgba(255,255,255,0.6);">Por tu seguridad:</strong> ZENCRUS nunca te pedirá este código por teléfono, WhatsApp o cualquier otro canal. Si no fuiste tú, ignora este correo.
          </p>
        </td>
      </tr>
    </table>
  `)

  await sendEmail(email, `${code} — Verifica tu cuenta ZENCRUS`, html)
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const firstName = name.split(' ')[0]

  const feature = (icon: string, title: string, desc: string) =>
    `<tr>
      <td style="padding:0 0 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td width="44" valign="top">
              <div style="width:36px;height:36px;background:rgba(91,79,255,0.15);border-radius:10px;text-align:center;line-height:36px;font-size:18px;">${icon}</div>
            </td>
            <td style="padding-left:12px;" valign="top">
              <p style="margin:0 0 2px;color:#fff;font-size:14px;font-weight:600;">${title}</p>
              <p style="margin:0;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.5;">${desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  const html = emailBase(`
    <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:800;line-height:1.3;">
      ¡Bienvenido, ${firstName}! 🎉
    </h1>
    <p style="margin:0 0 32px;color:rgba(255,255,255,0.5);font-size:15px;line-height:1.7;">
      Tu cuenta <strong style="color:#8B80FF;">ZENCRUS</strong> está activa. Tu plan personalizado de nutrición y entrenamiento con IA ya está siendo generado según tu perfil.
    </p>

    <!-- Features -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:32px;">
      <tr>
        <td style="background:rgba(91,79,255,0.07);border:1px solid rgba(91,79,255,0.18);border-radius:16px;padding:24px;">
          <p style="margin:0 0 20px;color:#8B80FF;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Lo que te espera</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${feature('🧠', 'Coach IA 24/7', 'Responde tus preguntas de nutrición y entrenamiento al instante')}
            ${feature('🥗', 'Plan nutricional personalizado', 'Calorías, proteínas, carbos y grasas calculados para ti')}
            ${feature('💪', 'Rutinas adaptadas', 'Programas de entrenamiento según tus metas y nivel')}
            ${feature('📊', 'Seguimiento de progreso', 'Visualiza tu evolución semana a semana')}
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center">
          <a href="${env.FRONTEND_URL}" style="display:inline-block;background:linear-gradient(135deg,#5B4FFF,#8B80FF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:0.3px;">
            Abrir ZENCRUS →
          </a>
        </td>
      </tr>
    </table>
  `)

  await sendEmail(email, '¡Bienvenido a ZENCRUS! Tu plan personalizado está listo 🚀', html)
}

export async function sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void> {
  const firstName = name.split(' ')[0]
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`

  const html = emailBase(`
    <h1 style="margin:0 0 8px;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;">
      Restablecer contraseña
    </h1>
    <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:15px;line-height:1.7;">
      Hola, <strong style="color:#fff;">${firstName}</strong>. Recibimos una solicitud para restablecer la contraseña de tu cuenta.
    </p>
    <p style="margin:0 0 32px;color:rgba(255,255,255,0.4);font-size:14px;line-height:1.7;">
      El enlace expira en <strong style="color:#fff;">1 hora</strong>.
    </p>

    <!-- CTA -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:32px;">
      <tr>
        <td align="center">
          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#5B4FFF,#8B80FF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:0.3px;">
            Restablecer contraseña →
          </a>
        </td>
      </tr>
    </table>

    <!-- Alternativa texto -->
    <p style="margin:0 0 12px;color:rgba(255,255,255,0.3);font-size:13px;text-align:center;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin:0 0 32px;word-break:break-all;text-align:center;">
      <a href="${resetUrl}" style="color:#8B80FF;font-size:12px;font-family:monospace;">${resetUrl}</a>
    </p>

    <!-- Aviso seguridad -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="background:rgba(255,80,80,0.07);border:1px solid rgba(255,80,80,0.2);border-radius:12px;padding:16px 20px;">
          <p style="margin:0;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;">
            🔒 Si no solicitaste restablecer tu contraseña, ignora este correo. Tu cuenta permanece segura.
          </p>
        </td>
      </tr>
    </table>
  `)

  await sendEmail(email, 'Restablece tu contraseña — ZENCRUS', html)
}
