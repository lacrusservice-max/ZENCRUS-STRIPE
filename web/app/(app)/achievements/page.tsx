"use client";

import { useEffect, useState } from "react";
import { Lock, Sprout, Zap, Flame, Dumbbell, Footprints, Swords, Trophy, Crown, Sparkles, Utensils, ScanLine, Search, Camera, Users, UserPlus, Star, Gauge, Scale, Bot, TrendingUp, Rocket } from "lucide-react";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875", gold: "#c9a94e" };

const LEVELS = [
  { level: 1, name: "Principiante", minXP: 0, icon: Sprout }, { level: 2, name: "Aprendiz", minXP: 500, icon: Zap },
  { level: 3, name: "Dedicado", minXP: 1000, icon: Flame }, { level: 4, name: "Constante", minXP: 2000, icon: Dumbbell },
  { level: 5, name: "Atleta", minXP: 3500, icon: Footprints }, { level: 6, name: "Guerrero", minXP: 5500, icon: Swords },
  { level: 7, name: "Campeón", minXP: 8000, icon: Trophy }, { level: 8, name: "Élite", minXP: 11000, icon: Crown },
  { level: 9, name: "Leyenda", minXP: 15000, icon: Sparkles },
];

type Cat = "streak" | "workout" | "nutrition" | "social" | "health" | "special";
const CAT_LABELS: Record<Cat, string> = { streak: "Racha", workout: "Entreno", nutrition: "Nutrición", social: "Social", health: "Salud", special: "Especial" };
const CAT_COLORS: Record<Cat, string> = { streak: "#FF6B35", workout: "#60a5fa", nutrition: "#3fae6b", social: "#c084fc", health: "#38BDF8", special: "#FFD60A" };

const ACHIEVEMENTS: { id: string; title: string; description: string; icon: typeof Flame; category: Cat; xp: number }[] = [
  { id: "first_meal", title: "Primera comida", description: "Registra tu primera comida", icon: Utensils, category: "nutrition", xp: 50 },
  { id: "first_workout", title: "Primera rutina", description: "Completa tu primer entrenamiento", icon: Dumbbell, category: "workout", xp: 100 },
  { id: "streak_3", title: "Racha de 3 días", description: "3 días consecutivos activo", icon: Flame, category: "streak", xp: 75 },
  { id: "streak_7", title: "Semana completa", description: "7 días consecutivos activo", icon: Flame, category: "streak", xp: 200 },
  { id: "streak_14", title: "Dos semanas", description: "14 días consecutivos activo", icon: Flame, category: "streak", xp: 350 },
  { id: "streak_30", title: "Mes de hierro", description: "30 días consecutivos activo", icon: Trophy, category: "streak", xp: 750 },
  { id: "streak_60", title: "Dos meses imparable", description: "60 días consecutivos activo", icon: Trophy, category: "streak", xp: 1500 },
  { id: "streak_100", title: "Centurión", description: "100 días consecutivos activo", icon: Crown, category: "streak", xp: 3000 },
  { id: "workouts_10", title: "10 entrenamientos", description: "Completa 10 rutinas", icon: Dumbbell, category: "workout", xp: 200 },
  { id: "workouts_50", title: "50 entrenamientos", description: "Completa 50 rutinas", icon: Trophy, category: "workout", xp: 500 },
  { id: "pr_first", title: "Récord personal", description: "Rompe tu primer PR", icon: TrendingUp, category: "workout", xp: 150 },
  { id: "pr_five", title: "5 récords personales", description: "Rompe 5 PRs diferentes", icon: Rocket, category: "workout", xp: 400 },
  { id: "meals_50", title: "Nutricionista amateur", description: "Registra 50 comidas", icon: Utensils, category: "nutrition", xp: 200 },
  { id: "barcode_first", title: "Escáner novato", description: "Escanea tu primer producto", icon: ScanLine, category: "nutrition", xp: 50 },
  { id: "barcode_10", title: "Detective nutricional", description: "Escanea 10 productos", icon: Search, category: "nutrition", xp: 150 },
  { id: "social_first_post", title: "Primera publicación", description: "Comparte tu primer post", icon: Camera, category: "social", xp: 75 },
  { id: "social_five_posts", title: "Creador de contenido", description: "Publica 5 veces", icon: Sparkles, category: "social", xp: 200 },
  { id: "friends_first", title: "Primer amigo", description: "Conecta con tu primer amigo", icon: UserPlus, category: "social", xp: 100 },
  { id: "friends_five", title: "Comunidad", description: "Conecta con 5 amigos", icon: Users, category: "social", xp: 250 },
  { id: "health_score_80", title: "Score élite", description: "Alcanza 80 en Health Score", icon: Star, category: "health", xp: 300 },
  { id: "perfect_day", title: "Día perfecto", description: "Un día con Health Score de 100", icon: Gauge, category: "health", xp: 500 },
  { id: "weight_logged", title: "Registro inicial", description: "Registra tu peso por primera vez", icon: Scale, category: "health", xp: 50 },
  { id: "photo_progress", title: "Primera foto de progreso", description: "Sube tu primera foto de progreso", icon: Camera, category: "health", xp: 100 },
  { id: "ai_conversations_10", title: "Coach adicto", description: "Ten 10 conversaciones con el Coach IA", icon: Bot, category: "special", xp: 150 },
];

const KEY = "zencrus-achievements-unlocked";

export default function AchievementsPage() {
  const [unlocked, setUnlocked] = useState<string[]>([]);
  useEffect(() => { try { setUnlocked(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* ignore */ } }, []);

  const xp = ACHIEVEMENTS.filter((a) => unlocked.includes(a.id)).reduce((s, a) => s + a.xp, 0);
  const level = [...LEVELS].reverse().find((l) => xp >= l.minXP) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.minXP > xp);
  const progress = next ? ((xp - level.minXP) / (next.minXP - level.minXP)) * 100 : 100;

  const LevelIcon = level.icon;
  const NextIcon = next?.icon;

  return (
    <div style={{ minHeight: "100vh", color: C.text, padding: "0 20px 120px" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <div style={{ paddingTop: 32, paddingBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#FFD60A", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · GAMIFICACIÓN</div>
          <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, color: C.text, letterSpacing: -0.5 }}>Logros</div>
        </div>

        <div className="ac-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            {/* Level card — accent hero */}
            <div className="glass-card-accent">
              <div style={{ padding: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, rgba(255,214,10,0.25), rgba(37,99,235,0.2))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <LevelIcon size={30} color="#FFD60A" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#8fa9dd", fontWeight: 700 }}>Nivel {level.level}</div>
                    <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 26, color: C.text }}>{level.name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 26, color: C.text }}>{xp.toLocaleString("es-MX")}</div>
                    <div style={{ fontSize: 10, color: C.dim2 }}>XP total</div>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #FFD60A, #f08a4b)" }} />
                </div>
                {next && NextIcon && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.dim2, marginTop: 10 }}>
                    {(next.minXP - xp).toLocaleString("es-MX")} XP para {next.name} <NextIcon size={13} color="#FFD60A" />
                  </div>
                )}
              </div>
            </div>

            {/* Progress summary */}
            <div style={{ fontSize: 13, color: C.dim }}>
              <b style={{ color: C.text }}>{unlocked.length}</b> de {ACHIEVEMENTS.length} logros desbloqueados
            </div>

            {/* Achievements grid */}
            <div className="ac-achievements-grid">
              {ACHIEVEMENTS.map((a) => {
                const on = unlocked.includes(a.id);
                const Icon = a.icon;
                const color = CAT_COLORS[a.category];
                return (
                  <div key={a.id} className="glass-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, opacity: on ? 1 : 0.5 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 14, background: on ? `${color}22` : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {on ? <Icon size={22} color={color} /> : <Lock size={18} color={C.dim2} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{a.title}</div>
                      <div style={{ fontSize: 11.5, color: C.dim2, lineHeight: 1.4 }}>{a.description}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: on ? color : C.dim2 }}>{on ? `+${a.xp}` : ""}</div>
                      <div style={{ fontSize: 9, color: C.dim2, marginTop: 2 }}>{CAT_LABELS[a.category]}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="section-label">Niveles</div>
            <div className="glass-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
              {LEVELS.map(l => {
                const Icon = l.icon;
                const reached = xp >= l.minXP;
                return (
                  <div key={l.level} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", opacity: reached ? 1 : 0.4 }}>
                    <Icon size={16} color={reached ? "#FFD60A" : C.dim2} />
                    <span style={{ fontSize: 12.5, fontWeight: reached ? 700 : 500, color: reached ? C.text : C.dim }}>{l.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: C.dim2 }}>{l.minXP.toLocaleString("es-MX")} XP</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .ac-grid { display: flex; flex-direction: column; gap: 24px; }
        .ac-achievements-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 900px) {
          .ac-grid { flex-direction: row; align-items: flex-start; }
          .ac-grid > div:first-child { flex: 1 1 0; min-width: 0; }
          .ac-grid > div:last-child { flex: 0 0 300px; position: sticky; top: 24px; }
          .ac-achievements-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
