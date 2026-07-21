"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { user as userApi } from "@/lib/api";
import toast from "react-hot-toast";
import { Edit2, Save, X, Crown, TrendingUp, Flame, Trophy, LogOut } from "lucide-react";

type TabId = "profile" | "progress" | "subscription";

function Avatar({ name, size = 80 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, rgba(37,99,235,0.4), rgba(0,194,192,0.2))",
      border: "2px solid rgba(37,99,235,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 900, color: "#60a5fa",
    }}>
      {initials || "?"}
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
  const firstName = user?.fullName?.split(" ")[0] ?? "Atleta";

  const TABS: { id: TabId; label: string }[] = [
    { id: "profile", label: "Perfil" },
    { id: "progress", label: "Progreso" },
    { id: "subscription", label: "Suscripción" },
  ];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.5s ease" }}>

      {/* Header */}
      <div style={{ paddingTop: 24, paddingBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: "#2563EB", letterSpacing: 3.5, marginBottom: 4 }}>ZENCRUS</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#f4f4f5" }}>Mi perfil</div>
      </div>

      {/* Profile card */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Avatar name={user?.fullName ?? "U"} size={88} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#f4f4f5", marginBottom: 4 }}>{user?.fullName}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>@{user?.username}</div>
        {isPremium ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.4)", borderRadius: 999, padding: "4px 12px" }}>
            <Crown size={13} color="#60a5fa" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa" }}>Premium</span>
          </div>
        ) : (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 999, padding: "4px 12px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>Free</span>
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.09)" }}>
          {[
            { icon: <Flame size={18} color="#FF6B35" />, label: "Racha", value: "0 días" },
            { icon: <Trophy size={18} color="#FFD60A" />, label: "Logros", value: "0" },
            { icon: <TrendingUp size={18} color="#30D158" />, label: "Progreso", value: "0%" },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>{stat.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f4f5" }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: 4, marginBottom: 20 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700, transition: "all 0.2s",
              background: activeTab === tab.id ? "#2563EB" : "transparent",
              color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.4)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Perfil */}
      {activeTab === "profile" && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5" }}>Datos físicos</div>
            {editing ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}><X size={18} /></button>
                <button onClick={handleSave} disabled={saving} style={{ background: "#2563EB", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
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

      {/* Tab: Progreso */}
      {activeTab === "progress" && (
        <div>
          <div className="glass-card" style={{ padding: 20, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", marginBottom: 16 }}>Historial de peso</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
              {[70, 69, 68.5, 68, 67.5, 67, 66.8].map((v, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ flex: 1, width: "100%", background: i === 6 ? "#2563EB" : "rgba(37,99,235,0.3)", borderRadius: "4px 4px 0 0", minHeight: 4, height: `${((v - 65) / 5) * 100}%` }} />
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 8, textAlign: "center" }}>Últimas 7 semanas</div>
          </div>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", marginBottom: 16 }}>Racha de actividad</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {["L","M","X","J","V","S","D"].map((d, i) => (
                <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: i < 3 ? "#30D158" : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {i < 3 && <span style={{ fontSize: 12, color: "#fff" }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Suscripción */}
      {activeTab === "subscription" && (
        <div>
          {isPremium ? (
            <div className="glass-card" style={{ padding: 20, textAlign: "center" }}>
              <Crown size={40} color="#60a5fa" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f4f4f5", marginBottom: 8 }}>Premium activo</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>Disfruta de todas las funciones sin límites</div>
              <button className="btn-secondary" style={{ width: "100%" }}>Gestionar suscripción</button>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 20, border: "1px solid rgba(37,99,235,0.3)" }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#f4f4f5", marginBottom: 8 }}>Actualiza a Premium</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Desbloquea chat ilimitado, planes personalizados y mucho más</div>
              </div>
              {["Chat IA ilimitado", "Planes personalizados diarios", "Análisis de progreso avanzado", "Recetas exclusivas", "Soporte prioritario"].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#30D158", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: "#fff" }}>✓</span>
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

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginTop: 24, background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 14, padding: 16, cursor: "pointer", color: "#FF3B30", fontSize: 14, fontWeight: 600, fontFamily: "inherit", justifyContent: "center" }}
      >
        <LogOut size={18} /> Cerrar sesión
      </button>
    </div>
  );
}
