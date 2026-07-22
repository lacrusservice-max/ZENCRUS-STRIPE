"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

export default function CheckoutSuccess() {
  useEffect(() => {
    const t = setTimeout(() => { window.location.href = "/home"; }, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#08090c", color: "#f4f5f7", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 0 40px rgba(30,58,138,0.5)" }}>
          <Check size={34} color="#fff" strokeWidth={3} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 12 }}>¡Pago confirmado!</h1>
        <p style={{ fontSize: 15, color: "#9aa3b2", lineHeight: 1.6, marginBottom: 28 }}>
          Tu suscripción Premium está activa. ZENA ya está aplicando todos los módulos científicos a tu plan.
        </p>
        <Link href="/home" style={{ display: "inline-block", background: "#1e3a8a", color: "#fff", textDecoration: "none", padding: "13px 28px", borderRadius: 12, fontWeight: 800, fontSize: 14 }}>
          Ir a mi plan
        </Link>
        <p style={{ fontSize: 12, color: "#5f6875", marginTop: 18 }}>Te redirigimos automáticamente…</p>
      </div>
    </div>
  );
}
