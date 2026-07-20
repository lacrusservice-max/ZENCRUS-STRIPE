/**
 * Motor de cálculo nutricional de ZENCRUS
 * Basado en: Módulo 01 (Fisiología) + Módulo 02 (Cálculo Energético)
 * Fuentes: Mifflin-St Jeor 1990, Katch-McArdle, ISSN Position Stand 2017
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type Sexo = 'male' | 'female'
export type Objetivo = 'perdida_grasa' | 'ganancia_muscular' | 'recomposicion' | 'mantenimiento' | 'rendimiento'
export type NivelActividad = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo'
export type FaseCiclo = 'menstrual' | 'folicular' | 'ovulacion' | 'lutea' | 'desconocida'
export type UsaAnticonceptivos = boolean

export interface PerfilUsuario {
  // Capa 0 — Datos biométricos básicos
  peso: number           // kg
  talla: number          // cm
  edad: number           // años
  sexo: Sexo
  objetivo: Objetivo

  // Capa 1 — Contexto de vida
  nivelActividad: NivelActividad
  sesionesEntrenamiento: number  // veces/semana
  minutosEntrenamiento: number   // minutos/sesión
  tipoEntrenamiento: 'fuerza' | 'cardio' | 'mixto' | 'ninguno'

  // Capa 2 — Señales metabólicas
  nivelEstrés: number        // 1-10
  horasSueno: number         // horas/noche
  calidadSueno: 'mala' | 'regular' | 'buena'

  // Opcional
  porcentajeGrasa?: number   // % grasa corporal
  diaInicioCiclo?: Date      // para sincronización de ciclo
  usaAnticonceptivos?: boolean
  presupuestoSemanal?: 'bajo' | 'medio' | 'alto'  // contexto México
}

export interface ResultadoNutricional {
  tmb: number           // kcal/día — basal
  get: number           // kcal/día — total
  objetivo_kcal: number // kcal/día — ajustado por meta
  proteina_g: number
  grasa_g: number
  carbohidratos_g: number
  ajustes: string[]     // textos de los ajustes aplicados
  alertas: string[]     // señales de alerta detectadas
  faseCiclo?: FaseCiclo
  ajustesCiclo?: AjustesCiclo
}

export interface AjustesCiclo {
  fase: FaseCiclo
  calorías_extra: number
  carbohidratos_extra: number
  micronutrientes_prioritarios: string[]
  recomendacion_entrenamiento: string
  nota: string
}

// ── Factores de actividad (Harris-Benedict revisado + Ainsworth) ──────────────

const FACTORES_ACTIVIDAD: Record<NivelActividad, number> = {
  sedentario:   1.2,   // Trabajo de oficina, sin ejercicio
  ligero:       1.375, // Ejercicio 1-3 días/semana
  moderado:     1.55,  // Ejercicio 3-5 días/semana
  activo:       1.725, // Ejercicio 6-7 días/semana o trabajo físico
  muy_activo:   1.9,   // Entrenamiento 2x/día o trabajo físico muy pesado
}

// ── Ajustes calóricos por objetivo ───────────────────────────────────────────

const AJUSTE_OBJETIVO: Record<Objetivo, { min: number; max: number; velocidad: string }> = {
  perdida_grasa:      { min: -300, max: -500, velocidad: '0.3-0.5 kg/semana' },
  ganancia_muscular:  { min: 200,  max: 350,  velocidad: '0.2-0.4 kg/semana de músculo' },
  recomposicion:      { min: -100, max: 0,    velocidad: 'Proceso lento, 12-16 semanas mínimo' },
  mantenimiento:      { min: 0,    max: 0,    velocidad: 'Mantener peso actual' },
  rendimiento:        { min: 200,  max: 400,  velocidad: 'Soporte a entrenamiento de alto rendimiento' },
}

// ── Requerimientos de proteína por objetivo ───────────────────────────────────

const PROTEINA_G_KG: Record<Objetivo, number> = {
  perdida_grasa:     1.8,
  ganancia_muscular: 2.0,
  recomposicion:     1.9,
  mantenimiento:     1.6,
  rendimiento:       2.0,
}

// ── TMB: Mifflin-St Jeor (referencia principal) ───────────────────────────────

export function calcularTMB(peso: number, talla: number, edad: number, sexo: Sexo): number {
  const base = (10 * peso) + (6.25 * talla) - (5 * edad)
  const tmb = sexo === 'male' ? base + 5 : base - 161
  return Math.round(tmb / 50) * 50  // redondear a 50 más cercano — evitar falsa precisión
}

// ── TMB: Katch-McArdle (cuando se conoce % grasa) ────────────────────────────

export function calcularTMBKatch(peso: number, porcentajeGrasa: number): number {
  const masaMagra = peso * (1 - porcentajeGrasa / 100)
  const tmb = 370 + (21.6 * masaMagra)
  return Math.round(tmb / 50) * 50
}

// ── Fase del ciclo menstrual ──────────────────────────────────────────────────

export function calcularFaseCiclo(diaInicioCiclo: Date, duracionCiclo = 28): FaseCiclo {
  const hoy = new Date()
  const diasTranscurridos = Math.floor((hoy.getTime() - diaInicioCiclo.getTime()) / (1000 * 60 * 60 * 24))
  const diaEnCiclo = ((diasTranscurridos % duracionCiclo) + duracionCiclo) % duracionCiclo + 1

  if (diaEnCiclo <= 5)  return 'menstrual'
  if (diaEnCiclo <= 13) return 'folicular'
  if (diaEnCiclo <= 16) return 'ovulacion'
  return 'lutea'
}

// ── Ajustes nutricionales por fase del ciclo ─────────────────────────────────
// Fuente: McNulty et al. 2021, Frontiers in Physiology + Módulo 04

export function calcularAjustesCiclo(fase: FaseCiclo, usaAnticonceptivos: boolean): AjustesCiclo {
  if (usaAnticonceptivos) {
    return {
      fase: 'desconocida',
      calorías_extra: 0,
      carbohidratos_extra: 0,
      micronutrientes_prioritarios: ['magnesio', 'zinc', 'B6', 'B12', 'folato'],
      recomendacion_entrenamiento: 'Entrenamiento sin restricciones por fase (ciclo suprimido por AH)',
      nota: 'Con anticonceptivos hormonales el ciclo natural está suprimido. Se priorizan los micronutrientes que los AH pueden reducir.',
    }
  }

  const ajustes: Record<FaseCiclo, AjustesCiclo> = {
    menstrual: {
      fase: 'menstrual',
      calorías_extra: 100,
      carbohidratos_extra: 25,
      micronutrientes_prioritarios: ['hierro', 'omega3', 'magnesio', 'vitamina_C'],
      recomendacion_entrenamiento: 'Reducir intensidad días 1-2. Zona 2, yoga o caminata. No forzar alta intensidad.',
      nota: 'Reponer hierro (pérdida 15-40 mg). Omega-3 reduce dismenorrea. Magnesio reduce calambres.',
    },
    folicular: {
      fase: 'folicular',
      calorías_extra: 0,
      carbohidratos_extra: 25,
      micronutrientes_prioritarios: ['hierro', 'proteina'],
      recomendacion_entrenamiento: 'VENTANA DE ORO. Priorizar sesiones intensas y de mayor volumen. Sensibilidad a insulina en máximo.',
      nota: 'Es la mejor semana del ciclo. El estrógeno protege el músculo. Aprovechar para entrenamiento de fuerza e hipertrofia.',
    },
    ovulacion: {
      fase: 'ovulacion',
      calorías_extra: 50,
      carbohidratos_extra: 15,
      micronutrientes_prioritarios: ['zinc', 'vitamina_E'],
      recomendacion_entrenamiento: 'Mantener intensidad alta. Pico de energía y fuerza. Buena coordinación neuromuscular.',
      nota: 'Pico de estrógeno y LH. Rendimiento cognitivo y físico elevado.',
    },
    lutea: {
      fase: 'lutea',
      calorías_extra: 150,
      carbohidratos_extra: 30,
      micronutrientes_prioritarios: ['calcio', 'vitamina_B6', 'magnesio'],
      recomendacion_entrenamiento: 'Adaptar, no luchar. Reducir volumen, mantener intensidad. Priorizar recuperación.',
      nota: 'Tasa metabólica basal +100-300 kcal. Calcio reduce SPM. B6 modula serotonina. Reducir cafeína días 24-28.',
    },
    desconocida: {
      fase: 'desconocida',
      calorías_extra: 0,
      carbohidratos_extra: 0,
      micronutrientes_prioritarios: ['hierro', 'calcio', 'magnesio'],
      recomendacion_entrenamiento: 'Escuchar señales del cuerpo. Sin restricciones específicas.',
      nota: 'Registra el inicio de tu ciclo para personalización por fase.',
    },
  }

  return ajustes[fase]
}

// ── Motor principal ───────────────────────────────────────────────────────────

export function calcularNutricion(perfil: PerfilUsuario): ResultadoNutricional {
  const ajustes: string[] = []
  const alertas: string[] = []

  // 1. Calcular TMB
  let tmb: number
  if (perfil.porcentajeGrasa !== undefined) {
    tmb = calcularTMBKatch(perfil.peso, perfil.porcentajeGrasa)
    ajustes.push(`TMB calculada con Katch-McArdle (${perfil.porcentajeGrasa}% grasa): ${tmb} kcal/día`)
  } else {
    tmb = calcularTMB(perfil.peso, perfil.talla, perfil.edad, perfil.sexo)
    ajustes.push(`TMB calculada con Mifflin-St Jeor: ${tmb} kcal/día`)
  }

  // 2. Calcular GET
  const factorActividad = FACTORES_ACTIVIDAD[perfil.nivelActividad]
  let get = Math.round((tmb * factorActividad) / 50) * 50
  ajustes.push(`GET (TMB × ${factorActividad}): ${get} kcal/día`)

  // 3. Ajuste por objetivo
  const ajusteObj = AJUSTE_OBJETIVO[perfil.objetivo]
  const ajusteKcal = ajusteObj.min  // Siempre empezar conservador
  let objetivo_kcal = get + ajusteKcal
  ajustes.push(`Ajuste por objetivo "${perfil.objetivo}": ${ajusteKcal > 0 ? '+' : ''}${ajusteKcal} kcal → ${objetivo_kcal} kcal/día`)

  // 4. Ajuste por estrés elevado (Módulo 02, Bloque 5.1)
  if (perfil.nivelEstrés >= 7) {
    if (ajusteKcal < -400) {
      objetivo_kcal = get - 300
      ajustes.push(`AJUSTE ESTRÉS: Déficit reducido a -300 kcal (estrés ${perfil.nivelEstrés}/10). Déficit severo + cortisol alto = peor composición corporal.`)
    }
    alertas.push(`Estrés elevado (${perfil.nivelEstrés}/10): El cortisol crónico puede sabotear los resultados. Priorizar gestión de estrés.`)
  }

  // 5. Ajuste por sueño insuficiente (Módulo 02, Bloque 5.2)
  if (perfil.horasSueno < 7) {
    ajustes.push(`AJUSTE SUEÑO: +0.2 g/kg proteína extra por sueño insuficiente (${perfil.horasSueno}h). La síntesis proteica cae hasta 30% con <6h.`)
    if (perfil.horasSueno < 6) {
      alertas.push(`Sueño crítico (<6h): Ghrelina +28%, Leptina -18% → hambre aumentada ~24% al día siguiente. El plan nutricional es menos efectivo sin sueño adecuado.`)
    }
  }

  // 6. Mínimo seguro
  const minSeguro = perfil.sexo === 'female' ? 1200 : 1500
  if (objetivo_kcal < minSeguro) {
    objetivo_kcal = minSeguro
    alertas.push(`Calorías ajustadas al mínimo seguro (${minSeguro} kcal). Por debajo de este nivel hay riesgo de RED-S y déficit nutricional.`)
  }

  // 7. Distribución de macros — Orden: Proteína → Grasa → CHO
  const ajusteProteinaExtra = perfil.horasSueno < 7 ? 0.2 : 0
  const proteina_g = Math.round(perfil.peso * (PROTEINA_G_KG[perfil.objetivo] + ajusteProteinaExtra))
  const proteina_kcal = proteina_g * 4

  // Grasa mínima por sexo y función hormonal
  const grasaMinima = perfil.sexo === 'female' ? Math.max(0.9 * perfil.peso, 45) : 0.9 * perfil.peso
  const grasa_g = Math.round(grasaMinima)
  const grasa_kcal = grasa_g * 9

  const cho_kcal = Math.max(objetivo_kcal - proteina_kcal - grasa_kcal, 0)
  const carbohidratos_g = Math.round(cho_kcal / 4)

  // 8. Ciclo menstrual (solo mujeres)
  let faseCiclo: FaseCiclo | undefined
  let ajustesCiclo: AjustesCiclo | undefined

  if (perfil.sexo === 'female') {
    if (perfil.diaInicioCiclo) {
      faseCiclo = calcularFaseCiclo(perfil.diaInicioCiclo)
    } else {
      faseCiclo = 'desconocida'
    }
    ajustesCiclo = calcularAjustesCiclo(faseCiclo, perfil.usaAnticonceptivos ?? false)

    if (ajustesCiclo.calorías_extra > 0) {
      ajustes.push(`Ajuste de ciclo (fase ${faseCiclo}): +${ajustesCiclo.calorías_extra} kcal, +${ajustesCiclo.carbohidratos_extra}g CHO`)
    }
  }

  // 9. Detectar señales RED-S
  const gastoEjercicio = perfil.sesionesEntrenamiento * perfil.minutosEntrenamiento * 7 // kcal estimadas
  const masaMagra = perfil.porcentajeGrasa
    ? perfil.peso * (1 - perfil.porcentajeGrasa / 100)
    : perfil.peso * 0.75

  const ea = (objetivo_kcal - gastoEjercicio / 7) / masaMagra
  if (perfil.sexo === 'female' && ea < 30) {
    alertas.push(`ALERTA RED-S: Disponibilidad energética estimada (${ea.toFixed(1)} kcal/kg FFM/día) está por debajo del umbral seguro (30). Riesgo de déficit energético relativo. Aumentar ingesta calórica.`)
  }

  return {
    tmb,
    get,
    objetivo_kcal,
    proteina_g,
    grasa_g,
    carbohidratos_g,
    ajustes,
    alertas,
    faseCiclo,
    ajustesCiclo,
  }
}

// ── Validar recomposición corporal ────────────────────────────────────────────
// Fuente: Barakat et al. 2020, Strength & Conditioning Journal

export function esRecomposicionViable(
  porcentajeGrasa: number | undefined,
  sexo: Sexo,
  anosEntrenamiento: number,
): { viable: boolean; razon: string } {
  const altoPorcentaje = sexo === 'male'
    ? (porcentajeGrasa ?? 0) > 25
    : (porcentajeGrasa ?? 0) > 32

  if (altoPorcentaje) {
    return { viable: true, razon: 'Alto % de grasa corporal: recomposición muy efectiva.' }
  }
  if (anosEntrenamiento < 1) {
    return { viable: true, razon: 'Principiante: las ganancias novatas permiten recomposición simultánea.' }
  }
  return {
    viable: false,
    razon: 'Perfil avanzado con bajo % grasa: fases separadas (definición / volumen) son más eficientes. La recomposición será muy lenta.',
  }
}
