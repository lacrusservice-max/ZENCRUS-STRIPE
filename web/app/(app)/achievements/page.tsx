"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875", gold: "#c9a94e" };

const LEVELS = [
  { level: 1, name: "Principiante", minXP: 0, emoji: "🌱" }, { level: 2, name: "Aprendiz", minXP: 500, emoji: "⚡" },
  { level: 3, name: "Dedicado", minXP: 1000, emoji: "🔥" }, { level: 4, name: "Constante", minXP: 2000, emoji: "💪" },
  { level: 5, name: "Atleta", minXP: 3500, emoji: "🏃" }, { level: 6, name: "Guerrero", minXP: 5500, emoji: "⚔️" },
  { level: 7, name: "Campeón", minXP: 8000, emoji: "🏆" }, { level: 8, name: "Élite", minXP: 11000, emoji: "👑" },
  { level: 9, name: "Leyenda", minXP: 15000, emoji: "🌟" },
];

type Cat = "streak" | "workout" | "nutrition" | "social" | "health" | "special";
const CAT_LABELS: Record<Cat, string> = { streak: "Racha", workout: "Entreno", nutrition: "Nutrición", social: "Social", health: "Salud", special: "Especial" };

const ACHIEVEMENTS: { id: string; title: string; description: string; emoji: string; category: Cat; xp: number }[] = [
  { id: "first_meal", title: "Primera comida", description: "Registra tu primera comida", emoji: "🍽️", category: "nutrition", xp: 50 },
  { id: "first_workout", title: "Primera rutina", description: "Completa tu primer entrenamiento", emoji: "🏋️", category: "workout", xp: 100 },
  { id: "streak_3", title: "Racha de 3 días", description: "3 días consecutivos activo", emoji: "🔥", category: "streak", xp: 75 },
  { id: "streak_7", title: "Semana completa", description: "7 días consecutivos activo", emoji: "📅", category: "streak", xp: 200 },
  { id: "streak_14", title: "Dos semanas", description: "14 días consecutivos activo", emoji: "🎯", category: "streak", xp: 350 },
  { id: "streak_30", title: "Mes de hierro", description: "30 días consecutivos activo", emoji: "🏆", category: "streak", xp: 750 },
  { id: "streak_60", title: "Dos meses imparable", description: "60 días consecutivos activo", emoji: "💎", category: "streak", xp: 1500 },
  { id: "streak_100", title: "Centurión", description: "100 días consecutivos activo", emoji: "👑", category: "streak", xp: 3000 },
  { id: "workouts_10", title: "10 entrenamientos", description: "Completa 10 rutinas", emoji: "💪", category: "workout", xp: 200 },
  { id: "workouts_50", title: "50 entrenamientos", description: "Completa 50 rutinas", emoji: "🥇", category: "workout", xp: 500 },
  { id: "pr_first", title: "Récord personal", description: "Rompe tu primer PR", emoji: "📈", category: "workout", xp: 150 },
  { id: "pr_five", title: "5 récords personales", description: "Rompe 5 PRs diferentes", emoji: "🚀", category: "workout", xp: 400 },
  { id: "meals_50", title: "Nutricionista amateur", description: "Registra 50 comidas", emoji: "🥗", category: "nutrition", xp: 200 },
  { id: "barcode_first", title: "Escáner novato", description: "Escanea tu primer producto", emoji: "📱", category: "nutrition", xp: 50 },
  { id: "barcode_10", title: "Detective nutricional", description: "Escanea 10 productos", emoji: "🔍", category: "nutrition", xp: 150 },
  { id: "social_first_post", title: "Primera publicación", description: "Comparte tu primer post", emoji: "📸", category: "social", xp: 75 },
  { id: "social_five_posts", title: "Creador de contenido", description: "Publica 5 veces", emoji: "✨", category: "social", xp: 200 },
  { id: "friends_first", title: "Primer amigo", description: "Conecta con tu primer amigo", emoji: "🤝", category: "social", xp: 100 },
  { id: "friends_five", title: "Comunidad", description: "Conecta con 5 amigos", emoji: "👥", category: "social", xp: 250 },
  { id: "health_score_80", title: "Score élite", description: "Alcanza 80 en Health Score", emoji: "⭐", category: "health", xp: 300 },
  { id: "perfect_day", title: "Día perfecto", description: "Un día con Health Score de 100", emoji: "💯", category: "health", xp: 500 },
  { id: "weight_logged", title: "Registro inicial", description: "Registra tu peso por primera vez", emoji: "⚖️", category: "health", xp: 50 },
  { id: "photo_progress", title: "Primera foto de progreso", description: "Sube tu primera foto de progreso", emoji: "📷", category: "health", xp: 100 },
  { id: "ai_conversations_10", title: "Coach adicto", description: "Ten 10 conversaciones con el Coach IA", emoji: "🤖", category: "special", xp: 150 },
];

const KEY = "zencrus-achievements-unlocked";

export default function AchievementsPage() {
  const [unlocked, setUnlocked] = useState<string[]>([]);
  useEffect(() => { try { setUnlocked(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* ignore */ } }, []);

  const xp = ACHIEVEMENTS.filter((a) => unlocked.includes(a.id)).reduce((s, a) => s + a.xp, 0);
  const level = [...LEVELS].reverse().find((l) => xp >= l.minXP) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.minXP > xp);
  const progress = next ? ((xp - level.minXP) / (next.minXP - level.minXP)) * 100 : 100;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "36px 24px 100px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b8cce", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Gamificación</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Logros</h1>
        </div>

        {/* Level card */}
        <div style={{ background: `linear-gradient(160deg, ${C.navySoft}, ${C.panel})`, border: `1px solid ${C.navy}`, borderRadius: 18, padding: 24, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <span style={{ fontSize: 44 }}>{level.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#8fa9dd", fontWeight: 700 }}>Nivel {level.level}</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{level.name}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{xp.toLocaleString("es-MX")}</div>
              <div style={{ fontSize: 10, color: C.dim2 }}>XP total</div>
            </div>
          </div>
          <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.border}` }}>
            <div style={{ height: "100%", width: `${progress}%`, background: C.navy, transition: "width 0.4s" }} />
          </div>
          {next && <div style={{ fontSize: 11, color: C.dim2, marginTop: 8 }}>{(next.minXP - xp).toLocaleString("es-MX")} XP para {next.name} {next.emoji}</div>}
        </div>

        {/* Progress summary */}
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 16 }}>
          <b style={{ color: C.text }}>{unlocked.length}</b> de {ACHIEVEMENTS.length} logros desbloqueados
        </div>

        {/* Achievements grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
          {ACHIEVEMENTS.map((a) => {
            const on = unlocked.includes(a.id);
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.panel, border: `1px solid ${on ? C.navy : C.border}`, borderRadius: 14, padding: 14, opacity: on ? 1 : 0.55 }}>
                <span style={{ fontSize: 28, filter: on ? "none" : "grayscale(1)" }}>{on ? a.emoji : "🔒"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{a.title}</div>
                  <div style={{ fontSize: 11.5, color: C.dim2, lineHeight: 1.4 }}>{a.description}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: on ? "#8fa9dd" : C.dim2 }}>{on ? `+${a.xp}` : <Lock size={13} />}</div>
                  <div style={{ fontSize: 9, color: C.dim2, marginTop: 2 }}>{CAT_LABELS[a.category]}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
