"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Zap, ArrowRight } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  const firstName = user?.fullName?.split(" ")[0] ?? "Atleta";

  const macros = [
    { label: "Calorías", value: "2,100", unit: "kcal/día", color: "#60a5fa", emoji: "🔥" },
    { label: "Proteína", value: "165", unit: "g/día", color: "#30D158", emoji: "💪" },
    { label: "Carbohidratos", value: "225", unit: "g/día", color: "#00C2C0", emoji: "🌾" },
    { label: "Grasa", value: "70", unit: "g/día", color: "#FF6B35", emoji: "🥑" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", position: "relative", overflow: "hidden" }}>
      {/* Background blobs */}
      <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "#2563EB", opacity: 0.08, filter: "blur(60px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, left: -100, width: 300, height: 300, borderRadius: "50%", background: "#00C2C0", opacity: 0.06, filter: "blur(60px)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 480, width: "100%", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: "all 0.6s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 20, background: "#2563EB", marginBottom: 16, boxShadow: "0 0 40px rgba(37,99,235,0.5)" }}>
            <Zap size={32} color="#fff" fill="#fff" />
          </div>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#2563EB", letterSpacing: 4, marginBottom: 4 }}>ZENCRUS</div>
        </div>

        {/* Welcome message */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#f4f4f5", lineHeight: 1.2, marginBottom: 12 }}>
            ¡Bienvenido,{"\n"}{firstName}! 🎉
          </div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
            Tu plan personalizado está listo. He calculado tus macros exactos basados en tu objetivo, cuerpo y nivel de actividad.
          </div>
        </div>

        {/* ZENA message */}
        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 18, padding: 20, marginBottom: 24, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.18)", borderRadius: "18px 18px 0 0", pointerEvents: "none" }} />
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(30,40,80,0.9)", border: "1.5px solid #2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#60a5fa", letterSpacing: 0.5, marginBottom: 6 }}>Coach ZENCRUS</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
                He analizado tu perfil completo. Tu TDEE calculado es de <strong style={{ color: "#f4f4f5" }}>2,100 kcal/día</strong>. Con un déficit/superávit calibrado para tu objetivo, alcanzarás tu meta de forma sostenible y saludable. ¡Empecemos!
              </div>
            </div>
          </div>
        </div>

        {/* Macros grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
          {macros.map(m => (
            <div key={m.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{m.emoji}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{m.unit}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => router.replace("/home")}
          className="btn-primary"
          style={{ width: "100%", fontSize: 16, padding: "18px" }}
        >
          Comenzar mi transformación <ArrowRight size={18} />
        </button>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          Tu plan nutricional personalizado te espera
        </div>
      </div>
    </div>
  );
}
