export interface PhotoMacros {
  foodName: string
  confidence: number
  servingSize: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  healthLevel: 'verde' | 'amarillo' | 'rojo'
  ingredients: string[]
  tips: string[]
}

const DEMO_FOODS: PhotoMacros[] = [
  {
    foodName: 'Pollo a la plancha con verduras',
    confidence: 0.91,
    servingSize: '300g aprox.',
    calories: 380,
    protein: 42,
    carbs: 18,
    fat: 12,
    fiber: 4,
    healthLevel: 'verde',
    ingredients: ['pechuga de pollo', 'brócoli', 'zanahoria', 'aceite de oliva'],
    tips: ['Excelente fuente de proteína magra', 'Considera agregar más carbohidratos si es post-entreno'],
  },
  {
    foodName: 'Tacos de carnitas',
    confidence: 0.87,
    servingSize: '3 tacos (240g aprox.)',
    calories: 520,
    protein: 28,
    carbs: 46,
    fat: 24,
    fiber: 3,
    healthLevel: 'amarillo',
    ingredients: ['tortilla de maíz', 'carne de cerdo', 'cebolla', 'cilantro', 'salsa'],
    tips: ['Alto en calorías para tu objetivo', 'Prefiere tortillas de maíz sobre harina'],
  },
  {
    foodName: 'Ensalada César con pollo',
    confidence: 0.94,
    servingSize: '350g aprox.',
    calories: 320,
    protein: 29,
    carbs: 12,
    fat: 18,
    fiber: 3,
    healthLevel: 'verde',
    ingredients: ['lechuga romana', 'pollo', 'aderezo césar', 'crutones', 'queso parmesano'],
    tips: ['Pide el aderezo aparte para controlar calorías', 'Sin crutones reduce 80 kcal'],
  },
  {
    foodName: 'Pizza personal de pepperoni',
    confidence: 0.89,
    servingSize: '1 pizza (280g aprox.)',
    calories: 750,
    protein: 32,
    carbs: 82,
    fat: 31,
    fiber: 2,
    healthLevel: 'rojo',
    ingredients: ['masa', 'queso mozzarella', 'pepperoni', 'salsa de tomate'],
    tips: ['Alta densidad calórica', 'Limita a ocasiones especiales', 'Compártela para reducir la porción'],
  },
  {
    foodName: 'Bowl de avena con frutas',
    confidence: 0.96,
    servingSize: '350g aprox.',
    calories: 410,
    protein: 14,
    carbs: 72,
    fat: 8,
    fiber: 8,
    healthLevel: 'verde',
    ingredients: ['avena', 'plátano', 'fresas', 'miel', 'leche'],
    tips: ['Excelente desayuno energético', 'Añade proteína en polvo para mayor saciedad'],
  },
]

export async function analyzePhotoMacros(imageUri: string): Promise<PhotoMacros> {
  // TODO: Replace with real DeepSeek Vision API or dedicated food recognition API
  // Endpoint: POST https://api.deepseek.com/chat/completions
  // Model: deepseek-vision
  // Send base64 image + system prompt asking for nutritional breakdown

  await new Promise(r => setTimeout(r, 1800))

  if (imageUri.startsWith('demo:')) {
    const hint = imageUri.slice(5).toLowerCase()
    const match = DEMO_FOODS.find(f => f.foodName.toLowerCase().includes(hint) || hint.includes(f.foodName.toLowerCase().split(' ')[0]))
    return match ?? DEMO_FOODS[Math.floor(Math.random() * DEMO_FOODS.length)]
  }

  return DEMO_FOODS[Math.floor(Math.random() * DEMO_FOODS.length)]
}

export async function analyzePhotoIngredients(_imageUri: string): Promise<string[]> {
  await new Promise(r => setTimeout(r, 1200))
  const food = DEMO_FOODS[Math.floor(Math.random() * DEMO_FOODS.length)]
  return food.ingredients
}
