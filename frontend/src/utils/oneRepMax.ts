// Estimación de 1RM (una repetición máxima) — fórmula de Epley.
// Estándar de la industria (Hevy, Strong, Strava) para estimar fuerza máxima
// a partir de series con reps > 1, sin necesitar que el usuario falle un 1RM real.
export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

export interface SetEntry {
  reps: number
  weightKg: number
  type: 'warmup' | 'normal' | 'dropset' | 'failure' | 'superset'
}

export interface PersonalRecord {
  exerciseName: string
  est1RM: number
  weightKg: number
  reps: number
  date: string // ISO
}

/**
 * Evalúa si una serie recién completada es un nuevo récord personal (PR)
 * para ese ejercicio, comparando el 1RM estimado contra el histórico.
 * Solo cuentan series 'normal' o 'failure' — warmup/dropset no califican.
 */
export function checkForPR(
  set: SetEntry,
  exerciseName: string,
  history: PersonalRecord[],
): { isPR: boolean; est1RM: number; previousBest: number } {
  const est1RM = epley1RM(set.weightKg, set.reps)
  const previousBest = history
    .filter(r => r.exerciseName === exerciseName)
    .reduce((max, r) => Math.max(max, r.est1RM), 0)

  const qualifies = set.type === 'normal' || set.type === 'failure'
  const isPR = qualifies && est1RM > previousBest && est1RM > 0

  return { isPR, est1RM, previousBest }
}
