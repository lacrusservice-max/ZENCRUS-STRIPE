import { computeGoalProgress, generateMilestones, Goal } from '../goalProgress'

const mkGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: '1',
  title: 'Bajar de peso',
  type: 'weight',
  direction: 'decrease',
  startValue: 90,
  targetValue: 80,
  startDate: '2026-01-01',
  targetDate: '2026-03-02', // 60 días
  unit: 'kg',
  ...overrides,
})

describe('computeGoalProgress', () => {
  it('marca "not_started" si la fecha actual es antes de la fecha de inicio', () => {
    const goal = mkGoal({ startDate: '2026-02-01' })
    const result = computeGoalProgress(goal, 90, '2026-01-15')
    expect(result.status).toBe('not_started')
  })

  it('marca "completed" cuando el valor actual alcanza o supera la meta (decrease)', () => {
    const goal = mkGoal() // 90 → 80 kg
    const result = computeGoalProgress(goal, 79, '2026-02-01')
    expect(result.status).toBe('completed')
    expect(result.percentComplete).toBe(100)
  })

  it('marca "completed" cuando el valor actual alcanza la meta (increase — ganar músculo)', () => {
    const goal = mkGoal({ direction: 'increase', startValue: 70, targetValue: 78 })
    const result = computeGoalProgress(goal, 78, '2026-02-01')
    expect(result.status).toBe('completed')
  })

  it('marca "on_track" si el progreso real coincide con el ritmo esperado (lineal)', () => {
    // 30 de 60 días transcurridos (50%) → debería haber bajado 5kg de los 10kg totales
    const goal = mkGoal()
    const result = computeGoalProgress(goal, 85, '2026-01-31') // exactamente a mitad de camino
    expect(result.status).toBe('on_track')
  })

  it('marca "ahead" si el progreso real supera claramente el ritmo esperado', () => {
    const goal = mkGoal()
    // A mitad de tiempo (50%), pero ya bajó 9 de 10 kg (90%)
    const result = computeGoalProgress(goal, 81, '2026-01-31')
    expect(result.status).toBe('ahead')
  })

  it('marca "behind" si el progreso real está muy por detrás del ritmo esperado', () => {
    const goal = mkGoal()
    // A mitad de tiempo (50%), pero casi no ha bajado peso (10%)
    const result = computeGoalProgress(goal, 89, '2026-01-31')
    expect(result.status).toBe('behind')
  })

  it('marca "expired" si se pasó la fecha objetivo sin completar la meta', () => {
    const goal = mkGoal()
    const result = computeGoalProgress(goal, 87, '2026-03-10') // después del 2026-03-02, no llegó a 80
    expect(result.status).toBe('expired')
  })

  it('el porcentaje de avance nunca es negativo aunque el usuario retroceda', () => {
    const goal = mkGoal()
    const result = computeGoalProgress(goal, 95, '2026-01-15') // subió de peso en vez de bajar
    expect(result.percentComplete).toBe(0)
  })

  it('funciona igual de bien con metas de tipo increase (ganar músculo)', () => {
    const goal = mkGoal({ direction: 'increase', startValue: 65, targetValue: 75, unit: 'kg' })
    const result = computeGoalProgress(goal, 70, '2026-01-31')
    expect(result.percentComplete).toBe(50)
  })
})

describe('generateMilestones', () => {
  it('genera 4 hitos intermedios (25/50/75/100%) con valores correctos', () => {
    const goal = mkGoal() // 90 → 80 kg
    const milestones = generateMilestones(goal)
    expect(milestones).toHaveLength(4)
    expect(milestones[0]).toEqual({ label: '25%', value: 87.5, percent: 25 })
    expect(milestones[3]).toEqual({ label: '100%', value: 80, percent: 100 })
  })
})
