-- ═══════════════════════════════════════════════════════════════════════════
-- ZENCRUS · Recetas de los platillos compuestos · §4, nivel 4
-- ═══════════════════════════════════════════════════════════════════════════
--
-- QUÉ RESUELVE
-- ────────────
-- El catálogo tiene ingredientes —arroz, pollo, tortilla— y le faltan los
-- platillos: cochinita pibil, chilaquiles, pozole. Pedirle a un modelo cuántas
-- calorías tiene el pozole devuelve un número que suena bien y que no tiene
-- fuente; el §4 es tajante con eso: «la IA no verifica, estima».
--
-- El nivel 4 del §4 es la salida: no se le pregunta al modelo cuánto tiene el
-- platillo, se le pregunta DE QUÉ ESTÁ HECHO. Los ingredientes salen del
-- catálogo, con sus valores medidos, y las calorías se calculan sumando. El
-- modelo aporta lo que sabe hacer —descomponer un platillo en su receta— y no
-- aporta ni un solo número.
--
--
-- POR QUÉ LA RECETA SE GUARDA Y NO SOLO EL RESULTADO
-- ──────────────────────────────────────────────────
-- Se podrían guardar solo los valores calculados y tirar la receta. El §4 pide
-- lo contrario, y por una razón concreta: «si se corrige el valor de la
-- tortilla, todos los platillos que la usan se corrigen solos».
--
-- Sin la receta, un error en un ingrediente queda congelado dentro de cada
-- platillo que lo use, y no hay forma de saber cuáles son. Con ella, cada
-- caloría del catálogo se puede auditar hasta su origen. Es lo que separa un
-- número calculado de uno inventado.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.food_recipes (
  id             bigserial primary key,

  -- El platillo.
  food_id        uuid not null references public.foods(id) on delete cascade,

  -- El ingrediente, que es otro alimento del catálogo con sus propios valores.
  --
  -- `restrict` y no `cascade`: si alguien borra la tortilla, no puede llevarse
  -- por delante en silencio la receta de los platillos que la usan. Que falle
  -- el borrado es la respuesta correcta — obliga a mirar qué depende de ella.
  ingrediente_id uuid not null references public.foods(id) on delete restrict,

  gramos         numeric(7,1) not null check (gramos > 0 and gramos <= 5000),

  -- El orden en que se enseñan. La receta se lee, no solo se calcula.
  seq            smallint not null default 1,

  created_at     timestamptz not null default now(),

  -- Un ingrediente aparece una vez por platillo. Dos filas de «tortilla» son
  -- un error de captura, y sumarlas por accidente falsea el platillo entero.
  constraint food_recipes_ingrediente_unico unique (food_id, ingrediente_id)
);

-- La receta de un platillo, en orden: es como se pinta y como se recalcula.
create index if not exists food_recipes_platillo_idx
  on public.food_recipes (food_id, seq);

-- La vuelta: qué platillos usan este ingrediente. Es la consulta que hace
-- posible el «corregir la tortilla corrige todo lo demás» del §4.
create index if not exists food_recipes_ingrediente_idx
  on public.food_recipes (ingrediente_id);


-- ───────────────────────────────────────────────────────────────────────────
-- La fuente «Calculado» del §4
-- ───────────────────────────────────────────────────────────────────────────
-- Nivel 4 de la jerarquía. Se muestra al usuario como «Calculado» y hereda su
-- credibilidad de los ingredientes, que son de niveles 1 a 3.
--
-- `priority` 40 lo deja por debajo de SMAE y USDA y por encima de una
-- estimación: si el mismo platillo llega después de una fuente oficial, gana
-- la oficial.
insert into public.food_sources (code, name, country, license, attribution, official, priority)
values ('calculado', 'Calculado por descomposición', 'MX', 'propia', 'ZENCRUS', false, 40)
on conflict (code) do nothing;


-- ───────────────────────────────────────────────────────────────────────────
-- RLS · el catálogo es común, pero solo el backend escribe
-- ───────────────────────────────────────────────────────────────────────────
alter table public.food_recipes enable row level security;
