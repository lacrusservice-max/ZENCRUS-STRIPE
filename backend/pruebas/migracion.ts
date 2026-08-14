/**
 * LA MIGRACIÓN DEL HISTÓRICO DEL TELÉFONO
 *
 * Dos partes: que la traducción aguante los datos feos que lleva dentro un
 * móvil con años de versiones distintas, y que lo que produce lo acepte el
 * servidor de verdad. Lo segundo importa tanto como lo primero: una traducción
 * impecable que devuelva 422 no migra nada.
 */

import request from 'supertest'
import trackingRoutes from '../src/routes/tracking.routes'
import {
  medicionesDelLegado, habitosDelLegado, registrosDeHabitos, diasDelLegado,
  metaDelLegado, esMedidaDeMentira,
} from '../../frontend/src/utils/migracionLegado'
import { USUARIO, montar, token, ok, igual, seccion, limpiar } from './apoyo'

const app = montar('/tracking', trackingRoutes)
const yo = `Bearer ${token(USUARIO)}`
const get = (url: string) => request(app).get(url).set('Authorization', yo)
const post = (url: string, body: unknown) => request(app).post(url).set('Authorization', yo).send(body as object)

// ── Lo que de verdad hay en un teléfono con historia ─────────────────────────

const WEIGHT_HISTORY = [
  { id: '1700000000001', date: '2098-04-01', weight: 82.4, note: 'primer registro' },
  { id: '1700000000002', date: '2098-04-08', weight: 81.9 },
  // De cuando la pantalla dejaba guardar sin escribir nada.
  { id: '1700000000003', date: '2098-04-15', weight: 0 },
  // Un dedazo: 8 y 2 pegados.
  { id: '1700000000004', date: '2098-04-22', weight: 824 },
  // Una versión vieja guardaba la fecha con la hora dentro.
  { id: '1700000000005', date: '2098-04-29T09:14:22.000Z', weight: 81.2 },
  // Basura de una migración a medias de hace dos versiones.
  { id: null, date: '2098-05-01', weight: 80 },
]

const MEASUREMENT_HISTORY = [
  { id: '1700000000010', date: '2098-04-01', waist: 92, chest: 104, bodyFat: 22.5 },
  // Sin ninguna medida dentro de rango: no es un dato.
  { id: '1700000000011', date: '2098-04-08', waist: undefined, bodyFat: 180 },
]

const BODY_MEASUREMENTS = [
  // Las cuatro de mentira que sembraba el store.
  { id: 'm0', date: '2098-04-02', weight: 75, waist: 82 },
  { id: 'm1', date: '2098-03-26', weight: 75.5, waist: 82.3 },
  { id: 'm2', date: '2098-03-19', weight: 76, waist: 82.6 },
  { id: 'm3', date: '2098-03-12', weight: 76.5, waist: 82.9 },
  // Y una de verdad.
  { id: 'm_1700000000020', date: '2098-05-06', weight: 80.8, bodyFatPct: 21.1, shoulders: 118, note: 'con la báscula nueva' },
]

const HABITS_LIST = [
  { id: 'sleep', label: 'Dormir 7h o más', icon: 'moon' },
  { id: 'water', label: '8 vasos de agua', icon: 'water' },
  { id: 'workout', label: 'Entrenar', icon: 'barbell' },
  { id: 'protein', label: 'Proteína objetivo', icon: 'restaurant' },
  { id: 'mind', label: 'Respirar / meditar 5 min', icon: 'leaf' },
  { id: 'custom_1700000000030', label: 'Leer 20 minutos', icon: 'book' },
  { id: 'custom_1700000000031', label: 'Estirar', icon: 'body' },
]

const HABITS_LOGS = {
  '2098-04-01': { sleep: true, water: true, custom_1700000000030: true },
  '2098-04-02': { sleep: false, workout: true },
  // Una llave corrupta de una versión que guardaba mal.
  'undefined': { sleep: true },
  // Un hábito borrado hace meses: sus registros quedaron huérfanos.
  '2098-04-03': { borrado_hace_tiempo: true, water: true },
}

const ACTIVIDADES = [
  { date: '2098-04-01', datos: { loggedFood: true, drank8Glasses: true } },
  { date: '2098-04-02', datos: { loggedWorkout: true } },
  { date: '2098-04-04', datos: { loggedFood: true } },
]
// El 3 no tiene fila: es justo el día que salvó el protector.
const PROTEGIDOS = ['2098-04-03']

const GOALS = [
  { id: '1700000000040', title: 'Bajar 3 kilos', type: 'weight', direction: 'decrease', startValue: 82.4, targetValue: 79.4, startDate: '2098-04-01', targetDate: '2098-06-01', unit: 'kg' },
  // Con las fechas en ISO completo, como las guardaba el store.
  { id: '1700000000041', title: 'Entrenar 4 veces', type: 'workout_frequency', direction: 'increase', startValue: 2, targetValue: 4, startDate: '2098-04-01T00:00:00.000Z', targetDate: '2098-07-01T00:00:00.000Z', unit: 'entrenamientos/semana' },
  // Termina antes de empezar.
  { id: '1700000000042', title: 'Meta rota', type: 'streak', direction: 'increase', startValue: 0, targetValue: 30, startDate: '2098-06-01', targetDate: '2098-04-01', unit: 'días' },
  // Un tipo que ya no existe.
  { id: '1700000000043', title: 'Meta de otra versión', type: 'adelgazar', direction: 'decrease', startValue: 80, targetValue: 75, startDate: '2098-04-01', targetDate: '2098-06-01', unit: 'kg' },
]

export async function pruebasDeMigracion(): Promise<void> {
  await limpiar()

  // ── La traducción ─────────────────────────────────────────────────────────
  seccion('Traducción de lo que hay en el teléfono')

  ok(esMedidaDeMentira('m0') && esMedidaDeMentira('m3'), 'las de demostración se reconocen')
  ok(!esMedidaDeMentira('m_1700000000020'), 'y una de verdad no se confunde con ellas')

  const mediciones = medicionesDelLegado({
    pesos: WEIGHT_HISTORY, medidas: MEASUREMENT_HISTORY, cuerpo: BODY_MEASUREMENTS,
  })

  igual(mediciones.length, 5, 'sobreviven solo las cinco filas con algo real dentro')
  ok(!mediciones.some(m => m.clientId.includes('m0')), 'ninguna medida de mentira sube')
  ok(!mediciones.some(m => m.weight === 0 || m.weight === 824), 'ni el peso a cero ni el de 824 kilos')
  igual(mediciones.find(m => m.clientId === 'w_1700000000005')?.date, '2098-04-29', 'la fecha con hora se recorta')
  ok(!mediciones.some(m => m.clientId.includes('null')), 'la fila sin id se descarta')

  igual(
    mediciones.find(m => m.clientId === 'me_1700000000010')?.bodyFatPct,
    22.5, 'bodyFat se traduce a bodyFatPct',
  )
  ok(
    !mediciones.some(m => m.clientId === 'me_1700000000011'),
    'la medición con 180 % de grasa y nada más se descarta',
  )

  igual(
    [...new Set(mediciones.map(m => m.clientId.split('_')[0]))].sort(),
    ['bm', 'me', 'w'],
    'cada origen lleva su prefijo, para no pisarse',
  )

  const habitos = habitosDelLegado(HABITS_LIST)
  igual(habitos.length, 2, 'solo suben los hábitos propios')
  ok(!habitos.some(h => h.habitKey === 'sleep'), 'los cinco de fábrica los siembra el servidor')

  const registros = registrosDeHabitos(HABITS_LOGS)
  igual(registros.length, 7, 'los registros con fecha válida se aplanan')
  ok(!registros.some(r => r.date === 'undefined'), 'la llave corrupta se descarta')
  ok(registros.some(r => r.hecho === false), 'un hábito desmarcado se conserva como falso')

  const dias = diasDelLegado(ACTIVIDADES, PROTEGIDOS)
  igual(dias.length, 4, 'el día protegido sin fila se añade')
  igual(dias.find(d => d.date === '2098-04-03')?.protegido, true, 'y viene marcado como protegido')
  igual(dias.find(d => d.date === '2098-04-01')?.drankWater, true, 'drank8Glasses se traduce a drankWater')
  ok(dias.every(d => typeof d.checkInDone === 'boolean'), 'las cinco banderas van siempre completas')

  const metas = GOALS.map(metaDelLegado).filter(Boolean)
  igual(metas.length, 2, 'las metas rotas se descartan')
  igual(metas[1]?.startDate, '2098-04-01', 'las fechas ISO se recortan')

  // ── Y que el servidor lo acepte ───────────────────────────────────────────
  seccion('El servidor acepta lo que produce la traducción')

  const subidas = await post('/tracking/body/batch', { entries: mediciones })
  igual(subidas.status, 201, 'las mediciones entran')
  igual(subidas.body.data.count, 5, 'las cinco')

  // Igual que hace `migrarSeguimiento`: primero esta lectura, que es la que
  // siembra los cinco de fábrica. Sin ella el servidor no conoce `sleep` ni
  // `water` y descartaría todo su cumplimiento — que es el fallo que estas
  // pruebas encontraron la primera vez.
  const sembrados = (await get('/tracking/habits')).body.data.habits.map((h: any) => h.id)
  ok(
    ['sleep', 'water', 'workout', 'protein', 'mind'].every(k => sembrados.includes(k)),
    'la lectura previa siembra los de fábrica',
  )

  for (const h of habitos) {
    igual((await post('/tracking/habits', h)).status, 201, `entra el hábito «${h.label}»`)
  }

  const logsSubidos = await post('/tracking/habits/logs/batch', { logs: registros })
  igual(logsSubidos.status, 201, 'los registros de hábitos entran')
  igual(logsSubidos.body.data.descartados, 1, 'y el huérfano se descarta sin tumbar el lote')

  const activosBase = (await get('/tracking/activity?hoy=2098-04-04')).body.data.streak.totalActive
  igual((await post('/tracking/activity/batch', { days: dias })).status, 201, 'la actividad entra')

  for (const m of metas) {
    igual((await post('/tracking/goals', m)).status, 201, `entra la meta «${m!.title}»`)
  }

  // ── Y que se pueda volver a leer ──────────────────────────────────────────
  seccion('Lo migrado se lee igual que lo nuevo')

  const ultima = await get('/tracking/body/latest')
  igual(ultima.body.data.latestWeight.weight, 80.8, 'el último peso es el de la báscula nueva')
  igual(ultima.body.data.latestWeight.note, 'con la báscula nueva', 'con su nota')

  const actividad = await get('/tracking/activity?desde=2098-04-01&hasta=2098-04-30&hoy=2098-04-04')
  igual(actividad.body.data.streak.current, 4, 'la racha se reconstruye a través del día protegido')
  igual(actividad.body.data.streak.totalActive - activosBase, 3, 'y el protegido sigue sin contar como activo')

  // Correrla dos veces no puede duplicar nada: es el seguro de que un fallo a
  // medias se pueda reintentar sin miedo.
  seccion('Reintentar la migración')

  await post('/tracking/body/batch', { entries: mediciones })
  await post('/tracking/activity/batch', { days: dias })
  for (const m of metas) await post('/tracking/goals', m)

  igual(
    (await get('/tracking/body?desde=2098-01-01&hasta=2098-12-31')).body.data.entries.length,
    5, 'sigue habiendo cinco mediciones',
  )
  igual((await get('/tracking/goals')).body.data.goals.length, 2, 'y dos metas')

  await limpiar()
}
