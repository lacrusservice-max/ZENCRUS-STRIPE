/**
 * /foods/search — QUÉ SIGNIFICA UNA LISTA VACÍA
 *
 * Estas pruebas existen por un fallo concreto: buscar cualquier cosa que el
 * catálogo propio no tuviera devolvía 503 «el catálogo de alimentos no está
 * disponible», incluso con 2.855 alimentos contestando perfectamente. La app
 * lo leía como caída, se iba a su lista local de básicos y enseñaba «lo más
 * parecido» con un aviso de avería.
 *
 * El daño de verdad no era el mensaje: al no llegar la lista, ZENA se quedaba
 * sin candidatos que dar de alta y el camino del §4 —el alimento que alguien
 * pide una vez queda en el catálogo para todos— no llegaba a arrancar nunca.
 *
 * La regla que fijan: **vacío es una respuesta**. El 503 se reserva para
 * cuando el catálogo propio no conteste.
 */

import request from 'supertest'
import foodRoutes from '../src/routes/food.routes'
import { USUARIO, montar, token, ok, igual, seccion } from './apoyo'

const app = montar('/foods', foodRoutes)
const yo = `Bearer ${token(USUARIO)}`

const buscar = (q: string) =>
  request(app).get('/foods/search').query({ q }).set('Authorization', yo)

export async function pruebasDeCatalogo(): Promise<void> {
  seccion('Catálogo · buscar')

  igual((await request(app).get('/foods/search').query({ q: 'pollo' })).status, 401, 'sin token no se busca')

  const conocido = await buscar('mole')
  igual(conocido.status, 200, 'un alimento que sí está devuelve 200')
  ok(Array.isArray(conocido.body.data) && conocido.body.data.length > 0, 'y trae resultados')

  /**
   * El caso que rompía. No existe en ninguna base del mundo, así que la
   * respuesta correcta es «buscamos y no está» — no «estamos rotos».
   */
  const inventado = await buscar('zzzqqxxwww')
  igual(inventado.status, 200, 'lo que no existe NO devuelve 503')
  igual(inventado.body.success, true, 'la búsqueda se considera hecha')
  igual(inventado.body.data, [], 'y su resultado es una lista vacía')

  /**
   * Un platillo mexicano compuesto que el catálogo propio no tiene. Hoy sale
   * vacío porque no hay fuente externa enchufada; lo que se fija aquí es que
   * eso llegue como lista vacía y no como avería, que es lo que le permite a
   * ZENA intentar darlo de alta en vez de rendirse.
   */
  const compuesto = await buscar('cochinita pibil')
  igual(compuesto.status, 200, 'un platillo que falta tampoco es una caída')
  ok(Array.isArray(compuesto.body.data), 'llega una lista, aunque venga vacía')
}
