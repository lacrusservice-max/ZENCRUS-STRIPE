import api from "@/lib/api";
import type { FoodBase } from "@/lib/portionScale";
import { FOOD_DB } from "@/lib/foodDb";

/**
 * Búsqueda de alimentos contra el catálogo real.
 *
 * La web venía buscando sobre `FOOD_DB`, una lista de quince alimentos escrita
 * a mano. La app móvil, en cambio, consulta `/foods/search`, que llega a los
 * 10.611 alimentos de la base — 7.756 del USDA y 2.855 del Sistema Mexicano de
 * Alimentos Equivalentes con sus medidas caseras. Las dos plataformas
 * enseñaban catálogos distintos para la misma cuenta.
 *
 * Aquí se conecta la web a la misma fuente. La lista local se queda como
 * respaldo para cuando no hay red o el backend no responde: quince alimentos
 * son mejor que un buscador vacío, y así la pantalla nunca se queda muerta.
 */

export interface CatalogFood extends FoodBase {
  /** Identificador del catálogo; ausente en los de respaldo. */
  id?: string;
  /** «SMAE · 5.ª edición», «USDA FoodData Central»… */
  sourceLabel?: string;
  verified?: boolean;
  /** Medidas caseras declaradas por la fuente («1/2 taza» = 90 g). */
  servings?: { description: string; grams: number }[];
}

interface RespuestaAlimento {
  id: string;
  name: string;
  verified?: boolean;
  sourceLabel?: string;
  per100?: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  servings?: { description: string; grams: number }[];
}

/**
 * El backend devuelve todo por 100 g, que es como se guarda el catálogo.
 * `FoodBase` espera los valores para su propio `amount`, así que la porción
 * base son 100 g y `scaleFood` se encarga del resto.
 */
function aFoodBase(f: RespuestaAlimento): CatalogFood | null {
  const p = f.per100;
  // Sin energía no sirve para registrar una comida; no se inventa un valor.
  if (!p || typeof p.calories !== "number") return null;
  return {
    id: f.id,
    name: f.name,
    calories: p.calories,
    protein: p.protein ?? 0,
    carbs: p.carbs ?? 0,
    fat: p.fat ?? 0,
    fiber: p.fiber ?? 0,
    amount: 100,
    unit: "g",
    verified: f.verified,
    sourceLabel: f.sourceLabel,
    servings: f.servings,
  };
}

function respaldoLocal(q: string): CatalogFood[] {
  const t = q.trim().toLowerCase();
  return t.length > 1
    ? FOOD_DB.filter((f) => f.name.toLowerCase().includes(t)).slice(0, 12)
    : FOOD_DB.slice(0, 12);
}

export async function buscarAlimentos(query: string): Promise<CatalogFood[]> {
  const q = query.trim();
  if (q.length < 2) return respaldoLocal(q);

  try {
    const { data } = await api.get("/foods/search", { params: { q, limit: 20 } });
    const lista: RespuestaAlimento[] = data?.data ?? data?.foods ?? data ?? [];
    if (!Array.isArray(lista)) return respaldoLocal(q);

    const out = lista.map(aFoodBase).filter((f): f is CatalogFood => f !== null);
    // Si el catálogo no conoce el término, la lista local aún puede acertar.
    return out.length ? out : respaldoLocal(q);
  } catch {
    return respaldoLocal(q);
  }
}
