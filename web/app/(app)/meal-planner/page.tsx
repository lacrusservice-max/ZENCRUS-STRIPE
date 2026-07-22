"use client";

import { useEffect, useState } from "react";
import { Plus, X, Trash2, Copy } from "lucide-react";
import { useMealPlanStore, DAYS, DAY_LABELS, MEAL_SLOTS, DayKey, MealSlotId } from "@/store/mealPlanStore";
import { useRecipesStore } from "@/store/recipesStore";

const C = { bg: "#08090c", panel: "#0f1218", panelHi: "#131824", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875" };

export default function MealPlannerPage() {
  const { weekPlan, load, setMeal, removeMeal, copyDay, getDayMacros } = useMealPlanStore();
  const { recipes } = useRecipesStore();
  const [activeDay, setActiveDay] = useState<DayKey>("lun");
  const [picker, setPicker] = useState<MealSlotId | null>(null);

  useEffect(() => { load(); }, [load]);

  const macros = getDayMacros(activeDay);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "36px 24px 100px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b8cce", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Nutrición</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Planificador semanal</h1>
        </div>

        {/* Day selector */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 18, paddingBottom: 4 }}>
          {DAYS.map((d) => {
            const m = getDayMacros(d);
            return (
              <button key={d} onClick={() => setActiveDay(d)} style={{ flexShrink: 0, minWidth: 74, padding: "10px 8px", borderRadius: 12, border: `1px solid ${activeDay === d ? C.navy : C.border}`, background: activeDay === d ? C.navySoft : C.panel, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: activeDay === d ? "#8fa9dd" : C.text }}>{DAY_LABELS[d].slice(0, 3)}</div>
                <div style={{ fontSize: 10, color: C.dim2, marginTop: 3 }}>{m.calories} kcal</div>
              </button>
            );
          })}
        </div>

        {/* Day macros summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
          {[["Calorías", macros.calories, ""], ["Proteína", macros.protein, "g"], ["Carbos", macros.carbs, "g"], ["Grasa", macros.fat, "g"]].map(([l, v, u]) => (
            <div key={l as string} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{v}{u}</div>
              <div style={{ fontSize: 10.5, color: C.dim2, marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Copy day */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <select onChange={(e) => { if (e.target.value) { copyDay(activeDay, e.target.value as DayKey); e.target.value = ""; } }} defaultValue="" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.dim, fontSize: 12, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            <option value="">📋 Copiar este día a…</option>
            {DAYS.filter((d) => d !== activeDay).map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
          </select>
        </div>

        {/* Meal slots */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {MEAL_SLOTS.map((slot) => {
            const meals = weekPlan[activeDay]?.[slot.id] ?? [];
            return (
              <div key={slot.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: meals.length ? 12 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800 }}><span>{slot.emoji}</span>{slot.label}</div>
                  <button onClick={() => setPicker(slot.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: C.navySoft, border: `1px solid ${C.navy}`, borderRadius: 9, padding: "6px 12px", color: "#8fa9dd", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} /> Agregar</button>
                </div>
                {meals.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                    <div><span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.emoji} {m.name}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, color: C.dim }}>{m.calories} kcal</span>
                      <button onClick={() => removeMeal(activeDay, slot.id, m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim2 }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recipe picker */}
      {picker && (
        <div onClick={() => setPicker(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderRadius: "20px 20px 0 0", border: `1px solid ${C.border}`, width: "100%", maxWidth: 560, maxHeight: "70vh", overflow: "auto" }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.panel, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Elegir para {MEAL_SLOTS.find((s) => s.id === picker)?.label}</span>
              <button onClick={() => setPicker(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim }}><X size={20} /></button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {recipes.map((r) => (
                <button key={r.id} onClick={() => { setMeal(activeDay, picker, { id: `${r.id}_${Date.now()}`, name: r.title, calories: r.nutrition.calories, protein: r.nutrition.protein, carbs: r.nutrition.carbs, fat: r.nutrition.fat, emoji: r.emoji }); setPicker(null); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.emoji} {r.title}</span>
                  <span style={{ fontSize: 12, color: C.dim }}>{r.nutrition.calories} kcal</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
