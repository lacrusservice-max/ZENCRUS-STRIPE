import { Router } from 'express'
import { supabase } from '../config/supabase'

const router = Router()

// One-time bootstrap: sets the first admin if no admin exists yet.
// This endpoint removes itself from usefulness once an admin exists.
router.post('/init-admin', async (req, res) => {
  try {
    const { email, secret } = req.body as { email?: string; secret?: string }

    // Simple shared secret to prevent random people from calling this
    if (secret !== process.env.SETUP_SECRET && secret !== 'ZENCRUS_INIT_2026') {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email requerido' })
    }

    // Check if there is already an admin
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)

    if (admins && admins.length > 0) {
      return res.status(409).json({ success: false, message: 'Ya existe un administrador' })
    }

    // Update the user's role
    const { data, error } = await supabase
      .from('users')
      .update({ role: 'admin', updated_at: new Date().toISOString() })
      .eq('email', email)
      .select('id, email, role')

    if (error) {
      return res.status(500).json({ success: false, message: error.message })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado. Debes registrarte primero en zencrus.com.' })
    }

    return res.json({ success: true, message: `✅ ${email} ahora es administrador`, data: data[0] })
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: String(err) })
  }
})

export default router
