/**
 * EL §12 DE PUNTA A PUNTA — detección y contención
 *
 * Lo que se comprueba, por encima de cada aserción: que ZENA baje la voz
 * cuando toca, que NO la baje cuando no toca, y que quien diga algo grave
 * reciba un teléfono que funcione.
 *
 * ── Qué se prueba con la base y qué no ──────────────────────────────────────
 * Tres de las seis señales se deducen de tablas que ya existen: pesarse varias
 * veces, borrar comidas y comer por debajo de la TMB. Para ejercitarlas hay que
 * escribir en `body_metrics` y `meal_logs` del usuario REAL.
 *
 * Se hace con las fechas centinela de 2098 de siempre, y funciona por un
 * detalle que conviene tener presente: las consultas de `cuidado` acotan por
 * `>= hace N días` y no ponen techo, así que una fecha de 2098 cae dentro de
 * la ventana igual que una de ayer. Eso permite probarlo sin escribir un solo
 * dato con fecha real en la cuenta de alguien — que es lo que no se puede
 * limpiar después.
 *
 * ── Lo que estas pruebas NO dicen ───────────────────────────────────────────
 * Que la mecánica funcione no dice nada sobre si las señales son las correctas
 * ni sobre si los textos están bien escritos. El §12 pide validación de un
 * profesional de salud mental antes de lanzar y eso sigue pendiente.
 */

import { supabase } from '../src/config/supabase'
import {
  suenaACulpa, pideContencion, faltanLosRecursos,
  apuntarSenal, evaluarRiesgo, cuidadoDeEsteMensaje, TEXTOS,
} from '../src/services/cuidado'
import { prepararAccion } from '../src/services/confirmaciones'
import { perfilClinicoDe, metabolismoBasal, gastoTotal } from '../src/services/limitesClinicos'
import { USUARIO, CENTINELA, PREFIJO, ok, igual, seccion, limpiar, guardarGoals } from './apoyo'

const escribirGoals = async (goals: Record<string, any>): Promise<void> => {
  await supabase.from('users').update({ goals }).eq('id', USUARIO)
}

/** Deja la cuenta sin señales apuntadas ni estado, para partir de cero. */
async function sinSenales(): Promise<void> {
  await supabase.from('senales_tca').delete().eq('user_id', USUARIO)
  await supabase.from('tca_estado').delete().eq('user_id', USUARIO)
}

export async function pruebasDeCuidado(): Promise<void> {
  await guardarGoals()
  await limpiar()
  await sinSenales()

  // ── Lo que no toca la base ────────────────────────────────────────────────
  seccion('§12 · Leer el mensaje')

  ok(pideContencion('ya no quiero seguir viviendo'), 'reconoce la ideación directa')
  ok(pideContencion('estoy pensando en quitarme la vida'), 'y dicha de otra forma')
  /**
   * Estas dos fallaban y no se veía.
   *
   * `\b` en JavaScript es ASCII: detrás de «mí» no hay frontera de palabra, así
   * que `/sin\s+m[ií]\b/` no casaba con «sin mí». Y la autolesión se cuenta en
   * gerundio o en presente —«llevo días cortándome»—, casi nunca en infinitivo.
   * Las dos expresiones se leían perfectamente correctas.
   */
  ok(pideContencion('creo que estarían mejor sin mí'), 'y la que no se dice con esas palabras')
  ok(pideContencion('sería mejor no despertar'), 'y la que se dice de refilón')
  ok(pideContencion('llevo días cortándome'), 'la autolesión en gerundio')
  ok(pideContencion('me corto cuando me pongo así'), 'y en presente')
  ok(pideContencion('no quiero vivir más'), 'y con acento al final')
  ok(!pideContencion('quiero cortar el pollo en tiras'), 'NO salta con cortar comida')
  ok(suenaACulpa('siento asco de mí después de cenar'), 'la culpa que acaba en acento')

  /**
   * El uso figurado es lo que más se dice en una app de comida. Si cada «me
   * muero de hambre» abriera un protocolo de crisis, el protocolo dejaría de
   * significar nada.
   */
  ok(!pideContencion('me muero de hambre, ¿qué ceno?'), 'NO salta con «me muero de hambre»')
  ok(!pideContencion('me quiero morir de vergüenza, comí de más'), 'ni con el «me quiero morir» figurado')
  ok(!pideContencion('estoy muerto de sueño hoy'), 'ni con «muerto de sueño»')
  ok(!pideContencion('¿cuánta proteína necesito?'), 'ni con una pregunta normal')

  ok(suenaACulpa('me odio por lo que comí ayer'), 'reconoce la culpa sobre la comida')
  ok(suenaACulpa('no debería haber comido eso'), 'y el arrepentimiento')
  ok(suenaACulpa('tengo que compensar lo de anoche'), 'y la compensación')
  ok(!suenaACulpa('estoy fatal, vaya semana en el trabajo'), 'NO confunde el mal ánimo general con culpa por comer')
  ok(!suenaACulpa('hoy comí muy bien'), 'ni una frase normal')

  seccion('§12 · Los teléfonos')

  ok(faltanLosRecursos('Estoy aquí para lo que necesites.'), 'detecta que no están')
  ok(faltanLosRecursos('Llama a la Línea de la Vida, 800 911 2000.'), 'detecta que falta uno de los dos')
  ok(
    !faltanLosRecursos('Línea de la Vida 800 911 2000 y SAPTEL 55 5259 8121'),
    'los da por buenos cuando están los dos',
  )
  ok(
    !faltanLosRecursos('llama al 800-911-2000 o al 5552598121'),
    'y los reconoce escritos de otra forma',
  )
  ok(TEXTOS.contencion.includes('800 911 2000') && TEXTOS.contencion.includes('55 5259 8121'),
    'las instrucciones al modelo llevan los dos números')

  // ── El umbral ─────────────────────────────────────────────────────────────
  seccion('§12 · Ninguna señal dispara sola')

  igual((await evaluarRiesgo(USUARIO)).nivel, 0, 'sin señales, nivel 0')

  await apuntarSenal(USUARIO, 'lenguaje_de_culpa', { t: 'prueba' })
  igual((await evaluarRiesgo(USUARIO)).nivel, 0, 'con UNA señal sigue en nivel 0')

  await apuntarSenal(USUARIO, 'lenguaje_de_culpa', { t: 'prueba' })
  igual(
    (await evaluarRiesgo(USUARIO)).nivel, 0,
    'repetir la MISMA señal tampoco activa: cuentan las distintas',
  )

  await apuntarSenal(USUARIO, 'calorias_bajo_tmb', { t: 'prueba' })
  const dos = await evaluarRiesgo(USUARIO)
  igual(dos.nivel, 1, 'con dos señales distintas, nivel 1')
  igual(dos.senales.length, 2, 'y son dos')

  // ── El freno del nivel 1 ──────────────────────────────────────────────────
  seccion('§12 · Nivel 1: dejar de proponer déficits')

  const perfil = await perfilClinicoDe(USUARIO)
  const gasto = gastoTotal(perfil) ?? 2200
  await escribirGoals({ calories_target: gasto, primary: 'maintenance' })

  const bajar = await prepararAccion(USUARIO, 'actualizar_targets_nutricionales', { calorias: gasto - 200 })
  ok(!bajar.ok, 'en nivel 1 NO se prepara una bajada de calorías')
  ok(!bajar.ok && /no le propongas bajar/i.test(bajar.motivo), 'y se le dice al modelo qué hacer en su lugar')

  const { count: tarjetas } = await supabase
    .from('acciones_pendientes').select('id', { count: 'exact', head: true })
    .eq('user_id', USUARIO).eq('estado', 'pendiente')
  igual(tarjetas, 0, 'no queda ninguna tarjeta que confirmar')

  /**
   * Lo contrario sí. El §12 quita el déficit, no la capacidad de ayudar: con
   * alguien en esta situación, subir calorías es exactamente lo que se busca.
   */
  const subir = await prepararAccion(USUARIO, 'actualizar_targets_nutricionales', { calorias: gasto + 200 })
  ok(subir.ok, 'SUBIR calorías sigue permitido en nivel 1')
  if (subir.ok) await supabase.from('acciones_pendientes').delete().eq('id', subir.accion.id)

  await sinSenales()
  const bajarSano = await prepararAccion(USUARIO, 'actualizar_targets_nutricionales', { calorias: gasto - 200 })
  ok(bajarSano.ok, 'y sin señales, bajar calorías se propone con normalidad')
  if (bajarSano.ok) await supabase.from('acciones_pendientes').delete().eq('id', bajarSano.accion.id)

  // ── La señal que nace de pedir ────────────────────────────────────────────
  seccion('§12 · Pedir menos de lo que gasta en reposo')

  const tmb = metabolismoBasal(perfil)
  if (tmb !== null) {
    await sinSenales()
    const bajoTmb = await prepararAccion(USUARIO, 'actualizar_targets_nutricionales', {
      calorias: Math.round(tmb) - 300,
    })
    ok(!bajoTmb.ok, 'pedir por debajo de la TMB se rechaza')

    const { data: apuntada } = await supabase
      .from('senales_tca').select('senal').eq('user_id', USUARIO).eq('senal', 'calorias_bajo_tmb')
    ok((apuntada?.length ?? 0) >= 1, 'y queda apuntada como señal del §12')
  }

  // ── Las que se deducen ────────────────────────────────────────────────────
  seccion('§12 · Señales deducidas de la base')

  await sinSenales()
  await limpiar()
  igual((await evaluarRiesgo(USUARIO)).nivel, 0, 'sin datos raros, nivel 0')

  /**
   * Dos días con tres pesadas cada uno.
   *
   * `client_id` es obligatorio y único por usuario: sin él el `insert` falla y,
   * si no se mira el error, el fallo se disfraza de «la detección no funciona».
   * Pasó. Por eso ahora se comprueba que la siembra entró antes de sacar
   * ninguna conclusión de lo que venga después.
   */
  const pesadas = await supabase.from('body_metrics').insert([
    { user_id: USUARIO, measured_on: CENTINELA, weight_kg: 70.1, client_id: `${PREFIJO}p1` },
    { user_id: USUARIO, measured_on: CENTINELA, weight_kg: 70.4, client_id: `${PREFIJO}p2` },
    { user_id: USUARIO, measured_on: CENTINELA, weight_kg: 69.9, client_id: `${PREFIJO}p3` },
    { user_id: USUARIO, measured_on: '2098-01-02', weight_kg: 70.2, client_id: `${PREFIJO}p4` },
    { user_id: USUARIO, measured_on: '2098-01-02', weight_kg: 70.0, client_id: `${PREFIJO}p5` },
    { user_id: USUARIO, measured_on: '2098-01-02', weight_kg: 69.8, client_id: `${PREFIJO}p6` },
  ])
  ok(!pesadas.error, 'se siembran seis pesadas', pesadas.error?.message)

  const conPesajes = await evaluarRiesgo(USUARIO)
  ok(conPesajes.senales.includes('pesajes_repetidos'), 'pesarse varias veces al día se detecta')
  igual(conPesajes.nivel, 0, 'pero ella sola no activa nada')

  // Tres días comiendo por debajo de la TMB, con registro suficiente para que
  // no sea «se le olvidó apuntar la cena».
  if (tmb !== null) {
    const pocas = Math.max(400, Math.round(tmb) - 500)
    const dias = await supabase.from('meal_logs').insert(
      ['2098-01-01', '2098-01-02', '2098-01-03'].map((d, i) => ({
        user_id: USUARIO, log_date: d, meal_slot: 'breakfast', name: 't_prueba',
        amount: 100, unit: 'g', calories: pocas, protein_g: 10, carbs_g: 10, fat_g: 5, fiber_g: 1,
        client_id: `${PREFIJO}dia${i}`,
      })),
    )
    ok(!dias.error, 'se siembran tres días de ingesta baja', dias.error?.message)

    const conAmbas = await evaluarRiesgo(USUARIO)
    ok(conAmbas.senales.includes('ingesta_baja_sostenida'), 'comer bajo la TMB de forma sostenida se detecta')
    igual(conAmbas.nivel, 1, 'y con la de pesarse ya son dos: nivel 1')
  }

  await limpiar()
  await sinSenales()

  // ── El mensaje completo ───────────────────────────────────────────────────
  seccion('§12 · Lo que se le añade al prompt')

  const normal = await cuidadoDeEsteMensaje(USUARIO, '¿qué ceno hoy?', 'sesion-de-prueba')
  igual(normal.bloque, '', 'una conversación normal no añade nada al prompt')
  igual(normal.contencion, false, 'ni activa contención')

  const grave = await cuidadoDeEsteMensaje(USUARIO, 'ya no quiero seguir viviendo', 'sesion-de-prueba')
  igual(grave.contencion, true, 'la ideación activa contención')
  ok(grave.bloque.includes('800 911 2000'), 'y el bloque lleva el teléfono')
  ok(/PRIORIDAD MÁXIMA/.test(grave.bloque), 'con prioridad sobre cualquier otra cosa')

  const { data: alerta } = await supabase
    .from('audit_logs').select('action, metadata').eq('user_id', USUARIO)
    .eq('action', 'contencion_activada').order('created_at', { ascending: false }).limit(1)
  igual(alerta?.length, 1, 'queda la alerta interna para el panel (§16)')
  ok(
    JSON.stringify(alerta?.[0]?.metadata ?? {}).indexOf('quiero seguir viviendo') === -1,
    'y NO guarda lo que escribió: basta el id de la conversación',
  )

  const culpa = await cuidadoDeEsteMensaje(USUARIO, 'me odio por lo que comí', 'sesion-de-prueba')
  igual(culpa.contencion, false, 'la culpa por la comida no es contención')
  const { data: senalCulpa } = await supabase
    .from('senales_tca').select('senal').eq('user_id', USUARIO).eq('senal', 'lenguaje_de_culpa')
  ok((senalCulpa?.length ?? 0) >= 1, 'pero sí queda apuntada como señal')

  await sinSenales()
  await limpiar()
}
