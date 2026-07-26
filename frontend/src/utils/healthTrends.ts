// Detección de tendencias de salud — ZENCRUS
// Compara el promedio de la última semana contra el promedio de las 2-3
// semanas anteriores. Nunca reacciona a un solo día atípico — solo a un
// patrón sostenido, tal como exige el documento de producto.

export type Metric = 'steps' | 'sleepHours' | 'restingHeartRate'
export type TrendDirection = 'improving' | 'declining' | 'stable'

export interface DailyPoint { date: string; value: number }

export interface TrendResult {
  direction: TrendDirection
  changePercent: number       // + o - respecto al periodo anterior
  recentAvg: number
  previousAvg: number
  hasEnoughData: boolean
  message: string
}

const MIN_DAYS_PER_WINDOW = 4 // al menos 4 de los 7 días con datos reales para confiar en el promedio
const STABLE_THRESHOLD_PCT = 8 // cambios menores a esto se consideran ruido, no tendencia

// Para cada métrica, ¿un valor MÁS ALTO es mejora o empeoramiento?
const HIGHER_IS_BETTER: Record<Metric, boolean> = {
  steps: true,
  sleepHours: true,
  restingHeartRate: false, // una FC en reposo más baja suele indicar mejor condición cardiovascular
}

function average(points: DailyPoint[]): number {
  const valid = points.filter(p => p.value > 0)
  if (!valid.length) return 0
  return valid.reduce((s, p) => s + p.value, 0) / valid.length
}

/**
 * @param history Puntos diarios ordenados del más reciente al más antiguo, típicamente 21+ días.
 */
export function detectTrend(history: DailyPoint[], metric: Metric): TrendResult {
  const recentWindow = history.slice(0, 7)
  const previousWindow = history.slice(7, 21) // hasta 2 semanas anteriores

  const recentValid = recentWindow.filter(p => p.value > 0).length
  const previousValid = previousWindow.filter(p => p.value > 0).length

  if (recentValid < MIN_DAYS_PER_WINDOW || previousValid < MIN_DAYS_PER_WINDOW) {
    return { direction: 'stable', changePercent: 0, recentAvg: average(recentWindow), previousAvg: average(previousWindow), hasEnoughData: false, message: 'Aún no hay suficientes datos para detectar una tendencia confiable.' }
  }

  const recentAvg = average(recentWindow)
  const previousAvg = average(previousWindow)
  const changePercent = previousAvg > 0 ? Math.round(((recentAvg - previousAvg) / previousAvg) * 100) : 0

  if (Math.abs(changePercent) < STABLE_THRESHOLD_PCT) {
    return { direction: 'stable', changePercent, recentAvg: Math.round(recentAvg * 10) / 10, previousAvg: Math.round(previousAvg * 10) / 10, hasEnoughData: true, message: 'Se ha mantenido estable en las últimas semanas.' }
  }

  const wentUp = changePercent > 0
  const higherIsBetter = HIGHER_IS_BETTER[metric]
  const direction: TrendDirection = wentUp === higherIsBetter ? 'improving' : 'declining'

  const metricLabel: Record<Metric, string> = { steps: 'tus pasos diarios', sleepHours: 'tus horas de sueño', restingHeartRate: 'tu frecuencia cardíaca en reposo' }
  const verb = wentUp ? 'subieron' : 'bajaron'
  const message = `${metricLabel[metric]} ${verb} ${Math.abs(changePercent)}% esta semana comparado con las anteriores — ${direction === 'improving' ? 'buena señal' : 'vale la pena ponerle atención'}.`

  return { direction, changePercent, recentAvg: Math.round(recentAvg * 10) / 10, previousAvg: Math.round(previousAvg * 10) / 10, hasEnoughData: true, message }
}
