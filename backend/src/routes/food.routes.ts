import { Router } from 'express'
import {
  search, barcode, detail, aportar,
  searchFoodsSchema, barcodeSchema, foodIdSchema, aporteSchema,
} from '../controllers/foodController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

// El catálogo es para gente con sesión: evita que las llamadas de FatSecret
// —que son limitadas y van a nombre de esta cuenta— queden abiertas a cualquiera.
router.use(authenticate)

/* Antes que `/:id`, que si no se lo come: para el enrutador «aportar» sería un
   identificador de alimento tan válido como cualquier otro. */
router.post('/aportar', validate(aporteSchema), aportar)

router.get('/search', validate(searchFoodsSchema), search)
router.get('/barcode/:code', validate(barcodeSchema), barcode)
router.get('/:id', validate(foodIdSchema), detail)

export default router
