"use client";

import { useState } from "react";
import { TrendingUp, Award, Target, Calendar, Flame } from "lucide-react";
import toast from "react-hot-toast";

type ProgressTab = "overview" | "challenges" | "achievements";

const CHALLENGES = [
  { id: "1", emoji: "🔥", title: "Racha de 7 días", desc: "Registra actividad 7 días seguidos", progress: 0.43, daysLeft: 4, xp: 200 },
  { id: "2", emoji: "💧", title: "Hidratación perfecta", desc: "8 vasos de agua por 5 días", progress: 0.6, daysLeft: 2, xp: 100 },
  { id: "3", emoji: "💪", title: "Semana activa", desc: "Completa 4 entrenamientos esta semana", progress: 0.25, daysLeft: 5, xp: 300 },
];

const ACHIEVEMENTS = [
  { id: "1", emoji: "🥉", title: "Primer paso", desc: "Completaste tu primer día de seguimiento", unlocked: true },
  { id: "2", emoji: "🥈", title: "Semana fuerte", desc: "7 días de racha consecutiva", unlocked: false },
  { id: "3", emoji: "🏆", title: "Constante", desc: "30 días de racha consecutiva", unlocked: false },
  { id: "4", emoji: "⚡", title: "Velocista", desc: "Completa 10 entrenamientos", unlocked: false },
  { id: "5", emoji: "🥗", title: "Nutrido", desc: "Registra macros 7 días seguidos", unlocked: false },
  { id: "6", emoji: "💧", title: "Hidratado", desc: "8 vasos de agua 5 días seguidos", unlocked: false },
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
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.5s ease" }}>

      {/* Header */}
      <div style={{ paddingTop: 24, paddingBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: "#2563EB", letterSpacing: 3.5, marginBottom: 4 }}>ZENCRUS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TrendingUp size={24} color="#f4f4f5" />
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f4f4f5" }}>Progreso</div>
        </div>
      </div>

      {/* Stats summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { icon: <Flame size={20} color="#FF6B35" />, label: "Racha", value: "0 días" },
          { icon: <Target size={20} color="#2563EB" />, label: "Desafíos", value: `${CHALLENGES.length} activos` },
          { icon: <Award size={20} color="#FFD60A" />, label: "Logros", value: "1/6" },
        ].map(stat => (
          <div key={stat.label} className="glass-card" style={{ padding: "14px 12px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>{stat.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#f4f4f5", marginBottom: 2 }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: 4, marginBottom: 20 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, transition: "all 0.2s", background: activeTab === tab.id ? "#2563EB" : "transparent", color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.4)" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          {CHALLENGES.map(challenge => (
            <div key={challenge.id} className="glass-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {challenge.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5" }}>{challenge.title}</div>
                    <div style={{ background: "rgba(255,210,10,0.15)", borderRadius: 6, padding: "2px 8px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#FFD60A" }}>+{challenge.xp} XP</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{challenge.desc}</div>
                </div>
              </div>
              <div className="progress-bar" style={{ marginBottom: 6 }}>
                <div className="progress-fill" style={{ width: `${challenge.progress * 100}%`, background: "#2563EB" }} />
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{challenge.daysLeft} días restantes · {Math.round(challenge.progress * 100)}% completado</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Achievements */}
      {activeTab === "achievements" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {ACHIEVEMENTS.map(ach => (
            <div key={ach.id} className="glass-card" style={{ padding: 16, opacity: ach.unlocked ? 1 : 0.5, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8, filter: ach.unlocked ? "none" : "grayscale(1)" }}>{ach.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f4f4f5", marginBottom: 4 }}>{ach.title}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{ach.desc}</div>
              {ach.unlocked && (
                <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: "#30D158" }}>✓ Desbloqueado</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
