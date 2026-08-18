/**
 * Las propuestas de ZENA esperando un sí. §10.
 *
 * Cuelgan de su propia raíz y no de `/chat` aunque nazcan en una conversación:
 * deshacer sobrevive 24 horas a la sesión que lo originó, y la pantalla de
 * historial del §11 va a querer llegar aquí sin pasar por un chat.
 */

import { Router } from 'express'
import {
  listar, confirmar, cancelar, deshacer, idAccionSchema,
} from '../controllers/confirmacionesController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

router.use(authenticate)

router.get('/', listar)

// El id se valida como uuid antes de tocar la base: sin esto, una cadena
// cualquiera llega hasta Postgres y vuelve como un 500 en vez de un 422.
router.post('/:id/confirmar', validate(idAccionSchema), confirmar)
router.post('/:id/cancelar', validate(idAccionSchema), cancelar)
router.post('/:id/deshacer', validate(idAccionSchema), deshacer)

export default router
