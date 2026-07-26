"use client";

import { useEffect, useState } from "react";
import { Plus, X, TrendingDown, TrendingUp, Minus, Trash2 } from "lucide-react";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875", green: "#3fae6b", red: "#c85a6a" };

interface Measurement {
  id: string; date: string;
  weight?: number; bodyFatPct?: number; muscleMassPct?: number;
  chest?: number; waist?: number; hips?: number; leftArm?: number; rightArm?: number; leftThigh?: number; rightThigh?: number; neck?: number; shoulders?: number;
  note?: string;
}
const FIELDS: { key: keyof Measurement; label: string; unit: string }[] = [
  { key: "weight", label: "Peso", unit: "kg" }, { key: "bodyFatPct", label: "% Grasa", unit: "%" }, { key: "muscleMassPct", label: "% Músculo", unit: "%" },
  { key: "chest", label: "Pecho", unit: "cm" }, { key: "waist", label: "Cintura", unit: "cm" }, { key: "hips", label: "Cadera", unit: "cm" },
  { key: "leftArm", label: "Brazo izq.", unit: "cm" }, { key: "rightArm", label: "Brazo der.", unit: "cm" },
  { key: "leftThigh", label: "Muslo izq.", unit: "cm" }, { key: "rightThigh", label: "Muslo der.", unit: "cm" },
  { key: "neck", label: "Cuello", unit: "cm" }, { key: "shoulders", label: "Hombros", unit: "cm" },
];
const KEY = "zencrus-measurements";
const load = (): Measurement[] => { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const save = (m: Measurement[]) => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ } };

export default function MeasurementsPage() {
  const [list, setList] = useState<Measurement[]>([]);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  useEffect(() => { setList(load().sort((a, b) => b.date.localeCompare(a.date))); }, []);

  const add = () => {
    const m: Measurement = { id: `m_${Date.now()}`, date: new Date().toISOString().slice(0, 10), note: note || undefined };
    FIELDS.forEach((f) => { const v = parseFloat(values[f.key]); if (!isNaN(v)) (m as unknown as Record<string, unknown>)[f.key] = v; });
    const next = [m, ...list].sort((a, b) => b.date.localeCompare(a.date));
    setList(next); save(next); setOpen(false); setValues({}); setNote("");
  };
  const del = (id: string) => { const next = list.filter((m) => m.id !== id); setList(next); save(next); };

  const latest = list[0];
  const prev = list[1];
  const trend = (key: keyof Measurement) => {
    if (!latest || !prev || latest[key] == null || prev[key] == null) return null;
    return (latest[key] as number) - (prev[key] as number);
  };

  return (
    <div style={{ minHeight: "100vh", color: C.text, padding: "0 20px 120px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 32, paddingBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#8fa9dd", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · PROGRESO</div>
            <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, letterSpacing: -0.5 }}>Medidas corporales</div>
          </div>
          <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={15} /> Registrar</button>
        </div>

        {/* Latest snapshot */}
        {latest && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 32 }}>
            {FIELDS.filter((f) => latest[f.key] != null).map((f) => {
              const t = trend(f.key);
              return (
                <div key={f.key} className="glass-card" style={{ padding: 18 }}>
                  <div style={{ fontSize: 11, color: C.dim2, marginBottom: 8 }}>{f.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 26 }}>{latest[f.key] as number}</span>
                    <span style={{ fontSize: 11, color: C.dim2 }}>{f.unit}</span>
                  </div>
                  {t != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 6, fontSize: 11, color: t === 0 ? C.dim2 : t < 0 ? C.green : C.red }}>
                      {t === 0 ? <Minus size={11} /> : t < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                      {Math.abs(t).toFixed(1)} {f.unit}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* History */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 14, letterSpacing: 1 }}>HISTORIAL</div>
        {list.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: 60, color: C.dim2 }}>Aún no registras medidas. Toca "Registrar".</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list.map((m) => (
              <div key={m.id} className="glass-card" style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: "capitalize" }}>{new Date(m.date + "T12:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</span>
                  <button onClick={() => del(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim2 }}><Trash2 size={14} /></button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
                  {FIELDS.filter((f) => m[f.key] != null).map((f) => (
                    <span key={f.key} style={{ fontSize: 12, color: C.dim }}>{f.label}: <b style={{ color: C.text }}>{m[f.key] as number}{f.unit}</b></span>
                  ))}
                </div>
                {m.note && <div style={{ fontSize: 12, color: C.dim2, marginTop: 8, fontStyle: "italic" }}>{m.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} className="glass-card" style={{ padding: 0, width: "100%", maxWidth: 480, maxHeight: "88vh", overflow: "auto" }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: "rgba(15,18,24,0.95)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Nueva medición</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim }}><X size={20} /></button>
            </div>
            <div style={{ padding: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>{f.label} ({f.unit})</div>
                    <input type="number" inputMode="decimal" value={values[f.key] || ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="glass-input" style={{ padding: "9px 11px", fontSize: 14 }} />
                  </div>
                ))}
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" className="glass-input" style={{ marginBottom: 16 }} />
              <button onClick={add} className="btn-primary" style={{ width: "100%" }}>Guardar medición</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
