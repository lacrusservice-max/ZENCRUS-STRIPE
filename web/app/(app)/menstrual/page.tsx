"use client";

import { useEffect, useState } from "react";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875" };

type Phase = "menstrual" | "folicular" | "ovulacion" | "lutea";
const PHASES: Record<Phase, { label: string; emoji: string; range: string; nutrition: string; training: string }> = {
  menstrual: { label: "Menstrual", emoji: "🩸", range: "Días 1–5", nutrition: "Aumenta hierro (carnes rojas, lentejas), magnesio y omega-3. Hidrátate bien.", training: "Intensidad baja-moderada. Escucha a tu cuerpo, prioriza movilidad." },
  folicular: { label: "Folicular", emoji: "🌱", range: "Días 6–13", nutrition: "Alta sensibilidad a la insulina → aprovecha carbohidratos complejos. Buen momento para superávit.", training: "Alto volumen y fuerza. Tu cuerpo tolera más carga." },
  ovulacion: { label: "Ovulación", emoji: "⚡", range: "Días 14–16", nutrition: "Mantén proteína alta y antioxidantes. Pico de energía.", training: "Pico de rendimiento → intenta PRs y alta intensidad." },
  lutea: { label: "Lútea", emoji: "🌙", range: "Días 17–28", nutrition: "Tu TMR sube hasta +300 kcal/día. Más grasas saludables y magnesio para antojos.", training: "Intensidad moderada. Prioriza recuperación y sueño." },
};
const KEY = "zencrus-menstrual";

function phaseForDay(day: number, cycleLen: number): Phase {
  if (day <= 5) return "menstrual";
  if (day <= Math.floor(cycleLen / 2) - 1) return "folicular";
  if (day <= Math.floor(cycleLen / 2) + 1) return "ovulacion";
  return "lutea";
}

export default function MenstrualPage() {
  const [lastPeriod, setLastPeriod] = useState<string>("");
  const [cycleLen, setCycleLen] = useState(28);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); setLastPeriod(d.lastPeriod || ""); setCycleLen(d.cycleLen || 28); } } catch { /* ignore */ }
  }, []);
  const persist = (lp: string, cl: number) => { try { localStorage.setItem(KEY, JSON.stringify({ lastPeriod: lp, cycleLen: cl })); } catch { /* ignore */ } };

  let currentDay = 0; let phase: Phase | null = null; let nextPeriodIn = 0;
  if (lastPeriod) {
    const diff = Math.floor((Date.now() - new Date(lastPeriod + "T12:00").getTime()) / 86400000);
    currentDay = (diff % cycleLen) + 1;
    phase = phaseForDay(currentDay, cycleLen);
    nextPeriodIn = cycleLen - ((diff % cycleLen));
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "36px 24px 100px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b8cce", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Fisiología por sexo</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Ciclo menstrual</h1>
          <p style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>La IA ajusta tus calorías, macros y entrenamiento según tu fase.</p>
        </div>

        {/* Config */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>Inicio de tu último periodo</div>
            <input type="date" value={lastPeriod} onChange={(e) => { setLastPeriod(e.target.value); persist(e.target.value, cycleLen); }} style={{ width: "100%", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 12px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", colorScheme: "dark" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>Duración (días)</div>
            <input type="number" value={cycleLen} onChange={(e) => { const v = Number(e.target.value) || 28; setCycleLen(v); persist(lastPeriod, v); }} style={{ width: "100%", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 12px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          </div>
        </div>

        {phase ? (
          <>
            {/* Current phase */}
            <div style={{ background: `linear-gradient(160deg, ${C.navySoft}, ${C.panel})`, border: `1px solid ${C.navy}`, borderRadius: 18, padding: 24, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <span style={{ fontSize: 40 }}>{PHASES[phase].emoji}</span>
                <div>
                  <div style={{ fontSize: 12, color: "#8fa9dd", fontWeight: 700 }}>Fase actual · Día {currentDay} del ciclo</div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>{PHASES[phase].label}</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>{nextPeriodIn}</div>
                  <div style={{ fontSize: 10, color: C.dim2 }}>días al próximo</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: C.bg, borderRadius: 12, padding: 14, borderLeft: `2px solid ${C.navy}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#8fa9dd", marginBottom: 5, letterSpacing: 1 }}>🍽️ NUTRICIÓN</div>
                  <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{PHASES[phase].nutrition}</div>
                </div>
                <div style={{ background: C.bg, borderRadius: 12, padding: 14, borderLeft: `2px solid ${C.navy}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#8fa9dd", marginBottom: 5, letterSpacing: 1 }}>🏋️ ENTRENAMIENTO</div>
                  <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{PHASES[phase].training}</div>
                </div>
              </div>
            </div>

            {/* All phases timeline */}
            <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 12, letterSpacing: 1 }}>LAS 4 FASES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(Object.keys(PHASES) as Phase[]).map((p) => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 14, background: C.panel, border: `1px solid ${p === phase ? C.navy : C.border}`, borderRadius: 12, padding: 14 }}>
                  <span style={{ fontSize: 24 }}>{PHASES[p].emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: p === phase ? "#8fa9dd" : C.text }}>{PHASES[p].label}</div>
                    <div style={{ fontSize: 11.5, color: C.dim2 }}>{PHASES[p].range}</div>
                  </div>
                  {p === phase && <span style={{ fontSize: 10, fontWeight: 800, color: "#8fa9dd", background: C.navySoft, padding: "4px 9px", borderRadius: 999 }}>AHORA</span>}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: 60, color: C.dim2 }}>Ingresa el inicio de tu último periodo para ver tu fase actual y recomendaciones.</div>
        )}
      </div>
    </div>
  );
}
