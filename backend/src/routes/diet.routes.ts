import { Router } from 'express'
import {
  generateDietPlan, getDietPlans, getActiveDietPlan,
  getDietPlan, updateDietPlan, getPendingValidation,
  validateDietPlan, generateDietPlanSchema, updateDietPlanSchema,
  parseFoodList, parseFoodListSchema,
} from '../controllers/dietController'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

router.use(authenticate)

router.post('/generate', validate(generateDietPlanSchema), generateDietPlan)
router.post('/parse-food-list', validate(parseFoodListSchema), parseFoodList)
router.get('/', getDietPlans)
router.get('/active', getActiveDietPlan)
router.get('/:id', getDietPlan)
router.patch('/:id', validate(updateDietPlanSchema), updateDietPlan)

// Rutas de nutrióloga/admin
router.get('/admin/pending', authorize('nutritionist', 'admin'), getPendingValidation)
router.post('/:id/validate', authorize('nutritionist', 'admin'), validateDietPlan)

export default router
