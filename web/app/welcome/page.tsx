"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import { diet as dietApi } from "@/lib/api";
import { ArrowRight } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [visible, setVisible] = useState(false);
  const [macros, setMacros] = useState({ calories: 2100, protein: 165, carbs: 225, fat: 70 });

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
    dietApi.getActive().then((r) => {
      const p = r.data?.data;
      if (p?.macros) setMacros({ calories: p.total_calories ?? 2100, protein: p.macros.protein ?? 165, carbs: p.macros.carbs ?? 225, fat: p.macros.fat ?? 70 });
    }).catch(() => {});
  }, []);

  const firstName = user?.fullName?.split(" ")[0] ?? "Atleta";

  const macroCards = [
    { label: "Calorías", value: macros.calories.toLocaleString("es-MX"), unit: "kcal/día", color: "#8fa9dd", emoji: "🔥" },
    { label: "Proteína", value: macros.protein, unit: "g/día", color: "#5f7bc4", emoji: "💪" },
    { label: "Carbohidratos", value: macros.carbs, unit: "g/día", color: "#7d8ba8", emoji: "🌾" },
    { label: "Grasa", value: macros.fat, unit: "g/día", color: "#707a8c", emoji: "🥑" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", position: "relative", overflow: "hidden" }}>
      {/* Background blobs */}
      <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "#1e3a8a", opacity: 0.1, filter: "blur(60px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, left: -100, width: 300, height: 300, borderRadius: "50%", background: "#2a4a9a", opacity: 0.08, filter: "blur(60px)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 480, width: "100%", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: "all 0.6s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image src="/logo-blanco.png" alt="ZENCRUS" width={170} height={50} style={{ objectFit: "contain", margin: "0 auto" }} priority />
        </div>

        {/* Welcome message */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#f4f4f5", lineHeight: 1.2, marginBottom: 12 }}>
            ¡Bienvenido, {firstName}! 🎉
          </div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
            Tu plan personalizado está listo. He calculado tus macros exactos basados en tu objetivo, cuerpo y nivel de actividad.
          </div>
        </div>

        {/* ZENA message */}
        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 18, padding: 20, marginBottom: 24, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.18)", borderRadius: "18px 18px 0 0", pointerEvents: "none" }} />
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(30,58,138,0.25)", border: "1.5px solid #1e3a8a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
              <Image src="/icon.png" alt="" width={22} height={22} style={{ objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8fa9dd", letterSpacing: 0.5, marginBottom: 6 }}>Coach ZENCRUS</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
                He analizado tu perfil completo. Tu meta calórica es de <strong style={{ color: "#f4f4f5" }}>{macros.calories.toLocaleString("es-MX")} kcal/día</strong>. Con un déficit/superávit calibrado para tu objetivo, alcanzarás tu meta de forma sostenible y saludable. ¡Empecemos!
              </div>
            </div>
          </div>
        </div>

        {/* Macros grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
          {macroCards.map(m => (
            <div key={m.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{m.emoji}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{m.unit}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* CTA — obligatorio pasar por elegir plan + 5 días gratis */}
        <button
          onClick={() => router.replace("/subscription")}
          className="btn-primary"
          style={{ width: "100%", fontSize: 16, padding: "18px" }}
        >
          Elegir mi plan y empezar gratis <ArrowRight size={18} />
        </button>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          5 días gratis en cualquier plan · después se cobra automáticamente
        </div>
      </div>
    </div>
  );
}
