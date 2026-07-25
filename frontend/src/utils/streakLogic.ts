// Mecánica de racha — ZENCRUS
// "Nunca lenguaje de culpa. Un protector disponible perdona un día saltado
// sin destruir semanas de esfuerzo." Esta función decide qué pasa con la
// racha al cargar la app, de forma pura y verificable (sin AsyncStorage).

export type StreakDecision =
  | { action: 'keep' }                                   // se registró hoy o ayer, todo normal
  | { action: 'protect'; missedDate: string }             // faltó 1 día, se cubre con protector
  | { action: 'break' }                                   // faltó 1 día, sin protector disponible
  | { action: 'break_multi' }                              // faltaron 2+ días, ningún protector cubre eso

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
}

export function evaluateStreakContinuity(
  lastActiveDate: string | null,
  today: string,
  shieldsAvailable: number,
): StreakDecision {
  if (!lastActiveDate || lastActiveDate === today) return { action: 'keep' }

  const diff = daysBetween(lastActiveDate, today)

  if (diff <= 1) return { action: 'keep' } // ayer o antes-de-ayer mismo día por huso horario

  if (diff <= 2) {
    // Faltó exactamente 1 día completo — se puede proteger.
    if (shieldsAvailable > 0) {
      const missed = new Date(lastActiveDate)
      missed.setDate(missed.getDate() + 1)
      return { action: 'protect', missedDate: missed.toISOString().slice(0, 10) }
    }
    return { action: 'break' }
  }

  // Faltaron 2 o más días — ningún protector individual alcanza para cubrir eso.
  return { action: 'break_multi' }
}
