"use client";

import { useEffect, useRef, useState, ReactNode, CSSProperties } from "react";

/** Reveal a block on scroll with a directional slide + fade. */
export function Reveal({
  children, delay = 0, y = 40, x = 0, style, once = true,
}: { children: ReactNode; delay?: number; y?: number; x?: number; style?: CSSProperties; once?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) { setShown(true); if (once) io.disconnect(); }
        else if (!once) setShown(false);
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translate(${x}px, ${y}px)`,
        transition: `opacity 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

/** Count up to a numeric (or string-with-number) target when it enters view. */
export function Counter({ value, style }: { value: string; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const match = value.match(/[\d.]+/);
    const num = match ? parseFloat(match[0]) : 0;
    const prefix = match ? value.slice(0, match.index) : "";
    const suffix = match ? value.slice((match.index ?? 0) + match[0].length) : value;
    const decimals = (match?.[0].split(".")[1] || "").length;

    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const dur = 1400;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const v = num * eased;
        setDisplay(prefix + v.toFixed(decimals) + suffix);
        if (p < 1) requestAnimationFrame(tick);
        else setDisplay(value);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return <span ref={ref} style={style}>{display}</span>;
}

/** Magnetic button — attracts toward the cursor for a premium tactile feel. */
export function Magnetic({ children, style, strength = 0.4 }: { children: ReactNode; style?: CSSProperties; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      style={{ display: "inline-block", transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1)", ...style }}
      onMouseMove={(e) => {
        const el = ref.current; if (!el) return;
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${mx * strength}px, ${my * strength}px)`;
      }}
      onMouseLeave={() => { const el = ref.current; if (el) el.style.transform = "translate(0,0)"; }}
    >
      {children}
    </div>
  );
}

/** Full-page scroll progress bar. */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const fn = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setP(h > 0 ? window.scrollY / h : 0);
    };
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: 200, pointerEvents: "none" }}>
      <div style={{ height: "100%", width: `${p * 100}%`, background: "linear-gradient(90deg,#2563EB,#00E5D0)", boxShadow: "0 0 12px rgba(0,229,208,0.6)", transition: "width 0.1s linear" }} />
    </div>
  );
}
