/**
 * EL FLUJO DE CONFIRMACIÓN DE PUNTA A PUNTA — §10
 *
 * Lo que se está comprobando aquí, por encima de cada aserción suelta, es una
 * sola frase: ZENA no escribe. Propone, y escribe el usuario.
 *
 * Las tres herramientas de riesgo alto se ejercitan por su camino real —el que
 * recorre `executeAiTool` cuando el modelo las pide— y las respuestas del
 * usuario van por HTTP, con `authenticate` y `validate` delante, que es como
 * llegan desde el teléfono.
 *
 * ── Por qué los números salen de una cuenta y no están escritos ─────────────
 * Los límites del §12 se miden contra el metabolismo del usuario de pruebas, y
 * ese usuario es real: pesa lo que pesa hoy y otra cosa dentro de un mes. Un
 * «1.800 kcal» escrito a mano pasaría hoy y fallaría en cuanto él se pese, así
 * que las calorías de las pruebas se calculan desde su gasto real.
 *
 * ⚠️ `users.goals` es UNA columna de UNA fila y esto la escribe. `apoyo` la
 * guarda antes y la devuelve al terminar; si se añade un caso que la toque por
 * otro camino, esa red sigue siendo la única que hay.
 */

import request from 'supertest'
import confirmacionesRoutes from '../src/routes/confirmaciones.routes'
import { supabase } from '../src/config/supabase'
import { prepararAccion } from '../src/services/confirmaciones'
import { executeAiTool } from '../src/services/aiTools'
import { perfilClinicoDe, gastoTotal } from '../src/services/limitesClinicos'
import {
  USUARIO, INTRUSO, montar, token, ok, igual, seccion, limpiar, guardarGoals,
} from './apoyo'

const app = montar('/confirmaciones', confirmacionesRoutes)
const yo = `Bearer ${token(USUARIO)}`
const otro = `Bearer ${token(INTRUSO)}`

const get = (url: string, auth = yo) => request(app).get(url).set('Authorization', auth)
const post = (url: string, auth = yo) => request(app).post(url).set('Authorization', auth)

const leerGoals = async (): Promise<Record<string, any>> => {
  const { data } = await supabase.from('users').select('goals').eq('id', USUARIO).maybeSingle()
  return (data?.goals ?? {}) as Record<string, any>
}

const escribirGoals = async (goals: Record<string, any>): Promise<void> => {
  await supabase.from('users').update({ goals }).eq('id', USUARIO)
}

/** La propuesta, o el motivo por el que no la hubo. */
async function proponer(herramienta: string, args: Record<string, any>) {
  return prepararAccion(USUARIO, herramienta, args)
}

export async function pruebasDeConfirmaciones(): Promise<void> {
  await guardarGoals()
  await limpiar()

  // Un punto de partida conocido. Se calcula desde el gasto real del usuario
  // para no chocar con los límites del §12 por casualidad.
  const perfil = await perfilClinicoDe(USUARIO)
  const gasto = gastoTotal(perfil) ?? 2200
  const BASE_KCAL = gasto
  const NUEVAS_KCAL = gasto - 150
  const PROTE = Math.round((perfil.peso ?? 75) * 2)

  await escribirGoals({ calories_target: BASE_KCAL, protein_g: PROTE, primary: 'maintenance', main_goal: 'maintain' })

  // ── Sesión ────────────────────────────────────────────────────────────────
  seccion('Confirmaciones · sesión')
  igual((await request(app).get('/confirmaciones')).status, 401, 'sin token no se entra')
  igual(
    (await request(app).post('/confirmaciones/no-es-un-uuid/confirmar').set('Authorization', yo)).status,
    422, 'un id que no es uuid se rechaza antes de tocar la base',
  )

  // ── Proponer no es escribir ───────────────────────────────────────────────
  seccion('Proponer no escribe nada')

  const p1 = await proponer('actualizar_targets_nutricionales', { calorias: NUEVAS_KCAL })
  ok(p1.ok, 'se prepara la propuesta')
  if (!p1.ok) return

  igual((await leerGoals()).calories_target, BASE_KCAL, 'las calorías siguen intactas tras proponer')

  igual(p1.accion.cambios.length, 1, 'una sola línea en la tarjeta')
  igual(p1.accion.cambios[0].antes, BASE_KCAL, 'la tarjeta trae el ANTES')
  igual(p1.accion.cambios[0].despues, NUEVAS_KCAL, 'y el DESPUÉS')
  igual(p1.accion.cambios[0].unidad, 'kcal', 'con su unidad')
  ok(
    !Object.prototype.hasOwnProperty.call(p1.accion.cambios[0], 'campos'),
    'las claves internas de la base NO viajan a la app',
  )
  ok(p1.accion.resumen.includes(String(BASE_KCAL)) && p1.accion.resumen.includes(String(NUEVAS_KCAL)),
    'el resumen es del tipo «2.100 → 1.850»')

  const vivas = await get('/confirmaciones')
  igual(vivas.status, 200, 'se listan las pendientes')
  ok(vivas.body.data.pendientes.some((a: any) => a.id === p1.accion.id), 'la propuesta aparece en la lista')

  // ── La herramienta, por su camino real ────────────────────────────────────
  seccion('Lo que ZENA lee al pedir la herramienta')

  const pendientes: any[] = []
  const dicho = await executeAiTool(
    'actualizar_targets_nutricionales', { calorias: NUEVAS_KCAL - 10 }, USUARIO, { pendientes },
  )
  igual(pendientes.length, 1, 'la herramienta deja su propuesta en el colector')
  ok(/NO APLICADA/i.test(dicho), 'al modelo se le dice que NO está aplicado')
  ok(/no digas que ya está hecho/i.test(dicho), 'y se le prohíbe expresamente decir que sí')
  igual((await leerGoals()).calories_target, BASE_KCAL, 'la herramienta tampoco escribió')
  await post(`/confirmaciones/${pendientes[0].id}/cancelar`)

  // ── Confirmar ─────────────────────────────────────────────────────────────
  seccion('Confirmar aplica y deja versión')

  const conf = await post(`/confirmaciones/${p1.accion.id}/confirmar`)
  igual(conf.status, 200, 'se confirma')
  igual((await leerGoals()).calories_target, NUEVAS_KCAL, 'AHORA sí cambiaron las calorías')

  const { data: versiones } = await supabase
    .from('plan_versions').select('*').eq('user_id', USUARIO).eq('tipo', 'targets')
    .order('created_at', { ascending: false }).limit(1)
  igual(versiones?.length, 1, 'se escribió la versión anterior')
  igual(versiones?.[0].snapshot.calories_target, BASE_KCAL, 'la versión guarda el estado PREVIO, no el nuevo')
  igual(versiones?.[0].creado_por, 'ia', 'y consta que la originó la IA')

  igual((await post(`/confirmaciones/${p1.accion.id}/confirmar`)).status, 409, 'no se puede confirmar dos veces')

  // ── Deshacer ──────────────────────────────────────────────────────────────
  seccion('Deshacer, 24 horas')

  const puedeDeshacer = await get('/confirmaciones')
  ok(
    puedeDeshacer.body.data.deshacibles.some((a: any) => a.id === p1.accion.id),
    'lo confirmado aparece como deshacible',
  )

  igual((await post(`/confirmaciones/${p1.accion.id}/deshacer`)).status, 200, 'se deshace')
  igual((await leerGoals()).calories_target, BASE_KCAL, 'las calorías vuelven a como estaban')

  const { count } = await supabase
    .from('plan_versions').select('id', { count: 'exact', head: true })
    .eq('user_id', USUARIO).eq('tipo', 'targets')
  igual(count, 2, 'deshacer AÑADE una versión, no borra la anterior')

  igual((await post(`/confirmaciones/${p1.accion.id}/deshacer`)).status, 409, 'no se deshace dos veces')

  // ── Cancelar ──────────────────────────────────────────────────────────────
  seccion('Cancelar')

  const p2 = await proponer('actualizar_targets_nutricionales', { calorias: NUEVAS_KCAL })
  ok(p2.ok, 'se prepara otra')
  if (!p2.ok) return

  igual((await post(`/confirmaciones/${p2.accion.id}/cancelar`)).status, 200, 'se cancela')
  igual((await leerGoals()).calories_target, BASE_KCAL, 'cancelar no escribe nada')
  igual((await post(`/confirmaciones/${p2.accion.id}/confirmar`)).status, 409, 'y ya no se puede confirmar')
  igual((await post(`/confirmaciones/${p2.accion.id}/deshacer`)).status, 409, 'ni deshacer algo que nunca se aplicó')

  // ── Caducidad ─────────────────────────────────────────────────────────────
  seccion('Los 15 minutos')

  const p3 = await proponer('actualizar_targets_nutricionales', { calorias: NUEVAS_KCAL })
  ok(p3.ok, 'se prepara una que va a caducar')
  if (!p3.ok) return

  await supabase.from('acciones_pendientes')
    .update({ expira_at: new Date(Date.now() - 1000).toISOString() }).eq('id', p3.accion.id)

  igual((await post(`/confirmaciones/${p3.accion.id}/confirmar`)).status, 409, 'una propuesta caducada no se aplica')
  igual((await leerGoals()).calories_target, BASE_KCAL, 'y no tocó nada')

  const { data: caducada } = await supabase
    .from('acciones_pendientes').select('estado').eq('id', p3.accion.id).maybeSingle()
  igual(caducada?.estado, 'expirada', 'queda marcada como expirada')

  ok(
    !(await get('/confirmaciones')).body.data.pendientes.some((a: any) => a.id === p3.accion.id),
    'y desaparece de las pendientes',
  )

  // ── El mundo se movió ─────────────────────────────────────────────────────
  seccion('Si los datos cambian por detrás')

  const p4 = await proponer('actualizar_targets_nutricionales', { calorias: NUEVAS_KCAL })
  ok(p4.ok, 'se prepara con las calorías de ahora')
  if (!p4.ok) return

  // El usuario las cambia a mano desde Perfil mientras la tarjeta sigue en
  // pantalla. El «antes» de la tarjeta ya no describe nada.
  await escribirGoals({ ...(await leerGoals()), calories_target: BASE_KCAL - 42 })

  igual(
    (await post(`/confirmaciones/${p4.accion.id}/confirmar`)).status, 409,
    'no se aplica una propuesta calculada sobre datos viejos',
  )
  igual((await leerGoals()).calories_target, BASE_KCAL - 42, 'se respeta lo que puso el usuario')
  await escribirGoals({ ...(await leerGoals()), calories_target: BASE_KCAL })

  // ── Los límites del §12 ───────────────────────────────────────────────────
  seccion('Los límites clínicos, antes de la tarjeta')

  const absurdo = await proponer('actualizar_targets_nutricionales', { calorias: 400 })
  ok(!absurdo.ok, '400 kcal se rechaza')
  ok(!absurdo.ok && /no puedo fijar/i.test(absurdo.motivo), 'y explica por qué, en palabras de ZENA')

  const { count: propuestas } = await supabase
    .from('acciones_pendientes').select('id', { count: 'exact', head: true })
    .eq('user_id', USUARIO).eq('estado', 'pendiente')
  igual(propuestas, 0, 'un rechazo clínico no deja tarjeta que confirmar')

  const nada = await proponer('actualizar_targets_nutricionales', { calorias: BASE_KCAL })
  ok(!nada.ok, 'pedir lo que ya está puesto no es un cambio')

  // ── Una línea, dos claves ─────────────────────────────────────────────────
  seccion('Objetivo')

  const p5 = await proponer('actualizar_objetivo', { objetivo: 'ganar_musculo' })
  ok(p5.ok, 'se prepara el cambio de objetivo')
  if (!p5.ok) return

  igual(p5.accion.cambios.length, 1, 'el usuario ve UNA línea')
  igual(p5.accion.cambios[0].antes, 'Mantenerme', 'con el objetivo viejo en castellano')
  igual(p5.accion.cambios[0].despues, 'Ganar músculo', 'y el nuevo')

  igual((await post(`/confirmaciones/${p5.accion.id}/confirmar`)).status, 200, 'se confirma')
  const trasObjetivo = await leerGoals()
  igual(trasObjetivo.primary, 'muscle_gain', 'se escribió `primary`')
  igual(trasObjetivo.main_goal, 'gain_muscle', 'y también `main_goal`, que el usuario nunca vio')

  igual((await post(`/confirmaciones/${p5.accion.id}/deshacer`)).status, 200, 'se deshace')
  const desObjetivo = await leerGoals()
  igual(desObjetivo.primary, 'maintenance', 'vuelve `primary`')
  igual(desObjetivo.main_goal, 'maintain', 'y vuelve `main_goal`: las dos claves de la misma línea')

  /**
   * El objetivo tal como está escrito en la base de verdad.
   *
   * Las tres cuentas que existen hoy tienen `gain_muscle` o `lose_weight`, que
   * los escribe el onboarding y no coinciden con el tipo `UserGoal`. Con solo
   * el vocabulario declarado, la tarjeta enseñaba «— → …» a todo el mundo: o
   * sea, le decía a alguien con objetivo que no tenía ninguno.
   */
  await escribirGoals({ ...(await leerGoals()), primary: 'gain_muscle' })
  const p5b = await proponer('actualizar_objetivo', { objetivo: 'perder_grasa' })
  ok(p5b.ok, 'se prepara sobre el vocabulario del onboarding')
  if (!p5b.ok) return
  igual(p5b.accion.cambios[0].antes, 'Ganar músculo', 'el objetivo que hay en la base SÍ se sabe nombrar')
  await post(`/confirmaciones/${p5b.accion.id}/cancelar`)

  await escribirGoals({ ...(await leerGoals()), primary: 'inventado_por_alguien' })
  const p5c = await proponer('actualizar_objetivo', { objetivo: 'perder_grasa' })
  ok(p5c.ok, 'y con un valor desconocido tampoco se rompe')
  if (!p5c.ok) return
  igual(
    p5c.accion.cambios[0].antes, 'Sin definir',
    'un objetivo que no se sabe nombrar NO se enseña como si no existiera',
  )
  await post(`/confirmaciones/${p5c.accion.id}/cancelar`)
  await escribirGoals({ ...(await leerGoals()), primary: 'maintenance' })

  // ── Regenerar ─────────────────────────────────────────────────────────────
  seccion('Regenerar el plan')

  const p6 = await proponer('regenerar_plan', { tipo: 'ambos' })
  ok(p6.ok, 'se prepara')
  if (!p6.ok) return

  igual((await post(`/confirmaciones/${p6.accion.id}/confirmar`)).status, 200, 'se confirma')
  igual((await leerGoals()).needs_regen, 'ambos', 'queda marcado para regenerar')

  const { data: dosVersiones } = await supabase
    .from('plan_versions').select('tipo').eq('user_id', USUARIO).in('tipo', ['dieta', 'rutina'])
  igual(dosVersiones?.length, 2, 'regenerar «ambos» versiona la dieta Y la rutina')

  igual((await post(`/confirmaciones/${p6.accion.id}/deshacer`)).status, 200, 'se deshace')
  ok(
    (await leerGoals()).needs_regen === undefined,
    'la clave que no existía antes se BORRA al deshacer, no se deja en null',
  )

  // ── Aislamiento entre cuentas ─────────────────────────────────────────────
  seccion('Cuentas ajenas')

  const p7 = await proponer('actualizar_targets_nutricionales', { calorias: NUEVAS_KCAL })
  ok(p7.ok, 'se prepara una propuesta mía')
  if (!p7.ok) return

  igual(
    (await post(`/confirmaciones/${p7.accion.id}/confirmar`, otro)).status, 404,
    'otro usuario no puede confirmar mi propuesta',
  )
  igual(
    (await post(`/confirmaciones/${p7.accion.id}/cancelar`, otro)).status, 404,
    'ni cancelarla',
  )
  igual((await leerGoals()).calories_target, BASE_KCAL, 'y mis calorías no se movieron')

  const suyas = await get('/confirmaciones', otro)
  igual(suyas.body.data.pendientes.length, 0, 'ni la ve en su lista')

  await limpiar()
}
