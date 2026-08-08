// Sistema de unidades de ZENCRUS.
//
// Toda la información nutricional del mundo real (Open Food Facts, USDA, etiquetas)
// viene expresada por 100 g o por 100 ml. Ese es el único formato canónico que se
// guarda; cualquier unidad que elija la persona —gramos, onzas, libras, tazas,
// piezas— se convierte a gramos y desde ahí se calculan los macros. Así una misma
// comida se puede registrar en la unidad que resulte natural sin duplicar datos.

export type UnitKind = 'mass' | 'volume' | 'count'

export interface UnitDef {
  id: string
  /** Nombre completo, para menús. */
  label: string
  /** Abreviatura, para las fichas. */
  short: string
  kind: UnitKind
  /** Gramos que pesa una unidad. En volumen asume densidad 1 (agua). */
  grams: number
}

export const UNITS: UnitDef[] = [
  // Masa
  { id: 'g',        label: 'Gramos',      short: 'g',    kind: 'mass',   grams: 1 },
  { id: 'kg',       label: 'Kilogramos',  short: 'kg',   kind: 'mass',   grams: 1000 },
  { id: 'oz',       label: 'Onzas',       short: 'oz',   kind: 'mass',   grams: 28.3495 },
  { id: 'lb',       label: 'Libras',      short: 'lb',   kind: 'mass',   grams: 453.592 },
  // Volumen (densidad 1 salvo que el alimento indique otra)
  { id: 'ml',       label: 'Mililitros',  short: 'ml',   kind: 'volume', grams: 1 },
  { id: 'l',        label: 'Litros',      short: 'L',    kind: 'volume', grams: 1000 },
  { id: 'taza',     label: 'Taza',        short: 'taza', kind: 'volume', grams: 240 },
  { id: 'cda',      label: 'Cucharada',   short: 'cda',  kind: 'volume', grams: 15 },
  { id: 'cdta',     label: 'Cucharadita', short: 'cdta', kind: 'volume', grams: 5 },
  // Conteo — el peso real lo aporta cada alimento
  { id: 'pza',      label: 'Unidad',      short: 'pza',  kind: 'count',  grams: 100 },
  { id: 'porcion',  label: 'Porción',     short: 'porc', kind: 'count',  grams: 100 },
  { id: 'rebanada', label: 'Rebanada',    short: 'reb',  kind: 'count',  grams: 30 },
]

const BY_ID = new Map(UNITS.map(u => [u.id, u]))

/** Alias que aparecen en datos externos y en lo que escribe la gente. */
const ALIASES: Record<string, string> = {
  gr: 'g', grs: 'g', gramo: 'g', gramos: 'g', gram: 'g', grams: 'g',
  kilogramo: 'kg', kilo: 'kg', kilos: 'kg',
  onza: 'oz', onzas: 'oz', ounce: 'oz',
  libra: 'lb', libras: 'lb', pound: 'lb',
  mililitro: 'ml', mililitros: 'ml',
  litro: 'l', litros: 'l', lt: 'l',
  cup: 'taza', tazas: 'taza',
  cucharada: 'cda', cucharadas: 'cda', tbsp: 'cda',
  cucharadita: 'cdta', cucharaditas: 'cdta', tsp: 'cdta',
  pieza: 'pza', piezas: 'pza', unidad: 'pza', unidades: 'pza', u: 'pza', ud: 'pza', pz: 'pza',
  porciones: 'porcion', racion: 'porcion', serving: 'porcion',
  rebanadas: 'rebanada', slice: 'rebanada', reb: 'rebanada',
}

export function resolveUnit(raw: string | undefined | null): UnitDef {
  if (!raw) return BY_ID.get('g')!
  const k = String(raw).trim().toLowerCase()
  return BY_ID.get(k) ?? BY_ID.get(ALIASES[k] ?? '') ?? BY_ID.get('g')!
}

/**
 * Unidades que tiene sentido ofrecer para un alimento.
 *
 * Un líquido no se mide en rebanadas y un huevo no se mide en tazas: mostrar solo
 * lo aplicable evita registros absurdos.
 */
export function unitsFor(unit: string, gramsPerPiece?: number): UnitDef[] {
  const base = resolveUnit(unit)
  const mass = UNITS.filter(u => u.kind === 'mass')
  const volume = UNITS.filter(u => u.kind === 'volume')
  const count = UNITS.filter(u => u.id === base.id && u.kind === 'count')

  if (base.kind === 'volume') return [...volume, ...mass]
  if (base.kind === 'count') {
    // Solo se ofrece pesar por gramos si se conoce cuánto pesa una pieza.
    return gramsPerPiece ? [...count, ...mass] : count
  }
  return [...mass, ...volume]
}

/** Convierte una cantidad a gramos. `gramsPerPiece` manda en las unidades de conteo. */
export function toGrams(amount: number, unit: string, gramsPerPiece?: number): number {
  const u = resolveUnit(unit)
  if (u.kind === 'count' && gramsPerPiece && gramsPerPiece > 0) return amount * gramsPerPiece
  return amount * u.grams
}

/** Macros por 100 g de un alimento. */
export interface Per100 {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface ScaledMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  grams: number
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Escala los macros por 100 g a la cantidad y unidad elegidas. */
export function scaleMacros(
  per100: Per100,
  amount: number,
  unit: string,
  gramsPerPiece?: number,
): ScaledMacros {
  const grams = toGrams(amount, unit, gramsPerPiece)
  const k = grams / 100
  return {
    grams: Math.round(grams),
    calories: Math.round(per100.calories * k),
    protein: r1(per100.protein * k),
    carbs:   r1(per100.carbs * k),
    fat:     r1(per100.fat * k),
    fiber:   r1(per100.fiber * k),
  }
}

/** Pasos de ajuste sensatos: 1 g molesta, 0.5 piezas no. */
export function stepFor(unit: string): number {
  const u = resolveUnit(unit)
  switch (u.id) {
    case 'g':
    case 'ml': return 10
    case 'kg':
    case 'l':  return 0.1
    case 'oz': return 0.5
    case 'lb': return 0.25
    case 'taza': return 0.25
    case 'cda':
    case 'cdta': return 0.5
    default: return u.kind === 'count' ? 0.5 : 1
  }
}

/** Cantidades típicas para tocar de un toque, sin escribir números. */
export function presetsFor(unit: string): number[] {
  const u = resolveUnit(unit)
  switch (u.id) {
    case 'g':   return [30, 50, 100, 150, 200]
    case 'ml':  return [100, 200, 250, 330, 500]
    case 'kg':
    case 'l':   return [0.25, 0.5, 1, 1.5, 2]
    case 'oz':  return [1, 2, 3, 4, 6]
    case 'lb':  return [0.25, 0.5, 0.75, 1, 1.5]
    case 'taza': return [0.25, 0.5, 1, 1.5, 2]
    case 'cda':
    case 'cdta': return [0.5, 1, 2, 3, 4]
    default:    return [0.5, 1, 2, 3, 4]
  }
}

/** Formatea una cantidad sin decimales inútiles: "2" y no "2.0". */
export function fmtAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

export function fmtQty(amount: number, unit: string): string {
  return `${fmtAmount(amount)} ${resolveUnit(unit).short}`
}
