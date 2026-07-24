"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target, Venus, Mars, Calendar, Weight, Activity, Salad, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { onboarding, diet as dietApi, workout as workoutApi } from "@/lib/api";

const TOTAL_STEPS = 7;

const goals = [
  { value: "lose_weight", label: "Perder peso", icon: "🎯" },
  { value: "gain_muscle", label: "Ganar músculo", icon: "💪" },
  { value: "maintain", label: "Mantener peso", icon: "⚖️" },
  { value: "general_health", label: "Salud general", icon: "❤️" },
];

const activityLevels = [
  { value: "sedentary", label: "Sedentario", desc: "Poco o nada de ejercicio" },
  { value: "light", label: "Ligero", desc: "1-3 días por semana" },
  { value: "moderate", label: "Moderado", desc: "3-5 días por semana" },
  { value: "active", label: "Activo", desc: "6-7 días por semana" },
  { value: "very_active", label: "Muy activo", desc: "Ejercicio intenso diario" },
];

const dietRestrictions = [
  "Vegetariano",
  "Vegano",
  "Sin gluten",
  "Sin lactosa",
  "Halal",
  "Kosher",
];

interface OnboardingData {
  goal: string;
  sex: string;
  birthDate: string;
  weight: string;
  height: string;
  activityLevel: string;
  restrictions: string[];
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    goal: "",
    sex: "",
    birthDate: "",
    weight: "",
    height: "",
    activityLevel: "",
    restrictions: [],
  });

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const toggleRestriction = (r: string) => {
    setData((d) => ({
      ...d,
      restrictions: d.restrictions.includes(r)
        ? d.restrictions.filter((x) => x !== r)
        : [...d.restrictions, r],
    }));
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await onboarding.complete({
        goal: data.goal,
        gender: data.sex,
        birthDate: data.birthDate,
        weight: parseFloat(data.weight),
        height: parseFloat(data.height),
        activityLevel: data.activityLevel,
        dietaryRestrictions: data.restrictions,
      });

      // Genera automáticamente el plan de nutrición + rutina personalizados con IA
      const workoutLevel = ["sedentary", "light"].includes(data.activityLevel) ? "beginner"
        : data.activityLevel === "moderate" ? "intermediate" : "advanced";
      const workoutGoal = data.goal === "lose_weight" ? "endurance" : data.goal === "gain_muscle" ? "hypertrophy" : "functional";
      const daysPerWeek = { sedentary: 2, light: 3, moderate: 4, active: 5, very_active: 6 }[data.activityLevel] ?? 3;

      await Promise.allSettled([
        dietApi.generate({ durationDays: 7 }),
        workoutApi.generate({ level: workoutLevel, goal: workoutGoal, daysPerWeek, equipment: ["bodyweight", "dumbbells"] }),
      ]);

      toast.success("¡Plan generado con IA!");
      router.push("/welcome");
    } catch {
      toast.error("Error al guardar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "36px 32px",
    animation: "fadeInUp 0.35s ease forwards",
  };

  const optionStyle = (selected: boolean): React.CSSProperties => ({
    padding: "14px 18px",
    borderRadius: 12,
    border: selected ? "1px solid rgba(91,79,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
    background: selected ? "rgba(91,79,255,0.15)" : "rgba(255,255,255,0.03)",
    cursor: "pointer",
    transition: "all 0.15s",
    color: selected ? "#f1f5f9" : "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: 12,
  });

  return (
    <div>
      {/* Progress */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "#94a3b8" }}>
          <span>Paso {step} de {TOTAL_STEPS}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #5b4fff, #2563eb)",
              borderRadius: 99,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      <div style={cardStyle}>
        {/* Step 1: Goal */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>¿Cuál es tu objetivo?</h2>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>Elige el objetivo principal que quieres lograr.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {goals.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setData((d) => ({ ...d, goal: g.value }))}
                  style={{ ...optionStyle(data.goal === g.value), fontFamily: "inherit", fontSize: 15, fontWeight: 500, width: "100%", textAlign: "left" }}
                >
                  <span style={{ fontSize: 22 }}>{g.icon}</span>
                  {g.label}
                </button>
              ))}
            </div>
            <Button fullWidth onClick={next} disabled={!data.goal} size="lg">Continuar</Button>
          </div>
        )}

        {/* Step 2: Sex */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>¿Cuál es tu sexo?</h2>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>Lo usamos para calcular tus necesidades calóricas.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { value: "male", label: "Masculino", icon: <Mars size={28} color="#2563eb" /> },
                { value: "female", label: "Femenino", icon: <Venus size={28} color="#ec4899" /> },
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setData((d) => ({ ...d, sex: s.value }))}
                  style={{
                    ...optionStyle(data.sex === s.value),
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "24px 16px",
                    fontFamily: "inherit",
                    fontSize: 15,
                    fontWeight: 500,
                    width: "100%",
                  }}
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Button variant="secondary" onClick={prev}>Atrás</Button>
              <Button fullWidth onClick={next} disabled={!data.sex}>Continuar</Button>
            </div>
          </div>
        )}

        {/* Step 3: Birth date */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>¿Cuándo naciste?</h2>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>Tu edad nos ayuda a personalizar tu plan.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={14} /> Fecha de nacimiento
              </label>
              <input
                type="date"
                value={data.birthDate}
                onChange={(e) => setData((d) => ({ ...d, birthDate: e.target.value }))}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().split("T")[0]}
                className="glass-input"
                style={{ colorScheme: "dark" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Button variant="secondary" onClick={prev}>Atrás</Button>
              <Button fullWidth onClick={next} disabled={!data.birthDate}>Continuar</Button>
            </div>
          </div>
        )}

        {/* Step 4: Weight & Height */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Tu medidas actuales</h2>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>Para calcular tus calorías y macros exactos.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <Weight size={14} /> Peso actual (kg)
              </label>
              <input
                type="number"
                placeholder="70"
                min="30"
                max="300"
                value={data.weight}
                onChange={(e) => setData((d) => ({ ...d, weight: e.target.value }))}
                className="glass-input"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500 }}>Talla (cm)</label>
              <input
                type="number"
                placeholder="170"
                min="100"
                max="250"
                value={data.height}
                onChange={(e) => setData((d) => ({ ...d, height: e.target.value }))}
                className="glass-input"
              />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Button variant="secondary" onClick={prev}>Atrás</Button>
              <Button fullWidth onClick={next} disabled={!data.weight || !data.height}>Continuar</Button>
            </div>
          </div>
        )}

        {/* Step 5: Activity level */}
        {step === 5 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Nivel de actividad</h2>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>¿Cuánto ejercicio haces normalmente?</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activityLevels.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setData((d) => ({ ...d, activityLevel: a.value }))}
                  style={{ ...optionStyle(data.activityLevel === a.value), fontFamily: "inherit", width: "100%", textAlign: "left" }}
                >
                  <Activity size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Button variant="secondary" onClick={prev}>Atrás</Button>
              <Button fullWidth onClick={next} disabled={!data.activityLevel}>Continuar</Button>
            </div>
          </div>
        )}

        {/* Step 6: Dietary restrictions */}
        {step === 6 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Restricciones dietéticas</h2>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>Selecciona las que apliquen (puedes omitir este paso).</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {dietRestrictions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRestriction(r)}
                  style={{
                    ...optionStyle(data.restrictions.includes(r)),
                    fontFamily: "inherit",
                    fontSize: 13,
                    justifyContent: "center",
                    padding: "10px 12px",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Salad size={14} />
                  {r}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Button variant="secondary" onClick={prev}>Atrás</Button>
              <Button fullWidth onClick={next}>Continuar</Button>
            </div>
            <button
              type="button"
              onClick={next}
              style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Omitir este paso
            </button>
          </div>
        )}

        {/* Step 7: Done */}
        {step === 7 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "center", textAlign: "center" }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #5b4fff, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "pulse-glow 2s infinite",
              }}
            >
              <Zap size={36} color="#fff" fill="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 10 }}>
                ¡Tu plan está listo!
              </h2>
              <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.7 }}>
                ZENA ha generado un plan de nutrición y ejercicio personalizado basado en tus datos.
                Vamos a transformar tu cuerpo juntos.
              </p>
            </div>
            <Button fullWidth loading={loading} onClick={handleFinish} size="lg" style={{ fontSize: 16, padding: "16px" }}>
              Ver mi plan personalizado
            </Button>
            <button
              type="button"
              onClick={prev}
              style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Modificar mis respuestas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
