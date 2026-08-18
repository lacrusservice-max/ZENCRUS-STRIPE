/**
 * ALTA DE PLATILLOS POR DESCOMPOSICIÓN — §4, nivel 4
 *
 * ⚠️ ESTAS PRUEBAS ESCRIBEN EN EL CATÁLOGO COMÚN ⚠️
 *
 * `foods` no tiene `user_id`: lo que se cree aquí lo ve TODO el mundo en el
 * buscador. No hay fecha centinela que valga y la regla de las otras suites no
 * sirve, así que esta tiene la suya:
 *
 *   Todo platillo que creen estas pruebas se llama `t_…`, y al terminar se
 *   borra por id — receta, nutrientes, porciones y ficha, en ese orden.
 *
 * `limpiar()` barre además cualquier `t_…` que sobreviva a un fallo a mitad.
 *
 * ── Qué se está comprobando de verdad ──────────────────────────────────────
 * Que los números del platillo salgan de SUMAR sus ingredientes y no de lo que
 * el modelo recuerde. Por eso el caso principal no se conforma con que el alta
 * funcione: recalcula a mano lo que debería dar y lo compara.
 */

import { supabase } from '../src/config/supabase'
import { componerPlatillo, esFallo } from '../src/services/descomposicion'
import { searchCatalog, getCatalogFoodById } from '../src/services/catalogService'
import { ok, igual, seccion } from './apoyo'

/** Borra un platillo de prueba y todo lo que cuelga de él. */
async function borrarPlatillo(foodId: string): Promise<void> {
  await supabase.from('food_recipes').delete().eq('food_id', foodId)
  await supabase.from('food_nutrients').delete().eq('food_id', foodId)
  await supabase.from('food_portions').delete().eq('food_id', foodId)
  await supabase.from('foods').delete().eq('id', foodId)
}

export async function pruebasDeDescomposicion(): Promise<void> {
  seccion('§4 · Alta por descomposición')

  // Dos ingredientes de verdad del catálogo. Se buscan en vez de escribir sus
  // ids: los ids cambian entre importaciones y una prueba clavada a un uuid
  // deja de probar nada en cuanto alguien recarga el catálogo.
  const arroz = (await searchCatalog('arroz', 5))[0]
  const pollo = (await searchCatalog('pollo', 5))[0]
  ok(!!arroz && !!pollo, 'hay ingredientes en el catálogo para componer')
  if (!arroz || !pollo) return

  const NOMBRE = 't_platillo de prueba zencrus'
  const creados: string[] = []

  // ── Lo que no debe crearse ────────────────────────────────────────────────

  const uno = await componerPlatillo(NOMBRE, [{ food_id: arroz.id, gramos: 100 }])
  ok(esFallo(uno), 'un solo ingrediente no es un platillo')

  const fantasma = await componerPlatillo(NOMBRE, [
    { food_id: arroz.id, gramos: 100 },
    { food_id: '00000000-0000-4000-8000-00000000dead', gramos: 50 },
  ])
  ok(esFallo(fantasma), 'un ingrediente que no existe se rechaza')
  ok(esFallo(fantasma) && /no encuentro/i.test(fantasma.error), 'y se dice cuál')

  const repetido = await componerPlatillo(NOMBRE, [
    { food_id: arroz.id, gramos: 100 },
    { food_id: arroz.id, gramos: 50 },
  ])
  ok(esFallo(repetido), 'el mismo ingrediente dos veces se rechaza')

  const negativo = await componerPlatillo(NOMBRE, [
    { food_id: arroz.id, gramos: 100 },
    { food_id: pollo.id, gramos: -5 },
  ])
  ok(esFallo(negativo), 'unos gramos imposibles se rechazan')

  /**
   * El error clásico del modelo: dar los gramos de UNA ración en lugar de los
   * de la receta entera, o al revés. El resultado se dispara y hay que pararlo
   * antes de que entre al catálogo de todos.
   */
  const disparatado = await componerPlatillo(NOMBRE, [
    { food_id: arroz.id, gramos: 1 },
    { food_id: pollo.id, gramos: 1 },
  ])
  const per100Malo = esFallo(disparatado) ? null : disparatado.per100.calories
  ok(
    esFallo(disparatado) || (per100Malo! >= 15 && per100Malo! <= 800),
    'un cálculo fuera de rango no entra al catálogo',
  )
  if (!esFallo(disparatado)) creados.push(disparatado.foodId)

  // ── El alta buena ─────────────────────────────────────────────────────────

  const receta = [
    { food_id: arroz.id, gramos: 150 },
    { food_id: pollo.id, gramos: 120 },
  ]
  const alta = await componerPlatillo(NOMBRE, receta, 270)
  ok(!esFallo(alta), 'se da de alta el platillo', esFallo(alta) ? alta.error : undefined)
  if (esFallo(alta)) return
  creados.push(alta.foodId)

  igual(alta.creado, true, 'consta como creado ahora')
  igual(alta.porcionG, 270, 'con la ración que se le dijo')
  igual(alta.receta.length, 2, 'y devuelve su receta')

  /**
   * La aserción que importa: los números son la suma de los ingredientes.
   *
   * Si esto pasa, el modelo no pudo haber inventado las calorías — porque el
   * cálculo cuadra con lo que dice el catálogo de cada ingrediente.
   */
  const fa = await getCatalogFoodById(arroz.id)
  const fp = await getCatalogFoodById(pollo.id)
  const esperadas = Math.round(
    ((fa!.per100.calories * 150) / 100 + (fp!.per100.calories * 120) / 100) * (100 / 270),
  )
  igual(alta.per100.calories, esperadas, 'las kcal por 100 g son EXACTAMENTE la suma de los ingredientes')

  // ── Cómo queda en la base ─────────────────────────────────────────────────

  const { data: ficha } = await supabase
    .from('foods').select('name, kind, verified, source:food_sources(code)')
    .eq('id', alta.foodId).maybeSingle()
  igual(ficha?.verified, false, 'nace SIN verificar: está calculado, no medido')
  igual((ficha?.source as any)?.code, 'calculado', 'y con la fuente «calculado» del §4')

  const { data: guardada } = await supabase
    .from('food_recipes').select('ingrediente_id, gramos').eq('food_id', alta.foodId).order('seq')
  igual(guardada?.length, 2, 'la receta queda guardada')
  igual(Number(guardada?.[0]?.gramos), 150, 'con los gramos de cada ingrediente')
  ok(
    (guardada ?? []).some(r => r.ingrediente_id === arroz.id),
    'y apuntando al ingrediente real, que es lo que permite recalcular si se corrige',
  )

  // ── Sin duplicados ────────────────────────────────────────────────────────

  const otraVez = await componerPlatillo(NOMBRE, receta, 270)
  ok(!esFallo(otraVez), 'pedirlo otra vez no falla')
  if (!esFallo(otraVez)) {
    igual(otraVez.creado, false, 'pero NO crea un segundo')
    igual(otraVez.foodId, alta.foodId, 'devuelve el que ya estaba')
  }

  const { count } = await supabase
    .from('foods').select('id', { count: 'exact', head: true }).eq('name', NOMBRE)
  igual(count, 1, 'y en el catálogo hay exactamente uno')

  // ── El efecto red del §4 ──────────────────────────────────────────────────
  // De esto va todo: el siguiente que lo busque tiene que encontrarlo.

  const buscado = await searchCatalog('t_platillo de prueba zencrus', 5)
  ok(buscado.some(f => f.id === alta.foodId), 'el platillo nuevo YA aparece en el buscador')

  for (const id of creados) await borrarPlatillo(id)
  const { count: quedan } = await supabase
    .from('foods').select('id', { count: 'exact', head: true }).like('name', 't\\_%')
  igual(quedan, 0, 'no queda ningún platillo de prueba en el catálogo común')
}
