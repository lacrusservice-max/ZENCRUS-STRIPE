"use client";

import { useState } from "react";
import { Flame, Trophy, Medal, Award } from "lucide-react";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875", gold: "#c9a94e" };

type Scope = "week" | "month" | "all";
const DATA: Record<Scope, { name: string; pts: number; me?: boolean; streak: number }[]> = {
  week: [
    { name: "Sofía R.", pts: 1240, streak: 12 }, { name: "Diego M.", pts: 1180, streak: 9 },
    { name: "Tú", pts: 1050, me: true, streak: 7 }, { name: "Valeria C.", pts: 980, streak: 6 },
    { name: "Andrés L.", pts: 910, streak: 5 }, { name: "Camila T.", pts: 870, streak: 8 },
    { name: "Jorge V.", pts: 720, streak: 3 }, { name: "Mariana S.", pts: 650, streak: 4 },
  ],
  month: [
    { name: "Diego M.", pts: 4820, streak: 22 }, { name: "Tú", pts: 4510, me: true, streak: 18 },
    { name: "Sofía R.", pts: 4390, streak: 20 }, { name: "Camila T.", pts: 3980, streak: 15 },
    { name: "Andrés L.", pts: 3610, streak: 12 }, { name: "Valeria C.", pts: 3200, streak: 11 },
  ],
  all: [
    { name: "Sofía R.", pts: 18400, streak: 64 }, { name: "Diego M.", pts: 17200, streak: 58 },
    { name: "Camila T.", pts: 15100, streak: 41 }, { name: "Tú", pts: 12800, me: true, streak: 33 },
    { name: "Andrés L.", pts: 11050, streak: 29 }, { name: "Valeria C.", pts: 9800, streak: 24 },
  ],
};
const MEDAL_COLOR = ["#FFD60A", "#c9c9c9", "#c9a94e"];
const MEDAL_ICON = [Trophy, Medal, Award];

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("week");
  const rows = DATA[scope];

  return (
    <div style={{ minHeight: "100vh", color: C.text, padding: "0 20px 120px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ paddingTop: 32, paddingBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#FFD60A", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · GAMIFICACIÓN</div>
          <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, color: C.text, letterSpacing: -0.5 }}>Leaderboard</div>
        </div>

        <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 14, padding: 4, gap: 4, marginBottom: 24 }}>
          {([["week", "Semana"], ["month", "Mes"], ["all", "Histórico"]] as [Scope, string][]).map(([s, l]) => (
            <button key={s} onClick={() => setScope(s)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: scope === s ? "linear-gradient(135deg, #FF1F3D, #FF0030)" : "transparent", color: scope === s ? "#fff" : C.dim, boxShadow: scope === s ? "0 8px 20px rgba(255,31,61,0.3)" : "none" }}>{l}</button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r, i) => {
            const MedalIcon = i < 3 ? MEDAL_ICON[i] : null;
            return (
              <div key={r.name} className={r.me ? "glass-card-accent" : undefined} style={r.me ? {} : undefined}>
                <div className={r.me ? undefined : "glass-card"} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
                  <span style={{ width: 30, textAlign: "center", display: "flex", justifyContent: "center" }}>
                    {MedalIcon ? <MedalIcon size={20} color={MEDAL_COLOR[i]} /> : <span style={{ fontSize: 14, fontWeight: 800, color: C.dim2 }}>{i + 1}</span>}
                  </span>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: r.me ? "linear-gradient(135deg, #FF1F3D, #FF0030)" : "rgba(255,255,255,0.06)", border: r.me ? "none" : `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: r.me ? "#fff" : "#FFB3BE", flexShrink: 0 }}>{r.name.slice(0, 1)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: r.me ? "#FF8FA0" : C.text }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: C.dim2, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Flame size={12} color="#FF6B35" /> {r.streak} días de racha
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 20, color: C.text }}>{r.pts.toLocaleString("es-MX")}</div>
                    <div style={{ fontSize: 10, color: C.dim2 }}>puntos</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
