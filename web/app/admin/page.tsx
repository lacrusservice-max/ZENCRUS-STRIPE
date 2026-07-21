"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import { admin } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Users, TrendingUp, Crown, RefreshCw, LogOut, Shield, CheckCircle,
  XCircle, Search, Trash2, Mail, Unlock, ShieldCheck, UserCog,
  Download, CreditCard, ScrollText, LayoutDashboard, BarChart3, X,
  Zap, Ban, Play, Calendar, DollarSign, Send, AlertTriangle, Radio,
  Activity, Clock, Server, Percent, HeartPulse, Dumbbell, MessageSquare,
  UserX, Eye, TrendingDown,
} from "lucide-react";

const BACKEND = "https://web-production-1d2e22.up.railway.app/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  username?: string;
  role: string;
  subscription_tier: string;
  email_verified: boolean;
  is_active: boolean;
  created_at: string;
  last_login?: string | null;
  failed_login_attempts?: number;
}

interface SubRow {
  id: string;
  tier: string;
  status: string;
  payment_provider: string;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  users?: { id: string; email: string; full_name: string };
}

interface AuditRow {
  id: string;
  action: string;
  created_at: string;
  metadata?: Record<string, unknown>;
  users?: { id: string; email: string; full_name: string } | null;
}

interface Dashboard {
  users: { total: number; active: number; new7d: number; new30d: number };
  subscriptions: { total: number; active: number; byTier: Record<string, number>; monthlyRevenue: number };
  content: { messages: number; dietPlans: number; workouts: number };
  recentLogs: AuditRow[];
  recentUsers: UserRow[];
}

interface Revenue {
  mrr: number; newRevenue30d: number; cancelled30d: number;
  byTier: Record<string, number>; byProvider: Record<string, number>;
  prices: Record<string, number>;
}

interface Health {
  status: string; latencyMs: number; version: string;
  checks: Record<string, string>;
}

interface UserDetail {
  user: UserRow & { username?: string; last_login?: string; onboarding_completed?: boolean; subscription_expires_at?: string; created_at: string };
  subscriptions: SubRow[];
  auditLogs: AuditRow[];
  dietPlans: { id: string; name: string; is_active: boolean; total_calories?: number; created_at: string }[];
  workouts: { id: string; name: string; is_active: boolean; goal?: string; created_at: string }[];
  chatCount: number;
}

interface Social { followers: number; following: number; postsTotal: number; }

type Tab = "dashboard" | "users" | "subs" | "retention" | "analytics" | "logs";

// ── UI helpers ──────────────────────────────────────────────────────────────

const C = {
  bg: "#080808", card: "rgba(255,255,255,0.035)", border: "rgba(255,255,255,0.08)",
  text: "#f4f4f5", dim: "rgba(255,255,255,0.4)", dim2: "rgba(255,255,255,0.28)",
  blue: "#2563EB", gold: "#FFD60A", green: "#30D158", red: "#FF3B30", teal: "#00C2C0", amber: "#f59e0b",
};

function StatCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}15`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.dim }}>{label}</div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: C.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.dim2, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 6, background: `${color}20`, color, border: `1px solid ${color}35`, whiteSpace: "nowrap" }}>{text}</span>
  );
}

function IconBtn({ icon, label, color, onClick, disabled }: { icon: React.ReactNode; label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} style={{
      display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32,
      borderRadius: 8, background: `${color}12`, border: `1px solid ${color}25`, cursor: disabled ? "not-allowed" : "pointer",
      color, opacity: disabled ? 0.4 : 1, transition: "all 0.15s", flexShrink: 0,
    }}>{icon}</button>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const premium = tier === "premium" || tier === "annual" || tier === "corporate";
  return <Badge text={(tier || "free").toUpperCase()} color={premium ? C.gold : "#8899a6"} />;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children, width = 480 }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: 20, border: `1px solid ${C.border}`, width: "100%", maxWidth: width, maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: "#111113", zIndex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
  borderRadius: 10, padding: "11px 14px", color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none",
};
const btnPrimary: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
  background: C.blue, border: "none", borderRadius: 10, padding: "12px", color: "#fff",
  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};

// ── Bar chart (CSS) ─────────────────────────────────────────────────────────

function BarChart({ data, color, label }: { data: Record<string, number>; color: string; label: string }) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 140 }}>
        {entries.map(([day, v]) => (
          <div key={day} title={`${day}: ${v}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
            <div style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 4 : 0, background: color, borderRadius: 3, transition: "height 0.3s" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: C.dim2 }}>
        <span>{entries[0]?.[0]?.slice(5)}</span>
        <span>{entries[entries.length - 1]?.[0]?.slice(5)}</span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, token, clearAuth, loadFromStorage, isLoading } = useAuthStore();

  const [tab, setTab] = useState<Tab>("dashboard");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [analytics, setAnalytics] = useState<{ registrationsPerDay: Record<string, number>; subsPerDay: Record<string, number> } | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [trials, setTrials] = useState<SubRow[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [notifyUser, setNotifyUser] = useState<UserRow | null>(null);
  const [massNotify, setMassNotify] = useState(false);
  const [confirmDel, setConfirmDel] = useState<UserRow | null>(null);
  const [detailUser, setDetailUser] = useState<UserRow | null>(null);

  const sseRef = useRef<EventSource | null>(null);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
  useEffect(() => {
    if (!isLoading) {
      if (!token) { router.replace("/login"); return; }
      if (user && user.role !== "admin") { toast.error("Acceso restringido"); router.replace("/home"); }
    }
  }, [isLoading, token, user, router]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [d, r, a, u, s, l, t, h] = await Promise.allSettled([
        admin.dashboard(), admin.getRevenue(), admin.analytics(),
        admin.getUsers({ limit: 100 }), admin.getSubscriptions({ limit: 100 }), admin.getAuditLogs({ limit: 100 }),
        admin.getTrials({ limit: 100 }), admin.health(),
      ]);
      if (d.status === "fulfilled") setDash(d.value.data?.data ?? null);
      if (r.status === "fulfilled") setRevenue(r.value.data?.data ?? null);
      if (a.status === "fulfilled") setAnalytics(a.value.data?.data ?? null);
      if (u.status === "fulfilled") setUsers(u.value.data?.data ?? []);
      if (s.status === "fulfilled") setSubs(s.value.data?.data ?? []);
      if (l.status === "fulfilled") setLogs(l.value.data?.data ?? []);
      if (t.status === "fulfilled") setTrials(t.value.data?.data ?? []);
      if (h.status === "fulfilled") setHealth(h.value.data?.data ?? null);
    } catch {
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token && user?.role === "admin") loadAll();
  }, [isLoading, token, user?.role, loadAll]);

  // ── Real-time SSE ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    const es = new EventSource(`${BACKEND}/admin/stream?token=${encodeURIComponent(token)}`);
    sseRef.current = es;
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "new_users") {
          toast.success(`Nuevo usuario: ${msg.payload?.[0]?.email ?? ""}`, { icon: "🆕" });
          loadAll();
        } else if (msg.type === "new_subscriptions") {
          toast.success(`Nueva suscripción ${msg.payload?.[0]?.tier ?? ""}`, { icon: "💳" });
          loadAll();
        } else if (msg.type === "new_audit_logs") {
          loadAll();
        }
      } catch { /* ignore */ }
    };
    return () => { es.close(); sseRef.current = null; setLive(false); };
  }, [token, user?.role, loadAll]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); await loadAll(); }
    catch (e: unknown) { toast.error((e as any)?.response?.data?.message ?? "Error"); }
  };

  const handleLogout = () => { clearAuth(); router.replace("/login"); };

  // Bulk actions
  const toggleSel = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const bulkAction = async (fn: (id: string) => Promise<unknown>, ok: string) => {
    const ids = [...selected].filter(id => id !== user?.id);
    if (ids.length === 0) return;
    let done = 0;
    for (const id of ids) { try { await fn(id); done++; } catch { /* skip */ } }
    toast.success(`${ok} (${done}/${ids.length})`);
    setSelected(new Set());
    await loadAll();
  };

  // KPIs derivados
  const kpis = (() => {
    const total = users.length || dash?.users.total || 0;
    const premium = users.filter(u => u.subscription_tier !== "free").length;
    const conversion = total ? (premium / total) * 100 : 0;
    const activeSubs = revenue?.byTier ? Object.values(revenue.byTier).reduce((a, b) => a + b, 0) : 0;
    const churn = activeSubs + (revenue?.cancelled30d ?? 0) > 0
      ? ((revenue?.cancelled30d ?? 0) / (activeSubs + (revenue?.cancelled30d ?? 0))) * 100 : 0;
    const avgPrice = premium && revenue ? (revenue.mrr / Math.max(1, activeSubs)) : 499;
    const ltv = churn > 0 ? avgPrice / (churn / 100) : avgPrice * 24;
    // usuarios en riesgo: sin login en 7+ días
    const now = Date.now();
    const atRisk = users.filter(u => {
      if (!u.last_login) return true;
      return now - new Date(u.last_login).getTime() > 7 * 864e5;
    });
    return { conversion, churn, ltv, atRisk };
  })();

  const doExport = async () => {
    try {
      const res = await fetch(admin.exportUsersUrl(), { headers: { Authorization: `Bearer ${token}` } });
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `zencrus-usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success("CSV exportado");
    } catch { toast.error("Error exportando"); }
  };

  const filteredUsers = users.filter(u => !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()));

  // ── Loading / auth pending ────────────────────────────────────────────────
  if (isLoading || (token && !user)) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${C.blue}`, borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
    </div>;
  }
  if (!token || (user && user.role !== "admin")) return null;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Resumen", icon: <LayoutDashboard size={16} /> },
    { id: "users", label: "Usuarios", icon: <Users size={16} /> },
    { id: "subs", label: "Suscripciones", icon: <CreditCard size={16} /> },
    { id: "retention", label: "Retención", icon: <HeartPulse size={16} /> },
    { id: "analytics", label: "Analíticas", icon: <BarChart3 size={16} /> },
    { id: "logs", label: "Registro", icon: <ScrollText size={16} /> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px", position: "sticky", top: 0, background: "rgba(8,8,8,0.9)", backdropFilter: "blur(12px)", zIndex: 50 }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Image src="/logo-blanco.png" alt="ZENCRUS" width={100} height={30} style={{ objectFit: "contain" }} />
            <div style={{ width: 1, height: 20, background: C.border }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 999, padding: "4px 12px" }}>
              <Shield size={13} color="#60a5fa" />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#60a5fa", letterSpacing: 1 }}>PANEL ADMIN</span>
            </div>
            {/* Live indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: live ? "rgba(48,209,88,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${live ? "rgba(48,209,88,0.3)" : C.border}`, borderRadius: 999, padding: "4px 10px" }}>
              <Radio size={12} color={live ? C.green : C.dim2} style={{ animation: live ? "pulse 1.5s infinite" : "none" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: live ? C.green : C.dim2 }}>{live ? "EN VIVO" : "OFFLINE"}</span>
            </div>
            {/* System health */}
            {health && (
              <div title={`DB: ${health.checks?.database} · ${health.latencyMs}ms · v${health.version}`} style={{ display: "flex", alignItems: "center", gap: 6, background: health.status === "ok" ? "rgba(48,209,88,0.1)" : "rgba(255,59,48,0.1)", border: `1px solid ${health.status === "ok" ? "rgba(48,209,88,0.3)" : "rgba(255,59,48,0.3)"}`, borderRadius: 999, padding: "4px 10px" }}>
                <Server size={12} color={health.status === "ok" ? C.green : C.red} />
                <span style={{ fontSize: 10, fontWeight: 700, color: health.status === "ok" ? C.green : C.red }}>{health.status === "ok" ? "SISTEMA OK" : "DEGRADADO"} · {health.latencyMs}ms</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.push("/home")} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: C.dim, fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
              <Zap size={13} /> App
            </button>
            <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: C.red, fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
              <LogOut size={14} /> Salir
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ maxWidth: 1360, margin: "0 auto", display: "flex", gap: 4, overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "none", border: "none",
              borderBottom: `2px solid ${tab === t.id ? C.blue : "transparent"}`, cursor: "pointer",
              color: tab === t.id ? C.text : C.dim, fontSize: 13, fontWeight: tab === t.id ? 700 : 500, fontFamily: "inherit", whiteSpace: "nowrap",
            }}>{t.icon}{t.label}</button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px" }}>
        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>{TABS.find(t => t.id === tab)?.label}</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setMassNotify(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 10, padding: "9px 14px", cursor: "pointer", color: "#a78bfa", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
              <Send size={13} /> Notificar a todos
            </button>
            <button onClick={doExport} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.3)", borderRadius: 10, padding: "9px 14px", cursor: "pointer", color: C.green, fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
              <Download size={13} /> Exportar CSV
            </button>
            <button onClick={loadAll} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 14px", cursor: "pointer", color: C.dim, fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
              <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Actualizar
            </button>
          </div>
        </div>

        {/* ═══ DASHBOARD ═══ */}
        {tab === "dashboard" && dash && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 20 }}>
              <StatCard icon={<Users size={20} color={C.blue} />} label="Total usuarios" value={dash.users.total} color={C.blue} sub={`${dash.users.active} activos · +${dash.users.new7d} esta semana`} />
              <StatCard icon={<Crown size={20} color={C.gold} />} label="Suscripciones" value={dash.subscriptions.active} color={C.gold} sub={`${dash.subscriptions.total} totales`} />
              <StatCard icon={<DollarSign size={20} color={C.green} />} label="MRR estimado" value={`$${revenue?.mrr ?? dash.subscriptions.monthlyRevenue}`} color={C.green} sub="ingreso mensual recurrente" />
              <StatCard icon={<TrendingUp size={20} color={C.teal} />} label="Nuevos (30d)" value={dash.users.new30d} color={C.teal} sub={`${dash.content.messages} mensajes · ${dash.content.workouts} rutinas`} />
            </div>
            {/* KPIs de negocio */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 20 }}>
              <StatCard icon={<Percent size={20} color="#a78bfa" />} label="Conversión a pago" value={`${kpis.conversion.toFixed(1)}%`} color="#a78bfa" sub="usuarios con plan de pago" />
              <StatCard icon={<TrendingDown size={20} color={C.red} />} label="Churn (30d)" value={`${kpis.churn.toFixed(1)}%`} color={C.red} sub="tasa de cancelación mensual" />
              <StatCard icon={<DollarSign size={20} color={C.green} />} label="LTV estimado" value={`$${Math.round(kpis.ltv).toLocaleString("es-MX")}`} color={C.green} sub="valor de vida del cliente" />
              <StatCard icon={<UserX size={20} color={C.amber} />} label="Usuarios en riesgo" value={kpis.atRisk.length} color={C.amber} sub="sin actividad en 7+ días" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }} className="grid-2">
              {/* Recent users */}
              <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Usuarios recientes</div>
                {dash.recentUsers.map(u => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{u.full_name || "—"}</div>
                      <div style={{ fontSize: 11, color: C.dim2 }}>{u.email}</div>
                    </div>
                    <TierBadge tier={u.subscription_tier} />
                  </div>
                ))}
              </div>
              {/* Recent activity */}
              <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Actividad reciente</div>
                {dash.recentLogs.length === 0 ? <div style={{ fontSize: 12, color: C.dim2 }}>Sin actividad</div> :
                  dash.recentLogs.map((l, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                      <ScrollText size={14} color={C.dim2} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{l.action.replace(/_/g, " ")}</div>
                        <div style={{ fontSize: 10, color: C.dim2 }}>{l.users?.email ?? "sistema"} · {new Date(l.created_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}

        {/* ═══ USERS ═══ */}
        {tab === "users" && (
          <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}` }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{filteredUsers.length} usuarios</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", minWidth: 240 }}>
                <Search size={15} color={C.dim2} />
                <input type="text" placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "none", border: "none", outline: "none", color: "#fff", fontSize: 13, fontFamily: "inherit", flex: 1 }} />
              </div>
            </div>
            {/* Bulk action bar */}
            {selected.size > 0 && (
              <div style={{ padding: "12px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "rgba(37,99,235,0.06)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>{selected.size} seleccionados</span>
                <button onClick={() => bulkAction((id) => admin.setUserStatus(id, false), "Desactivados")} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: C.amber, fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}><Ban size={13} /> Desactivar</button>
                <button onClick={() => bulkAction((id) => admin.setUserStatus(id, true), "Activados")} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.3)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: C.green, fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}><Play size={13} /> Activar</button>
                <button onClick={() => { if (confirm(`¿Eliminar ${selected.size} usuarios permanentemente?`)) bulkAction((id) => admin.deleteUser(id), "Eliminados"); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.3)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: C.red, fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}><Trash2 size={13} /> Eliminar</button>
                <button onClick={() => setSelected(new Set())} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, fontSize: 12, fontFamily: "inherit" }}>Limpiar</button>
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              {loading ? <div style={{ padding: 60, textAlign: "center", color: C.dim2 }}>Cargando...</div> :
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
                  <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: "12px 0 12px 18px", width: 20 }}>
                      <input type="checkbox" checked={selected.size > 0 && selected.size === filteredUsers.filter(u => u.id !== user?.id).length} onChange={e => setSelected(e.target.checked ? new Set(filteredUsers.filter(u => u.id !== user?.id).map(u => u.id)) : new Set())} style={{ cursor: "pointer", accentColor: C.blue }} />
                    </th>
                    {["Usuario", "Rol", "Plan", "Verif.", "Estado", "Registrado", "Acciones"].map(h =>
                      <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.dim2, letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: i < filteredUsers.length - 1 ? `1px solid ${C.border}` : "none", background: selected.has(u.id) ? "rgba(37,99,235,0.05)" : "transparent" }}>
                        <td style={{ padding: "12px 0 12px 18px" }}>
                          <input type="checkbox" checked={selected.has(u.id)} disabled={u.id === user?.id} onChange={() => toggleSel(u.id)} style={{ cursor: u.id === user?.id ? "not-allowed" : "pointer", accentColor: C.blue }} />
                        </td>
                        <td style={{ padding: "12px 18px", cursor: "pointer" }} onClick={() => setDetailUser(u)}>
                          <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{u.full_name || "—"} <Eye size={12} color={C.dim2} /></div>
                          <div style={{ fontSize: 11, color: C.dim2 }}>{u.email}</div>
                        </td>
                        <td style={{ padding: "12px 18px" }}><Badge text={(u.role || "user").toUpperCase()} color={u.role === "admin" ? C.blue : u.role === "nutritionist" ? C.teal : "#8899a6"} /></td>
                        <td style={{ padding: "12px 18px" }}><TierBadge tier={u.subscription_tier} /></td>
                        <td style={{ padding: "12px 18px" }}>{u.email_verified ? <CheckCircle size={16} color={C.green} /> : <XCircle size={16} color="rgba(255,59,48,0.5)" />}</td>
                        <td style={{ padding: "12px 18px" }}>{u.is_active ? <Badge text="ACTIVO" color={C.green} /> : <Badge text="INACTIVO" color={C.red} />}</td>
                        <td style={{ padding: "12px 18px", fontSize: 12, color: C.dim2, whiteSpace: "nowrap" }}>{new Date(u.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                        <td style={{ padding: "12px 18px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <IconBtn icon={<UserCog size={15} />} label="Editar rol / plan" color={C.blue} onClick={() => setEditUser(u)} />
                            <IconBtn icon={u.is_active ? <Ban size={15} /> : <Play size={15} />} label={u.is_active ? "Desactivar" : "Activar"} color={u.is_active ? C.amber : C.green} onClick={() => act(() => admin.setUserStatus(u.id, !u.is_active), u.is_active ? "Usuario desactivado" : "Usuario activado")} />
                            {(u.failed_login_attempts ?? 0) > 0 && <IconBtn icon={<Unlock size={15} />} label="Desbloquear" color={C.teal} onClick={() => act(() => admin.unlockUser(u.id), "Cuenta desbloqueada")} />}
                            <IconBtn icon={<Mail size={15} />} label="Enviar email" color="#a78bfa" onClick={() => setNotifyUser(u)} />
                            <IconBtn icon={<Trash2 size={15} />} label="Eliminar" color={C.red} onClick={() => setConfirmDel(u)} disabled={u.id === user?.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
            </div>
          </div>
        )}

        {/* ═══ SUBSCRIPTIONS ═══ */}
        {tab === "subs" && (
          <>
            {revenue && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 20 }}>
              <StatCard icon={<DollarSign size={20} color={C.green} />} label="MRR" value={`$${revenue.mrr}`} color={C.green} sub="mensual recurrente" />
              <StatCard icon={<TrendingUp size={20} color={C.blue} />} label="Ingreso 30d" value={`$${revenue.newRevenue30d}`} color={C.blue} sub="nuevos en 30 días" />
              <StatCard icon={<XCircle size={20} color={C.red} />} label="Cancelados 30d" value={revenue.cancelled30d} color={C.red} sub="bajas recientes" />
              <StatCard icon={<Crown size={20} color={C.gold} />} label="Premium activos" value={revenue.byTier.premium ?? 0} color={C.gold} sub="suscripciones premium" />
            </div>}
            <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}` }}>
              <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, fontSize: 15, fontWeight: 800 }}>{subs.length} suscripciones</div>
              <div style={{ overflowX: "auto" }}>
                {subs.length === 0 ? <div style={{ padding: 50, textAlign: "center", color: C.dim2, fontSize: 13 }}>Sin suscripciones</div> :
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Usuario", "Plan", "Estado", "Método", "Vence", "Acciones"].map(h => <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.dim2, letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {subs.map((s, i) => (
                        <tr key={s.id} style={{ borderBottom: i < subs.length - 1 ? `1px solid ${C.border}` : "none" }}>
                          <td style={{ padding: "12px 18px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{s.users?.full_name || "—"}</div>
                            <div style={{ fontSize: 11, color: C.dim2 }}>{s.users?.email}</div>
                          </td>
                          <td style={{ padding: "12px 18px" }}><TierBadge tier={s.tier} /></td>
                          <td style={{ padding: "12px 18px" }}><Badge text={s.status.toUpperCase()} color={s.status === "active" ? C.green : s.status === "cancelled" ? C.red : C.amber} /></td>
                          <td style={{ padding: "12px 18px", fontSize: 12, color: C.dim }}>{s.payment_provider === "none" ? "Trial/Manual" : s.payment_provider}</td>
                          <td style={{ padding: "12px 18px", fontSize: 12, color: C.dim2, whiteSpace: "nowrap" }}>{s.end_date ? new Date(s.end_date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}</td>
                          <td style={{ padding: "12px 18px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <IconBtn icon={<Calendar size={15} />} label="Extender 30 días" color={C.blue} onClick={() => act(() => admin.extendSubscription(s.id, 30), "Extendida 30 días")} />
                              <IconBtn icon={<Ban size={15} />} label="Cancelar" color={C.red} onClick={() => act(() => admin.cancelSubscription(s.id), "Suscripción cancelada")} disabled={s.status === "cancelled"} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>}
              </div>
            </div>
          </>
        )}

        {/* ═══ RETENTION ═══ */}
        {tab === "retention" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="grid-2">
            {/* Trials por vencer */}
            <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}` }}>
              <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={16} color={C.amber} />
                <span style={{ fontSize: 15, fontWeight: 800 }}>Trials / pruebas ({trials.length})</span>
              </div>
              <div style={{ maxHeight: 480, overflowY: "auto" }}>
                {trials.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: C.dim2, fontSize: 13 }}>Sin pruebas activas</div> :
                  trials.map(t => {
                    const daysLeft = t.end_date ? Math.ceil((new Date(t.end_date).getTime() - Date.now()) / 864e5) : 0;
                    return (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 22px", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.users?.full_name || "—"}</div>
                          <div style={{ fontSize: 11, color: C.dim2 }}>{t.users?.email}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <Badge text={daysLeft <= 0 ? "VENCIDO" : `${daysLeft}d`} color={daysLeft <= 2 ? C.red : daysLeft <= 5 ? C.amber : C.green} />
                          <IconBtn icon={<Calendar size={14} />} label="Extender 30 días" color={C.blue} onClick={() => act(() => admin.extendSubscription(t.id, 30), "Extendida 30 días")} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            {/* Usuarios en riesgo */}
            <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}` }}>
              <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <UserX size={16} color={C.red} />
                <span style={{ fontSize: 15, fontWeight: 800 }}>En riesgo de fuga ({kpis.atRisk.length})</span>
              </div>
              <div style={{ maxHeight: 480, overflowY: "auto" }}>
                {kpis.atRisk.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: C.dim2, fontSize: 13 }}>Todos activos 🎉</div> :
                  kpis.atRisk.map(u => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 22px", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name || "—"}</div>
                        <div style={{ fontSize: 11, color: C.dim2 }}>{u.last_login ? `Último acceso ${new Date(u.last_login).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}` : "Nunca ingresó"}</div>
                      </div>
                      <IconBtn icon={<Mail size={14} />} label="Reactivar por email" color="#a78bfa" onClick={() => setNotifyUser(u)} />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ANALYTICS ═══ */}
        {tab === "analytics" && analytics && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="grid-2">
            <BarChart data={analytics.registrationsPerDay} color={C.blue} label="Registros por día (30d)" />
            <BarChart data={analytics.subsPerDay} color={C.gold} label="Suscripciones por día (30d)" />
            {revenue && <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Distribución por plan</div>
              {Object.entries(revenue.byTier).map(([tier, count]) => {
                const total = Object.values(revenue.byTier).reduce((a, b) => a + b, 0) || 1;
                return (
                  <div key={tier} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                      <span style={{ textTransform: "capitalize" }}>{tier}</span><span style={{ color: C.dim }}>{count} · ${(revenue.prices[tier] ?? 0) * count}/mes</span>
                    </div>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(count / total) * 100}%`, height: "100%", background: C.gold, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        )}

        {/* ═══ LOGS ═══ */}
        {tab === "logs" && (
          <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}` }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, fontSize: 15, fontWeight: 800 }}>Registro de auditoría ({logs.length})</div>
            <div style={{ overflowX: "auto" }}>
              {logs.length === 0 ? <div style={{ padding: 50, textAlign: "center", color: C.dim2, fontSize: 13 }}>Sin registros</div> :
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["Acción", "Usuario", "Detalles", "Fecha"].map(h => <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.dim2, letterSpacing: 1 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {logs.map((l, i) => (
                      <tr key={l.id ?? i} style={{ borderBottom: i < logs.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <td style={{ padding: "12px 18px" }}><Badge text={l.action.replace(/admin_/g, "").replace(/_/g, " ")} color={l.action.includes("delete") ? C.red : l.action.includes("role") ? C.blue : C.dim} /></td>
                        <td style={{ padding: "12px 18px", fontSize: 12 }}>{l.users?.email ?? "sistema"}</td>
                        <td style={{ padding: "12px 18px", fontSize: 11, color: C.dim2, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.metadata ? JSON.stringify(l.metadata) : "—"}</td>
                        <td style={{ padding: "12px 18px", fontSize: 12, color: C.dim2, whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
            </div>
          </div>
        )}
      </main>

      {/* ═══ MODALS ═══ */}

      {/* User detail */}
      <Modal open={!!detailUser} onClose={() => setDetailUser(null)} title={detailUser?.full_name || detailUser?.email || "Detalle"} width={620}>
        {detailUser && <UserDetailView u={detailUser} onAction={loadAll} onEdit={() => { setEditUser(detailUser); setDetailUser(null); }} onNotify={() => { setNotifyUser(detailUser); setDetailUser(null); }} />}
      </Modal>

      {/* Edit user role + plan */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Editar: ${editUser?.full_name || editUser?.email || ""}`}>
        {editUser && <EditUserForm u={editUser} onDone={async () => { setEditUser(null); await loadAll(); }} />}
      </Modal>

      {/* Notify single user */}
      <Modal open={!!notifyUser} onClose={() => setNotifyUser(null)} title={`Enviar email a ${notifyUser?.email ?? ""}`}>
        {notifyUser && <NotifyForm onSend={async (subject, message) => {
          await act(() => admin.notifyUser(notifyUser.id, subject, message), "Notificación enviada");
          setNotifyUser(null);
        }} />}
      </Modal>

      {/* Mass notify */}
      <Modal open={massNotify} onClose={() => setMassNotify(false)} title="Notificar a todos los usuarios">
        <NotifyForm mass onSend={async (subject, message, tier) => {
          await act(() => admin.notifyAll(subject, message, tier), "Notificación masiva enviada");
          setMassNotify(false);
        }} />
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Eliminar usuario" width={420}>
        {confirmDel && <div>
          <div style={{ display: "flex", gap: 12, padding: 14, background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 12, marginBottom: 18 }}>
            <AlertTriangle size={20} color={C.red} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }}>Esto elimina <b>{confirmDel.email}</b> de forma <b>permanente</b>. No se puede deshacer.</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setConfirmDel(null)} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.dim, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
            <button onClick={async () => { const id = confirmDel.id; setConfirmDel(null); await act(() => admin.deleteUser(id), "Usuario eliminado"); }} style={{ flex: 1, background: C.red, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Eliminar</button>
          </div>
        </div>}
      </Modal>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @media (max-width: 860px) { .grid-2 { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

// ── Edit user form ──────────────────────────────────────────────────────────

function EditUserForm({ u, onDone }: { u: UserRow; onDone: () => void }) {
  const [role, setRole] = useState(u.role || "user");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (role !== u.role) await admin.setUserRole(u.id, role);
      toast.success("Cambios guardados");
      onDone();
    } catch (e: unknown) {
      toast.error((e as any)?.response?.data?.message ?? "Error guardando");
    } finally { setSaving(false); }
  };

  const roles = [
    { v: "user", label: "Usuario", color: "#8899a6", icon: <Users size={15} /> },
    { v: "nutritionist", label: "Nutriólogo", color: C.teal, icon: <ShieldCheck size={15} /> },
    { v: "admin", label: "Administrador", color: C.blue, icon: <Shield size={15} /> },
  ];

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.dim, marginBottom: 10, letterSpacing: 0.5 }}>ROL DEL USUARIO</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
        {roles.map(r => (
          <button key={r.v} onClick={() => setRole(r.v)} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
            background: role === r.v ? `${r.color}18` : "rgba(255,255,255,0.03)",
            border: `1px solid ${role === r.v ? `${r.color}50` : C.border}`,
            color: role === r.v ? r.color : C.dim, fontSize: 14, fontWeight: role === r.v ? 700 : 500, textAlign: "left",
          }}>
            {r.icon}<span style={{ flex: 1 }}>{r.label}</span>
            {role === r.v && <CheckCircle size={16} color={r.color} />}
          </button>
        ))}
      </div>
      <button onClick={save} disabled={saving || role === u.role} style={{ ...btnPrimary, opacity: saving || role === u.role ? 0.5 : 1 }}>
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}

// ── User detail view ────────────────────────────────────────────────────────

function UserDetailView({ u, onEdit, onNotify }: { u: UserRow; onAction: () => void; onEdit: () => void; onNotify: () => void }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [social, setSocial] = useState<Social | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [d, s] = await Promise.allSettled([admin.getUserDetail(u.id), admin.getUserSocial(u.id)]);
        if (d.status === "fulfilled") setDetail(d.value.data?.data ?? null);
        if (s.status === "fulfilled") setSocial(s.value.data?.data ?? null);
      } finally { setLoading(false); }
    })();
  }, [u.id]);

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: C.dim2 }}>Cargando perfil...</div>;

  const info = detail?.user ?? u;
  const chip = (icon: React.ReactNode, label: string, value: string | number) => (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.dim2, marginBottom: 6 }}>{icon}{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{value}</div>
    </div>
  );

  return (
    <div>
      {/* Header info */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#60a5fa" }}>
          {(info.full_name || info.email || "?").slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{info.full_name || "—"}</div>
          <div style={{ fontSize: 12, color: C.dim }}>{info.email}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <Badge text={(info.role || "user").toUpperCase()} color={info.role === "admin" ? C.blue : "#8899a6"} />
            <TierBadge tier={info.subscription_tier} />
            {info.email_verified ? <Badge text="VERIFICADO" color={C.green} /> : <Badge text="SIN VERIFICAR" color={C.red} />}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 18 }}>
        {chip(<MessageSquare size={12} />, "Chats", detail?.chatCount ?? 0)}
        {chip(<HeartPulse size={12} />, "Dietas", detail?.dietPlans?.length ?? 0)}
        {chip(<Dumbbell size={12} />, "Rutinas", detail?.workouts?.length ?? 0)}
        {chip(<Users size={12} />, "Seguidores", social?.followers ?? 0)}
        {chip(<Activity size={12} />, "Posts", social?.postsTotal ?? 0)}
        {chip(<Clock size={12} />, "Último acceso", info.last_login ? new Date(info.last_login).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "Nunca")}
      </div>

      {/* Meta */}
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>
        Registrado: {new Date(info.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
        {detail?.user?.onboarding_completed !== undefined && <span> · Onboarding: {detail.user.onboarding_completed ? "✅ completado" : "⏳ pendiente"}</span>}
      </div>

      {/* Subscriptions history */}
      {detail?.subscriptions && detail.subscriptions.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.dim, marginBottom: 8 }}>SUSCRIPCIONES</div>
          {detail.subscriptions.map(s => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span><TierBadge tier={s.tier} /> <span style={{ color: C.dim, marginLeft: 6 }}>{s.status}</span></span>
              <span style={{ color: C.dim2 }}>{s.end_date ? new Date(s.end_date).toLocaleDateString("es-MX") : ""}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onEdit} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 10, padding: 12, color: "#60a5fa", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><UserCog size={15} /> Editar rol</button>
        <button onClick={onNotify} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 10, padding: 12, color: "#a78bfa", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Mail size={15} /> Enviar email</button>
      </div>
    </div>
  );
}

// ── Notify form ─────────────────────────────────────────────────────────────

function NotifyForm({ onSend, mass }: { onSend: (subject: string, message: string, tier?: string) => Promise<void>; mass?: boolean }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tier, setTier] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!subject.trim() || !message.trim()) { toast.error("Completa asunto y mensaje"); return; }
    setSending(true);
    try { await onSend(subject, message, tier || undefined); }
    finally { setSending(false); }
  };

  return (
    <div>
      {mass && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.dim, marginBottom: 8 }}>DESTINATARIOS</div>
          <select value={tier} onChange={e => setTier(e.target.value)} style={{ ...inputStyle, marginBottom: 16, cursor: "pointer" }}>
            <option value="">Todos los usuarios activos</option>
            <option value="free">Solo plan Free</option>
            <option value="premium">Solo Premium</option>
          </select>
        </>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.dim, marginBottom: 8 }}>ASUNTO</div>
      <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto del email" style={{ ...inputStyle, marginBottom: 16 }} />
      <div style={{ fontSize: 12, fontWeight: 700, color: C.dim, marginBottom: 8 }}>MENSAJE</div>
      <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Escribe tu mensaje..." rows={5} style={{ ...inputStyle, marginBottom: 18, resize: "vertical" }} />
      <button onClick={send} disabled={sending} style={{ ...btnPrimary, background: "#a78bfa", opacity: sending ? 0.5 : 1 }}>
        <Send size={15} />{sending ? "Enviando..." : mass ? "Enviar a todos" : "Enviar email"}
      </button>
    </div>
  );
}
