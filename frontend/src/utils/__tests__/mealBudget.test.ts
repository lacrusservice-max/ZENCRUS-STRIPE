import { computeMealBudgets, describeMealStatus, buildCoachNote, MealInput } from '../mealBudget'

const meals = (over: Partial<Record<string, Partial<MealInput>>> = {}): MealInput[] => [
  { id: 'breakfast', label: 'Desayuno', consumed: 0, entryCount: 0, ...(over.breakfast ?? {}) },
  { id: 'lunch',     label: 'Almuerzo', consumed: 0, entryCount: 0, ...(over.lunch ?? {}) },
  { id: 'dinner',    label: 'Cena',     consumed: 0, entryCount: 0, ...(over.dinner ?? {}) },
  { id: 'snack1',    label: 'Snack 1',  consumed: 0, entryCount: 0, ...(over.snack1 ?? {}) },
]

describe('computeMealBudgets', () => {
  it('reparte el objetivo completo cuando no hay nada registrado', () => {
    const out = computeMealBudgets(meals(), 2400)
    const sum = out.reduce((a, b) => a + b.budget, 0)
    expect(sum).toBeGreaterThanOrEqual(2396)
    expect(sum).toBeLessThanOrEqual(2404)
    expect(out.every(b => b.status === 'pending')).toBe(true)
  })

  it('da más presupuesto a la comida principal que al snack', () => {
    const out = computeMealBudgets(meals(), 2400)
    const lunch = out.find(b => b.id === 'lunch')!
    const snack = out.find(b => b.id === 'snack1')!
    expect(lunch.budget).toBeGreaterThan(snack.budget)
  })

  it('marca "over" y reduce el presupuesto de las comidas pendientes', () => {
    const base = computeMealBudgets(meals(), 2400)
    const dinnerBase = base.find(b => b.id === 'dinner')!.budget

    // El snack se pasa: presupuesto ~312, consume 460
    const out = computeMealBudgets(
      meals({ snack1: { consumed: 460, entryCount: 2 } }),
      2400,
    )
    const snack = out.find(b => b.id === 'snack1')!
    const dinner = out.find(b => b.id === 'dinner')!

    expect(snack.status).toBe('over')
    expect(snack.delta).toBeGreaterThan(0)
    // La cena pendiente absorbe el exceso
    expect(dinner.budget).toBeLessThan(dinnerBase)
    expect(dinner.status).toBe('pending')
  })

  it('nunca deja presupuesto negativo si el usuario se pasa del día entero', () => {
    const out = computeMealBudgets(
      meals({
        breakfast: { consumed: 1200, entryCount: 3 },
        lunch:     { consumed: 1500, entryCount: 4 },
      }),
      2400,
    )
    out.forEach(b => expect(b.budget).toBeGreaterThanOrEqual(0))
    const dinner = out.find(b => b.id === 'dinner')!
    expect(dinner.budget).toBe(0)
  })

  it('las comidas pendientes se reparten exactamente lo que queda del día', () => {
    const out = computeMealBudgets(
      meals({ breakfast: { consumed: 560, entryCount: 2 } }),
      2400,
    )
    const pendingSum = out
      .filter(b => b.status === 'pending')
      .reduce((a, b) => a + b.budget, 0)
    // Queda 2400 - 560 = 1840 por repartir
    expect(pendingSum).toBeGreaterThanOrEqual(1836)
    expect(pendingSum).toBeLessThanOrEqual(1844)
  })

  it('marca "under" solo cuando la comida se queda claramente corta', () => {
    const out = computeMealBudgets(
      meals({ breakfast: { consumed: 200, entryCount: 1 } }), // base ~600
      2400,
    )
    expect(out.find(b => b.id === 'breakfast')!.status).toBe('under')
  })

  it('marca "ok" cuando queda cerca del presupuesto', () => {
    const base = computeMealBudgets(meals(), 2400)
    const bfBudget = base.find(b => b.id === 'breakfast')!.budget
    const out = computeMealBudgets(
      meals({ breakfast: { consumed: bfBudget - 10, entryCount: 2 } }),
      2400,
    )
    expect(out.find(b => b.id === 'breakfast')!.status).toBe('ok')
  })

  it('fill se satura en 1 aunque se pase mucho', () => {
    const out = computeMealBudgets(
      meals({ breakfast: { consumed: 5000, entryCount: 3 } }),
      2400,
    )
    expect(out.find(b => b.id === 'breakfast')!.fill).toBe(1)
  })

  it('devuelve lista vacía sin comidas', () => {
    expect(computeMealBudgets([], 2400)).toEqual([])
  })

  it('no rompe con objetivo cero', () => {
    const out = computeMealBudgets(meals(), 0)
    out.forEach(b => {
      expect(b.budget).toBe(0)
      expect(b.fill).toBe(0)
    })
  })
})

describe('describeMealStatus', () => {
  it('describe el exceso con el número de kcal', () => {
    const [b] = computeMealBudgets(
      [{ id: 'snack1', label: 'Snack', consumed: 500, entryCount: 1 }],
      400,
    )
    expect(describeMealStatus(b)).toMatch(/100 kcal por encima/)
  })

  it('para pendientes anuncia el presupuesto', () => {
    const [b] = computeMealBudgets(
      [{ id: 'dinner', label: 'Cena', consumed: 0, entryCount: 0 }],
      600,
    )
    expect(describeMealStatus(b)).toMatch(/600 kcal/)
  })
})

describe('buildCoachNote', () => {
  it('explica el reajuste cuando una comida se pasó y aún falta cenar', () => {
    // Día realista: desayuno y almuerzo ya registrados, el snack se pasó,
    // la cena sigue pendiente y es quien absorbe el exceso.
    const out = computeMealBudgets(
      meals({
        breakfast: { consumed: 560, entryCount: 2 },
        lunch:     { consumed: 820, entryCount: 3 },
        snack1:    { consumed: 460, entryCount: 2 },
      }),
      2400,
    )
    const note = buildCoachNote(out, 37)!
    expect(note).toMatch(/Snack 1/)
    expect(note).toMatch(/cena/i)
  })

  it('sin exceso, habla de la SIGUIENTE comida del día, no de la más grande', () => {
    // Día vacío: lo siguiente es el desayuno, aunque el almuerzo tenga más kcal.
    const out = computeMealBudgets(meals(), 2000)
    const note = buildCoachNote(out, 150)!
    expect(note).toMatch(/desayuno/i)
    expect(note).not.toMatch(/almuerzo/i)
  })

  it('reparte la proteína por comida, no manda la meta del día en una sola', () => {
    const out = computeMealBudgets(meals(), 2000)
    const note = buildCoachNote(out, 150)!
    // El desayuno pesa 25% del día: ~38 g, nunca los 150 g completos.
    expect(note).not.toMatch(/150 g/)
    const grams = Number(note.match(/(\d+) g de prote/)?.[1])
    expect(grams).toBeGreaterThan(0)
    expect(grams).toBeLessThan(60)
  })

  it('felicita cuando ya no queda nada pendiente', () => {
    const out = computeMealBudgets(
      meals({
        breakfast: { consumed: 560, entryCount: 2 },
        lunch:     { consumed: 820, entryCount: 3 },
        dinner:    { consumed: 600, entryCount: 2 },
        snack1:    { consumed: 300, entryCount: 1 },
      }),
      2400,
    )
    expect(buildCoachNote(out, 0)).toMatch(/Cerraste/)
  })
})
