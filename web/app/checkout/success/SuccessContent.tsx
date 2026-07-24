"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ArrowRight, Clock, RotateCcw } from "lucide-react";
import { subscriptions } from "@/lib/api";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875" };

const PLAN_LABELS: Record<string, string> = {
  monthly: "Mensual", annual_individual: "Anual Individual", annual_duo: "Anual Dúo", annual_familiar: "Anual Familiar",
};

const INCLUDED = [
  "Coach IA ilimitado", "Escáner de alimentos sin límite", "Reportes PDF + historial completo",
  "Todos los desafíos y duelos", "Meal Planner — guarda semanas completas", "Leaderboard completo de la comunidad",
];

export default function SuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const planParam = params.get("tier") ?? undefined;
  const [status, setStatus] = useState<"checking" | "confirmed" | "timeout">("checking");
  const [tier, setTier] = useState<string | undefined>(planParam);
  const attempts = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      attempts.current += 1;
      try {
        const r = await subscriptions.getStatus();
        const t = r.data?.data?.tier;
        if (!cancelled && t && t !== "free") { setTier(t); setStatus("confirmed"); return; }
      } catch { /* keep polling */ }
      if (attempts.current >= 10) { if (!cancelled) setStatus("timeout"); return; }
      setTimeout(poll, 1500);
    };
    poll();
    return () => { cancelled = true; };
  }, []);

  const planLabel = (tier && PLAN_LABELS[tier]) ?? tier ?? "Premium";

  if (status === "checking") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${C.navy}`, borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
        <p style={{ fontSize: 14, color: C.dim }}>Confirmando tu pago con Stripe…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (status === "timeout") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <Clock size={48} color={C.dim2} style={{ margin: "0 auto 20px" }} />
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Estamos confirmando tu pago</h1>
          <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.6, marginBottom: 24 }}>A veces tarda unos segundos más. Tu pago con Stripe ya se procesó — puedes reintentar la confirmación.</p>
          <button onClick={() => { attempts.current = 0; setStatus("checking"); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.navy, border: "none", borderRadius: 12, padding: "12px 24px", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            <RotateCcw size={15} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 460 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 0 40px rgba(30,58,138,0.5)" }}>
          <Check size={34} color="#fff" strokeWidth={3} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 10 }}>¡Pago confirmado!</h1>
        <p style={{ fontSize: 15, color: C.dim, lineHeight: 1.6, marginBottom: 24 }}>
          Tu plan <b style={{ color: C.text }}>{planLabel}</b> está activo. Esto es lo que ya puedes usar:
        </p>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 28, textAlign: "left" }}>
          {INCLUDED.map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px" }}>
              <Check size={16} color="#8fa9dd" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, color: C.text }}>{f}</span>
            </div>
          ))}
        </div>

        <button onClick={() => router.replace("/home")} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.navy, border: "none", borderRadius: 14, padding: "15px 32px", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", width: "100%", justifyContent: "center" }}>
          Continuar a ZENCRUS <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
