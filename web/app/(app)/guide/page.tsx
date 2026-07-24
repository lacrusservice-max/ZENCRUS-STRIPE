"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard, Apple, Dumbbell, TrendingUp, Bot, Users,
  CalendarDays, BookOpen, ShoppingCart, Ruler, Trophy, Swords, BarChart3, HeartPulse,
  ChevronDown, ChevronUp, ArrowRight, Lightbulb, Sparkles,
  type LucideIcon,
} from "lucide-react";

const C = { bg: "#08090c", panel: "#0f1218", panel2: "#12161d", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", navyBorder: "rgba(37,99,235,0.3)", blue: "#3b82f6", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875", amber: "#f5b544" };

interface Section {
  id: string; icon: LucideIcon; title: string; tagline: string;
  what: string; steps: string[]; tip?: string; route?: string;
}

const SECTIONS: Section[] = [
  {
    id: "inicio", icon: LayoutDashboard, title: "Inicio", tagline: "Tu resumen del día", route: "/home",
    what: "El panel principal reúne todo lo importante de hoy: calorías consumidas vs. tu meta, macros (proteína, carbohidratos, grasa), agua, actividad y tu racha activa.",
    steps: [
      "Revisa tu anillo de calorías: muestra cuánto te queda por consumir hoy.",
      "Cada tarjeta de macro te lleva al detalle y al registro de alimentos.",
      "Tu racha sube cada día que registras actividad. Mantenla viva.",
      "Los datos se actualizan en tiempo real conforme registras.",
    ],
    tip: "Registra tu primera comida temprano para consolidar el hábito.",
  },
  {
    id: "nutricion", icon: Apple, title: "Nutrición", tagline: "Tu plan alimenticio personalizado", route: "/nutrition",
    what: "Tu dieta generada por IA según tu perfil, objetivo y preferencias. Cada día tiene comidas con porciones exactas y macros calculados.",
    steps: [
      "Selecciona el día para ver desayuno, comida, cena y snacks.",
      "Abre una comida para ver ingredientes, cantidades y valores nutricionales.",
      "Marca cada comida como consumida para que cuente en tu resumen.",
      "¿No te gusta una comida? Pídele a ZENA (Coach IA) que la cambie.",
    ],
    tip: "Dile al chat: \"cámbiame el desayuno por algo con avena\" y lo actualiza solo.",
  },
  {
    id: "rutina", icon: Dumbbell, title: "Entreno", tagline: "Tu rutina a medida", route: "/workout",
    what: "Tu rutina de ejercicios adaptada a tu nivel, objetivo y días disponibles. Cada sesión tiene ejercicios, series, repeticiones y descansos.",
    steps: [
      "Elige el día de entrenamiento programado.",
      "Empieza la sesión y marca cada serie completada.",
      "La app registra tu progreso de cargas y volumen semanal.",
      "Consulta tu historial para ver tu evolución de fuerza.",
    ],
    tip: "Pídele a ZENA: \"agrégame un día de pierna\" o \"hazme la rutina más intensa\".",
  },
  {
    id: "progreso", icon: TrendingUp, title: "Progreso", tagline: "Mide tus resultados reales", route: "/progress",
    what: "Gráficas de tu evolución: peso, medidas corporales, fotos de progreso y cumplimiento de metas a lo largo del tiempo.",
    steps: [
      "Registra tu peso regularmente para ver la tendencia, no el número diario.",
      "Sube fotos de progreso para comparar semana a semana.",
      "Añade medidas corporales en la sección de Medidas.",
      "Genera reportes PDF con todo tu avance (Premium).",
    ],
    tip: "Toma las fotos siempre con la misma luz y hora para comparaciones justas.",
  },
  {
    id: "coach", icon: Bot, title: "Coach IA — ZENA", tagline: "Tu entrenador y nutriólogo 24/7", route: "/chat",
    what: "ZENA es la inteligencia artificial de ZENCRUS. Conoce tu perfil completo y puede responder dudas, ajustar tu plan y darte consejos personalizados.",
    steps: [
      "Escríbele en lenguaje natural, como a un entrenador real.",
      "Pídele cambios directos: \"sube mis proteínas a 180g\" y los aplica.",
      "Consulta lo que sea: \"¿puedo comer esto?\", \"¿cómo hago sentadilla?\".",
      "Pídele recetas, sustituciones, motivación o resolver dudas.",
    ],
    tip: "ZENA puede modificar tu alimentación y rutina automáticamente. Solo pídeselo.",
  },
  {
    id: "comunidad", icon: Users, title: "Comunidad", tagline: "Comparte y motívate con otros", route: "/social",
    what: "El espacio social de ZENCRUS: publica tu progreso, sigue a otros usuarios, dale like, comenta e inspírate con la comunidad.",
    steps: [
      "Publica tus logros, fotos de progreso o comidas.",
      "Sigue cuentas que te inspiren y dale like a sus publicaciones.",
      "Comenta y conecta con personas con tus mismos objetivos.",
      "Participa en desafíos y duelos para competir de forma sana.",
    ],
    tip: "La comunidad es privada de ZENCRUS: solo miembros, ambiente positivo.",
  },
];

const EXTRAS: { icon: LucideIcon; title: string; desc: string; route: string }[] = [
  { icon: CalendarDays, title: "Planificador", desc: "Organiza tus comidas de la semana completa", route: "/meal-planner" },
  { icon: BookOpen, title: "Recetas", desc: "Biblioteca de recetas saludables con macros", route: "/recipes" },
  { icon: ShoppingCart, title: "Compras", desc: "Genera tu súper según tu plan semanal", route: "/grocery" },
  { icon: Ruler, title: "Medidas", desc: "Registra y sigue tus medidas corporales", route: "/measurements" },
  { icon: HeartPulse, title: "Salud diaria", desc: "Métricas de salud y bienestar", route: "/health-tracker" },
  { icon: Trophy, title: "Logros", desc: "Desbloquea insignias por tu constancia", route: "/achievements" },
  { icon: Swords, title: "Duelos", desc: "Rétate contra otros usuarios", route: "/duels" },
  { icon: BarChart3, title: "Leaderboard", desc: "Compite en la tabla de la comunidad", route: "/leaderboard" },
];

export default function GuidePage() {
  const [open, setOpen] = useState<string | null>("inicio");

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 4px 80px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", padding: "40px 20px 32px" }}>
        <Image src="/logo-blanco.png" alt="ZENCRUS" width={140} height={50} style={{ objectFit: "contain", margin: "0 auto 20px", display: "block" }} />
        <h1 style={{ fontSize: 30, fontWeight: 900, color: C.text, letterSpacing: "-0.03em", marginBottom: 12 }}>Guía de uso</h1>
        <p style={{ fontSize: 15, color: C.dim, lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
          Tu ecosistema completo de nutrición y fitness con inteligencia artificial.
          Aquí te explicamos cómo aprovechar cada sección al máximo.
        </p>
      </div>

      {/* Secciones principales */}
      <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16 }}>Secciones principales</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 44 }}>
        {SECTIONS.map((sec) => {
          const isOpen = open === sec.id;
          const Icon = sec.icon;
          return (
            <div key={sec.id} style={{ background: isOpen ? C.navySoft : C.panel, border: `1px solid ${isOpen ? C.navyBorder : C.border}`, borderRadius: 16, overflow: "hidden", transition: "all 0.15s" }}>
              <button
                onClick={() => setOpen(isOpen ? null : sec.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: 18, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: C.navySoft, border: `1px solid ${C.navyBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={20} color={C.blue} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{sec.title}</div>
                  <div style={{ fontSize: 12.5, color: C.dim2, marginTop: 2 }}>{sec.tagline}</div>
                </div>
                {isOpen ? <ChevronUp size={18} color={C.dim} /> : <ChevronDown size={18} color={C.dim} />}
              </button>

              {isOpen && (
                <div style={{ padding: "0 18px 18px" }}>
                  <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.6, marginBottom: 18 }}>{sec.what}</p>

                  <div style={{ fontSize: 11, fontWeight: 800, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Cómo usarla</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    {sec.steps.map((step, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 11, background: C.navy, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                        <span style={{ fontSize: 14, color: C.text, lineHeight: 1.5, opacity: 0.9 }}>{step}</span>
                      </div>
                    ))}
                  </div>

                  {sec.tip && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, background: "rgba(245,181,68,0.08)", border: "1px solid rgba(245,181,68,0.18)", borderRadius: 10, padding: 12, marginTop: 16 }}>
                      <Lightbulb size={15} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.5, fontStyle: "italic" }}>{sec.tip}</span>
                    </div>
                  )}

                  {sec.route && (
                    <Link href={sec.route} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, padding: "10px 18px", borderRadius: 10, border: `1px solid ${C.navyBorder}`, color: C.blue, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
                      Ir a {sec.title} <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Herramientas adicionales */}
      <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>Herramientas adicionales</h2>
      <p style={{ fontSize: 14, color: C.dim2, marginBottom: 18 }}>Todo lo que ZENCRUS pone a tu disposición</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 44 }}>
        {EXTRAS.map((ex) => {
          const Icon = ex.icon;
          return (
            <Link key={ex.title} href={ex.route} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, textDecoration: "none", display: "block" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: C.navySoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon size={18} color={C.blue} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text, marginBottom: 3 }}>{ex.title}</div>
              <div style={{ fontSize: 12.5, color: C.dim2, lineHeight: 1.45 }}>{ex.desc}</div>
            </Link>
          );
        })}
      </div>

      {/* Cierre */}
      <div style={{ textAlign: "center", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: "36px 28px" }}>
        <Sparkles size={24} color={C.blue} style={{ margin: "0 auto 14px", display: "block" }} />
        <h3 style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 10 }}>¿Aún tienes dudas?</h3>
        <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.6, maxWidth: 420, margin: "0 auto 22px" }}>
          Pregúntale directamente a ZENA, tu Coach IA. Está disponible 24/7 para ayudarte con lo que sea.
        </p>
        <Link href="/chat" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.navy, borderRadius: 999, padding: "13px 28px", color: "#fff", fontSize: 14, fontWeight: 800, textDecoration: "none" }}>
          <Sparkles size={16} /> Abrir Coach IA
        </Link>
      </div>
    </div>
  );
}
