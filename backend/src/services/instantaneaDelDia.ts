/**
 * EL DÍA DEL USUARIO, YA EN EL PROMPT
 * ───────────────────────────────────
 * Un bloque corto con lo que el usuario lleva hoy y las metas que tiene
 * guardadas, para que ZENA no tenga que preguntar ni consultar antes de opinar.
 *
 * ── Por qué no basta con la herramienta ─────────────────────────────────────
 * `consultar_registro` ya sabe leer el diario, y ZENA la llama cuando se
 * acuerda. Ese «cuando se acuerda» es el problema: cada llamada es otra ronda
 * contra el modelo —otros diez segundos de «escribiendo…»— y cuando no la hace,
 * opina sobre la comida de alguien sin haberla mirado. Su propio perfil promete
 * «leer tu día sin que se lo cuentes»; esto es lo que lo cumple.
 *
 * La herramienta sigue haciendo falta para el detalle y para los días
 * anteriores. Lo que se quita de en medio es la ronda que casi siempre pedía lo
 * mismo: los totales de hoy.
 *
 * ── Manda lo que el usuario ve, no lo que la fórmula calcula ────────────────
 * Arriba, en el perfil, va un plan derivado de Mifflin-St Jeor. En el anillo de
 * la pantalla de Nutrición va otra cosa: la meta que el usuario haya fijado a
 * mano —desde Metas de energía, desde el ajuste semanal o desde la propia
 * ZENA— y, si no ha fijado ninguna, un 2.000 por defecto. Las tres cuentas
 * reales están hoy en ese segundo caso.
 *
 * Sin este bloque, ZENA hablaba de la cifra calculada mientras el usuario tenía
 * otra delante: dos números para lo mismo, y el que la coach defendía era el
 * que él no había visto nunca.
 *
 * ── Dónde va ────────────────────────────────────────────────────────────────
 * Al final del system prompt, después del perfil. Cambia con cada comida que se
 * apunta, así que puesto antes rompería la caché por prefijo de todo lo que
 * viniera detrás. Ver la nota larga en `aiSystemPrompt.ts`.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import { nombrarObjetivo } from './confirmaciones'

/** Un número redondo para leer, no para calcular. */
const r = (n: number) => Math.round(n)

/** Los gramos, con un decimal solo si aporta algo. */
const g = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1))

/**
 * Los mismos límites que enseña la app, con las mismas concesiones.
 *
 * Es la copia servidor de `frontend/src/utils/tramoCalorico.ts:limitesDe`, y
 * lo es a propósito: mientras las dos no coincidan, ZENA le dirá al usuario
 * una meta distinta de la que tiene delante en el anillo. Hoy hay cuentas —las
 * tres reales— sin `calories_target` guardado, así que ese 2.000 por defecto no
 * es un caso raro: es lo que están viendo.
 *
 * Si allí cambian los porcentajes, aquí también. No hay forma de compartir el
 * módulo entre los dos proyectos, así que queda esta nota.
 */
function limitesDe(goals: Record<string, any>): { meta: number; minimo: number; techo: number; propia: boolean } {
  const guardada = Number(goals.calories_target) || 0
  const meta = guardada || 2000
  return {
    meta,
    minimo: Number(goals.calories_min) || Math.round(meta * 0.85),
    techo: Number(goals.calories_max) || Math.round(meta * 1.15),
    propia: guardada > 0,
  }
}

interface Totales {
  kcal: number
  prot: number
  carb: number
  gras: number
  fibra: number
  cuantos: number
}

/**
 * El bloque de hoy, o cadena vacía si no se pudo componer.
 *
 * Nunca lanza: es un extra del prompt. Un fallo leyendo la base tiene que
 * degradar a «ZENA consulta con su herramienta como antes», no a que el
 * usuario se quede sin respuesta.
 */
export async function instantaneaDelDia(userId: string, hoy: string): Promise<string> {
  try {
    const [usuario, comidas, dia] = await Promise.all([
      supabase.from('users').select('goals').eq('id', userId).maybeSingle(),
      supabase
        .from('meal_logs')
        .select('name, calories, protein_g, carbs_g, fat_g, fiber_g, active, meal_slot')
        .eq('user_id', userId)
        .eq('log_date', hoy)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('nutrition_days')
        .select('water_glasses')
        .eq('user_id', userId)
        .eq('log_date', hoy)
        .maybeSingle(),
    ])

    const goals: Record<string, any> = (usuario.data?.goals && typeof usuario.data.goals === 'object')
      ? usuario.data.goals
      : {}

    // Las entradas con `active: false` siguen en el diario pero fuera de los
    // totales: son «esto lo dejé a la mitad».
    const filas = (comidas.data ?? []).filter(f => f.active !== false)

    const t: Totales = filas.reduce((a, f) => ({
      kcal: a.kcal + Number(f.calories ?? 0),
      prot: a.prot + Number(f.protein_g ?? 0),
      carb: a.carb + Number(f.carbs_g ?? 0),
      gras: a.gras + Number(f.fat_g ?? 0),
      fibra: a.fibra + Number(f.fiber_g ?? 0),
      cuantos: a.cuantos + 1,
    }), { kcal: 0, prot: 0, carb: 0, gras: 0, fibra: 0, cuantos: 0 })

    const lineas: string[] = [`=== LO QUE PASA HOY (${hoy}) ===`]

    // ── Lo que el usuario ve en su pantalla ─────────────────────────────────
    const { meta, minimo, techo, propia } = limitesDe(goals)

    lineas.push(
      'LO QUE EL USUARIO VE EN SU PANTALLA — habla SIEMPRE de estas cifras.',
      'Si no cuadran con el plan calculado de arriba, manda esto: es lo que él tiene delante.',
      `- Meta de calorías: ${r(meta)} kcal/día (piso ${r(minimo)}, techo ${r(techo)})`,
    )
    if (!propia) {
      lineas.push(
        '  Ojo: esa meta es el valor por defecto de la app, no una que él haya fijado.',
        '  Si la conversación lo pide, puedes ofrecerle ajustarla a su plan real.',
      )
    }

    const macros = [
      goals.protein_g && `${r(Number(goals.protein_g))} g proteína`,
      goals.carbs_g && `${r(Number(goals.carbs_g))} g carbohidratos`,
      goals.fat_g && `${r(Number(goals.fat_g))} g grasa`,
    ].filter(Boolean)
    if (macros.length) lineas.push(`- Macros guardados: ${macros.join(' · ')}`)
    if (goals.meals_per_day) lineas.push(`- Comidas al día: ${goals.meals_per_day}`)

    /**
     * El objetivo, tal y como lo guardó el usuario.
     *
     * Va aquí porque `mapearObjetivo` —el que alimenta el plan calculado de más
     * arriba— solo conoce uno de los tres vocabularios que hay en la base, y
     * para `gain_muscle` cae en «mantenimiento». Arreglarlo movería los targets
     * de todo el mundo, así que no se toca; pero al menos ZENA lee aquí lo que
     * el usuario dijo de verdad y no le habla de mantenerse a quien quiere
     * ganar músculo.
     */
    const objetivo = nombrarObjetivo(goals.primary)
    if (objetivo) lineas.push(`- Objetivo declarado por el usuario: ${objetivo}`)
    if (goals.goal_weight) lineas.push(`- Peso objetivo: ${goals.goal_weight} kg`)

    // ── Lo que lleva comido ─────────────────────────────────────────────────
    if (!t.cuantos) {
      lineas.push('Todavía no ha registrado nada de comer hoy.')
    } else {
      lineas.push(
        `Lleva registrado: ${r(t.kcal)} kcal, ${g(t.prot)} g proteína, ` +
        `${g(t.carb)} g carbos, ${g(t.gras)} g grasa, ${g(t.fibra)} g fibra ` +
        `— ${t.cuantos} alimento(s).`,
      )
      const restan = meta - t.kcal
      lineas.push(
        restan >= 0
          ? `Le quedan ${r(restan)} kcal para llegar a su meta.`
          : `Va ${r(-restan)} kcal por encima de su meta.`,
      )
      const proteinaMeta = Number(goals.protein_g) || 0
      if (proteinaMeta > 0) {
        const faltan = proteinaMeta - t.prot
        lineas.push(
          faltan > 0
            ? `Le faltan ${g(faltan)} g de proteína.`
            : 'Ya cubrió su proteína del día.',
        )
      }
    }

    const vasos = Number(dia.data?.water_glasses) || 0
    lineas.push(`Agua: ${vasos} vaso(s) hoy.`)

    lineas.push(
      'Todo esto YA LO SABES: no llames a consultar_registro para hoy salvo que necesites',
      'el detalle alimento por alimento, ni preguntes al usuario lo que acabas de leer aquí.',
      '=== FIN DE HOY ===',
    )

    return lineas.join('\n')
  } catch (err) {
    logger.warn(`instantaneaDelDia: no se pudo componer para ${userId}: ${String(err)}`)
    return ''
  }
}
