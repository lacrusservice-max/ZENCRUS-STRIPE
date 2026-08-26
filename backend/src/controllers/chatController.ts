import { Request, Response } from 'express'
import { z } from 'zod'
import { DeepSeekClient } from '../../ai-integration/deepseek-client'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import { devolverCuota, fechaDelUsuario } from '../middleware/aiQuota'
import { construirSystemPrompt } from '../services/aiSystemPrompt'
import { calcularNutricion, PerfilUsuario } from '../services/nutritionCalculator'
import { AI_TOOLS, executeAiTool } from '../services/aiTools'
import { ligarAMensaje, type AccionPendiente } from '../services/confirmaciones'
import { cuidadoDeEsteMensaje, faltanLosRecursos, RECURSOS_MX } from '../services/cuidado'
import { instantaneaDelDia } from '../services/instantaneaDelDia'
import { contextoDeCiclo, cicloParaPrompt as textoCiclo } from '../services/cicloContexto'

const aiClient = new DeepSeekClient(process.env.DEEPSEEK_API_KEY || '')

async function obtenerPerfilParaIA(userId: string): Promise<{
  perfil: PerfilUsuario | null
  nombre: string | null
}> {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('full_name, weight, height, birth_date, gender, activity_level, goals, health_conditions, onboarding_data')
      .eq('id', userId)
      .maybeSingle()

    if (!user) return { perfil: null, nombre: null }

    const ob = user.onboarding_data ?? {}
    const edad = user.birth_date
      ? Math.floor((Date.now() - new Date(user.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : ob.edad ?? 25

    if (!user.weight || !user.height) return { perfil: null, nombre: user.full_name }

    const perfil: PerfilUsuario = {
      peso: user.weight,
      talla: user.height,
      edad,
      sexo: user.gender === 'female' ? 'female' : 'male',
      objetivo: mapearObjetivo(user.goals?.primary ?? ob.objetivo),
      nivelActividad: mapearActividad(user.activity_level ?? ob.nivelActividad),
      sesionesEntrenamiento: ob.sesionesEntrenamiento ?? 3,
      minutosEntrenamiento: ob.minutosEntrenamiento ?? 45,
      tipoEntrenamiento: ob.tipoEntrenamiento ?? 'mixto',
      nivelEstrés: ob.nivelEstres ?? 5,
      horasSueno: ob.horasSueno ?? 7,
      calidadSueno: ob.calidadSueno ?? 'regular',
      porcentajeGrasa: ob.porcentajeGrasa,
      diaInicioCiclo: ob.diaInicioCiclo ? new Date(ob.diaInicioCiclo) : undefined,
      usaAnticonceptivos: ob.usaAnticonceptivos,
      presupuestoSemanal: ob.presupuestoSemanal,
    }

    return { perfil, nombre: user.full_name }
  } catch {
    return { perfil: null, nombre: null }
  }
}

function mapearObjetivo(raw: string | undefined): PerfilUsuario['objetivo'] {
  const map: Record<string, PerfilUsuario['objetivo']> = {
    weight_loss: 'perdida_grasa',
    muscle_gain: 'ganancia_muscular',
    maintenance: 'mantenimiento',
    performance: 'rendimiento',
    recomposicion: 'recomposicion',
  }
  return map[raw ?? ''] ?? 'mantenimiento'
}

function mapearActividad(raw: string | undefined): PerfilUsuario['nivelActividad'] {
  const map: Record<string, PerfilUsuario['nivelActividad']> = {
    sedentary: 'sedentario',
    light: 'ligero',
    moderate: 'moderado',
    active: 'activo',
    very_active: 'muy_activo',
  }
  return map[raw ?? ''] ?? 'moderado'
}

export const createSessionSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).optional(),
  }),
})

export const sendMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
  }),
})

/**
 * El primer mensaje de cada conversación.
 *
 * Se guarda en la base, así que es lo que el usuario vuelve a leer cada vez que
 * abre ese hilo — y también lo que el modelo recibe como su propio turno
 * anterior. Por eso está escrito como habla ella y no como habla un aviso
 * legal: un párrafo en negritas y con markdown en crudo era lo primero que veía
 * alguien que acababa de instalar la app, y decía llamarse ZENCRUS.
 *
 * El límite se dice aquí en una frase y entero en su perfil (`app/zena.tsx`).
 * Repetir el prospecto completo en cada conversación nueva no lo hace más leído.
 */
const DISCLAIMER = [
  'Hola, soy ZENA, tu coach de nutrición y fitness en ZENCRUS.',
  '',
  'Conozco tu registro, tu entrenamiento y tus metas, así que no hace falta que',
  'me pongas al día: pregúntame directamente. Lo que te diga es orientación, no',
  'un diagnóstico — no sustituyo a tu médico ni a tu nutrióloga, y si algo no te',
  'cuadra con lo que ellos te dijeron, hazles caso a ellos.',
  '',
  '¿En qué andas hoy?',
].join('\n')

export async function createSession(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { title } = req.body

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      title: title || `Chat ${new Date().toLocaleDateString('es-MX')}`,
      status: 'active',
    })
    .select()
    .single()

  if (error) {
    logger.error('Error creando sesión de chat:', error.message)
    res.status(500).json({ success: false, message: 'Error creando conversación' } satisfies ApiResponse)
    return
  }

  const { data: disclaimerMessage } = await supabase
    .from('messages')
    .insert({
      session_id: session.id,
      sender_type: 'ai',
      content: DISCLAIMER,
    })
    .select()
    .single()

  res.status(201).json({
    success: true,
    data: { session, messages: [disclaimerMessage] },
  } satisfies ApiResponse)
}

export async function getSessions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId

  const { data: sessions, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo conversaciones' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: sessions } satisfies ApiResponse)
}

export async function getSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.userId

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!session) {
    res.status(404).json({ success: false, message: 'Conversación no encontrada' } satisfies ApiResponse)
    return
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', id)
    .order('created_at', { ascending: true })

  res.status(200).json({
    success: true,
    data: { session, messages: messages || [] },
  } satisfies ApiResponse)
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.userId
  const { content } = req.body

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!session) {
    res.status(404).json({ success: false, message: 'Conversación no encontrada' } satisfies ApiResponse)
    return
  }

  const { data: userMessage } = await supabase
    .from('messages')
    .insert({ session_id: id, sender_type: 'user', content })
    .select()
    .single()

  /**
   * El historial, SIN el mensaje que se acaba de guardar.
   *
   * Este `select` corre después del `insert` de arriba, así que la fila recién
   * escrita entraba en sus diez últimas — y como abajo el mensaje se añade
   * otra vez al final del array, el modelo recibía dos turnos de usuario
   * idénticos y seguidos en CADA petición. Se pagaba dos veces y ZENA leía una
   * insistencia que nadie había escrito.
   */
  let consultaHistorial = supabase
    .from('messages')
    .select('sender_type, content')
    .eq('session_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (userMessage?.id) consultaHistorial = consultaHistorial.neq('id', userMessage.id)

  const { data: previousMessages } = await consultaHistorial

  // Obtener perfil del usuario y construir system prompt personalizado
  const { perfil, nombre } = await obtenerPerfilParaIA(userId)
  const resultadoNutricional = perfil ? calcularNutricion(perfil) : null
  const base = construirSystemPrompt(perfil, resultadoNutricional, nombre ?? undefined)

  /* El ciclo, si lo hay.
     Devuelve cadena vacía cuando no hay nada que decir —sin módulo, sin
     historial, o en embarazo—, así que se concatena sin comprobar nada. Y para
     quien no tiene el módulo no llega ni una pista de que exista: la función
     fantasma se rompería con que ZENA supiera que hay algo apagado. */
  const delCiclo = textoCiclo(await contextoDeCiclo(userId))
  const systemPrompt = delCiclo ? `${base}\n\n${delCiclo}` : base

  const history = (previousMessages || []).reverse().map((m: any) => ({
    role: m.sender_type === 'ai' ? 'assistant' : 'user',
    content: m.content,
  }))

  // System prompt + aviso de que ZENA puede ejecutar cambios reales con herramientas.
  const toolsHint = `\n\nPUEDES EJECUTAR CAMBIOS REALES en la app del usuario mediante herramientas: cambiar su objetivo, actualizar su peso/actividad, ajustar sus targets nutricionales (calorías/macros/comidas) y regenerar su plan. Cuando el usuario pida un cambio de este tipo, USA la herramienta correspondiente en lugar de solo describirlo. Después confirma con lenguaje natural y cálido lo que hiciste.`

  /** El día del usuario, no el de Railway: manda la fecha que envía la app. */
  const hoy = fechaDelUsuario(req)

  /**
   * El §12, y por qué va justo aquí y no antes.
   *
   * Este bloque depende del usuario Y del mensaje que acaba de escribir, así
   * que es lo más volátil de todo el prompt. La caché de DeepSeek es por
   * prefijo: cualquier byte que cambie invalida lo que venga detrás. Puesto
   * arriba costaría los 8.800 tokens de la base de conocimiento en CADA
   * mensaje de CADA usuario; puesto aquí, al final, no rompe nada.
   *
   * `toolsHint` va delante suyo por lo mismo, aunque sea fijo: lo que importa
   * es que lo que cambia quede al final, en orden de volatilidad.
   *
   * El bloque del día —lo que lleva comido y sus metas guardadas— entra por la
   * misma puerta y por la misma razón, justo delante: cambia con cada comida
   * que se apunta, pero no con cada frase que se escribe. Los dos se piden a la
   * vez porque ninguno depende del otro, y encadenarlos sumaría su espera a un
   * mensaje que ya tiene que aguantar la del modelo.
   */
  const [cuidado, hoyEnLaApp] = await Promise.all([
    cuidadoDeEsteMensaje(userId, String(content), String(id)),
    instantaneaDelDia(userId, hoy),
  ])

  const systemFinal = [
    systemPrompt + toolsHint,
    hoyEnLaApp,
    cuidado.bloque,
  ].filter(Boolean).join('\n\n')

  const messages = [
    { role: 'system', content: systemFinal },
    ...history,
    { role: 'user', content },
  ]

  /**
   * ── Bucle de herramientas ───────────────────────────────────────────────────
   *
   * Esto era una sola ronda: se pedían herramientas, se ejecutaba lo que
   * saliera y se cerraba con texto. Alcanzaba mientras todas las herramientas
   * solo ESCRIBIERAN con datos que el usuario ya había dicho —«cambia mi
   * objetivo a ganar músculo», «subí a 78 kilos»—, porque ahí no hay nada que
   * consultar antes de actuar.
   *
   * En cuanto ZENA necesita LEER para decidir qué escribir, una ronda se queda
   * corta. «Quiero bajar 3 kilos, ajústame lo necesario» son tres pasos: leer
   * el perfil, calcular los targets nuevos, escribirlos. Con una sola ronda la
   * segunda mitad no ocurría nunca y ZENA terminaba DESCRIBIENDO el cambio en
   * vez de hacerlo — que desde fuera se ve igual que un fallo silencioso.
   *
   * El tope de rondas no es decorativo. Un modelo que se emperra en pedir la
   * misma herramienta dejaría la petición colgada quemando tokens; al agotarse
   * se hace una última llamada SIN herramientas, que lo obliga a responder con
   * palabras en lugar de devolver un turno vacío.
   */
  const MAX_RONDAS = 6

  /**
   * Techo de tiempo para todo el bucle.
   *
   * Seis rondas por treinta segundos de espera a DeepSeek son tres minutos en
   * el peor caso, y nadie mira un indicador de «escribiendo» tres minutos: la
   * app se rinde mucho antes y el usuario ve un error mientras el servidor
   * sigue trabajando y acaba guardando una respuesta que ya nadie verá.
   *
   * Con un techo aquí, el peor caso es conocido y el cliente puede esperar un
   * poco más que él —que es la única forma de que los dos plazos no se
   * contradigan—.
   */
  const TOPE_MS = 55_000
  const arranque = Date.now()

  const conversacion: any[] = [...messages]
  let finalText = 'Tuve un problema procesando tu mensaje. Intenta de nuevo en un momento.'
  let rondas = 0
  let cerrado = false

  /** Qué herramientas se han llegado a ejecutar en este mensaje. */
  const usadas = new Set<string>()
  let yaSeLeRecordo = false

  /**
   * ── Buscó y no apuntó ───────────────────────────────────────────────────
   *
   * `buscar_alimento` no cambia nada: solo devuelve candidatos. Quien apunta es
   * `registrar_comida`. Si el modelo llama a la primera y luego se pone a
   * escribir, la comida NO queda registrada — y como acaba de leer una lista
   * con el alimento y sus calorías, lo más natural que puede escribir es un
   * «listo, apunté 80 g de aguacate» que es mentira.
   *
   * Pasaba una de cada tres veces antes de afinar la descripción de la
   * herramienta, y ya no se reproduce en cinco intentos seguidos. Pero eso no
   * es haberlo arreglado: es haberlo hecho menos probable, y un fallo que
   * inventa un registro no puede depender de la suerte.
   *
   * Así que se comprueba. Si al cerrar resulta que buscó y no registró, se le
   * dice y se le da UNA ronda más — o lo apunta, o se lo dice al usuario, pero
   * no cuela un «listo» sin haberlo hecho.
   */
  /**
   * ¿El usuario pidió apuntar algo, o solo preguntaba?
   *
   * Sin esta condición el aviso salta también con «¿cuántas calorías tiene el
   * aguacate?» —que se contesta buscando, sin tocar el diario— y entonces ZENA
   * se pone a hablar del registro en vez de responder lo que le preguntaron.
   * Se probó: contestaba «como solo era una duda, no quedó apuntado nada»,
   * que nadie había preguntado.
   *
   * Los verbos son los que usa la gente para pedirlo. Si alguno falta, el
   * único coste es que el aviso no salte — nunca que salte de más.
   */
  const VERBOS_REGISTRO = /\b(ap[uú]nta|agrega|a[ñn]ade|registra|s[uú]ma|mete|anota)/i
  const pidioApuntar = VERBOS_REGISTRO.test(String(content))

  /**
   * Lo que ZENA propone y el usuario tiene que confirmar (§10).
   *
   * Las herramientas de riesgo alto ya no escriben: dejan aquí su propuesta y
   * la app la pinta con el antes y el después. Se recogen a lo largo de todas
   * las rondas porque el modelo puede proponer más de una cosa en un mismo
   * mensaje —«ajústame las calorías y rehazme la dieta»— y las dos tarjetas
   * tienen que llegar juntas.
   */
  const pendientes: AccionPendiente[] = []

  const buscoSinApuntar = () =>
    pidioApuntar && usadas.has('buscar_alimento') && !usadas.has('registrar_comida')

  /**
   * El aviso tiene que ser inofensivo cuando NO había nada que registrar.
   *
   * Buscar un alimento no siempre es el paso previo a apuntarlo: a «¿cuántas
   * calorías tiene el aguacate?» se contesta buscando y respondiendo, sin tocar
   * el diario. Un recordatorio que empujara a registrar convertiría una
   * pregunta inocente en una comida que el usuario nunca pidió apuntar.
   *
   * Por eso no ordena: informa del hecho —no está apuntado— y deja que sea ella
   * quien decida si tocaba o no. Lo único que sí prohíbe, en los dos casos, es
   * decir que lo apuntó.
   */
  const RECORDATORIO =
    'AVISO DEL SISTEMA (no lo menciones): buscaste un alimento y no llamaste a registrar_comida, ' +
    'así que NO ha quedado nada apuntado en el diario. ' +
    'Si el usuario te había pedido registrarlo, hazlo ahora con el food_id que corresponda. ' +
    'Si solo preguntaba por información, ignora este aviso y responde normal. ' +
    'En cualquier caso, NO digas ni des a entender que lo apuntaste: no es cierto.'

  try {
    while (rondas < MAX_RONDAS && Date.now() - arranque < TOPE_MS) {
      const respuesta = await aiClient.chatWithTools(conversacion, AI_TOOLS as any)

      if (!respuesta.toolCalls?.length) {
        // Una sola oportunidad: si aun con el aviso decide contestar, se
        // respeta —habrá tenido su motivo— pero al menos ya sabe que no está
        // apuntado y no puede decir lo contrario de buena fe.
        if (buscoSinApuntar() && !yaSeLeRecordo) {
          yaSeLeRecordo = true
          logger.warn(`Chat ${id}: buscó un alimento y no lo registró; se le recuerda`)
          conversacion.push(
            respuesta.assistantMessage ?? { role: 'assistant', content: respuesta.content ?? '' },
            { role: 'user', content: RECORDATORIO },
          )
          continue
        }

        finalText = respuesta.content
        cerrado = true
        break
      }

      rondas++

      // El turno del asistente va ANTES que los resultados: la API rechaza un
      // tool_call_id que no tenga delante el mensaje que lo pidió.
      conversacion.push(
        respuesta.assistantMessage ??
          { role: 'assistant', content: respuesta.content ?? '', tool_calls: respuesta.toolCalls },
      )

      for (const call of respuesta.toolCalls) {
        let args: Record<string, any> = {}
        try { args = JSON.parse(call.function?.arguments || '{}') } catch { /* args vacíos */ }
        const result = await executeAiTool(call.function?.name, args, userId, {
          hoy,
          pendientes,
        })
        if (call.function?.name) usadas.add(call.function.name)
        conversacion.push({ role: 'tool', tool_call_id: call.id, content: result })
      }
    }

    if (!cerrado) {
      const porTiempo = Date.now() - arranque >= TOPE_MS
      logger.warn(
        `Chat ${id}: se cierra sin herramientas tras ${rondas} ronda(s) — ` +
        `${porTiempo ? `${TOPE_MS / 1000}s de tope` : `tope de ${MAX_RONDAS} rondas`}`,
      )
      // El cierre va SIN herramientas, así que aquí ya no puede apuntar nada.
      // Lo único que queda es que no diga que lo hizo.
      if (buscoSinApuntar()) conversacion.push({ role: 'user', content: RECORDATORIO })

      const cierre = await aiClient.chatContinuation(conversacion)
      finalText = cierre.content
    }

    /**
     * Este número decide el costo real del chat y hasta hoy es una estimación:
     * cada ronda reenvía el prompt entero, así que el gasto mensual por usuario
     * es prácticamente lineal con este promedio. Se registra para poder
     * sustituir la suposición por una medición.
     */
    logger.info(`Chat ${id}: ${rondas} ronda(s) de herramientas`)
  } catch (err) {
    logger.error('sendMessage IA error:', err)
    // finalText ya trae el mensaje de disculpa.
    // Y el mensaje no llegó a existir, así que no se le cobra al usuario: un
    // fallo nuestro no puede comerle cuota a quien paga.
    await devolverCuota(req)
  }

  /**
   * Los teléfonos, garantizados.
   *
   * El prompt le pide a ZENA que los dé, y normalmente los da. Pero «el modelo
   * normalmente hace caso» no es un nivel de cumplimiento aceptable cuando lo
   * que está en juego es que alguien tenga a quién llamar — el §1 lo pone por
   * escrito: lo que pueda subir de «prompt» a «arquitectura», sube.
   *
   * Se comprueba que los dos números estén de verdad en la respuesta, y si
   * falta alguno se añaden. La calidez la escribe el modelo; que el número esté
   * bien lo garantiza esto.
   */
  if (cuidado.contencion && faltanLosRecursos(finalText)) {
    logger.warn(`Chat ${id}: la respuesta de contención no traía los recursos; se añaden`)
    finalText = `${finalText}\n\n${RECURSOS_MX}`
  }

  const { data: aiMessage } = await supabase
    .from('messages')
    .insert({ session_id: id, sender_type: 'ai', content: finalText })
    .select()
    .single()

  // La propuesta se guardó durante el bucle, cuando este mensaje todavía no
  // existía. Se ata ahora para que la tarjeta vuelva a salir en su sitio
  // cuando el usuario recargue el hilo.
  await ligarAMensaje(pendientes.map(p => p.id), id, aiMessage?.id ?? null)

  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)

  res.status(200).json({
    success: true,
    data: { userMessage, aiMessage, confirmaciones: pendientes },
  } satisfies ApiResponse)
}

export async function archiveSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const userId = req.user!.userId

  const { data: session } = await supabase
    .from('chat_sessions')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (!session) {
    res.status(404).json({ success: false, message: 'Conversación no encontrada' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, message: 'Conversación archivada' } satisfies ApiResponse)
}
