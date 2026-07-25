import { epley1RM, checkForPR, PersonalRecord, SetEntry } from '../oneRepMax'

describe('epley1RM', () => {
  it('devuelve el mismo peso cuando reps = 1 (es el 1RM real)', () => {
    expect(epley1RM(100, 1)).toBe(100)
  })

  it('calcula correctamente con la fórmula de Epley (peso * (1 + reps/30))', () => {
    // 100kg x 10 reps → 100 * (1 + 10/30) = 133.33
    expect(epley1RM(100, 10)).toBeCloseTo(133.3, 1)
  })

  it('devuelve 0 si el peso o las reps son inválidos', () => {
    expect(epley1RM(0, 10)).toBe(0)
    expect(epley1RM(100, 0)).toBe(0)
    expect(epley1RM(-10, 5)).toBe(0)
  })

  it('a más reps con el mismo peso, el 1RM estimado es mayor', () => {
    expect(epley1RM(80, 12)).toBeGreaterThan(epley1RM(80, 5))
  })
})

describe('checkForPR', () => {
  const mkSet = (weightKg: number, reps: number, type: SetEntry['type'] = 'normal'): SetEntry => ({ weightKg, reps, type })
  const mkHistory = (est1RM: number, exerciseName = 'Press de banca'): PersonalRecord[] => [
    { exerciseName, est1RM, weightKg: est1RM, reps: 1, date: '2026-01-01' },
  ]

  it('detecta un nuevo PR cuando el 1RM estimado supera el histórico', () => {
    const result = checkForPR(mkSet(100, 5), 'Press de banca', mkHistory(110))
    // 100 * (1+5/30) = 116.67 > 110
    expect(result.isPR).toBe(true)
    expect(result.est1RM).toBeGreaterThan(110)
  })

  it('NO marca PR si el 1RM estimado es igual o menor al histórico', () => {
    const result = checkForPR(mkSet(80, 5), 'Press de banca', mkHistory(120))
    expect(result.isPR).toBe(false)
  })

  it('series de calentamiento (warmup) nunca cuentan como PR, aunque el número sea alto', () => {
    const result = checkForPR(mkSet(200, 5, 'warmup'), 'Press de banca', mkHistory(50))
    expect(result.isPR).toBe(false)
  })

  it('series dropset no cuentan como PR', () => {
    const result = checkForPR(mkSet(200, 5, 'dropset'), 'Press de banca', mkHistory(50))
    expect(result.isPR).toBe(false)
  })

  it('series al fallo (failure) SÍ cuentan como PR', () => {
    const result = checkForPR(mkSet(150, 3, 'failure'), 'Sentadilla', mkHistory(100, 'Sentadilla'))
    expect(result.isPR).toBe(true)
  })

  it('sin histórico previo, la primera serie normal siempre es PR', () => {
    const result = checkForPR(mkSet(60, 8), 'Remo con barra', [])
    expect(result.isPR).toBe(true)
    expect(result.previousBest).toBe(0)
  })

  it('el histórico de OTRO ejercicio no afecta la comparación', () => {
    const history = mkHistory(200, 'Sentadilla') // PR alto en otro ejercicio
    const result = checkForPR(mkSet(60, 8), 'Remo con barra', history)
    expect(result.isPR).toBe(true) // no debe compararse contra el PR de Sentadilla
  })
})
