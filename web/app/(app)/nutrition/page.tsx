"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nutrition as nutritionApi } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, CheckCircle, RefreshCw, ChevronLeft, ChevronRight, Zap, Sunrise, Sun, Moon, Apple, type LucideIcon } from "lucide-react";

const MEAL_ICONS: Record<string, LucideIcon> = { breakfast: Sunrise, lunch: Sun, dinner: Moon, snack: Apple };

function MacroRing({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const size = 52, stroke = 4.5, r = size / 2 - stroke / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(max > 0 ? value / max : 0, 0), 1);
  const offset = circ * (1 - pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color }}>
          {Math.round(value)}
        </div>
      </div>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>/ {max}g</span>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{label}</span>
    </div>
  );
}

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
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.5s ease" }}>

      {/* Header */}
      <div style={{ paddingTop: 32, paddingBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#00C2C0", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · NUTRICIÓN</div>
          <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, color: "#f4f4f5", letterSpacing: -0.5 }}>Nutrición</div>
        </div>
        <button onClick={generatePlan} disabled={generating} style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, rgba(0,194,192,0.2), rgba(37,99,235,0.15))", border: "1px solid rgba(0,194,192,0.35)", borderRadius: 14, padding: "12px 20px", cursor: "pointer", color: "#5eead4", fontSize: 13, fontWeight: 700 }}>
          {generating ? <div style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid #5eead4", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} /> : <Zap size={15} />}
          Generar plan IA
        </button>
      </div>

      <div className="nt-grid">
        {/* Main column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Date selector */}
          <div className="glass-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px" }}>
            <button onClick={() => shiftDate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex" }}>
              <ChevronLeft size={20} />
            </button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", textTransform: "capitalize" }}>{dateStr}</div>
              {isToday && <div style={{ fontSize: 10, color: "#00C2C0", fontWeight: 800, marginTop: 2, letterSpacing: 1 }}>HOY</div>}
            </div>
            <button onClick={() => shiftDate(1)} disabled={isToday} style={{ background: "none", border: "none", cursor: isToday ? "not-allowed" : "pointer", color: isToday ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", display: "flex" }}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Daily summary — accent hero */}
          <div className="glass-card-accent">
            <div style={{ padding: 26 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 56, color: "#f4f4f5", lineHeight: 1 }}>{totalCalories.toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>de {caloriesTarget.toLocaleString()} kcal objetivo</div>
                </div>
                <div style={{ display: "flex", gap: 18 }}>
                  {[{ l: "Proteína", v: totalProtein, max: 150, c: "#60a5fa" }, { l: "Carbos", v: totalCarbs, max: 200, c: "#00C2C0" }, { l: "Grasa", v: totalFat, max: 65, c: "#FF6B35" }].map(m => (
                    <MacroRing key={m.l} label={m.l} value={m.v} max={m.max} color={m.c} />
                  ))}
                </div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${calPct * 100}%`, background: totalCalories > caloriesTarget * 1.15 ? "#FF3B30" : "linear-gradient(90deg, #2563EB, #00C2C0)" }} />
              </div>
            </div>
          </div>

          {/* Meal slots */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {meals.map(meal => (
              <div key={meal.id} className="glass-card" style={{ padding: 0 }}>
                {/* Meal header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {(() => { const MealIcon = MEAL_ICONS[meal.id] ?? Apple; return (
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(96,165,250,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <MealIcon size={19} color="#60a5fa" />
                      </div>
                    ); })()}
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f4f5" }}>{meal.label}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                        {meal.entries.length > 0 ? `${meal.entries.reduce((a, e) => a + e.calories, 0)} kcal` : "Sin alimentos"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                  <div key={entry.id} style={{ padding: "10px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "inherit" }}
                >
                  <Plus size={16} color="#00C2C0" />
                  <span style={{ color: "#00C2C0", fontWeight: 600 }}>Agregar alimento</span>
                </button>
              </div>
            ))}
          </div>

          {/* Regenerate plan */}
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

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="section-label">Resumen de macros</div>
          <div className="glass-card" style={{ padding: 20 }}>
            {[{ l: "Proteína", v: totalProtein, max: 150, c: "#60a5fa" }, { l: "Carbohidratos", v: totalCarbs, max: 200, c: "#00C2C0" }, { l: "Grasas", v: totalFat, max: 65, c: "#FF6B35" }].map((m, i) => (
              <div key={m.l} style={{ marginBottom: i < 2 ? 16 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{m.l}</span>
                  <span style={{ color: m.c, fontWeight: 700 }}>{Math.round(m.v)} / {m.max}g</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min((m.v / m.max) * 100, 100)}%`, background: m.c }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .nt-grid { display: flex; flex-direction: column; gap: 24px; margin-top: 24px; }
        @media (min-width: 900px) {
          .nt-grid { flex-direction: row; align-items: flex-start; }
          .nt-grid > div:first-child { flex: 1 1 0; min-width: 0; }
          .nt-grid > div:last-child { flex: 0 0 320px; position: sticky; top: 24px; }
        }
      `}</style>
    </div>
  );
}
