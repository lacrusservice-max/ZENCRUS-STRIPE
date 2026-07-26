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
    <div style={{ minHeight: "100vh", color: C.text, padding: "0 20px 120px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ paddingTop: 32, paddingBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#3fae6b", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · NUTRICIÓN</div>
          <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, letterSpacing: -0.5 }}>Planificador semanal</div>
        </div>

        {/* Day selector */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 20, paddingBottom: 4 }}>
          {DAYS.map((d) => {
            const m = getDayMacros(d);
            return (
              <button key={d} onClick={() => setActiveDay(d)} style={{ flexShrink: 0, minWidth: 78, padding: "12px 8px", borderRadius: 14, border: "none", background: activeDay === d ? "linear-gradient(135deg, #2563EB, #1d4ed8)" : "rgba(255,255,255,0.04)", cursor: "pointer", fontFamily: "inherit", textAlign: "center", boxShadow: activeDay === d ? "0 8px 20px rgba(37,99,235,0.3)" : "none" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: activeDay === d ? "#fff" : C.text }}>{DAY_LABELS[d].slice(0, 3)}</div>
                <div style={{ fontSize: 10, color: activeDay === d ? "rgba(255,255,255,0.7)" : C.dim2, marginTop: 4 }}>{m.calories} kcal</div>
              </button>
            );
          })}
        </div>

        {/* Day macros summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 24 }}>
          {[["Calorías", macros.calories, ""], ["Proteína", macros.protein, "g"], ["Carbos", macros.carbs, "g"], ["Grasa", macros.fat, "g"]].map(([l, v, u]) => (
            <div key={l as string} className="glass-card" style={{ padding: "16px 10px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 20 }}>{v}{u}</div>
              <div style={{ fontSize: 10.5, color: C.dim2, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Copy day */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Copy size={13} color={C.dim2} />
          <select onChange={(e) => { if (e.target.value) { copyDay(activeDay, e.target.value as DayKey); e.target.value = ""; } }} defaultValue="" className="glass-input" style={{ width: "auto", color: C.dim, fontSize: 12, padding: "8px 12px", cursor: "pointer" }}>
            <option value="">Copiar este día a…</option>
            {DAYS.filter((d) => d !== activeDay).map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
          </select>
        </div>

        {/* Meal slots */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {MEAL_SLOTS.map((slot) => {
            const meals = weekPlan[activeDay]?.[slot.id] ?? [];
            return (
              <div key={slot.id} className="glass-card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: meals.length ? 14 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 800 }}><span>{slot.emoji}</span>{slot.label}</div>
                  <button onClick={() => setPicker(slot.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 10, padding: "7px 14px", color: "#93c5fd", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} /> Agregar</button>
                </div>
                {meals.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
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
          <div onClick={(e) => e.stopPropagation()} className="glass-card" style={{ padding: 0, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 560, maxHeight: "70vh", overflow: "auto" }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: "rgba(15,18,24,0.95)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Elegir para {MEAL_SLOTS.find((s) => s.id === picker)?.label}</span>
              <button onClick={() => setPicker(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim }}><X size={20} /></button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {recipes.map((r) => (
                <button key={r.id} onClick={() => { setMeal(activeDay, picker, { id: `${r.id}_${Date.now()}`, name: r.title, calories: r.nutrition.calories, protein: r.nutrition.protein, carbs: r.nutrition.carbs, fat: r.nutrition.fat, emoji: r.emoji }); setPicker(null); }}
                  className="glass-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
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
