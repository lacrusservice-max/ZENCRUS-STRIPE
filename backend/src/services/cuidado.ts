/**
 * CUIDADO SILENCIOSO — §12, bloques 3 y 4
 * ═══════════════════════════════════════
 *
 * Detección de trastorno de conducta alimentaria y protocolo de contención.
 *
 * ⚠️ LO PRIMERO, PORQUE CONDICIONA TODO LO DEMÁS
 * ──────────────────────────────────────────────
 * El §12 termina con un pendiente explícito: «validar los protocolos con un
 * profesional de salud mental antes de lanzar». Este archivo implementa la
 * MECÁNICA —cuándo se detecta, qué se apaga, qué se registra— y deja todo el
 * texto que oye el usuario junto, en `TEXTOS`, para que se pueda revisar sin
 * leer código. Nada de lo que hay ahí abajo está validado clínicamente.
 *
 *
 * QUÉ ES Y QUÉ NO ES
 * ──────────────────
 * El §12 lo dice con todas las letras: «esto no es vigilancia, es cuidado
 * silencioso». El nivel 1 —el que hace el 80% del trabajo— no se ve: ZENA
 * fuerza el estilo «Serena», deja de proponer déficits y quita el peso
 * objetivo de en medio. El usuario no recibe ningún aviso. Recibe una coach
 * que dejó de empujar.
 *
 * De ahí salen dos reglas que no se negocian:
 *
 *   · Ninguna señal dispara sola. Hacen falta dos en 14 días (7 en modo
 *     menor). Un falso positivo aquí le cambia el tono a alguien que estaba
 *     bien y le esconde lo que vino a buscar.
 *   · Nada se bloquea de golpe y nada se le anuncia. «Detectamos un
 *     comportamiento preocupante en tu cuenta» es exactamente lo prohibido.
 *
 *
 * POR QUÉ EL DATO EMOCIONAL NO SE CITA NUNCA
 * ──────────────────────────────────────────
 * El §9 tiene una regla que aquí es lo más importante del archivo: el estado
 * emocional solo se usa para ajustar el tono, nunca se cita ni se pregunta.
 * Quien dijo estar mal en marzo no puede recibir un «¿sigues mal?» en agosto.
 * Por eso el nivel 1 no le llega al modelo como un dato sobre el usuario, sino
 * como instrucciones de comportamiento: qué hacer, no qué sabemos de él.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import { logAudit } from './auditService'
import { perfilClinicoDe, metabolismoBasal } from './limitesClinicos'

// ── Umbrales del §12 ──────────────────────────────────────────────────────────

/** Dos o más señales dentro de la ventana. Ninguna dispara sola. */
const SENALES_PARA_ACTIVAR = 2

/** 14 días de ventana; 7 en modo menor (§13). */
const VENTANA_DIAS = 14
const VENTANA_DIAS_MENOR = 7

/** Cada cuánto puede ZENA volver a mencionarlo en voz alta. */
const REPETIR_NIVEL2_DIAS = 30

export type Senal =
  // Se apuntan cuando ocurren, dentro de una conversación.
  | 'calorias_bajo_tmb'
  | 'insiste_peso_fuera_rango'
  | 'lenguaje_de_culpa'
  // Se deducen de lo que ya hay en la base.
  | 'ingesta_baja_sostenida'
  | 'pesajes_repetidos'
  | 'borrados_repetidos'

/** Las tres que hay que apuntar en el momento o se pierden. */
type SenalDeConversacion = 'calorias_bajo_tmb' | 'insiste_peso_fuera_rango' | 'lenguaje_de_culpa'

export interface Riesgo {
  /** 0 = nada. 1 = silencioso. 2 = ZENA lo menciona. */
  nivel: 0 | 1 | 2
  senales: Senal[]
}

// ── Apuntar lo que pasa en la conversación ────────────────────────────────────

/**
 * Deja constancia de una señal.
 *
 * Nunca lanza: una detección que rompa el chat es peor que una detección que
 * se pierda. Si esto falla, el usuario sigue hablando con su coach.
 */
export async function apuntarSenal(
  userId: string,
  senal: SenalDeConversacion,
  contexto: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { error } = await supabase
      .from('senales_tca')
      .insert({ user_id: userId, senal, contexto })
    if (error) logger.warn(`No se pudo apuntar la señal ${senal}: ${error.message}`)
  } catch (err) {
    logger.warn('Señal silenciada:', err)
  }
}

/**
 * Lenguaje de culpa sobre la comida.
 *
 * El §12 la marca como «señal de apoyo, débil por sí sola», y por eso puede
 * permitirse ser un puñado de frases y no un clasificador: nunca activa nada
 * ella sola, siempre necesita otra al lado.
 *
 * Se busca la culpa referida a la COMIDA, no el ánimo en general. «Estoy fatal»
 * no entra: puede ser el trabajo. «Me odio por lo que comí» sí.
 *
 * ⚠️ Sin validar clínicamente. Es una lista de partida, no un instrumento.
 */
const CULPA = [
  // Sin `\b` al final por lo mismo que en IDEACION: «asco de mí» acaba en
  // acento y la frontera ASCII no existe ahí.
  /\b(me\s+od[ií]o|asco\s+de\s+m[ií]|soy\s+un\s+asco)[\s\S]{0,40}\b(com|cen|desayun|merend|trag)/i,
  /\b(com|cen|desayun|merend|trag)[\s\S]{0,40}\b(me\s+od[ií]o|asco\s+de\s+m[ií]|soy\s+un\s+asco)/i,
  /\bme\s+siento\s+(fatal|culpable|horrible|as[qu]eroso)\b[\s\S]{0,40}\b(com|cen|desayun|merend|trag)/i,
  /\b(com|cen|desayun|merend|trag)[\s\S]{0,40}\bme\s+siento\s+(fatal|culpable|horrible)\b/i,
  /\bno\s+deber[ií]a\s+haber\s+(comido|cenado|desayunado|probado)\b/i,
  /\b(la\s+cagu[eé]|me\s+pas[eé])\b[\s\S]{0,30}\b(comiendo|con\s+la\s+comida|otra\s+vez)\b/i,
  /\btengo\s+que\s+compensar\b/i,
  /\bme\s+lo\s+tengo\s+que\s+(quemar|sudar)\b/i,
]

export function suenaACulpa(texto: string): boolean {
  return CULPA.some(r => r.test(texto))
}

// ── Deducir lo que ya está en la base ─────────────────────────────────────────

const haceDias = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
const fechaHaceDias = (d: number) => haceDias(d).slice(0, 10)

/**
 * Pesarse varias veces al día, más de un día.
 *
 * Un día con dos pesadas es una báscula que no convencía. El patrón que
 * describe el §12 es la repetición, así que hacen falta dos días así.
 */
async function pesajesRepetidos(userId: string, dias: number): Promise<boolean> {
  const { data } = await supabase
    .from('body_metrics')
    .select('measured_on')
    .eq('user_id', userId)
    .gte('measured_on', fechaHaceDias(dias))
    .not('weight_kg', 'is', null)

  const porDia = new Map<string, number>()
  for (const f of data ?? []) porDia.set(f.measured_on, (porDia.get(f.measured_on) ?? 0) + 1)
  return [...porDia.values()].filter(n => n >= 3).length >= 2
}

/**
 * Borrar comidas ya registradas, repetidamente.
 *
 * El §12 lo llama «culpa post-registro»: apuntar algo y quitarlo después no es
 * corregir un error de gramaje, es querer que no conste. Corregir se hace
 * editando, y eso no pasa por aquí.
 */
async function borradosRepetidos(userId: string, dias: number): Promise<boolean> {
  const { count } = await supabase
    .from('meal_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', haceDias(dias))
  return (count ?? 0) >= 5
}

/**
 * Comer por debajo del metabolismo basal, sostenido.
 *
 * «Conducta, no intención», dice el §12: aquí no se mira lo que pide, sino lo
 * que hace. Se exigen tres días para que no cuente un día de gripe, y se
 * ignoran los días sin registro — que son ausencia de dato, no ayuno.
 */
async function ingestaBajaSostenida(userId: string, dias: number): Promise<boolean> {
  const tmb = metabolismoBasal(await perfilClinicoDe(userId))
  if (tmb === null) return false

  const { data } = await supabase
    .from('meal_logs')
    .select('log_date, calories, active')
    .eq('user_id', userId)
    .gte('log_date', fechaHaceDias(dias))
    .is('deleted_at', null)

  const porDia = new Map<string, number>()
  for (const f of data ?? []) {
    if (f.active === false) continue
    porDia.set(f.log_date, (porDia.get(f.log_date) ?? 0) + Number(f.calories ?? 0))
  }

  // Un día con 80 kcal apuntadas es alguien que dejó de registrar a media
  // mañana, no alguien que comió 80 kcal. Contarlo como restricción sería
  // castigar el registro incompleto, que es justo lo que no queremos.
  const diasReales = [...porDia.values()].filter(kcal => kcal > 300)
  return diasReales.filter(kcal => kcal < tmb).length >= 3
}

// ── Evaluar ───────────────────────────────────────────────────────────────────

/**
 * Qué señales hay ahora mismo y qué nivel corresponde.
 *
 * Devuelve nivel 0 ante cualquier fallo. Que la detección no funcione no puede
 * traducirse en que ZENA cambie de tono por error.
 */
export async function evaluarRiesgo(userId: string, esMenor = false): Promise<Riesgo> {
  const dias = esMenor ? VENTANA_DIAS_MENOR : VENTANA_DIAS

  try {
    const [apuntadas, baja, pesajes, borrados] = await Promise.all([
      supabase
        .from('senales_tca')
        .select('senal')
        .eq('user_id', userId)
        .gte('detectada_at', haceDias(dias)),
      ingestaBajaSostenida(userId, dias),
      pesajesRepetidos(userId, dias),
      borradosRepetidos(userId, dias),
    ])

    // Distintas, no repetidas: insistir tres veces en lo mismo es UNA señal.
    // Contar repeticiones haría que un solo mal rato cruzara el umbral solo.
    const senales = new Set<Senal>()
    for (const f of apuntadas.data ?? []) senales.add(f.senal as Senal)
    if (baja) senales.add('ingesta_baja_sostenida')
    if (pesajes) senales.add('pesajes_repetidos')
    if (borrados) senales.add('borrados_repetidos')

    const lista = [...senales]
    if (lista.length < SENALES_PARA_ACTIVAR) return { nivel: 0, senales: lista }

    // El nivel 2 es el único que se oye, y solo «si persiste»: cuatro señales
    // distintas ya no es un mal día. Debajo de eso, cuidado silencioso.
    return { nivel: lista.length >= 4 ? 2 : 1, senales: lista }
  } catch (err) {
    logger.warn('evaluarRiesgo falló, se sigue sin cuidado activo:', err)
    return { nivel: 0, senales: [] }
  }
}

/** ¿Ya se le dijo hace poco? El §12 no quiere que se repita. */
async function tocaAvisar(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('tca_estado').select('nivel2_avisado_at').eq('user_id', userId).maybeSingle()
  const ultimo = data?.nivel2_avisado_at
  if (!ultimo) return true
  return Date.now() - Date.parse(ultimo) > REPETIR_NIVEL2_DIAS * 86_400_000
}

async function marcar(userId: string, campo: 'nivel2_avisado_at' | 'nivel3_alertado_at'): Promise<void> {
  await supabase
    .from('tca_estado')
    .upsert(
      { user_id: userId, [campo]: new Date().toISOString(), actualizado_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
}

// ── Los textos que oye el usuario ─────────────────────────────────────────────

/**
 * ⚠️ TODO LO QUE HAY AQUÍ ESTÁ PENDIENTE DE VALIDACIÓN CLÍNICA.
 *
 * El §12 lo pide expresamente antes de lanzar. Está junto y aparte del resto
 * del archivo para que un profesional pueda revisarlo sin leer código: son
 * instrucciones para ZENA, no frases literales, porque una frase enlatada en
 * mitad de una conversación se nota y suena a formulario.
 */
export const TEXTOS = {
  /**
   * Nivel 1 — el usuario no se entera. Son órdenes de comportamiento, no
   * información sobre él: el §9 prohíbe citar o preguntar por el dato
   * emocional, y la mejor forma de que el modelo no lo cite es no dárselo.
   */
  nivel1: [
    'AJUSTE DE ESTILO (no lo menciones, no lo expliques, no preguntes por ello):',
    '- Usa el estilo SERENA: sin urgencia, sin metas agresivas, sin prisa.',
    '- NO propongas déficits calóricos, ni bajar calorías, ni «acelerar» resultados.',
    '- NO saques el tema del peso objetivo ni lo uses para motivar. Si lo pregunta, contesta y sigue.',
    '- Habla de lo que suma —comer suficiente, proteína, energía, descanso— y no de restringir.',
    '- Si pide comer menos, ofrécele alternativas que no pasen por recortar.',
  ].join('\n'),

  /**
   * Nivel 2 — se oye. El §12: «sin diagnosticar, sin alarmar, ofreciendo
   * recursos». Lo más fácil de hacer mal es sonar a informe médico.
   */
  nivel2: [
    'SI ENCAJA CON NATURALIDAD EN ESTA CONVERSACIÓN, y solo una vez:',
    'menciónale con cuidado que últimamente le notas dura consigo misma o consigo mismo',
    'con la comida, y que si quiere hablarlo con alguien preparado, existe gente que ayuda',
    'con esto. NO diagnostiques, NO uses las palabras «trastorno», «detectamos», «tu cuenta»',
    'ni «patrón». NO enumeres lo que ha hecho. NO lo conviertas en el tema si te dice que no.',
    'Si no encaja de forma natural, no lo fuerces: habrá otra ocasión.',
  ].join('\n'),

  /**
   * Contención — ideación suicida o autolesión.
   *
   * El §12 es tajante en por qué esto NO puede ser una negativa: «si alguien
   * expresa ideación y ZENA responde "no puedo hablar de eso", la persona
   * queda sola en el peor momento».
   */
  contencion: [
    'PRIORIDAD MÁXIMA. Deja cualquier otro tema. La persona ha expresado algo sobre',
    'hacerse daño o no querer seguir. Tu respuesta, entera, va de eso.',
    '- Responde con calidez y con calma. Sin alarmarte, sin sermonear, sin dramatizar.',
    '- NO hables de métodos, medios ni detalles, ni preguntes por ellos.',
    '- Dile que no tiene que pasarlo solo y anímale a contar con alguien de confianza.',
    '- Dale estos recursos, tal cual, en México: Línea de la Vida 800 911 2000, gratuita',
    '  y 24 horas; y SAPTEL 55 5259 8121.',
    '- NO cierres la conversación ni le digas que no puedes hablar de esto. Quédate.',
    '- Nada de nutrición, calorías, entrenamiento ni planes en esta respuesta.',
  ].join('\n'),
}

/**
 * Los recursos, en el formato exacto en que tienen que aparecer.
 *
 * Existe aparte del prompt porque el prompt es una petición y esto es una
 * garantía. El §1 lo pide así: lo que se pueda subir de «prompt» a
 * «arquitectura», sube. Un modelo puede parafrasear un teléfono, acortarlo o
 * saltárselo; que el número esté bien es lo único que no puede fallar.
 */
export const RECURSOS_MX =
  'Si en algún momento lo necesitas, en México puedes llamar a la Línea de la Vida, ' +
  '800 911 2000, gratuita y disponible 24 horas, o a SAPTEL, 55 5259 8121. ' +
  'Hay gente al otro lado preparada para escuchar.'

/**
 * ¿Aparecen de verdad los dos teléfonos?
 *
 * Se comprueba sobre los dígitos, sin espacios, porque el modelo los escribe de
 * cinco maneras distintas —«800 911 2000», «800-911-2000», «8009112000»— y las
 * cinco son válidas.
 */
export function faltanLosRecursos(texto: string): boolean {
  const digitos = texto.replace(/[^\d]/g, '')
  return !digitos.includes('8009112000') || !digitos.includes('5552598121')
}

// ── Contención ────────────────────────────────────────────────────────────────

/**
 * Ideación suicida o autolesión en lo que acaba de escribir el usuario.
 *
 * ⚠️ Sin validar clínicamente, y deliberadamente generosa: aquí un falso
 * positivo cuesta que ZENA sea especialmente cálida y ofrezca un teléfono a
 * quien no lo necesitaba. Un falso negativo cuesta lo otro. La asimetría es
 * tan grande que no hay nada que equilibrar.
 *
 * Se excluye a propósito el uso figurado más común —«me muero de hambre», «me
 * quiero morir de vergüenza»— porque en una app de comida aparece a diario y
 * convertir cada uno en un protocolo de crisis enseñaría a ignorarlo.
 */
const FIGURADO = [
  /\bme\s+muero\s+de\s+(hambre|sue[ñn]o|risa|frío|calor|ganas|amor|sed)\b/i,
  /\bme\s+quiero\s+morir\s+de\s+(vergüenza|risa|hambre)\b/i,
  /\bmuerto\s+de\s+(hambre|sue[ñn]o|risa|frío|sed)\b/i,
]

/**
 * Fin de palabra, también después de un acento.
 *
 * `\b` en JavaScript solo conoce el alfabeto ASCII, así que detrás de una
 * vocal acentuada no hay frontera y la expresión no casa. Con `\b` al final,
 * `/sin\s+m[ií]\b/` NO reconoce «sin mí» — que es una de las formas más
 * habituales de decir lo más grave que puede decir alguien aquí. Lo destaparon
 * las pruebas; a ojo pasa perfectamente por correcto.
 */
const FIN = '(?![a-záéíóúüñ])'

const IDEACION = [
  /\bquiero\s+(morirme|matarme|desaparecer\s+para\s+siempre)\b/i,
  /\bme\s+quiero\s+(morir|matar)\b/i,
  new RegExp(`\\bno\\s+quiero\\s+(seguir\\s+viviendo|vivir\\s+m[áa]s|existir)${FIN}`, 'i'),
  /\b(pensando|pienso)\s+en\s+(suicid|matarme|quitarme\s+la\s+vida)/i,
  /\bquitarme\s+la\s+vida\b/i,
  /\bacabar\s+con\s+(todo|mi\s+vida)\b/i,
  /\bno\s+vale\s+la\s+pena\s+(seguir|vivir)\b/i,
  // La autolesión se dice casi siempre en presente o en gerundio —«llevo días
  // cortándome»—, no en infinitivo. Con solo «cortarme» se escapaba entera.
  /\b(cort[áa]ndome|cortarme|me\s+cort[oé]|me\s+he\s+cortado|hacerme\s+da[ñn]o|haci[ée]ndome\s+da[ñn]o|lastimarme|lastim[áa]ndome|autolesion|autolesión)/i,
  new RegExp(`\\bestar[ií]an\\s+mejor\\s+sin\\s+m[ií]${FIN}`, 'i'),
  /\bser[ií]a\s+mejor\s+(si\s+)?no\s+(estar|estuviera|despertar)/i,
]

export function pideContencion(texto: string): boolean {
  const limpio = FIGURADO.reduce((t, r) => t.replace(r, ' '), texto)
  return IDEACION.some(r => r.test(limpio))
}

/**
 * Levanta la alerta interna del §16.
 *
 * La alerta NO es el mecanismo de emergencia y la especificación insiste en
 * ello: lo que protege a la persona en el momento es lo que ZENA responde en
 * segundos. Esto es para enterarse y dar seguimiento, y por eso no bloquea ni
 * hace esperar a nadie.
 */
export async function alertarContencion(userId: string, sessionId: string): Promise<void> {
  await logAudit({
    userId,
    action: 'contencion_activada',
    // Sin copia de lo que escribió. Es el dato más sensible del §15 y para
    // saber que hay que mirar esa conversación basta con su id.
    metadata: { session_id: sessionId },
  })
  logger.warn(`Contención activada para ${userId} en la sesión ${sessionId}`)
}

// ── Lo que se le añade al prompt ──────────────────────────────────────────────

export interface Cuidado {
  /** El bloque que se pega al final del system prompt, o vacío. */
  bloque: string
  nivel: 0 | 1 | 2
  contencion: boolean
}

/**
 * Todo junto: evalúa, decide y devuelve lo que hay que añadirle al prompt.
 *
 * ⚠️ El bloque que sale de aquí va SIEMPRE al final del system prompt, detrás
 * del perfil. Cambia por usuario y de un mensaje a otro, así que ponerlo antes
 * partiría el prefijo compartido del §7 y le costaría a cada usuario los 8.800
 * tokens de la base de conocimiento en cada mensaje.
 */
export async function cuidadoDeEsteMensaje(
  userId: string,
  mensaje: string,
  sessionId: string,
  esMenor = false,
): Promise<Cuidado> {
  const partes: string[] = []

  // La contención va primero y no depende de umbrales ni de ventanas: es de
  // ahora mismo y de este mensaje.
  const contencion = pideContencion(mensaje)
  if (contencion) {
    partes.push(TEXTOS.contencion)
    await alertarContencion(userId, sessionId).catch(() => { /* nunca bloquea */ })
  }

  if (suenaACulpa(mensaje)) {
    await apuntarSenal(userId, 'lenguaje_de_culpa', { sesion: sessionId })
  }

  const riesgo = await evaluarRiesgo(userId, esMenor)

  if (riesgo.nivel >= 1) partes.push(TEXTOS.nivel1)

  if (riesgo.nivel === 2 && await tocaAvisar(userId)) {
    partes.push(TEXTOS.nivel2)
    await marcar(userId, 'nivel2_avisado_at')
    await logAudit({ userId, action: 'tca_nivel_2', metadata: { senales: riesgo.senales } })
  }

  // Nivel 3 — la alerta interna del §16. Va con el 2, que es cuando el patrón
  // ya no es un mal día, y se marca para no repetirla en cada mensaje.
  if (riesgo.nivel === 2) {
    const { data } = await supabase
      .from('tca_estado').select('nivel3_alertado_at').eq('user_id', userId).maybeSingle()
    const ultimo = data?.nivel3_alertado_at
    if (!ultimo || Date.now() - Date.parse(ultimo) > REPETIR_NIVEL2_DIAS * 86_400_000) {
      await marcar(userId, 'nivel3_alertado_at')
      await logAudit({ userId, action: 'tca_nivel_3', metadata: { senales: riesgo.senales } })
    }
  }

  return { bloque: partes.join('\n\n'), nivel: riesgo.nivel, contencion }
}
