import { supabase } from '../config/supabase'
import { logger } from '../config/logger'

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

// ── Ejecutor: aplica la herramienta y devuelve un resumen legible ─────────────
export async function executeAiTool(name: string, args: Record<string, any>, userId: string): Promise<string> {
  try {
    switch (name) {
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
