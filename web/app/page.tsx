"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Reveal, Counter, Magnetic } from "@/components/landing/scrollfx";
import {
  Bot, Apple, Dumbbell, TrendingUp, Users, Zap, Star,
  Check, ArrowRight, Menu, X, Brain,
  Activity, Heart, Moon, FlameIcon, Trophy, Clock,
  Shield, Microscope, BarChart3, Calendar,
} from "lucide-react";

const BioField = dynamic(() => import("@/components/landing/BioField"), { ssr: false });

// ── Aurora animated background (CSS, GPU-cheap) ─────────────────────────────
function Aurora() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div className="aurora a1" />
      <div className="aurora a2" />
      <div className="aurora a3" />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 0%, transparent 55%, #050506 100%)" }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.4, backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "42px 42px", maskImage: "radial-gradient(circle at 50% 40%, black, transparent 75%)" }} />
    </div>
  );
}

// ── Cursor glow ─────────────────────────────────────────────────────────────
function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const el = ref.current; if (!el) return;
    let rafId = 0; const pos = { x: -300, y: -300 }; const cur = { x: -300, y: -300 };
    const move = (e: MouseEvent) => { pos.x = e.clientX; pos.y = e.clientY; };
    const loop = () => {
      cur.x += (pos.x - cur.x) * 0.18; cur.y += (pos.y - cur.y) * 0.18;
      el.style.transform = `translate(${cur.x - 200}px, ${cur.y - 200}px)`;
      rafId = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", move); loop();
    return () => { window.removeEventListener("mousemove", move); cancelAnimationFrame(rafId); };
  }, []);
  return <div ref={ref} aria-hidden style={{ position: "fixed", top: 0, left: 0, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.10), transparent 65%)", pointerEvents: "none", zIndex: 1, mixBlendMode: "screen" }} />;
}

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn); return () => window.removeEventListener("scroll", fn);
  }, []);
  const links: [string, string][] = [["#ciencia", "Ciencia IA"], ["#como", "Cómo funciona"], ["#modulos", "Módulos"], ["#precios", "Precios"]];
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? "rgba(5,5,6,0.72)" : "transparent",
      backdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
      transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
    }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 66 }}>
        <Image src="/logo-blanco.png" alt="ZENCRUS" width={120} height={36} style={{ objectFit: "contain" }} priority />
        <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {links.map(([href, label]) => (
            <a key={href} href={href} className="nav-link" style={{ padding: "8px 14px", color: "rgba(255,255,255,0.62)", fontSize: 13, fontWeight: 500, textDecoration: "none", borderRadius: 8, position: "relative" }}>{label}</a>
          ))}
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
          <Link href="/login" style={{ padding: "8px 16px", color: "rgba(255,255,255,0.82)", fontSize: 13, fontWeight: 600, textDecoration: "none", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)" }}>Iniciar sesión</Link>
          <Magnetic strength={0.3}>
            <Link href="/register" className="cta-shine" style={{ display: "inline-block", padding: "9px 18px", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", borderRadius: 10, background: "linear-gradient(135deg,#2563EB,#1e40af)", boxShadow: "0 4px 20px rgba(37,99,235,0.35)" }}>Registrarse</Link>
          </Magnetic>
        </div>
        <button onClick={() => setOpen(!open)} className="mobile-menu-btn" style={{ display: "none", background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 8 }}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div style={{ background: "rgba(5,5,6,0.98)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} style={{ padding: "12px 0", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 15, fontWeight: 500, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{label}</a>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} style={{ textAlign: "center", padding: 12, color: "#fff", textDecoration: "none", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", fontWeight: 600, marginTop: 8 }}>Iniciar sesión</Link>
          <Link href="/register" onClick={() => setOpen(false)} style={{ textAlign: "center", padding: 12, color: "#fff", textDecoration: "none", borderRadius: 12, background: "#2563EB", fontWeight: 700 }}>Registrarse gratis</Link>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const words = ["Tu", "biología,", "descifrada", "por", "IA"];
  return (
    <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: "120px 24px 60px" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}><BioField /></div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 50% at 50% 45%, transparent 30%, rgba(5,5,6,0.55) 75%)", zIndex: 1, pointerEvents: "none" }} />
      <div style={{ maxWidth: 940, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 2, pointerEvents: "none" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(37,99,235,0.10)", border: "1px solid rgba(37,99,235,0.28)", borderRadius: 999, padding: "6px 16px", marginBottom: 30, backdropFilter: "blur(10px)", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(16px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)", pointerEvents: "auto" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00E5D0", boxShadow: "0 0 8px #00E5D0", animation: "pulse 1.6s infinite" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#7fd8e8" }}>IA entrenada en 11 módulos de fisiología deportiva certificada</span>
        </div>
        <h1 style={{ fontSize: "clamp(2.6rem,7vw,5.5rem)", fontWeight: 900, color: "#f4f4f5", lineHeight: 1.02, marginBottom: 24, letterSpacing: "-0.03em" }}>
          {words.map((w, i) => (
            <span key={i} style={{ display: "inline-block", marginRight: "0.28em", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(30px) rotateX(40deg)", transition: `all 0.9s cubic-bezier(0.16,1,0.3,1) ${200 + i * 90}ms`,
              ...(w === "descifrada" ? { background: "linear-gradient(115deg,#2563EB 0%,#00E5D0 60%,#a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } : {}) }}>{w}</span>
          ))}
        </h1>
        <p style={{ fontSize: "clamp(1rem,2vw,1.25rem)", color: "rgba(255,255,255,0.58)", maxWidth: 640, margin: "0 auto 44px", lineHeight: 1.75, opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(20px)", transition: "all 0.9s cubic-bezier(0.16,1,0.3,1) 0.7s" }}>
          La primera app de nutrición y fitness con IA entrenada en fisiología muscular, metabolismo, eje hormonal, ciclo menstrual y crononutrición — un plan modelado a tu ADN metabólico.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 60, pointerEvents: "auto", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(20px)", transition: "all 0.9s cubic-bezier(0.16,1,0.3,1) 0.85s" }}>
          <Magnetic strength={0.35}>
            <Link href="/register" className="cta-shine" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 34px", background: "linear-gradient(135deg,#2563EB,#1e40af)", color: "#fff", textDecoration: "none", borderRadius: 14, fontWeight: 700, fontSize: 15, boxShadow: "0 8px 40px rgba(37,99,235,0.45)" }}>
              Empieza gratis <ArrowRight size={17} />
            </Link>
          </Magnetic>
          <a href="#ciencia" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 28px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.85)", textDecoration: "none", borderRadius: 14, fontWeight: 600, fontSize: 15, backdropFilter: "blur(10px)" }}>Ver la ciencia</a>
        </div>
        <div style={{ display: "flex", gap: 48, justifyContent: "center", flexWrap: "wrap", pointerEvents: "auto" }}>
          {[["26", "Variables biométricas"], ["11", "Módulos científicos"], ["100%", "Personalizado a tu biología"]].map(([v, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <Counter value={v} style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)", fontWeight: 900, letterSpacing: "-0.03em", background: "linear-gradient(135deg,#60a5fa,#00E5D0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "inline-block" }} />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, marginTop: 4, maxWidth: 130 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: 0.5 }}>
        <span style={{ fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Scroll</span>
        <div style={{ width: 22, height: 34, borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.25)", display: "flex", justifyContent: "center", paddingTop: 6 }}>
          <span style={{ width: 3, height: 7, borderRadius: 2, background: "#00E5D0", animation: "scrolldot 1.6s infinite" }} />
        </div>
      </div>
    </section>
  );
}

// ── Ciencia — connected timeline (no floating cards) ────────────────────────
function CienciaIA() {
  const modulos = [
    { num: "01", titulo: "Fisiología de la Nutrición", color: "#2563EB", icon: <Microscope size={22} color="#2563EB" />, desc: "La IA conoce las 3 vías de ATP, el metabolismo del glucógeno muscular (~400-500g) y hepático (~80-100g), y cómo optimizar cada macronutriente según tu tipo e intensidad de entrenamiento.", puntos: ["Sistema ATP-CP, glucólisis anaeróbica y metabolismo oxidativo", "Timing óptimo de carbohidratos según zona de entrenamiento", "Relación glucosa/grasa según intensidad (% VO₂máx)", "Carga de glucógeno 48-72h antes de eventos de resistencia"], fuente: "Burke, Deakin, Minehan — Nutrición Deportiva Clínica 6ª ed. (McGraw-Hill)" },
    { num: "E1", titulo: "Fisiología Muscular Profunda", color: "#FF6B35", icon: <Dumbbell size={22} color="#FF6B35" />, desc: "La IA entiende los 3 mecanismos de hipertrofia (tensión mecánica, daño muscular, estrés metabólico), señalización mTORC1, tipos de fibra muscular y síntesis proteica para justificar cada ejercicio y protocolo.", puntos: ["3 mecanismos de hipertrofia: tensión, daño y estrés metabólico", "Principio de Henneman: reclutamiento de fibras tipo I y II", "Señalización mTORC1, AMPK, IGF-1 y células satélite", "Ventana anabólica y distribución óptima de proteína"], fuente: "Schoenfeld JSCR 2010 · Roberts et al. Physiol Rev 2023 · Vargas Molina 2017" },
    { num: "02", titulo: "Cálculo Energético y Macros", color: "#30D158", icon: <BarChart3 size={22} color="#30D158" />, desc: "Usa Mifflin-St Jeor (la más validada en adultos 18-65 años, error ±10%) para calcular tu TMB y GET. Distribuye macros según objetivo con ajustes por estrés, sueño, ciclo menstrual y presupuesto.", puntos: ["TMB con Mifflin-St Jeor: (10×kg)+(6.25×cm)−(5×edad)±5", "Factores de actividad NEAT + ejercicio programado", "Déficit 300-500 kcal para pérdida de grasa sostenible", "Superávit 200-350 kcal para ganancia muscular limpia"], fuente: "Frankenfield et al. 2005, J Am Diet Assoc · Mifflin MD et al. 1990" },
    { num: "03", titulo: "Eje Hormonal y Metabolismo", color: "#a78bfa", icon: <Brain size={22} color="#a78bfa" />, desc: "La IA monitorea tu perfil hormonal: insulina, cortisol, leptina, ghrelina, GLP-1, testosterona y estrógenos. Ajusta tu plan cuando detecta estrés ≥7/10, sueño <7h o ciclos de hambre irregular.", puntos: ["Insulina y glucagón: cuándo y qué comer para composición corporal", "Cortisol y HPA: ajustes automáticos en semanas de estrés agudo", "Leptina y ghrelina: gestión del hambre en déficit calórico", "GLP-1, PYY, CCK: diseño de comidas saciantes inteligentes"], fuente: "Guyton & Hall Fisiología Médica 14ª ed. · ISSN Position Stand 2023" },
    { num: "04", titulo: "Ciclo Menstrual y Fisiología por Sexo", color: "#f472b6", icon: <Calendar size={22} color="#f472b6" />, desc: "El módulo más diferenciador: ajusta calorías, macros y entrenamiento según las 4 fases del ciclo. En fase lútea el cuerpo quema 100-300 kcal/día más — la IA lo sabe y adapta tu plan automáticamente.", puntos: ["Fase folicular: alta sensibilidad insulínica → CHO y alto volumen", "Ovulación: pico de rendimiento → PRs y alta intensidad", "Fase lútea: oxidación de grasas ↑ y TMR ↑ hasta 300 kcal/día", "Fase menstrual: ajuste de hierro, magnesio y omega-3"], fuente: "Nutrition Reviews 2023 · News-Medical 2026 · RED-S Consensus 2023" },
    { num: "05", titulo: "Crononutrición y Timing", color: "#00E5D0", icon: <Clock size={22} color="#00E5D0" />, desc: "El reloj biológico importa. La IA sincroniza tus comidas con tu ritmo circadiano: por la mañana la termogénesis dietaria es hasta 44% mayor que por la noche. Si entrenas de noche, el ejercicio tiene prioridad.", puntos: ["NSQ: relojes centrales sincronizados por luz solar", "Relojes periféricos (hígado, páncreas, músculo) por comida", "Timing peri-entrenamiento y recuperación de glucógeno", "Ayuno intermitente: protocolos y contraindicaciones"], fuente: "Satchidananda Panda, Salk Institute · Chrono-nutrition, Nutrients 2024" },
  ];
  return (
    <section id="ciencia" style={{ padding: "120px 24px", position: "relative", zIndex: 2 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 80 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#00E5D0", letterSpacing: 4, textTransform: "uppercase", marginBottom: 14 }}>Base Científica</div>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3.4rem)", fontWeight: 900, color: "#f4f4f5", marginBottom: 18, letterSpacing: "-0.03em", lineHeight: 1.05 }}>No es una app genérica.<br />Es fisiología aplicada a ti.</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.48)", maxWidth: 560, margin: "0 auto", lineHeight: 1.7 }}>Cada módulo fue desarrollado con las fuentes científicas más sólidas y aplicado a tu perfil único de 26 variables.</p>
        </Reveal>
        <div style={{ position: "relative" }}>
          {/* spine */}
          <div className="spine" style={{ position: "absolute", left: 27, top: 10, bottom: 10, width: 2, background: "linear-gradient(180deg,#2563EB,#FF6B35,#30D158,#a78bfa,#f472b6,#00E5D0)", opacity: 0.35 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {modulos.map((m, i) => (
              <Reveal key={m.num} delay={i * 60} x={-24} y={0}>
                <div className="sci-row" style={{ display: "flex", gap: 24, alignItems: "flex-start", position: "relative" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "#0a0a0c", border: `1.5px solid ${m.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 24px ${m.color}40`, zIndex: 1, position: "relative" }}>{m.icon}</div>
                  <div className="sci-panel" style={{ flex: 1, background: "linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", padding: "24px 28px", transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1), border-color 0.35s", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: m.color, opacity: 0.5 }} />
                    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: m.color, letterSpacing: 2 }}>MÓDULO {m.num}</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "#f4f4f5", letterSpacing: "-0.01em" }}>{m.titulo}</span>
                    </div>
                    <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.58)", lineHeight: 1.75, marginBottom: 16 }}>{m.desc}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "6px 20px", marginBottom: 16 }}>
                      {m.puntos.map((p, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color, flexShrink: 0, marginTop: 7, boxShadow: `0 0 6px ${m.color}` }} />
                          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.52)", lineHeight: 1.5 }}>{p}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.25)", fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>Fuente: {m.fuente}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={100} style={{ marginTop: 28 }}>
          <div style={{ padding: "22px 28px", background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(0,229,208,0.04))", borderRadius: 18, border: "1px solid rgba(37,99,235,0.18)", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Brain size={20} color="#60a5fa" /></div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", marginBottom: 4 }}>Módulos 06–11 en desarrollo</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.42)", lineHeight: 1.6 }}>Micronutrientes y suplementación · Entrenamiento de fuerza · Cardio y resistencia · Recuperación y sueño · Psiconutrición · Salud a largo plazo</div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Cómo funciona — stepped horizontal flow ─────────────────────────────────
function ComoFunciona() {
  const capas = [
    { num: "Capa 0", titulo: "Biometría y objetivo", tiempo: "2 min", color: "#2563EB", preguntas: ["Edad y sexo biológico", "Peso, talla y % grasa corporal", "Objetivo principal", "Tiempo esperado de resultados", "Nivel de actividad física", "Actividad en vida diaria"], ia: "Con estos datos la IA calcula tu TMB con Mifflin-St Jeor y tu GET. Ya puede generar tu primer plan nutricional personalizado." },
    { num: "Capa 1", titulo: "Hábitos", tiempo: "2 min", color: "#00E5D0", preguntas: ["Horario de sueño y cronotipo", "Horario de entrenamiento", "Frecuencia y tipo de ejercicio", "Frecuencia de comidas", "Restricciones alimentarias", "Presupuesto semanal"], ia: "Se activa la Crononutrición (Módulo 05). La IA sincroniza tus comidas con tu ritmo circadiano y adapta el timing al horario de entrenamiento." },
    { num: "Capa 2", titulo: "Señales corporales", tiempo: "1 min", color: "#a78bfa", preguntas: ["Nivel de estrés habitual (1-10)", "Calidad y duración del sueño", "Patrón de hambre durante el día", "Ciclo menstrual (si aplica)"], ia: "Se activa el Módulo 03 (Eje Hormonal) y el Módulo 04 (Ciclo Menstrual). El plan ajusta cortisol, leptina, ghrelina y fases del ciclo automáticamente." },
    { num: "Capa 3", titulo: "Contexto vital", tiempo: "1 min", color: "#f472b6", preguntas: ["Experiencia previa con dietas", "Historial de lesiones", "Acceso a equipamiento", "Preferencias de entrenamiento"], ia: "Se finaliza el perfil de 26 variables. La IA genera un plan completamente personalizado a tu biología desde el día 1." },
  ];
  return (
    <section id="como" style={{ padding: "120px 24px", position: "relative", zIndex: 2 }}>
      <div style={{ maxWidth: 1140, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#00E5D0", letterSpacing: 4, textTransform: "uppercase", marginBottom: 14 }}>Proceso de onboarding</div>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3.4rem)", fontWeight: 900, color: "#f4f4f5", marginBottom: 16, letterSpacing: "-0.03em" }}>26 variables. 4 capas. ~6 min.</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.48)", maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>No hacemos preguntas de relleno. Cada variable tiene un propósito fisiológico, hormonal o conductual específico.</p>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 18 }}>
          {capas.map((c, i) => (
            <Reveal key={c.num} delay={i * 90} y={50}>
              <div className="tilt" style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012))", borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", padding: 26, height: "100%", position: "relative", overflow: "hidden", transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
                <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: c.color, opacity: 0.12, filter: "blur(40px)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span style={{ fontSize: 34, fontWeight: 900, color: c.color, opacity: 0.9, letterSpacing: "-0.03em", lineHeight: 1 }}>{String(i)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: c.color, letterSpacing: 1.5 }}>{c.num.toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{c.tiempo}</div>
                  </div>
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#f4f4f5", marginBottom: 14 }}>{c.titulo}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
                  {c.preguntas.map((p, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Check size={12} color={c.color} />
                      <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.52)" }}>{p}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 12, borderLeft: `2px solid ${c.color}` }}>🤖 {c.ia}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features — tilting depth panels ─────────────────────────────────────────
function FeaturesApp() {
  const features = [
    { icon: <Bot size={24} color="#2563EB" />, color: "#2563EB", t: "ZENA — Tu coach IA", d: "Chat ilimitado con tu asistente de nutrición y fitness. ZENA usa todos los módulos de la IA para responderte con ciencia real." },
    { icon: <Apple size={24} color="#30D158" />, color: "#30D158", t: "Plan nutricional exacto", d: "Calculado con tu TDEE real y macros específicos. Incluye recetas, lista de compras y se actualiza semanalmente." },
    { icon: <Dumbbell size={24} color="#FF6B35" />, color: "#FF6B35", t: "Rutinas personalizadas", d: "Planes de workout adaptados a tu nivel, equipo y objetivo. Basados en el Módulo E1 de fisiología muscular." },
    { icon: <Activity size={24} color="#00E5D0" />, color: "#00E5D0", t: "Health tracker completo", d: "Health Score diario, medidas corporales, peso y fotos de progreso. Visualiza tu composición corporal cambiando." },
    { icon: <Heart size={24} color="#f472b6" />, color: "#f472b6", t: "Tracker del ciclo menstrual", d: "Seguimiento de las 4 fases con ajuste automático de calorías, macros y entrenamiento según el Módulo 04." },
    { icon: <Moon size={24} color="#a78bfa" />, color: "#a78bfa", t: "Crononutrición activa", d: "Tu horario de comidas sincronizado con tu ritmo circadiano. La ciencia de CUÁNDO comer, no solo QUÉ comer." },
    { icon: <Calendar size={24} color="#60a5fa" />, color: "#60a5fa", t: "Planificador semanal", d: "Plan de comidas para toda la semana con cantidades exactas en gramos y macros por comida, automático." },
    { icon: <FlameIcon size={24} color="#FF6B35" />, color: "#FF6B35", t: "Ciclo de macros avanzado", d: "Periodización de carbohidratos: días altos, moderados y bajos según tu calendario de entrenamiento." },
    { icon: <Users size={24} color="#a78bfa" />, color: "#a78bfa", t: "Comunidad + Duelos", d: "Feed social, publicaciones de progreso, duelos de 7 días y leaderboard semanal. Competencia que motiva." },
    { icon: <Trophy size={24} color="#FFD60A" />, color: "#FFD60A", t: "Sistema de logros", d: "Más de 30 logros desbloqueables por consistencia, progreso y participación. Cada avance se celebra." },
    { icon: <Shield size={24} color="#30D158" />, color: "#30D158", t: "Privacidad total", d: "Datos biométricos encriptados y privados. Cumplimiento LFPDPPP. Exporta o elimina tus datos cuando quieras." },
    { icon: <Zap size={24} color="#FFD60A" />, color: "#FFD60A", t: "Todo sincronizado", d: "Día de alto estrés → ajusta macros. ¿No dormiste bien? → adapta el workout. Todo conectado en tiempo real." },
  ];
  return (
    <section id="modulos" style={{ padding: "120px 24px", position: "relative", zIndex: 2 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#FF6B35", letterSpacing: 4, textTransform: "uppercase", marginBottom: 14 }}>El ecosistema</div>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3.4rem)", fontWeight: 900, color: "#f4f4f5", marginBottom: 16, letterSpacing: "-0.03em" }}>Un sistema, no una app de recetas</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.48)", maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>No es un contador de calorías. Es un ecosistema de transformación personal basado en ciencia.</p>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          {features.map((f, i) => (
            <Reveal key={f.t} delay={(i % 3) * 80} y={40}>
              <TiltPanel color={f.color}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: `${f.color}14`, border: `1px solid ${f.color}28`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: `inset 0 0 20px ${f.color}12` }}>{f.icon}</div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: "#f4f4f5", marginBottom: 8 }}>{f.t}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.48)", lineHeight: 1.7 }}>{f.d}</div>
              </TiltPanel>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function TiltPanel({ children, color }: { children: React.ReactNode; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      style={{ position: "relative", background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012))", borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", padding: 24, height: "100%", transformStyle: "preserve-3d", transition: "transform 0.2s ease, border-color 0.3s", overflow: "hidden" }}
      onMouseMove={(e) => {
        const el = ref.current; if (!el) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(800px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg) translateZ(6px)`;
        el.style.borderColor = `${color}44`;
      }}
      onMouseLeave={() => { const el = ref.current; if (!el) return; el.style.transform = "perspective(800px) rotateY(0) rotateX(0)"; el.style.borderColor = "rgba(255,255,255,0.07)"; }}
    >
      <div style={{ position: "absolute", top: -50, right: -50, width: 120, height: 120, borderRadius: "50%", background: color, opacity: 0.10, filter: "blur(45px)" }} />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

function Diferenciadores() {
  const rows = [
    { feature: "IA entrenada en fisiología deportiva", otros: false },
    { feature: "Ajuste por ciclo menstrual (4 fases)", otros: false },
    { feature: "Crononutrición y timing circadiano", otros: false },
    { feature: "Eje hormonal (cortisol, leptina, ghrelina)", otros: false },
    { feature: "Cálculo de macros con Mifflin-St Jeor", otros: "Parcial" },
    { feature: "Coach IA disponible 24/7", otros: false },
    { feature: "Comunidad + Duelos gamificados", otros: false },
    { feature: "Ciclo de macros avanzado", otros: false },
    { feature: "Plan de entrenamiento + nutrición integrado", otros: false },
    { feature: "Gratis para funciones básicas", otros: true },
  ];
  return (
    <section style={{ padding: "100px 24px", position: "relative", zIndex: 2 }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#30D158", letterSpacing: 4, textTransform: "uppercase", marginBottom: 14 }}>Comparativa</div>
          <h2 style={{ fontSize: "clamp(1.9rem,4.5vw,3rem)", fontWeight: 900, color: "#f4f4f5", letterSpacing: "-0.03em" }}>Por qué ZENCRUS es diferente</h2>
        </Reveal>
        <Reveal>
          <div style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.01))", borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px", padding: "16px 26px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>Función</div>
              <div style={{ fontSize: 12, fontWeight: 800, background: "linear-gradient(135deg,#60a5fa,#00E5D0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textAlign: "center" }}>ZENCRUS</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>Otras apps</div>
            </div>
            {rows.map((r, i) => (
              <div key={r.feature} className="cmp-row" style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px", padding: "14px 26px", borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", alignItems: "center", transition: "background 0.2s" }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)" }}>{r.feature}</div>
                <div style={{ textAlign: "center" }}><span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: "50%", background: "rgba(48,209,88,0.15)", alignItems: "center", justifyContent: "center" }}><Check size={14} color="#30D158" /></span></div>
                <div style={{ textAlign: "center" }}>
                  {r.otros === true ? <Check size={16} color="rgba(255,255,255,0.2)" style={{ display: "inline" }} />
                    : r.otros === "Parcial" ? <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,200,0,0.6)" }}>Parcial</span>
                      : <span style={{ fontSize: 15, color: "rgba(255,59,48,0.55)", fontWeight: 700 }}>✕</span>}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Precios() {
  const [anual, setAnual] = useState(false);
  const FREE = ["Plan nutricional básico (IA)", "5 chats con ZENA al día", "Tracking de calorías y macros", "Rutinas básicas", "Feed social y comunidad", "Logros y racha diaria", "Health tracker básico"];
  const PREMIUM = ["Todo lo de Free", "Chat ilimitado con ZENA IA", "Plan nutricional completo (todos los módulos)", "Ajuste por ciclo menstrual (Módulo 04)", "Crononutrición activa (Módulo 05)", "Eje hormonal personalizado (Módulo 03)", "Ciclo de macros avanzado", "Planificador semanal de comidas", "Lista de compras automática", "Rutinas personalizadas completas", "Duelos premium y leaderboard", "Health tracker avanzado", "Soporte prioritario"];
  return (
    <section id="precios" style={{ padding: "120px 24px", position: "relative", zIndex: 2 }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: 4, textTransform: "uppercase", marginBottom: 14 }}>Precios</div>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3.4rem)", fontWeight: 900, color: "#f4f4f5", marginBottom: 16, letterSpacing: "-0.03em" }}>Elige tu plan</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.48)", maxWidth: 400, margin: "0 auto 28px" }}>Empieza gratis. Sube a Premium cuando estés listo para el sistema completo.</p>
          <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 4, gap: 4 }}>
            <button onClick={() => setAnual(false)} style={{ padding: "8px 20px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: !anual ? "#2563EB" : "transparent", color: !anual ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 0.2s" }}>Mensual</button>
            <button onClick={() => setAnual(true)} style={{ padding: "8px 20px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: anual ? "#2563EB" : "transparent", color: anual ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
              Anual <span style={{ background: "#22c55e", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>−37%</span>
            </button>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
          <Reveal x={-24} y={0}>
            <div style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.01))", borderRadius: 22, border: "1px solid rgba(255,255,255,0.09)", padding: 34, height: "100%" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>GRATIS</div>
              <div style={{ fontSize: 46, fontWeight: 900, color: "#f4f4f5", marginBottom: 4, letterSpacing: "-0.03em" }}>$0</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 28 }}>Para siempre</div>
              <Link href="/register" style={{ display: "block", textAlign: "center", padding: 13, color: "#f4f4f5", textDecoration: "none", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", fontWeight: 700, fontSize: 14, marginBottom: 28 }}>Empezar gratis</Link>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {FREE.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}><Check size={14} color="#30D158" /><span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{f}</span></div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal x={24} y={0} delay={80}>
            <div className="premium-card" style={{ borderRadius: 22, background: "linear-gradient(160deg, rgba(37,99,235,0.10), rgba(0,229,208,0.03))", border: "1px solid rgba(37,99,235,0.4)", padding: 34, position: "relative", overflow: "hidden", height: "100%", boxShadow: "0 0 60px rgba(37,99,235,0.15)" }}>
              <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(0,229,208,0.14)", filter: "blur(50px)" }} />
              <div style={{ position: "absolute", top: 16, right: 20, background: "linear-gradient(135deg,#2563EB,#00E5D0)", color: "#fff", fontSize: 10, fontWeight: 800, padding: "5px 12px", borderRadius: 999, letterSpacing: 0.5 }}>MÁS POPULAR</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7fd8e8", marginBottom: 8 }}>PREMIUM</div>
              <div style={{ fontSize: 46, fontWeight: 900, color: "#f4f4f5", marginBottom: 4, letterSpacing: "-0.03em" }}>{anual ? "$1,499" : "$199"}<span style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>/{anual ? "año" : "mes"}</span></div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 28 }}>{anual ? "= $125/mes · Ahorra $888 al año" : "Cancela cuando quieras"} MXN</div>
              <Magnetic strength={0.25} style={{ display: "block" }}>
                <Link href="/register" className="cta-shine" style={{ display: "block", textAlign: "center", padding: 14, color: "#fff", textDecoration: "none", borderRadius: 12, background: "linear-gradient(135deg,#2563EB,#1e40af)", fontWeight: 700, fontSize: 14, marginBottom: 28, boxShadow: "0 8px 30px rgba(37,99,235,0.4)" }}>Probar 7 días gratis</Link>
              </Magnetic>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {PREMIUM.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}><Check size={14} color="#00E5D0" /><span style={{ fontSize: 13, color: "rgba(255,255,255,0.68)" }}>{f}</span></div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 24 }}>Precios en pesos mexicanos (MXN) · IVA incluido · Pagos seguros con Stripe</p>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section style={{ padding: "100px 24px", position: "relative", zIndex: 2 }}>
      <Reveal>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", background: "linear-gradient(160deg, rgba(37,99,235,0.10), rgba(0,229,208,0.04))", border: "1px solid rgba(37,99,235,0.22)", borderRadius: 28, padding: "64px 40px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 460, height: 240, borderRadius: "50%", background: "rgba(0,229,208,0.12)", filter: "blur(70px)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}><Image src="/logo-blanco.png" alt="ZENCRUS" width={150} height={45} style={{ objectFit: "contain" }} /></div>
            <h2 style={{ fontSize: "clamp(1.8rem,4.5vw,2.8rem)", fontWeight: 900, color: "#f4f4f5", marginBottom: 16, letterSpacing: "-0.03em" }}>Tu transformación empieza hoy</h2>
            <p style={{ fontSize: 15.5, color: "rgba(255,255,255,0.52)", marginBottom: 34, lineHeight: 1.7, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>Sin fad diets, sin suplementos innecesarios, sin pseudociencia. Solo biología real aplicada a tu cuerpo.</p>
            <Magnetic strength={0.35}>
              <Link href="/register" className="cta-shine" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 38px", background: "linear-gradient(135deg,#2563EB,#1e40af)", color: "#fff", textDecoration: "none", borderRadius: 14, fontWeight: 700, fontSize: 15, boxShadow: "0 8px 44px rgba(37,99,235,0.45)" }}>Comenzar gratis ahora <ArrowRight size={17} /></Link>
            </Magnetic>
            <p style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.28)" }}>Sin tarjeta de crédito · 7 días gratis en Premium</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "48px 24px", position: "relative", zIndex: 2 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20, marginBottom: 32 }}>
          <Image src="/logo-blanco.png" alt="ZENCRUS" width={100} height={30} style={{ objectFit: "contain" }} />
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[["#ciencia", "Ciencia"], ["#modulos", "Funciones"], ["#precios", "Precios"], ["/login", "Iniciar sesión"], ["/register", "Registrarse"]].map(([href, label]) => (
              <a key={href} href={href} className="foot-link" style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>{label}</a>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>© 2026 ZENCRUS. Todos los derechos reservados.</div>
          <div style={{ display: "flex", gap: 20 }}>
            {["Privacidad", "Términos", "Contacto"].map((l) => (<a key={l} href="#" style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>{l}</a>))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { token, loadFromStorage, isLoading } = useAuthStore();
  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
  useEffect(() => { if (!isLoading && token) router.replace("/home"); }, [isLoading, token, router]);

  if (!isLoading && token) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#050506" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #2563EB", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ background: "#050506", minHeight: "100vh", color: "#f4f4f5", position: "relative", overflowX: "hidden" }}>
      <Aurora />
      <CursorGlow />
      <Nav />
      <Hero />
      <CienciaIA />
      <ComoFunciona />
      <FeaturesApp />
      <Diferenciadores />
      <Precios />
      <CTA />
      <Footer />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes scrolldot { 0% { transform: translateY(0); opacity: 1; } 70% { transform: translateY(10px); opacity: 0; } 100% { opacity: 0; } }
        @keyframes drift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(8vw,6vh) scale(1.2); } }
        @keyframes drift2 { 0%,100% { transform: translate(0,0) scale(1.1); } 50% { transform: translate(-10vw,-4vh) scale(0.9); } }
        @keyframes drift3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6vw,-8vh) scale(1.3); } }
        .aurora { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.5; }
        .aurora.a1 { top: -10%; right: -5%; width: 45vw; height: 45vw; background: radial-gradient(circle, rgba(37,99,235,0.5), transparent 70%); animation: drift1 22s ease-in-out infinite; }
        .aurora.a2 { bottom: -15%; left: -10%; width: 50vw; height: 50vw; background: radial-gradient(circle, rgba(0,229,208,0.28), transparent 70%); animation: drift2 26s ease-in-out infinite; }
        .aurora.a3 { top: 30%; left: 30%; width: 35vw; height: 35vw; background: radial-gradient(circle, rgba(167,139,250,0.22), transparent 70%); animation: drift3 30s ease-in-out infinite; }
        .nav-link::after { content: ""; position: absolute; left: 14px; right: 14px; bottom: 2px; height: 1px; background: linear-gradient(90deg,#2563EB,#00E5D0); transform: scaleX(0); transform-origin: left; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
        .nav-link:hover { color: #fff !important; }
        .nav-link:hover::after { transform: scaleX(1); }
        .cta-shine { position: relative; overflow: hidden; }
        .cta-shine::before { content: ""; position: absolute; top: 0; left: -120%; width: 60%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent); transform: skewX(-20deg); transition: left 0.6s; }
        .cta-shine:hover::before { left: 130%; }
        .sci-panel:hover { transform: translateX(6px); border-color: rgba(255,255,255,0.14) !important; }
        .cmp-row:hover { background: rgba(255,255,255,0.025); }
        .foot-link:hover { color: rgba(255,255,255,0.75) !important; }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .spine { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aurora { animation: none !important; }
          .cta-shine::before { display: none; }
        }
      `}</style>
    </div>
  );
}
