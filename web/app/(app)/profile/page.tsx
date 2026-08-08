"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { user as userApi } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Edit2, Save, X, Crown, TrendingUp, Flame, Trophy, LogOut, Check, Zap,
  Target, Droplet, Dumbbell, Medal, Salad, Bell, Lock, Mail, Ruler, Moon,
} from "lucide-react";

type TabId = "profile" | "progress" | "subscription" | "settings";

const CHALLENGES = [
  { id: "1", icon: Flame, color: "#FF1F3D", title: "Racha de 7 días", desc: "Registra actividad 7 días seguidos", progress: 0.43, daysLeft: 4, xp: 200 },
  { id: "2", icon: Droplet, color: "#FFFFFF", title: "Hidratación perfecta", desc: "8 vasos de agua por 5 días", progress: 0.6, daysLeft: 2, xp: 100 },
  { id: "3", icon: Dumbbell, color: "#FF5871", title: "Semana activa", desc: "Completa 4 entrenamientos esta semana", progress: 0.25, daysLeft: 5, xp: 300 },
];

const ACHIEVEMENTS = [
  { id: "1", icon: Medal, color: "#FF5871", title: "Primer paso", desc: "Completaste tu primer día de seguimiento", unlocked: true },
  { id: "2", icon: Medal, color: "#a1a1aa", title: "Semana fuerte", desc: "7 días de racha consecutiva", unlocked: false },
  { id: "3", icon: Trophy, color: "#FFFFFF", title: "Constante", desc: "30 días de racha consecutiva", unlocked: false },
  { id: "4", icon: Zap, color: "#FF1F3D", title: "Velocista", desc: "Completa 10 entrenamientos", unlocked: false },
  { id: "5", icon: Salad, color: "#FFFFFF", title: "Nutrido", desc: "Registra macros 7 días seguidos", unlocked: false },
  { id: "6", icon: Droplet, color: "#FF5871", title: "Hidratado", desc: "8 vasos de agua 5 días seguidos", unlocked: false },
];

const WEIGHT_DATA = [74, 73.5, 73, 72.8, 72.3, 71.9, 71.5];
const DATES = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7"];

function Avatar({ name, size = 80 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, rgba(255,31,61,0.4), rgba(255,255,255,0.2))",
      border: "2px solid rgba(255,31,61,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 900, color: "#FF5871",
    }}>
      {initials || "?"}
    </div>
  );
}

// ── Sección Progreso (peso, desafíos, logros) — antes vivía en /progress ──────

function ProgressSection() {
  const [sub, setSub] = useState<"overview" | "challenges" | "achievements">("overview");
  const minW = Math.min(...WEIGHT_DATA);
  const maxW = Math.max(...WEIGHT_DATA);
  const SUBS: { id: typeof sub; label: string }[] = [
    { id: "overview", label: "Resumen" },
    { id: "challenges", label: "Desafíos" },
    { id: "achievements", label: "Logros" },
  ];

  return (
    <div>
      <div className="pg-stats" style={{ marginBottom: 20 }}>
        {[
          { icon: <Flame size={20} color="#FF1F3D" />, glow: "rgba(255,31,61,0.15)", label: "Racha", value: "0 días" },
          { icon: <Target size={20} color="#FF5871" />, glow: "rgba(255,31,61,0.1)", label: "Desafíos", value: `${CHALLENGES.length} activos` },
          { icon: <Trophy size={20} color="#FFFFFF" />, glow: "rgba(255,255,255,0.08)", label: "Logros", value: "1/6" },
        ].map(stat => (
          <div key={stat.label} className="glass-card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: stat.glow, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>{stat.icon}</div>
            <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 19, color: "#f4f4f5", marginBottom: 2 }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: 4, marginBottom: 20 }}>
        {SUBS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, transition: "all 0.2s", background: sub === t.id ? "#FF1F3D" : "transparent", color: sub === t.id ? "#fff" : "rgba(255,255,255,0.4)" }}>
            {t.label}
          </button>
        ))}
      </div>

      <style>{`
        .pg-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .pg-ach-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (min-width: 700px) { .pg-ach-grid { grid-template-columns: 1fr 1fr 1fr; } }
      `}</style>

      {sub === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", marginBottom: 4 }}>Evolución de peso</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>Últimas 7 semanas</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
              {WEIGHT_DATA.map((v, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ flex: 1, width: "100%", background: i === WEIGHT_DATA.length - 1 ? "#FF1F3D" : "rgba(255,31,61,0.3)", borderRadius: "4px 4px 0 0", minHeight: 4, height: `${((v - minW) / (maxW - minW || 1)) * 80 + 20}%` }} />
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{v}</span>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>{DATES[i]}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, padding: "12px 0 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Inicial</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f4f4f5" }}>{WEIGHT_DATA[0]} kg</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Actual</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF" }}>{WEIGHT_DATA[WEIGHT_DATA.length - 1]} kg</div>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", marginBottom: 16 }}>Resumen semanal</div>
            {[
              { label: "Entrenamientos", val: 0, max: 4, color: "#FFFFFF" },
              { label: "Días con macros", val: 0, max: 7, color: "#FF5871" },
              { label: "Días hidratado", val: 0, max: 7, color: "#FF1F3D" },
              { label: "Check-ins", val: 0, max: 7, color: "#FFFFFF" },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#f4f4f5" }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.val}/{item.max}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(item.val / item.max) * 100}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sub === "challenges" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CHALLENGES.map(challenge => {
            const Icon = challenge.icon;
            return (
              <div key={challenge.id} className="glass-card" style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${challenge.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={22} color={challenge.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f4f5" }}>{challenge.title}</div>
                      <div style={{ background: "rgba(255,31,61,0.15)", borderRadius: 6, padding: "3px 9px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#FF5871" }}>+{challenge.xp} XP</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{challenge.desc}</div>
                  </div>
                </div>
                <div className="progress-bar" style={{ marginBottom: 6 }}>
                  <div className="progress-fill" style={{ width: `${challenge.progress * 100}%`, background: challenge.color }} />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{challenge.daysLeft} días restantes · {Math.round(challenge.progress * 100)}% completado</div>
              </div>
            );
          })}
        </div>
      )}

      {sub === "achievements" && (
        <div className="pg-ach-grid">
          {ACHIEVEMENTS.map(ach => {
            const Icon = ach.icon;
            return (
              <div key={ach.id} className="glass-card" style={{ padding: 18, opacity: ach.unlocked ? 1 : 0.45, textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: `${ach.color}22`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", filter: ach.unlocked ? "none" : "grayscale(0.6)" }}>
                  <Icon size={24} color={ach.color} />
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f4f4f5", marginBottom: 4 }}>{ach.title}</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{ach.desc}</div>
                {ach.unlocked && (
                  <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <Check size={12} strokeWidth={3} /> Desbloqueado
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sección Configuración ──────────────────────────────────────────────────────

function SettingsRow({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value?: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 4px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "none", border: "none", borderBottomWidth: 1, cursor: onClick ? "pointer" : "default", textAlign: "left" }}>
      <div style={{ width: 26, display: "flex", justifyContent: "center", color: "rgba(255,255,255,0.6)" }}>{icon}</div>
      <span style={{ flex: 1, fontSize: 13.5, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{label}</span>
      {value}
    </button>
  );
}

function SettingsSection() {
  const [notifWater, setNotifWater] = useState(true);
  const [notifCheckIn, setNotifCheckIn] = useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", marginBottom: 4 }}>Notificaciones</div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>Recordatorios inteligentes para mantener tu racha</div>
        <SettingsRow icon={<Bell size={16} />} label="Check-in matutino" value={
          <input type="checkbox" checked={notifCheckIn} onChange={e => setNotifCheckIn(e.target.checked)} style={{ accentColor: "#FF1F3D", width: 18, height: 18 }} />
        } />
        <SettingsRow icon={<Droplet size={16} />} label="Recordatorio de agua" value={
          <input type="checkbox" checked={notifWater} onChange={e => setNotifWater(e.target.checked)} style={{ accentColor: "#FF1F3D", width: 18, height: 18 }} />
        } />
      </div>

      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", marginBottom: 12 }}>Cuenta</div>
        <SettingsRow icon={<Lock size={16} />} label="Cambiar contraseña" onClick={() => toast("Próximamente")} />
        <SettingsRow icon={<Mail size={16} />} label="Cambiar correo" onClick={() => toast("Próximamente")} />
        <SettingsRow icon={<Ruler size={16} />} label="Unidades (kg / cm)" onClick={() => toast("Próximamente")} />
        <SettingsRow icon={<Moon size={16} />} label="Tema oscuro" value={<span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Activo</span>} />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [weight, setWeight] = useState((user as any)?.profile?.weight ?? "");
  const [height, setHeight] = useState((user as any)?.profile?.height ?? "");
  const [age, setAge] = useState((user as any)?.profile?.age ?? "");
  const [goalWeight, setGoalWeight] = useState((user as any)?.profile?.goal_weight ?? "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({ weight: Number(weight), height: Number(height), age: Number(age), goalWeight: Number(goalWeight) });
      toast.success("Perfil actualizado");
      setEditing(false);
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  const isPremium = user?.subscriptionTier === "premium" || user?.subscriptionTier === "annual";

  const TABS: { id: TabId; label: string }[] = [
    { id: "profile", label: "Perfil" },
    { id: "progress", label: "Progreso" },
    { id: "subscription", label: "Suscripción" },
    { id: "settings", label: "Configuración" },
  ];

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.5s ease" }}>

      {/* Header */}
      <div style={{ paddingTop: 32, paddingBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#FF5871", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · CUENTA</div>
        <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, color: "#f4f4f5", letterSpacing: -0.5 }}>Mi perfil</div>
      </div>

      <div className="pf-grid">
        {/* Sidebar: identity + stats + tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="glass-card-accent">
            <div style={{ padding: 26, textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <Avatar name={user?.fullName ?? "U"} size={88} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f4f4f5", marginBottom: 4 }}>{user?.fullName}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>@{user?.username}</div>
              {isPremium ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,31,61,0.2)", border: "1px solid rgba(255,31,61,0.4)", borderRadius: 999, padding: "5px 14px" }}>
                  <Crown size={13} color="#FF5871" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#FF5871" }}>Premium</span>
                </div>
              ) : (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 999, padding: "5px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>Free</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-around", marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.09)" }}>
                {[
                  { icon: <Flame size={18} color="#FF1F3D" />, label: "Racha", value: "0 días" },
                  { icon: <Trophy size={18} color="#FFFFFF" />, label: "Logros", value: "0" },
                  { icon: <TrendingUp size={18} color="#FF5871" />, label: "Progreso", value: "0%" },
                ].map(stat => (
                  <div key={stat.label} style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>{stat.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f4f5" }}>{stat.value}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, padding: 6 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "12px 16px", borderRadius: 11, border: "none", cursor: "pointer", textAlign: "left",
                  fontFamily: "inherit", fontSize: 14, fontWeight: 700, transition: "all 0.2s",
                  background: activeTab === tab.id ? "linear-gradient(135deg, #FF1F3D, #FF0030)" : "transparent",
                  color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.45)",
                  boxShadow: activeTab === tab.id ? "0 8px 20px rgba(255,31,61,0.35)" : "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "rgba(255,31,61,0.08)", border: "1px solid rgba(255,31,61,0.2)", borderRadius: 14, padding: 16, cursor: "pointer", color: "#FF1F3D", fontSize: 14, fontWeight: 600, fontFamily: "inherit", justifyContent: "center" }}
          >
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>

        {/* Main content */}
        <div>

      {activeTab === "profile" && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5" }}>Datos físicos</div>
            {editing ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}><X size={18} /></button>
                <button onClick={handleSave} disabled={saving} style={{ background: "#FF1F3D", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Save size={13} /> {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                <Edit2 size={13} /> Editar
              </button>
            )}
          </div>

          {[
            { label: "Peso actual (kg)", val: weight, set: setWeight },
            { label: "Talla (cm)", val: height, set: setHeight },
            { label: "Edad", val: age, set: setAge },
            { label: "Peso objetivo (kg)", val: goalWeight, set: setGoalWeight },
          ].map(field => (
            <div key={field.label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>{field.label}</div>
              {editing ? (
                <input
                  type="number"
                  value={field.val}
                  onChange={e => field.set(e.target.value)}
                  className="glass-input"
                  style={{ fontSize: 15 }}
                />
              ) : (
                <div style={{ fontSize: 15, fontWeight: 600, color: "#f4f4f5", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {field.val || <span style={{ color: "rgba(255,255,255,0.25)" }}>No configurado</span>}
                </div>
              )}
            </div>
          ))}

          <div style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Correo</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#f4f4f5", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{user?.email}</div>
          </div>
        </div>
      )}

      {activeTab === "progress" && <ProgressSection />}

      {activeTab === "subscription" && (
        <div>
          {isPremium ? (
            <div className="glass-card" style={{ padding: 20, textAlign: "center" }}>
              <Crown size={40} color="#FF5871" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f4f4f5", marginBottom: 8 }}>Premium activo</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>Disfruta de todas las funciones sin límites</div>
              <button className="btn-secondary" style={{ width: "100%" }}>Gestionar suscripción</button>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 20, border: "1px solid rgba(255,31,61,0.3)" }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <Zap size={36} color="#FF5871" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 20, fontWeight: 800, color: "#f4f4f5", marginBottom: 8 }}>Actualiza a Premium</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Desbloquea chat ilimitado, planes personalizados y mucho más</div>
              </div>
              {["Chat IA ilimitado", "Planes personalizados diarios", "Análisis de progreso avanzado", "Recetas exclusivas", "Soporte prioritario"].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#FF1F3D", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Check size={11} color="#fff" strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: 13, color: "#f4f4f5" }}>{f}</span>
                </div>
              ))}
              <button className="btn-primary" style={{ width: "100%", marginTop: 12 }}>
                <Crown size={16} /> Comenzar Premium — $199/mes
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && <SettingsSection />}

        </div>
      </div>

      <style>{`
        .pf-grid { display: flex; flex-direction: column; gap: 24px; }
        @media (min-width: 900px) {
          .pf-grid { flex-direction: row; align-items: flex-start; }
          .pf-grid > div:first-child { flex: 0 0 320px; position: sticky; top: 24px; }
          .pf-grid > div:last-child { flex: 1 1 0; min-width: 0; }
        }
      `}</style>
    </div>
  );
}
