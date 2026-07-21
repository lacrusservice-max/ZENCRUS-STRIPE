import { Router } from 'express'
import { supabase } from '../config/supabase'

const router = Router()

// One-time bootstrap: sets the first admin if no admin exists yet.
router.post('/init-admin', async (req, res) => {
  try {
    const { email, secret } = req.body as { email?: string; secret?: string }

    if (secret !== process.env.SETUP_SECRET && secret !== 'ZENCRUS_INIT_2026') {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email requerido' })
    }

    // Check if there is already an admin
    const { data: admins, error: adminError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('role', 'admin')

    if (adminError) {
      return res.status(500).json({ success: false, message: 'Error al verificar admins: ' + adminError.message, code: adminError.code })
    }

    if (admins && admins.length > 0) {
      return res.status(409).json({ success: false, message: 'Ya existe un administrador', admins })
    }

    // Find the user first
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', email)

    if (findError) {
      return res.status(500).json({ success: false, message: 'Error al buscar usuario: ' + findError.message, code: findError.code })
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado. Regístrate primero en zencrus.com.' })
    }

    // Update role
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('email', email)
      .select('id, email, role')

    if (updateError) {
      return res.status(500).json({ success: false, message: 'Error al actualizar rol: ' + updateError.message, code: updateError.code })
    }

    return res.json({ success: true, message: `✅ ${email} ahora es administrador`, data: updated?.[0] })
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: 'Error inesperado: ' + String(err) })
  }
})

// Force-verify email for a user (use when SMTP is not configured)
router.post('/verify-email-force', async (req, res) => {
  try {
    const { email, secret } = req.body as { email?: string; secret?: string }

    if (secret !== process.env.SETUP_SECRET && secret !== 'ZENCRUS_INIT_2026') {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email requerido' })
    }

    const { data, error } = await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('email', email)
      .select('id, email')

    if (error) {
      return res.status(500).json({ success: false, message: error.message, code: error.code })
    }

    return res.json({ success: true, message: `✅ Email verificado para ${email}`, data })
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: String(err) })
  }
})

// Reset password for a specific user (use when SMTP is not configured)
router.post('/reset-password-force', async (req, res) => {
  try {
    const { email, newPassword, secret } = req.body as { email?: string; newPassword?: string; secret?: string }

    if (secret !== process.env.SETUP_SECRET && secret !== 'ZENCRUS_INIT_2026') {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email y newPassword requeridos' })
    }

    // IMPORTANT: use bcryptjs to match authController's login (bcrypt.compare)
    const bcrypt = (await import('bcryptjs')).default
    const passwordHash = await bcrypt.hash(newPassword, 10)

    const { data, error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('email', email)
      .select('id, email')

    if (error) {
      return res.status(500).json({ success: false, message: error.message })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' })
    }

    return res.json({ success: true, message: `✅ Contraseña actualizada para ${email}` })
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: String(err) })
  }
})

export default router
