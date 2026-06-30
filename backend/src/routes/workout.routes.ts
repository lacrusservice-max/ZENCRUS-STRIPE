import { Router } from 'express'
import {
  generateWorkoutRoutine, getWorkoutRoutines, getActiveRoutine,
  getWorkoutRoutine, generateWorkoutSchema,
} from '../controllers/workoutController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

router.use(authenticate)

router.post('/generate', validate(generateWorkoutSchema), generateWorkoutRoutine)
router.get('/', getWorkoutRoutines)
router.get('/active', getActiveRoutine)
router.get('/:id', getWorkoutRoutine)

export default router
