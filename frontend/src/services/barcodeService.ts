// Barcode Service — Open Food Facts API
// TODO: conectar con la API real de Open Food Facts (https://world.openfoodfacts.org/api/v2)
// Por ahora retorna datos mock realistas para demostración

export interface ScannedFood {
  barcode: string
  name: string
  brand?: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  amount: number
  unit: string
  healthLevel: 'green' | 'yellow' | 'red'
  imageUrl?: string
}

// Mock database de productos mexicanos comunes
const MOCK_PRODUCTS: Record<string, ScannedFood> = {
  '7501055300057': {
    barcode: '7501055300057',
    name: 'Leche entera Lala (250ml)',
    brand: 'Lala',
    calories: 148, protein: 8, carbs: 11, fat: 8.2, fiber: 0,
    amount: 250, unit: 'ml', healthLevel: 'yellow',
  },
  '7501003123312': {
    barcode: '7501003123312',
    name: 'Avena quaker (100g)',
    brand: 'Quaker',
    calories: 370, protein: 13, carbs: 67, fat: 7, fiber: 10,
    amount: 100, unit: 'g', healthLevel: 'green',
  },
  '7501031311309': {
    barcode: '7501031311309',
    name: 'Atún StarKist en agua (140g)',
    brand: 'StarKist',
    calories: 120, protein: 26, carbs: 0, fat: 1, fiber: 0,
    amount: 140, unit: 'g', healthLevel: 'yellow',
  },
  '7506306380041': {
    barcode: '7506306380041',
    name: 'Tortillas de maíz Maseca (30g)',
    brand: 'Maseca',
    calories: 100, protein: 2, carbs: 20, fat: 1, fiber: 1.5,
    amount: 30, unit: 'g', healthLevel: 'green',
  },
  '7501080417048': {
    barcode: '7501080417048',
    name: 'Yogur griego Alpura (150g)',
    brand: 'Alpura',
    calories: 130, protein: 12, carbs: 8, fat: 5, fiber: 0,
    amount: 150, unit: 'g', healthLevel: 'yellow',
  },
}

// Simula latencia de red
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// Buscar por código de barras en Open Food Facts
// TODO: descomentar cuando se conecte la API real
// async function fetchFromOpenFoodFacts(barcode: string): Promise<ScannedFood | null> {
//   const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,brands,nutriments,product_quantity,quantity`)
//   if (!res.ok) return null
//   const data = await res.json()
//   if (data.status !== 1) return null
//   const p = data.product
//   const n = p.nutriments ?? {}
//   return {
//     barcode,
//     name: p.product_name ?? 'Producto desconocido',
//     brand: p.brands,
//     calories: n['energy-kcal_100g'] ?? 0,
//     protein: n.proteins_100g ?? 0,
//     carbs: n.carbohydrates_100g ?? 0,
//     fat: n.fat_100g ?? 0,
//     fiber: n.fiber_100g ?? 0,
//     amount: 100,
//     unit: 'g',
//     healthLevel: classifyFood(n),
//   }
// }

function classifyFood(n: { fat_100g?: number; proteins_100g?: number; fiber_100g?: number }): 'green' | 'yellow' | 'red' {
  // Algoritmo Nutriscore simplificado
  const fat = n.fat_100g ?? 0
  const fiber = n.fiber_100g ?? 0
  if (fiber >= 3 && fat < 10) return 'green'
  if (fat > 20) return 'red'
  return 'yellow'
}

export async function lookupBarcode(barcode: string): Promise<ScannedFood | null> {
  await delay(800) // Simula llamada de red

  // Primero buscar en mock DB
  if (MOCK_PRODUCTS[barcode]) return MOCK_PRODUCTS[barcode]

  // TODO: llamar a Open Food Facts cuando se habilite la API
  // return await fetchFromOpenFoodFacts(barcode)

  // Por ahora, retornar un producto genérico si no está en mock
  return {
    barcode,
    name: `Producto ${barcode.slice(-4)}`,
    brand: 'Marca desconocida',
    calories: 150,
    protein: 5,
    carbs: 20,
    fat: 5,
    fiber: 1,
    amount: 100,
    unit: 'g',
    healthLevel: 'yellow',
  }
}

// Clasificar alimento manual por nombre
export function classifyFoodByName(name: string): 'green' | 'yellow' | 'red' {
  const n = name.toLowerCase()
  const greenKeywords = ['pollo', 'pechuga', 'pescado', 'salmón', 'atún fresco', 'huevo', 'brócoli', 'espinaca', 'verdura', 'fruta', 'manzana', 'plátano', 'aguacate', 'almendra', 'nuez', 'frijol', 'lenteja', 'camote', 'papa', 'avena', 'tortilla de maíz']
  const redKeywords = ['refresco', 'coca', 'pepsi', 'salchicha', 'nuggets', 'hamburguesa', 'hot dog', 'papas fritas', 'cheetos', 'doritos', 'galleta', 'pastel', 'helado', 'chicle', 'dulce', 'azúcar', 'chorizo', 'embutido']
  if (greenKeywords.some(k => n.includes(k))) return 'green'
  if (redKeywords.some(k => n.includes(k))) return 'red'
  return 'yellow'
}

export const HEALTH_LEVEL_COLORS = {
  green:  '#30D158',
  yellow: '#FFD60A',
  red:    '#FF3B30',
}

export const HEALTH_LEVEL_LABELS = {
  green:  'Natural',
  yellow: 'Procesado',
  red:    'Ultraprocesado',
}
