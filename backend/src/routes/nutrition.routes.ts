import { Router } from 'express'
import {
  obtenerDia, obtenerRango, registrarEntrada, registrarLote,
  actualizarEntrada, eliminarEntrada, restaurarEntrada, guardarDia,
  diaSchema, rangoSchema, registrarEntradaSchema, registrarLoteSchema,
  actualizarEntradaSchema, idEntradaSchema, guardarDiaSchema,
} from '../controllers/nutritionController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

// Lo que alguien come es suyo y de nadie más: todo pasa por sesión, y cada
// consulta lleva además su `eq('user_id', …)` dentro del controlador.
router.use(authenticate)

// El rango va ANTES que /day/:fecha aunque no colisionen hoy: en cuanto
// aparezca /day/latest o similar, el orden deja de ser indiferente.
router.get('/range', validate(rangoSchema), obtenerRango)
router.get('/day/:fecha', validate(diaSchema), obtenerDia)
router.put('/day/:fecha', validate(guardarDiaSchema), guardarDia)

router.post('/entries', validate(registrarEntradaSchema), registrarEntrada)
router.post('/entries/batch', validate(registrarLoteSchema), registrarLote)
router.patch('/entries/:id', validate(actualizarEntradaSchema), actualizarEntrada)
router.delete('/entries/:id', validate(idEntradaSchema), eliminarEntrada)
router.post('/entries/:id/restore', validate(idEntradaSchema), restaurarEntrada)

export default router
