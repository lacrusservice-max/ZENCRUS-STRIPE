"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nutrition as nutritionApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useNutritionStore, type MealSlot, type FoodEntry } from "@/store/nutritionStore";
import toast from "react-hot-toast";
import {
  Plus, RefreshCw, Zap, BookOpen, CalendarDays, ShoppingCart, Camera, X, Check,
} from "lucide-react";
import {
  computeMealBudgets, describeMealStatus, buildCoachNote, type MealBudget,
} from "@/lib/mealBudget";
import { AddFoodSheet } from "@/components/AddFoodSheet";

/* ── Paleta neón: negro · blanco · rojo ─────────────────────────────────── */
const N = {
  void: "#050506",
  pane: "rgba(255,255,255,.045)",
  paneHi: "rgba(255,255,255,.075)",
  edge: "rgba(255,255,255,.11)",
  white: "#ffffff",
  w2: "rgba(255,255,255,.60)",
  w3: "rgba(255,255,255,.34)",
  red: "#ff1f3d",
  redSoft: "#ff5871",
  redDeep: "#ff0030",
  redCore: "#ffd7de",
  steel: "#8b8d96",
};

const TOOLS = [
  { label: "Recetas",  icon: BookOpen,     href: "/recipes" },
  { label: "Plan",     icon: CalendarDays, href: "/meal-planner" },
  { label: "Compras",  icon: ShoppingCart, href: "/grocery" },
  { label: "Foto IA",  icon: Camera,       href: null },
];

/* ── Cifra que sube desde cero ──────────────────────────────────────────── */
function useCountUp(value: number, duration = 1500) {
  const [n, setN] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(value); return; }
    let t0: number | null = null;
    const step = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, duration]);
  return n;
}

const fmt = (v: number) => Math.round(v).toLocaleString("es-MX").replace(/,/g, " ");

/* ── Anillo del plato ───────────────────────────────────────────────────── */
function PlateRing({
  target, consumed, protein, carbs, fat, size = 300,
}: {
  target: number; consumed: number; protein: number; carbs: number; fat: number; size?: number;
}) {
  const VB = 240, cx = 120, cy = 120;
  const rOuter = 99, wOuter = 4, rMacro = 84, wMacro = 21, rTrack = 108;
  const cOuter = 2 * Math.PI * rOuter;
  const cMacro = 2 * Math.PI * rMacro;
  const safe = Math.max(target, 1);
  const dayPct = Math.min(consumed / safe, 1);

  const segs = [
    { kcal: protein * 4, stroke: "url(#nn)" },
    { kcal: carbs * 4,   stroke: "url(#nn)" },
    { kcal: fat * 9,     stroke: "url(#nn)" },
  ];
  let acc = 0;
  const arcs = segs.map((s) => {
    const len = cMacro * Math.min(Math.max(0, s.kcal) / safe, 1);
    const rot = (acc / safe) * 360;
    acc += Math.max(0, s.kcal);
    return { len, rot, stroke: s.stroke };
  });

  const [go, setGo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGo(true), 60); return () => clearTimeout(t); }, []);

  return (
    <div className="zc-plate" style={{ width: size, height: size }}>
      <div className="zc-halo" />
      <svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
        <defs>
          <linearGradient id="nw" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e8e8ec" />
          </linearGradient>
          <linearGradient id="nn" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={N.redSoft} /><stop offset="0.5" stopColor={N.red} /><stop offset="1" stopColor={N.redDeep} />
          </linearGradient>
          <filter id="ngl" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b2" />
            <feMerge><feMergeNode in="b1" /><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <circle className="zc-dash" cx={cx} cy={cy} r={rTrack} fill="none"
                stroke="rgba(255,255,255,.10)" strokeWidth={1.5}
                strokeDasharray="2 6" strokeLinecap="round" />

        <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={wOuter} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="url(#nw)"
                  strokeWidth={wOuter} strokeLinecap="round"
                  strokeDasharray={`${cOuter * dayPct} ${cOuter}`}
                  strokeDashoffset={go ? 0 : cOuter * dayPct}
                  style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1) .3s" }} />
        </g>

        <circle cx={cx} cy={cy} r={rMacro} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={wMacro} />
        <g transform={`rotate(-90 ${cx} ${cy})`} filter="url(#ngl)">
          {arcs.map((a, i) => (
            <g key={i} transform={`rotate(${a.rot} ${cx} ${cy})`}>
              <circle cx={cx} cy={cy} r={rMacro} fill="none" stroke={a.stroke}
                      strokeWidth={wMacro} strokeLinecap="round"
                      strokeDasharray={`${a.len} ${cMacro}`}
                      strokeDashoffset={go ? 0 : a.len}
                      style={{ transition: `stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1) ${0.42 + i * 0.2}s` }} />
            </g>
          ))}
        </g>

        <g transform={`rotate(-90 ${cx} ${cy})`} opacity={0.55}>
          {arcs.map((a, i) => (
            <g key={`core-${i}`} transform={`rotate(${a.rot} ${cx} ${cy})`}>
              <circle cx={cx} cy={cy} r={rMacro} fill="none" stroke={N.redCore}
                      strokeWidth={3} strokeLinecap="round"
                      strokeDasharray={`${a.len} ${cMacro}`}
                      strokeDashoffset={go ? 0 : a.len}
                      style={{ transition: `stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1) ${0.42 + i * 0.2}s` }} />
            </g>
          ))}
        </g>

        <g className="zc-tip"
           style={{ transform: `rotate(${go ? dayPct * 360 : 0}deg)`, transformOrigin: "120px 120px" }}>
          <circle cx={cx} cy={cy - rMacro} r={7} fill="rgba(255,255,255,.30)" />
          <circle cx={cx} cy={cy - rMacro} r={4.5} fill="#fff" />
        </g>
      </svg>
    </div>
  );
}

/* ── Mini anillo de macro ───────────────────────────────────────────────── */
function MacroCard({ label, val, target, color }: {
  label: string; val: number; target: number; color: string;
}) {
  const pct = target > 0 ? Math.min(val / target, 1) : 0;
  const r = 21, c = 2 * Math.PI * r;
  const [go, setGo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGo(true), 380); return () => clearTimeout(t); }, []);
  return (
    <div className="zc-mac">
      <div className="zc-mac-r">
        <svg width={52} height={52} viewBox="0 0 52 52">
          <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={4} />
          <g transform="rotate(-90 26 26)">
            <circle cx={26} cy={26} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
                    strokeDasharray={`${c * pct} ${c}`}
                    strokeDashoffset={go ? 0 : c * pct}
                    style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)" }} />
          </g>
        </svg>
        <span className="zc-mac-p" style={{ color }}>{Math.round(pct * 100)} %</span>
      </div>
      <div className="zc-mac-v">{Math.round(val)}<small>/{target}</small></div>
      <div className="zc-mac-l">{label}</div>
    </div>
  );
}

/* ── Comida con presupuesto ─────────────────────────────────────────────── */
function MealRow({ meal, budget, onAdd, onRemove, onToggle }: {
  meal: MealSlot; budget?: MealBudget; onAdd: () => void; onRemove: (id: string) => void; onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeEntries = meal.entries.filter((e) => e.active !== false);
  const kcal = Math.round(activeEntries.reduce((a, e) => a + e.calories, 0));
  const pending = activeEntries.length === 0;
  const over = budget?.status === "over";
  const status = budget ? describeMealStatus(budget) : null;

  return (
    <div className={`zc-meal${pending ? " is-pending" : ""}`}>
      <button className="zc-meal-top" onClick={() => (meal.entries.length === 0 ? onAdd() : setOpen((v) => !v))}>
        <span className={`zc-meal-th${pending ? " is-pending" : ""}`}>{meal.entries.length === 0 ? "+" : meal.emoji}</span>
        <span className="zc-meal-b">
          <span className="zc-meal-n">{meal.label}</span>
          <span className="zc-meal-s">
            {activeEntries.length === 0
              ? (meal.entries.length > 0 ? "Todo desactivado" : "Presupuesto recalculado")
              : activeEntries.map((e) => e.name.split("(")[0].trim()).join(" · ")}
          </span>
        </span>
        <span className="zc-meal-r">
          <span className="zc-meal-k" style={pending ? { color: N.red } : undefined}>
            {pending ? budget?.budget ?? 0 : kcal}
          </span>
          {budget && <span className="zc-meal-bud">de {budget.budget}</span>}
        </span>
      </button>

      <div className="zc-track">
        <div className="zc-fill"
             style={{ width: `${Math.round((budget?.fill ?? 0) * 100)}%`,
                      background: over ? N.red : N.white }} />
      </div>

      {status && (
        <div className="zc-tag">
          <i style={{ background: over || pending ? N.red : N.white }} />
          <span style={{ color: over || pending ? N.redSoft : N.w2 }}>{status}</span>
        </div>
      )}

      {open && meal.entries.length > 0 && (
        <div className="zc-entries">
          {meal.entries.map((e) => {
            const active = e.active !== false;
            return (
              <div key={e.id} className={`zc-entry${active ? "" : " is-off"}`}>
                <button className={`zc-entry-check${active ? " is-on" : ""}`} onClick={() => onToggle(e.id)} aria-label={active ? "Desactivar" : "Activar"}>
                  {active && <Check size={12} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="zc-entry-n">{e.name}</div>
                  <div className="zc-entry-m">
                    {e.amount}{e.unit} · P {Math.round(e.protein)} · C {Math.round(e.carbs)} · G {Math.round(e.fat)}
                  </div>
                </div>
                <span className="zc-entry-k">{Math.round(e.calories)}</span>
                <button className="zc-entry-x" onClick={() => onRemove(e.id)} aria-label="Quitar">
                  <X size={14} />
                </button>
              </div>
            );
          })}
          <button className="zc-addmore" onClick={onAdd}>
            <Plus size={14} /> Agregar a {meal.label.toLowerCase()}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Pantalla ───────────────────────────────────────────────────────────── */
export default function NutritionPage() {
  const { user } = useAuthStore();
  const {
    meals, totalCalories, totalProtein, totalCarbs, totalFat,
    loadToday, setMeals, addEntry, addEntries, removeEntry: removeEntryFromStore, toggleEntryActive,
  } = useNutritionStore();
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const goals = (user as unknown as { goals?: Record<string, number> })?.goals ?? {};
  const caloriesTarget = goals.calories_target ?? 2000;
  const proteinTarget = goals.protein_g ?? 150;
  const carbsTarget = goals.carbs_g ?? 200;
  const fatTarget = goals.fat_g ?? 65;

  useEffect(() => {
    loadToday();
    setLoading(true);
    nutritionApi.getDashboard()
      .then((res) => {
        const d = res.data?.data;
        if (d?.meals?.length) setMeals(d.meals);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = { cal: totalCalories, p: totalProtein, c: totalCarbs, f: totalFat };

  const budgets = useMemo(
    () => computeMealBudgets(
      meals.map((m) => ({
        id: m.id, label: m.label,
        consumed: Math.round(m.entries.reduce((a, e) => a + (e.active === false ? 0 : e.calories), 0)),
        entryCount: m.entries.filter((e) => e.active !== false).length,
      })),
      caloriesTarget,
    ),
    [meals, caloriesTarget],
  );
  const budgetById = useMemo(
    () => Object.fromEntries(budgets.map((b) => [b.id, b])), [budgets],
  );

  const remaining = Math.max(0, caloriesTarget - totals.cal);
  const pct = caloriesTarget > 0 ? (totals.cal / caloriesTarget) * 100 : 0;
  const proteinGap = Math.max(0, proteinTarget - totals.p);
  const coachNote = buildCoachNote(budgets, proteinGap);

  const closed = budgets.filter((b) => b.status !== "pending");
  const adherence = closed.length
    ? Math.round(closed.reduce((a, b) => {
        if (b.budget <= 0) return a + 100;
        return a + Math.max(0, 100 - (Math.abs(b.delta) / b.budget) * 100);
      }, 0) / closed.length)
    : 100;

  const shown = useCountUp(remaining);

  const week = useMemo(() => {
    const SHORT = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
    const today = new Date();
    return Array.from({ length: 6 }, (_, k) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (5 - k));
      return { iso: d.toISOString().slice(0, 10), day: d.getDate(), short: SHORT[d.getDay()], isToday: k === 5 };
    });
  }, []);

  const generatePlan = async () => {
    setGenerating(true);
    try {
      await nutritionApi.generatePlan();
      toast.success("Plan generado con IA");
      const res = await nutritionApi.getDashboard();
      if (res.data?.data?.meals?.length) setMeals(res.data.data.meals);
    } catch {
      toast.error("No se pudo generar el plan");
    } finally {
      setGenerating(false);
    }
  };

  // Hoja de agregar alimento
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const openSheet = (mealId: string) => setSheetFor(mealId);

  const handleAdd = (mealId: string, entry: FoodEntry) => {
    addEntry(mealId, entry);
    toast.success(`${entry.name} agregado`);
  };

  const handleAddEntries = (entriesByMeal: Record<string, FoodEntry[]>) => {
    addEntries(entriesByMeal);
    const count = Object.values(entriesByMeal).reduce((a, l) => a + l.length, 0);
    toast.success(`${count} alimento${count !== 1 ? "s" : ""} agregado${count !== 1 ? "s" : ""}`);
  };

  const removeEntry = (mealId: string, entryId: string) => removeEntryFromStore(mealId, entryId);

  const nextPending = budgets.find((b) => b.status === "pending");
  const nextMeal = nextPending ? meals.find((m) => m.id === nextPending.id) : undefined;

  return (
    <div className="zc-root">
      <div className="zc-bg" aria-hidden />

      <div className="zc-wrap">
        {/* Cabecera */}
        <header className="zc-head">
          <div>
            <div className="zc-kick"><i />ZENCRUS · NUTRICIÓN</div>
            <h1 className="zc-h1">Tu plato de <em>hoy</em></h1>
          </div>
          <button className="zc-ai" onClick={generatePlan} disabled={generating}>
            {generating ? <span className="zc-spin" /> : <Zap size={15} />}
            Generar plan IA
          </button>
        </header>

        {/* Semana */}
        <div className="zc-week">
          {week.map((d) => (
            <div key={d.iso} className={`zc-wd${d.isToday ? " is-on" : ""}`}>
              <b>{d.day}</b><span>{d.short}</span>
            </div>
          ))}
        </div>

        {/* Grid: anillo a la izquierda en PC, apilado en móvil */}
        <div className="zc-grid">
          <section className="zc-left">
            <div className="zc-plate-wrap">
              <PlateRing target={caloriesTarget} consumed={totals.cal}
                         protein={totals.p} carbs={totals.c} fat={totals.f} />
              <div className="zc-plate-c">
                <div className="zc-plate-n">{fmt(shown)}</div>
                <div className="zc-plate-l">KCAL RESTANTES</div>
              </div>
            </div>

            <div className="zc-verdict">
              <i style={{ background: pct > 100 ? N.redSoft : N.red }} />
              <span className="zc-verdict-t">
                {pct > 100 ? "Te pasaste de la meta" : remaining === 0 ? "Meta alcanzada" : "Vas dentro de meta"}
              </span>
              <span className="zc-verdict-p"><b>{adherence} %</b> adherencia</span>
            </div>

            <div className="zc-macs">
              <MacroCard label="Proteína" val={totals.p} target={proteinTarget} color={N.red} />
              <MacroCard label="Carbos"   val={totals.c} target={carbsTarget}   color={N.red} />
              <MacroCard label="Grasas"   val={totals.f} target={fatTarget}     color={N.red} />
            </div>

            <div className="zc-tools">
              {TOOLS.map((t) => (
                <a key={t.label} href={t.href ?? undefined}
                   onClick={t.href ? undefined : (e) => { e.preventDefault(); openSheet(nextPending?.id ?? meals[0].id); }}
                   className="zc-tool">
                  <span className="zc-tool-i"><t.icon size={18} /></span>
                  <span>{t.label}</span>
                </a>
              ))}
            </div>
          </section>

          <section className="zc-right">
            <div className="zc-sec">
              <span className="zc-sec-t">COMIDAS</span>
              <span className="zc-sec-a">Presupuesto por comida</span>
            </div>

            {loading ? (
              <div className="zc-skel-list">
                {[0, 1, 2, 3].map((i) => <div key={i} className="zc-skel" />)}
              </div>
            ) : (
              meals.map((m) => (
                <MealRow key={m.id} meal={m} budget={budgetById[m.id]}
                         onAdd={() => openSheet(m.id)} onRemove={(eid) => removeEntry(m.id, eid)}
                         onToggle={(eid) => toggleEntryActive(m.id, eid)} />
              ))
            )}

            {coachNote && (
              <div className="zc-zena">
                <span className="zc-zena-av">Z</span>
                <p><b>ZENA:</b> {coachNote}</p>
              </div>
            )}

            {nextMeal && (
              <button className="zc-cta" onClick={() => openSheet(nextMeal.id)}>
                <Plus size={18} /> Registrar {nextMeal.label.toLowerCase()}
              </button>
            )}

            <button className="zc-regen" onClick={generatePlan} disabled={generating}>
              <RefreshCw size={15} /> Regenerar plan con IA
            </button>
          </section>
        </div>
      </div>

      <AddFoodSheet
        open={sheetFor !== null}
        meals={meals}
        budgetById={budgetById}
        initialMealId={sheetFor ?? meals[0]?.id ?? "breakfast"}
        dailyConsumed={totals.cal}
        dailyTarget={caloriesTarget}
        onClose={() => setSheetFor(null)}
        onAdd={handleAdd}
        onAddEntries={handleAddEntries}
      />

      <style>{`
        .zc-root { position: relative; min-height: 100vh; color: ${N.white}; }
        .zc-bg {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(620px 380px at 50% -6%, rgba(255,31,61,.20), transparent 66%),
            radial-gradient(420px 300px at 4% 34%, rgba(255,31,61,.07), transparent 62%),
            radial-gradient(circle at 50% 40%, transparent 42%, rgba(0,0,0,.6) 100%);
        }
        .zc-wrap { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; padding: 0 20px 120px; }

        .zc-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 16px; flex-wrap: wrap; padding: 34px 0 4px;
        }
        .zc-kick {
          display: flex; align-items: center; gap: 8px;
          font-size: 10px; font-weight: 800; letter-spacing: .26em;
          text-transform: uppercase; color: ${N.red}; margin-bottom: 10px;
        }
        .zc-kick i {
          width: 5px; height: 5px; border-radius: 50%; background: ${N.red};
          box-shadow: 0 0 9px 1px rgba(255,31,61,.85);
        }
        .zc-h1 {
          font-family: var(--font-rajdhani), ui-sans-serif, system-ui, sans-serif;
          font-size: clamp(34px, 5vw, 52px); font-weight: 700;
          letter-spacing: -.03em; line-height: 1.02;
        }
        .zc-h1 em { font-style: normal; color: ${N.red}; }
        .zc-ai {
          display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
          padding: 12px 20px; border-radius: 14px; font: inherit;
          font-size: 13px; font-weight: 700; color: ${N.redSoft};
          background: rgba(255,31,61,.10); border: 1px solid rgba(255,31,61,.34);
        }
        .zc-ai:disabled { opacity: .6; cursor: default; }
        .zc-spin {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid ${N.redSoft}; border-top-color: transparent;
          animation: zcspin 1s linear infinite;
        }
        @keyframes zcspin { to { transform: rotate(360deg); } }

        .zc-week { display: flex; gap: 6px; margin: 22px 0 4px; }
        .zc-wd {
          flex: 1; text-align: center; padding: 10px 0 9px; border-radius: 14px;
          background: ${N.pane}; border: 1px solid transparent;
        }
        .zc-wd b { display: block; font-size: 14px; font-weight: 800; color: ${N.w2}; font-variant-numeric: tabular-nums; }
        .zc-wd span { display: block; font-size: 8px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: ${N.w3}; margin-top: 3px; }
        .zc-wd.is-on {
          background: linear-gradient(165deg, rgba(255,31,61,.24), rgba(255,31,61,.07));
          border-color: rgba(255,31,61,.5);
          box-shadow: 0 0 22px -4px rgba(255,31,61,.55), inset 0 1px 0 rgba(255,255,255,.14);
        }
        .zc-wd.is-on b { color: ${N.white}; }
        .zc-wd.is-on span { color: ${N.redSoft}; }

        .zc-grid { display: flex; flex-direction: column; gap: 26px; margin-top: 26px; }

        .zc-plate-wrap { position: relative; display: grid; place-items: center; }
        .zc-plate { position: relative; display: grid; place-items: center; max-width: 100%; }
        .zc-plate svg { max-width: 100%; height: auto; }
        .zc-halo {
          position: absolute; width: 76%; height: 76%; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,31,61,.30), transparent 62%);
          filter: blur(22px); animation: zchalo 5.5s ease-in-out infinite;
        }
        @keyframes zchalo {
          0%,100% { opacity: .5; transform: scale(1); }
          50% { opacity: .95; transform: scale(1.045); }
        }
        .zc-dash { animation: zcdash 3.4s linear infinite; }
        @keyframes zcdash { to { stroke-dashoffset: -32; } }
        .zc-tip { transition: transform 1.5s cubic-bezier(.16,1,.3,1) .35s; }

        .zc-plate-c { position: absolute; text-align: center; pointer-events: none; }
        .zc-plate-n {
          font-size: clamp(52px, 9vw, 66px); font-weight: 800; letter-spacing: -.06em;
          line-height: .9; font-variant-numeric: tabular-nums;
          text-shadow: 0 0 30px rgba(255,255,255,.22);
        }
        .zc-plate-l {
          font-size: 9px; font-weight: 800; letter-spacing: .24em;
          text-transform: uppercase; color: ${N.w3}; margin-top: 12px;
        }

        .zc-verdict {
          display: flex; align-items: center; gap: 10px; margin-top: 22px;
          padding: 13px 17px; border-radius: 15px;
          background: linear-gradient(160deg, rgba(255,255,255,.075), rgba(255,255,255,.03));
          border: 1px solid ${N.edge};
        }
        .zc-verdict i {
          width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto;
          box-shadow: 0 0 11px 1px rgba(255,31,61,.9);
        }
        .zc-verdict-t { font-size: 13px; font-weight: 700; }
        .zc-verdict-p { margin-left: auto; font-size: 11.5px; color: ${N.w2}; font-variant-numeric: tabular-nums; }
        .zc-verdict-p b { color: ${N.white}; font-weight: 800; }

        .zc-macs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
        .zc-mac {
          padding: 16px 8px 14px; border-radius: 19px; text-align: center;
          background: ${N.pane}; border: 1px solid ${N.edge}; position: relative; overflow: hidden;
        }
        .zc-mac::before {
          content: ""; position: absolute; inset: 0 0 auto; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.24), transparent);
        }
        .zc-mac-r { position: relative; width: 52px; height: 52px; margin: 0 auto 10px; }
        .zc-mac-p {
          position: absolute; inset: 0; display: grid; place-items: center;
          font-size: 11px; font-weight: 800; font-variant-numeric: tabular-nums;
        }
        .zc-mac-v { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .zc-mac-v small { font-size: 10px; color: ${N.w3}; font-weight: 600; }
        .zc-mac-l {
          font-size: 8px; font-weight: 800; letter-spacing: .16em;
          text-transform: uppercase; color: ${N.w3}; margin-top: 5px;
        }

        .zc-tools { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 14px; }
        .zc-tool {
          display: grid; justify-items: center; gap: 8px; padding: 15px 4px;
          border-radius: 16px; background: ${N.pane}; border: 1px solid ${N.edge};
          font-size: 10px; font-weight: 700; color: ${N.w2}; text-decoration: none;
          cursor: pointer; transition: border-color .2s, transform .2s;
        }
        .zc-tool:hover { border-color: rgba(255,31,61,.4); transform: translateY(-2px); }
        .zc-tool-i {
          width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center;
          background: rgba(255,255,255,.05); border: 1px solid ${N.edge}; color: ${N.white};
        }

        .zc-sec {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
        }
        .zc-sec-t { font-size: 9.5px; font-weight: 800; letter-spacing: .24em; color: ${N.w3}; }
        .zc-sec-a { font-size: 10px; font-weight: 800; color: ${N.red}; }

        .zc-meal {
          padding: 15px 16px; border-radius: 20px; margin-bottom: 10px;
          background: ${N.pane}; border: 1px solid ${N.edge}; position: relative; overflow: hidden;
        }
        .zc-meal::before {
          content: ""; position: absolute; inset: 0 0 auto; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.2), transparent);
        }
        .zc-meal.is-pending {
          border-color: rgba(255,31,61,.42);
          background: linear-gradient(160deg, rgba(255,31,61,.10), rgba(255,31,61,.03));
          animation: zcpulse 3.2s ease-out 1.6s infinite;
        }
        @keyframes zcpulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,31,61,.42); }
          62% { box-shadow: 0 0 0 13px rgba(255,31,61,0); }
        }
        .zc-meal-top {
          display: flex; align-items: center; gap: 13px; width: 100%;
          background: none; border: none; padding: 0; cursor: pointer;
          font: inherit; color: inherit; text-align: left;
        }
        .zc-meal-th {
          width: 44px; height: 44px; border-radius: 14px; flex: 0 0 auto; font-size: 20px;
          display: grid; place-items: center;
          background: rgba(255,255,255,.05); border: 1px solid ${N.edge};
        }
        .zc-meal-th.is-pending {
          border-color: rgba(255,31,61,.45); background: rgba(255,31,61,.10);
          color: ${N.red}; font-weight: 800;
        }
        .zc-meal-b { flex: 1; min-width: 0; }
        .zc-meal-n { display: block; font-size: 14.5px; font-weight: 700; letter-spacing: -.016em; }
        .zc-meal-s {
          display: block; font-size: 11.5px; color: ${N.w3}; margin-top: 3px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .zc-meal-r { text-align: right; flex: 0 0 auto; }
        .zc-meal-k { display: block; font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .zc-meal-bud { display: block; font-size: 9.5px; color: ${N.w3}; margin-top: 2px; font-variant-numeric: tabular-nums; }

        .zc-track {
          height: 5px; border-radius: 3px; background: rgba(255,255,255,.07);
          margin-top: 13px; overflow: hidden;
        }
        .zc-fill {
          height: 100%; border-radius: 3px;
          transition: width 1.1s cubic-bezier(.16,1,.3,1);
        }
        .zc-tag { display: flex; align-items: center; gap: 6px; margin-top: 11px; font-size: 10.5px; font-weight: 700; }
        .zc-tag i { width: 5px; height: 5px; border-radius: 50%; flex: 0 0 auto; }

        .zc-entries { margin-top: 14px; border-top: 1px solid ${N.edge}; padding-top: 13px; display: grid; gap: 11px; }
        .zc-entry { display: flex; align-items: center; gap: 10px; }
        .zc-entry.is-off { opacity: .4; }
        .zc-entry.is-off .zc-entry-n { text-decoration: line-through; }
        .zc-entry-check {
          width: 20px; height: 20px; border-radius: 7px; flex: 0 0 auto; cursor: pointer;
          background: none; border: 1.5px solid rgba(255,255,255,.25); color: #fff;
          display: grid; place-items: center;
        }
        .zc-entry-check.is-on { background: ${N.red}; border-color: ${N.red}; }
        .zc-entry-n { font-size: 12.5px; font-weight: 600; }
        .zc-entry-m { font-size: 10px; color: ${N.w3}; margin-top: 2px; }
        .zc-entry-k { font-size: 12.5px; font-weight: 800; color: ${N.w2}; font-variant-numeric: tabular-nums; }
        .zc-entry-x { background: none; border: none; color: ${N.w3}; cursor: pointer; padding: 4px; display: grid; }
        .zc-entry-x:hover { color: ${N.red}; }
        .zc-addmore {
          display: inline-flex; align-items: center; gap: 6px; background: none; border: none;
          color: ${N.red}; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; padding: 0;
        }

        .zc-zena {
          display: flex; gap: 12px; margin-top: 16px; padding: 15px 16px; border-radius: 19px;
          background: linear-gradient(160deg, rgba(255,31,61,.13), rgba(255,31,61,.035));
          border: 1px solid rgba(255,31,61,.3);
        }
        .zc-zena-av {
          width: 28px; height: 28px; border-radius: 50%; flex: 0 0 auto;
          background: linear-gradient(145deg, ${N.red}, #c00d26);
          display: grid; place-items: center; font-size: 12px; font-weight: 900; color: #fff;
          box-shadow: 0 0 16px -2px rgba(255,31,61,.85);
        }
        .zc-zena p { font-size: 12.5px; line-height: 1.58; color: rgba(255,220,226,.9); }
        .zc-zena p b { color: #fff; font-weight: 700; }

        .zc-cta {
          display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%;
          margin-top: 18px; padding: 17px; border-radius: 18px; border: none; cursor: pointer;
          background: linear-gradient(140deg, #ff2a46, #d20f2c);
          font: inherit; font-size: 14.5px; font-weight: 800; color: #fff;
          box-shadow: 0 16px 38px -16px rgba(255,31,61,.9), inset 0 1px 0 rgba(255,255,255,.24);
        }
        .zc-regen {
          display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
          margin-top: 10px; padding: 14px; border-radius: 15px; cursor: pointer;
          background: ${N.pane}; border: 1px solid ${N.edge};
          font: inherit; font-size: 13px; font-weight: 700; color: ${N.w2};
        }
        .zc-regen:hover { border-color: rgba(255,255,255,.2); color: ${N.white}; }

        .zc-skel-list { display: grid; gap: 10px; }
        .zc-skel {
          height: 104px; border-radius: 20px; background: ${N.pane}; border: 1px solid ${N.edge};
          animation: zcskel 1.5s ease-in-out infinite;
        }
        @keyframes zcskel { 0%,100% { opacity: .5; } 50% { opacity: .9; } }

        /* ── Escritorio: dos columnas reales ── */
        @media (min-width: 960px) {
          .zc-grid { flex-direction: row; align-items: flex-start; gap: 40px; }
          .zc-left { flex: 0 0 400px; position: sticky; top: 24px; }
          .zc-right { flex: 1 1 0; min-width: 0; }
          .zc-week { max-width: 400px; }
        }
        @media (min-width: 1180px) {
          .zc-left { flex: 0 0 440px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .zc-halo, .zc-dash, .zc-meal.is-pending, .zc-skel { animation: none !important; }
          .zc-tip, .zc-fill { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
