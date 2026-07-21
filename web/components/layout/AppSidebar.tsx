"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Apple,
  Users,
  User,
  LogOut,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { auth } from "@/lib/api";
import toast from "react-hot-toast";

const navItems = [
  { href: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/app/chat", icon: Bot, label: "Chat IA" },
  { href: "/app/nutrition", icon: Apple, label: "Nutrición" },
  { href: "/app/social", icon: Users, label: "Social" },
  { href: "/app/profile", icon: User, label: "Perfil" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try {
      await auth.logout();
    } catch {
      // ignore
    }
    clearAuth();
    toast.success("Sesión cerrada");
    router.push("/login");
  };

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "Z";

  return (
    <aside
      style={{
        width: 260,
        minHeight: "100vh",
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "24px 20px 16px" }}>
        <Link href="/app/dashboard" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #5b4fff, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={18} color="#fff" fill="#fff" />
            </div>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "-0.3px",
                background: "linear-gradient(135deg, #5b4fff, #2563eb)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ZENCRUS
            </span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                textDecoration: "none",
                color: isActive ? "#f1f5f9" : "#94a3b8",
                background: isActive
                  ? "rgba(91,79,255,0.15)"
                  : "transparent",
                boxShadow: isActive ? "0 0 16px rgba(91,79,255,0.15)" : "none",
                border: isActive ? "1px solid rgba(91,79,255,0.25)" : "1px solid transparent",
                transition: "all 0.15s",
                fontWeight: isActive ? 600 : 400,
                fontSize: 14,
              }}
            >
              <Icon
                size={18}
                style={{ color: isActive ? "#5b4fff" : "#94a3b8", flexShrink: 0 }}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div
        style={{
          padding: "12px 16px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #5b4fff, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.fullName || "Usuario"}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              @{user?.username || ""}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: 13,
            width: "100%",
            fontFamily: "inherit",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
