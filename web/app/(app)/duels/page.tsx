"use client";

import { useEffect, useState } from "react";
import { Swords, Plus, X, Trophy } from "lucide-react";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875", green: "#3fae6b" };

interface Duel { id: string; type: string; opponent: string; myScore: number; theirScore: number; daysLeft: number; goal: string; }
const KEY = "zencrus-duels";
const DUEL_TYPES = [
  { id: "steps", label: "Pasos", emoji: "👟", goal: "Más pasos en 7 días" },
  { id: "workouts", label: "Entrenos", emoji: "🏋️", goal: "Más entrenamientos en 7 días" },
  { id: "streak", label: "Racha", emoji: "🔥", goal: "Mantener la racha más días" },
  { id: "calories", label: "Déficit", emoji: "🔥", goal: "Cumplir objetivo calórico más días" },
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
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "36px 24px 100px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#6b8cce", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Gamificación</div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Duelos</h1>
          </div>
          <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: C.navy, border: "none", borderRadius: 11, padding: "10px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={15} /> Nuevo duelo</button>
        </div>

        {duels.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: C.dim2 }}>
            <Swords size={40} color={C.dim2} style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: C.dim }}>Sin duelos activos</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Reta a un miembro de la comunidad a un duelo de 7 días.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {duels.map((d) => {
              const winning = d.myScore >= d.theirScore;
              const total = d.myScore + d.theirScore || 1;
              const t = DUEL_TYPES.find((x) => x.id === d.type);
              return (
                <div key={d.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 20 }}>{t?.emoji}</span><span style={{ fontSize: 14, fontWeight: 800 }}>{t?.label}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, color: C.dim2 }}>{d.daysLeft} días restantes</span>
                      <button onClick={() => remove(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim2 }}><X size={15} /></button>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ fontSize: 12, color: "#8fa9dd", fontWeight: 700, marginBottom: 4 }}>Tú {winning && <Trophy size={12} style={{ display: "inline" }} />}</div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{d.myScore.toLocaleString("es-MX")}</div>
                    </div>
                    <span style={{ fontSize: 13, color: C.dim2, fontWeight: 800 }}>VS</span>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.dim, fontWeight: 700, marginBottom: 4 }}>{d.opponent} {!winning && <Trophy size={12} style={{ display: "inline" }} />}</div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{d.theirScore.toLocaleString("es-MX")}</div>
                    </div>
                  </div>
                  <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.border}`, display: "flex" }}>
                    <div style={{ width: `${(d.myScore / total) * 100}%`, background: C.navy }} />
                    <div style={{ flex: 1, background: "#2a2f3a" }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.dim2, marginTop: 10, textAlign: "center" }}>{d.goal}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, width: "100%", maxWidth: 420 }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Elige el tipo de duelo</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim }}><X size={20} /></button>
            </div>
            <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {DUEL_TYPES.map((t) => (
                <button key={t.id} onClick={() => create(t.id)} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>{t.emoji}</div>
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
