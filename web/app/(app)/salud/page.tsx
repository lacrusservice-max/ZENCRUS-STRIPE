"use client";

import Link from "next/link";
import { Activity, Footprints, Moon, Droplet, HeartPulse, Sparkles, CalendarHeart, ChevronRight, Plus, Minus } from "lucide-react";
import { useState } from "react";

const TODAY = { steps: 6420, stepGoal: 10000, sleepHours: 6.8, sleepGoal: 8, sleepQuality: "Bueno" };

const HABITS = [
  { id: "sleep",   label: "Dormir 7h o más" },
  { id: "water",   label: "8 vasos de agua" },
  { id: "workout", label: "Entrenar" },
  { id: "protein", label: "Proteína objetivo" },
  { id: "mind",    label: "Respirar / meditar 5 min" },
];

function StatCard({ icon, label, value, sub, pct, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; pct: number; color: string;
}) {
  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: `${color}1f`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: "#f4f4f5" }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2, marginBottom: 10 }}>{sub}</div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${Math.min(pct * 100, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export default function SaludPage() {
  const [water, setWater] = useState(3);
  const [habitsDone, setHabitsDone] = useState<Record<string, boolean>>({});

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.5s ease" }}>

      {/* Header */}
      <div style={{ paddingTop: 32, paddingBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#FF1F3D", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · SALUD</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, rgba(255,31,61,0.25), rgba(255,31,61,0.1))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Activity size={22} color="#FF1F3D" />
          </div>
          <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, color: "#f4f4f5", letterSpacing: -0.5 }}>Tu salud</div>
        </div>
      </div>

      <style>{`
        .hl-today { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        .hl-row { display: flex; flex-direction: column; gap: 16px; }
        @media (min-width: 900px) {
          .hl-row { flex-direction: row; }
          .hl-row > div { flex: 1; }
        }
      `}</style>

      {/* Hoy */}
      <div className="hl-today">
        <StatCard icon={<Footprints size={18} color="#FF1F3D" />} label="Pasos hoy" value={TODAY.steps.toLocaleString()} sub={`Meta: ${TODAY.stepGoal.toLocaleString()}`} pct={TODAY.steps / TODAY.stepGoal} color="#FF1F3D" />
        <StatCard icon={<Moon size={18} color="#FF5871" />} label="Sueño" value={`${TODAY.sleepHours}h`} sub={TODAY.sleepQuality} pct={TODAY.sleepHours / TODAY.sleepGoal} color="#FF5871" />
      </div>

      <div className="hl-row" style={{ marginBottom: 24 }}>
        {/* Hidratación */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(255,31,61,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Droplet size={18} color="#FF1F3D" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5" }}>Hidratación</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#f4f4f5" }}>{water}<span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}> / 8 vasos</span></div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setWater(w => Math.max(0, w - 1))} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={15} /></button>
              <button onClick={() => setWater(w => w + 1)} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,31,61,0.25)", border: "1px solid rgba(255,31,61,0.35)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={15} /></button>
            </div>
          </div>
          <div className="progress-bar" style={{ marginTop: 12 }}>
            <div className="progress-fill" style={{ width: `${Math.min((water / 8) * 100, 100)}%`, background: "#FF1F3D" }} />
          </div>
        </div>

        {/* Recuperación */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <HeartPulse size={18} color="#FFFFFF" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5" }}>Recuperación</div>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
            El check-in de energía, dolor muscular y estrés está disponible en la app móvil por ahora — próximamente aquí también.
          </div>
        </div>
      </div>

      {/* Hábitos */}
      <div className="glass-card" style={{ padding: 4, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 8px" }}>
          <Sparkles size={18} color="#FF1F3D" />
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5" }}>Hábitos de hoy</div>
        </div>
        {HABITS.map((h, i) => {
          const done = !!habitsDone[h.id];
          return (
            <button
              key={h.id}
              onClick={() => setHabitsDone(prev => ({ ...prev, [h.id]: !prev[h.id] }))}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                background: "none", border: "none", borderTopWidth: i > 0 ? 1 : 0, cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                background: done ? "#FF1F3D" : "transparent",
                border: done ? "none" : "1.5px solid rgba(255,255,255,0.25)",
              }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: done ? "#f4f4f5" : "rgba(255,255,255,0.6)" }}>{h.label}</span>
            </button>
          );
        })}
      </div>

      {/* Ciclo menstrual + tracker completo */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Link href="/menstrual" className="glass-card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CalendarHeart size={20} color="#FFFFFF" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5" }}>Ciclo menstrual</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Predicción, fase y nutrición por ciclo</div>
          </div>
          <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
        </Link>
        <Link href="/health-tracker" className="glass-card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,31,61,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Activity size={20} color="#FF1F3D" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5" }}>Tracker de salud completo</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Historial de pasos, sueño y frecuencia cardíaca</div>
          </div>
          <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
        </Link>
      </div>
    </div>
  );
}
