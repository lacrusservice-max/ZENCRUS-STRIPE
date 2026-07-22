"use client";

import { useEffect, useState } from "react";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875" };

type DayType = "high" | "moderate" | "low" | "rest";
const CONFIG: Record<DayType, { carb: number; protein: number; fat: number; cal: number }> = {
  high: { carb: 1.4, protein: 1.1, fat: 0.8, cal: 200 },
  moderate: { carb: 1.0, protein: 1.0, fat: 1.0, cal: 0 },
  low: { carb: 0.5, protein: 1.2, fat: 1.3, cal: -200 },
  rest: { carb: 0.4, protein: 1.0, fat: 1.4, cal: -300 },
};
const META: Record<DayType, { emoji: string; label: string; desc: string }> = {
  high: { emoji: "🔥", label: "Alto en carbs", desc: "Entreno intenso · más energía" },
  moderate: { emoji: "⚡", label: "Moderado", desc: "Balance · intensidad media" },
  low: { emoji: "🌿", label: "Bajo en carbs", desc: "Recuperación · oxidar grasa" },
  rest: { emoji: "🛌", label: "Descanso", desc: "Sin entreno · déficit mayor" },
};
const DAYS: { k: string; l: string }[] = [
  { k: "lun", l: "Lun" }, { k: "mar", l: "Mar" }, { k: "mie", l: "Mié" }, { k: "jue", l: "Jue" }, { k: "vie", l: "Vie" }, { k: "sab", l: "Sáb" }, { k: "dom", l: "Dom" },
];
const KEY = "zencrus-macro-cycling";

export default function MacroCyclingPage() {
  const [base, setBase] = useState({ cal: 2200, protein: 165, carb: 220, fat: 65 });
  const [week, setWeek] = useState<Record<string, DayType>>({ lun: "high", mar: "moderate", mie: "high", jue: "low", vie: "high", sab: "moderate", dom: "rest" });
  const [selDay, setSelDay] = useState("lun");

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); if (d.week) setWeek(d.week); if (d.base) setBase(d.base); } } catch { /* ignore */ }
  }, []);
  const persist = (w: Record<string, DayType>, b: typeof base) => { try { localStorage.setItem(KEY, JSON.stringify({ week: w, base: b })); } catch { /* ignore */ } };

  const setDayType = (t: DayType) => { const w = { ...week, [selDay]: t }; setWeek(w); persist(w, base); };
  const setBaseVal = (k: keyof typeof base, v: number) => { const b = { ...base, [k]: v }; setBase(b); persist(week, b); };

  const cfg = CONFIG[week[selDay]];
  const adj = {
    cal: Math.round(base.cal + cfg.cal),
    protein: Math.round(base.protein * cfg.protein),
    carb: Math.round(base.carb * cfg.carb),
    fat: Math.round(base.fat * cfg.fat),
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "36px 24px 100px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b8cce", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Nutrición avanzada</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Ciclo de macros</h1>
          <p style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>Periodiza tus carbohidratos según tu calendario de entrenamiento.</p>
        </div>

        {/* Week strip */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
          {DAYS.map((d) => {
            const t = week[d.k]; const sel = selDay === d.k;
            return (
              <button key={d.k} onClick={() => setSelDay(d.k)} style={{ flexShrink: 0, minWidth: 66, padding: "12px 8px", borderRadius: 14, border: `1px solid ${sel ? C.navy : C.border}`, background: sel ? C.navySoft : C.panel, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                <div style={{ fontSize: 20 }}>{META[t].emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4, color: sel ? "#8fa9dd" : C.text }}>{d.l}</div>
              </button>
            );
          })}
        </div>

        {/* Day type selector */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 10, letterSpacing: 1 }}>TIPO DE DÍA</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
          {(Object.keys(META) as DayType[]).map((t) => {
            const active = week[selDay] === t;
            return (
              <button key={t} onClick={() => setDayType(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, border: `1px solid ${active ? C.navy : C.border}`, background: active ? C.navySoft : C.panel, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ fontSize: 24 }}>{META[t].emoji}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: active ? "#8fa9dd" : C.text }}>{META[t].label}</div>
                  <div style={{ fontSize: 11, color: C.dim2, marginTop: 2 }}>{META[t].desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Adjusted macros */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 14 }}>Macros para <b style={{ color: C.text }}>{META[week[selDay]].label}</b></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[["Calorías", adj.cal, ""], ["Proteína", adj.protein, "g"], ["Carbos", adj.carb, "g"], ["Grasa", adj.fat, "g"]].map(([l, v, u]) => (
              <div key={l as string} style={{ textAlign: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 8px" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{v}{u}</div>
                <div style={{ fontSize: 10.5, color: C.dim2, marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Base config */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 10, letterSpacing: 1 }}>MACROS BASE (día moderado)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {([["cal", "Calorías"], ["protein", "Proteína"], ["carb", "Carbos"], ["fat", "Grasa"]] as [keyof typeof base, string][]).map(([k, l]) => (
            <div key={k}>
              <div style={{ fontSize: 10.5, color: C.dim2, marginBottom: 5 }}>{l}</div>
              <input type="number" value={base[k]} onChange={(e) => setBaseVal(k, Number(e.target.value))} style={{ width: "100%", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 10px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
