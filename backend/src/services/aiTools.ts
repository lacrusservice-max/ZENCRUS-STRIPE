import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import { searchCatalog, getCatalogFoodById } from './catalogService'
import { calcularRachas, sumarDias } from './streaks'

// ── Definición de herramientas (formato OpenAI/DeepSeek) ──────────────────────
// La IA (ZENA) puede invocarlas para ejecutar cambios reales en el plan del usuario.
export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'actualizar_objetivo',
      description: 'Cambia el objetivo principal de fitness del usuario y opcionalmente su peso objetivo. Úsala cuando el usuario diga que quiere cambiar su meta (bajar de peso, ganar músculo, mantenerse, recomposición o rendimiento).',
      parameters: {
        type: 'object',
        properties: {
          objetivo: { type: 'string', enum: ['perder_grasa', 'ganar_musculo', 'mantener', 'recomposicion', 'rendimiento'], description: 'El nuevo objetivo principal.' },
          peso_objetivo: { type: 'number', description: 'Peso objetivo en kg (opcional).' },
        },
        required: ['objetivo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'actualizar_datos_fisicos',
      description: 'Actualiza datos físicos del usuario: peso actual (kg) y/o nivel de actividad. Úsala cuando el usuario reporte un peso nuevo o cambie su nivel de actividad.',
      parameters: {
        type: 'object',
        properties: {
          peso: { type: 'number', description: 'Peso actual en kg.' },
          nivel_actividad: { type: 'string', enum: ['sedentario', 'ligero', 'moderado', 'activo', 'muy_activo'], description: 'Nivel de actividad física.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'actualizar_targets_nutricionales',
      description: 'Ajusta los objetivos diarios de nutrición del usuario (calorías, proteína, carbohidratos, grasa o número de comidas). Úsala cuando el usuario pida cambiar sus macros o calorías.',
      parameters: {
        type: 'object',
        properties: {
          calorias: { type: 'number', description: 'Calorías objetivo por día (kcal).' },
          proteina: { type: 'number', description: 'Proteína objetivo por día (g).' },
          carbohidratos: { type: 'number', description: 'Carbohidratos objetivo por día (g).' },
          grasa: { type: 'number', description: 'Grasa objetivo por día (g).' },
          comidas_por_dia: { type: 'number', description: 'Número de comidas al día.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_registro',
      description: 'Lee lo que el usuario lleva comido: totales por día y los alimentos de cada uno. Úsala SIEMPRE antes de opinar sobre su alimentación, en vez de fiarte de lo que te hayan contado en el mensaje. Responde a «¿cuántas calorías llevo?», «¿qué comí ayer?», «¿voy bien de proteína?».',
      parameters: {
        type: 'object',
        properties: {
          dias: {
            type: 'number',
            description: 'Cuántos días hacia atrás, contando hoy. 1 es solo hoy. Máximo 14.',
          },
          detalle: {
            type: 'boolean',
            description: 'true para ver los alimentos uno por uno; false (por defecto) solo los totales de cada día.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_progreso',
      description: 'Lee el progreso del usuario: peso y cómo ha cambiado, rachas, con qué constancia registra y qué porcentaje de sus calorías viene de ultraprocesados. Úsala para responder «¿cómo voy?», «¿cuánto peso?», «¿estoy mejorando?» y antes de proponer cualquier ajuste.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_en_memoria',
      description: 'Busca en todo lo que el usuario te ha contado en conversaciones anteriores, incluidas las que ya cerró. Úsala cuando mencione algo del pasado que no esté en los últimos mensajes — «lo de mi rodilla», «el plan que hicimos», «ya te había dicho que no como pescado»— y antes de decir que no te acuerdas de algo.',
      parameters: {
        type: 'object',
        properties: {
          consulta: {
            type: 'string',
            description: 'Palabras clave de lo que buscas. Una o dos bastan: "rodilla", "pescado", "lesión". Con frases largas encuentra menos.',
          },
        },
        required: ['consulta'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_entrenamientos',
      description: 'Lee cómo está entrenando el usuario: sus últimas sesiones con volumen y duración, y sus récords personales. Úsala antes de opinar sobre su entrenamiento o de proponerle nada — responde a «¿cómo voy en el gym?», «¿cuánto levanté la última vez?», «¿cuál es mi récord en press?».',
      parameters: {
        type: 'object',
        properties: {
          dias: {
            type: 'number',
            description: 'Cuántos días hacia atrás mirar. Por defecto 30, máximo 90.',
          },
          records: {
            type: 'boolean',
            description: 'true (por defecto) para incluir sus récords personales.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_alimento',
      description: 'Busca alimentos en el catálogo y devuelve los candidatos con sus valores por 100 g. SIEMPRE úsala antes de registrar_comida: es de donde salen los números. Elige tú cuál de los resultados corresponde a lo que dijo el usuario — «carne de res molida» puede aparecer como «Molida de res». Si ninguno encaja, dilo en vez de forzar uno.',
      parameters: {
        type: 'object',
        properties: {
          consulta: {
            type: 'string',
            description: 'El alimento, en español y sin la cantidad. Si la primera búsqueda no da nada bueno, prueba con menos palabras: "carne molida" antes que "carne de res molida cocinada".',
          },
        },
        required: ['consulta'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_comida',
      description: 'Apunta en el diario del usuario un alimento que ya encontraste con buscar_alimento. Úsala cuando pida registrar, apuntar, agregar o añadir algo que comió. Necesita el food_id EXACTO que devolvió la búsqueda: no lo inventes ni lo escribas de memoria.',
      parameters: {
        type: 'object',
        properties: {
          food_id: {
            type: 'string',
            description: 'El id que devolvió buscar_alimento para la opción elegida.',
          },
          gramos: {
            type: 'number',
            description: 'Cantidad en gramos. Si el usuario habló en piezas o tazas, conviértelo a gramos con una porción razonable.',
          },
          comida: {
            type: 'string',
            enum: ['desayuno', 'almuerzo', 'comida', 'cena', 'snack'],
            description: 'En qué tiempo de comida va. Si no lo dice, deduce por la hora o pregunta.',
          },
          fecha: {
            type: 'string',
            description: 'Día en formato YYYY-MM-DD. Omítela para hoy.',
          },
        },
        required: ['food_id', 'gramos', 'comida'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'regenerar_plan',
      description: 'Marca el plan de alimentación y/o rutina para que se regenere con la IA según el perfil actualizado del usuario. Úsala cuando el usuario pida un plan nuevo o rehacer su dieta/rutina.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['dieta', 'rutina', 'ambos'], description: 'Qué regenerar.' },
        },
        required: ['tipo'],
      },
    },
  },
] as const

// Dos campos paralelos leen el objetivo con vocabularios distintos:
// goals.primary (generación de dieta con IA) y goals.main_goal (pantalla de Perfil).
// Se escriben ambos siempre para que ningún lado quede desactualizado.
const OBJETIVO_MAP: Record<string, string> = {
  perder_grasa: 'weight_loss',
  ganar_musculo: 'muscle_gain',
  mantener: 'maintenance',
  recomposicion: 'recomposicion',
  rendimiento: 'performance',
}
const OBJETIVO_MAIN_GOAL_MAP: Record<string, string> = {
  perder_grasa: 'lose_fat',
  ganar_musculo: 'gain_muscle',
  mantener: 'maintain',
  recomposicion: 'maintain',
  rendimiento: 'maintain',
}
const ACTIVIDAD_MAP: Record<string, string> = {
  sedentario: 'sedentary',
  ligero: 'light',
  moderado: 'moderate',
  activo: 'active',
  muy_activo: 'very_active',
}

async function getGoals(userId: string): Promise<Record<string, any>> {
  const { data } = await supabase.from('users').select('goals').eq('id', userId).maybeSingle()
  return (data?.goals && typeof data.goals === 'object') ? data.goals : {}
}

/**
 * Los seis huecos del diario, dichos como los dice la gente.
 *
 * «Comida» y «almuerzo» caen los dos en `lunch` a propósito: en México la
 * comida fuerte del mediodía es «la comida» y en España «el almuerzo», y la
 * pantalla solo tiene un hueco para eso.
 */
const COMIDA_A_HUECO: Record<string, string> = {
  desayuno: 'breakfast',
  almuerzo: 'lunch',
  comida: 'lunch',
  cena: 'dinner',
  snack: 'snack1',
}

/** El camino de vuelta, para contar el diario como lo diría el usuario. */
const HUECO_A_COMIDA: Record<string, string> = {
  breakfast: 'desayuno', lunch: 'comida', dinner: 'cena',
  snack1: 'snack', snack2: 'snack', snack3: 'snack',
}

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** El día de Ciudad de México. Solo se usa si el cliente no manda el suyo. */
const hoyMexico = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

const redondear = (n: number) => Math.round(n * 10) / 10

/**
 * Lo que la herramienta necesita saber del usuario y que NO puede venir del
 * modelo.
 *
 * `hoy` es la fecha del reloj de quien escribe. Va aquí y no como parámetro de
 * la herramienta por lo mismo que el `userId`: si el modelo pudiera elegirla,
 * un texto pegado en el chat podría escribir en cualquier día del calendario.
 */
export interface ContextoHerramienta {
  hoy?: string
}

export async function executeAiTool(
  name: string,
  args: Record<string, any>,
  userId: string,
  ctx: ContextoHerramienta = {},
): Promise<string> {
  try {
    switch (name) {
      /**
       * ── Consultar el registro ─────────────────────────────────────────────
       *
       * ZENA lee el diario de la base, no de lo que le cuenten en el mensaje.
       *
       * La pantalla ya le manda un resumen del día en el contexto, y con eso
       * bastaba para saludar; pero ese resumen es de HOY y es el que la app
       * tenía cargado, así que cualquier pregunta sobre ayer, sobre la semana o
       * sobre lo que acabe de apuntar ella misma se contestaba de memoria. Un
       * coach que opina sobre lo que come alguien sin mirarlo no está leyendo:
       * está adivinando.
       */
      case 'consultar_registro': {
        const dias = Math.min(Math.max(Math.round(Number(args.dias) || 1), 1), 14)
        const hoy = ctx.hoy && ES_FECHA.test(ctx.hoy) ? ctx.hoy : hoyMexico()
        const desde = sumarDias(hoy, -(dias - 1))

        const { data, error } = await supabase
          .from('meal_logs')
          .select('log_date, meal_slot, name, amount, unit, calories, protein_g, carbs_g, fat_g, fiber_g, active')
          .eq('user_id', userId)
          .gte('log_date', desde)
          .lte('log_date', hoy)
          .is('deleted_at', null)
          .order('log_date', { ascending: true })
          .order('created_at', { ascending: true })

        if (error) throw error
        if (!data?.length) {
          return dias === 1
            ? `El usuario no ha registrado nada hoy (${hoy}).`
            : `El usuario no ha registrado nada entre el ${desde} y el ${hoy}.`
        }

        const porDia = new Map<string, typeof data>()
        for (const f of data) {
          const l = porDia.get(f.log_date) ?? []
          l.push(f)
          porDia.set(f.log_date, l as typeof data)
        }

        const detalle = args.detalle === true
        const lineas: string[] = []

        for (const [fecha, filas] of [...porDia.entries()].sort()) {
          // Las entradas con `active: false` siguen visibles en el diario pero
          // están fuera de los totales: son «esto lo dejé a la mitad».
          const cuentan = filas.filter(f => f.active !== false)
          const t = cuentan.reduce((a, f) => ({
            kcal: a.kcal + Number(f.calories),
            prot: a.prot + Number(f.protein_g),
            carb: a.carb + Number(f.carbs_g),
            gras: a.gras + Number(f.fat_g),
          }), { kcal: 0, prot: 0, carb: 0, gras: 0 })

          lineas.push(
            `${fecha}${fecha === hoy ? ' (hoy)' : ''}: ${Math.round(t.kcal)} kcal, ` +
            `${redondear(t.prot)} g proteína, ${redondear(t.carb)} g carbos, ${redondear(t.gras)} g grasa ` +
            `— ${cuentan.length} alimento(s)`,
          )

          if (detalle) {
            for (const f of filas) {
              lineas.push(
                `    · ${HUECO_A_COMIDA[f.meal_slot] ?? f.meal_slot}: ${f.name}, ` +
                `${Number(f.amount)} ${f.unit} — ${Math.round(Number(f.calories))} kcal` +
                `${f.active === false ? ' (fuera de los totales)' : ''}`,
              )
            }
          }
        }

        return `Registro del usuario (${desde} a ${hoy}):\n${lineas.join('\n')}`
      }

      /**
       * ── Consultar el progreso ─────────────────────────────────────────────
       *
       * Peso, rachas, constancia y ultraprocesados, que es lo que pide el §10.
       *
       * El porcentaje de ultraprocesados no es un adorno: es la métrica que
       * encarna la filosofía del §2. «Bajaste 3 kilos» lo dice cualquier app;
       * «pasaste de 60 % a 35 % de ultraprocesados» es buena alimentación
       * medida, y es lo que ZENA puede celebrar sin señalar ninguna comida.
       */
      case 'consultar_progreso': {
        const hoy = ctx.hoy && ES_FECHA.test(ctx.hoy) ? ctx.hoy : hoyMexico()
        const hace30 = sumarDias(hoy, -29)
        const hace14 = sumarDias(hoy, -13)

        const [pesos, actividad, comidas] = await Promise.all([
          supabase.from('body_metrics')
            .select('measured_on, weight_kg')
            .eq('user_id', userId).not('weight_kg', 'is', null)
            .order('measured_on', { ascending: false }).limit(30),
          supabase.from('activity_days')
            .select('activity_date, logged_food, logged_workout, check_in_done, drank_water, protegido')
            .eq('user_id', userId).order('activity_date', { ascending: false }).limit(400),
          supabase.from('meal_logs')
            .select('log_date, calories, active, foods ( kind )')
            .eq('user_id', userId).gte('log_date', hace14).lte('log_date', hoy)
            .is('deleted_at', null),
        ])

        const partes: string[] = []

        // ── Peso ────────────────────────────────────────────────────────────
        const p = pesos.data ?? []
        if (!p.length) {
          partes.push('Peso: no ha registrado ninguno.')
        } else {
          const ultimo = p[0]
          const viejo = p.find(x => x.measured_on <= hace30) ?? p[p.length - 1]
          const delta = Number(ultimo.weight_kg) - Number(viejo.weight_kg)
          partes.push(
            `Peso: ${Number(ultimo.weight_kg)} kg el ${ultimo.measured_on}.` +
            (p.length > 1 && viejo !== ultimo
              ? ` Antes ${Number(viejo.weight_kg)} kg el ${viejo.measured_on}: ${delta >= 0 ? '+' : ''}${redondear(delta)} kg.`
              : ' Es su única medición, todavía no hay tendencia.'),
          )
        }

        // ── Rachas ──────────────────────────────────────────────────────────
        const dias = (actividad.data ?? []).map(d => ({
          date: d.activity_date,
          loggedFood: d.logged_food,
          loggedWorkout: d.logged_workout,
          checkInDone: d.check_in_done,
          drankWater: d.drank_water,
          protegido: d.protegido,
        }))
        const r = calcularRachas(dias, hoy)
        partes.push(
          `Racha: ${r.current} día(s) seguidos. Su mejor racha son ${r.longest}. ` +
          `${r.totalActive} día(s) activos en total.` +
          (r.lastActiveDate ? ` Último día con actividad: ${r.lastActiveDate}.` : ''),
        )

        // ── Constancia al registrar ─────────────────────────────────────────
        const filas = comidas.data ?? []
        const conRegistro = new Set(filas.map((f: any) => f.log_date)).size
        partes.push(`Constancia: registró comida ${conRegistro} de los últimos 14 días.`)

        // ── Ultraprocesados ─────────────────────────────────────────────────
        // Solo cuentan las entradas que vienen del catálogo: las escritas a
        // mano no tienen clasificación y meterlas como «naturales» inflaría el
        // dato a favor. Mejor decir sobre cuántas se calcula.
        const clasificadas = filas.filter((f: any) => f.active !== false && f.foods?.kind)
        if (!clasificadas.length) {
          partes.push('Ultraprocesados: aún no hay suficientes alimentos del catálogo para calcularlo.')
        } else {
          const total = clasificadas.reduce((a: number, f: any) => a + Number(f.calories), 0)
          const ultra = clasificadas
            .filter((f: any) => f.foods.kind === 'ultraprocesado')
            .reduce((a: number, f: any) => a + Number(f.calories), 0)
          const pct = total > 0 ? Math.round((ultra / total) * 100) : 0
          partes.push(
            `Ultraprocesados: ${pct} % de sus calorías de los últimos 14 días ` +
            `(sobre ${clasificadas.length} alimento(s) del catálogo).`,
          )
        }

        return `Progreso del usuario al ${hoy}:\n- ${partes.join('\n- ')}`
      }

      /**
       * ── Buscar en la memoria ──────────────────────────────────────────────
       *
       * El §9 describe la memoria en tres capas, y la tercera —el archivo— es
       * «histórico completo, solo bajo consulta». Esa es esta herramienta.
       *
       * Hoy el archivo son las conversaciones: todo lo que el usuario ha
       * escrito alguna vez, incluidas las sesiones que ya cerró. No es la tabla
       * de memoria consolidada que pide el §9 —esa necesita su migración y su
       * proceso semanal— pero es lo que de verdad existe, y resuelve el caso
       * que importa: que ZENA no diga «no me acuerdo» de algo que el usuario le
       * contó hace tres semanas.
       *
       * Se buscan SOLO los mensajes del usuario, no los de ella. Lo que dijo
       * ZENA no es memoria de nadie: es su propia voz, y dejarla entrar
       * convierte cualquier búsqueda en un eco de sus respuestas anteriores.
       */
      case 'buscar_en_memoria': {
        const consulta = String(args.consulta ?? '').trim()
        if (consulta.length < 2) return 'Dime qué buscar en la memoria.'

        // Las sesiones del usuario primero: `messages` no tiene `user_id`, así
        // que sin esto se estaría buscando en las conversaciones de todos.
        const { data: sesiones } = await supabase
          .from('chat_sessions').select('id').eq('user_id', userId)

        const ids = (sesiones ?? []).map(s => s.id)
        if (!ids.length) return 'No hay conversaciones anteriores donde buscar.'

        const { data, error } = await supabase
          .from('messages')
          .select('content, created_at')
          .in('session_id', ids)
          .eq('sender_type', 'user')
          .ilike('content', `%${consulta}%`)
          .order('created_at', { ascending: false })
          .limit(12)

        if (error) throw error
        if (!data?.length) {
          return `El usuario nunca ha mencionado "${consulta}" en sus conversaciones. No te lo inventes: si hace falta, pregúntale.`
        }

        const lineas = data.map(m =>
          `- ${String(m.created_at).slice(0, 10)}: "${String(m.content).slice(0, 220)}"`,
        )
        return `Lo que el usuario ha dicho sobre "${consulta}" (${data.length} mensaje(s), del más reciente al más antiguo):\n${lineas.join('\n')}`
      }

      /**
       * ── Consultar entrenamientos ──────────────────────────────────────────
       *
       * Las sesiones sin terminar se marcan como tales en vez de ocultarse.
       * Una que sigue abierta significa que el usuario está entrenando AHORA o
       * que se le quedó a medias ayer, y las dos cosas son justo lo que un
       * coach querría saber antes de decir nada.
       *
       * El volumen se da tal cual está guardado. No se recalcula aquí ni se
       * estima cuando falta: una sesión de carrera no tiene volumen y decir
       * «0 kg» de una carrera de diez kilómetros sería peor que no decir nada.
       */
      case 'consultar_entrenamientos': {
        const dias = Math.min(Math.max(Math.round(Number(args.dias) || 30), 1), 90)
        const hoy = ctx.hoy && ES_FECHA.test(ctx.hoy) ? ctx.hoy : hoyMexico()
        const desde = sumarDias(hoy, -(dias - 1))

        const [sesiones, records] = await Promise.all([
          supabase.from('workout_sessions')
            .select('title, mode, status, started_at, duration_seconds, total_sets, total_reps, total_volume_kg, distance_m, calories_kcal, perceived_effort')
            .eq('user_id', userId)
            .gte('started_at', `${desde}T00:00:00Z`)
            .order('started_at', { ascending: false })
            .limit(20),
          args.records === false
            ? Promise.resolve({ data: [] as any[] })
            : supabase.from('personal_records')
                .select('exercise_name, metric, value, weight_kg, reps, achieved_at')
                .eq('user_id', userId)
                .order('achieved_at', { ascending: false })
                .limit(12),
        ])

        const partes: string[] = []
        const s = sesiones.data ?? []

        if (!s.length) {
          partes.push(`Sesiones: ninguna entre el ${desde} y el ${hoy}.`)
        } else {
          const hechas = s.filter(x => x.status === 'completed')
          const abiertas = s.filter(x => x.status === 'active')

          partes.push(
            `Sesiones: ${s.length} en los últimos ${dias} días ` +
            `(${hechas.length} terminada(s)${abiertas.length ? `, ${abiertas.length} sin terminar` : ''}).`,
          )

          for (const x of s.slice(0, 8)) {
            const trozos = [
              x.duration_seconds ? `${Math.round(Number(x.duration_seconds) / 60)} min` : null,
              x.total_sets ? `${x.total_sets} series` : null,
              x.total_reps ? `${x.total_reps} reps` : null,
              x.total_volume_kg ? `${Math.round(Number(x.total_volume_kg))} kg de volumen` : null,
              x.distance_m ? `${redondear(Number(x.distance_m) / 1000)} km` : null,
              x.calories_kcal ? `${Math.round(Number(x.calories_kcal))} kcal` : null,
              x.perceived_effort ? `esfuerzo ${x.perceived_effort}/10` : null,
            ].filter(Boolean)

            partes.push(
              `  · ${String(x.started_at).slice(0, 10)} — ${x.title ?? x.mode ?? 'sesión'}` +
              `${x.status !== 'completed' ? ` (${x.status === 'active' ? 'sin terminar' : x.status})` : ''}` +
              (trozos.length ? `: ${trozos.join(', ')}` : ': sin datos de esfuerzo'),
            )
          }
        }

        const r = records.data ?? []
        if (r.length) {
          partes.push('Récords personales:')
          for (const x of r) {
            const marca = x.weight_kg
              ? `${Number(x.weight_kg)} kg${x.reps ? ` x ${x.reps}` : ''}`
              : `${Number(x.value)}`
            partes.push(`  · ${x.exercise_name}: ${marca} (${x.metric}) el ${String(x.achieved_at).slice(0, 10)}`)
          }
        } else if (args.records !== false) {
          partes.push('Récords personales: todavía ninguno.')
        }

        return `Entrenamiento del usuario (${desde} a ${hoy}):\n${partes.join('\n')}`
      }

      /**
       * ── Buscar alimento ───────────────────────────────────────────────────
       *
       * Devuelve candidatos y deja que el MODELO elija. Es deliberado, y viene
       * de haberlo intentado al revés dos veces:
       *
       *   «arroz blanco cocido»  → «Apio cocido»        (compartían «cocido»)
       *   «carne de res molida»  → «Cola de res»        (compartían «res»)
       *   «carne de res molida»  → «Molida de carnero»  («carne» dentro de
       *                                                  «carnero»)
       *
       * Cada vez que se afinaba la regla de palabras aparecía otro parecido
       * tonto, porque el problema no es de palabras: «carne de res molida» y
       * «Molida de res» son lo mismo sin compartir estructura, y «carne» y
       * «carnero» comparten letras sin ser nada parecido. Eso es semántica, y
       * es exactamente lo que un modelo de lenguaje hace mejor que cualquier
       * heurística que uno escriba a mano.
       *
       * El reparto queda así, y es el del §4 de la especificación: el modelo
       * elige CUÁL, el catálogo pone CUÁNTO. Los números no los toca nadie más.
       */
      case 'buscar_alimento': {
        const consulta = String(args.consulta ?? '').trim()
        if (consulta.length < 2) return 'Dime qué alimento buscar.'

        const encontrados = await searchCatalog(consulta, 8)
        if (!encontrados.length) {
          return `Sin resultados para "${consulta}". Prueba con menos palabras o con el nombre genérico.`
        }

        const lista = encontrados.map(f =>
          `- food_id: ${f.id} | ${f.name} | por 100 g: ${f.per100.calories} kcal, ` +
          `${f.per100.protein} g proteína, ${f.per100.carbs} g carbos, ${f.per100.fat} g grasa | ${f.sourceLabel}`,
        ).join('\n')

        return `Resultados para "${consulta}":\n${lista}\n\n` +
          'Elige el que corresponda a lo que dijo el usuario y pásale su food_id a registrar_comida. ' +
          'Si ninguno es lo que pidió, dilo en vez de forzar uno.'
      }

      /**
       * ── Registrar comida ──────────────────────────────────────────────────
       *
       * No acepta calorías como parámetro. No es que se confíe en que el modelo
       * no las mande: es que no hay dónde mandarlas. Salen de la ficha del
       * catálogo, que es la única con fuente.
       */
      case 'registrar_comida': {
        const gramos = Number(args.gramos)
        if (!Number.isFinite(gramos) || gramos <= 0 || gramos > 5000) {
          return 'La cantidad no es válida. Dime cuántos gramos son, entre 1 y 5000.'
        }

        const hueco = COMIDA_A_HUECO[String(args.comida ?? '').toLowerCase()]
        if (!hueco) {
          return 'No reconocí el tiempo de comida. Puede ser desayuno, comida, cena o snack.'
        }

        const fecha = ES_FECHA.test(String(args.fecha ?? ''))
          ? String(args.fecha)
          : (ctx.hoy && ES_FECHA.test(ctx.hoy) ? ctx.hoy : hoyMexico())

        // El id tiene que ser uno que el catálogo reconozca. Si el modelo se lo
        // inventa —o lo recuerda de otra conversación— aquí se acaba: sin ficha
        // no hay números, y sin números no se apunta nada.
        const alimento = await getCatalogFoodById(String(args.food_id ?? ''))
        if (!alimento) {
          logger.info(`registrar_comida: food_id desconocido "${args.food_id}"`)
          return 'Ese food_id no existe en el catálogo. Usa buscar_alimento primero y pásame uno de los que devuelva.'
        }

        const factor = gramos / 100
        const macros = {
          calories: Math.round(alimento.per100.calories * factor),
          protein_g: redondear(alimento.per100.protein * factor),
          carbs_g: redondear(alimento.per100.carbs * factor),
          fat_g: redondear(alimento.per100.fat * factor),
          fiber_g: redondear(alimento.per100.fiber * factor),
        }

        const { error } = await supabase.from('meal_logs').upsert({
          user_id: userId,
          log_date: fecha,
          // La app pone su `clientId`; aquí no hay app. Se compone uno estable
          // por si la misma llamada se reintenta: la llave única evita el
          // duplicado sin necesidad de comprobar antes.
          client_id: `zena_${fecha}_${hueco}_${alimento.id}_${gramos}`,
          meal_slot: hueco,
          food_id: alimento.id,
          name: alimento.name,
          amount: gramos,
          unit: 'g',
          ...macros,
          active: true,
          source: 'ai',
        }, { onConflict: 'user_id,client_id' })

        if (error) throw error

        return `Apuntado: ${alimento.name}, ${gramos} g en ${args.comida} del ${fecha}. ` +
          `${macros.calories} kcal, ${macros.protein_g} g de proteína, ${macros.carbs_g} g de carbos, ${macros.fat_g} g de grasa. ` +
          `Fuente: ${alimento.sourceLabel}.`
      }

      case 'actualizar_objetivo': {
        const goals = await getGoals(userId)
        goals.primary = OBJETIVO_MAP[args.objetivo] ?? goals.primary ?? 'maintenance'
        goals.main_goal = OBJETIVO_MAIN_GOAL_MAP[args.objetivo] ?? goals.main_goal ?? 'maintain'
        if (typeof args.peso_objetivo === 'number') goals.goal_weight = args.peso_objetivo
        const { error } = await supabase.from('users').update({ goals, updated_at: new Date().toISOString() }).eq('id', userId)
        if (error) throw error
        return `Objetivo actualizado a "${args.objetivo}"${args.peso_objetivo ? ` con peso objetivo ${args.peso_objetivo} kg` : ''}.`
      }
      case 'actualizar_datos_fisicos': {
        const update: Record<string, any> = { updated_at: new Date().toISOString() }
        if (typeof args.peso === 'number') update.weight = args.peso
        if (args.nivel_actividad) update.activity_level = ACTIVIDAD_MAP[args.nivel_actividad] ?? args.nivel_actividad
        const { error } = await supabase.from('users').update(update).eq('id', userId)
        if (error) throw error
        const partes = [
          typeof args.peso === 'number' ? `peso ${args.peso} kg` : null,
          args.nivel_actividad ? `nivel de actividad "${args.nivel_actividad}"` : null,
        ].filter(Boolean)
        return `Datos físicos actualizados: ${partes.join(' y ')}.`
      }
      case 'actualizar_targets_nutricionales': {
        // IMPORTANTE: estos son los mismos nombres planos que usa el editor de
        // targets en Perfil y que lee la pantalla de Nutrición (goals.calories_target,
        // goals.protein_g, etc.) — nunca anidar en goals.custom_targets, esa ruta
        // no la lee ninguna pantalla y el cambio de la IA quedaría invisible.
        const goals = await getGoals(userId)
        if (typeof args.calorias === 'number') goals.calories_target = args.calorias
        if (typeof args.proteina === 'number') goals.protein_g = args.proteina
        if (typeof args.carbohidratos === 'number') goals.carbs_g = args.carbohidratos
        if (typeof args.grasa === 'number') goals.fat_g = args.grasa
        if (typeof args.comidas_por_dia === 'number') goals.meals_per_day = args.comidas_por_dia
        const { error } = await supabase.from('users').update({ goals, updated_at: new Date().toISOString() }).eq('id', userId)
        if (error) throw error
        const cambios = [
          typeof args.calorias === 'number' ? `${args.calorias} kcal` : null,
          typeof args.proteina === 'number' ? `${args.proteina}g proteína` : null,
          typeof args.carbohidratos === 'number' ? `${args.carbohidratos}g carbos` : null,
          typeof args.grasa === 'number' ? `${args.grasa}g grasa` : null,
          typeof args.comidas_por_dia === 'number' ? `${args.comidas_por_dia} comidas/día` : null,
        ].filter(Boolean).join(', ')
        return `Objetivos nutricionales ajustados: ${cambios}.`
      }
      case 'regenerar_plan': {
        const goals = await getGoals(userId)
        goals.needs_regen = args.tipo
        goals.needs_regen_at = new Date().toISOString()
        const { error } = await supabase.from('users').update({ goals, updated_at: new Date().toISOString() }).eq('id', userId)
        if (error) throw error
        return `Marcado para regenerar: ${args.tipo}. Se generará un plan nuevo con tu perfil actualizado.`
      }
      default:
        return `Herramienta desconocida: ${name}.`
    }
  } catch (err) {
    logger.error(`executeAiTool(${name}) error:`, err)
    return `No se pudo completar la acción "${name}". Intenta de nuevo.`
  }
}
