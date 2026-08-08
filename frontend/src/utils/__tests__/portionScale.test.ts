import {
  scaleFood, computeAddImpact, suggestPortionFix, dialRange, FoodBase,
} from '../portionScale'

const avena: FoodBase = {
  name: 'Avena (100g)',
  calories: 389, protein: 17, carbs: 66, fat: 7, fiber: 10,
  amount: 100, unit: 'g',
}

const huevo: FoodBase = {
  name: 'Huevo entero',
  calories: 70, protein: 6, carbs: 0.6, fat: 5, fiber: 0,
  amount: 1, unit: 'pza',
}

describe('scaleFood', () => {
  it('deja la porción base igual', () => {
    const out = scaleFood(avena, 100)
    expect(out.calories).toBe(389)
    expect(out.protein).toBe(17)
    expect(out.amount).toBe(100)
  })

  it('escala a la mitad', () => {
    const out = scaleFood(avena, 50)
    expect(out.calories).toBe(195)   // 389/2 redondeado
    expect(out.protein).toBe(8.5)
    expect(out.carbs).toBe(33)
  })

  it('escala hacia arriba', () => {
    const out = scaleFood(avena, 150)
    expect(out.calories).toBe(584)
    expect(out.fat).toBe(10.5)
  })

  it('funciona con unidades por pieza', () => {
    const out = scaleFood(huevo, 3)
    expect(out.calories).toBe(210)
    expect(out.protein).toBe(18)
    expect(out.unit).toBe('pza')
  })

  it('cantidad cero deja todo en cero', () => {
    const out = scaleFood(avena, 0)
    expect(out.calories).toBe(0)
    expect(out.protein).toBe(0)
  })

  it('nunca produce valores negativos', () => {
    const out = scaleFood(avena, -50)
    expect(out.calories).toBe(0)
    expect(out.amount).toBe(0)
  })
})

describe('computeAddImpact', () => {
  it('calcula lo que queda cuando cabe', () => {
    const i = computeAddImpact(0, 500, 389)
    expect(i.total).toBe(389)
    expect(i.remaining).toBe(111)
    expect(i.over).toBe(0)
    expect(i.exceeds).toBe(false)
  })

  it('detecta el exceso y lo cuantifica', () => {
    // 389 avena + 89 plátano + 120 whey = 598 sobre 500
    const i = computeAddImpact(209, 500, 389)
    expect(i.total).toBe(598)
    expect(i.over).toBe(98)
    expect(i.remaining).toBe(0)
    expect(i.exceeds).toBe(true)
  })

  it('el caso exacto no cuenta como exceso', () => {
    const i = computeAddImpact(111, 500, 389)
    expect(i.total).toBe(500)
    expect(i.over).toBe(0)
    expect(i.exceeds).toBe(false)
  })

  it('las proporciones suman como máximo 1', () => {
    const i = computeAddImpact(209, 500, 389)
    expect(i.currentPct + i.addingPct).toBeLessThanOrEqual(1.0001)
  })

  it('no rompe con presupuesto cero', () => {
    const i = computeAddImpact(0, 0, 100)
    expect(i.over).toBe(100)
    expect(i.exceeds).toBe(true)
    expect(Number.isFinite(i.currentPct)).toBe(true)
  })
})

describe('suggestPortionFix', () => {
  it('propone la cantidad que cierra exacto', () => {
    // Quedan 291 kcal (500-209); avena son 3.89 kcal/g => 74 g
    const g = suggestPortionFix(avena, 209, 500)
    expect(g).toBe(74)
    // Y esa cantidad efectivamente cabe
    expect(209 + scaleFood(avena, g!).calories).toBeLessThanOrEqual(500)
  })

  it('devuelve null si la porción base ya cabe', () => {
    expect(suggestPortionFix(avena, 0, 500)).toBeNull()
  })

  it('propone bajar cuando el usuario subió el dial y se pasó', () => {
    // 160 g de avena = 622 kcal sobre un presupuesto de 500.
    // Aunque los 100 g base sí cabrían, hay que sugerir el recorte.
    const g = suggestPortionFix(avena, 0, 500, 160)
    expect(g).toBe(128)
    expect(scaleFood(avena, g!).calories).toBeLessThanOrEqual(500)
  })

  it('no sugiere nada si la porción puesta ya cabe', () => {
    expect(suggestPortionFix(avena, 0, 500, 80)).toBeNull()
  })

  it('devuelve null si no queda espacio', () => {
    expect(suggestPortionFix(avena, 500, 500)).toBeNull()
    expect(suggestPortionFix(avena, 600, 500)).toBeNull()
  })

  it('devuelve null cuando ni una unidad cabe', () => {
    // Quedan 3 kcal, un huevo son 70
    expect(suggestPortionFix(huevo, 497, 500)).toBeNull()
  })
})

describe('dialRange', () => {
  it('da margen para duplicar la porción base', () => {
    const r = dialRange(avena)
    expect(r.min).toBe(0)
    expect(r.max).toBeGreaterThanOrEqual(200)
  })

  it('usa paso fino en porciones pequeñas', () => {
    expect(dialRange(huevo).step).toBeLessThan(dialRange(avena).step)
  })
})
