"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nutrition as nutritionApi } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, CheckCircle, RefreshCw, ChevronLeft, ChevronRight, Zap } from "lucide-react";

interface MealEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  completed: boolean;
}

interface MealSlot {
  id: string;
  label: string;
  emoji: string;
  entries: MealEntry[];
  completed: boolean;
}

const DEFAULT_MEALS: MealSlot[] = [
  { id: "breakfast", label: "Desayuno", emoji: "🌅", entries: [], completed: false },
  { id: "lunch",     label: "Almuerzo", emoji: "☀️", entries: [], completed: false },
  { id: "dinner",    label: "Cena",     emoji: "🌙", entries: [], completed: false },
  { id: "snack",     label: "Snacks",   emoji: "🍎", entries: [], completed: false },
];

function MacroRow({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {[{ l: "P", v: protein, c: "#60a5fa" }, { l: "C", v: carbs, c: "#00C2C0" }, { l: "G", v: fat, c: "#FF6B35" }].map(m => (
        <span key={m.l} style={{ fontSize: 10, color: m.c, fontWeight: 700 }}>{m.l} {Math.round(m.v)}g</span>
      ))}
    </div>
  );
}

export default function NutritionPage() {
  const [meals, setMeals] = useState<MealSlot[]>(DEFAULT_MEALS);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const totalCalories = meals.reduce((a, m) => a + m.entries.reduce((b, e) => b + e.calories, 0), 0);
  const totalProtein  = meals.reduce((a, m) => a + m.entries.reduce((b, e) => b + e.protein, 0), 0);
  const totalCarbs    = meals.reduce((a, m) => a + m.entries.reduce((b, e) => b + e.carbs, 0), 0);
  const totalFat      = meals.reduce((a, m) => a + m.entries.reduce((b, e) => b + e.fat, 0), 0);

  const caloriesTarget = 2000;
  const calPct = Math.min(totalCalories / caloriesTarget, 1);

  useEffect(() => {
    setLoading(true);
    nutritionApi.getDashboard().then(res => {
      const d = res.data?.data;
      if (d?.meals) setMeals(d.meals);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedDate]);

  const toggleMeal = (mealId: string) => {
    setMeals(prev => prev.map(m => m.id === mealId ? { ...m, completed: !m.completed } : m));
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      await nutritionApi.generatePlan();
      toast.success("Plan generado con IA!");
    } catch {
      toast.error("Error al generar el plan");
    } finally {
      setGenerating(false);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d);
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const dateStr = selectedDate.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.5s ease" }}>

      {/* Header */}
      <div style={{ paddingTop: 24, paddingBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: "#2563EB", letterSpacing: 3.5, marginBottom: 4 }}>ZENCRUS</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f4f4f5" }}>Nutrición</div>
          <button onClick={generatePlan} disabled={generating} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 12, padding: "8px 14px", cursor: "pointer", color: "#60a5fa", fontSize: 12, fontWeight: 700 }}>
            {generating ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #60a5fa", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} /> : <Zap size={14} />}
            Generar plan IA
          </button>
        </div>
      </div>

      {/* Date selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: "10px 16px", marginBottom: 20 }}>
        <button onClick={() => shiftDate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f4f4f5", textTransform: "capitalize" }}>{dateStr}</div>
          {isToday && <div style={{ fontSize: 10, color: "#2563EB", fontWeight: 700, marginTop: 2 }}>HOY</div>}
        </div>
        <button onClick={() => shiftDate(1)} disabled={isToday} style={{ background: "none", border: "none", cursor: isToday ? "not-allowed" : "pointer", color: isToday ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", display: "flex" }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Daily summary */}
      <div style={{ marginBottom: 20 }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#f4f4f5", lineHeight: 1 }}>{totalCalories.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>/ {caloriesTarget.toLocaleString()} kcal</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[{ l: "Proteína", v: totalProtein, max: 150, c: "#60a5fa" }, { l: "Carbos", v: totalCarbs, max: 200, c: "#00C2C0" }, { l: "Grasa", v: totalFat, max: 65, c: "#FF6B35" }].map(m => (
                <div key={m.l} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", width: 52 }}>{m.l}</span>
                  <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
                    <div style={{ height: 4, background: m.c, borderRadius: 2, width: `${Math.min(m.v / m.max, 1) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 10, color: m.c, fontWeight: 700, width: 36 }}>{Math.round(m.v)}g</span>
                </div>
              ))}
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${calPct * 100}%`, background: totalCalories > caloriesTarget * 1.15 ? "#FF3B30" : "#2563EB" }} />
          </div>
        </div>
      </div>

      {/* Meal slots */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {meals.map(meal => (
          <div key={meal.id} className="glass-card" style={{ padding: 0 }}>
            {/* Meal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{meal.emoji}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5" }}>{meal.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                    {meal.entries.length > 0 ? `${meal.entries.reduce((a, e) => a + e.calories, 0)} kcal` : "Sin alimentos"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {meal.entries.length > 0 && <MacroRow protein={meal.entries.reduce((a,e)=>a+e.protein,0)} carbs={meal.entries.reduce((a,e)=>a+e.carbs,0)} fat={meal.entries.reduce((a,e)=>a+e.fat,0)} />}
                <button
                  onClick={() => toggleMeal(meal.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: meal.completed ? "#30D158" : "rgba(255,255,255,0.25)", display: "flex" }}
                >
                  <CheckCircle size={20} />
                </button>
              </div>
            </div>

            {/* Entries */}
            {meal.entries.map(entry => (
              <div key={entry.id} style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#f4f4f5" }}>{entry.name}</div>
                  <MacroRow protein={entry.protein} carbs={entry.carbs} fat={entry.fat} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{entry.calories} kcal</span>
              </div>
            ))}

            {/* Add button */}
            <button
              onClick={() => toast("Función de agregar alimento próximamente")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "inherit" }}
            >
              <Plus size={16} color="#2563EB" />
              <span style={{ color: "#2563EB", fontWeight: 600 }}>Agregar alimento</span>
            </button>
          </div>
        ))}
      </div>

      {/* Regenerate plan */}
      <div style={{ marginTop: 24 }}>
        <button
          onClick={generatePlan}
          disabled={generating}
          className="btn-secondary"
          style={{ width: "100%" }}
        >
          <RefreshCw size={16} />
          Regenerar plan con IA
        </button>
      </div>
    </div>
  );
}
