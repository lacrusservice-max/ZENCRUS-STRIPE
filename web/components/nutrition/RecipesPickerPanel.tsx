"use client";

import { Plus } from "lucide-react";
import { useRecipesStore, type Recipe } from "@/store/recipesStore";
import type { FoodEntry } from "@/store/nutritionStore";

interface Props {
  onAdd: (entry: FoodEntry) => void;
}

export function RecipesPickerPanel({ onAdd }: Props) {
  const { recipes } = useRecipesStore();

  const addRecipe = (r: Recipe) => {
    onAdd({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: r.title,
      calories: r.nutrition.calories,
      protein: r.nutrition.protein,
      carbs: r.nutrition.carbs,
      fat: r.nutrition.fat,
      fiber: 0,
      amount: 1,
      unit: "porción",
      timestamp: Date.now(),
      active: true,
    });
  };

  return (
    <div className="afs-recipes">
      <p className="afs-hint">Elige una receta guardada — se agrega con sus macros completos</p>
      <div className="afs-recipes-list">
        {recipes.length === 0 && <p className="afs-confirm-empty">Aún no tienes recetas guardadas</p>}
        {recipes.map((r) => (
          <button key={r.id} className="afs-recipe-card" onClick={() => addRecipe(r)}>
            <span className="afs-recipe-emoji">{r.emoji}</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <span className="afs-recipe-title">{r.title}</span>
              <span className="afs-recipe-sub">
                {r.nutrition.calories} kcal · P {Math.round(r.nutrition.protein)} · C {Math.round(r.nutrition.carbs)} · G {Math.round(r.nutrition.fat)}
              </span>
            </span>
            <span className="afs-recipe-add"><Plus size={16} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}
