"use client";

import { useState } from "react";
import { TrendingUp, Award, Target, Flame, Check, Droplet, Dumbbell, Medal, Trophy, Zap, Salad } from "lucide-react";
import toast from "react-hot-toast";

type ProgressTab = "overview" | "challenges" | "achievements";

const CHALLENGES = [
  { id: "1", icon: Flame, color: "#FF6B35", title: "Racha de 7 días", desc: "Registra actividad 7 días seguidos", progress: 0.43, daysLeft: 4, xp: 200 },
  { id: "2", icon: Droplet, color: "#38BDF8", title: "Hidratación perfecta", desc: "8 vasos de agua por 5 días", progress: 0.6, daysLeft: 2, xp: 100 },
  { id: "3", icon: Dumbbell, color: "#60a5fa", title: "Semana activa", desc: "Completa 4 entrenamientos esta semana", progress: 0.25, daysLeft: 5, xp: 300 },
];

const ACHIEVEMENTS = [
  { id: "1", icon: Medal, color: "#c9a94e", title: "Primer paso", desc: "Completaste tu primer día de seguimiento", unlocked: true },
  { id: "2", icon: Medal, color: "#a1a1aa", title: "Semana fuerte", desc: "7 días de racha consecutiva", unlocked: false },
  { id: "3", icon: Trophy, color: "#FFD60A", title: "Constante", desc: "30 días de racha consecutiva", unlocked: false },
  { id: "4", icon: Zap, color: "#60a5fa", title: "Velocista", desc: "Completa 10 entrenamientos", unlocked: false },
  { id: "5", icon: Salad, color: "#3fae6b", title: "Nutrido", desc: "Registra macros 7 días seguidos", unlocked: false },
  { id: "6", icon: Droplet, color: "#38BDF8", title: "Hidratado", desc: "8 vasos de agua 5 días seguidos", unlocked: false },
];

const WEIGHT_DATA = [74, 73.5, 73, 72.8, 72.3, 71.9, 71.5];
const DATES = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7"];

export default function ProgressPage() {
  const [activeTab, setActiveTab] = useState<ProgressTab>("overview");

  const TABS: { id: ProgressTab; label: string }[] = [
    { id: "overview", label: "Resumen" },
    { id: "challenges", label: "Desafíos" },
    { id: "achievements", label: "Logros" },
  ];

  const minW = Math.min(...WEIGHT_DATA);
  const maxW = Math.max(...WEIGHT_DATA);

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.5s ease" }}>

      {/* Header */}
      <div style={{ paddingTop: 32, paddingBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#FFD60A", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · PROGRESO</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, rgba(255,214,10,0.25), rgba(255,107,53,0.15))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <TrendingUp size={22} color="#FFD60A" />
          </div>
          <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, color: "#f4f4f5", letterSpacing: -0.5 }}>Progreso</div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="pg-stats" style={{ marginBottom: 24 }}>
        {[
          { icon: <Flame size={22} color="#FF6B35" />, glow: "rgba(255,107,53,0.15)", label: "Racha", value: "0 días" },
          { icon: <Target size={22} color="#60a5fa" />, glow: "rgba(37,99,235,0.15)", label: "Desafíos", value: `${CHALLENGES.length} activos` },
          { icon: <Award size={22} color="#FFD60A" />, glow: "rgba(255,214,10,0.15)", label: "Logros", value: "1/6" },
        ].map(stat => (
          <div key={stat.label} className="glass-card" style={{ padding: 20, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: stat.glow, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>{stat.icon}</div>
            <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 22, color: "#f4f4f5", marginBottom: 2 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: 4, marginBottom: 24, maxWidth: 480 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, transition: "all 0.2s", background: activeTab === tab.id ? "#2563EB" : "transparent", color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.4)" }}>
            {tab.label}
          </button>
        ))}
      </div>

      <style>{`
        .pg-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .pg-overview-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        .pg-achievements-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (min-width: 900px) {
          .pg-overview-grid { grid-template-columns: 1fr 1fr; }
          .pg-achievements-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="pg-overview-grid">
          {/* Weight chart */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", marginBottom: 4 }}>Evolución de peso</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>Últimas 7 semanas</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
              {WEIGHT_DATA.map((v, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ flex: 1, width: "100%", background: i === WEIGHT_DATA.length - 1 ? "#2563EB" : "rgba(37,99,235,0.3)", borderRadius: "4px 4px 0 0", minHeight: 4, height: `${((v - minW) / (maxW - minW || 1)) * 80 + 20}%` }} />
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{v}</span>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>{DATES[i]}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, padding: "12px 0 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Inicial</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f4f4f5" }}>{WEIGHT_DATA[0]} kg</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Actual</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#30D158" }}>{WEIGHT_DATA[WEIGHT_DATA.length - 1]} kg</div>
              </div>
            </div>
          </div>

          {/* Weekly summary */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", marginBottom: 16 }}>Resumen semanal</div>
            {[
              { label: "Entrenamientos", val: 0, max: 4, color: "#00C2C0" },
              { label: "Días con macros", val: 0, max: 7, color: "#60a5fa" },
              { label: "Días hidratado", val: 0, max: 7, color: "#38BDF8" },
              { label: "Check-ins", val: 0, max: 7, color: "#30D158" },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#f4f4f5" }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.val}/{item.max}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(item.val / item.max) * 100}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Challenges */}
      {activeTab === "challenges" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CHALLENGES.map(challenge => {
            const Icon = challenge.icon;
            return (
              <div key={challenge.id} className="glass-card" style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${challenge.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={22} color={challenge.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f4f5" }}>{challenge.title}</div>
                      <div style={{ background: "rgba(255,210,10,0.15)", borderRadius: 6, padding: "3px 9px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#FFD60A" }}>+{challenge.xp} XP</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{challenge.desc}</div>
                  </div>
                </div>
                <div className="progress-bar" style={{ marginBottom: 6 }}>
                  <div className="progress-fill" style={{ width: `${challenge.progress * 100}%`, background: challenge.color }} />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{challenge.daysLeft} días restantes · {Math.round(challenge.progress * 100)}% completado</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Achievements */}
      {activeTab === "achievements" && (
        <div className="pg-achievements-grid">
          {ACHIEVEMENTS.map(ach => {
            const Icon = ach.icon;
            return (
              <div key={ach.id} className="glass-card" style={{ padding: 20, opacity: ach.unlocked ? 1 : 0.45, textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: `${ach.color}22`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", filter: ach.unlocked ? "none" : "grayscale(0.6)" }}>
                  <Icon size={26} color={ach.color} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", marginBottom: 4 }}>{ach.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{ach.desc}</div>
                {ach.unlocked && (
                  <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: "#30D158", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <Check size={12} strokeWidth={3} /> Desbloqueado
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
