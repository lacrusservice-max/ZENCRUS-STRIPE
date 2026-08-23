/**
 * /tracking DE PUNTA A PUNTA, CONTRA LA BASE REAL
 *
 * Las siete tablas de la migración 012: peso y medidas, hábitos, actividad,
 * ciclado de macros, plan de comidas y metas.
 *
 * ── Por qué casi nada se comprueba con un número absoluto ───────────────────
 * El usuario de pruebas tiene datos de verdad. `totalActive` y `longest` se
 * calculan sobre TODO su histórico, y la cuenta de hábitos incluye los suyos,
 * así que una aserción tipo «totalActive === 3» pasa hoy y falla mañana porque
 * él usó la app. Se mide la DIFERENCIA que provocan las pruebas.
 */

import request from 'supertest'
import trackingRoutes from '../src/routes/tracking.routes'
import { supabase } from '../src/config/supabase'
import {
  USUARIO, INTRUSO, SEMANA, PREFIJO,
  montar, token, ok, igual, seccion, limpiar, guardarCiclo,
} from './apoyo'

const app = montar('/tracking', trackingRoutes)
const yo = `Bearer ${token(USUARIO)}`
const otro = `Bearer ${token(INTRUSO)}`

const get = (url: string, auth = yo) => request(app).get(url).set('Authorization', auth)
const post = (url: string, body: unknown, auth = yo) => request(app).post(url).set('Authorization', auth).send(body as object)
const put = (url: string, body: unknown, auth = yo) => request(app).put(url).set('Authorization', auth).send(body as object)
const patch = (url: string, body: unknown, auth = yo) => request(app).patch(url).set('Authorization', auth).send(body as object)
const del = (url: string, auth = yo) => request(app).delete(url).set('Authorization', auth)

const DE_FABRICA = ['sleep', 'water', 'workout', 'protein', 'mind']

export async function pruebasDeTracking(): Promise<void> {
  await guardarCiclo()
  await limpiar()

  // ── Sesión ────────────────────────────────────────────────────────────────
  seccion('Sesión')
  igual((await request(app).get('/tracking/body')).status, 401, 'sin token no se entra')
  igual(
    (await request(app).get('/tracking/goals').set('Authorization', 'Bearer basura')).status,
    401, 'un token inventado tampoco',
  )

  // ── Peso y medidas ────────────────────────────────────────────────────────
  seccion('Peso y medidas')

  const pesoDelLunes = {
    clientId: `${PREFIJO}peso_1`, date: '2098-01-01', weight: 80.5, note: 'después de vacaciones',
  }

  const alta = await post('/tracking/body', pesoDelLunes)
  igual(alta.status, 201, 'se apunta el peso')
  igual(alta.body.data.weight, 80.5, 'devuelve el peso que se mandó')
  ok(alta.body.data.waist === undefined, 'lo no medido viene ausente, no en null')

  igual(
    (await post('/tracking/body', pesoDelLunes)).body.data.id, alta.body.data.id,
    'reintentar no crea una segunda fila',
  )

  igual(
    (await post('/tracking/body', { clientId: `${PREFIJO}vacia`, date: '2098-01-01' })).status,
    422, 'una fila sin ninguna medida se rechaza',
  )
  igual(
    (await post('/tracking/body', { clientId: `${PREFIJO}absurda`, date: '2098-01-01', waist: 900 })).status,
    422, 'una cintura de 900 cm se rechaza antes de llegar a Postgres',
  )
  igual(
    (await post('/tracking/body', { clientId: `${PREFIJO}fecha`, date: '01/01/2098', weight: 80 })).status,
    422, 'la fecha en otro formato se rechaza',
  )

  // Medirse la cintura sin pesarse: es el caso que separa `latest` de
  // `latestWeight`, y el motivo de que el endpoint devuelva las dos.
  await post('/tracking/body', { clientId: `${PREFIJO}cintura`, date: '2098-01-02', waist: 88 })

  const ultima = await get('/tracking/body/latest')
  igual(ultima.body.data.latest.date, '2098-01-02', 'la última medición es la de la cintura')
  igual(ultima.body.data.latestWeight.date, '2098-01-01', 'el último peso es de otro día')
  igual(ultima.body.data.latestWeight.weight, 80.5, 'y sigue siendo 80.5')

  igual(
    (await get('/tracking/body?desde=2098-01-01&hasta=2098-01-31')).body.data.entries.length,
    2, 'el rango trae las dos',
  )
  igual((await get('/tracking/body?desde=2098-02-01&hasta=2098-01-01')).status, 422, 'un rango invertido se rechaza')

  const correccion = await patch(`/tracking/body/${alta.body.data.id}`, { waist: 86 })
  igual(correccion.body.data.waist, 86, 'se corrige la cintura')
  igual(correccion.body.data.weight, 80.5, 'y el peso de esa fila NO se ha borrado')

  igual((await patch(`/tracking/body/${alta.body.data.id}`, { waist: 90 }, otro)).status, 404, 'un id ajeno no se puede corregir')
  igual((await del(`/tracking/body/${alta.body.data.id}`, otro)).status, 404, 'ni borrar')

  const lote = await post('/tracking/body/batch', {
    entries: [
      { clientId: `${PREFIJO}h1`, date: '2098-01-03', weight: 80.1 },
      { clientId: `${PREFIJO}h2`, date: '2098-01-04', weight: 79.8 },
      { clientId: `${PREFIJO}h3`, date: '2098-01-05', weight: 79.9, bodyFatPct: 18.2 },
    ],
  })
  igual(lote.status, 201, 'el histórico sube en lote')
  igual(lote.body.data.count, 3, 'las tres filas')

  igual((await del(`/tracking/body/${alta.body.data.id}`)).status, 200, 'se borra la propia')
  igual((await del(`/tracking/body/${alta.body.data.id}`)).status, 404, 'y ya no está')

  // ── Hábitos ───────────────────────────────────────────────────────────────
  seccion('Hábitos')

  const primera = await get('/tracking/habits')
  const llaves = (r: any) => r.body.data.habits.map((h: any) => h.id)
  igual(primera.status, 200, 'la primera lectura funciona')
  ok(DE_FABRICA.every(k => llaves(primera).includes(k)), 'están los cinco de fábrica')
  ok(
    primera.body.data.habits.filter((h: any) => DE_FABRICA.includes(h.id)).every((h: any) => h.esDefault),
    'y vienen marcados como de fábrica',
  )

  const antes = primera.body.data.habits.length
  igual((await get('/tracking/habits')).body.data.habits.length, antes, 'la segunda lectura no los duplica')

  const propio = await post('/tracking/habits', {
    habitKey: `${PREFIJO}leer`, label: 'Leer 20 minutos', icon: 'book',
  })
  igual(propio.status, 201, 'se crea un hábito propio')
  igual(propio.body.data.esDefault, false, 'y no se marca como de fábrica')

  igual((await put(`/tracking/habits/${PREFIJO}leer/log/2098-01-01`, { hecho: true })).status, 200, 'se marca cumplido')
  igual((await put('/tracking/habits/sleep/log/2098-01-01', { hecho: true })).status, 200, 'y uno de fábrica también')
  igual((await put('/tracking/habits/inventado/log/2098-01-01', { hecho: true })).status, 404, 'una llave que no existe se rechaza')

  const conLogs = await get('/tracking/habits?desde=2098-01-01&hasta=2098-12-31')
  igual(conLogs.body.data.logs['2098-01-01']['sleep'], true, 'los registros vienen como fecha → hábito → sí/no')
  igual(Object.keys(conLogs.body.data.logs['2098-01-01']).length, 2, 'los dos del día')

  // Desmarcar guarda el `false`: no es lo mismo que no haberlo tocado.
  await put('/tracking/habits/sleep/log/2098-01-01', { hecho: false })
  igual(
    (await get('/tracking/habits?desde=2098-01-01&hasta=2098-12-31')).body.data.logs['2098-01-01']['sleep'],
    false, 'desmarcar guarda el no',
  )

  const conHuerfanos = await post('/tracking/habits/logs/batch', {
    logs: [
      { habitKey: 'water', date: '2098-01-02', hecho: true },
      { habitKey: 'workout', date: '2098-01-02', hecho: true },
      { habitKey: 'borrado_hace_meses', date: '2098-01-02', hecho: true },
    ],
  })
  igual(conHuerfanos.status, 201, 'el lote con huérfanos no falla')
  igual(conHuerfanos.body.data.count, 2, 'sube los buenos')
  igual(conHuerfanos.body.data.descartados, 1, 'y avisa del que descartó')

  // ── Momento, hora, tipo y cronómetro ──────────────────────────────────────
  // Los cuatro campos que la pantalla necesita para agrupar el día, enseñar la
  // hora al lado de la tarjeta, dar la vuelta a los de «evitar» y cronometrar.
  const completo = await post('/tracking/habits', {
    habitKey: `${PREFIJO}crono`, label: 'Sin pantallas', icon: 'phone-portrait',
    momento: 'noche', hora: '22:30', tipo: 'evitar', metaSegundos: 300,
  })
  igual(completo.status, 201, 'se crea con momento, hora, tipo y meta')
  igual(completo.body.data.momento, 'noche', 'el momento vuelve como se mandó')
  igual(completo.body.data.hora, '22:30', 'la hora vuelve sin los segundos que añade Postgres')
  igual(completo.body.data.tipo, 'evitar', 'y el tipo evitar se conserva')
  igual(completo.body.data.metaSegundos, 300, 'y la meta del cronómetro')

  const suelto = await post('/tracking/habits', {
    habitKey: `${PREFIJO}suelto`, label: 'Sin nada', icon: 'ellipse',
  })
  igual(suelto.body.data.momento, 'manana', 'sin decir nada cae en la mañana')
  igual(suelto.body.data.tipo, 'hacer', 'y en hacer')
  igual(suelto.body.data.metaSegundos, null, 'y sin cronómetro')

  igual((await post('/tracking/habits', {
    habitKey: `${PREFIJO}malo`, label: 'x', icon: 'ellipse', momento: 'madrugada',
  })).status, 422, 'un momento que no existe se rechaza')
  igual((await post('/tracking/habits', {
    habitKey: `${PREFIJO}malo2`, label: 'x', icon: 'ellipse', hora: '25:00',
  })).status, 422, 'y una hora imposible también')

  const movido = await patch(`/tracking/habits/${PREFIJO}suelto`, { momento: 'tarde', hora: '18:15' })
  igual(movido.body.data.momento, 'tarde', 'se puede cambiar de momento')
  igual(movido.body.data.hora, '18:15', 'y ponerle hora')
  igual((await patch(`/tracking/habits/${PREFIJO}suelto`, { hora: null })).body.data.hora, null,
    'y quitársela con null, que no es lo mismo que no mandar nada')

  // Lo cronometrado a medias NO se da por cumplido: son dos cosas distintas.
  igual((await put(`/tracking/habits/${PREFIJO}crono/log/2098-01-02`, { hecho: false, segundos: 120 })).status,
    200, 'se guardan los segundos cronometrados')
  const conSegundos = await get('/tracking/habits?desde=2098-01-01&hasta=2098-12-31')
  igual(conSegundos.body.data.segundos['2098-01-02'][`${PREFIJO}crono`], 120,
    'y vuelven en su propio mapa, aparte de los sí/no')
  igual(conSegundos.body.data.logs['2098-01-02'][`${PREFIJO}crono`], false,
    'sin dar por cumplido lo que va a medias')
  ok(conSegundos.body.data.segundos['2098-01-01'] === undefined,
    'los días sin cronometrar no ocupan sitio en el mapa')

  igual((await put(`/tracking/habits/${PREFIJO}crono/log/2098-01-02`, { hecho: true, segundos: 300 })).status,
    200, 'y al llegar a la meta se marca')

  // Se quitan de la tabla de verdad, no con DELETE —que solo desactiva y deja
  // la fila puesta—: cuatro líneas más abajo hay una prueba que cuenta filas y
  // estos dos se la llevarían por delante.
  await supabase.from('habit_definitions').delete().eq('user_id', USUARIO)
    .in('habit_key', [`${PREFIJO}crono`, `${PREFIJO}suelto`])

  igual((await del(`/tracking/habits/${PREFIJO}leer`)).status, 200, 'se borra un hábito')
  const trasBorrar = await get('/tracking/habits')
  igual(trasBorrar.body.data.habits.length, antes + 1, 'la fila sigue existiendo')
  igual(
    trasBorrar.body.data.habits.find((h: any) => h.id === `${PREFIJO}leer`).activo,
    false, 'pero desactivada',
  )
  igual((await del('/tracking/habits/no_existe')).status, 404, 'borrar uno que no existe da 404')

  // ── Actividad y rachas ────────────────────────────────────────────────────
  seccion('Actividad y rachas')

  // El usuario tiene actividad real: se mide la diferencia, no el absoluto.
  const activosBase = (await get('/tracking/activity?hoy=2098-02-04')).body.data.streak.totalActive

  igual((await put('/tracking/activity/2098-02-01', { loggedFood: true })).status, 200, 'se apunta que comió')

  const conEntreno = await put('/tracking/activity/2098-02-01', { loggedWorkout: true })
  igual(conEntreno.body.data.loggedWorkout, true, 'se apunta que entrenó')
  igual(conEntreno.body.data.loggedFood, true, 'y NO se ha borrado que había comido')

  igual((await put('/tracking/activity/2098-02-01', {})).status, 422, 'un cuerpo vacío no vale')

  await post('/tracking/activity/batch', {
    days: [
      { date: '2098-02-02', loggedFood: true },
      { date: '2098-02-03', protegido: true },
      { date: '2098-02-04', loggedWorkout: true },
      { date: '2098-02-05', drankWater: true },
    ],
  })

  const actividad = await get('/tracking/activity?desde=2098-02-01&hasta=2098-02-28&hoy=2098-02-04')
  igual(actividad.body.data.days.length, 5, 'los días del rango')
  igual(actividad.body.data.days[0].date, '2098-02-01', 'ordenados hacia delante')
  igual(actividad.body.data.streak.current, 4, 'la racha cruza el día protegido')
  igual(actividad.body.data.streak.totalActive - activosBase, 3, 'el protegido no cuenta como día activo')
  igual(actividad.body.data.streak.lastActiveDate, '2098-02-04', 'el último día con algo')

  igual(
    (await get('/tracking/activity?hoy=2098-02-05')).body.data.streak.current,
    4, 'el día de solo agua no alarga la racha',
  )

  // ── Ciclado de macros ─────────────────────────────────────────────────────
  seccion('Ciclado de macros')

  // Se quita el ciclado real para probar el caso «no hay ninguno»; `limpiar()`
  // lo devuelve al terminar.
  await supabase.from('macro_cycles').delete().eq('user_id', USUARIO)

  const sinCiclo = await get('/tracking/macro-cycle')
  igual(sinCiclo.status, 200, 'se puede preguntar sin tener ninguno')
  igual(sinCiclo.body.data.cycle, null, 'y contesta que no hay')

  igual(
    (await put('/tracking/macro-cycle', { cycle: ['high', 'low', 'rest'], activo: true })).status,
    422, 'una semana de tres días se rechaza',
  )
  igual(
    (await put('/tracking/macro-cycle', { cycle: Array(7).fill('altísimo'), activo: true })).status,
    422, 'un tipo de día inventado se rechaza',
  )

  const guardado = await put('/tracking/macro-cycle', {
    cycle: ['high', 'moderate', 'high', 'moderate', 'high', 'low', 'rest'],
    preset: 'classic',
    activo: true,
  })
  igual(guardado.status, 200, 'se guarda la semana')
  igual(guardado.body.data.preset, 'classic', 'con su preajuste')

  const aMano = await put('/tracking/macro-cycle', {
    cycle: ['high', 'high', 'high', 'moderate', 'high', 'low', 'rest'],
    preset: null,
    activo: true,
  })
  igual(aMano.body.data.preset, null, 'tocarlo a mano deja el preajuste en null')
  igual((await get('/tracking/macro-cycle')).body.data.cycle.cycle[1], 'high', 'y el cambio persiste')

  // ── Plan de comidas ───────────────────────────────────────────────────────
  seccion('Plan de comidas')

  const vacio = await get(`/tracking/meal-plan/${SEMANA}`)
  igual(vacio.status, 200, 'una semana sin plan no es un 404')
  igual(vacio.body.data.plan, {}, 'contesta con el plan vacío')

  igual((await get('/tracking/meal-plan/2098-01')).status, 422, 'una semana mal formada se rechaza')

  const plan = {
    lun: { breakfast: [{ id: 'p1', name: 'Huevos con frijoles', calories: 420, protein: 28, carbs: 30, fat: 20 }] },
    mar: { lunch: [{ id: 'p2', name: 'Pozole', calories: 610, protein: 35, carbs: 55, fat: 25, emoji: '🍲' }] },
  }
  igual((await put(`/tracking/meal-plan/${SEMANA}`, { plan })).status, 200, 'se guarda el plan')
  igual(
    (await get(`/tracking/meal-plan/${SEMANA}`)).body.data.plan.mar.lunch[0].name,
    'Pozole', 'y vuelve entero',
  )

  igual(
    (await put(`/tracking/meal-plan/${SEMANA}`, { plan: { lun: { breakfast: [{ name: 'sin id' }] } } })).status,
    422, 'una comida sin id ni macros se rechaza',
  )
  igual(
    (await put(`/tracking/meal-plan/${SEMANA}`, { plan: { jueves: {} } })).status,
    422, 'un día que no existe se rechaza',
  )

  // ── Metas ─────────────────────────────────────────────────────────────────
  seccion('Metas')

  const meta = {
    clientId: `${PREFIJO}meta_1`, title: 'Bajar 3 kilos', type: 'weight', direction: 'decrease',
    startValue: 80.5, targetValue: 77.5, startDate: '2098-01-01', targetDate: '2098-03-01', unit: 'kg',
  }

  const creada = await post('/tracking/goals', meta)
  igual(creada.status, 201, 'se plantea la meta')
  igual(creada.body.data.type, 'weight', 'con los nombres del store, no los de la tabla')
  igual(creada.body.data.estado, 'activa', 'y nace activa')

  igual((await post('/tracking/goals', meta)).body.data.id, creada.body.data.id, 'reintentar no la duplica')
  igual(
    (await post('/tracking/goals', { ...meta, clientId: `${PREFIJO}m2`, targetDate: '2097-01-01' })).status,
    422, 'una meta que termina antes de empezar se rechaza',
  )
  igual(
    (await post('/tracking/goals', { ...meta, clientId: `${PREFIJO}m3`, type: 'adelgazar' })).status,
    422, 'un tipo de meta inventado se rechaza',
  )

  const cumplida = await patch(`/tracking/goals/${creada.body.data.id}`, { estado: 'cumplida' })
  igual(cumplida.body.data.estado, 'cumplida', 'se puede cerrar por cumplida')
  ok(cumplida.body.data.cerradaEn !== null, 'y se le pone fecha de cierre sola')

  const otraMeta = await post('/tracking/goals', { ...meta, clientId: `${PREFIJO}meta_2`, title: 'Entrenar 4 veces' })
  igual(
    (await patch(`/tracking/goals/${otraMeta.body.data.id}`, { title: 'ajena' }, otro)).status,
    404, 'una meta ajena no se toca',
  )

  igual((await del(`/tracking/goals/${otraMeta.body.data.id}`)).body.data.estado, 'abandonada', 'borrar es abandonar')
  igual((await del(`/tracking/goals/${otraMeta.body.data.id}`)).status, 404, 'y no se abandona dos veces')

  igual((await get('/tracking/goals?estado=activa')).body.data.goals.length, 0, 'las cerradas salen de la lista')
  igual((await get('/tracking/goals')).body.data.goals.length, 2, 'pero siguen en el histórico')

  await limpiar()
}
