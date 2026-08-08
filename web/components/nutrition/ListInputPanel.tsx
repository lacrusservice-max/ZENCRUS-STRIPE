"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { parseFoodList, type MealTextInput, type ParsedFoodsByMeal } from "@/lib/foodListService";

interface Props {
  mode: "lista" | "voz";
  mealOrder: string[];
  mealLabels: Record<string, string>;
  mealEmojis: Record<string, string>;
  initialFocusMeal?: string | null;
  onParsed: (parsed: ParsedFoodsByMeal) => void;
}

export function ListInputPanel({ mode, mealOrder, mealLabels, mealEmojis, initialFocusMeal, onParsed }: Props) {
  const [texts, setTexts] = useState<MealTextInput>({});
  const [loading, setLoading] = useState(false);
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    if (initialFocusMeal) refs.current[initialFocusMeal]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFocusMeal]);

  const hasAnyText = Object.values(texts).some((t) => t?.trim());

  const handleConfirm = async () => {
    if (!hasAnyText) return;
    setLoading(true);
    try {
      const parsed = await parseFoodList(texts);
      onParsed(parsed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="afs-list-input">
      {mode === "voz" && (
        <div className="afs-voice-hint">
          <Mic size={16} />
          <span>Usa el dictado por voz de tu teclado o navegador en el campo de la comida — luego confirma igual que en Lista.</span>
        </div>
      )}
      <p className="afs-hint">Escribe un alimento por línea en cada comida</p>
      {mealOrder.map((mealId) => (
        <div key={mealId} className="afs-meal-block">
          <div className="afs-meal-block-head">
            <span>{mealEmojis[mealId] ?? "🍽️"}</span>
            <b>{mealLabels[mealId] ?? mealId}</b>
          </div>
          <textarea
            ref={(el) => { refs.current[mealId] = el; }}
            value={texts[mealId as keyof MealTextInput] ?? ""}
            onChange={(e) => setTexts((prev) => ({ ...prev, [mealId]: e.target.value }))}
            placeholder={mode === "voz" ? "Dicta aquí..." : "ej. 2 huevos\n1 taza de avena"}
            rows={3}
          />
        </div>
      ))}
      <button className="afs-confirm" disabled={!hasAnyText || loading} onClick={handleConfirm}>
        {loading ? "Analizando con IA..." : "Confirmar con IA"}
      </button>
    </div>
  );
}
