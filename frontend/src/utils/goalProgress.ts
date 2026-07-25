// Metas SMART — ZENCRUS
// Calcula el progreso real de una meta y si el usuario va "a tiempo" para
// cumplirla en la fecha objetivo, comparando el ritmo esperado (lineal)
// contra el avance real.

export type GoalDirection = 'increase' | 'decrease' // ganar músculo/peso = increase; bajar grasa = decrease

export interface Goal {
  id: string
  title: string
  type: 'weight' | 'workout_frequency' | 'streak' | 'custom'
  direction: GoalDirection
  startValue: number
  targetValue: number
  startDate: string // ISO
  targetDate: string // ISO
  unit: string // 'kg', 'entrenamientos/semana', 'días', etc.
}

export type GoalStatus = 'ahead' | 'on_track' | 'behind' | 'completed' | 'expired' | 'not_started'

export interface GoalProgressResult {
  status: GoalStatus
  percentComplete: number   // 0-100, hacia la meta (clamped)
  expectedPercent: number   // 0-100, dónde deberías estar hoy si vas lineal
  daysRemaining: number
  daysElapsed: number
  totalDays: number
}

const TOLERANCE = 8 // puntos porcentuales de margen antes de considerar "atrasado"

export function computeGoalProgress(goal: Goal, currentValue: number, today: string = new Date().toISOString().slice(0, 10)): GoalProgressResult {
  const totalDelta = goal.targetValue - goal.startValue
  const currentDelta = currentValue - goal.startValue

  // Progreso hacia la meta, sin importar si direction es increase o decrease
  // (si totalDelta es 0, ya se cumplió trivialmente o la meta está mal definida).
  let percentComplete = totalDelta !== 0 ? (currentDelta / totalDelta) * 100 : 100
  percentComplete = Math.max(0, Math.min(100, Math.round(percentComplete)))

  const start = new Date(goal.startDate).getTime()
  const target = new Date(goal.targetDate).getTime()
  const now = new Date(today).getTime()

  const totalDays = Math.max(1, Math.round((target - start) / (1000 * 60 * 60 * 24)))
  const daysElapsed = Math.round((now - start) / (1000 * 60 * 60 * 24))
  const daysRemaining = Math.round((target - now) / (1000 * 60 * 60 * 24))

  const expectedPercent = Math.max(0, Math.min(100, Math.round((daysElapsed / totalDays) * 100)))

  if (daysElapsed < 0) {
    return { status: 'not_started', percentComplete, expectedPercent: 0, daysRemaining, daysElapsed, totalDays }
  }

  if (percentComplete >= 100) {
    return { status: 'completed', percentComplete: 100, expectedPercent, daysRemaining, daysElapsed, totalDays }
  }

  if (daysRemaining < 0) {
    return { status: 'expired', percentComplete, expectedPercent, daysRemaining, daysElapsed, totalDays }
  }

  const gap = percentComplete - expectedPercent
  const status: GoalStatus = gap >= TOLERANCE ? 'ahead' : gap <= -TOLERANCE ? 'behind' : 'on_track'

  return { status, percentComplete, expectedPercent, daysRemaining, daysElapsed, totalDays }
}

/** Divide una meta en hitos intermedios alcanzables (25%, 50%, 75%, 100% del camino). */
export function generateMilestones(goal: Goal): { label: string; value: number; percent: number }[] {
  const totalDelta = goal.targetValue - goal.startValue
  return [25, 50, 75, 100].map(pct => ({
    label: `${pct}%`,
    value: Math.round((goal.startValue + (totalDelta * pct) / 100) * 10) / 10,
    percent: pct,
  }))
}
