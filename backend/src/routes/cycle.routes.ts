/**
 * CICLO MENSTRUAL · LA PUERTA
 * ═══════════════════════════════════════════════════════════════════════════
 * Todas las rutas del módulo bajo un único prefijo y un único cerrojo.
 *
 * ── Por qué 404 y nunca 403 ────────────────────────────────────────────────
 * Un 403 dice «esto existe y no es para ti». Aplicado a un módulo de ciclo
 * menstrual, eso convierte la API en un oráculo: cualquiera con un token puede
 * preguntar por una cuenta ajena y deducir del código de respuesta si esa
 * persona lleva un registro de ciclo. Para la decisión de producto —que la
 * función sea invisible, no bloqueada— el 403 la delata igual de bien que
 * enseñar el botón.
 *
 * Por eso el cerrojo responde con el MISMO `notFound` que cualquier ruta
 * inexistente: mismo código, mismo cuerpo, misma frase con la URL dentro. Desde
 * fuera, `/api/cycle` para una cuenta sin el módulo es indistinguible de una
 * ruta que nunca se escribió.
 *
 * ── Y por qué el cerrojo está aquí ─────────────────────────────────────────
 * En un solo sitio, no repetido en cada handler. Copiado en diez controladores,
 * el undécimo que se añada nace abierto. Con `router.use()` antes de las rutas,
 * el endpoint nuevo nace cerrado.
 */

import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { notFound } from '../middleware/errorHandler'
import { cicloActivo } from '../services/accesoCiclo'

import {
  obtenerCiclo, guardarPerfil, registrarLog, borrarLog, registrarLote,
  declararInicio, quitarInicio, guardarPrediccion, borrarTodo,
  rangoSchema, guardarPerfilSchema, registrarSchema, borrarSchema, loteSchema,
  declararSchema, fechaSchema, prediccionSchema,
} from '../controllers/cycleController'

const router = Router()

/**
 * El cerrojo. La regla vive en `services/accesoCiclo.ts`, no aquí.
 *
 * Antes había una lista de correos de pruebas duplicada a mano en el cliente,
 * con un comentario pidiendo vaciar las dos a la vez. Se quedó puesta, y con
 * ella el módulo solo existía para una cuenta: la primera mujer que se dio de
 * alta no lo vio nunca.
 */
async function exigirCiclo(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (await cicloActivo(req.user!.userId, req.user?.email)) {
    next()
    return
  }
  notFound(req, res)
}

// Sin token no hay nada. El 401 va ANTES del cerrojo a propósito: quien no ha
// iniciado sesión no está preguntando por nadie en concreto.
router.use(authenticate)
router.use(exigirCiclo)

// ── Todo el ciclo de una vez ─────────────────────────────────────────────────
router.get('/', validate(rangoSchema), obtenerCiclo)

// ── Perfil ───────────────────────────────────────────────────────────────────
router.put('/profile', validate(guardarPerfilSchema), guardarPerfil)

// ── Registros ────────────────────────────────────────────────────────────────
// El lote va antes que las rutas con parámetros: `/logs/batch` y
// `/logs/:fecha/:kind` no colisionan hoy por número de segmentos, pero el orden
// deja de ser indiferente en cuanto exista un `/logs/:algo`.
router.post('/logs/batch', validate(loteSchema), registrarLote)
router.put('/logs/:fecha/:kind', validate(registrarSchema), registrarLog)
router.delete('/logs/:fecha/:kind', validate(borrarSchema), borrarLog)

// ── Inicios declarados a mano ────────────────────────────────────────────────
router.post('/periods', validate(declararSchema), declararInicio)
router.delete('/periods/:fecha', validate(fechaSchema), quitarInicio)

// ── Predicción calculada en el cliente ───────────────────────────────────────
router.put('/prediction', validate(prediccionSchema), guardarPrediccion)

// ── El borrado de verdad ─────────────────────────────────────────────────────
router.delete('/', borrarTodo)

export default router
