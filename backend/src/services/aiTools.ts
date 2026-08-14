import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import { searchCatalog } from './catalogService'

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
      name: 'registrar_comida',
      description: 'Apunta un alimento en el diario de comidas del usuario. Úsala cuando pida registrar, apuntar, agregar o añadir algo que comió o va a comer — «agrega 100 g de arroz a mi cena», «apúntame dos huevos en el desayuno». Los valores nutricionales los busca ella en el catálogo: NO los inventes ni los pases tú.',
      parameters: {
        type: 'object',
        properties: {
          alimento: {
            type: 'string',
            description: 'El alimento tal como lo dijo el usuario, en español y sin la cantidad. Ej: "arroz blanco cocido", "pechuga de pollo a la plancha".',
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
        required: ['alimento', 'gramos', 'comida'],
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
 * Palabras que describen CÓMO está el alimento, no CUÁL es.
 *
 * Existen porque el buscador es difuso y comparte estas palabras entre fichas
 * que no tienen nada que ver: «arroz blanco cocido» y «apio cocido» coinciden
 * en «cocido», y con eso basta para que un parecido tonto pase por bueno.
 */
const MODIFICADORES = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'a', 'al', 'en', 'y',
  'cocido', 'cocida', 'cocidos', 'cocidas', 'crudo', 'cruda', 'crudos', 'crudas',
  'asado', 'asada', 'frito', 'frita', 'hervido', 'hervida', 'plancha', 'horno',
  'vapor', 'blanco', 'blanca', 'integral', 'natural', 'fresco', 'fresca',
  'grande', 'chico', 'chica', 'mediano', 'mediana', 'light', 'bajo', 'alto',
])

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Las palabras que de verdad nombran al alimento. */
function palabrasClave(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter(p => p.length > 2 && !MODIFICADORES.has(p))
}

/**
 * ¿Esta ficha es de verdad lo que pidieron?
 *
 * El buscador ordena por parecido y devuelve algo casi siempre, aunque sea muy
 * malo. Para una persona eso da igual —ve la lista y elige— pero ZENA se queda
 * con el primero, y sin esta comprobación apuntaba «Apio cocido» a quien pidió
 * arroz. Un alimento equivocado en el diario es peor que no apuntar nada: no se
 * nota, y contamina todos los totales que se calculen encima.
 *
 * La regla es la mínima que resuelve el caso: alguna de las palabras que
 * nombran el alimento pedido tiene que aparecer en el nombre de la ficha.
 */
function coincideDeVerdad(consulta: string, nombreFicha: string): boolean {
  const pedidas = palabrasClave(consulta)
  if (pedidas.length === 0) return true   // solo modificadores: no hay nada que exigir
  const ficha = normalizar(nombreFicha)
  return pedidas.some(p => ficha.includes(p))
}

// ── Ejecutor: aplica la herramienta y devuelve un resumen legible ─────────────
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
       * ── Registrar comida ──────────────────────────────────────────────────
       *
       * Los macros NO los pone el modelo: se buscan en el catálogo. Es la regla
       * del §4 de la especificación —«la IA no verifica, estima»— llevada a
       * código: si le preguntas a un modelo cuántas calorías tiene el arroz
       * devuelve un número que suena bien y no tiene fuente.
       *
       * Por eso la herramienta no acepta calorías como parámetro. No es que se
       * confíe en que el modelo no las mande: es que no hay dónde mandarlas.
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

        const consulta = String(args.alimento ?? '').trim()
        if (consulta.length < 2) return 'Dime qué alimento quieres que apunte.'

        const encontrados = await searchCatalog(consulta, 8)
        // De todo lo que devuelve el buscador se coge el primero que además
        // SEA lo que se pidió, no el primero a secas.
        const alimento = encontrados.find(f => coincideDeVerdad(consulta, f.name))

        if (!alimento) {
          // Se dice que no está, en vez de apuntar un parecido. Un número sin
          // fuente —o de otro alimento— contamina todo lo que se calcule
          // después con él, y nadie lo revisa.
          logger.info(
            `registrar_comida: sin coincidencia fiable para "${consulta}"` +
            (encontrados.length ? ` (el buscador ofreció "${encontrados[0].name}")` : ' (el buscador no devolvió nada)'),
          )
          return `No encontré "${consulta}" en el catálogo, así que no lo apunté — prefiero no adivinar. Dile al usuario que lo busque en la pantalla de Nutrición, donde puede añadirlo con sus valores.`
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
