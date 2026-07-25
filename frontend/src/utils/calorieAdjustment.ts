// Ajuste automático semanal de calorías — ZENCRUS
// Compara el progreso REAL de peso contra la meta y SUGIERE (nunca fuerza)
// un ajuste de calorías, con una explicación clara del porqué.
// Regla de energía: ~7700 kcal equivalen a ~1 kg de tejido corporal.

export type Goal = 'perder_grasa' | 'ganar_musculo' | 'mantener' | 'recomposicion' | 'rendimiento'

export interface WeighIn { date: string; weightKg: number } // ordenado o no, se ordena internamente

export interface AdjustmentSuggestion {
  shouldAdjust: boolean
  deltaKcal: number          // + para agregar calorías, - para restar. 0 si no aplica.
  actualRateKgPerWeek: number
  expectedRateKgPerWeek: number
  reason: string             // explicación humana, siempre presente si shouldAdjust
}

const KCAL_PER_KG = 7700

// Tasa saludable esperada según objetivo (kg/semana). Rangos conservadores.
const EXPECTED_RATE: Record<Goal, { min: number; max: number }> = {
  perder_grasa:   { min: -1.0, max: -0.25 },
  ganar_musculo:  { min: 0.1,  max: 0.5 },
  recomposicion:  { min: -0.15, max: 0.15 },
  mantener:       { min: -0.15, max: 0.15 },
  rendimiento:    { min: -0.15, max: 0.15 },
}

const MIN_DAYS_OF_DATA = 10
const MIN_WEIGH_INS = 3

/**
 * Calcula la tasa de cambio de peso (kg/semana) mediante regresión lineal simple
 * sobre las mediciones disponibles — más robusto que solo "primero vs último"
 * porque no se deja engañar por un solo día atípico (retención de agua, etc).
 */
function weeklyRateKg(weighIns: WeighIn[]): number {
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const t0 = new Date(sorted[0].date).getTime()
  const points = sorted.map(w => ({
    x: (new Date(w.date).getTime() - t0) / (1000 * 60 * 60 * 24), // días desde el inicio
    y: w.weightKg,
  }))

  const n = points.length
  const sumX = points.reduce((a, p) => a + p.x, 0)
  const sumY = points.reduce((a, p) => a + p.y, 0)
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0)
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0)

  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0 // todas las mediciones el mismo día

  const slopePerDay = (n * sumXY - sumX * sumY) / denom
  return slopePerDay * 7 // kg/semana
}

export function suggestCalorieAdjustment(
  weighIns: WeighIn[],
  goal: Goal,
  currentTargetKcal: number,
): AdjustmentSuggestion {
  const none: AdjustmentSuggestion = { shouldAdjust: false, deltaKcal: 0, actualRateKgPerWeek: 0, expectedRateKgPerWeek: 0, reason: '' }

  if (weighIns.length < MIN_WEIGH_INS) return none

  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const daySpan = (new Date(sorted[sorted.length - 1].date).getTime() - new Date(sorted[0].date).getTime()) / (1000 * 60 * 60 * 24)
  if (daySpan < MIN_DAYS_OF_DATA) return none

  const actualRate = weeklyRateKg(sorted)
  const { min, max } = EXPECTED_RATE[goal]

  // Dentro del rango saludable esperado — sin ajuste, vas bien.
  if (actualRate >= min && actualRate <= max) return none

  // Fuera de rango: calcular cuánto ajustar para acercarse al punto medio del rango esperado.
  const targetRate = (min + max) / 2
  const rateGapKgPerWeek = targetRate - actualRate
  const deltaKcalPerDay = Math.round((rateGapKgPerWeek * KCAL_PER_KG) / 7 / 10) * 10 // redondeado a 10 kcal

  // Nunca sugerir un ajuste tan grande que resulte en un déficit/superávit extremo o poco realista.
  const clampedDelta = Math.max(-350, Math.min(350, deltaKcalPerDay))
  if (Math.abs(clampedDelta) < 30) return none // ajuste insignificante, no vale la pena molestar al usuario

  const direction = clampedDelta > 0 ? 'aumentar' : 'reducir'
  const kg = Math.abs(actualRate).toFixed(1)

  let reason: string
  if (goal === 'perder_grasa' && actualRate > max) {
    reason = `Llevas ${daySpan.toFixed(0)} días perdiendo peso más lento de lo esperado (${kg} kg/semana). Sugerimos ${direction} tus calorías en ${Math.abs(clampedDelta)} kcal/día para retomar el ritmo hacia tu meta.`
  } else if (goal === 'perder_grasa' && actualRate < min) {
    reason = `Estás perdiendo peso más rápido de lo recomendado (${kg} kg/semana) — riesgo de perder músculo junto con grasa. Sugerimos ${direction} tus calorías en ${Math.abs(clampedDelta)} kcal/día.`
  } else if (goal === 'ganar_musculo' && actualRate < min) {
    reason = `Tu peso casi no ha subido esta última semana (${actualRate.toFixed(1)} kg/semana). Para seguir ganando músculo, sugerimos ${direction} tus calorías en ${Math.abs(clampedDelta)} kcal/día.`
  } else if (goal === 'ganar_musculo' && actualRate > max) {
    reason = `Estás subiendo de peso más rápido de lo ideal (${kg} kg/semana) — probablemente más grasa que músculo. Sugerimos ${direction} tus calorías en ${Math.abs(clampedDelta)} kcal/día.`
  } else {
    reason = `Tu peso se ha movido ${actualRate > 0 ? 'hacia arriba' : 'hacia abajo'} más de lo esperado para tu meta de mantenimiento. Sugerimos ${direction} tus calorías en ${Math.abs(clampedDelta)} kcal/día para estabilizarlo.`
  }

  return {
    shouldAdjust: true,
    deltaKcal: clampedDelta,
    actualRateKgPerWeek: Math.round(actualRate * 100) / 100,
    expectedRateKgPerWeek: Math.round(targetRate * 100) / 100,
    reason,
  }
}
