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
    <div style={{ minHeight: "100vh", color: C.text, padding: "0 20px 120px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ paddingTop: 32, paddingBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#38BDF8", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · PROGRESO</div>
          <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, letterSpacing: -0.5 }}>Salud diaria</div>
        </div>

        {/* Today snapshot */}
        {t && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 32 }}>
            {[
              { icon: <Footprints size={18} color="#FF5871" />, glow: "rgba(255,31,61,0.15)", label: "Pasos", value: t.steps.toLocaleString("es-MX") },
              { icon: <Flame size={18} color="#FF6B35" />, glow: "rgba(255,107,53,0.15)", label: "Kcal activas", value: stepsToKcal(t.steps) },
              { icon: <MapPin size={18} color="#FFFFFF" />, glow: "rgba(63,174,107,0.15)", label: "Distancia", value: `${stepsToKm(t.steps)} km` },
              { icon: <Moon size={18} color="#c084fc" />, glow: "rgba(192,132,252,0.15)", label: "Sueño", value: `${t.sleepHours.toFixed(1)} h` },
              { icon: <Heart size={18} color="#e0576b" />, glow: "rgba(224,87,107,0.15)", label: "FC reposo", value: `${t.restingHR} bpm` },
            ].map((s) => (
              <div key={s.label} className="glass-card" style={{ padding: 18 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: s.glow, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontSize: 11, color: C.dim2, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 24 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Steps week chart */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 14, letterSpacing: 1 }}>PASOS · ÚLTIMOS 7 DÍAS</div>
        <div className="glass-card" style={{ padding: 22, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
            {[...days].slice(0, 7).reverse().map((d) => (
              <div key={d.date} title={`${d.steps} pasos`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                <div style={{ width: "70%", height: `${(d.steps / maxSteps) * 100}%`, minHeight: 4, background: "linear-gradient(180deg, #FF5871, #FF1F3D)", borderRadius: "4px 4px 0 0" }} />
                <span style={{ fontSize: 9.5, color: C.dim2, marginTop: 8 }}>{new Date(d.date + "T12:00").toLocaleDateString("es-MX", { weekday: "short" }).slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Log today */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 14, letterSpacing: 1 }}>REGISTRAR HOY</div>
        <div className="glass-card" style={{ padding: 24, maxWidth: 620 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <Field label="Pasos" value={form.steps} onChange={(v) => setForm((f) => ({ ...f, steps: v }))} />
            <Field label="Horas de sueño" value={form.sleepHours} onChange={(v) => setForm((f) => ({ ...f, sleepHours: v }))} />
            <Field label="FC en reposo (bpm)" value={form.restingHR} onChange={(v) => setForm((f) => ({ ...f, restingHR: v }))} />
            <div>
              <div style={{ fontSize: 11, color: C.dim2, marginBottom: 6 }}>Calidad de sueño</div>
              <select value={form.sleepQuality} onChange={(e) => setForm((f) => ({ ...f, sleepQuality: e.target.value as Day["sleepQuality"] }))} className="glass-input" style={{ padding: "9px 11px", fontSize: 14 }}>
                {(Object.keys(QUALITY) as Day["sleepQuality"][]).map((q) => <option key={q} value={q}>{QUALITY[q]}</option>)}
              </select>
            </div>
          </div>
          <button onClick={saveToday} className="btn-primary" style={{ width: "100%" }}>Guardar registro de hoy</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.dim2, marginBottom: 6 }}>{label}</div>
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="glass-input" style={{ padding: "9px 11px", fontSize: 14 }} />
    </div>
  );
}
