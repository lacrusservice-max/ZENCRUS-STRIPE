"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Crown, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { subscriptions } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";

const freePlan = [
  "Plan de nutrición básico",
  "1 semana de comidas",
  "Chat con IA (5 msg/día)",
  "Seguimiento de macros",
  "Acceso a comunidad",
];

const premiumPlan = [
  "Todo de Free incluido",
  "Plan de nutrición ilimitado",
  "Chat con IA ilimitado",
  "Planes de ejercicio personalizados",
  "Análisis de progreso avanzado",
  "Recetas exclusivas premium",
  "Soporte prioritario 24/7",
];

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tier: string; cancelAt?: string } | null>(null);

  useEffect(() => {
    subscriptions.getStatus()
      .then((res) => setStatus(res.data))
      .catch(() => setStatus({ tier: user?.subscriptionTier || "free" }));
  }, [user]);

  const handleCheckout = async (plan: "monthly" | "annual") => {
    setLoading(plan);
    try {
      const priceId = plan === "monthly" ? "price_monthly_mxn" : "price_annual_mxn";
      const res = await subscriptions.createSession(priceId);
      const url = res.data?.url || res.data?.checkoutUrl;
      if (url) {
        window.location.href = url;
      } else {
        toast.error("No se pudo iniciar el pago");
      }
    } catch {
      toast.error("Error al iniciar el pago. Intenta de nuevo.");
    } finally {
      setLoading(null);
    }
  };

  const isPremium = user?.subscriptionTier === "premium" || user?.subscriptionTier === "annual";

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, marginBottom: 8 }}>
          {isPremium ? "Tu suscripción Premium" : "Elige tu plan"}
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 16 }}>
          {isPremium
            ? "Gracias por ser parte de ZENCRUS Premium."
            : "Empieza gratis, escala cuando estés listo."}
        </p>
      </div>

      {/* Billing toggle (only if not premium) */}
      {!isPremium && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: 4,
              gap: 4,
            }}
          >
            {(["monthly", "annual"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 9,
                  border: "none",
                  background: billing === b ? "rgba(91,79,255,0.2)" : "transparent",
                  color: billing === b ? "#f1f5f9" : "#94a3b8",
                  fontSize: 14,
                  fontWeight: billing === b ? 700 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  position: "relative",
                }}
              >
                {b === "monthly" ? "Mensual" : "Anual"}
                {b === "annual" && (
                  <span
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      background: "#22c55e",
                      color: "#fff",
                      fontSize: 9,
                      padding: "2px 6px",
                      borderRadius: 99,
                      fontWeight: 700,
                    }}
                  >
                    -37%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Plans */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* Free */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${user?.subscriptionTier === "free" ? "rgba(148,163,184,0.4)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 20,
            padding: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Zap size={18} color="#94a3b8" />
            <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>FREE</span>
            {user?.subscriptionTier === "free" && (
              <span style={{ fontSize: 11, background: "rgba(148,163,184,0.15)", color: "#94a3b8", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>
                Tu plan actual
              </span>
            )}
          </div>
          <div style={{ fontSize: 44, fontWeight: 900, marginBottom: 4 }}>$0</div>
          <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 28 }}>Para siempre</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
            {freePlan.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <CheckCircle size={16} color="#22c55e" />
                {f}
              </div>
            ))}
          </div>
          <Button variant="secondary" fullWidth disabled={user?.subscriptionTier === "free"}>
            {user?.subscriptionTier === "free" ? "Plan actual" : "Versión básica"}
          </Button>
        </div>

        {/* Premium */}
        <div
          style={{
            background: "rgba(91,79,255,0.1)",
            border: `1px solid ${isPremium ? "rgba(91,79,255,0.5)" : "rgba(91,79,255,0.3)"}`,
            borderRadius: 20,
            padding: 32,
            position: "relative",
          }}
        >
          {!isPremium && (
            <div
              style={{
                position: "absolute",
                top: -13,
                left: "50%",
                transform: "translateX(-50%)",
                background: "linear-gradient(135deg, #5b4fff, #2563eb)",
                color: "#fff",
                padding: "4px 16px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              MAS POPULAR
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Crown size={18} color="#5b4fff" />
            <span style={{ fontSize: 13, color: "#a78bfa", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>PREMIUM</span>
            {isPremium && (
              <span style={{ fontSize: 11, background: "rgba(91,79,255,0.2)", color: "#a78bfa", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>
                Tu plan actual
              </span>
            )}
          </div>
          <div style={{ fontSize: 44, fontWeight: 900, marginBottom: 4 }}>
            <span className="gradient-text">
              {billing === "monthly" ? "$199" : "$125"}
            </span>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 28 }}>
            {billing === "monthly"
              ? "MXN / mes"
              : "MXN / mes · $1,499 al año"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
            {premiumPlan.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <CheckCircle size={16} color="#5b4fff" />
                {f}
              </div>
            ))}
          </div>
          {isPremium ? (
            <Button variant="secondary" fullWidth disabled>
              Plan activo
            </Button>
          ) : (
            <Button
              fullWidth
              size="lg"
              loading={loading === billing}
              onClick={() => handleCheckout(billing)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Crown size={16} />
              {billing === "monthly" ? "Suscribirse por $199/mes" : "Suscribirse por $1,499/año"}
            </Button>
          )}
          <p style={{ textAlign: "center", fontSize: 12, color: "#64748b", marginTop: 12 }}>
            Cancela cuando quieras · Sin contratos
          </p>
        </div>
      </div>

      {/* Comparison table */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "24px",
          overflowX: "auto",
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Comparación de planes</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Función</th>
              <th style={{ textAlign: "center", padding: "8px 12px", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Free</th>
              <th style={{ textAlign: "center", padding: "8px 12px", color: "#a78bfa", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Premium</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Plan de nutrición", "Básico", "Ilimitado"],
              ["Chat con IA", "5 msg/día", "Ilimitado"],
              ["Planes de ejercicio", "No", "Sí"],
              ["Recetas premium", "No", "Sí"],
              ["Análisis avanzado", "No", "Sí"],
              ["Soporte", "Comunidad", "Prioritario 24/7"],
            ].map(([feature, free, premium]) => (
              <tr key={feature} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td style={{ padding: "10px 12px", color: "#cbd5e1" }}>{feature}</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: free === "No" ? "#475569" : "#94a3b8" }}>{free}</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#a78bfa", fontWeight: 500 }}>{premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
