import { Resend } from 'resend'
import { env } from '../config/env'
import { logger } from '../config/logger'

const LOGO_BLANCO_URL = 'https://bmawnpbazezbkevsfbte.supabase.co/storage/v1/object/public/assets/email/logo-zencrus.png'

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) throw new Error('RESEND_API_KEY no configurado')

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM || 'ZENCRUS <noreply@zencrus.com>',
    to,
    subject,
    html,
  })
  if (error) throw new Error(error.message)
  logger.info(`✅ Email enviado via Resend a ${to}: ${subject}`)
}

// ── Base template: negro puro, logo arriba, contenido centrado ───────────────

function base(body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>ZENCRUS</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:48px 16px;">

  <table role="presentation" width="540" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;width:100%;">

    <!-- Logo — fondo oscuro forzado para todos los clientes de correo -->
    <tr>
      <td align="center" style="padding-bottom:40px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="background:#0a0a0a;border-radius:12px;padding:10px 20px;">
              <img src="${LOGO_BLANCO_URL}" width="140" alt="ZENCRUS" style="display:block;max-width:140px;height:auto;"/>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Card -->
    <tr>
      <td style="background:#141414;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr><td style="padding:48px 44px;">
            ${body}
          </td></tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td align="center" style="padding-top:32px;">
        <p style="margin:0 0 6px;color:rgba(255,255,255,0.2);font-size:12px;">© 2025 ZENCRUS · Tu coach de fitness con IA</p>
        <p style="margin:0;color:rgba(255,255,255,0.1);font-size:11px;">Si no creaste una cuenta, puedes ignorar este correo.</p>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`
}

// ── Verificación de correo ────────────────────────────────────────────────────

export async function sendVerificationEmail(email: string, name: string, code: string): Promise<void> {
  const firstName = name.split(' ')[0]

  const digits = code.split('').map(d =>
    `<td style="width:52px;height:64px;text-align:center;vertical-align:middle;background:#1c1c1c;border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;">
      <span style="font-size:30px;font-weight:800;color:#ffffff;font-family:'Courier New',monospace;letter-spacing:0;">${d}</span>
    </td>`
  ).join('<td style="width:6px;"></td>')

  const html = base(`
    <h1 style="margin:0 0 10px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">
      Hola, ${firstName} 👋
    </h1>
    <p style="margin:0 0 36px;color:rgba(255,255,255,0.45);font-size:15px;line-height:1.7;">
      Gracias por registrarte en <strong style="color:#fff;">ZENCRUS</strong>.<br/>
      Ingresa este código en la app para verificar tu cuenta. Expira en <strong style="color:#fff;">10 minutos</strong>.
    </p>

    <!-- Código -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:36px;">
      <tr><td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>${digits}</tr>
        </table>
      </td></tr>
    </table>

    <!-- Línea divisora -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
      <tr><td style="border-top:1px solid rgba(255,255,255,0.07);font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>

    <p style="margin:0;color:rgba(255,255,255,0.25);font-size:12px;line-height:1.7;">
      🔒 ZENCRUS nunca te pedirá este código por teléfono o WhatsApp.<br/>
      Si no fuiste tú, ignora este mensaje — tu cuenta está segura.
    </p>
  `)

  await sendEmail(email, `${code} es tu código de verificación — ZENCRUS`, html)
}

// ── Bienvenida ────────────────────────────────────────────────────────────────

// Se envía únicamente cuando se activa un plan (checkout con tarjeta completado) —
// nunca al registrarse ni al verificar el correo.
export async function sendWelcomeEmail(email: string, name: string, planLabel: string, trialEndDate: string): Promise<void> {
  const firstName = name.split(' ')[0]

  const item = (icon: string, text: string) =>
    `<tr><td style="padding:0 0 14px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td width="28" valign="top" style="color:rgba(255,255,255,0.5);font-size:16px;padding-top:1px;">${icon}</td>
          <td style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.6;padding-left:8px;">${text}</td>
        </tr>
      </table>
    </td></tr>`

  const html = base(`
    <h1 style="margin:0 0 10px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">
      ¡Bienvenido a ZENCRUS, ${firstName}!
    </h1>
    <p style="margin:0 0 20px;color:rgba(255,255,255,0.45);font-size:15px;line-height:1.7;">
      Activaste el plan <strong style="color:#fff;">${planLabel}</strong>. Tu prueba de 5 días gratis ya está en marcha y tu plan personalizado con inteligencia artificial está siendo generado según tu perfil.
    </p>

    <!-- Trial notice -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
      style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.25);border-radius:14px;padding:18px 20px;margin-bottom:28px;">
      <tr><td style="color:#93b4ff;font-size:13px;line-height:1.6;">
        ⏳ Tu prueba gratuita termina el <strong>${trialEndDate}</strong>. Si no cancelas antes, se cobrará automáticamente con la tarjeta que registraste. Puedes cancelar en cualquier momento desde tu perfil.
      </td></tr>
    </table>

    <!-- Features -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
      style="background:#1a1a1a;border-radius:14px;padding:24px;margin-bottom:36px;border:1px solid rgba(255,255,255,0.06);">
      <tr><td>
        <p style="margin:0 0 18px;color:rgba(255,255,255,0.35);font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;">Lo que te espera</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          ${item('🧠', 'Coach de IA disponible 24/7 para guiarte en nutrición y entrenamiento')}
          ${item('🥗', 'Plan nutricional personalizado: calorías, proteínas, carbos y grasas')}
          ${item('💪', 'Rutinas de entrenamiento adaptadas a tus metas y nivel actual')}
          ${item('📊', 'Seguimiento de progreso y evolución semana a semana')}
        </table>
      </td></tr>
    </table>

    <!-- CTA -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr><td align="center">
        <a href="${env.FRONTEND_URL}"
          style="display:inline-block;background:#ffffff;color:#0a0a0a;text-decoration:none;padding:15px 44px;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:0.2px;">
          Abrir ZENCRUS →
        </a>
      </td></tr>
    </table>
  `)

  await sendEmail(email, `¡Bienvenido a ZENCRUS, ${firstName}! Tu plan ${planLabel} está activo 🚀`, html)
}

// ── Factura / recibo de pago ──────────────────────────────────────────────────
// Se envía cada vez que Stripe cobra exitosamente (fin del trial o renovación).

export async function sendInvoiceEmail(email: string, name: string, opts: { planLabel: string; amount: number; currency: string; invoiceUrl?: string; periodEnd?: string }): Promise<void> {
  const firstName = name.split(' ')[0]
  const amountFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: opts.currency.toUpperCase() }).format(opts.amount)

  const html = base(`
    <h1 style="margin:0 0 10px;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;">
      Recibo de pago — ZENCRUS
    </h1>
    <p style="margin:0 0 28px;color:rgba(255,255,255,0.45);font-size:15px;line-height:1.7;">
      Hola ${firstName}, confirmamos el cobro de tu suscripción a ZENCRUS.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
      style="background:#1a1a1a;border-radius:14px;padding:22px 24px;margin-bottom:28px;border:1px solid rgba(255,255,255,0.06);">
      <tr><td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:13px;">Plan</td><td align="right" style="padding:6px 0;color:#fff;font-size:13px;font-weight:600;">${opts.planLabel}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:13px;">Monto cobrado</td><td align="right" style="padding:6px 0;color:#fff;font-size:13px;font-weight:600;">${amountFmt}</td></tr>
      ${opts.periodEnd ? `<tr><td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:13px;">Próxima renovación</td><td align="right" style="padding:6px 0;color:#fff;font-size:13px;font-weight:600;">${opts.periodEnd}</td></tr>` : ''}
    </table>

    ${opts.invoiceUrl ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr><td align="center">
        <a href="${opts.invoiceUrl}"
          style="display:inline-block;background:#ffffff;color:#0a0a0a;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:14px;font-weight:700;">
          Ver factura completa →
        </a>
      </td></tr>
    </table>` : ''}

    <p style="margin:28px 0 0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">
      Puedes cancelar tu suscripción en cualquier momento desde tu perfil en ZENCRUS.
    </p>
  `)

  await sendEmail(email, `Recibo de pago — ${opts.planLabel} ZENCRUS`, html)
}

// ── Reset de contraseña ───────────────────────────────────────────────────────

export async function sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void> {
  const firstName = name.split(' ')[0]
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`

  const html = base(`
    <h1 style="margin:0 0 10px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">
      Restablecer contraseña
    </h1>
    <p style="margin:0 0 8px;color:rgba(255,255,255,0.45);font-size:15px;line-height:1.7;">
      Hola, <strong style="color:#fff;">${firstName}</strong>. Recibimos una solicitud para restablecer la contraseña de tu cuenta ZENCRUS.
    </p>
    <p style="margin:0 0 36px;color:rgba(255,255,255,0.3);font-size:14px;">
      El enlace expira en <strong style="color:rgba(255,255,255,0.6);">1 hora</strong>.
    </p>

    <!-- CTA principal -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:28px;">
      <tr><td align="center">
        <a href="${resetUrl}"
          style="display:inline-block;background:#ffffff;color:#0a0a0a;text-decoration:none;padding:15px 44px;border-radius:12px;font-size:15px;font-weight:700;">
          Restablecer contraseña →
        </a>
      </td></tr>
    </table>

    <!-- Link alternativo -->
    <p style="margin:0 0 6px;color:rgba(255,255,255,0.2);font-size:12px;text-align:center;">Si el botón no funciona, copia este enlace:</p>
    <p style="margin:0 0 28px;text-align:center;word-break:break-all;">
      <a href="${resetUrl}" style="color:rgba(255,255,255,0.4);font-size:11px;font-family:monospace;">${resetUrl}</a>
    </p>

    <!-- Línea divisora -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;">
      <tr><td style="border-top:1px solid rgba(255,255,255,0.07);font-size:0;">&nbsp;</td></tr>
    </table>

    <p style="margin:0;color:rgba(255,255,255,0.2);font-size:12px;line-height:1.7;">
      🔒 Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.
    </p>
  `)

  await sendEmail(email, `Restablecer contraseña — ZENCRUS`, html)
}
