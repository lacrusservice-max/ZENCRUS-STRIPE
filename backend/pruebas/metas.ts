/**
 * PUT /users/profile — LAS METAS SE GUARDAN
 *
 * Estas pruebas existen por un fallo que no dio la cara en ningún sitio.
 * `goals` es una columna JSONB y NO estaba en el schema de validación. El
 * middleware reemplaza el cuerpo con lo que Zod devuelve, y Zod quita lo que no
 * conoce, así que `goals` se caía antes de llegar al controlador y el update se
 * guardaba sin ella.
 *
 * La pantalla de Metas de energía decía «guardado» y volvía atrás. El ajuste
 * semanal de Nutrición, igual. Al reabrir la app los valores estaban otra vez en
 * el derivado por defecto — meta 2.000, piso 1.700— y parecían los tuyos.
 * Ningún error, ni en el móvil ni en el log.
 *
 * Un fallo así no lo caza mirar la pantalla ni comprobar que el PUT da 200:
 * daba 200 mientras tiraba las metas. Hay que RELEER y comparar.
 *
 * La regla que fijan: lo que se manda en `goals` se guarda, lo incoherente se
 * rechaza con 422, y las claves que escriben otras partes no se pisan.
 */

import request from 'supertest'
import userRoutes from '../src/routes/user.routes'
import { USUARIO, montar, token, ok, igual, seccion } from './apoyo'

const app = montar('/users', userRoutes)
const yo = `Bearer ${token(USUARIO)}`

const leerMetas = async () =>
  (await request(app).get('/users/profile').set('Authorization', yo)).body?.data?.goals ?? {}

const guardar = (goals: Record<string, unknown>) =>
  request(app).put('/users/profile').set('Authorization', yo).send({ goals })

export async function pruebasDeMetas(): Promise<void> {
  seccion('Metas de energía · piso, meta y techo')

  const original = await leerMetas()

  try {
    // ── Lo esencial: que sobrevivan al viaje ───────────────────────────────
    const r = await guardar({ ...original, calories_target: 2222, calories_min: 1888, calories_max: 2555 })
    igual(r.status, 200, 'guardar las metas responde 200')

    const g = await leerMetas()
    igual(g.calories_target, 2222, 'la meta se guarda de verdad')
    igual(g.calories_min, 1888, 'el piso se guarda de verdad')
    igual(g.calories_max, 2555, 'el techo se guarda de verdad')

    // ── Y que no se lleven por delante lo de otras partes ──────────────────
    if (original.main_goal !== undefined) {
      igual(g.main_goal, original.main_goal, 'main_goal sigue intacto tras escribir las metas')
    }

    // ── Piso ≤ meta ≤ techo, y lo comprueba el servidor ────────────────────
    // Se valida aquí y no solo en la pantalla porque la pantalla no es el único
    // cliente: el ajuste semanal escribe contra este mismo endpoint, y ZENA
    // puede proponer metas desde el chat.
    const pisoAlto = await guardar({ ...original, calories_target: 2000, calories_min: 2400 })
    igual(pisoAlto.status, 422, 'un piso por encima de la meta se rechaza')

    const techoBajo = await guardar({ ...original, calories_target: 2000, calories_max: 1800 })
    igual(techoBajo.status, 422, 'un techo por debajo de la meta se rechaza')

    // ── Y los disparates sueltos ───────────────────────────────────────────
    const enorme = await guardar({ ...original, calories_target: 99999 })
    igual(enorme.status, 422, 'una meta de 99.999 kcal se rechaza')

    const negativa = await guardar({ ...original, calories_max: -100 })
    igual(negativa.status, 422, 'un techo negativo se rechaza')

    // ── El caso legítimo de los tres iguales ───────────────────────────────
    // Quien quiere clavar una cifra exacta pone piso = meta = techo. Es raro,
    // pero no es incoherente, y rechazarlo sería inventarse una regla.
    const clavado = await guardar({ ...original, calories_target: 2100, calories_min: 2100, calories_max: 2100 })
    igual(clavado.status, 200, 'piso = meta = techo es válido')

    // ── Sin token no se toca nada ──────────────────────────────────────────
    const sinToken = await request(app).put('/users/profile').send({ goals: { calories_target: 1234 } })
    igual(sinToken.status, 401, 'sin token no se guardan metas')

    const tras = await leerMetas()
    ok(tras.calories_target !== 1234, 'y el intento anónimo no dejó rastro')

  } finally {
    // Se deja exactamente como estaba, pase lo que pase por el camino.
    await guardar(original).catch(() => {})
  }
}
