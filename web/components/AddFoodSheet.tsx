"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search, Barcode, Plus, X, ChevronUp, Check, Sparkles, BookOpen, List as ListIcon, Mic,
} from "lucide-react";
import {
  scaleFood, computeAddImpact, suggestPortionFix, dialRange, type FoodBase,
} from "@/lib/portionScale";
import { buscarAlimentos, type CatalogFood } from "@/lib/foodApi";
import type { FoodEntry, MealSlot } from "@/store/nutritionStore";
import type { MealBudget } from "@/lib/mealBudget";
import type { ParsedFoodsByMeal } from "@/lib/foodListService";
import { ListInputPanel } from "@/components/nutrition/ListInputPanel";
import { ConfirmFoodsPanel } from "@/components/nutrition/ConfirmFoodsPanel";
import { RecipesPickerPanel } from "@/components/nutrition/RecipesPickerPanel";

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
  steel: "#8b8d96",
};

type AddMode = "recetas" | "lista" | "buscar" | "escanear" | "voz" | "manual";

const MODES: { id: AddMode; Icon: typeof Search; label: string }[] = [
  { id: "recetas", Icon: BookOpen, label: "Recetas" },
  { id: "lista", Icon: ListIcon, label: "Lista" },
  { id: "buscar", Icon: Search, label: "Buscar" },
  { id: "escanear", Icon: Barcode, label: "Escáner" },
  { id: "voz", Icon: Mic, label: "Voz" },
];

interface Props {
  open: boolean;
  meals: MealSlot[];
  budgetById: Record<string, MealBudget>;
  initialMealId: string;
  dailyConsumed: number;
  dailyTarget: number;
  onClose: () => void;
  onAdd: (mealId: string, entry: FoodEntry) => void;
  onAddEntries: (entriesByMeal: Record<string, FoodEntry[]>) => void;
}

const R = 86, W = 212, H = 126, CX = W / 2, CY = 112;
const ARC = `M${CX - R},${CY} A${R},${R} 0 0,1 ${CX + R},${CY}`;
const ARC_LEN = Math.PI * R;

function quickPortions(f: FoodBase): number[] {
  if (f.unit === "pza") return [1, 2, 3, 4];
  if (f.amount >= 100) return [30, 50, 100, 150];
  if (f.amount >= 30) return [15, 30, 60, 90];
  return [f.amount / 2, f.amount, f.amount * 2, f.amount * 3].map((n) => Math.round(n * 10) / 10);
}

export function AddFoodSheet({
  open, meals, budgetById, initialMealId, dailyConsumed, dailyTarget, onClose, onAdd, onAddEntries,
}: Props) {
  const [mode, setMode] = useState<AddMode>("buscar");
  const [selectedMealId, setSelectedMealId] = useState(initialMealId);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<FoodBase | null>(null);
  const [amount, setAmount] = useState(100);
  const [confirmData, setConfirmData] = useState<ParsedFoodsByMeal | null>(null);
  // Formulario manual
  const [mName, setMName] = useState("");
  const [mCal, setMCal] = useState("");
  const [mProt, setMProt] = useState("");
  const [mCarbs, setMCarbs] = useState("");
  const [mFat, setMFat] = useState("");
  const [mFiber, setMFiber] = useState("");
  const [mAmount, setMAmount] = useState("100");
  const [mUnit, setMUnit] = useState("g");
  const dialRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSelectedMealId(initialMealId);
  }, [open, initialMealId]);

  useEffect(() => {
    if (!open) { setPicked(null); setQuery(""); setMode("buscar"); setConfirmData(null); }
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const mealLabel = meals.find((m) => m.id === selectedMealId)?.label ?? "";
  const budget = budgetById[selectedMealId]?.budget ?? 0;
  const currentKcal = budgetById[selectedMealId]?.consumed ?? 0;
  const mealEmojis = Object.fromEntries(meals.map((m) => [m.id, m.emoji]));
  const mealLabels = Object.fromEntries(meals.map((m) => [m.id, m.label]));
  const mealOrder = meals.map((m) => m.id);

  // Búsqueda contra el catálogo real (10.611 alimentos), no contra la lista
  // local de quince que había antes. Se espera 250 ms desde la última tecla
  // para no lanzar una petición por pulsación, y cada respuesta comprueba que
  // sigue siendo la vigente: al escribir rápido las peticiones vuelven
  // desordenadas y sin esto una respuesta vieja pisa a la nueva.
  const [results, setResults] = useState<CatalogFood[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    let vigente = true;
    const t = setTimeout(async () => {
      if (!vigente) return;
      setBuscando(true);
      const r = await buscarAlimentos(query);
      if (!vigente) return;
      setResults(r);
      setBuscando(false);
    }, 250);
    return () => { vigente = false; clearTimeout(t); };
  }, [query]);

  const scaled = picked ? scaleFood(picked, amount) : null;
  const range = picked ? dialRange(picked) : { min: 0, max: 200, step: 5 };
  const fix = picked ? suggestPortionFix(picked, currentKcal, budget, amount) : null;
  const impact = computeAddImpact(currentKcal, budget, scaled?.calories ?? 0);

  const pct = Math.min(Math.max(amount / Math.max(range.max, 1), 0), 1);
  const angle = Math.PI * (1 - pct);
  const knobX = CX - R * Math.cos(angle);
  const knobY = CY - R * Math.sin(angle);

  const setFromPointer = (clientX: number) => {
    const el = dialRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    const raw = p * range.max;
    setAmount(Math.round(raw / range.step) * range.step);
  };

  const handleClose = () => { setMode("buscar"); setPicked(null); setQuery(""); setConfirmData(null); onClose(); };
  const handleModeChange = (next: AddMode) => { setMode(next); setPicked(null); setQuery(""); };

  const addManual = () => {
    if (!mName || !mCal) return;
    onAdd(selectedMealId, {
      id: `${Date.now()}`,
      timestamp: Date.now(),
      name: mName, calories: +mCal, protein: +mProt || 0, carbs: +mCarbs || 0,
      fat: +mFat || 0, fiber: +mFiber || 0, amount: +mAmount || 1, unit: mUnit,
      active: true,
    });
    setMName(""); setMCal(""); setMProt(""); setMCarbs(""); setMFat(""); setMFiber(""); setMAmount("100");
    handleClose();
  };

  const handleAddMore = (mealIdToFocus: string) => {
    setConfirmData(null);
    setSelectedMealId(mealIdToFocus);
    setMode("lista");
  };

  const handleConfirmAdd = (entriesByMeal: Record<string, FoodEntry[]>) => {
    onAddEntries(entriesByMeal);
    handleClose();
  };

  if (!open) return null;

  const showMealChips = mode === "buscar" || mode === "escanear" || mode === "recetas" || mode === "manual";
  const isDayWide = mode === "lista" || mode === "voz";
  const showingConfirm = !!confirmData;

  return (
    <div className="afs-back" onClick={handleClose} role="presentation">
      <div className="afs" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
           aria-label={showingConfirm ? "Confirma tus alimentos" : `Agregar a ${mealLabel}`}>

        {/* Cabecera */}
        <header className="afs-head">
          <button className="afs-x" onClick={handleClose} aria-label="Cerrar"><X size={18} /></button>
          <div className="afs-t">
            <div className="afs-k">{showingConfirm ? "CONFIRMA" : isDayWide ? "AGREGAR ALIMENTOS" : "AGREGAR A"}</div>
            <div className="afs-n">{showingConfirm ? "Tus alimentos" : isDayWide ? "Tu día completo" : mealLabel}</div>
          </div>
          {!showingConfirm && !isDayWide && (
            <div className="afs-bud">
              <b>{Math.max(0, budget - currentKcal)}</b>
              <span>KCAL LIBRES</span>
            </div>
          )}
        </header>

        {showingConfirm ? (
          <div className="afs-body">
            <ConfirmFoodsPanel
              parsedByMeal={confirmData ?? {}}
              mealOrder={mealOrder}
              mealLabels={mealLabels}
              mealEmojis={mealEmojis}
              dailyConsumed={dailyConsumed}
              dailyTarget={dailyTarget}
              onAddMore={handleAddMore}
              onConfirm={handleConfirmAdd}
            />
          </div>
        ) : (
          <>
            {/* Selector de comida */}
            {showMealChips && (
              <div className="afs-meal-chips">
                {meals.map((m) => (
                  <button
                    key={m.id}
                    className={`afs-meal-chip${m.id === selectedMealId ? " is-on" : ""}`}
                    onClick={() => { setSelectedMealId(m.id); setPicked(null); setQuery(""); }}
                  >
                    <span>{m.emoji}</span> {m.label}
                  </button>
                ))}
              </div>
            )}

            <div className="afs-body">
              {mode === "buscar" && (
                <>
                  <div className="afs-search">
                    <Search size={16} color={N.w3} />
                    <input value={query} onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
                           placeholder="Busca un alimento..." autoFocus aria-label="Buscar alimento" />
                  </div>

                  <div className="afs-list">
                    {/* La consulta va al servidor: sin esto la lista parece
                        vacía mientras responde y da la impresión de que no
                        existe el alimento. */}
                    {buscando && results.length === 0 && (
                      <p style={{ color: N.w3, fontSize: 13, padding: "14px 4px" }}>
                        Buscando en el catálogo…
                      </p>
                    )}
                    {results.map((f) => {
                      const isOpen = picked?.name === f.name;
                      if (!isOpen) {
                        return (
                          <button key={f.name} className="afs-row"
                                  onClick={() => { setPicked(f); setAmount(f.amount); }}>
                            <span className="afs-row-b">
                              <span className="afs-row-n">{f.name}</span>
                              <span className="afs-row-m">
                                {f.calories} kcal · P {Math.round(f.protein)} · C {Math.round(f.carbs)} · G {Math.round(f.fat)}
                                {/* De dónde sale el dato: distingue una fuente
                                    oficial de un valor tecleado a mano. */}
                                {f.sourceLabel && (
                                  <> · <span style={{ color: N.w2 }}>
                                    {f.verified ? "Verificado · " : ""}{f.sourceLabel}
                                  </span></>
                                )}
                              </span>
                              <span className="afs-row-bar">
                                {f.protein > 0 && <i style={{ flex: f.protein * 4, background: N.white }} />}
                                {f.carbs > 0 && <i style={{ flex: f.carbs * 4, background: N.red }} />}
                                {f.fat > 0 && <i style={{ flex: f.fat * 9, background: N.steel }} />}
                              </span>
                            </span>
                            <span className="afs-row-add"><Plus size={16} /></span>
                          </button>
                        );
                      }

                      return (
                        <div key={f.name} className="afs-row is-open">
                          <div className="afs-open-top">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="afs-row-n">{f.name}</div>
                              <div className="afs-row-m">Ajusta la porción</div>
                            </div>
                            <button className="afs-fold" onClick={() => setPicked(null)} aria-label="Contraer">
                              <ChevronUp size={15} />
                            </button>
                          </div>

                          <div className="afs-scale">
                            <div className="afs-readout">{scaled?.calories ?? 0}</div>
                            <div className="afs-readout-u">
                              KCAL EN {Math.round(amount)} {f.unit.toUpperCase()}
                            </div>

                            <div className="afs-dial" ref={dialRef}
                                 onPointerDown={(e) => {
                                   try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* noop */ }
                                   setFromPointer(e.clientX);
                                 }}
                                 onPointerMove={(e) => { if (e.buttons === 1) setFromPointer(e.clientX); }}
                                 role="slider" tabIndex={0}
                                 aria-label="Cantidad" aria-valuemin={0} aria-valuemax={range.max} aria-valuenow={amount}
                                 onKeyDown={(e) => {
                                   if (e.key === "ArrowRight") setAmount((v) => Math.min(v + range.step, range.max));
                                   if (e.key === "ArrowLeft") setAmount((v) => Math.max(v - range.step, 0));
                                 }}>
                              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
                                <defs>
                                  <linearGradient id="afs-g" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0" stopColor={N.redSoft} />
                                    <stop offset="1" stopColor={N.red} />
                                  </linearGradient>
                                  <filter id="afs-glow" x="-60%" y="-60%" width="220%" height="220%">
                                    <feGaussianBlur stdDeviation="6" result="b" />
                                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                                  </filter>
                                </defs>
                                <path d={ARC} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={11} strokeLinecap="round" />
                                <path className="afs-arc" d={ARC} fill="none" stroke="url(#afs-g)" strokeWidth={11}
                                      strokeLinecap="round" filter="url(#afs-glow)"
                                      strokeDasharray={ARC_LEN} strokeDashoffset={0} />
                                <circle cx={knobX} cy={knobY} r={13} fill="rgba(255,255,255,.22)" />
                                <circle cx={knobX} cy={knobY} r={9} fill="#fff" />
                              </svg>
                              <div className="afs-dial-c">
                                <div className="afs-dial-v">{Math.round(amount)}</div>
                                <div className="afs-dial-u">{f.unit === "g" ? "gramos" : f.unit}</div>
                              </div>
                            </div>

                            <div className="afs-quick">
                              {quickPortions(f).map((q) => (
                                <button key={q} className={`afs-q${Math.round(amount) === Math.round(q) ? " is-on" : ""}`}
                                        onClick={() => setAmount(q)}>
                                  {q} {f.unit}
                                </button>
                              ))}
                            </div>

                            <div className="afs-smac">
                              {[
                                { l: "Proteína", v: scaled?.protein ?? 0, max: 60, c: N.white },
                                { l: "Carbos", v: scaled?.carbs ?? 0, max: 90, c: N.red },
                                { l: "Grasas", v: scaled?.fat ?? 0, max: 40, c: N.steel },
                              ].map((mm) => (
                                <div key={mm.l} className="afs-smac-r">
                                  <span className="afs-smac-l">{mm.l}</span>
                                  <span className="afs-smac-t">
                                    <i style={{ width: `${Math.min(mm.v / mm.max, 1) * 100}%`, background: mm.c }} />
                                  </span>
                                  <span className="afs-smac-v">{mm.v} g</span>
                                </div>
                              ))}
                            </div>

                            <div className={`afs-impact${impact.exceeds ? " is-over" : ""}`}>
                              <div className="afs-impact-h">
                                <span className="afs-impact-l">Tu comida tras agregar</span>
                                <span className="afs-impact-v">{impact.total}<small> / {impact.budget}</small></span>
                              </div>
                              <div className="afs-ibar">
                                <i style={{ flex: Math.max(impact.total - impact.over, 1), background: N.white }} />
                                {impact.over > 0 && <i style={{ flex: impact.over, background: N.red }} />}
                                {impact.remaining > 0 && <i style={{ flex: impact.remaining, background: "rgba(255,255,255,.08)" }} />}
                              </div>
                              {impact.exceeds ? (
                                <>
                                  <p className="afs-warn">
                                    Te pasarás <b>{impact.over} kcal</b> del presupuesto.
                                    Se descontarán de tu siguiente comida.
                                  </p>
                                  {fix !== null && (
                                    <button className="afs-fix" onClick={() => setAmount(fix)}>
                                      <Sparkles size={13} /> Bájalo a {fix} {f.unit} y cierra exacto
                                    </button>
                                  )}
                                </>
                              ) : (
                                <p className="afs-ok">
                                  Te quedarán <b>{impact.remaining} kcal</b> de presupuesto
                                </p>
                              )}
                            </div>

                            <button className="afs-confirm"
                                    onClick={() => {
                                      if (!scaled) return;
                                      onAdd(selectedMealId, {
                                        id: `${Date.now()}`,
                                        timestamp: Date.now(),
                                        name: f.name,
                                        calories: scaled.calories, protein: scaled.protein,
                                        carbs: scaled.carbs, fat: scaled.fat, fiber: scaled.fiber ?? 0,
                                        amount: scaled.amount, unit: scaled.unit,
                                        active: true,
                                      });
                                      setPicked(null);
                                      handleClose();
                                    }}>
                              <Check size={17} /> Agregar {Math.round(amount)} {f.unit}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {!picked && (
                      <button className="afs-manual-link" onClick={() => setMode("manual")}>
                        ¿No lo encuentras? Añádelo a mano
                      </button>
                    )}
                  </div>
                </>
              )}

              {mode === "escanear" && (
                <div className="afs-soon">
                  <Barcode size={34} />
                  <b>Escáner de código de barras</b>
                  <span>
                    Disponible en la app móvil, que tiene acceso a la cámara del
                    teléfono. Aquí puedes registrar buscando el alimento.
                  </span>
                  <button className="afs-soon-btn" onClick={() => setMode("buscar")}>
                    <Search size={14} /> Buscar alimento
                  </button>
                </div>
              )}

              {mode === "recetas" && (
                <RecipesPickerPanel onAdd={(entry) => { onAdd(selectedMealId, entry); handleClose(); }} />
              )}

              {mode === "lista" && (
                <ListInputPanel
                  mode="lista"
                  mealOrder={mealOrder}
                  mealLabels={mealLabels}
                  mealEmojis={mealEmojis}
                  onParsed={setConfirmData}
                />
              )}

              {mode === "voz" && (
                <ListInputPanel
                  mode="voz"
                  mealOrder={mealOrder}
                  mealLabels={mealLabels}
                  mealEmojis={mealEmojis}
                  initialFocusMeal={selectedMealId}
                  onParsed={setConfirmData}
                />
              )}

              {mode === "manual" && (
                <div className="afs-manual">
                  <label className="afs-field-label">Nombre del alimento *</label>
                  <input className="afs-field" value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Ej. Tacos de canasta" />

                  <div className="afs-field-row">
                    <div>
                      <label className="afs-field-label">Calorías *</label>
                      <input className="afs-field" type="number" value={mCal} onChange={(e) => setMCal(e.target.value)} placeholder="300" />
                    </div>
                    <div>
                      <label className="afs-field-label">Cantidad</label>
                      <input className="afs-field" type="number" value={mAmount} onChange={(e) => setMAmount(e.target.value)} placeholder="100" />
                    </div>
                  </div>

                  <div className="afs-field-row">
                    <div>
                      <label className="afs-field-label">Proteína (g)</label>
                      <input className="afs-field" type="number" value={mProt} onChange={(e) => setMProt(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label className="afs-field-label">Carbos (g)</label>
                      <input className="afs-field" type="number" value={mCarbs} onChange={(e) => setMCarbs(e.target.value)} placeholder="0" />
                    </div>
                  </div>

                  <div className="afs-field-row">
                    <div>
                      <label className="afs-field-label">Grasas (g)</label>
                      <input className="afs-field" type="number" value={mFat} onChange={(e) => setMFat(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label className="afs-field-label">Fibra (g)</label>
                      <input className="afs-field" type="number" value={mFiber} onChange={(e) => setMFiber(e.target.value)} placeholder="0" />
                    </div>
                  </div>

                  <button className="afs-confirm" onClick={addManual} disabled={!mName || !mCal}>
                    Agregar alimento
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Barra inferior fija de modos */}
        {!showingConfirm && (
          <div className="afs-modes">
            {MODES.map((mm) => (
              <button key={mm.id}
                      className={`afs-mode${mode === mm.id ? " is-on" : ""}`}
                      onClick={() => handleModeChange(mm.id)}>
                <span className={`afs-mode-icon${mode === mm.id ? " is-on" : ""}`}><mm.Icon size={16} /></span>
                <span>{mm.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .afs-back {
          position: fixed; inset: 0; z-index: 200; display: flex;
          align-items: flex-end; justify-content: center;
          background: rgba(0,0,0,.72); backdrop-filter: blur(4px);
          animation: afsFade .22s ease;
        }
        @keyframes afsFade { from { opacity: 0; } to { opacity: 1; } }
        .afs {
          position: relative; width: 100%; max-width: 560px; max-height: 92vh;
          display: flex; flex-direction: column; overflow: hidden;
          background: ${N.void}; color: ${N.white};
          border: 1px solid ${N.edge}; border-bottom: none;
          border-radius: 26px 26px 0 0;
          animation: afsUp .34s cubic-bezier(.16,1,.3,1);
        }
        @keyframes afsUp { from { transform: translateY(34px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (min-width: 720px) {
          .afs-back { align-items: center; }
          .afs { border-radius: 26px; border-bottom: 1px solid ${N.edge}; max-height: 88vh; }
        }

        .afs-head {
          position: relative; display: flex; align-items: center; gap: 12px;
          padding: 20px 18px 15px; flex: 0 0 auto;
        }
        .afs-x {
          width: 34px; height: 34px; border-radius: 11px; flex: 0 0 auto; cursor: pointer;
          background: rgba(255,255,255,.05); border: 1px solid ${N.edge}; color: ${N.w2};
          display: grid; place-items: center;
        }
        .afs-t { flex: 1; min-width: 0; }
        .afs-k { font-size: 8.5px; font-weight: 800; letter-spacing: .22em; color: ${N.red}; margin-bottom: 4px; }
        .afs-n { font-size: 19px; font-weight: 800; letter-spacing: -.028em; }
        .afs-bud {
          text-align: right; flex: 0 0 auto; padding: 7px 11px; border-radius: 12px;
          background: rgba(255,31,61,.12); border: 1px solid rgba(255,31,61,.3);
        }
        .afs-bud b { display: block; font-size: 14px; font-weight: 800; color: ${N.redSoft}; font-variant-numeric: tabular-nums; }
        .afs-bud span { display: block; font-size: 7.5px; font-weight: 800; letter-spacing: .12em; color: ${N.w3}; margin-top: 2px; }

        .afs-meal-chips { display: flex; gap: 8px; overflow-x: auto; padding: 0 18px 12px; flex: 0 0 auto; }
        .afs-meal-chip {
          flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 13px; border-radius: 999px; cursor: pointer; font: inherit;
          font-size: 11.5px; font-weight: 700; color: ${N.w2}; white-space: nowrap;
          background: ${N.pane}; border: 1px solid ${N.edge};
        }
        .afs-meal-chip.is-on { background: rgba(255,31,61,.16); border-color: rgba(255,31,61,.46); color: ${N.redSoft}; }

        .afs-modes { display: flex; padding: 10px 10px 0; border-top: 1px solid ${N.edge}; flex: 0 0 auto; }
        .afs-mode {
          flex: 1; display: grid; justify-items: center; gap: 4px; padding-bottom: 10px;
          background: none; border: none; color: ${N.w2}; cursor: pointer;
          font: inherit; font-size: 9.5px; font-weight: 700;
        }
        .afs-mode.is-on { color: ${N.white}; font-weight: 800; }
        .afs-mode-icon {
          width: 34px; height: 34px; border-radius: 12px; display: grid; place-items: center;
          background: transparent;
        }
        .afs-mode-icon.is-on { background: ${N.red}; color: #fff; }

        .afs-body { position: relative; flex: 1 1 auto; overflow-y: auto; padding: 0 18px 22px; }
        .afs-body::-webkit-scrollbar { width: 4px; }
        .afs-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.14); border-radius: 2px; }

        .afs-hint { font-size: 12px; color: ${N.w3}; margin: 0 0 14px; }

        .afs-search {
          display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
          padding: 13px 15px; border-radius: 16px;
          background: ${N.pane}; border: 1px solid ${N.edge};
        }
        .afs-search input {
          flex: 1; background: none; border: none; outline: none;
          color: ${N.white}; font: inherit; font-size: 14px;
        }
        .afs-search input::placeholder { color: ${N.w3}; }

        .afs-list { display: grid; gap: 8px; }
        .afs-row {
          display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
          padding: 13px; border-radius: 17px; cursor: pointer; font: inherit; color: inherit;
          background: ${N.pane}; border: 1px solid ${N.edge};
          transition: border-color .18s, transform .18s;
        }
        .afs-row:hover { border-color: rgba(255,31,61,.36); transform: translateY(-1px); }
        .afs-row.is-open {
          display: block; cursor: default; transform: none;
          border-color: rgba(255,31,61,.34); background: rgba(255,31,61,.06);
        }
        .afs-open-top { display: flex; align-items: center; gap: 12px; }
        .afs-row-b { flex: 1; min-width: 0; display: block; }
        .afs-row-n { display: block; font-size: 13px; font-weight: 700; letter-spacing: -.012em; }
        .afs-row-m { display: block; font-size: 10px; color: ${N.w3}; margin-top: 3px; }
        .afs-row-bar { display: flex; gap: 2px; height: 4px; margin-top: 8px; max-width: 150px; }
        .afs-row-bar i { border-radius: 2px; }
        .afs-row-add {
          width: 30px; height: 30px; border-radius: 10px; flex: 0 0 auto; display: grid; place-items: center;
          background: rgba(255,31,61,.14); border: 1px solid rgba(255,31,61,.36); color: ${N.red};
        }
        .afs-fold {
          width: 26px; height: 26px; border-radius: 8px; flex: 0 0 auto; cursor: pointer;
          background: rgba(255,255,255,.05); border: 1px solid ${N.edge}; color: ${N.w3};
          display: grid; place-items: center;
        }
        .afs-manual-link {
          display: block; width: 100%; text-align: center; margin-top: 6px; padding: 12px;
          background: none; border: none; color: ${N.w2}; font: inherit; font-size: 12px; cursor: pointer;
        }
        .afs-manual-link:hover { color: ${N.white}; }

        .afs-scale { margin-top: 14px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,.09); }
        .afs-readout {
          font-size: 54px; font-weight: 800; letter-spacing: -.06em; line-height: .9;
          text-align: center; font-variant-numeric: tabular-nums;
          text-shadow: 0 0 30px rgba(255,255,255,.22);
        }
        .afs-readout-u {
          font-size: 9px; font-weight: 800; letter-spacing: .24em; color: ${N.w3};
          text-align: center; margin-top: 11px;
        }
        .afs-dial { position: relative; display: grid; place-items: center; cursor: ew-resize; touch-action: none; }
        .afs-dial:focus-visible { outline: 2px solid ${N.redSoft}; outline-offset: 4px; border-radius: 12px; }
        .afs-dial-c { position: absolute; bottom: 6px; text-align: center; pointer-events: none; }
        .afs-dial-v { font-size: 30px; font-weight: 800; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
        .afs-dial-u { font-size: 11px; color: ${N.w3}; font-weight: 700; margin-top: 4px; }

        .afs-quick { display: grid; grid-template-columns: repeat(4,1fr); gap: 7px; margin-top: 6px; }
        .afs-q {
          padding: 11px 2px; border-radius: 13px; cursor: pointer; font: inherit;
          font-size: 11px; font-weight: 700; color: ${N.w2};
          background: rgba(255,255,255,.05); border: 1px solid ${N.edge};
        }
        .afs-q.is-on { background: rgba(255,31,61,.18); border-color: rgba(255,31,61,.46); color: ${N.redSoft}; }

        .afs-smac { display: grid; gap: 9px; margin-top: 16px; }
        .afs-smac-r { display: grid; grid-template-columns: 58px 1fr 46px; align-items: center; gap: 10px; }
        .afs-smac-l { font-size: 10.5px; color: ${N.w2}; }
        .afs-smac-t { height: 5px; border-radius: 3px; background: rgba(255,255,255,.07); overflow: hidden; }
        .afs-smac-t i { display: block; height: 100%; border-radius: 3px; transition: width .35s cubic-bezier(.16,1,.3,1); }
        .afs-smac-v { font-size: 11px; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }

        .afs-impact {
          margin-top: 18px; padding: 16px; border-radius: 19px;
          background: ${N.paneHi}; border: 1px solid ${N.edge};
        }
        .afs-impact.is-over { border-color: rgba(255,31,61,.4); background: rgba(255,31,61,.07); }
        .afs-impact-h { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
        .afs-impact-l { font-size: 11px; color: ${N.w3}; }
        .afs-impact-v { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .afs-impact-v small { font-size: 11px; color: ${N.w3}; font-weight: 600; }
        .afs-ibar { display: flex; height: 9px; border-radius: 5px; overflow: hidden; background: rgba(255,255,255,.07); }
        .afs-ibar i { transition: flex-grow .4s cubic-bezier(.16,1,.3,1); }
        .afs-warn { font-size: 11.5px; line-height: 1.5; color: ${N.w2}; margin-top: 12px; }
        .afs-warn b { color: ${N.redSoft}; font-weight: 700; }
        .afs-ok { font-size: 11.5px; color: ${N.w2}; margin-top: 12px; }
        .afs-ok b { color: ${N.white}; font-weight: 700; }
        .afs-fix {
          display: inline-flex; align-items: center; gap: 7px; margin-top: 11px; cursor: pointer;
          padding: 9px 13px; border-radius: 11px; font: inherit; font-size: 11.5px; font-weight: 700;
          background: rgba(255,255,255,.06); border: 1px solid ${N.edge}; color: ${N.white};
        }
        .afs-fix:hover { border-color: rgba(255,31,61,.4); }

        .afs-confirm {
          display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%;
          margin-top: 16px; padding: 16px; border-radius: 17px; border: none; cursor: pointer;
          background: linear-gradient(140deg, #ff2a46, #d20f2c);
          font: inherit; font-size: 14.5px; font-weight: 800; color: #fff;
          box-shadow: 0 14px 32px -16px rgba(255,31,61,.9);
        }
        .afs-confirm:disabled { opacity: .4; cursor: default; box-shadow: none; }

        .afs-soon {
          display: grid; justify-items: center; gap: 10px; text-align: center;
          padding: 46px 24px; color: ${N.w3};
        }
        .afs-soon b { font-size: 15px; color: ${N.white}; font-weight: 800; }
        .afs-soon span { font-size: 12.5px; line-height: 1.6; max-width: 34ch; }
        .afs-soon-btn {
          display: inline-flex; align-items: center; gap: 7px; margin-top: 6px; cursor: pointer;
          padding: 11px 18px; border-radius: 12px; font: inherit; font-size: 12.5px; font-weight: 700;
          background: rgba(255,31,61,.14); border: 1px solid rgba(255,31,61,.36); color: ${N.redSoft};
        }

        /* ── Manual ── */
        .afs-manual { display: flex; flex-direction: column; gap: 14px; }
        .afs-field-label {
          display: block; font-size: 10px; font-weight: 700; color: ${N.w2};
          text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px;
        }
        .afs-field {
          width: 100%; padding: 12px 13px; border-radius: 12px; font: inherit; font-size: 14px;
          background: ${N.pane}; border: 1px solid ${N.edge}; color: ${N.white}; outline: none;
        }
        .afs-field:focus { border-color: rgba(255,31,61,.4); }
        .afs-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        /* ── Lista / Voz ── */
        .afs-list-input { display: flex; flex-direction: column; }
        .afs-voice-hint {
          display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px;
          padding: 12px 14px; border-radius: 14px;
          background: rgba(255,31,61,.1); border: 1px solid rgba(255,31,61,.25); color: ${N.w2};
          font-size: 11.5px; line-height: 1.5;
        }
        .afs-meal-block { margin-bottom: 16px; }
        .afs-meal-block-head { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; font-size: 12.5px; font-weight: 800; }
        .afs-meal-block textarea {
          width: 100%; min-height: 64px; padding: 12px 13px; border-radius: 12px; resize: vertical;
          background: ${N.pane}; border: 1px solid ${N.edge}; color: ${N.white};
          font: inherit; font-size: 13.5px; line-height: 1.5; outline: none;
        }
        .afs-meal-block textarea:focus { border-color: rgba(255,31,61,.4); }

        /* ── Recetas ── */
        .afs-recipes-list { display: grid; gap: 10px; }
        .afs-recipe-card {
          display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
          padding: 14px; border-radius: 17px; cursor: pointer; font: inherit; color: inherit;
          background: ${N.pane}; border: 1px solid ${N.edge};
        }
        .afs-recipe-card:hover { border-color: rgba(255,31,61,.36); }
        .afs-recipe-emoji { font-size: 24px; }
        .afs-recipe-title { display: block; font-size: 13.5px; font-weight: 700; }
        .afs-recipe-sub { display: block; font-size: 11px; color: ${N.w3}; margin-top: 3px; }
        .afs-recipe-add {
          width: 30px; height: 30px; border-radius: 10px; flex: 0 0 auto; display: grid; place-items: center;
          background: rgba(255,31,61,.14); border: 1px solid rgba(255,31,61,.36); color: ${N.red};
        }

        /* ── Confirmar alimentos ── */
        .afs-confirm-screen { display: flex; flex-direction: column; }
        .afs-confirm-totals {
          margin-bottom: 16px; padding: 16px; border-radius: 17px;
          background: ${N.pane}; border: 1px solid ${N.edge};
        }
        .afs-confirm-totals-row { display: flex; justify-content: space-between; align-items: flex-start; }
        .afs-confirm-kcal { font-size: 28px; font-weight: 900; font-variant-numeric: tabular-nums; }
        .afs-confirm-kcal small { font-size: 13px; font-weight: 600; color: ${N.w3}; }
        .afs-confirm-macros { font-size: 11.5px; color: ${N.w2}; font-weight: 600; margin-top: 2px; }
        .afs-confirm-budget { text-align: right; }
        .afs-confirm-budget b { display: block; font-size: 18px; font-weight: 900; }
        .afs-confirm-budget span { font-size: 8.5px; font-weight: 800; color: ${N.w3}; letter-spacing: .05em; }
        .afs-confirm-bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,.07); overflow: hidden; margin-top: 12px; }
        .afs-confirm-bar i { display: block; height: 100%; background: ${N.red}; transition: width .4s cubic-bezier(.16,1,.3,1); }
        .afs-confirm-meal { margin-bottom: 18px; }
        .afs-confirm-meal-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; font-weight: 800; }
        .afs-confirm-meal-kcal { margin-left: auto; font-size: 12px; font-weight: 700; color: ${N.w2}; }
        .afs-confirm-item {
          display: flex; align-items: center; gap: 12px; padding: 12px; margin-bottom: 8px; cursor: pointer;
          border-radius: 14px; background: ${N.pane}; border: 1px solid ${N.edge};
        }
        .afs-confirm-item:hover { border-color: rgba(255,31,61,.3); }
        .afs-confirm-item-emoji { font-size: 20px; }
        .afs-confirm-item-name { display: block; font-size: 13.5px; font-weight: 700; }
        .afs-confirm-item-sub { display: block; font-size: 11px; color: ${N.w3}; margin-top: 2px; }
        .afs-confirm-item-kcal { font-size: 13.5px; font-weight: 800; color: ${N.w2}; }
        .afs-confirm-item-del {
          background: none; border: none; color: ${N.w3}; cursor: pointer; padding: 6px; display: grid;
        }
        .afs-confirm-item-del:hover { color: ${N.red}; }
        .afs-confirm-addmore { background: none; border: none; color: ${N.red}; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; padding: 0; }
        .afs-confirm-empty { text-align: center; color: ${N.w3}; font-size: 13px; padding: 30px 0; }
        .afs-confirm-cta {
          width: 100%; margin-top: 8px; padding: 16px; border-radius: 17px; border: none; cursor: pointer;
          background: linear-gradient(140deg, #ff2a46, #d20f2c);
          font: inherit; font-size: 14.5px; font-weight: 800; color: #fff;
          box-shadow: 0 14px 32px -16px rgba(255,31,61,.9);
        }
        .afs-confirm-cta:disabled { opacity: .4; cursor: default; box-shadow: none; }

        .afs-edit-backdrop {
          position: fixed; inset: 0; z-index: 300; display: grid; place-items: center;
          background: rgba(0,0,0,.65); padding: 24px;
        }
        .afs-edit-card {
          width: 100%; max-width: 320px; padding: 20px; border-radius: 18px;
          background: #111114; border: 1px solid ${N.edge};
        }
        .afs-edit-title { font-size: 11px; font-weight: 700; color: ${N.w2}; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 10px; }
        .afs-edit-card input {
          width: 100%; padding: 12px; border-radius: 12px; text-align: center;
          background: ${N.pane}; border: 1.5px solid ${N.edge}; color: ${N.white};
          font-size: 22px; font-weight: 800; outline: none;
        }
        .afs-edit-btns { display: flex; gap: 10px; margin-top: 16px; }
        .afs-edit-cancel, .afs-edit-save {
          flex: 1; padding: 12px; border-radius: 12px; border: none; cursor: pointer;
          font: inherit; font-size: 13px; font-weight: 700;
        }
        .afs-edit-cancel { background: rgba(255,255,255,.06); color: ${N.w2}; }
        .afs-edit-save { background: ${N.red}; color: #fff; font-weight: 800; }

        @media (prefers-reduced-motion: reduce) {
          .afs-back, .afs { animation: none !important; }
          .afs-smac-t i, .afs-ibar i, .afs-confirm-bar i { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
