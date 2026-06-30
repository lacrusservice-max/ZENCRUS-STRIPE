import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface RecipeIngredient {
  name: string
  amount: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface Recipe {
  id: string
  title: string
  description: string
  emoji: string
  category: 'desayuno' | 'almuerzo' | 'cena' | 'snack' | 'bebida' | 'postre'
  prepTimeMin: number
  cookTimeMin: number
  servings: number
  difficulty: 'fácil' | 'medio' | 'difícil'
  ingredients: RecipeIngredient[]
  steps: string[]
  tags: string[]
  nutrition: { calories: number; protein: number; carbs: number; fat: number }
  isAIGenerated: boolean
  isFavorite: boolean
  createdAt: string
  authorId?: string
  authorName?: string
  isPublic: boolean
  imageUri?: string
  allergens: string[]
}

const DEMO_RECIPES: Recipe[] = [
  {
    id: 'r1',
    title: 'Bowl de proteína tropical',
    description: 'Desayuno rico en proteínas con frutas tropicales, ideal para post-entreno.',
    emoji: '🥣',
    category: 'desayuno',
    prepTimeMin: 5,
    cookTimeMin: 0,
    servings: 1,
    difficulty: 'fácil',
    ingredients: [
      { name: 'Yogur griego 0%', amount: 200, unit: 'g', calories: 110, protein: 20, carbs: 8, fat: 0.5 },
      { name: 'Proteína en polvo vainilla', amount: 30, unit: 'g', calories: 120, protein: 24, carbs: 3, fat: 1 },
      { name: 'Mango', amount: 100, unit: 'g', calories: 60, protein: 0.8, carbs: 15, fat: 0.4 },
      { name: 'Piña', amount: 80, unit: 'g', calories: 42, protein: 0.5, carbs: 11, fat: 0.1 },
      { name: 'Granola sin azúcar', amount: 30, unit: 'g', calories: 130, protein: 3, carbs: 20, fat: 5 },
    ],
    steps: [
      'Mezcla el yogur griego con la proteína en polvo hasta integrar bien.',
      'Corta el mango y la piña en cubos pequeños.',
      'Coloca la mezcla de yogur en un bowl.',
      'Agrega las frutas tropicales encima.',
      'Finaliza con la granola y sirve inmediatamente.',
    ],
    tags: ['proteína', 'post-entreno', 'tropical', 'sin-gluten'],
    nutrition: { calories: 462, protein: 48.3, carbs: 57, fat: 7 },
    isAIGenerated: true,
    isFavorite: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    isPublic: true,
    allergens: ['lácteos'],
  },
  {
    id: 'r2',
    title: 'Ensalada de pollo con aguacate',
    description: 'Almuerzo completo con grasas saludables y proteína magra.',
    emoji: '🥗',
    category: 'almuerzo',
    prepTimeMin: 15,
    cookTimeMin: 20,
    servings: 1,
    difficulty: 'fácil',
    ingredients: [
      { name: 'Pechuga de pollo', amount: 180, unit: 'g', calories: 198, protein: 37, carbs: 0, fat: 4.5 },
      { name: 'Aguacate', amount: 80, unit: 'g', calories: 128, protein: 1.6, carbs: 6.8, fat: 11.7 },
      { name: 'Lechuga romana', amount: 150, unit: 'g', calories: 26, protein: 1.9, carbs: 4.7, fat: 0.3 },
      { name: 'Tomate cherry', amount: 100, unit: 'g', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
      { name: 'Aceite de oliva', amount: 10, unit: 'ml', calories: 88, protein: 0, carbs: 0, fat: 10 },
    ],
    steps: [
      'Sazona el pollo con sal, pimienta, ajo y limón.',
      'Cocina el pollo a la plancha 10 min por lado.',
      'Deja reposar 5 minutos y corta en tiras.',
      'Lava y corta la lechuga, tomates y aguacate.',
      'Mezcla todos los ingredientes y aliña con aceite de oliva.',
    ],
    tags: ['pollo', 'aguacate', 'keto', 'sin-gluten'],
    nutrition: { calories: 458, protein: 41.4, carbs: 15.4, fat: 26.7 },
    isAIGenerated: false,
    isFavorite: false,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    isPublic: true,
    allergens: [],
  },
  {
    id: 'r3',
    title: 'Avena nocturna con chía',
    description: 'Prepárala la noche anterior. Lista para comer en la mañana.',
    emoji: '🌙',
    category: 'desayuno',
    prepTimeMin: 5,
    cookTimeMin: 0,
    servings: 1,
    difficulty: 'fácil',
    ingredients: [
      { name: 'Avena en hojuelas', amount: 80, unit: 'g', calories: 294, protein: 10.4, carbs: 50.4, fat: 5 },
      { name: 'Semillas de chía', amount: 20, unit: 'g', calories: 98, protein: 3.4, carbs: 8.5, fat: 6.3 },
      { name: 'Leche de almendra', amount: 240, unit: 'ml', calories: 37, protein: 1.1, carbs: 3.5, fat: 2.2 },
      { name: 'Miel de agave', amount: 15, unit: 'g', calories: 47, protein: 0, carbs: 12.6, fat: 0 },
      { name: 'Plátano', amount: 100, unit: 'g', calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    ],
    steps: [
      'En un frasco, mezcla la avena, chía y leche de almendra.',
      'Agrega la miel y revuelve bien.',
      'Tapa y refrigera durante la noche (mínimo 6 horas).',
      'Por la mañana, agrega el plátano en rodajas y sirve.',
    ],
    tags: ['avena', 'overnight', 'sin-cocción', 'vegano'],
    nutrition: { calories: 565, protein: 16, carbs: 98, fat: 13.8 },
    isAIGenerated: false,
    isFavorite: false,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    isPublic: true,
    allergens: ['gluten', 'frutos-secos'],
  },
]

interface RecipesState {
  recipes: Recipe[]
  myRecipes: string[]
  favorites: string[]
  allergens: string[]
  intolerances: string[]
  load: () => Promise<void>
  addRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt'>) => Recipe
  updateRecipe: (id: string, updates: Partial<Recipe>) => void
  deleteRecipe: (id: string) => void
  toggleFavorite: (id: string) => void
  setAllergens: (allergens: string[]) => void
  setIntolerances: (intolerances: string[]) => void
  getByCategory: (cat: Recipe['category']) => Recipe[]
  getFiltered: (search?: string, cat?: Recipe['category'] | 'all') => Recipe[]
  getSafe: () => Recipe[]
  generateGroceryList: (recipeIds: string[], servings?: Record<string, number>) => GroceryItem[]
}

export interface GroceryItem {
  name: string
  amount: number
  unit: string
  checked: boolean
}

export const useRecipesStore = create<RecipesState>()(
  persist(
    (set, get) => ({
      recipes: DEMO_RECIPES,
      myRecipes: [],
      favorites: ['r1'],
      allergens: [],
      intolerances: [],

      load: async () => {},

      addRecipe: (recipeData) => {
        const recipe: Recipe = {
          ...recipeData,
          id: `r_${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
        set(s => ({
          recipes: [recipe, ...s.recipes],
          myRecipes: [recipe.id, ...s.myRecipes],
        }))
        return recipe
      },

      updateRecipe: (id, updates) => {
        set(s => ({ recipes: s.recipes.map(r => r.id === id ? { ...r, ...updates } : r) }))
      },

      deleteRecipe: (id) => {
        set(s => ({
          recipes: s.recipes.filter(r => r.id !== id),
          myRecipes: s.myRecipes.filter(rid => rid !== id),
          favorites: s.favorites.filter(fid => fid !== id),
        }))
      },

      toggleFavorite: (id) => {
        set(s => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter(fid => fid !== id)
            : [...s.favorites, id],
          recipes: s.recipes.map(r =>
            r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
          ),
        }))
      },

      setAllergens: (allergens) => set({ allergens }),
      setIntolerances: (intolerances) => set({ intolerances }),

      getByCategory: (cat) => get().recipes.filter(r => r.category === cat),

      getFiltered: (search, cat) => {
        let results = get().recipes
        if (cat && cat !== 'all') results = results.filter(r => r.category === cat)
        if (search) {
          const q = search.toLowerCase()
          results = results.filter(r =>
            r.title.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q) ||
            r.tags.some(t => t.includes(q))
          )
        }
        return results
      },

      getSafe: () => {
        const { recipes, allergens, intolerances } = get()
        const blocked = [...allergens, ...intolerances]
        if (!blocked.length) return recipes
        return recipes.filter(r => !r.allergens.some(a => blocked.includes(a)))
      },

      generateGroceryList: (recipeIds, servings = {}) => {
        const { recipes } = get()
        const map = new Map<string, GroceryItem>()
        recipeIds.forEach(rid => {
          const recipe = recipes.find(r => r.id === rid)
          if (!recipe) return
          const mult = (servings[rid] ?? 1) / recipe.servings
          recipe.ingredients.forEach(ing => {
            const key = `${ing.name}_${ing.unit}`
            if (map.has(key)) {
              map.get(key)!.amount += Math.round(ing.amount * mult)
            } else {
              map.set(key, {
                name: ing.name,
                amount: Math.round(ing.amount * mult),
                unit: ing.unit,
                checked: false,
              })
            }
          })
        })
        return Array.from(map.values())
      },
    }),
    { name: 'zencrus-recipes', storage: createJSONStorage(() => AsyncStorage) }
  )
)
