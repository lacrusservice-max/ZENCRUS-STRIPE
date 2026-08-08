import { toRealMeasure, scaleIngredients } from '../realMeasures'

describe('toRealMeasure', () => {
  it('redondea los contables hacia arriba: no se compran 2.67 huevos', () => {
    const m = toRealMeasure(2.67, 'pza')
    expect(m.amount).toBe(3)
    expect(m.label).toBe('3')
    expect(m.exact).toBe(2.67)
  })

  it('nunca deja un contable en cero', () => {
    expect(toRealMeasure(0.2, 'pieza').amount).toBe(1)
    expect(toRealMeasure(0, 'rebanada').amount).toBe(1)
  })

  it('no marca ajuste cuando el contable ya era entero', () => {
    const m = toRealMeasure(3, 'pza')
    expect(m.amount).toBe(3)
    expect(m.exact).toBeUndefined()
  })

  it('ajusta tazas al cuarto más cercano y las escribe con fracción', () => {
    expect(toRealMeasure(1.33, 'taza').label).toBe('1¼')
    expect(toRealMeasure(1.5, 'taza').label).toBe('1½')
    expect(toRealMeasure(0.7, 'taza').label).toBe('¾')
    expect(toRealMeasure(2, 'taza').label).toBe('2')
  })

  it('mantiene un mínimo de un cuarto en fraccionables', () => {
    expect(toRealMeasure(0.05, 'cda').amount).toBe(0.25)
  })

  it('deja el peso al gramo: la báscula sí tiene esa precisión', () => {
    const m = toRealMeasure(186.6, 'g')
    expect(m.amount).toBe(187)
    expect(m.label).toBe('187')
    expect(m.exact).toBeUndefined()
  })

  it('trata unidades desconocidas como peso', () => {
    expect(toRealMeasure(12.4, 'ml').amount).toBe(12)
  })

  it('reconoce la unidad sin importar mayúsculas ni espacios', () => {
    expect(toRealMeasure(1.2, ' PZA ').amount).toBe(2)
  })
})

describe('scaleIngredients', () => {
  const base = [
    { name: 'Pechuga', amount: 140, unit: 'g' },
    { name: 'Huevo', amount: 1.5, unit: 'pza' },
    { name: 'Arroz', amount: 0.75, unit: 'taza' },
  ]

  it('duplica de 1 a 2 raciones con medidas cocinables', () => {
    const out = scaleIngredients(base, 1, 2)
    expect(out[0].real.label).toBe('280')
    expect(out[1].real.label).toBe('3')      // 3 piezas, no 3.0
    expect(out[2].real.label).toBe('1½')     // 1.5 tazas
  })

  it('reduce a la mitad sin dejar contables en cero', () => {
    const out = scaleIngredients(base, 2, 1)
    expect(out[0].real.amount).toBe(70)
    expect(out[1].real.amount).toBe(1)       // 0.75 → sube a 1 pieza
  })

  it('conserva el resto de campos del ingrediente', () => {
    const out = scaleIngredients([{ name: 'Aceite', amount: 1, unit: 'cda', kcal: 119 }], 1, 3)
    expect(out[0].name).toBe('Aceite')
    expect(out[0].kcal).toBe(119)
    expect(out[0].real.amount).toBe(3)
  })

  it('no divide por cero si la receta no declara raciones', () => {
    const out = scaleIngredients(base, 0, 4)
    expect(out[0].real.amount).toBe(140)
  })
})
