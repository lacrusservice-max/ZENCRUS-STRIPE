"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { nutrition as nutritionApi } from "@/lib/api";
import toast from "react-hot-toast";
import { Flame, Droplets, Zap, TrendingUp, Dumbbell, Plus, Minus, Sun, CheckCircle } from "lucide-react";

// ── Health Score Ring ────────────────────────────────────────────────────────

function HealthScoreRing({ score }: { score: number }) {
  const R = 54;
  const STROKE = 8;
  const circ = 2 * Math.PI * R;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#30D158" : score >= 55 ? "#60a5fa" : "#FF6B35";
  const label = score >= 80 ? "Excelente" : score >= 55 ? "Muy bien" : score >= 30 ? "Regular" : "Empezando";

  return (
    <div style={{ position: "relative", width: 136, height: 136, flexShrink: 0 }}>
      <svg width={136} height={136} viewBox="0 0 136 136">
        <circle cx={68} cy={68} r={R} stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} fill="none" />
        <circle
          cx={68} cy={68} r={R}
          stroke={color} strokeWidth={STROKE} fill="none"
          strokeDasharray={`${circ - offset} ${offset}`}
          strokeLinecap="round"
          transform="rotate(-90 68 68)"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color }}>{score}</span>
        <span style={{ fontSize: 9, fontWeight: 800, color, marginTop: 2 }}>{label}</span>
        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, marginTop: 2 }}>SCORE</span>
      </div>
    </div>
  );
}

// ── Score Pill ────────────────────────────────────────────────────────────────

function ScorePill({ label, val, max, color }: { label: string; val: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(val / max, 1) : 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <span style={{ fontSize: 17, fontWeight: 900, color }}>{val}</span>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>/{max}</span>
      <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: 3, background: color, borderRadius: 2, width: `${pct * 100}%`, transition: "width 0.8s ease" }} />
      </div>
      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</span>
    </div>
  );
}

// ── Macro Circle ──────────────────────────────────────────────────────────────

function MacroCircle({ value, max, color, label, unit }: { value: number; max: number; color: string; label: string; unit: string }) {
  const pct = Math.min(value / Math.max(max, 1), 1);
  const R = 28;
  const circ = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={70} height={70} viewBox="0 0 70 70">
        <circle cx={35} cy={35} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
        <circle cx={35} cy={35} r={R} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
          strokeLinecap="round" transform="rotate(-90 35 35)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        <text x={35} y={35} textAnchor="middle" dominantBaseline="middle" fill="#f4f4f5" fontSize={12} fontWeight={800}>
          {Math.round(value)}
        </text>
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{label}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{unit} de {max}</div>
      </div>
    </div>
  );
}

// ── Daily Tip ────────────────────────────────────────────────────────────────

const TIPS = [
  { tip: "Come despacio. Tu cerebro tarda 20 min en recibir la señal de saciedad.", tag: "Neurociencia" },
  { tip: "El 75% de la sensación de hambre a media mañana es en realidad sed.", tag: "Hidratación" },
  { tip: "Consistencia supera perfección. Una semana al 80% supera una semana perfecta seguida de abandono.", tag: "Disciplina" },
  { tip: "Dormir mal aumenta la hormona del hambre (grelina) hasta un 24%.", tag: "Recuperación" },
  { tip: "El estrés crónico eleva el cortisol, favoreciendo el almacenamiento de grasa abdominal.", tag: "Bienestar" },
  { tip: "Las proteínas son los bloques de construcción de cada célula de tu cuerpo.", tag: "Proteína" },
  { tip: "Los ultraprocesados fueron diseñados para que no pares de comer. Tú controlas lo que entra.", tag: "Consciencia" },
];

// ── Quick Access ──────────────────────────────────────────────────────────────

const QUICK_SECTIONS = [
  {
    category: "Nutrición",
    items: [
      { label: "Recetas", emoji: "🍳", href: "/nutrition" },
      { label: "Planificador", emoji: "📅", href: "/nutrition" },
      { label: "Compras", emoji: "🛒", href: "/nutrition" },
      { label: "Foto IA", emoji: "📷", href: "/nutrition" },
    ],
  },
  {
    category: "Fitness",
    items: [
      { label: "Medidas", emoji: "📏", href: "/progress" },
      { label: "Macro Cycling", emoji: "🔄", href: "/nutrition" },
      { label: "Progreso", emoji: "📈", href: "/progress" },
      { label: "Salud", emoji: "❤️", href: "/progress" },
    ],
  },
  {
    category: "Comunidad",
    items: [
      { label: "Ranking", emoji: "🏆", href: "/social" },
      { label: "Duelos", emoji: "⚡", href: "/social" },
      { label: "Coach IA", emoji: "🤖", href: "/chat" },
      { label: "Logros", emoji: "🎖️", href: "/progress" },
    ],
  },
];

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [waterGlasses, setWaterGlasses] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [totalCarbs, setTotalCarbs] = useState(0);
  const [totalFat, setTotalFat] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [checkInDone, setCheckInDone] = useState(false);

  const goals = (user as any)?.goals ?? {};
  const caloriesTarget = goals.calories_target ?? 2000;
  const proteinTarget  = goals.protein_g ?? 150;
  const carbsTarget    = goals.carbs_g ?? 200;
  const fatTarget      = goals.fat_g ?? 65;

  const firstName = user?.fullName?.split(" ")[0] ?? "Atleta";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const dateStr = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  const liveScore = Math.round(
    Math.min(totalCalories / Math.max(caloriesTarget, 1), 1) * 25 +
    Math.min(waterGlasses / 8, 1) * 20 +
    (checkInDone ? 15 : 0) +
    currentStreak > 0 ? 10 : 0
  );

  useEffect(() => {
    nutritionApi.getDashboard().then(res => {
      const d = res.data?.data ?? {};
      setTotalCalories(d.calories?.consumed ?? 0);
      setTotalProtein(d.protein?.consumed ?? 0);
      setTotalCarbs(d.carbs?.consumed ?? 0);
      setTotalFat(d.fat?.consumed ?? 0);
      setWaterGlasses(d.water?.consumed ?? 0);
    }).catch(() => {});
  }, []);

  const tipIdx = new Date().getDate() % TIPS.length;
  const { tip, tag } = TIPS[tipIdx];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.6s ease" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 24, paddingBottom: 20 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#2563EB", letterSpacing: 3.5, marginBottom: 4 }}>ZENCRUS</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f4f4f5" }}>{greeting}, {firstName}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3, textTransform: "capitalize" }}>{dateStr}</div>
        </div>
        <button
          onClick={() => { setCheckInDone(true); toast.success("Check-in completado!"); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 12, padding: "8px 12px",
            border: checkInDone ? "1px solid rgba(48,209,88,0.4)" : "1px solid rgba(37,99,235,0.4)",
            cursor: "pointer", marginTop: 4,
            color: checkInDone ? "#30D158" : "#60a5fa",
            fontSize: 11, fontWeight: 800,
          }}
        >
          {checkInDone ? <CheckCircle size={14} /> : <Sun size={14} />}
          Check-in
        </button>
      </div>

      {/* Prompt row */}
      {!checkInDone && (
        <div
          onClick={() => { setCheckInDone(true); toast.success("Check-in activado!"); }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 12, padding: "10px 14px", marginBottom: 20,
            border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer",
          }}
        >
          <Sun size={14} color="#60a5fa" />
          <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Haz tu check-in matutino para activar tu día</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.2)" }}>›</span>
        </div>
      )}

      {/* ZENCRUS Health Score */}
      <div style={{ marginBottom: 20 }}>
        <div className="glass-card" style={{ padding: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px 12px" }}>
            <HealthScoreRing score={liveScore} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, fontWeight: 900, color: "#60a5fa", letterSpacing: 2, marginBottom: 6 }}>ZENCRUS HEALTH SCORE</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f4f4f5", lineHeight: 1.5, marginBottom: 10 }}>
                {currentStreak > 0 ? `¡${currentStreak} días de racha! Sigue así.` : "Comienza tu racha hoy"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Flame size={12} color="#FF6B35" />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{currentStreak} días de racha</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Droplets size={12} color="#38BDF8" />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{waterGlasses}/8 vasos de agua</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {checkInDone ? <CheckCircle size={12} color="#30D158" /> : <Sun size={12} color="rgba(255,255,255,0.3)" />}
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{checkInDone ? "Check-in hecho" : "Check-in pendiente"}</span>
                </div>
              </div>
            </div>
          </div>
          {/* Score grid */}
          <div style={{
            display: "flex", borderTop: "1px solid rgba(255,255,255,0.09)",
            padding: "12px 20px", gap: 4,
          }}>
            <ScorePill label="Nutrición" val={Math.round(Math.min(totalCalories / Math.max(caloriesTarget, 1), 1) * 25)} max={25} color="#60a5fa" />
            <ScorePill label="Entreno" val={0} max={25} color="#00C2C0" />
            <ScorePill label="Hidratación" val={Math.round(Math.min(waterGlasses / 8, 1) * 20)} max={20} color="#38BDF8" />
            <ScorePill label="Sueño" val={0} max={15} color="#FF6B35" />
            <ScorePill label="Bienestar" val={checkInDone ? 10 : 0} max={15} color="#30D158" />
          </div>
        </div>
      </div>

      {/* Alimentación */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span className="section-label">Alimentación</span>
          <button onClick={() => router.push("/nutrition")} style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>
            Ver diario
          </button>
        </div>
        <div className="glass-card" style={{ padding: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px 20px 12px" }}>
            <div>
              <div style={{ fontSize: 38, fontWeight: 900, color: "#f4f4f5", lineHeight: 1.1 }}>{totalCalories.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>/ {caloriesTarget.toLocaleString()} kcal</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 4 }}>
              {[
                { l: "P", v: totalProtein, c: "#60a5fa" },
                { l: "C", v: totalCarbs,   c: "#00C2C0" },
                { l: "G", v: totalFat,     c: "#FF6B35" },
              ].map(m => (
                <div key={m.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: m.c }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>{m.l} {Math.round(m.v)}g</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "0 20px 12px" }}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(totalCalories / Math.max(caloriesTarget, 1), 1) * 100}%`, background: "#2563EB" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid rgba(255,255,255,0.09)", padding: "12px 20px" }}>
            {["🌅", "☀️", "🌙", "🍎"].map((e, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 18 }}>{e}</span>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: i === 0 ? "#30D158" : "rgba(255,255,255,0.12)" }} />
              </div>
            ))}
            <button
              onClick={() => router.push("/nutrition")}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, background: "#2563EB", borderRadius: 10, padding: "6px 12px", border: "none", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 800 }}
            >
              <Plus size={13} /> Agregar
            </button>
          </div>
        </div>
      </div>

      {/* Macros circles */}
      <div style={{ marginBottom: 20 }}>
        <div className="section-label">Macros del día</div>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <MacroCircle value={totalProtein} max={proteinTarget} color="#60a5fa" label="Proteína" unit="g" />
            <MacroCircle value={totalCarbs} max={carbsTarget} color="#00C2C0" label="Carbos" unit="g" />
            <MacroCircle value={totalFat} max={fatTarget} color="#FF6B35" label="Grasa" unit="g" />
          </div>
        </div>
      </div>

      {/* Activity row */}
      <div style={{ marginBottom: 20 }}>
        <div className="section-label">Actividad de hoy</div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>

          {/* Water card */}
          <div className="glass-card" style={{ minWidth: 148, padding: 14, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>💧</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: "#f4f4f5" }}>{waterGlasses}<span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>/8</span></span>
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Hidratación</div>
            <div className="progress-bar" style={{ marginBottom: 10 }}>
              <div className="progress-fill" style={{ width: `${Math.min(waterGlasses / 8, 1) * 100}%`, background: "#38BDF8" }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setWaterGlasses(Math.max(0, waterGlasses - 1))} style={{ flex: 1, height: 28, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Minus size={13} />
              </button>
              <button onClick={() => { if (waterGlasses < 8) setWaterGlasses(waterGlasses + 1); else toast.success("¡Meta de agua alcanzada!"); }} style={{ flex: 1, height: 28, background: "rgba(37,99,235,0.3)", border: "1px solid rgba(37,99,235,0.4)", borderRadius: 8, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Workout card */}
          <div className="glass-card" onClick={() => router.push("/workout")} style={{ minWidth: 148, padding: 14, flexShrink: 0, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Dumbbell size={20} color="#00C2C0" />
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Entrenamiento</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Pendiente</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa" }}>Comenzar</span>
              <span style={{ fontSize: 11, color: "#60a5fa" }}>›</span>
            </div>
          </div>

          {/* Streak card */}
          <div className="glass-card" style={{ minWidth: 148, padding: 14, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <Flame size={20} color="#FF6B35" />
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Racha</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#FF6B35" }}>{currentStreak}<span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}> días</span></div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Consistencia es poder</div>
          </div>

          {/* Score card */}
          <div className="glass-card" style={{ minWidth: 148, padding: 14, flexShrink: 0 }}>
            <div style={{ marginBottom: 6 }}>
              <TrendingUp size={20} color="#30D158" />
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Score hoy</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#30D158" }}>{liveScore}<span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>/100</span></div>
          </div>
        </div>
      </div>

      {/* Racha semanal */}
      <div style={{ marginBottom: 20 }}>
        <div className="section-label">Racha semanal</div>
        <div className="glass-card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "center", minWidth: 64 }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#FF6B35", lineHeight: 1.1 }}>{currentStreak}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>días de racha</div>
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
              {["L", "M", "X", "J", "V", "S", "D"].map((day, i) => {
                const dayOfWeek = new Date().getDay();
                const todayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const active = i < todayIdx || (i === todayIdx && checkInDone);
                const isToday = i === todayIdx;
                return (
                  <div key={day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: active ? "#30D158" : "rgba(255,255,255,0.07)",
                      border: isToday ? "1.5px solid #2563EB" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {active && <span style={{ fontSize: 12, color: "#fff" }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 9, color: isToday ? "#60a5fa" : "rgba(255,255,255,0.3)", fontWeight: 700 }}>{day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div style={{ marginBottom: 20 }}>
        {QUICK_SECTIONS.map(section => (
          <div key={section.category} style={{ marginBottom: 20 }}>
            <div className="section-label">{section.category}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {section.items.map(item => (
                <button
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 16, padding: "14px 6px",
                    cursor: "pointer", position: "relative", overflow: "hidden",
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(37,99,235,0.14)", border: "1px solid rgba(37,99,235,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                    {item.emoji}
                  </div>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 700, textAlign: "center", letterSpacing: 0.2 }}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Daily Tip */}
      <div style={{ marginBottom: 20 }}>
        <div className="section-label">Conocimiento</div>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Zap size={13} color="#60a5fa" />
            <span style={{ fontSize: 10, fontWeight: 800, color: "#60a5fa", letterSpacing: 0.8, textTransform: "uppercase" }}>{tag}</span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>{tip}</p>
        </div>
      </div>

    </div>
  );
}
