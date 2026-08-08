"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { ParsedFood, ParsedFoodsByMeal } from "@/lib/foodListService";
import type { FoodEntry } from "@/store/nutritionStore";

interface EditableFood extends ParsedFood {
  _key: string;
  _baseAmount: number;
  _baseCalories: number;
  _baseProtein: number;
  _baseCarbs: number;
  _baseFat: number;
  _baseFiber: number;
}

function toEditable(f: ParsedFood, i: number): EditableFood {
  return {
    ...f,
    _key: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
    _baseAmount: f.amount || 1,
    _baseCalories: f.calories,
    _baseProtein: f.protein,
    _baseCarbs: f.carbs,
    _baseFat: f.fat,
    _baseFiber: f.fiber,
  };
}

function rescale(f: EditableFood, newAmount: number): EditableFood {
  const factor = f._baseAmount > 0 ? newAmount / f._baseAmount : 1;
  return {
    ...f,
    amount: newAmount,
    calories: Math.round(f._baseCalories * factor),
    protein: Math.round(f._baseProtein * factor * 10) / 10,
    carbs: Math.round(f._baseCarbs * factor * 10) / 10,
    fat: Math.round(f._baseFat * factor * 10) / 10,
    fiber: Math.round(f._baseFiber * factor * 10) / 10,
  };
}

interface Props {
  parsedByMeal: ParsedFoodsByMeal;
  mealOrder: string[];
  mealLabels: Record<string, string>;
  mealEmojis: Record<string, string>;
  dailyConsumed: number;
  dailyTarget: number;
  onAddMore: (mealId: string) => void;
  onConfirm: (entriesByMeal: Record<string, FoodEntry[]>) => void;
}

export function ConfirmFoodsPanel({
  parsedByMeal, mealOrder, mealLabels, mealEmojis, dailyConsumed, dailyTarget, onAddMore, onConfirm,
}: Props) {
  const [items, setItems] = useState<Record<string, EditableFood[]>>(() => {
    const init: Record<string, EditableFood[]> = {};
    for (const mealId of mealOrder) init[mealId] = (parsedByMeal[mealId] ?? []).map(toEditable);
    return init;
  });
  const [editing, setEditing] = useState<{ mealId: string; key: string } | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const totals = useMemo(() => {
    let kcal = 0, prot = 0, carbs = 0, fat = 0;
    Object.values(items).forEach((list) => list.forEach((f) => {
      kcal += f.calories; prot += f.protein; carbs += f.carbs; fat += f.fat;
    }));
    return { kcal: Math.round(kcal), prot: Math.round(prot), carbs: Math.round(carbs), fat: Math.round(fat) };
  }, [items]);

  const remaining = Math.max(0, dailyTarget - dailyConsumed);
  const pct = remaining > 0 ? Math.min((totals.kcal / remaining) * 100, 100) : (totals.kcal > 0 ? 100 : 0);
  const overBudget = totals.kcal > remaining;

  const removeItem = (mealId: string, key: string) =>
    setItems((prev) => ({ ...prev, [mealId]: prev[mealId].filter((f) => f._key !== key) }));

  const openEdit = (mealId: string, item: EditableFood) => {
    setEditing({ mealId, key: item._key });
    setEditAmount(String(item.amount));
  };

  const saveEdit = () => {
    if (!editing) return;
    const n = parseFloat(editAmount);
    if (!isNaN(n) && n > 0) {
      setItems((prev) => ({
        ...prev,
        [editing.mealId]: prev[editing.mealId].map((f) => f._key === editing.key ? rescale(f, n) : f),
      }));
    }
    setEditing(null);
  };

  const totalItemCount = Object.values(items).reduce((s, l) => s + l.length, 0);

  const handleConfirm = () => {
    const entriesByMeal: Record<string, FoodEntry[]> = {};
    for (const [mealId, list] of Object.entries(items)) {
      entriesByMeal[mealId] = list.map((f, i) => ({
        id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat,
        fiber: f.fiber, amount: f.amount, unit: f.unit, timestamp: Date.now(), active: true,
      }));
    }
    onConfirm(entriesByMeal);
  };

  return (
    <div className="afs-confirm-screen">
      <div className="afs-confirm-totals">
        <div className="afs-confirm-totals-row">
          <div>
            <div className="afs-confirm-kcal">{totals.kcal} <small>kcal</small></div>
            <div className="afs-confirm-macros">{totals.prot}P · {totals.carbs}C · {totals.fat}G</div>
          </div>
          <div className="afs-confirm-budget">
            <b style={overBudget ? { color: "#ff1f3d" } : undefined}>
              {overBudget ? `+${totals.kcal - remaining}` : remaining - totals.kcal}
            </b>
            <span>{overBudget ? "KCAL DE MÁS" : "KCAL LIBRES"}</span>
          </div>
        </div>
        <div className="afs-confirm-bar"><i style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="afs-confirm-list">
        {mealOrder.map((mealId) => {
          const list = items[mealId] ?? [];
          if (list.length === 0) return null;
          const mealKcal = Math.round(list.reduce((a, f) => a + f.calories, 0));
          return (
            <div key={mealId} className="afs-confirm-meal">
              <div className="afs-confirm-meal-head">
                <span>{mealEmojis[mealId] ?? "🍽️"}</span>
                <b>{mealLabels[mealId] ?? mealId}</b>
                <span className="afs-confirm-meal-kcal">{mealKcal} kcal</span>
              </div>
              {list.map((item) => (
                <div key={item._key} className="afs-confirm-item" onClick={() => openEdit(mealId, item)}>
                  <span className="afs-confirm-item-emoji">{item.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="afs-confirm-item-name">{item.name}</span>
                    <span className="afs-confirm-item-sub">{item.amount} {item.unit}</span>
                  </span>
                  <span className="afs-confirm-item-kcal">{Math.round(item.calories)}</span>
                  <button
                    className="afs-confirm-item-del"
                    onClick={(e) => { e.stopPropagation(); removeItem(mealId, item._key); }}
                    aria-label="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button className="afs-confirm-addmore" onClick={() => onAddMore(mealId)}>
                + Agregar más a {(mealLabels[mealId] ?? mealId).toLowerCase()}
              </button>
            </div>
          );
        })}
        {totalItemCount === 0 && <p className="afs-confirm-empty">No hay alimentos para confirmar</p>}
      </div>

      <button className="afs-confirm-cta" disabled={totalItemCount === 0} onClick={handleConfirm}>
        Añadir a tu día
      </button>

      {editing && (
        <div className="afs-edit-backdrop" onClick={() => setEditing(null)} role="presentation">
          <div className="afs-edit-card" onClick={(e) => e.stopPropagation()}>
            <div className="afs-edit-title">Cantidad</div>
            <input autoFocus type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }} />
            <div className="afs-edit-btns">
              <button className="afs-edit-cancel" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="afs-edit-save" onClick={saveEdit}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
