import { Router } from 'express'
import {
  search, barcode, detail,
  searchFoodsSchema, barcodeSchema, foodIdSchema,
} from '../controllers/foodController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

// El catálogo es para gente con sesión: evita que las llamadas de FatSecret
// —que son limitadas y van a nombre de esta cuenta— queden abiertas a cualquiera.
router.use(authenticate)

router.get('/search', validate(searchFoodsSchema), search)
router.get('/barcode/:code', validate(barcodeSchema), barcode)
router.get('/:id', validate(foodIdSchema), detail)

export default router
