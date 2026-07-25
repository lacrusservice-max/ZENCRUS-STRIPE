import { suggestCalorieAdjustment, WeighIn } from '../calorieAdjustment'

// Genera pesos diarios entre dos fechas con una tasa de cambio lineal (kg/semana)
function genWeighIns(startDate: string, days: number, startWeight: number, ratePerWeek: number): WeighIn[] {
  const out: WeighIn[] = []
  const start = new Date(startDate)
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    out.push({ date: d.toISOString().slice(0, 10), weightKg: startWeight + (ratePerWeek / 7) * i })
  }
  return out
}

describe('suggestCalorieAdjustment', () => {
  it('no sugiere nada con menos de 3 pesajes', () => {
    const result = suggestCalorieAdjustment([{ date: '2026-01-01', weightKg: 80 }], 'perder_grasa', 2000)
    expect(result.shouldAdjust).toBe(false)
  })

  it('no sugiere nada con menos de 10 días de datos', () => {
    const weighIns = genWeighIns('2026-01-01', 5, 80, -1)
    const result = suggestCalorieAdjustment(weighIns, 'perder_grasa', 2000)
    expect(result.shouldAdjust).toBe(false)
  })

  it('NO sugiere ajuste si el usuario pierde peso dentro del rango saludable esperado', () => {
    // Meta: perder grasa, rango esperado -1.0 a -0.25 kg/semana. -0.6 está en rango.
    const weighIns = genWeighIns('2026-01-01', 21, 80, -0.6)
    const result = suggestCalorieAdjustment(weighIns, 'perder_grasa', 2000)
    expect(result.shouldAdjust).toBe(false)
  })

  it('SUGIERE reducir calorías si pierde peso más lento de lo esperado en objetivo de pérdida de grasa', () => {
    // Casi no pierde peso (-0.05 kg/semana) teniendo meta de perder grasa
    const weighIns = genWeighIns('2026-01-01', 21, 80, -0.05)
    const result = suggestCalorieAdjustment(weighIns, 'perder_grasa', 2000)
    expect(result.shouldAdjust).toBe(true)
    expect(result.deltaKcal).toBeLessThan(0) // debe sugerir REDUCIR calorías
    expect(result.reason.length).toBeGreaterThan(0) // siempre debe explicar el porqué
  })

  it('SUGIERE aumentar calorías si pierde peso demasiado rápido (riesgo de perder músculo)', () => {
    // Pierde 1.8 kg/semana — mucho más rápido de lo saludable
    const weighIns = genWeighIns('2026-01-01', 21, 85, -1.8)
    const result = suggestCalorieAdjustment(weighIns, 'perder_grasa', 1500)
    expect(result.shouldAdjust).toBe(true)
    expect(result.deltaKcal).toBeGreaterThan(0) // debe sugerir AUMENTAR calorías
  })

  it('SUGIERE aumentar calorías si el objetivo es ganar músculo pero el peso no sube', () => {
    const weighIns = genWeighIns('2026-01-01', 21, 70, 0.02)
    const result = suggestCalorieAdjustment(weighIns, 'ganar_musculo', 2800)
    expect(result.shouldAdjust).toBe(true)
    expect(result.deltaKcal).toBeGreaterThan(0)
  })

  it('SUGIERE reducir calorías si sube de peso muy rápido con meta de mantenimiento', () => {
    const weighIns = genWeighIns('2026-01-01', 21, 75, 0.8)
    const result = suggestCalorieAdjustment(weighIns, 'mantener', 2200)
    expect(result.shouldAdjust).toBe(true)
    expect(result.deltaKcal).toBeLessThan(0)
  })

  it('nunca sugiere un ajuste mayor a 350 kcal/día (tope de seguridad)', () => {
    // Tasa extrema para forzar el límite
    const weighIns = genWeighIns('2026-01-01', 21, 90, -3.5)
    const result = suggestCalorieAdjustment(weighIns, 'perder_grasa', 1200)
    expect(Math.abs(result.deltaKcal)).toBeLessThanOrEqual(350)
  })

  it('la tasa real calculada refleja la tendencia (regresión), no solo primer/último dato', () => {
    const weighIns = genWeighIns('2026-01-01', 21, 80, -0.7)
    const result = suggestCalorieAdjustment(weighIns, 'mantener', 2000)
    expect(result.actualRateKgPerWeek).toBeCloseTo(-0.7, 1)
  })
})
