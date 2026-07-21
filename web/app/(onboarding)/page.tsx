"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { onboarding as onboardingApi } from "@/lib/api";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";

const TOTAL_STEPS = 7;

const GOALS = [
  { key: "lose_fat",    emoji: "🔥", label: "Perder grasa",   desc: "Definición, reducir peso y porcentaje de grasa corporal",  color: "#f97316" },
  { key: "gain_muscle", emoji: "💪", label: "Ganar músculo",  desc: "Aumentar masa muscular, fuerza y potencia",                 color: "#60a5fa" },
  { key: "maintain",    emoji: "⚖️",  label: "Mantenimiento", desc: "Mantener composición corporal y mejorar rendimiento",       color: "#a78bfa" },
];

const GENDERS = [
  { key: "male",   label: "Hombre",          desc: "Biológicamente masculino" },
  { key: "female", label: "Mujer",            desc: "Biológicamente femenino" },
  { key: "other",  label: "Prefiero no decir", desc: "" },
];

const ACTIVITY_OPTIONS = [
  { key: "sedentary",         emoji: "🪑", label: "Sedentario",  desc: "Trabajo de escritorio · Sin ejercicio regular" },
  { key: "lightly_active",    emoji: "🚶", label: "Ligero",      desc: "1-3 días/semana · Caminatas, actividad suave" },
  { key: "moderately_active", emoji: "🏃", label: "Moderado",    desc: "3-5 días/semana · Ejercicio cardiovascular o de fuerza" },
  { key: "very_active",       emoji: "⚡", label: "Muy activo",  desc: "6-7 días/semana · Entrenamiento de alta intensidad" },
  { key: "extremely_active",  emoji: "🏆", label: "Atleta",      desc: "Dobles sesiones · Competidor o trabajo físico extremo" },
];

const TRAINING_TYPES = [
  { value: "gym",          emoji: "🏋️", label: "Gimnasio / Pesas" },
  { value: "crossfit",     emoji: "🔥", label: "CrossFit / HIIT" },
  { value: "running",      emoji: "🏃", label: "Running" },
  { value: "cycling",      emoji: "🚴", label: "Ciclismo" },
  { value: "swimming",     emoji: "🏊", label: "Natación" },
  { value: "yoga",         emoji: "🧘", label: "Yoga / Pilates" },
  { value: "combat",       emoji: "🥊", label: "Artes Marciales" },
  { value: "calisthenics", emoji: "🤸", label: "Calistenia" },
  { value: "hyrox",        emoji: "🏟️", label: "HYROX / Rucking" },
  { value: "sports",       emoji: "⚽", label: "Deportes de equipo" },
  { value: "none",         emoji: "🌱", label: "Apenas empiezo" },
];

const DIET_OPTIONS = [
  { value: "none",         emoji: "✅", label: "Sin restricciones" },
  { value: "vegetarian",   emoji: "🥦", label: "Vegetariano" },
  { value: "vegan",        emoji: "🌱", label: "Vegano" },
  { value: "gluten_free",  emoji: "🌾", label: "Sin gluten" },
  { value: "lactose_free", emoji: "🥛", label: "Sin lactosa" },
  { value: "keto",         emoji: "🥑", label: "Cetogénico / Keto" },
  { value: "halal",        emoji: "☪️",  label: "Halal" },
  { value: "kosher",       emoji: "✡️",  label: "Kosher" },
  { value: "allergies",    emoji: "⚠️",  label: "Alergias alimentarias" },
];

const STEP_META = [
  { title: "¿Cuál es tu objetivo?",       subtitle: "ZENCRUS construirá tu plan completo con esto" },
  { title: "Cuéntanos sobre ti",           subtitle: "Calculamos tu metabolismo basal con Mifflin-St Jeor" },
  { title: "Tu cuerpo hoy",               subtitle: "Peso, estatura y edad para calcular tu TDEE exacto" },
  { title: "Peso objetivo",               subtitle: "Calculamos tu ritmo de progreso semana a semana" },
  { title: "Nivel de actividad",          subtitle: "Tu gasto calórico diario se multiplica por este factor" },
  { title: "Tipo de entrenamiento",       subtitle: "Personalizamos tu rutina y macros de rendimiento" },
  { title: "Preferencias alimentarias",   subtitle: "Tu plan nutricional respeta tus elecciones" },
];

function SelectCard({ selected, onSelect, emoji, label, desc, color }: { selected: boolean; onSelect: () => void; emoji: string; label: string; desc?: string; color?: string }) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: "16px 18px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit",
        background: selected ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${selected ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.09)"}`,
        marginBottom: 10, textAlign: "left", transition: "all 0.2s",
      }}
    >
      <span style={{ fontSize: 28, flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: selected ? "#60a5fa" : "#f4f4f5" }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{desc}</div>}
      </div>
      {selected && <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: "#fff" }}>✓</span>
      </div>}
    </button>
  );
}

function GridCard({ selected, onSelect, emoji, label }: { selected: boolean; onSelect: () => void; emoji: string; label: string }) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        padding: "14px 10px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
        background: selected ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${selected ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.09)"}`,
        transition: "all 0.2s",
      }}
    >
      <span style={{ fontSize: 24 }}>{emoji}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: selected ? "#60a5fa" : "rgba(255,255,255,0.6)", textAlign: "center" }}>{label}</span>
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [goal, setGoal] = useState("");
  const [gender, setGender] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [activity, setActivity] = useState("");
  const [trainingTypes, setTrainingTypes] = useState<string[]>([]);
  const [diet, setDiet] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState(3);

  const toggleTraining = (val: string) => {
    setTrainingTypes(prev => prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]);
  };

  const canNext = () => {
    switch (step) {
      case 0: return !!goal;
      case 1: return !!gender;
      case 2: return !!weight && !!height && !!age;
      case 3: return !!goalWeight;
      case 4: return !!activity;
      case 5: return trainingTypes.length > 0;
      case 6: return !!diet;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (!canNext()) { toast.error("Completa este paso para continuar"); return; }
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
    } else {
      await handleFinish();
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await onboardingApi.complete({
        goal, gender, weight: Number(weight), height: Number(height), age: Number(age),
        goalWeight: Number(goalWeight), activityLevel: activity,
        trainingType: trainingTypes[0] ?? "gym", trainingTypes,
        dietaryRestrictions: [diet], mealsPerDay,
      });
      router.replace("/welcome");
    } catch {
      toast.error("Error al guardar el perfil. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const { title, subtitle } = STEP_META[step];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => { if (step === 0) router.back(); else setStep(s => s - 1); }}
          style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.65)" }}
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", background: "#2563EB", borderRadius: 2, width: `${((step + 1) / TOTAL_STEPS) * 100}%`, transition: "width 0.3s ease" }} />
        </div>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{step + 1}/{TOTAL_STEPS}</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 500, margin: "0 auto", padding: "0 20px 100px", width: "100%" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28, marginTop: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={14} color="#fff" fill="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 900, color: "#2563EB", letterSpacing: 2 }}>ZENCRUS</span>
        </div>

        <div style={{ fontSize: 24, fontWeight: 800, color: "#f4f4f5", marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 28, lineHeight: 1.5 }}>{subtitle}</div>

        {/* Step 0: Goal */}
        {step === 0 && GOALS.map(g => (
          <SelectCard key={g.key} selected={goal === g.key} onSelect={() => setGoal(g.key)} emoji={g.emoji} label={g.label} desc={g.desc} color={g.color} />
        ))}

        {/* Step 1: Gender */}
        {step === 1 && GENDERS.map(g => (
          <SelectCard key={g.key} selected={gender === g.key} onSelect={() => setGender(g.key)} emoji={g.key === "male" ? "♂️" : g.key === "female" ? "♀️" : "⚧️"} label={g.label} desc={g.desc} />
        ))}

        {/* Step 2: Body */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "Peso actual (kg)", val: weight, set: setWeight, placeholder: "70", unit: "kg" },
              { label: "Estatura (cm)", val: height, set: setHeight, placeholder: "175", unit: "cm" },
              { label: "Edad", val: age, set: setAge, placeholder: "25", unit: "años" },
            ].map(field => (
              <div key={field.label}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{field.label}</div>
                <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, overflow: "hidden" }}>
                  <input type="number" value={field.val} onChange={e => field.set(e.target.value)} placeholder={field.placeholder} style={{ flex: 1, background: "none", border: "none", outline: "none", padding: "16px", fontSize: 16, color: "#fff", fontFamily: "inherit", fontWeight: 700 }} />
                  <span style={{ padding: "16px", color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 600 }}>{field.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Goal weight */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Peso objetivo (kg)</div>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, overflow: "hidden" }}>
              <input type="number" value={goalWeight} onChange={e => setGoalWeight(e.target.value)} placeholder="65" style={{ flex: 1, background: "none", border: "none", outline: "none", padding: "16px", fontSize: 22, color: "#fff", fontFamily: "inherit", fontWeight: 800 }} />
              <span style={{ padding: "16px", color: "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 600 }}>kg</span>
            </div>
            {weight && goalWeight && (
              <div style={{ marginTop: 16, background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                  Diferencia: <span style={{ fontWeight: 800, color: "#60a5fa" }}>{(Number(weight) - Number(goalWeight)).toFixed(1)} kg</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Activity */}
        {step === 4 && ACTIVITY_OPTIONS.map(a => (
          <SelectCard key={a.key} selected={activity === a.key} onSelect={() => setActivity(a.key)} emoji={a.emoji} label={a.label} desc={a.desc} />
        ))}

        {/* Step 5: Training type */}
        {step === 5 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {TRAINING_TYPES.map(t => (
                <GridCard key={t.value} selected={trainingTypes.includes(t.value)} onSelect={() => toggleTraining(t.value)} emoji={t.emoji} label={t.label} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 12 }}>Puedes seleccionar varios</div>
          </div>
        )}

        {/* Step 6: Diet + meals */}
        {step === 6 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
              {DIET_OPTIONS.map(d => (
                <GridCard key={d.value} selected={diet === d.value} onSelect={() => setDiet(d.value)} emoji={d.emoji} label={d.label} />
              ))}
            </div>
            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Comidas al día</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setMealsPerDay(n)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `1px solid ${mealsPerDay === n ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.09)"}`, background: mealsPerDay === n ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800, color: mealsPerDay === n ? "#60a5fa" : "rgba(255,255,255,0.5)" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 20px max(16px, env(safe-area-inset-bottom))", background: "rgba(10,10,10,0.98)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ maxWidth: 500, margin: "0 auto", display: "flex", gap: 12 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-secondary" style={{ flex: 1 }}>
              <ChevronLeft size={16} /> Anterior
            </button>
          )}
          <button onClick={handleNext} disabled={!canNext() || loading} className="btn-primary" style={{ flex: 2 }}>
            {loading ? <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} /> : step === TOTAL_STEPS - 1 ? "Finalizar" : (<>Siguiente <ChevronRight size={16} /></>)}
          </button>
        </div>
      </div>
    </div>
  );
}
