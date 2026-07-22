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
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "36px 24px 100px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#6b8cce", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Progreso</div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Medidas corporales</h1>
          </div>
          <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: C.navy, border: "none", borderRadius: 11, padding: "10px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={15} /> Registrar</button>
        </div>

        {/* Latest snapshot */}
        {latest && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 28 }}>
            {FIELDS.filter((f) => latest[f.key] != null).map((f) => {
              const t = trend(f.key);
              return (
                <div key={f.key} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 11, color: C.dim2, marginBottom: 6 }}>{f.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 900 }}>{latest[f.key] as number}</span>
                    <span style={{ fontSize: 11, color: C.dim2 }}>{f.unit}</span>
                  </div>
                  {t != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 4, fontSize: 11, color: t === 0 ? C.dim2 : t < 0 ? C.green : C.red }}>
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
        <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 12, letterSpacing: 1 }}>HISTORIAL</div>
        {list.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: C.dim2 }}>Aún no registras medidas. Toca “Registrar”.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map((m) => (
              <div key={m.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>{new Date(m.date + "T12:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</span>
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
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, width: "100%", maxWidth: 480, maxHeight: "88vh", overflow: "auto" }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.panel, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Nueva medición</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim }}><X size={20} /></button>
            </div>
            <div style={{ padding: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>{f.label} ({f.unit})</div>
                    <input type="number" inputMode="decimal" value={values[f.key] || ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                  </div>
                ))}
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", marginBottom: 16 }} />
              <button onClick={add} style={{ width: "100%", background: C.navy, border: "none", borderRadius: 11, padding: 13, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Guardar medición</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
