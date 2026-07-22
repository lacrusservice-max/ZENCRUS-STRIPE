"use client";

import { useState } from "react";
import { Search, Heart, Clock, Users, X, Flame } from "lucide-react";
import { useRecipesStore, Recipe } from "@/store/recipesStore";

const C = { bg: "#08090c", panel: "#0f1218", border: "#1e2430", navy: "#1e3a8a", navySoft: "rgba(30,58,138,0.16)", text: "#f4f5f7", dim: "#9aa3b2", dim2: "#5f6875" };
const CATS: { id: Recipe["category"] | "all"; label: string }[] = [
  { id: "all", label: "Todas" }, { id: "desayuno", label: "Desayuno" }, { id: "almuerzo", label: "Almuerzo" },
  { id: "cena", label: "Cena" }, { id: "snack", label: "Snack" }, { id: "bebida", label: "Bebida" }, { id: "postre", label: "Postre" },
];

export default function RecipesPage() {
  const { getFiltered, toggleFavorite } = useRecipesStore();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<Recipe["category"] | "all">("all");
  const [open, setOpen] = useState<Recipe | null>(null);
  const recipes = getFiltered(search, cat);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "36px 24px 100px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b8cce", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Nutrición</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Recetas</h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", marginBottom: 14 }}>
          <Search size={16} color={C.dim2} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar receta, ingrediente o tag…" style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 14, fontFamily: "inherit" }} />
        </div>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 24, paddingBottom: 4 }}>
          {CATS.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} style={{ whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 999, border: `1px solid ${cat === c.id ? C.navy : C.border}`, background: cat === c.id ? C.navySoft : "transparent", color: cat === c.id ? "#8fa9dd" : C.dim, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{c.label}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
          {recipes.map((r) => (
            <div key={r.id} onClick={() => setOpen(r)} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.navy)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 34 }}>{r.emoji}</span>
                <button onClick={(e) => { e.stopPropagation(); toggleFavorite(r.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <Heart size={18} color={r.isFavorite ? "#e0556b" : C.dim2} fill={r.isFavorite ? "#e0556b" : "none"} />
                </button>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, lineHeight: 1.25 }}>{r.title}</div>
              <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.55, marginBottom: 14, minHeight: 38 }}>{r.description}</div>
              <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: C.dim2 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Flame size={13} /> {r.nutrition.calories} kcal</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> {r.prepTimeMin + r.cookTimeMin} min</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={13} /> {r.servings}</span>
              </div>
            </div>
          ))}
          {recipes.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: C.dim2 }}>Sin recetas para este filtro</div>}
        </div>
      </div>

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto" }}>
            <div style={{ padding: "22px 24px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.panel, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 30 }}>{open.emoji}</span>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{open.title}</div>
                  <div style={{ fontSize: 12, color: C.dim2, textTransform: "capitalize" }}>{open.category} · {open.difficulty}</div>
                </div>
              </div>
              <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 22 }}>
                {[["Kcal", open.nutrition.calories], ["Proteína", `${open.nutrition.protein}g`], ["Carbos", `${open.nutrition.carbs}g`], ["Grasa", `${open.nutrition.fat}g`]].map(([l, v]) => (
                  <div key={l} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{v}</div>
                    <div style={{ fontSize: 10, color: C.dim2, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 10, letterSpacing: 1 }}>INGREDIENTES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
                {open.ingredients.map((ing, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.text }}>{ing.name}</span>
                    <span style={{ color: C.dim }}>{ing.amount} {ing.unit}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 10, letterSpacing: 1 }}>PREPARACIÓN</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {open.steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 12 }}>
                    <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: C.navySoft, color: "#8fa9dd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.6 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
