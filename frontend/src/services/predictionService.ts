export interface GoalPrediction {
  goalType: 'weight_loss' | 'muscle_gain' | 'maintenance' | 'endurance'
  currentValue: number
  targetValue: number
  unit: string
  estimatedWeeks: number
  estimatedDate: string
  weeklyRate: number
  confidence: number
  milestones: { week: number; value: number; label: string }[]
  warnings: string[]
  recommendations: string[]
}

export interface PerformanceTrend {
  metric: string
  trend: 'improving' | 'stable' | 'declining'
  pctChange: number
  insight: string
}

export async function predictGoalCompletion(params: {
  currentWeight: number
  targetWeight: number
  weeklyWorkouts: number
  avgCalories: number
  targetCalories: number
  currentStreak: number
}): Promise<GoalPrediction> {
  // TODO: Send to DeepSeek for scientific prediction based on user data
  await new Promise(r => setTimeout(r, 1500))

  const diff = params.currentWeight - params.targetWeight
  const isLoss = diff > 0
  const weeklyRate = isLoss ? 0.4 : 0.3
  const weeks = Math.max(4, Math.round(Math.abs(diff) / weeklyRate))
  const estimatedDate = new Date(Date.now() + weeks * 7 * 86400000)

  const milestones = Array.from({ length: Math.min(4, Math.ceil(weeks / 4)) }, (_, i) => {
    const week = Math.round(weeks * ((i + 1) / Math.min(4, Math.ceil(weeks / 4))))
    const value = Math.round((params.currentWeight - weeklyRate * week) * 10) / 10
    return {
      week,
      value,
      label: i === 0 ? 'Primera meta' : i === 1 ? 'A mitad del camino' : i === 2 ? 'Recta final' : 'Meta alcanzada',
    }
  })

  return {
    goalType: isLoss ? 'weight_loss' : 'muscle_gain',
    currentValue: params.currentWeight,
    targetValue: params.targetWeight,
    unit: 'kg',
    estimatedWeeks: weeks,
    estimatedDate: estimatedDate.toISOString().slice(0, 10),
    weeklyRate,
    confidence: Math.min(0.92, 0.65 + params.currentStreak * 0.005),
    milestones,
    warnings: params.weeklyWorkouts < 3 ? ['Aumenta a 3+ entrenamientos por semana para acelerar resultados'] : [],
    recommendations: [
      `Mantén un déficit de ${Math.round((params.currentCalories - params.targetCalories) / 7)} kcal/día`,
      'Prioriza el sueño: 7-9 horas acelera la recuperación y el metabolismo',
      params.currentStreak < 7 ? 'Construye consistencia antes de aumentar intensidad' : 'Tu racha es sólida — mantén el ritmo',
    ].filter(Boolean),
  }
}

export async function analyzePerformanceTrends(params: {
  weightHistory: number[]
  workoutHistory: number[]
  sleepHistory: number[]
  calorieHistory: number[]
}): Promise<PerformanceTrend[]> {
  await new Promise(r => setTimeout(r, 1000))

  const trends: PerformanceTrend[] = []

  if (params.weightHistory.length >= 2) {
    const first = params.weightHistory[0]
    const last = params.weightHistory[params.weightHistory.length - 1]
    const pct = Math.round(((last - first) / first) * 100 * 10) / 10
    trends.push({
      metric: 'Peso corporal',
      trend: pct < -1 ? 'improving' : pct > 1 ? 'declining' : 'stable',
      pctChange: pct,
      insight: pct < -1 ? `Has bajado ${Math.abs(pct)}% — estás en camino` : pct > 1 ? 'El peso subió ligeramente — revisa tus comidas' : 'Tu peso se mantiene estable',
    })
  }

  if (params.sleepHistory.length >= 3) {
    const avg = params.sleepHistory.reduce((a, b) => a + b, 0) / params.sleepHistory.length
    trends.push({
      metric: 'Calidad del sueño',
      trend: avg >= 7 ? 'improving' : avg >= 6 ? 'stable' : 'declining',
      pctChange: Math.round((avg - 7) / 7 * 100),
      insight: avg >= 7 ? `Promedio de ${avg.toFixed(1)}h — excelente recuperación` : `Solo ${avg.toFixed(1)}h promedio — el sueño afecta tus resultados`,
    })
  }

  return trends
}

export async function detectAbandonmentRisk(params: {
  daysSinceLastWorkout: number
  missedCheckIns: number
  streakTrend: 'growing' | 'stable' | 'declining'
}): Promise<{ risk: 'low' | 'medium' | 'high'; message: string }> {
  await new Promise(r => setTimeout(r, 500))

  const score = params.daysSinceLastWorkout * 2 + params.missedCheckIns + (params.streakTrend === 'declining' ? 3 : 0)

  if (score >= 8) {
    return {
      risk: 'high',
      message: 'Tu consistencia bajó esta semana. ¿Todo bien? Un entrenamiento corto de 15 minutos es suficiente para retomar el ritmo 💪',
    }
  }
  if (score >= 4) {
    return {
      risk: 'medium',
      message: 'Llevas algunos días sin actividad. Recuerda: el movimiento diario es la clave. ¡Empieza con 10 minutos hoy!',
    }
  }
  return {
    risk: 'low',
    message: '¡Vas increíble! Mantén la racha.',
  }
}
