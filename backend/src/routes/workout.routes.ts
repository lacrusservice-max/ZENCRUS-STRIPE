/**
 * ENTRENAMIENTO · RUTAS
 * ─────────────────────
 * Dos cosas distintas comparten prefijo y conviene no confundirlas:
 *
 *   · `/workout` y `/workout/:id` son las RUTINAS — el plan, lo que se pretende
 *     hacer. Las genera la IA y se editan.
 *   · `/workout/sessions/…` son las SESIONES — lo que de verdad se hizo, serie
 *     a serie. De aquí salen las estadísticas y los récords.
 *
 * EL ORDEN IMPORTA. `/:id` está al final a propósito: si estuviera antes,
 * `/workout/sessions` entraría por ahí y el servidor se pondría a buscar una
 * rutina llamada «sessions», que siempre da 404. Es el mismo tropiezo que ya
 * costó una vez en la biblioteca con `/filters` y `/:slug`.
 */

import { Router } from 'express'
import {
  generateWorkoutRoutine, getWorkoutRoutines, getActiveRoutine,
  getWorkoutRoutine, generateWorkoutSchema,
} from '../controllers/workoutController'
import {
  abrirSesion, abrirSchema,
  sesionActiva, listarSesiones, listarSchema, detalleSesion,
  registrarSerie, serieSchema, borrarSerie,
  cerrarSesion, cerrarSchema, descartarSesion,
  listarRecords, historialEjercicio, historialEjercicioSchema,
} from '../controllers/workoutSessionController'
import {
  resumen, porMusculo, volumenPorSemana, ejerciciosMasHechos, curvaEjercicio,
  porDia, ventanaSchema, curvaSchema, diasSchema,
} from '../controllers/workoutStatsController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

router.use(authenticate)

// ── Sesiones (lo realizado) ──────────────────────────────────────────────────
// `/sessions/active` va antes que `/sessions/:id`, o buscaría una sesión con
// identificador «active».
router.post('/sessions', validate(abrirSchema), abrirSesion)
router.get('/sessions/active', sesionActiva)
router.get('/sessions', validate(listarSchema), listarSesiones)
router.get('/sessions/:id', detalleSesion)
router.post('/sessions/:id/sets', validate(serieSchema), registrarSerie)
router.delete('/sessions/:id/sets/:setId', borrarSerie)
router.post('/sessions/:id/finish', validate(cerrarSchema), cerrarSesion)
router.post('/sessions/:id/discard', descartarSesion)

// ── Récords e historial por ejercicio ────────────────────────────────────────
router.get('/records', listarRecords)
router.get('/exercise-history/:key', validate(historialEjercicioSchema), historialEjercicio)

// ── Estadísticas ─────────────────────────────────────────────────────────────
router.get('/stats/summary', validate(ventanaSchema), resumen)
router.get('/stats/muscles', validate(ventanaSchema), porMusculo)
router.get('/stats/volume', validate(ventanaSchema), volumenPorSemana)
router.get('/stats/days', validate(diasSchema), porDia)
router.get('/stats/exercises', validate(ventanaSchema), ejerciciosMasHechos)
router.get('/stats/curve/:key', validate(curvaSchema), curvaEjercicio)

// ── Rutinas (el plan) ────────────────────────────────────────────────────────
router.post('/generate', validate(generateWorkoutSchema), generateWorkoutRoutine)
router.get('/active', getActiveRoutine)
router.get('/', getWorkoutRoutines)
router.get('/:id', getWorkoutRoutine)

export default router
