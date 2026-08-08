import { scoreFit, missingIngredients } from '../recipeFit'

const left = { kcal: 640, protein: 48, carbs: 60, fat: 20 }

describe('scoreFit', () => {
  it('prefiere cubrir el macro pendiente antes que llenar las kcal', () => {
    const alta = scoreFit({ calories: 480, protein: 38, carbs: 18, fat: 28 }, left)
    const vacia = scoreFit({ calories: 620, protein: 12, carbs: 90, fat: 10 }, left)
    expect(alta.score).toBeGreaterThan(vacia.score)
  })

  it('explica el porqué cuando cubre buena parte de la proteína', () => {
    const r = scoreFit({ calories: 480, protein: 38, carbs: 18, fat: 28 }, left)
    expect(r.reason).toContain('proteína')
    expect(r.proteinCover).toBeCloseTo(38 / 48, 2)
  })

  it('marca y cuantifica el exceso sin descalificar la receta', () => {
    const r = scoreFit({ calories: 900, protein: 40, carbs: 60, fat: 30 }, left)
    expect(r.overBy).toBe(260)
    expect(r.fits).toBe(false)
    expect(r.reason).toContain('260')
  })

  it('no marca exceso cuando cabe justo en el margen', () => {
    const r = scoreFit({ calories: 640, protein: 30, carbs: 40, fat: 15 }, left)
    expect(r.overBy).toBe(0)
  })

  it('mantiene la puntuación dentro de 0 y 100', () => {
    const enorme = scoreFit({ calories: 5000, protein: 300, carbs: 400, fat: 200 }, left)
    const nula = scoreFit({ calories: 0, protein: 0, carbs: 0, fat: 0 }, left)
    expect(enorme.score).toBeGreaterThanOrEqual(0)
    expect(enorme.score).toBeLessThanOrEqual(100)
    expect(nula.score).toBeGreaterThanOrEqual(0)
  })

  it('no divide por cero con el día ya cerrado', () => {
    const r = scoreFit({ calories: 300, protein: 20, carbs: 30, fat: 8 },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 })
    expect(Number.isFinite(r.score)).toBe(true)
    expect(r.overBy).toBe(300)
  })

  it('describe como ligera la receta que deja margen', () => {
    const r = scoreFit({ calories: 120, protein: 4, carbs: 20, fat: 2 }, left)
    expect(r.reason).toContain('margen')
  })
})

describe('missingIngredients', () => {
  const ings = [
    { name: 'Pechuga de pollo' },
    { name: 'Arroz integral' },
    { name: 'Brócoli al vapor' },
  ]

  it('detecta lo que no está en la despensa', () => {
    expect(missingIngredients(ings, ['pollo', 'arroz'])).toEqual(['Brócoli al vapor'])
  })

  it('cuadra aunque la despensa nombre el ingrediente más corto', () => {
    expect(missingIngredients(ings, ['brócoli'])).not.toContain('Brócoli al vapor')
  })

  it('ignora mayúsculas y espacios sobrantes', () => {
    expect(missingIngredients(ings, ['  POLLO  ', 'Arroz', 'Brócoli'])).toEqual([])
  })

  it('con la despensa vacía marca todo como faltante', () => {
    expect(missingIngredients(ings, [])).toHaveLength(3)
  })

  it('no cuenta las entradas en blanco de la despensa como coincidencia', () => {
    expect(missingIngredients(ings, ['', '   '])).toHaveLength(3)
  })
})
