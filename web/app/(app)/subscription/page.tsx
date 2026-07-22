"use client";

import { useState, useEffect } from "react";
import { Check, Crown, Users, User, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { subscriptions } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

// Paleta: blanco / negro / azul marino oscuro / gris oscuro
const C = {
  bg: "#08090c", panel: "#0f1218", panelHi: "#131824", border: "#1e2430",
  navy: "#1e3a8a", navyLine: "#2a4a9a", navySoft: "rgba(30,58,138,0.14)",
  text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875",
};

interface Plan {
  id: string; name: string; price: number; period?: string; currency: string;
  features: string[]; limitations?: string[]; popular?: boolean;
}

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tier: string } | null>(null);
  const [extra, setExtra] = useState(0);

  useEffect(() => {
    subscriptions.getPlans().then((r) => setPlans(r.data?.data ?? [])).catch(() => {});
    subscriptions.getStatus()
      .then((r) => setStatus(r.data?.data ?? r.data))
      .catch(() => setStatus({ tier: user?.subscriptionTier || "free" }));
  }, [user]);

  const currentTier = status?.tier || user?.subscriptionTier || "free";

  const startTrial = async () => {
    setLoading("trial");
    try {
      await subscriptions.startTrial();
      toast.success("¡Prueba de 5 días activada!");
      setTimeout(() => (window.location.href = "/home"), 900);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo iniciar la prueba");
    } finally { setLoading(null); }
  };

  const checkout = async (tier: string) => {
    setLoading(tier);
    try {
      const res = await subscriptions.checkoutWeb(tier, tier === "annual_familiar" ? extra : 0);
      const url = res.data?.data?.url;
      if (url) window.location.href = url;
      else toast.error("No se pudo abrir el pago");
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al iniciar el pago");
    } finally { setLoading(null); }
  };

  const iconFor = (id: string) =>
    id === "free" ? <Sparkles size={18} /> :
    id === "monthly" ? <Crown size={18} /> :
    id === "annual_individual" ? <User size={18} /> :
    <Users size={18} />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "40px 24px 100px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b8cce", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>Planes ZENCRUS</div>
          <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 10 }}>
            {currentTier !== "free" ? "Tu suscripción" : "Elige tu plan"}
          </h1>
          <p style={{ fontSize: 15, color: C.dim, maxWidth: 480, margin: "0 auto" }}>
            Ciencia real aplicada a tu biología. Cancela cuando quieras. Precios en MXN, IVA incluido.
          </p>
        </div>

        {currentTier === "free" && (
          <div style={{ textAlign: "center", marginTop: 20, marginBottom: 32 }}>
            <button onClick={startTrial} disabled={loading === "trial"} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.text, borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {loading === "trial" ? "Activando…" : "✨ Probar Premium gratis 5 días"}
            </button>
          </div>
        )}

        {/* Plans grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16, marginTop: 32 }}>
          {plans.map((p) => {
            const active = currentTier === p.id;
            const isPaid = p.id !== "free";
            return (
              <div key={p.id} style={{
                position: "relative", display: "flex", flexDirection: "column",
                background: p.popular ? `linear-gradient(180deg, ${C.navySoft}, ${C.panel})` : C.panel,
                border: `1px solid ${p.popular ? C.navyLine : C.border}`,
                borderRadius: 18, padding: 24,
                boxShadow: p.popular ? `0 0 0 1px ${C.navyLine}, 0 20px 50px rgba(0,0,0,0.4)` : "none",
              }}>
                {p.popular && (
                  <div style={{ position: "absolute", top: 14, right: 14, background: C.navy, color: "#fff", fontSize: 9.5, fontWeight: 800, padding: "4px 9px", borderRadius: 999, letterSpacing: 0.5 }}>POPULAR</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: p.popular ? "#8fa9dd" : C.dim }}>
                  {iconFor(p.id)}
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>{p.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em" }}>${p.price.toLocaleString("es-MX")}</span>
                  {p.period && <span style={{ fontSize: 13, color: C.dim2 }}>/{p.period}</span>}
                </div>
                <div style={{ fontSize: 11, color: C.dim2, marginBottom: 20 }}>{p.price === 0 ? "Para siempre" : `${p.currency} · ${p.period === "año" ? "facturado anual" : "facturado mensual"}`}</div>

                {/* Extra members selector for familiar */}
                {p.id === "annual_familiar" && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", marginBottom: 16 }}>
                    <span style={{ fontSize: 11, color: C.dim }}>Integrantes extra</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => setExtra((n) => Math.max(0, n - 1))} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.text, cursor: "pointer", fontSize: 14 }}>−</button>
                      <span style={{ fontSize: 13, fontWeight: 800, minWidth: 14, textAlign: "center" }}>{extra}</span>
                      <button onClick={() => setExtra((n) => Math.min(2, n + 1))} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.text, cursor: "pointer", fontSize: 14 }}>+</button>
                    </div>
                  </div>
                )}

                {/* CTA */}
                {active ? (
                  <div style={{ textAlign: "center", padding: 11, borderRadius: 11, border: `1px solid ${C.border}`, color: C.dim, fontSize: 13, fontWeight: 700, marginBottom: 20 }}>Plan actual</div>
                ) : isPaid ? (
                  <button onClick={() => checkout(p.id)} disabled={loading === p.id} style={{ padding: 11, borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, marginBottom: 20, color: "#fff", background: p.popular ? C.navy : "#161b26", boxShadow: p.popular ? "0 8px 24px rgba(30,58,138,0.4)" : "none" }}>
                    {loading === p.id ? "Redirigiendo…" : p.id === "annual_familiar" && extra > 0 ? `Contratar (+$${(extra * 850).toLocaleString("es-MX")})` : "Contratar"}
                  </button>
                ) : (
                  <div style={{ textAlign: "center", padding: 11, borderRadius: 11, border: `1px solid ${C.border}`, color: C.dim2, fontSize: 13, fontWeight: 700, marginBottom: 20 }}>Gratis</div>
                )}

                {/* Features */}
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {p.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <Check size={14} style={{ color: p.popular ? "#8fa9dd" : C.dim, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                  {p.limitations?.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, opacity: 0.6 }}>
                      <span style={{ color: C.dim2, flexShrink: 0, fontSize: 13, lineHeight: 1.4 }}>✕</span>
                      <span style={{ fontSize: 12.5, color: C.dim2, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: "center", fontSize: 11.5, color: C.dim2, marginTop: 28 }}>
          Pagos seguros con Stripe · Puedes cancelar en cualquier momento desde tu perfil
        </p>
      </div>
    </div>
  );
}
