/**
 * SEGUIMIENTO DEL USUARIO
 * ───────────────────────
 * Las siete tablas de la migración 012 bajo un mismo prefijo: peso y medidas,
 * hábitos, actividad diaria, ciclado de macros, plan de comidas y metas. Todo
 * lo que alguien registra sobre sí mismo y que hasta ahora vivía únicamente en
 * el AsyncStorage de su teléfono.
 */

import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

import {
  obtenerMediciones, obtenerUltima, registrarMedicion, registrarLoteMediciones,
  actualizarMedicion, eliminarMedicion,
  rangoMedicionesSchema, registrarMedicionSchema, registrarLoteSchema,
  actualizarMedicionSchema, idMedicionSchema,
} from '../controllers/bodyMetricsController'

import {
  listarHabitos, crearHabito, actualizarHabito, eliminarHabito,
  marcarHabito, registrarLogs,
  listarHabitosSchema, crearHabitoSchema, actualizarHabitoSchema,
  llaveHabitoSchema, marcarHabitoSchema, registrarLogsSchema,
} from '../controllers/habitsController'

import {
  obtenerActividad, marcarActividad, registrarLoteActividad,
  rangoActividadSchema, marcarActividadSchema, registrarLoteActividadSchema,
} from '../controllers/activityController'

import {
  obtenerCiclo, guardarCiclo, obtenerPlanSemana, guardarPlanSemana,
  guardarCicloSchema, semanaSchema, guardarPlanSchema,
} from '../controllers/planningController'

import {
  listarMetas, crearMeta, actualizarMeta, eliminarMeta,
  listarMetasSchema, crearMetaSchema, actualizarMetaSchema, idMetaSchema,
} from '../controllers/goalsController'

const router = Router()

// Lo que alguien pesa, mide o se propone es suyo y de nadie más: todo pasa por
// sesión, y cada consulta lleva además su `eq('user_id', …)` dentro del
// controlador. Sin ese segundo filtro, un id ajeno adivinado bastaría.
router.use(authenticate)

// ── Peso y medidas ───────────────────────────────────────────────────────────
// `/latest` va antes que nada por costumbre: hoy no colisiona con ningún
// parámetro, pero en cuanto exista `/body/:id` el orden deja de ser indiferente.
router.get('/body/latest', obtenerUltima)
router.get('/body', validate(rangoMedicionesSchema), obtenerMediciones)
router.post('/body/batch', validate(registrarLoteSchema), registrarLoteMediciones)
router.post('/body', validate(registrarMedicionSchema), registrarMedicion)
router.patch('/body/:id', validate(actualizarMedicionSchema), actualizarMedicion)
router.delete('/body/:id', validate(idMedicionSchema), eliminarMedicion)

// ── Hábitos ──────────────────────────────────────────────────────────────────
router.get('/habits', validate(listarHabitosSchema), listarHabitos)
router.post('/habits/logs/batch', validate(registrarLogsSchema), registrarLogs)
router.post('/habits', validate(crearHabitoSchema), crearHabito)
router.put('/habits/:key/log/:fecha', validate(marcarHabitoSchema), marcarHabito)
router.patch('/habits/:key', validate(actualizarHabitoSchema), actualizarHabito)
router.delete('/habits/:key', validate(llaveHabitoSchema), eliminarHabito)

// ── Actividad diaria y rachas ────────────────────────────────────────────────
router.get('/activity', validate(rangoActividadSchema), obtenerActividad)
router.post('/activity/batch', validate(registrarLoteActividadSchema), registrarLoteActividad)
router.put('/activity/:fecha', validate(marcarActividadSchema), marcarActividad)

// ── Ciclado de macros ────────────────────────────────────────────────────────
router.get('/macro-cycle', obtenerCiclo)
router.put('/macro-cycle', validate(guardarCicloSchema), guardarCiclo)

// ── Plan de comidas ──────────────────────────────────────────────────────────
router.get('/meal-plan/:semana', validate(semanaSchema), obtenerPlanSemana)
router.put('/meal-plan/:semana', validate(guardarPlanSchema), guardarPlanSemana)

// ── Metas ────────────────────────────────────────────────────────────────────
router.get('/goals', validate(listarMetasSchema), listarMetas)
router.post('/goals', validate(crearMetaSchema), crearMeta)
router.patch('/goals/:id', validate(actualizarMetaSchema), actualizarMeta)
router.delete('/goals/:id', validate(idMetaSchema), eliminarMeta)

export default router
