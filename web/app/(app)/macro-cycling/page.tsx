"use client";

import { useEffect, useState } from "react";
import { Flame, Zap, Leaf, BedDouble } from "lucide-react";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875" };

type DayType = "high" | "moderate" | "low" | "rest";
const CONFIG: Record<DayType, { carb: number; protein: number; fat: number; cal: number }> = {
  high: { carb: 1.4, protein: 1.1, fat: 0.8, cal: 200 },
  moderate: { carb: 1.0, protein: 1.0, fat: 1.0, cal: 0 },
  low: { carb: 0.5, protein: 1.2, fat: 1.3, cal: -200 },
  rest: { carb: 0.4, protein: 1.0, fat: 1.4, cal: -300 },
};
const META: Record<DayType, { icon: typeof Flame; color: string; label: string; desc: string }> = {
  high: { icon: Flame, color: "#FF6B35", label: "Alto en carbs", desc: "Entreno intenso · más energía" },
  moderate: { icon: Zap, color: "#FF5871", label: "Moderado", desc: "Balance · intensidad media" },
  low: { icon: Leaf, color: "#FFFFFF", label: "Bajo en carbs", desc: "Recuperación · oxidar grasa" },
  rest: { icon: BedDouble, color: "#c084fc", label: "Descanso", desc: "Sin entreno · déficit mayor" },
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
    <div style={{ minHeight: "100vh", color: C.text, padding: "0 20px 120px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ paddingTop: 32, paddingBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#FF6B35", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · NUTRICIÓN AVANZADA</div>
          <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, letterSpacing: -0.5 }}>Ciclo de macros</div>
          <p style={{ fontSize: 13, color: C.dim, marginTop: 8 }}>Periodiza tus carbohidratos según tu calendario de entrenamiento.</p>
        </div>

        {/* Week strip */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
          {DAYS.map((d) => {
            const t = week[d.k]; const sel = selDay === d.k;
            const Icon = META[t].icon;
            return (
              <button key={d.k} onClick={() => setSelDay(d.k)} className="glass-card" style={{ flexShrink: 0, minWidth: 68, padding: "14px 8px", cursor: "pointer", fontFamily: "inherit", textAlign: "center", borderColor: sel ? "rgba(255,31,61,0.4)" : undefined, background: sel ? "rgba(255,31,61,0.08)" : undefined }}>
                <Icon size={19} color={META[t].color} style={{ margin: "0 auto" }} />
                <div style={{ fontSize: 12, fontWeight: 800, marginTop: 6, color: sel ? "#FF8FA0" : C.text }}>{d.l}</div>
              </button>
            );
          })}
        </div>

        {/* Day type selector */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 12, letterSpacing: 1 }}>TIPO DE DÍA</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
          {(Object.keys(META) as DayType[]).map((t) => {
            const active = week[selDay] === t;
            const Icon = META[t].icon;
            return (
              <button key={t} onClick={() => setDayType(t)} className="glass-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderColor: active ? "rgba(255,31,61,0.4)" : undefined, background: active ? "rgba(255,31,61,0.08)" : undefined }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: `${META[t].color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={20} color={META[t].color} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: active ? "#FF8FA0" : C.text }}>{META[t].label}</div>
                  <div style={{ fontSize: 11, color: C.dim2, marginTop: 2 }}>{META[t].desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Adjusted macros */}
        <div className="glass-card-accent" style={{ marginBottom: 24 }}>
          <div style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>Macros para <b style={{ color: C.text }}>{META[week[selDay]].label}</b></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {[["Calorías", adj.cal, ""], ["Proteína", adj.protein, "g"], ["Carbos", adj.carb, "g"], ["Grasa", adj.fat, "g"]].map(([l, v, u]) => (
                <div key={l as string} style={{ textAlign: "center", background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 8px" }}>
                  <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 24 }}>{v}{u}</div>
                  <div style={{ fontSize: 10.5, color: C.dim2, marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Base config */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 12, letterSpacing: 1 }}>MACROS BASE (día moderado)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {([["cal", "Calorías"], ["protein", "Proteína"], ["carb", "Carbos"], ["fat", "Grasa"]] as [keyof typeof base, string][]).map(([k, l]) => (
            <div key={k}>
              <div style={{ fontSize: 10.5, color: C.dim2, marginBottom: 6 }}>{l}</div>
              <input type="number" value={base[k]} onChange={(e) => setBaseVal(k, Number(e.target.value))} className="glass-input" style={{ padding: "9px 10px", fontSize: 14 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
