/**
 * TELEMETRÍA · LA RUTA
 *
 * `authenticate` sin exigir sesión no existe en este proyecto, así que por
 * ahora los eventos van autenticados: se pierde lo de antes del login, que es
 * justo donde interesa saber dónde se cae la gente en el registro. Queda
 * anotado como lo primero que ampliar; la tabla ya admite `user_id` nulo.
 */

import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { recibirEventos, loteEventosSchema } from '../controllers/eventsController'

const router = Router()

router.use(authenticate)
router.post('/batch', validate(loteEventosSchema), recibirEventos)

export default router
