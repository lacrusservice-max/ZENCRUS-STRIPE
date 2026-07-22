"use client";

import { useState } from "react";

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
const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("week");
  const rows = DATA[scope];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "36px 24px 100px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b8cce", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Gamificación</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Leaderboard</h1>
        </div>

        <div style={{ display: "inline-flex", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4, gap: 4, marginBottom: 22 }}>
          {([["week", "Semana"], ["month", "Mes"], ["all", "Histórico"]] as [Scope, string][]).map(([s, l]) => (
            <button key={s} onClick={() => setScope(s)} style={{ padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: scope === s ? C.navy : "transparent", color: scope === s ? "#fff" : C.dim }}>{l}</button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => (
            <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 14, background: r.me ? C.navySoft : C.panel, border: `1px solid ${r.me ? C.navy : C.border}`, borderRadius: 14, padding: "14px 18px" }}>
              <span style={{ width: 28, textAlign: "center", fontSize: i < 3 ? 20 : 14, fontWeight: 800, color: i < 3 ? C.gold : C.dim2 }}>{i < 3 ? MEDAL[i] : i + 1}</span>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: r.me ? C.navy : C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: r.me ? "#fff" : "#8fa9dd" }}>{r.name.slice(0, 1)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: r.me ? "#8fa9dd" : C.text }}>{r.name}</div>
                <div style={{ fontSize: 11, color: C.dim2 }}>🔥 {r.streak} días de racha</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{r.pts.toLocaleString("es-MX")}</div>
                <div style={{ fontSize: 10, color: C.dim2 }}>puntos</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
