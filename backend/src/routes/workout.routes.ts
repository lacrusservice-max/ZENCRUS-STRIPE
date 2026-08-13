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
import {
  listarProgramas, detalleProgama, inscribirse, inscribirSchema,
  miInscripcion, diaDeHoy, fijarPeso, fijarSchema, abandonar,
  cambiarEjercicio, cambiarSchema, alternativasDePlan, queTocaHoy,
  guardarPlan, guardarPlanSchema, borrarPlan,
  proponerEjercicios, proponerSchema, listarMusculos,
} from '../controllers/programController'
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

// ── La portada de Entrena ────────────────────────────────────────────────────
// Antes que `/:id`, o buscaría una rutina llamada «today».
router.get('/today', queTocaHoy)

// ── El planificador semanal ──────────────────────────────────────────────────
// `/plan/...` y no `/programs/...` a propósito: esto no consulta ni toca ningún
// programa, solo traduce «pecho y tríceps» en una lista de ejercicios. Colgarlo
// de `/programs` habría hecho creer que hace falta tener uno para preguntarlo.
router.get('/plan/musculos', listarMusculos)
router.get('/plan/propuesta', validate(proponerSchema), proponerEjercicios)

// ── Programas de varias semanas ──────────────────────────────────────────────
// `/programs/mine/…` va ANTES que `/programs/:id`, o se buscaría un programa
// con identificador «mine» y siempre daría 404. Mismo tropiezo que `/filters`
// en la biblioteca y que `/sessions/active` aquí arriba.
router.get('/programs/mine/enrollment', miInscripcion)
router.get('/programs/mine/today', diaDeHoy)
router.post('/programs/mine/override', validate(fijarSchema), fijarPeso)
router.post('/programs/mine/swap', validate(cambiarSchema), cambiarEjercicio)
router.get('/programs/mine/alternatives/:planKey', alternativasDePlan)
router.post('/programs/mine/abandon', abandonar)
router.get('/programs', listarProgramas)
router.post('/programs', validate(guardarPlanSchema), guardarPlan)
router.get('/programs/:id', detalleProgama)
router.put('/programs/:id', validate(guardarPlanSchema), guardarPlan)
router.delete('/programs/:id', borrarPlan)
router.post('/programs/:id/enroll', validate(inscribirSchema), inscribirse)

// ── Rutinas (el plan) ────────────────────────────────────────────────────────
router.post('/generate', validate(generateWorkoutSchema), generateWorkoutRoutine)
router.get('/active', getActiveRoutine)
router.get('/', getWorkoutRoutines)
router.get('/:id', getWorkoutRoutine)

export default router
