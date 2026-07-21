"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  Bot, Apple, Dumbbell, TrendingUp, Users, Zap, Star,
  Check, ArrowRight, Menu, X, Brain,
  Activity, Heart, Moon, FlameIcon, Trophy, Clock,
  Shield, Microscope, BarChart3, Calendar
} from "lucide-react";

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? "rgba(8,8,8,0.95)" : "transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
      transition: "all 0.3s ease",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <Image src="/logo-blanco.png" alt="ZENCRUS" width={120} height={36} style={{ objectFit: "contain" }} priority />
        <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {[["#ciencia", "Ciencia IA"], ["#como", "Cómo funciona"], ["#modulos", "Módulos"], ["#precios", "Precios"]].map(([href, label]) => (
            <a key={href} href={href} style={{ padding: "8px 14px", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, textDecoration: "none", borderRadius: 8 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}>
              {label}
            </a>
          ))}
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
          <Link href="/login" style={{ padding: "8px 16px", color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600, textDecoration: "none", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)" }}>
            Iniciar sesión
          </Link>
          <Link href="/register" style={{ padding: "8px 18px", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", borderRadius: 10, background: "#2563EB" }}>
            Registrarse
          </Link>
        </div>
        <button onClick={() => setOpen(!open)} className="mobile-menu-btn" style={{ display: "none", background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 8 }}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div style={{ background: "rgba(8,8,8,0.98)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
          {[["#ciencia", "Ciencia IA"], ["#como", "Cómo funciona"], ["#modulos", "Módulos"], ["#precios", "Precios"]].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} style={{ padding: "12px 0", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 15, fontWeight: 500, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{label}</a>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} style={{ textAlign: "center", padding: 12, color: "#fff", textDecoration: "none", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", fontWeight: 600, marginTop: 8 }}>Iniciar sesión</Link>
          <Link href="/register" onClick={() => setOpen(false)} style={{ textAlign: "center", padding: 12, color: "#fff", textDecoration: "none", borderRadius: 12, background: "#2563EB", fontWeight: 700 }}>Registrarse gratis</Link>
        </div>
      )}
      <style>{`@media(max-width:768px){.desktop-nav{display:none!important}.mobile-menu-btn{display:flex!important}}`}</style>
    </nav>
  );
}

function Hero() {
  return (
    <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: "100px 24px 60px" }}>
      <div style={{ position: "absolute", top: -150, right: -150, width: 600, height: 600, borderRadius: "50%", background: "rgba(37,99,235,0.10)", filter: "blur(100px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -80, left: -100, width: 500, height: 500, borderRadius: "50%", background: "rgba(0,194,192,0.07)", filter: "blur(100px)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(37,99,235,0.10)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 999, padding: "6px 16px", marginBottom: 28 }}>
          <Star size={12} color="#60a5fa" fill="#60a5fa" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa" }}>IA entrenada con 5+ módulos de fisiología deportiva certificada</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <Image src="/logo-blanco.png" alt="ZENCRUS" width={220} height={66} style={{ objectFit: "contain" }} priority />
        </div>
        <h1 style={{ fontSize: "clamp(2.2rem,6vw,4.5rem)", fontWeight: 900, color: "#f4f4f5", lineHeight: 1.1, marginBottom: 20, letterSpacing: -1 }}>
          Tu transformación,<br />
          <span style={{ background: "linear-gradient(135deg,#2563EB 0%,#00C2C0 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>basada en ciencia real</span>
        </h1>
        <p style={{ fontSize: "clamp(1rem,2vw,1.2rem)", color: "rgba(255,255,255,0.5)", maxWidth: 620, margin: "0 auto 40px", lineHeight: 1.75 }}>
          ZENCRUS es la primera app de nutrición y fitness con IA entrenada en fisiología muscular, metabolismo energético, eje hormonal, ciclo menstrual y crononutrición — para crear un plan 100% personalizado a tu biología.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 48 }}>
          <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 32px", background: "#2563EB", color: "#fff", textDecoration: "none", borderRadius: 14, fontWeight: 700, fontSize: 15, boxShadow: "0 0 40px rgba(37,99,235,0.35)" }}>
            Empieza gratis <ArrowRight size={17} />
          </Link>
          <a href="#ciencia" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 28px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)", textDecoration: "none", borderRadius: 14, fontWeight: 600, fontSize: 15 }}>
            Ver la ciencia
          </a>
        </div>
        <div style={{ display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap" }}>
          {[["26","Variables biométricas analizadas"],["11","Módulos científicos en la IA"],["100%","Plan personalizado a tu biología"]].map(([v,l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(1.6rem,3vw,2.4rem)", fontWeight: 900, color: "#2563EB", letterSpacing: -1 }}>{v}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, marginTop: 4, maxWidth: 120 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CienciaIA() {
  const modulos = [
    { num:"01", titulo:"Fisiología de la Nutrición", color:"#2563EB", icon:<Microscope size={22} color="#2563EB"/>,
      desc:"La IA conoce las 3 vías de ATP, el metabolismo del glucógeno muscular (~400-500g) y hepático (~80-100g), y cómo optimizar cada macronutriente según tu tipo e intensidad de entrenamiento.",
      puntos:["Sistema ATP-CP, glucólisis anaeróbica y metabolismo oxidativo","Timing óptimo de carbohidratos según zona de entrenamiento","Relación glucosa/grasa según intensidad (% VO₂máx)","Carga de glucógeno 48-72h antes de eventos de resistencia"],
      fuente:"Burke, Deakin, Minehan — Nutrición Deportiva Clínica 6ª ed. (McGraw-Hill)" },
    { num:"E1", titulo:"Fisiología Muscular Profunda", color:"#FF6B35", icon:<Dumbbell size={22} color="#FF6B35"/>,
      desc:"La IA entiende los 3 mecanismos de hipertrofia (tensión mecánica, daño muscular, estrés metabólico), señalización mTORC1, tipos de fibra muscular y síntesis proteica para justificar cada ejercicio y protocolo.",
      puntos:["3 mecanismos de hipertrofia: tensión, daño y estrés metabólico","Principio de Henneman: reclutamiento de fibras tipo I y II","Señalización mTORC1, AMPK, IGF-1 y células satélite","Ventana anabólica y distribución óptima de proteína"],
      fuente:"Schoenfeld JSCR 2010 · Roberts et al. Physiol Rev 2023 · Vargas Molina 2017" },
    { num:"02", titulo:"Cálculo Energético y Macros", color:"#30D158", icon:<BarChart3 size={22} color="#30D158"/>,
      desc:"Usa Mifflin-St Jeor (la más validada en adultos 18-65 años, error ±10%) para calcular tu TMB y GET. Distribuye macros según objetivo con ajustes por estrés, sueño, ciclo menstrual y presupuesto.",
      puntos:["TMB con Mifflin-St Jeor: (10×kg)+(6.25×cm)−(5×edad)±5","Factores de actividad NEAT + ejercicio programado","Déficit 300-500 kcal para pérdida de grasa sostenible","Superávit 200-350 kcal para ganancia muscular limpia"],
      fuente:"Frankenfield et al. 2005, J Am Diet Assoc · Mifflin MD et al. 1990, Am J Clin Nutr" },
    { num:"03", titulo:"Eje Hormonal y Metabolismo", color:"#a78bfa", icon:<Brain size={22} color="#a78bfa"/>,
      desc:"La IA monitorea tu perfil hormonal: insulina, cortisol, leptina, ghrelina, GLP-1, testosterona y estrógenos. Ajusta tu plan cuando detecta estrés ≥7/10, sueño <7h o ciclos de hambre irregular.",
      puntos:["Insulina y glucagón: cuándo y qué comer para composición corporal","Cortisol y HPA: ajustes automáticos en semanas de estrés agudo","Leptina y ghrelina: gestión del hambre en déficit calórico","GLP-1, PYY, CCK: diseño de comidas saciantes inteligentes"],
      fuente:"Guyton & Hall Fisiología Médica 14ª ed. · ISSN Position Stand 2023" },
    { num:"04", titulo:"Ciclo Menstrual y Fisiología por Sexo", color:"#f472b6", icon:<Calendar size={22} color="#f472b6"/>,
      desc:"El módulo más diferenciador: ajusta calorías, macros y entrenamiento según las 4 fases del ciclo. En fase lútea el cuerpo quema 100-300 kcal/día más — la IA lo sabe y adapta tu plan automáticamente.",
      puntos:["Fase folicular: alta sensibilidad insulínica → CHO y alto volumen","Ovulación: pico de rendimiento → PRs y alta intensidad","Fase lútea: oxidación de grasas ↑ y TMR ↑ hasta 300 kcal/día","Fase menstrual: ajuste de hierro, magnesio y omega-3"],
      fuente:"Nutrition Reviews 2023 · News-Medical 2026 · RED-S Consensus 2023" },
    { num:"05", titulo:"Crononutrición y Timing", color:"#00C2C0", icon:<Clock size={22} color="#00C2C0"/>,
      desc:"El reloj biológico importa. La IA sincroniza tus comidas con tu ritmo circadiano: por la mañana la termogénesis dietaria es hasta 44% mayor que por la noche. Si entrenas de noche, el ejercicio tiene prioridad.",
      puntos:["NSQ: relojes centrales sincronizados por luz solar","Relojes periféricos (hígado, páncreas, músculo) por comida","Timing peri-entrenamiento y recuperación de glucógeno","Ayuno intermitente: protocolos y contraindicaciones"],
      fuente:"Satchidananda Panda, Salk Institute · Chrono-nutrition review, Nutrients 2024" },
  ];

  return (
    <section id="ciencia" style={{ padding: "100px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>Base Científica</div>
          <h2 style={{ fontSize: "clamp(1.8rem,4vw,3rem)", fontWeight: 900, color: "#f4f4f5", marginBottom: 16 }}>La IA más avanzada en nutrición deportiva</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 560, margin: "0 auto" }}>Cada módulo fue desarrollado con las fuentes científicas más sólidas. No es una app genérica — es fisiología deportiva real aplicada a tu perfil único.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 20 }}>
          {modulos.map(m => (
            <div key={m.num} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", padding: 28, transition: "transform 0.2s, border-color 0.2s" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform="translateY(-4px)"; el.style.borderColor=`${m.color}30`; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform="none"; el.style.borderColor="rgba(255,255,255,0.08)"; }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${m.color}15`, border: `1px solid ${m.color}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{m.icon}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: m.color, letterSpacing: 2, marginBottom: 4 }}>MÓDULO {m.num}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#f4f4f5", lineHeight: 1.3 }}>{m.titulo}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.75, marginBottom: 18 }}>{m.desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {m.puntos.map((p,i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0, marginTop: 6 }} />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{p}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>Fuente: {m.fuente}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32, padding: "20px 28px", background: "rgba(37,99,235,0.06)", borderRadius: 16, border: "1px solid rgba(37,99,235,0.15)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Brain size={18} color="#60a5fa" /></div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f4f4f5", marginBottom: 4 }}>Módulos 06–11 en desarrollo</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Micronutrientes y suplementación · Entrenamiento de fuerza · Cardio y resistencia · Recuperación y sueño · Psiconutrición · Nutrición para la salud a largo plazo</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComoFunciona() {
  const capas = [
    { num:"Capa 0", titulo:"Biometría y objetivo", tiempo:"2 min", color:"#2563EB",
      preguntas:["Edad y sexo biológico","Peso, talla y % grasa corporal","Objetivo principal","Tiempo esperado de resultados","Nivel de actividad física","Actividad en vida diaria"],
      ia:"Con estos datos la IA calcula tu TMB con Mifflin-St Jeor y tu GET. Ya puede generar tu primer plan nutricional personalizado." },
    { num:"Capa 1", titulo:"Hábitos", tiempo:"2 min", color:"#00C2C0",
      preguntas:["Horario de sueño y cronotipo","Horario de entrenamiento","Frecuencia y tipo de ejercicio","Frecuencia de comidas","Restricciones alimentarias","Presupuesto semanal"],
      ia:"Se activa la Crononutrición (Módulo 05). La IA sincroniza tus comidas con tu ritmo circadiano y adapta el timing al horario de entrenamiento." },
    { num:"Capa 2", titulo:"Señales corporales", tiempo:"1 min", color:"#a78bfa",
      preguntas:["Nivel de estrés habitual (1-10)","Calidad y duración del sueño","Patrón de hambre durante el día","Ciclo menstrual (si aplica)"],
      ia:"Se activa el Módulo 03 (Eje Hormonal) y el Módulo 04 (Ciclo Menstrual). El plan ajusta cortisol, leptina, ghrelina y fases del ciclo automáticamente." },
    { num:"Capa 3", titulo:"Contexto vital", tiempo:"1 min", color:"#f472b6",
      preguntas:["Experiencia previa con dietas","Historial de lesiones","Acceso a equipamiento","Preferencias de entrenamiento"],
      ia:"Se finaliza el perfil de 26 variables. La IA genera un plan completamente personalizado a tu biología desde el día 1." },
  ];

  return (
    <section id="como" style={{ padding: "100px 24px", background: "rgba(255,255,255,0.01)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#00C2C0", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>Proceso de onboarding</div>
          <h2 style={{ fontSize: "clamp(1.8rem,4vw,3rem)", fontWeight: 900, color: "#f4f4f5", marginBottom: 16 }}>26 variables. 4 capas. ~6 minutos.</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 500, margin: "0 auto" }}>No hacemos preguntas de relleno. Cada variable tiene un propósito fisiológico, hormonal o conductual específico.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
          {capas.map(c => (
            <div key={c.num} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: c.color, letterSpacing: 2 }}>{c.num.toUpperCase()}</div>
                <div style={{ flex: 1, height: 1, background: `${c.color}20` }} />
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{c.tiempo}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f4f4f5", marginBottom: 12 }}>{c.titulo}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {c.preguntas.map((p,i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Check size={12} color={c.color} />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{p}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 10, borderLeft: `2px solid ${c.color}40` }}>🤖 {c.ia}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesApp() {
  const features = [
    { icon:<Bot size={26} color="#2563EB"/>, color:"#2563EB", t:"ZENA — Tu coach IA", d:"Chat ilimitado con tu asistente de nutrición y fitness. ZENA usa todos los módulos de la IA para responderte con ciencia real." },
    { icon:<Apple size={26} color="#30D158"/>, color:"#30D158", t:"Plan nutricional exacto", d:"Calculado con tu TDEE real y macros específicos. Incluye recetas, lista de compras y se actualiza semanalmente." },
    { icon:<Dumbbell size={26} color="#FF6B35"/>, color:"#FF6B35", t:"Rutinas personalizadas", d:"Planes de workout adaptados a tu nivel, equipo y objetivo. Basados en los principios del Módulo E1 de fisiología muscular." },
    { icon:<Activity size={26} color="#00C2C0"/>, color:"#00C2C0", t:"Health tracker completo", d:"Health Score diario, medidas corporales, peso y fotos de progreso. Visualiza tu composición corporal cambiando." },
    { icon:<Heart size={26} color="#f472b6"/>, color:"#f472b6", t:"Tracker del ciclo menstrual", d:"Seguimiento de las 4 fases con ajuste automático de calorías, macros y entrenamiento según el Módulo 04." },
    { icon:<Moon size={26} color="#a78bfa"/>, color:"#a78bfa", t:"Crononutrición activa", d:"Tu horario de comidas sincronizado con tu ritmo circadiano. La ciencia de CUÁNDO comer, no solo QUÉ comer." },
    { icon:<Calendar size={26} color="#60a5fa"/>, color:"#60a5fa", t:"Planificador semanal", d:"Plan de comidas para toda la semana con cantidades exactas en gramos y macros por comida, generado automáticamente." },
    { icon:<FlameIcon size={26} color="#FF6B35"/>, color:"#FF6B35", t:"Ciclo de macros avanzado", d:"Periodización de carbohidratos: días altos, moderados y bajos según tu calendario de entrenamiento." },
    { icon:<Users size={26} color="#a78bfa"/>, color:"#a78bfa", t:"Comunidad + Duelos", d:"Feed social, publicaciones de progreso, duelos de 7 días y leaderboard semanal. Competencia que motiva." },
    { icon:<Trophy size={26} color="#FFD60A"/>, color:"#FFD60A", t:"Sistema de logros", d:"Más de 30 logros desbloqueables por consistencia, progreso y participación. Cada avance se celebra." },
    { icon:<Shield size={26} color="#30D158"/>, color:"#30D158", t:"Privacidad total", d:"Datos biométricos encriptados y privados. Cumplimiento LFPDPPP. Exporta o elimina tus datos cuando quieras." },
    { icon:<Zap size={26} color="#FFD60A"/>, color:"#FFD60A", t:"Todo sincronizado", d:"Si tienes un día de alto estrés, la IA ajusta tus macros. Si no dormiste bien, adapta el workout. Todo conectado." },
  ];

  return (
    <section id="modulos" style={{ padding: "100px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#FF6B35", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>Funcionalidades</div>
          <h2 style={{ fontSize: "clamp(1.8rem,4vw,3rem)", fontWeight: 900, color: "#f4f4f5", marginBottom: 16 }}>Todo lo que necesitas en un sistema</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 480, margin: "0 auto" }}>No es una app de recetas. No es un contador de calorías. Es un ecosistema de transformación personal basado en ciencia.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          {features.map(f => (
            <div key={f.t} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", padding: 24, transition: "all 0.2s" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background="rgba(255,255,255,0.05)"; el.style.transform="translateY(-2px)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background="rgba(255,255,255,0.03)"; el.style.transform="none"; }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${f.color}12`, border: `1px solid ${f.color}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f4f5", marginBottom: 8 }}>{f.t}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Diferenciadores() {
  const rows = [
    { feature:"IA entrenada en fisiología deportiva", zen:true, otros:false },
    { feature:"Ajuste por ciclo menstrual (4 fases)", zen:true, otros:false },
    { feature:"Crononutrición y timing circadiano", zen:true, otros:false },
    { feature:"Eje hormonal (cortisol, leptina, ghrelina)", zen:true, otros:false },
    { feature:"Cálculo de macros con Mifflin-St Jeor", zen:true, otros:"Parcial" },
    { feature:"Coach IA disponible 24/7", zen:true, otros:false },
    { feature:"Comunidad + Duelos gamificados", zen:true, otros:false },
    { feature:"Ciclo de macros avanzado", zen:true, otros:false },
    { feature:"Plan de entrenamiento + nutrición integrado", zen:true, otros:false },
    { feature:"Gratis para funciones básicas", zen:true, otros:true },
  ];

  return (
    <section style={{ padding: "80px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#30D158", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>Comparativa</div>
          <h2 style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 900, color: "#f4f4f5", marginBottom: 16 }}>Por qué ZENCRUS es diferente</h2>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px", padding: "14px 24px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>Función</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#2563EB", textAlign: "center" }}>ZENCRUS</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>Otras apps</div>
          </div>
          {rows.map((r,i) => (
            <div key={r.feature} style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px", padding: "12px 24px", borderBottom: i<rows.length-1?"1px solid rgba(255,255,255,0.05)":"none", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{r.feature}</div>
              <div style={{ textAlign: "center" }}><Check size={16} color="#30D158" style={{ display:"inline" }} /></div>
              <div style={{ textAlign: "center" }}>
                {r.otros===true ? <Check size={16} color="rgba(255,255,255,0.2)" style={{display:"inline"}} />
                  : r.otros==="Parcial" ? <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,200,0,0.6)" }}>Parcial</span>
                  : <span style={{ fontSize: 14, color: "rgba(255,59,48,0.6)", fontWeight: 700 }}>✕</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Precios() {
  const [anual, setAnual] = useState(false);
  const FREE = ["Plan nutricional básico (IA)","5 chats con ZENA al día","Tracking de calorías y macros","Rutinas básicas","Feed social y comunidad","Logros y racha diaria","Health tracker básico"];
  const PREMIUM = ["Todo lo de Free","Chat ilimitado con ZENA IA","Plan nutricional completo (todos los módulos)","Ajuste por ciclo menstrual (Módulo 04)","Crononutrición activa (Módulo 05)","Eje hormonal personalizado (Módulo 03)","Ciclo de macros avanzado","Planificador semanal de comidas","Lista de compras automática","Rutinas personalizadas completas","Duelos premium y leaderboard","Health tracker avanzado","Soporte prioritario"];

  return (
    <section id="precios" style={{ padding: "100px 24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>Precios</div>
          <h2 style={{ fontSize: "clamp(1.8rem,4vw,3rem)", fontWeight: 900, color: "#f4f4f5", marginBottom: 16 }}>Elige tu plan</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 400, margin: "0 auto 28px" }}>Empieza gratis. Sube a Premium cuando estés listo para el sistema completo.</p>
          <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 4, gap: 4 }}>
            <button onClick={() => setAnual(false)} style={{ padding: "8px 20px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: !anual?"#2563EB":"transparent", color: !anual?"#fff":"rgba(255,255,255,0.4)", transition: "all 0.2s" }}>Mensual</button>
            <button onClick={() => setAnual(true)} style={{ padding: "8px 20px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: anual?"#2563EB":"transparent", color: anual?"#fff":"rgba(255,255,255,0.4)", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
              Anual <span style={{ background: "#22c55e", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>−37%</span>
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.09)", padding: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>GRATIS</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: "#f4f4f5", marginBottom: 4 }}>$0</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 28 }}>Para siempre</div>
            <Link href="/register" style={{ display: "block", textAlign: "center", padding: 13, color: "#f4f4f5", textDecoration: "none", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", fontWeight: 700, fontSize: 14, marginBottom: 28 }}>Empezar gratis</Link>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {FREE.map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Check size={14} color="#30D158" />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 20, background: "rgba(37,99,235,0.07)", border: "1px solid rgba(37,99,235,0.35)", padding: 32, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%", background: "rgba(37,99,235,0.12)", filter: "blur(40px)" }} />
            <div style={{ position: "absolute", top: 14, right: 18, background: "#2563EB", color: "#fff", fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>MÁS POPULAR</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", marginBottom: 8 }}>PREMIUM</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: "#f4f4f5", marginBottom: 4 }}>
              {anual?"$1,499":"$199"}<span style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>/{anual?"año":"mes"}</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 28 }}>{anual?"= $125/mes · Ahorra $888 al año":"Cancela cuando quieras"} MXN</div>
            <Link href="/register" style={{ display: "block", textAlign: "center", padding: 13, color: "#fff", textDecoration: "none", borderRadius: 12, background: "#2563EB", fontWeight: 700, fontSize: 14, marginBottom: 28, boxShadow: "0 0 30px rgba(37,99,235,0.3)" }}>Probar 7 días gratis</Link>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {PREMIUM.map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Check size={14} color="#60a5fa" />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 24 }}>Precios en pesos mexicanos (MXN) · IVA incluido · Pagos seguros con Stripe</p>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section style={{ padding: "80px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", background: "rgba(37,99,235,0.07)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 24, padding: "60px 40px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 400, height: 200, borderRadius: "50%", background: "rgba(37,99,235,0.12)", filter: "blur(60px)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <Image src="/logo-blanco.png" alt="ZENCRUS" width={140} height={42} style={{ objectFit: "contain" }} />
          </div>
          <h2 style={{ fontSize: "clamp(1.6rem,4vw,2.5rem)", fontWeight: 900, color: "#f4f4f5", marginBottom: 16 }}>Tu transformación empieza hoy</h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 32, lineHeight: 1.7 }}>Sin fad diets, sin suplementos innecesarios, sin pseudociencia. Solo biología real aplicada a tu cuerpo.</p>
          <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 36px", background: "#2563EB", color: "#fff", textDecoration: "none", borderRadius: 14, fontWeight: 700, fontSize: 15, boxShadow: "0 0 40px rgba(37,99,235,0.4)" }}>
            Comenzar gratis ahora <ArrowRight size={17} />
          </Link>
          <p style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Sin tarjeta de crédito · 7 días gratis en Premium</p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20, marginBottom: 32 }}>
          <Image src="/logo-blanco.png" alt="ZENCRUS" width={100} height={30} style={{ objectFit: "contain" }} />
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[["#ciencia","Ciencia"],["#modulos","Funciones"],["#precios","Precios"],["/login","Iniciar sesión"],["/register","Registrarse"]].map(([href,label]) => (
              <a key={href} href={href} style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.color="rgba(255,255,255,0.7)")}
                onMouseLeave={e => (e.currentTarget.style.color="rgba(255,255,255,0.35)")}>{label}</a>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>© 2025 ZENCRUS. Todos los derechos reservados.</div>
          <div style={{ display: "flex", gap: 20 }}>
            {["Privacidad","Términos","Contacto"].map(l => (
              <a key={l} href="#" style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>{l}</a>
            ))}
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
  useEffect(() => {
    if (!isLoading && token) router.replace("/home");
  }, [isLoading, token, router]);

  if (!isLoading && token) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0a0a0a" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #2563EB", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#f4f4f5" }}>
      <Nav />
      <Hero />
      <CienciaIA />
      <ComoFunciona />
      <FeaturesApp />
      <Diferenciadores />
      <Precios />
      <CTA />
      <Footer />
    </div>
  );
}
