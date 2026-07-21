"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import {
  Users, TrendingUp, Crown, Activity, RefreshCw,
  LogOut, Shield, BarChart3, CheckCircle, XCircle,
  Search, ChevronDown
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  username: string;
  role: string;
  subscription_tier: string;
  email_verified: boolean;
  created_at: string;
  onboarding_completed: boolean;
}

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  verifiedUsers: number;
  todayRegistrations: number;
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}15`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>{label}</div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: "#f4f4f5", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, token, clearAuth, loadFromStorage, isLoading } = useAuthStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, premiumUsers: 0, verifiedUsers: 0, todayRegistrations: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState("");

  // Auth guard
  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (!isLoading) {
      if (!token) { router.replace("/login"); return; }
      if (user && user.role !== "admin") {
        toast.error("Acceso restringido");
        router.replace("/home");
      }
    }
  }, [isLoading, token, user, router]);

  const fetchData = useCallback(async () => {
    if (!token || user?.role !== "admin") return;
    setLoadingData(true);
    try {
      const res = await api.get("/admin/users");
      const data: UserRow[] = res.data?.data?.users ?? res.data?.data ?? [];
      setUsers(data);
      const total = data.length;
      const premium = data.filter(u => u.subscription_tier === "premium" || u.subscription_tier === "annual").length;
      const verified = data.filter(u => u.email_verified).length;
      const today = data.filter(u => {
        const d = new Date(u.created_at);
        const now = new Date();
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
      setStats({ totalUsers: total, premiumUsers: premium, verifiedUsers: verified, todayRegistrations: today });
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      if (status === 403 || status === 401) {
        toast.error("Sin permisos de administrador");
        router.replace("/home");
      } else {
        toast.error("Error cargando datos");
      }
    } finally {
      setLoadingData(false);
    }
  }, [token, user?.role, router]);

  useEffect(() => {
    if (!isLoading && token && user?.role === "admin") {
      fetchData();
    }
  }, [isLoading, token, user?.role, fetchData]);

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  const filtered = users.filter(u =>
    !search ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  // Loading / auth pending
  if (isLoading || (token && !user)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#080808" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #2563EB", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!token || (user && user.role !== "admin")) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#f4f4f5" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px" }}>
        <div style={{ maxWidth: 1300, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Image src="/logo-blanco.png" alt="ZENCRUS" width={100} height={30} style={{ objectFit: "contain" }} />
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 999, padding: "4px 12px" }}>
              <Shield size={13} color="#60a5fa" />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#60a5fa", letterSpacing: 1 }}>PANEL ADMIN</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{user?.email}</div>
            <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#FF3B30", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
              <LogOut size={14} /> Salir
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1300, margin: "0 auto", padding: "32px 24px" }}>
        {/* Title */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#2563EB", letterSpacing: 3.5, marginBottom: 6 }}>ADMINISTRACIÓN</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#f4f4f5" }}>Panel de control</h1>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 32 }}>
          <StatCard icon={<Users size={20} color="#2563EB" />} label="Total usuarios" value={stats.totalUsers} color="#2563EB" sub="registrados en la plataforma" />
          <StatCard icon={<Crown size={20} color="#FFD60A" />} label="Premium" value={stats.premiumUsers} color="#FFD60A" sub={`${stats.totalUsers ? Math.round(stats.premiumUsers / stats.totalUsers * 100) : 0}% del total`} />
          <StatCard icon={<CheckCircle size={20} color="#30D158" />} label="Emails verificados" value={stats.verifiedUsers} color="#30D158" sub={`${stats.totalUsers ? Math.round(stats.verifiedUsers / stats.totalUsers * 100) : 0}% del total`} />
          <StatCard icon={<TrendingUp size={20} color="#00C2C0" />} label="Hoy" value={stats.todayRegistrations} color="#00C2C0" sub="nuevos registros" />
        </div>

        {/* Users table */}
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Table header */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f4f5" }}>Usuarios ({filtered.length})</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Search */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px", minWidth: 240 }}>
                <Search size={15} color="rgba(255,255,255,0.3)" />
                <input
                  type="text"
                  placeholder="Buscar usuario..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ background: "none", border: "none", outline: "none", color: "#fff", fontSize: 13, fontFamily: "inherit", flex: 1 }}
                />
              </div>
              <button
                onClick={fetchData}
                disabled={loadingData}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "inherit" }}
              >
                <RefreshCw size={13} style={{ animation: loadingData ? "spin 1s linear infinite" : "none" }} />
                Actualizar
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            {loadingData ? (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #2563EB", borderTopColor: "transparent", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Cargando usuarios...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                {search ? "No se encontraron usuarios" : "Sin usuarios registrados"}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Usuario", "Email", "Rol", "Plan", "Verificado", "Onboarding", "Registrado"].map(h => (
                      <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                      <td style={{ padding: "14px 20px" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#f4f4f5" }}>{u.full_name || "—"}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>@{u.username || "sin username"}</div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 13, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>{u.email}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 6,
                          background: u.role === "admin" ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.05)",
                          color: u.role === "admin" ? "#60a5fa" : "rgba(255,255,255,0.4)",
                          border: u.role === "admin" ? "1px solid rgba(37,99,235,0.3)" : "1px solid rgba(255,255,255,0.08)",
                        }}>
                          {u.role?.toUpperCase() || "USER"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 6,
                          background: u.subscription_tier === "premium" || u.subscription_tier === "annual" ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.05)",
                          color: u.subscription_tier === "premium" || u.subscription_tier === "annual" ? "#FFD60A" : "rgba(255,255,255,0.4)",
                          border: u.subscription_tier === "premium" || u.subscription_tier === "annual" ? "1px solid rgba(255,215,0,0.2)" : "1px solid rgba(255,255,255,0.08)",
                        }}>
                          {(u.subscription_tier || "FREE").toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        {u.email_verified
                          ? <CheckCircle size={16} color="#30D158" />
                          : <XCircle size={16} color="rgba(255,59,48,0.5)" />}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        {u.onboarding_completed
                          ? <CheckCircle size={16} color="#30D158" />
                          : <XCircle size={16} color="rgba(255,255,255,0.2)" />}
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                        {new Date(u.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.15)", marginTop: 32 }}>
          ZENCRUS Admin Panel · Solo accesible con rol admin · Datos en tiempo real del backend Railway
        </p>
      </main>
    </div>
  );
}
