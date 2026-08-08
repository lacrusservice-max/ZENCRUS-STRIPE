"use client";

import { useEffect, useState } from "react";
import { Droplet, Sprout, Zap, Moon, Utensils, Dumbbell } from "lucide-react";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875" };

type Phase = "menstrual" | "folicular" | "ovulacion" | "lutea";
const PHASES: Record<Phase, { label: string; icon: typeof Droplet; color: string; range: string; nutrition: string; training: string }> = {
  menstrual: { label: "Menstrual", icon: Droplet, color: "#e0576b", range: "Días 1–5", nutrition: "Aumenta hierro (carnes rojas, lentejas), magnesio y omega-3. Hidrátate bien.", training: "Intensidad baja-moderada. Escucha a tu cuerpo, prioriza movilidad." },
  folicular: { label: "Folicular", icon: Sprout, color: "#FFFFFF", range: "Días 6–13", nutrition: "Alta sensibilidad a la insulina → aprovecha carbohidratos complejos. Buen momento para superávit.", training: "Alto volumen y fuerza. Tu cuerpo tolera más carga." },
  ovulacion: { label: "Ovulación", icon: Zap, color: "#FFD60A", range: "Días 14–16", nutrition: "Mantén proteína alta y antioxidantes. Pico de energía.", training: "Pico de rendimiento → intenta PRs y alta intensidad." },
  lutea: { label: "Lútea", icon: Moon, color: "#c084fc", range: "Días 17–28", nutrition: "Tu TMR sube hasta +300 kcal/día. Más grasas saludables y magnesio para antojos.", training: "Intensidad moderada. Prioriza recuperación y sueño." },
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

  const PhaseIcon = phase ? PHASES[phase].icon : null;

  return (
    <div style={{ minHeight: "100vh", color: C.text, padding: "0 20px 120px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ paddingTop: 32, paddingBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#e0576b", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · FISIOLOGÍA</div>
          <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, letterSpacing: -0.5 }}>Ciclo menstrual</div>
          <p style={{ fontSize: 13, color: C.dim, marginTop: 8 }}>La IA ajusta tus calorías, macros y entrenamiento según tu fase.</p>
        </div>

        {/* Config */}
        <div className="glass-card" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, padding: 20, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, color: C.dim2, marginBottom: 6 }}>Inicio de tu último periodo</div>
            <input type="date" value={lastPeriod} onChange={(e) => { setLastPeriod(e.target.value); persist(e.target.value, cycleLen); }} className="glass-input" style={{ padding: "11px 12px", fontSize: 14, colorScheme: "dark" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.dim2, marginBottom: 6 }}>Duración (días)</div>
            <input type="number" value={cycleLen} onChange={(e) => { const v = Number(e.target.value) || 28; setCycleLen(v); persist(lastPeriod, v); }} className="glass-input" style={{ padding: "11px 12px", fontSize: 14 }} />
          </div>
        </div>

        {phase && PhaseIcon ? (
          <>
            {/* Current phase */}
            <div className="glass-card-accent" style={{ marginBottom: 24 }}>
              <div style={{ padding: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 16, background: `${PHASES[phase].color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <PhaseIcon size={28} color={PHASES[phase].color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#FFB3BE", fontWeight: 700 }}>Fase actual · Día {currentDay} del ciclo</div>
                    <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 26 }}>{PHASES[phase].label}</div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 26 }}>{nextPeriodIn}</div>
                    <div style={{ fontSize: 10, color: C.dim2 }}>días al próximo</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 16, borderLeft: `2px solid ${PHASES[phase].color}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "#FFB3BE", marginBottom: 6, letterSpacing: 1 }}><Utensils size={12} /> NUTRICIÓN</div>
                    <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{PHASES[phase].nutrition}</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 16, borderLeft: `2px solid ${PHASES[phase].color}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "#FFB3BE", marginBottom: 6, letterSpacing: 1 }}><Dumbbell size={12} /> ENTRENAMIENTO</div>
                    <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{PHASES[phase].training}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* All phases timeline */}
            <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 14, letterSpacing: 1 }}>LAS 4 FASES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(Object.keys(PHASES) as Phase[]).map((p) => {
                const Icon = PHASES[p].icon;
                return (
                  <div key={p} className="glass-card" style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, borderColor: p === phase ? "rgba(255,31,61,0.4)" : undefined }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${PHASES[p].color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={20} color={PHASES[p].color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: p === phase ? "#FFB3BE" : C.text }}>{PHASES[p].label}</div>
                      <div style={{ fontSize: 11.5, color: C.dim2 }}>{PHASES[p].range}</div>
                    </div>
                    {p === phase && <span style={{ fontSize: 10, fontWeight: 800, color: "#FFB3BE", background: C.navySoft, padding: "4px 10px", borderRadius: 999 }}>AHORA</span>}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="glass-card" style={{ textAlign: "center", padding: 60, color: C.dim2 }}>Ingresa el inicio de tu último periodo para ver tu fase actual y recomendaciones.</div>
        )}
      </div>
    </div>
  );
}
