/**
 * PRUEBAS e2e · /cycle
 * ═══════════════════════════════════════════════════════════════════════════
 * Las ocho tablas de la migración 018 recorridas de punta a punta: token real,
 * middleware real, controlador real y Supabase real.
 *
 * ⚠️ ESCRIBE EN PRODUCCIÓN. Todo con fechas centinela de 2098, que es lo que
 * hace que `limpiar()` pueda borrar lo suyo y solo lo suyo.
 *
 * ── Un aviso que hay que entender antes de tocar esto ──────────────────────
 * `cycle_periods` es una vista materializada: el servidor la RECALCULA ENTERA
 * a partir de `cycle_logs` cada vez que cambia el sangrado. Así que estas
 * pruebas, al escribir sangrado de 2098, hacen que los periodos reales de la
 * usuaria se vuelvan a derivar. Es seguro —salen los mismos, porque salen de
 * los mismos registros— y al limpiar el sangrado de 2098 la siguiente
 * derivación los deja exactamente como estaban.
 *
 * Lo que NO sería seguro es acotar mal el borrado. Por eso todo va con
 * `gte(CENTINELA)` y nunca con un `delete().eq('user_id', …)` a secas.
 */

import request from 'supertest'
import cycleRoutes from '../src/routes/cycle.routes'
import { supabase } from '../src/config/supabase'
import {
  montar, token, USUARIO, INTRUSO, CORREO_USUARIO, ok, igual, seccion,
} from './apoyo'

const app = montar('/cycle', cycleRoutes)

/** Un ciclo entero inventado en 2098, para que la derivación tenga qué morder. */
const P1 = '2098-01-05'
const P2 = '2098-02-02'   // 28 días después
const MANCHADO = '2098-01-20'

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

export async function pruebasDeCiclo(): Promise<void> {
  const yo = token(USUARIO, CORREO_USUARIO)
  const otro = token(INTRUSO, 'nadie@zencrus.test')

  // ── La puerta ──────────────────────────────────────────────────────────
  seccion('Ciclo · la puerta es un 404, no un 403')

  const sinToken = await request(app).get('/cycle')
  ok(sinToken.status === 401, 'sin token responde 401 y no 404', sinToken.status)

  const ajeno = await request(app).get('/cycle').set(auth(otro))
  ok(ajeno.status === 404, 'una cuenta sin el módulo recibe 404', ajeno.status)
  ok(
    /no encontrada/.test(ajeno.body?.message ?? ''),
    'y el cuerpo es el de una ruta inexistente, no un «no tienes acceso»',
    ajeno.body,
  )

  const mio = await request(app).get('/cycle').set(auth(yo))
  ok(mio.status === 200, 'la cuenta con el módulo entra', mio.status)

  // ── Escritura por lotes ────────────────────────────────────────────────
  seccion('Ciclo · el lote no se atasca por un dato malo')

  const lote = await request(app).post('/cycle/logs/batch').set(auth(yo)).send({
    cambios: [
      { fecha: P1, kind: 'sangrado', value: { level: 3 } },
      { fecha: '2098-01-06', kind: 'sangrado', value: { level: 4 } },
      { fecha: '2098-01-07', kind: 'sangrado', value: { level: 2 } },
      { fecha: MANCHADO, kind: 'sangrado', value: { level: 1 } },
      { fecha: P2, kind: 'sangrado', value: { level: 3 } },
      // Fuera de rango: valence sólo va de -1 a 1.
      { fecha: P1, kind: 'animo', value: { valence: 5, arousal: 0 } },
      // La foto de un test NUNCA debe llegar a la base.
      {
        fecha: P1, kind: 'prueba',
        value: { type: 'ovulacion', result: 'negativo', photoLocalUri: 'file:///privado.jpg' },
      },
    ],
  })

  ok(lote.status === 200, 'el lote entra', lote.status)
  igual(lote.body?.data?.escritos, 6, 'entran los seis válidos')
  igual(lote.body?.data?.descartados, 1, 'y el inválido se descarta sin tumbar el resto')

  const { data: fotoEnBase } = await supabase
    .from('cycle_logs').select('value')
    .eq('user_id', USUARIO).eq('log_date', P1).eq('kind', 'prueba').maybeSingle()
  ok(
    fotoEnBase != null && !('photoLocalUri' in (fotoEnBase.value as object)),
    'la ruta de la foto del test se descarta antes de escribir',
    fotoEnBase?.value,
  )

  // ── Derivación de periodos ─────────────────────────────────────────────
  seccion('Ciclo · los periodos salen del sangrado')

  const tras = await request(app).get('/cycle').set(auth(yo)).query({ desde: '2098-01-01' })
  const periodos = (tras.body?.data?.periods ?? []).filter((p: any) => p.inicio >= '2098-01-01')

  igual(periodos.length, 2, 'el manchado del día 20 NO abre un periodo')
  igual(periodos[0]?.inicio, P1, 'el primero empieza donde empezó el sangrado')
  igual(periodos[0]?.duracionCiclo, 28, 'y su ciclo dura lo que hay hasta el siguiente')
  igual(periodos[1]?.duracionCiclo, null, 'la duración del último no se inventa')

  // ── El inicio declarado a mano ─────────────────────────────────────────
  seccion('Ciclo · declarar un inicio manda sobre la deducción')

  await request(app).post('/cycle/periods').set(auth(yo)).send({ fecha: MANCHADO })
  const conDeclarado = await request(app).get('/cycle').set(auth(yo)).query({ desde: '2098-01-01' })
  const decl = (conDeclarado.body?.data?.declared ?? []).filter((f: string) => f >= '2098-01-01')
  igual(decl, [MANCHADO], 'el inicio declarado aparece como tal')

  const conDecl = (conDeclarado.body?.data?.periods ?? [])
    .filter((p: any) => p.inicio >= '2098-01-01')
  ok(
    conDecl.some((p: any) => p.inicio === MANCHADO && p.declarado === true),
    'y abre un periodo aunque ese día solo hubiera manchado',
    conDecl,
  )

  await request(app).delete(`/cycle/periods/${MANCHADO}`).set(auth(yo))
  const sinDeclarado = await request(app).get('/cycle').set(auth(yo)).query({ desde: '2098-01-01' })
  const vuelta = (sinDeclarado.body?.data?.periods ?? [])
    .filter((p: any) => p.inicio >= '2098-01-01')
  igual(vuelta.length, 2, 'retirar la declaración devuelve el estado anterior')
  igual(vuelta[0]?.duracionCiclo, 28, 'y la duración vuelve a ser la deducida')

  // ── Validación en el servidor ──────────────────────────────────────────
  seccion('Ciclo · el servidor no se fía del cliente')

  const imposible = await request(app)
    .put(`/cycle/logs/${P1}/temperatura_basal`).set(auth(yo))
    .send({ value: { celsius: 45 } })
  ok(imposible.status === 422, 'una temperatura de 45 °C se rechaza', imposible.status)

  const buena = await request(app)
    .put(`/cycle/logs/${P1}/temperatura_basal`).set(auth(yo))
    .send({ value: { celsius: 36.62 } })
  ok(buena.status === 200, 'y una de 36,62 entra', buena.status)

  const invertida = await request(app).put('/cycle/prediction').set(auth(yo)).send({
    modelVersion: 'pruebas', nextPeriodLow: '2098-03-09',
    nextPeriodLikely: '2098-03-02', nextPeriodHigh: '2098-03-05',
    confidence: 40, sampleCycles: 1,
  })
  ok(invertida.status === 422, 'una banda de predicción invertida se rechaza', invertida.status)

  const derecha = await request(app).put('/cycle/prediction').set(auth(yo)).send({
    modelVersion: 'pruebas', nextPeriodLow: '2098-02-27',
    nextPeriodLikely: '2098-03-02', nextPeriodHigh: '2098-03-05',
    confidence: 40, sampleCycles: 1,
  })
  ok(derecha.status === 201, 'y una banda coherente se guarda', derecha.status)

  // ── Aislamiento ────────────────────────────────────────────────────────
  seccion('Ciclo · nadie ve lo de nadie')

  const fisgon = await request(app).get('/cycle').set(auth(otro))
  ok(fisgon.status === 404, 'el intruso ni siquiera llega a preguntar', fisgon.status)

  // ── Borrado ────────────────────────────────────────────────────────────
  seccion('Ciclo · borrar deja de existir')

  for (const [fecha, kind] of [
    [P1, 'sangrado'], ['2098-01-06', 'sangrado'], ['2098-01-07', 'sangrado'],
    [MANCHADO, 'sangrado'], [P2, 'sangrado'],
    [P1, 'prueba'], [P1, 'temperatura_basal'],
  ] as Array<[string, string]>) {
    await request(app).delete(`/cycle/logs/${fecha}/${kind}`).set(auth(yo))
  }

  const limpio = await request(app).get('/cycle').set(auth(yo)).query({ desde: '2098-01-01' })
  const quedan = Object.keys(limpio.body?.data?.logs ?? {}).filter(f => f >= '2098-01-01')
  igual(quedan, [], 'no queda ningún registro de 2098')

  const periodosQuedan = (limpio.body?.data?.periods ?? [])
    .filter((p: any) => p.inicio >= '2098-01-01')
  igual(periodosQuedan, [], 'y los periodos derivados se van con ellos')
}
