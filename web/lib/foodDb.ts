import type { FoodBase } from "@/lib/portionScale";

/** Base de alimentos — espejo del catálogo de la app móvil. */
export const FOOD_DB: FoodBase[] = [
  { name: "Pechuga de pollo", calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, amount: 100, unit: "g" },
  { name: "Arroz blanco cocido", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, amount: 100, unit: "g" },
  { name: "Huevo entero", calories: 70, protein: 6, carbs: 0.6, fat: 5, fiber: 0, amount: 1, unit: "pza" },
  { name: "Avena en hojuelas", calories: 389, protein: 17, carbs: 66, fat: 7, fiber: 10, amount: 100, unit: "g" },
  { name: "Plátano mediano", calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, amount: 1, unit: "pza" },
  { name: "Yogur griego", calories: 132, protein: 12, carbs: 7, fat: 5, fiber: 0, amount: 150, unit: "g" },
  { name: "Proteína whey", calories: 120, protein: 25, carbs: 3, fat: 1.5, fiber: 0, amount: 30, unit: "g" },
  { name: "Salmón", calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, amount: 100, unit: "g" },
  { name: "Aguacate", calories: 120, protein: 1.5, carbs: 6, fat: 11, fiber: 5, amount: 80, unit: "g" },
  { name: "Almendras", calories: 174, protein: 6, carbs: 6, fat: 15, fiber: 3.5, amount: 30, unit: "g" },
  { name: "Frijoles negros", calories: 132, protein: 8.9, carbs: 24, fat: 0.5, fiber: 8.7, amount: 100, unit: "g" },
  { name: "Tortilla de maíz", calories: 52, protein: 1.4, carbs: 11, fat: 0.7, fiber: 1.2, amount: 30, unit: "g" },
  { name: "Brócoli", calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, amount: 100, unit: "g" },
  { name: "Papa cocida", calories: 86, protein: 1.7, carbs: 20, fat: 0.1, fiber: 1.8, amount: 100, unit: "g" },
  { name: "Atún en agua", calories: 84, protein: 20, carbs: 0, fat: 0.5, fiber: 0, amount: 100, unit: "g" },
];
