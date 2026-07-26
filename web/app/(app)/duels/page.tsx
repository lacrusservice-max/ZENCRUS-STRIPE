"use client";

import { useEffect, useState } from "react";
import { Swords, Plus, X, Trophy, Footprints, Dumbbell, Flame } from "lucide-react";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875", green: "#3fae6b" };

interface Duel { id: string; type: string; opponent: string; myScore: number; theirScore: number; daysLeft: number; goal: string; }
const KEY = "zencrus-duels";
const DUEL_TYPES = [
  { id: "steps", label: "Pasos", icon: Footprints, color: "#3fae6b", goal: "Más pasos en 7 días" },
  { id: "workouts", label: "Entrenos", icon: Dumbbell, color: "#60a5fa", goal: "Más entrenamientos en 7 días" },
  { id: "streak", label: "Racha", icon: Flame, color: "#FF6B35", goal: "Mantener la racha más días" },
  { id: "calories", label: "Déficit", icon: Flame, color: "#f08a4b", goal: "Cumplir objetivo calórico más días" },
];
const OPPONENTS = ["Diego M.", "Sofía R.", "Andrés L.", "Camila T.", "Valeria C."];

export default function DuelsPage() {
  const [duels, setDuels] = useState<Duel[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let d: Duel[] = [];
    try { d = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { /* ignore */ }
    if (!d.length) d = [{ id: "d1", type: "steps", opponent: "Diego M.", myScore: 42300, theirScore: 38900, daysLeft: 3, goal: "Más pasos en 7 días" }];
    setDuels(d);
  }, []);
  const persist = (d: Duel[]) => { setDuels(d); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } };

  const create = (typeId: string) => {
    const t = DUEL_TYPES.find((x) => x.id === typeId)!;
    const duel: Duel = { id: `d_${Date.now()}`, type: typeId, opponent: OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)], myScore: 0, theirScore: 0, daysLeft: 7, goal: t.goal };
    persist([duel, ...duels]); setOpen(false);
  };
  const remove = (id: string) => persist(duels.filter((d) => d.id !== id));

  return (
    <div style={{ minHeight: "100vh", color: C.text, padding: "0 20px 120px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 32, paddingBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#8fa9dd", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · GAMIFICACIÓN</div>
            <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, letterSpacing: -0.5 }}>Duelos</div>
          </div>
          <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={15} /> Nuevo duelo</button>
        </div>

        {duels.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: "80px 20px", color: C.dim2 }}>
            <Swords size={40} color={C.dim2} style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: C.dim }}>Sin duelos activos</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Reta a un miembro de la comunidad a un duelo de 7 días.</div>
          </div>
        ) : (
          <div className="dl-grid">
            {duels.map((d) => {
              const winning = d.myScore >= d.theirScore;
              const total = d.myScore + d.theirScore || 1;
              const t = DUEL_TYPES.find((x) => x.id === d.type);
              const TIcon = t?.icon ?? Swords;
              return (
                <div key={d.id} className="glass-card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t?.color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <TIcon size={17} color={t?.color} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800 }}>{t?.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, color: C.dim2 }}>{d.daysLeft} días restantes</span>
                      <button onClick={() => remove(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim2 }}><X size={15} /></button>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ fontSize: 12, color: "#8fa9dd", fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>Tú {winning && <Trophy size={12} />}</div>
                      <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 24 }}>{d.myScore.toLocaleString("es-MX")}</div>
                    </div>
                    <span style={{ fontSize: 13, color: C.dim2, fontWeight: 800 }}>VS</span>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.dim, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>{d.opponent} {!winning && <Trophy size={12} />}</div>
                      <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 24 }}>{d.theirScore.toLocaleString("es-MX")}</div>
                    </div>
                  </div>
                  <div className="progress-bar" style={{ display: "flex" }}>
                    <div className="progress-fill" style={{ width: `${(d.myScore / total) * 100}%`, background: "linear-gradient(90deg, #2563EB, #00C2C0)" }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.dim2, marginTop: 10, textAlign: "center" }}>{d.goal}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .dl-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 900px) { .dl-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} className="glass-card" style={{ width: "100%", maxWidth: 420, padding: 0 }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Elige el tipo de duelo</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim }}><X size={20} /></button>
            </div>
            <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {DUEL_TYPES.map((t) => (
                <button key={t.id} onClick={() => create(t.id)} className="glass-card" style={{ padding: 18, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${t.color}22`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                    <t.icon size={22} color={t.color} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{t.label}</div>
                  <div style={{ fontSize: 10.5, color: C.dim2, marginTop: 4 }}>{t.goal}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
