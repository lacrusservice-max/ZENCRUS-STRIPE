"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import {
  LayoutDashboard, Bot, Apple, Users, User, Dumbbell, TrendingUp,
  LogOut, ShieldCheck, CalendarDays, BookOpen, ShoppingCart,
  Ruler, HeartPulse, Repeat, CalendarHeart, Trophy, Swords, BarChart3,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/home",         label: "Inicio",       icon: LayoutDashboard },
  { href: "/chat",         label: "Coach IA",     icon: Bot },
  { href: "/nutrition",    label: "Nutrición",    icon: Apple },
  { href: "/meal-planner", label: "Planificador", icon: CalendarDays },
  { href: "/recipes",      label: "Recetas",      icon: BookOpen },
  { href: "/grocery",      label: "Compras",      icon: ShoppingCart },
  { href: "/workout",      label: "Entreno",      icon: Dumbbell },
  { href: "/progress",     label: "Progreso",     icon: TrendingUp },
  { href: "/social",       label: "Comunidad",    icon: Users },
  { href: "/profile",      label: "Perfil",       icon: User },
];

const MORE_ITEMS = [
  { href: "/measurements",  label: "Medidas",       icon: Ruler },
  { href: "/health-tracker",label: "Salud diaria",  icon: HeartPulse },
  { href: "/macro-cycling", label: "Ciclo de macros", icon: Repeat },
  { href: "/menstrual",     label: "Ciclo menstrual", icon: CalendarHeart },
  { href: "/achievements",  label: "Logros",        icon: Trophy },
  { href: "/duels",         label: "Duelos",        icon: Swords },
  { href: "/leaderboard",   label: "Leaderboard",   icon: BarChart3 },
];

function LoadingScreen() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0a0a0a" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #2563EB", borderTopColor: "transparent", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Cargando...</p>
      </div>
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const token = localStorage.getItem("zencrus_token");
        if (!token) return;
        const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(b64));
        if (payload?.role === "admin") { setIsAdmin(true); return; }
        const res = await fetch("/api/proxy/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const u = data?.data ?? data;
          if (u?.role === "admin") setIsAdmin(true);
        }
      } catch { /* ignore */ }
    };
    checkAdmin();
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  return (
    <aside style={{
      width: 240,
      height: "100vh",
      position: "fixed",
      top: 0,
      left: 0,
      background: "rgba(20,20,20,0.98)",
      borderRight: "1px solid #2c2c2e",
      display: "flex",
      flexDirection: "column",
      zIndex: 40,
    }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid #2c2c2e" }}>
        <Image src="/logo-blanco.png" alt="ZENCRUS" width={140} height={40} style={{ objectFit: "contain" }} priority />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/home" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 12,
              background: active ? "#2563EB" : "transparent",
              color: active ? "#fff" : "rgba(255,255,255,0.55)",
              fontWeight: active ? 700 : 500,
              fontSize: 14,
              transition: "all 0.15s",
              cursor: "pointer",
            }}>
              <Icon size={18} style={{ flexShrink: 0 }} />
              {label}
            </Link>
          );
        })}

        {/* Secondary features */}
        <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.28)", letterSpacing: 1.5, padding: "14px 14px 6px" }}>MÁS</div>
        {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href);
          return (
            <Link key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12,
              background: active ? "#2563EB" : "transparent",
              color: active ? "#fff" : "rgba(255,255,255,0.55)",
              fontWeight: active ? 700 : 500, fontSize: 14, transition: "all 0.15s", cursor: "pointer",
            }}>
              <Icon size={18} style={{ flexShrink: 0 }} />
              {label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div style={{ height: 1, background: "#2c2c2e", margin: "8px 4px" }} />
            <Link href="/admin" style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", borderRadius: 12,
              background: pathname.startsWith("/admin") ? "#f59e0b" : "rgba(245,158,11,0.08)",
              color: pathname.startsWith("/admin") ? "#0a0a0a" : "#f59e0b",
              border: "1px solid rgba(245,158,11,0.3)",
              fontWeight: 700, fontSize: 14, transition: "all 0.15s", cursor: "pointer",
            }}>
              <ShieldCheck size={18} style={{ flexShrink: 0 }} />
              Panel Admin
            </Link>
          </>
        )}
      </nav>

      {/* User + logout */}
      <div style={{ padding: "12px 10px 20px", borderTop: "1px solid #2c2c2e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(37,99,235,0.25)",
            border: "1px solid rgba(37,99,235,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: "#60a5fa", flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f4f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.fullName ?? "Usuario"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              @{user?.username ?? ""}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
            borderRadius: 12, background: "transparent", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.35)", fontSize: 13, width: "100%",
            transition: "color 0.15s",
          }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  // Show only first 5 items in mobile nav
  const items = NAV_ITEMS.slice(0, 5);
  return (
    <nav style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      background: "rgba(11,11,15,0.97)",
      borderTop: "1px solid rgba(255,255,255,0.07)",
      display: "flex",
      justifyContent: "space-around",
      padding: "8px 0 max(8px, env(safe-area-inset-bottom))",
      zIndex: 40,
    }}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href);
        return (
          <Link key={href} href={href} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "4px 12px", borderRadius: 10,
            color: active ? "#2563EB" : "rgba(255,255,255,0.4)",
            minWidth: 56,
          }}>
            <Icon size={22} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, isLoading, loadFromStorage } = useAuthStore();
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login");
    }
  }, [isLoading, token, router]);

  // Nadie usa la app sin un plan activo (o prueba de 5 días con tarjeta ya registrada) — excepto admins
  useEffect(() => {
    if (isLoading || !token) return;
    if (pathname === "/subscription" || user?.role === "admin") { setCheckingPlan(false); setHasAccess(true); return; }
    let cancelled = false;
    import("@/lib/api").then(({ subscriptions }) =>
      subscriptions.getStatus()
        .then((r) => { if (!cancelled) setHasAccess(r.data?.data?.tier && r.data.data.tier !== "free"); })
        .catch(() => { if (!cancelled) setHasAccess(false); })
        .finally(() => { if (!cancelled) setCheckingPlan(false); })
    );
    return () => { cancelled = true; };
  }, [isLoading, token, pathname, user?.role]);

  useEffect(() => {
    if (!checkingPlan && !hasAccess && pathname !== "/subscription") {
      router.replace("/subscription");
    }
  }, [checkingPlan, hasAccess, pathname, router]);

  if (isLoading) return <LoadingScreen />;
  if (!token) return null;
  if (checkingPlan) return <LoadingScreen />;
  if (!hasAccess && pathname !== "/subscription") return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a" }}>
      {/* Sidebar — desktop only */}
      <div style={{ display: "none" }} className="md-sidebar">
        <Sidebar pathname={pathname} />
      </div>

      <style>{`
        @media (min-width: 768px) {
          .md-sidebar { display: block !important; }
          .md-content { margin-left: 240px !important; }
          .mobile-nav { display: none !important; }
        }
      `}</style>

      {/* Main content */}
      <main className="md-content" style={{
        flex: 1,
        minWidth: 0,
        paddingBottom: 80,
      }}>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <div className="mobile-nav">
        <MobileBottomNav pathname={pathname} />
      </div>
    </div>
  );
}
