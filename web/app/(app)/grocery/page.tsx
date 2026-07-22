"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Check, RotateCcw } from "lucide-react";
import { useMealPlanStore } from "@/store/mealPlanStore";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875" };

export default function GroceryPage() {
  const { load, getShoppingList } = useMealPlanStore();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    load();
    try { const raw = localStorage.getItem("zencrus-grocery-checked"); if (raw) setChecked(JSON.parse(raw)); } catch { /* ignore */ }
  }, [load]);

  const list = getShoppingList();
  const toggle = (name: string) => {
    const next = { ...checked, [name]: !checked[name] };
    setChecked(next);
    try { localStorage.setItem("zencrus-grocery-checked", JSON.stringify(next)); } catch { /* ignore */ }
  };
  const reset = () => { setChecked({}); try { localStorage.removeItem("zencrus-grocery-checked"); } catch { /* ignore */ } };
  const done = list.filter((i) => checked[i.name]).length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "36px 24px 100px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#6b8cce", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Nutrición</div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Lista de compras</h1>
            <p style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>Generada de tu planificador semanal</p>
          </div>
          {list.length > 0 && (
            <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: 6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", color: C.dim, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><RotateCcw size={13} /> Reiniciar</button>
          )}
        </div>

        {list.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 8, background: C.panel, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.border}` }}>
              <div style={{ height: "100%", width: `${list.length ? (done / list.length) * 100 : 0}%`, background: C.navy, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 12, color: C.dim, fontWeight: 700 }}>{done}/{list.length}</span>
          </div>
        )}

        {list.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: C.dim2 }}>
            <ShoppingCart size={40} color={C.dim2} style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: C.dim, marginBottom: 6 }}>Tu lista está vacía</div>
            <div style={{ fontSize: 13 }}>Agrega comidas en el Planificador semanal y aparecerán aquí automáticamente.</div>
          </div>
        ) : (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
            {list.map((item, i) => {
              const on = !!checked[item.name];
              return (
                <button key={item.name} onClick={() => toggle(item.name)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "14px 18px", background: "none", border: "none", borderBottom: i < list.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${on ? C.navy : C.dim2}`, background: on ? C.navy : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {on && <Check size={13} color="#fff" strokeWidth={3} />}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, color: on ? C.dim2 : C.text, textDecoration: on ? "line-through" : "none" }}>{item.name}</span>
                  <span style={{ fontSize: 12, color: C.dim2, background: C.bg, borderRadius: 8, padding: "3px 8px" }}>×{item.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
