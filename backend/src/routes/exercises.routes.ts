/**
 * BIBLIOTECA DE EJERCICIOS · RUTAS
 * ────────────────────────────────
 * Exigen sesión como el resto de la app, pero no comprueban nada más: el
 * catálogo es idéntico para todo el mundo. Aquí no hay nada de `socialAccess`
 * porque no hay nada que decidir sobre quién pregunta.
 *
 * `/filters` va ANTES que `/:slug`, o se buscaría un ejercicio llamado
 * «filters» y siempre daría 404.
 */

import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'
import {
  listExercises, listSchema, getExercise, getFilters,
  getPosters, postersSchema,
  entrenamientoRapido, rapidoSchema, opcionesRapidas,
} from '../controllers/exerciseLibraryController'

const router = Router()

router.use(authenticate)

router.get('/filters', getFilters)
// Antes que `/:slug`, o buscaría ejercicios llamados «quick» y «quick-options».
router.get('/quick/options', opcionesRapidas)
router.get('/quick', validate(rapidoSchema), entrenamientoRapido)
router.get('/posters', validate(postersSchema), getPosters)
router.get('/', validate(listSchema), listExercises)
router.get('/:slug', getExercise)

export default router
