"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bot, Apple, Users, User } from "lucide-react";

const navItems = [
  { href: "/app/dashboard", icon: LayoutDashboard, label: "Inicio" },
  { href: "/app/chat", icon: Bot, label: "IA" },
  { href: "/app/nutrition", icon: Apple, label: "Nutrición" },
  { href: "/app/social", icon: Users, label: "Social" },
  { href: "/app/profile", icon: User, label: "Perfil" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "8px 12px",
        background: "rgba(10,10,20,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 99,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {navItems.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "6px 14px",
              borderRadius: 99,
              textDecoration: "none",
              background: isActive ? "rgba(91,79,255,0.2)" : "transparent",
              transition: "all 0.15s",
            }}
          >
            <Icon
              size={20}
              style={{ color: isActive ? "#5b4fff" : "#94a3b8" }}
            />
            <span
              style={{
                fontSize: 10,
                color: isActive ? "#f1f5f9" : "#94a3b8",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
