import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import { searchCatalog, getCatalogFoodById } from './catalogService'

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
