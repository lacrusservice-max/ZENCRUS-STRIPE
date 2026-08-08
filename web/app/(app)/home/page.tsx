"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { nutrition as nutritionApi } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Flame, Droplets, Zap, TrendingUp, Dumbbell, Plus, Minus, Sun, CheckCircle,
  BookOpen, CalendarDays, ShoppingCart, Camera, Ruler, Repeat, HeartPulse,
  Trophy, Swords, Bot, Award, Sunrise, Moon, Apple, Check, type LucideIcon,
} from "lucide-react";

// ── Anillos de actividad ZENCRUS (Fase 4.1) ──────────────────────────────────
// Movimiento / Entrenamiento / Constancia — misma identidad visual que en la
// app móvil. En web se alimentan de las métricas ya calculadas en esta misma
// página (calorías, hidratación, constancia diaria) porque el registro de
// entrenamiento hoy solo vive local en el dispositivo móvil, sin sync a
// backend — se etiquetan con datos reales, nunca simulados.
interface RingSpec { label: string; value: number; color: string; display: string }

function ActivityRingsWeb({ rings, size = 152 }: { rings: [RingSpec, RingSpec, RingSpec]; size?: number }) {
  const stroke = size * 0.072;
  const gap = stroke * 0.35;
  const center = size / 2;
  const radii = [center - stroke / 2, center - stroke * 1.5 - gap, center - stroke * 2.5 - gap * 2];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r, i) => (
        <circle key={`track-${i}`} cx={center} cy={center} r={radii[i]} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
      ))}
      {rings.map((r, i) => {
        const circ = 2 * Math.PI * radii[i];
        const offset = circ * (1 - Math.min(Math.max(r.value, 0), 1));
        return (
          <circle
            key={`ring-${i}`}
            cx={center} cy={center} r={radii[i]}
            stroke={r.color} strokeWidth={stroke} fill="none"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        );
      })}
    </svg>
  );
}

function RingsLegendWeb({ rings }: { rings: RingSpec[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rings.map(r => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: 5, background: r.color, display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--font-rajdhani)', fontSize: 22, color: '#fff' }}>{r.display}</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Health Score Ring ────────────────────────────────────────────────────────

function HealthScoreRing({ score }: { score: number }) {
  const R = 60;
  const STROKE = 9;
  const circ = 2 * Math.PI * R;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#30D158" : score >= 55 ? "#FF5871" : "#FF6B35";
  const label = score >= 80 ? "Excelente" : score >= 55 ? "Muy bien" : score >= 30 ? "Regular" : "Empezando";

  return (
    <div style={{ position: "relative", width: 148, height: 148, flexShrink: 0 }}>
      <svg width={148} height={148} viewBox="0 0 148 148">
        <circle cx={74} cy={74} r={R} stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} fill="none" />
        <circle
          cx={74} cy={74} r={R}
          stroke={color} strokeWidth={STROKE} fill="none"
          strokeDasharray={`${circ - offset} ${offset}`}
          strokeLinecap="round"
          transform="rotate(-90 74 74)"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 40, lineHeight: 1, color }}>{score}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color, marginTop: 3 }}>{label}</span>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, marginTop: 2 }}>SCORE</span>
      </div>
    </div>
  );
}

// ── Score Pill ────────────────────────────────────────────────────────────────

function ScorePill({ label, val, max, color }: { label: string; val: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(val / max, 1) : 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 20, fontWeight: 900, color }}>{val}</span>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>/{max}</span>
      <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: 4, background: color, borderRadius: 2, width: `${pct * 100}%`, transition: "width 0.8s ease" }} />
      </div>
      <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</span>
    </div>
  );
}

// ── Macro Circle ──────────────────────────────────────────────────────────────

function MacroCircle({ value, max, color, label, unit }: { value: number; max: number; color: string; label: string; unit: string }) {
  const pct = Math.min(value / Math.max(max, 1), 1);
  const R = 30;
  const circ = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={76} height={76} viewBox="0 0 76 76">
        <circle cx={38} cy={38} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5.5} />
        <circle cx={38} cy={38} r={R} fill="none" stroke={color} strokeWidth={5.5}
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
          strokeLinecap="round" transform="rotate(-90 38 38)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        <text x={38} y={38} textAnchor="middle" dominantBaseline="middle" fill="#f4f4f5" fontSize={14} fontWeight={800}>
          {Math.round(value)}
        </text>
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{label}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{unit} de {max}</div>
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

const QUICK_SECTIONS: { category: string; items: { label: string; icon: LucideIcon; href: string }[] }[] = [
  {
    category: "Nutrición",
    items: [
      { label: "Recetas", icon: BookOpen, href: "/recipes" },
      { label: "Planificador", icon: CalendarDays, href: "/meal-planner" },
      { label: "Compras", icon: ShoppingCart, href: "/grocery" },
      { label: "Foto IA", icon: Camera, href: "/nutrition" },
    ],
  },
  {
    category: "Fitness",
    items: [
      { label: "Medidas", icon: Ruler, href: "/measurements" },
      { label: "Macro Cycling", icon: Repeat, href: "/macro-cycling" },
      { label: "Progreso", icon: TrendingUp, href: "/progress" },
      { label: "Salud", icon: HeartPulse, href: "/health-tracker" },
    ],
  },
  {
    category: "Comunidad",
    items: [
      { label: "Ranking", icon: Trophy, href: "/leaderboard" },
      { label: "Duelos", icon: Swords, href: "/duels" },
      { label: "Coach IA", icon: Bot, href: "/chat" },
      { label: "Logros", icon: Award, href: "/achievements" },
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

  const activityRings: [RingSpec, RingSpec, RingSpec] = [
    { label: 'Nutrición', value: Math.min(totalCalories / Math.max(caloriesTarget, 1), 1), color: '#FF6B35', display: `${Math.round(Math.min(totalCalories / Math.max(caloriesTarget, 1), 1) * 100)}%` },
    { label: 'Hidratación', value: waterGlasses / 8, color: '#38BDF8', display: `${waterGlasses}/8` },
    { label: 'Constancia', value: ((checkInDone ? 1 : 0) + Math.min(waterGlasses / 8, 1) + (currentStreak > 0 ? 1 : 0)) / 3, color: '#FF5871', display: `${Math.round((((checkInDone ? 1 : 0) + Math.min(waterGlasses / 8, 1) + (currentStreak > 0 ? 1 : 0)) / 3) * 100)}%` },
  ];

  return (
    <div className="zc-home" style={{ maxWidth: 1360, margin: "0 auto", padding: "0 24px 120px", animation: "fadeIn 0.6s ease" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 32, paddingBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#FF1F3D", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS</div>
          <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 40, color: "#f4f4f5" }}>{greeting}, {firstName}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4, textTransform: "capitalize" }}>{dateStr}</div>
        </div>
        <button
          onClick={() => { setCheckInDone(true); toast.success("Check-in completado!"); }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 14, padding: "12px 18px",
            border: checkInDone ? "1px solid rgba(48,209,88,0.4)" : "1px solid rgba(255,31,61,0.4)",
            cursor: "pointer", marginTop: 6,
            color: checkInDone ? "#30D158" : "#FF5871",
            fontSize: 13, fontWeight: 800,
          }}
        >
          {checkInDone ? <CheckCircle size={16} /> : <Sun size={16} />}
          Check-in
        </button>
      </div>

      {/* Grid principal: columna izquierda ancha + sidebar derecha en desktop */}
      <div className="zc-grid">

        {/* ── Columna principal ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>

          {/* Anillos de actividad */}
          <div style={{
            position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 32, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 28, padding: 32,
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 15% 0%, rgba(255,31,61,0.22), transparent 60%)',
              pointerEvents: 'none',
            }} />
            <ActivityRingsWeb rings={activityRings} />
            <RingsLegendWeb rings={activityRings} />
          </div>

          {/* Prompt row */}
          {!checkInDone && (
            <div
              onClick={() => { setCheckInDone(true); toast.success("Check-in activado!"); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 14, padding: "14px 18px",
                border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer",
              }}
            >
              <Sun size={16} color="#FF5871" />
              <span style={{ flex: 1, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>Haz tu check-in matutino para activar tu día</span>
              <span style={{ fontSize: 16, color: "rgba(255,255,255,0.25)" }}>›</span>
            </div>
          )}

          {/* ZENCRUS Health Score */}
          <div className="glass-card" style={{ padding: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "24px 28px 16px" }}>
              <HealthScoreRing score={liveScore} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#FF5871", letterSpacing: 2.5, marginBottom: 8 }}>ZENCRUS HEALTH SCORE</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#f4f4f5", lineHeight: 1.5, marginBottom: 14 }}>
                  {currentStreak > 0 ? `¡${currentStreak} días de racha! Sigue así.` : "Comienza tu racha hoy"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Flame size={14} color="#FF6B35" />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{currentStreak} días de racha</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Droplets size={14} color="#38BDF8" />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{waterGlasses}/8 vasos de agua</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {checkInDone ? <CheckCircle size={14} color="#30D158" /> : <Sun size={14} color="rgba(255,255,255,0.3)" />}
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{checkInDone ? "Check-in hecho" : "Check-in pendiente"}</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.09)", padding: "18px 28px", gap: 8 }}>
              <ScorePill label="Nutrición" val={Math.round(Math.min(totalCalories / Math.max(caloriesTarget, 1), 1) * 25)} max={25} color="#FF5871" />
              <ScorePill label="Entreno" val={0} max={25} color="#FFFFFF" />
              <ScorePill label="Hidratación" val={Math.round(Math.min(waterGlasses / 8, 1) * 20)} max={20} color="#38BDF8" />
              <ScorePill label="Sueño" val={0} max={15} color="#FF6B35" />
              <ScorePill label="Bienestar" val={checkInDone ? 10 : 0} max={15} color="#30D158" />
            </div>
          </div>

          {/* Alimentación + Macros lado a lado en desktop */}
          <div className="zc-subgrid">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="section-label">Alimentación</span>
                <button onClick={() => router.push("/nutrition")} style={{ fontSize: 13, fontWeight: 700, color: "#FF5871", background: "none", border: "none", cursor: "pointer" }}>
                  Ver diario
                </button>
              </div>
              <div className="glass-card" style={{ padding: 0, height: "calc(100% - 32px)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "22px 24px 16px" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 44, color: "#f4f4f5", lineHeight: 1.1 }}>{totalCalories.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>/ {caloriesTarget.toLocaleString()} kcal</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 6 }}>
                    {[
                      { l: "Proteína", v: totalProtein, c: "#FF5871" },
                      { l: "Carbos",   v: totalCarbs,   c: "#FFFFFF" },
                      { l: "Grasa",    v: totalFat,     c: "#FF6B35" },
                    ].map(m => (
                      <div key={m.l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.c }} />
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>{m.l} {Math.round(m.v)}g</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: "0 24px 16px" }}>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(totalCalories / Math.max(caloriesTarget, 1), 1) * 100}%`, background: "#FF1F3D" }} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, borderTop: "1px solid rgba(255,255,255,0.09)", padding: "16px 24px" }}>
                  {[Sunrise, Sun, Moon, Apple].map((MealIcon, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                      <MealIcon size={19} color={i === 0 ? "#FF5871" : "rgba(255,255,255,0.4)"} />
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: i === 0 ? "#30D158" : "rgba(255,255,255,0.12)" }} />
                    </div>
                  ))}
                  <button
                    onClick={() => router.push("/nutrition")}
                    style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, background: "#FF1F3D", borderRadius: 12, padding: "9px 16px", border: "none", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 800 }}
                  >
                    <Plus size={14} /> Agregar
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>Macros del día</div>
              <div className="glass-card" style={{ padding: 20, height: "calc(100% - 32px)", display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", justifyContent: "space-around", width: "100%" }}>
                  <MacroCircle value={totalProtein} max={proteinTarget} color="#FF5871" label="Proteína" unit="g" />
                  <MacroCircle value={totalCarbs} max={carbsTarget} color="#FFFFFF" label="Carbos" unit="g" />
                  <MacroCircle value={totalFat} max={fatTarget} color="#FF6B35" label="Grasa" unit="g" />
                </div>
              </div>
            </div>
          </div>

          {/* Activity row */}
          <div>
            <div className="section-label" style={{ marginBottom: 12 }}>Actividad de hoy</div>
            <div className="zc-activity-row">
              <div className="glass-card" style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Droplets size={21} color="#38BDF8" />
                  <span style={{ fontSize: 30, fontWeight: 900, color: "#f4f4f5" }}>{waterGlasses}<span style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>/8</span></span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Hidratación</div>
                <div className="progress-bar" style={{ marginBottom: 12 }}>
                  <div className="progress-fill" style={{ width: `${Math.min(waterGlasses / 8, 1) * 100}%`, background: "#38BDF8" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setWaterGlasses(Math.max(0, waterGlasses - 1))} style={{ flex: 1, height: 34, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, cursor: "pointer", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Minus size={15} />
                  </button>
                  <button onClick={() => { if (waterGlasses < 8) setWaterGlasses(waterGlasses + 1); else toast.success("¡Meta de agua alcanzada!"); }} style={{ flex: 1, height: 34, background: "rgba(255,31,61,0.3)", border: "1px solid rgba(255,31,61,0.4)", borderRadius: 10, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              <div className="glass-card" onClick={() => router.push("/workout")} style={{ padding: 18, cursor: "pointer" }}>
                <div style={{ marginBottom: 8 }}>
                  <Dumbbell size={22} color="#FFFFFF" />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Entrenamiento</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>Pendiente</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#FF5871" }}>Comenzar</span>
                  <span style={{ fontSize: 13, color: "#FF5871" }}>›</span>
                </div>
              </div>

              <div className="glass-card" style={{ padding: 18 }}>
                <div style={{ marginBottom: 8 }}>
                  <Flame size={22} color="#FF6B35" />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Racha</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: "#FF6B35" }}>{currentStreak}<span style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}> días</span></div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>Consistencia es poder</div>
              </div>

              <div className="glass-card" style={{ padding: 18 }}>
                <div style={{ marginBottom: 8 }}>
                  <TrendingUp size={22} color="#30D158" />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Score hoy</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: "#30D158" }}>{liveScore}<span style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>/100</span></div>
              </div>
            </div>
          </div>

          {/* Racha semanal */}
          <div>
            <div className="section-label" style={{ marginBottom: 12 }}>Racha semanal</div>
            <div className="glass-card" style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <div style={{ textAlign: "center", minWidth: 76 }}>
                  <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 42, color: "#FF6B35", lineHeight: 1.1 }}>{currentStreak}</div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>días de racha</div>
                </div>
                <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
                  {["L", "M", "X", "J", "V", "S", "D"].map((day, i) => {
                    const dayOfWeek = new Date().getDay();
                    const todayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    const active = i < todayIdx || (i === todayIdx && checkInDone);
                    const isToday = i === todayIdx;
                    return (
                      <div key={day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%",
                          background: active ? "#30D158" : "rgba(255,255,255,0.07)",
                          border: isToday ? "1.5px solid #FF1F3D" : "none",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {active && <Check size={16} color="#fff" strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: 10.5, color: isToday ? "#FF5871" : "rgba(255,255,255,0.35)", fontWeight: 700 }}>{day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar derecha (desktop) / debajo (móvil) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>

          {/* Quick Access */}
          <div>
            {QUICK_SECTIONS.map(section => (
              <div key={section.category} style={{ marginBottom: 20 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>{section.category}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {section.items.map(item => (
                    <button
                      key={item.label}
                      onClick={() => router.push(item.href)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.09)",
                        borderRadius: 16, padding: "16px 6px",
                        cursor: "pointer", position: "relative", overflow: "hidden",
                      }}
                    >
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,31,61,0.14)", border: "1px solid rgba(255,31,61,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <item.icon size={19} color="#FF5871" />
                      </div>
                      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", fontWeight: 700, textAlign: "center", letterSpacing: 0.2 }}>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Daily Tip */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Conocimiento</div>
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Zap size={15} color="#FF5871" />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#FF5871", letterSpacing: 0.8, textTransform: "uppercase" }}>{tag}</span>
              </div>
              <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>{tip}</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .zc-grid { display: flex; flex-direction: column; gap: 24px; margin-top: 24px; }
        .zc-subgrid { display: flex; flex-direction: column; gap: 20px; }
        .zc-activity-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 900px) {
          .zc-grid { flex-direction: row; align-items: flex-start; }
          .zc-grid > div:first-child { flex: 1 1 0; }
          .zc-grid > div:last-child { flex: 0 0 340px; position: sticky; top: 24px; }
          .zc-subgrid { flex-direction: row; }
          .zc-subgrid > div { flex: 1; }
          .zc-activity-row { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </div>
  );
}
