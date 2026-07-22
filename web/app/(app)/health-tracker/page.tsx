"use client";

import { useEffect, useState } from "react";
import { Footprints, Moon, Heart, Flame, MapPin } from "lucide-react";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875" };

interface Day { date: string; steps: number; sleepHours: number; sleepQuality: "poor" | "fair" | "good" | "excellent"; restingHR: number; }
const KEY = "zencrus-health";
const today = () => new Date().toISOString().slice(0, 10);
const QUALITY: Record<Day["sleepQuality"], string> = { poor: "Malo", fair: "Regular", good: "Bueno", excellent: "Excelente" };

const stepsToKcal = (s: number) => Math.round(s * 0.04);
const stepsToKm = (s: number) => Math.round((s / 1312) * 10) / 10;

export default function HealthTrackerPage() {
  const [days, setDays] = useState<Day[]>([]);
  const [form, setForm] = useState({ steps: "", sleepHours: "", sleepQuality: "good" as Day["sleepQuality"], restingHR: "" });

  useEffect(() => {
    let d: Day[] = [];
    try { d = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { /* ignore */ }
    if (!d.length) {
      d = Array.from({ length: 7 }, (_, i) => {
        const dt = new Date(); dt.setDate(dt.getDate() - i);
        return { date: dt.toISOString().slice(0, 10), steps: 4000 + Math.floor(Math.random() * 5000), sleepHours: 6.5 + Math.random() * 1.8, sleepQuality: (["fair", "good", "excellent"] as const)[Math.floor(Math.random() * 3)], restingHR: 58 + Math.floor(Math.random() * 8) };
      });
    }
    setDays(d.sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  const saveToday = () => {
    const entry: Day = { date: today(), steps: Number(form.steps) || 0, sleepHours: Number(form.sleepHours) || 0, sleepQuality: form.sleepQuality, restingHR: Number(form.restingHR) || 0 };
    const next = [entry, ...days.filter((d) => d.date !== today())].sort((a, b) => b.date.localeCompare(a.date));
    setDays(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setForm({ steps: "", sleepHours: "", sleepQuality: "good", restingHR: "" });
  };

  const t = days[0];
  const maxSteps = Math.max(1, ...days.map((d) => d.steps));

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "36px 24px 100px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b8cce", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Progreso</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Salud diaria</h1>
        </div>

        {/* Today snapshot */}
        {t && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 28 }}>
            {[
              { icon: <Footprints size={18} color="#8fa9dd" />, label: "Pasos", value: t.steps.toLocaleString("es-MX") },
              { icon: <Flame size={18} color="#8fa9dd" />, label: "Kcal activas", value: stepsToKcal(t.steps) },
              { icon: <MapPin size={18} color="#8fa9dd" />, label: "Distancia", value: `${stepsToKm(t.steps)} km` },
              { icon: <Moon size={18} color="#8fa9dd" />, label: "Sueño", value: `${t.sleepHours.toFixed(1)} h` },
              { icon: <Heart size={18} color="#8fa9dd" />, label: "FC reposo", value: `${t.restingHR} bpm` },
            ].map((s) => (
              <div key={s.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>{s.icon}<span style={{ fontSize: 11, color: C.dim2 }}>{s.label}</span></div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Steps week chart */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 12, letterSpacing: 1 }}>PASOS · ÚLTIMOS 7 DÍAS</div>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
            {[...days].slice(0, 7).reverse().map((d) => (
              <div key={d.date} title={`${d.steps} pasos`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                <div style={{ width: "70%", height: `${(d.steps / maxSteps) * 100}%`, minHeight: 4, background: C.navy, borderRadius: "4px 4px 0 0" }} />
                <span style={{ fontSize: 9.5, color: C.dim2, marginTop: 6 }}>{new Date(d.date + "T12:00").toLocaleDateString("es-MX", { weekday: "short" }).slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Log today */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 12, letterSpacing: 1 }}>REGISTRAR HOY</div>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <Field label="Pasos" value={form.steps} onChange={(v) => setForm((f) => ({ ...f, steps: v }))} />
            <Field label="Horas de sueño" value={form.sleepHours} onChange={(v) => setForm((f) => ({ ...f, sleepHours: v }))} />
            <Field label="FC en reposo (bpm)" value={form.restingHR} onChange={(v) => setForm((f) => ({ ...f, restingHR: v }))} />
            <div>
              <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>Calidad de sueño</div>
              <select value={form.sleepQuality} onChange={(e) => setForm((f) => ({ ...f, sleepQuality: e.target.value as Day["sleepQuality"] }))} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                {(Object.keys(QUALITY) as Day["sleepQuality"][]).map((q) => <option key={q} value={q}>{QUALITY[q]}</option>)}
              </select>
            </div>
          </div>
          <button onClick={saveToday} style={{ width: "100%", background: C.navy, border: "none", borderRadius: 11, padding: 13, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Guardar registro de hoy</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>{label}</div>
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
    </div>
  );
}
