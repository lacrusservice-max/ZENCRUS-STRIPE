"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Apple, Dumbbell, Droplets, Flame, Zap, TrendingUp } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { nutrition } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface DashboardData {
  calories: { consumed: number; target: number };
  protein: { consumed: number; target: number };
  carbs: { consumed: number; target: number };
  fat: { consumed: number; target: number };
  water: { consumed: number; target: number };
  aiRecommendation?: string;
  recentMeals?: { id: string; name: string; calories: number; time: string }[];
  streak?: number;
}

function CircleProgress({ value, max, color, label, unit }: {
  value: number; max: number; color: string; label: string; unit: string;
}) {
  const pct = Math.min(value / max, 1);
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={80} height={80} viewBox="0 0 80 80">
        <circle cx={40} cy={40} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
        <circle
          cx={40} cy={40} r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        <text x={40} y={40} textAnchor="middle" dominantBaseline="middle" fill="#f1f5f9" fontSize={13} fontWeight={700}>
          {value}
        </text>
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#64748b" }}>{unit} de {max}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    nutrition.getDashboard()
      .then((res) => setData(res.data))
      .catch(() => {
        // Use demo data if API fails
        setData({
          calories: { consumed: 1420, target: 2100 },
          protein: { consumed: 85, target: 150 },
          carbs: { consumed: 180, target: 260 },
          fat: { consumed: 42, target: 70 },
          water: { consumed: 1.5, target: 2.5 },
          aiRecommendation: "Buen progreso hoy. Recuerda aumentar tu ingesta de proteínas en la cena para alcanzar tu meta. Una pechuga de pollo de 150g te daría los 65g que te faltan.",
          recentMeals: [
            { id: "1", name: "Desayuno — Avena con frutas", calories: 380, time: "08:30" },
            { id: "2", name: "Almuerzo — Pollo con arroz", calories: 620, time: "13:00" },
            { id: "3", name: "Snack — Yogur griego", calories: 160, time: "16:00" },
          ],
          streak: 7,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const firstName = user?.fullName?.split(" ")[0] || "Usuario";

  const skeletonStyle: React.CSSProperties = {
    height: 20,
    borderRadius: 8,
    background: "linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)",
    backgroundSize: "200% 100%",
    animation: "skeleton-wave 1.5s infinite",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, marginBottom: 4 }}>
            ¡Hola, {firstName}!
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>
            {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {data?.streak && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: "rgba(251,146,60,0.15)",
              border: "1px solid rgba(251,146,60,0.3)",
              borderRadius: 99,
            }}
          >
            <Flame size={16} color="#fb923c" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fb923c" }}>{data.streak} días seguidos</span>
          </div>
        )}
      </div>

      {/* Macros */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <TrendingUp size={18} color="#5b4fff" />
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Macros de hoy</h2>
        </div>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ ...skeletonStyle, height: 80 }} />
            ))}
          </div>
        ) : data ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 16, justifyItems: "center" }}>
            <CircleProgress value={data.calories.consumed} max={data.calories.target} color="#5b4fff" label="Calorías" unit="kcal" />
            <CircleProgress value={data.protein.consumed} max={data.protein.target} color="#2563eb" label="Proteína" unit="g" />
            <CircleProgress value={data.carbs.consumed} max={data.carbs.target} color="#00c2c0" label="Carbos" unit="g" />
            <CircleProgress value={data.fat.consumed} max={data.fat.target} color="#f59e0b" label="Grasa" unit="g" />
          </div>
        ) : null}

        {/* Water */}
        {data && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#94a3b8" }}>
                <Droplets size={15} color="#00c2c0" />
                Agua — {data.water.consumed}L de {data.water.target}L
              </div>
              <span style={{ fontSize: 13, color: "#00c2c0", fontWeight: 600 }}>
                {Math.round((data.water.consumed / data.water.target) * 100)}%
              </span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min((data.water.consumed / data.water.target) * 100, 100)}%`,
                  background: "linear-gradient(90deg, #00c2c0, #2563eb)",
                  borderRadius: 99,
                  transition: "width 0.8s ease",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* AI Recommendation */}
      {data?.aiRecommendation && (
        <div
          style={{
            background: "rgba(91,79,255,0.08)",
            border: "1px solid rgba(91,79,255,0.2)",
            borderRadius: 16,
            padding: "20px 24px",
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #5b4fff, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Bot size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 600, marginBottom: 6 }}>ZENA — IA Coach</div>
            <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.7 }}>{data.aiRecommendation}</p>
          </div>
        </div>
      )}

      {/* Quick actions + Recent meals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {/* Quick actions */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "20px 24px",
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Acciones rápidas</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Button variant="secondary" fullWidth onClick={() => router.push("/app/nutrition")} style={{ justifyContent: "flex-start", gap: 10 }}>
              <Apple size={16} color="#22c55e" /> Registrar comida
            </Button>
            <Button variant="secondary" fullWidth onClick={() => router.push("/app/nutrition")} style={{ justifyContent: "flex-start", gap: 10 }}>
              <Dumbbell size={16} color="#2563eb" /> Registrar ejercicio
            </Button>
            <Button fullWidth onClick={() => router.push("/app/chat")} style={{ justifyContent: "flex-start", gap: 10 }}>
              <Bot size={16} /> Chat con ZENA
            </Button>
          </div>
        </div>

        {/* Recent meals */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "20px 24px",
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Comidas recientes</h2>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ ...skeletonStyle, height: 48 }} />
              ))}
            </div>
          ) : data?.recentMeals?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.recentMeals.map((meal) => (
                <div
                  key={meal.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{meal.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{meal.time}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>
                    <Flame size={12} />
                    {meal.calories}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 14 }}>
              <Zap size={24} style={{ marginBottom: 8, opacity: 0.5, display: "block", margin: "0 auto 8px" }} />
              Sin comidas registradas hoy
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
