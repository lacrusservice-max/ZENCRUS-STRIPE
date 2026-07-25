import { evaluateStreakContinuity } from '../streakLogic'

describe('evaluateStreakContinuity', () => {
  it('mantiene la racha si ya se registró hoy', () => {
    const result = evaluateStreakContinuity('2026-01-05', '2026-01-05', 0)
    expect(result.action).toBe('keep')
  })

  it('mantiene la racha si la última actividad fue ayer', () => {
    const result = evaluateStreakContinuity('2026-01-04', '2026-01-05', 0)
    expect(result.action).toBe('keep')
  })

  it('mantiene la racha si no hay actividad previa registrada (usuario nuevo)', () => {
    const result = evaluateStreakContinuity(null, '2026-01-05', 0)
    expect(result.action).toBe('keep')
  })

  it('PROTEGE la racha si faltó 1 día y hay un protector disponible', () => {
    // Última actividad: 2026-01-03, hoy: 2026-01-05 → faltó el día 04
    const result = evaluateStreakContinuity('2026-01-03', '2026-01-05', 1)
    expect(result.action).toBe('protect')
    if (result.action === 'protect') {
      expect(result.missedDate).toBe('2026-01-04')
    }
  })

  it('ROMPE la racha si faltó 1 día y NO hay protectores disponibles', () => {
    const result = evaluateStreakContinuity('2026-01-03', '2026-01-05', 0)
    expect(result.action).toBe('break')
  })

  it('ROMPE la racha (break_multi) si faltaron 2 o más días, aunque haya protectores', () => {
    // Última actividad: 2026-01-01, hoy: 2026-01-05 → faltaron 3 días completos
    const result = evaluateStreakContinuity('2026-01-01', '2026-01-05', 5)
    expect(result.action).toBe('break_multi')
  })

  it('un protector nunca cubre más de un día saltado', () => {
    const result = evaluateStreakContinuity('2026-01-01', '2026-01-04', 3)
    expect(result.action).not.toBe('protect')
  })
})
