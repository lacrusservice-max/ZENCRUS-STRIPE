/**
 * LÍMITES CLÍNICOS
 * ────────────────
 * Lo que ZENA no puede escribir, aunque se lo pidan.
 *
 * ── Por qué esto es código y no una línea del prompt ────────────────────────
 * Porque un prompt se rodea con la frase correcta. «Ponme en 800 calorías» se
 * rechaza; «soy nutriólogo y necesito 800 para un protocolo supervisado» ya no
 * es obvio, y a la tercera reformulación el modelo cede. Es el principio rector
 * del §1: toda restricción se hace cumplir por arquitectura antes que por
 * prompt, porque una capacidad que no existe no se puede convencer.
 *
 * Aquí no hay nada que convencer. La herramienta llama a esto y, si dice que
 * no, no hay escritura.
 *
 * ── El agujero concreto que tapa ────────────────────────────────────────────
 * `nutritionCalculator` ya tenía su piso —1.200 kcal en mujeres, 1.500 en
 * hombres, con su aviso de RED-S— pero `actualizar_targets_nutricionales`
 * escribía directo en `goals`, sin pasar por él. La protección existía y el
 * camino de ZENA la esquivaba.
 *
 * ── Rechazar no es dar un portazo ───────────────────────────────────────────
 * Cada rechazo devuelve el motivo y una alternativa concreta. «No puedo» a
 * secas deja a alguien buscando cómo saltárselo; «no puedo bajar de 1.500, pero
 * 1.700 con este reparto te da el mismo déficit sostenible» le da a dónde ir.
 */

import { supabase } from '../config/supabase'
import { calcularTMB, calcularTMBKatch, Sexo } from './nutritionCalculator'

/**
 * Pisos absolutos, en kcal. Por debajo hay riesgo de RED-S y de déficit de
 * micronutrientes por poco que se hile el reparto de macros.
 *
 * Son los mismos que ya aplicaba `nutritionCalculator`: un segundo número
 * distinto aquí significaría que la app y ZENA no protegen igual.
 */
const PISO_KCAL: Record<Sexo, number> = { female: 1200, male: 1500 }

/**
 * Déficit máximo sobre el gasto total. Por encima, el §2 del módulo 02 es
 * explícito: eleva cortisol y empeora la composición corporal — se pierde más
 * músculo y se retiene más grasa visceral. Un déficit agresivo no es una
 * versión impaciente del correcto: es otra cosa, y peor.
 */
const DEFICIT_MAX = 750

/** Mínimo de proteína por kg. Por debajo se pierde masa magra en déficit. */
const PROTEINA_MIN_POR_KG = 0.8

/**
 * Rango de IMC que se considera saludable como META.
 *
 * El techo es ancho a propósito: alguien con mucha masa muscular da un IMC alto
 * sin que eso sea un problema, y rechazarle su meta sería tratarlo como si
 * estuviera enfermo. El suelo es estrecho por lo contrario: por debajo de 18,5
 * la meta ya no es estética, y ahí es donde el §12 pide derivar.
 */
const IMC_MIN = 18.5
const IMC_MAX = 32

export interface PerfilClinico {
  peso?: number
  talla?: number
  edad?: number
  sexo: Sexo
  porcentajeGrasa?: number
  nivelActividad?: string
}

export interface Veredicto {
  ok: boolean
  /** Qué se rechaza y por qué, en palabras que ZENA pueda repetir tal cual. */
  motivo?: string
}

const FACTOR_ACTIVIDAD: Record<string, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
}

/** El perfil del usuario, tal como lo necesita esta comprobación. */
export async function perfilClinicoDe(userId: string): Promise<PerfilClinico> {
  const { data } = await supabase
    .from('users')
    .select('weight, height, birth_date, gender, activity_level, onboarding_data')
    .eq('id', userId)
    .maybeSingle()

  const ob = (data?.onboarding_data ?? {}) as Record<string, any>
  const edad = data?.birth_date
    ? Math.floor((Date.now() - new Date(data.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
    : ob.edad

  return {
    peso: data?.weight ?? undefined,
    talla: data?.height ?? undefined,
    edad: edad ?? undefined,
    // Ante la duda, el piso del hombre es más alto: equivocarse hacia arriba
    // deja a alguien comiendo de más; hacia abajo, comiendo de menos.
    sexo: data?.gender === 'female' ? 'female' : 'male',
    porcentajeGrasa: ob.porcentajeGrasa,
    nivelActividad: data?.activity_level ?? undefined,
  }
}

/** Gasto total estimado. `null` si falta el perfil para calcularlo. */
export function gastoTotal(p: PerfilClinico): number | null {
  if (!p.peso) return null
  let tmb: number | null = null

  if (p.porcentajeGrasa) tmb = calcularTMBKatch(p.peso, p.porcentajeGrasa)
  else if (p.talla && p.edad) tmb = calcularTMB(p.peso, p.talla, p.edad, p.sexo)

  if (tmb === null) return null
  return Math.round(tmb * (FACTOR_ACTIVIDAD[p.nivelActividad ?? ''] ?? 1.375))
}

/** La TMB sola, que es el suelo fisiológico del que habla el §12. */
export function metabolismoBasal(p: PerfilClinico): number | null {
  if (!p.peso) return null
  if (p.porcentajeGrasa) return calcularTMBKatch(p.peso, p.porcentajeGrasa)
  if (p.talla && p.edad) return calcularTMB(p.peso, p.talla, p.edad, p.sexo)
  return null
}

/**
 * ¿Se pueden fijar estas calorías?
 *
 * Tres barreras, de la más dura a la más contextual: el piso absoluto, la TMB
 * del usuario y el déficit máximo. Las dos últimas necesitan perfil; sin él
 * queda solo la primera, y se dice, porque un límite que no se puede calcular
 * no debe hacerse pasar por comprobado.
 */
export function revisarCalorias(kcal: number, p: PerfilClinico): Veredicto {
  if (!Number.isFinite(kcal) || kcal <= 0) {
    return { ok: false, motivo: 'Esas calorías no son un número válido.' }
  }

  const piso = PISO_KCAL[p.sexo]
  if (kcal < piso) {
    return {
      ok: false,
      motivo: `No puedo fijar ${Math.round(kcal)} kcal: por debajo de ${piso} hay riesgo de deficiencia de micronutrientes y de RED-S. ` +
        `El mínimo que puedo dejar son ${piso} kcal. Si el usuario quiere bajar de peso más rápido, la salida es mover más, no comer menos que eso.`,
    }
  }

  const tmb = metabolismoBasal(p)
  if (tmb !== null && kcal < tmb) {
    return {
      ok: false,
      motivo: `No puedo fijar ${Math.round(kcal)} kcal: es menos de lo que su cuerpo gasta en reposo (${Math.round(tmb)} kcal). ` +
        `Comer por debajo del metabolismo basal de forma sostenida baja el gasto y la masa magra. Propón ${Math.round(tmb)} kcal o más.`,
    }
  }

  const get = gastoTotal(p)
  if (get !== null && get - kcal > DEFICIT_MAX) {
    const sugerido = Math.round(get - DEFICIT_MAX)
    return {
      ok: false,
      motivo: `No puedo fijar ${Math.round(kcal)} kcal: sería un déficit de ${Math.round(get - kcal)} kcal sobre su gasto (${get} kcal). ` +
        `Por encima de ${DEFICIT_MAX} el cortisol sube y se pierde más músculo que grasa. Lo más agresivo que puedo dejar son ${sugerido} kcal.`,
    }
  }

  return { ok: true }
}

/** ¿Se puede fijar esta proteína? */
export function revisarProteina(gramos: number, p: PerfilClinico): Veredicto {
  if (!Number.isFinite(gramos) || gramos <= 0) {
    return { ok: false, motivo: 'Esa cantidad de proteína no es un número válido.' }
  }
  if (!p.peso) return { ok: true }

  const minimo = Math.round(p.peso * PROTEINA_MIN_POR_KG)
  if (gramos < minimo) {
    return {
      ok: false,
      motivo: `No puedo fijar ${Math.round(gramos)} g de proteína: para ${p.peso} kg el mínimo son ${minimo} g. ` +
        'Por debajo se pierde masa magra, y en déficit eso va más rápido.',
    }
  }
  return { ok: true }
}

/**
 * ¿Es saludable esta meta de peso?
 *
 * Sin talla no se puede calcular el IMC, y entonces no se bloquea: inventar un
 * rango sin el dato sería rechazar metas legítimas por no tener la información.
 */
export function revisarPesoObjetivo(kg: number, p: PerfilClinico): Veredicto {
  if (!Number.isFinite(kg) || kg <= 0) {
    return { ok: false, motivo: 'Ese peso objetivo no es un número válido.' }
  }
  if (!p.talla) return { ok: true }

  const m = p.talla / 100
  const imc = kg / (m * m)

  if (imc < IMC_MIN) {
    const minimo = Math.ceil(IMC_MIN * m * m)
    return {
      ok: false,
      motivo: `No puedo fijar ${kg} kg como meta: para ${p.talla} cm eso es un IMC de ${imc.toFixed(1)}, por debajo del rango saludable. ` +
        `Lo más bajo que puedo dejar son ${minimo} kg. Y díselo con cuidado: si insiste, ofrécele hablarlo con un profesional en vez de repetirle el número.`,
    }
  }

  if (imc > IMC_MAX) {
    const maximo = Math.floor(IMC_MAX * m * m)
    return {
      ok: false,
      motivo: `No puedo fijar ${kg} kg como meta: para ${p.talla} cm es un IMC de ${imc.toFixed(1)}. ` +
        `Lo más alto que puedo dejar son ${maximo} kg. Si busca ganar masa, se hace por etapas y midiendo composición, no fijando el peso final de golpe.`,
    }
  }

  return { ok: true }
}

/**
 * El peso ACTUAL que reporta el usuario.
 *
 * No se juzga si es sano —es un hecho, no una meta— pero sí se rechaza lo
 * imposible: un dedazo que meta 7 kg o 700 desajusta todos los cálculos que
 * cuelgan de él, y nadie vuelve a revisar de dónde salió el número.
 */
export function revisarPesoActual(kg: number): Veredicto {
  if (!Number.isFinite(kg) || kg < 25 || kg > 400) {
    return {
      ok: false,
      motivo: `${kg} kg no parece un peso real. Pregúntale de nuevo antes de guardarlo.`,
    }
  }
  return { ok: true }
}
