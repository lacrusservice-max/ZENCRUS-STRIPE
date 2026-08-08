-- ═══════════════════════════════════════════════════════════════════════════
-- BASE NUTRICIONAL ZENCRUS · Esquema Supabase (PostgreSQL)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- MODELO DE AMENAZA
-- ─────────────────
-- El activo no es un dato personal: es el catálogo en sí. Cualquiera con la
-- clave anónima de Supabase puede hablar con PostgREST, y sin defensas podría
-- pedir `select * from foods limit 100000` y llevarse la base entera en una
-- petición. Las defensas van en este orden:
--
--   1. RLS obligatorio. Sin política, nadie lee nada — ni siquiera con la
--      clave anónima. El rol `anon` no tiene ninguna política: no existe para
--      esta base.
--   2. Nada de acceso directo a las tablas. Se revoca SELECT sobre ellas y el
--      acceso pasa solo por funciones `SECURITY DEFINER` que limitan lo que
--      devuelven. No hay endpoint que permita paginar el catálogo completo.
--   3. Tope duro por consulta. Las funciones acotan `LIMIT` en el servidor;
--      pedir 10.000 filas devuelve el máximo permitido, no 10.000.
--   4. Registro de acceso. Cada búsqueda deja huella con el usuario: un
--      raspado se detecta por volumen aunque venga de una sesión legítima.
--
-- Lo que esto NO resuelve, y conviene tener claro: un usuario legítimo con la
-- app instalada puede consultar alimento por alimento durante semanas. No hay
-- defensa técnica contra eso, solo la detección por volumen del punto 4.

-- ── Esquema propio, fuera del alcance de PostgREST por defecto ──────────────
create schema if not exists nutrition;
revoke all on schema nutrition from public, anon, authenticated;
grant usage on schema nutrition to authenticated, service_role;

-- ═══ TABLAS ═══════════════════════════════════════════════════════════════

create table if not exists nutrition.foods (
  id                 text primary key,
  name               text not null,
  slug               text not null,
  group_smae         text not null,
  -- Grupo funcional de Zencrus. Derivado del nombre y del grupo SMAE, NO es
  -- dato de la fuente: el SMAE clasifica por equivalentes (la papa vive en
  -- cereales), no por origen del alimento.
  group_zencrus      text,
  subgroup           text,
  preparation        text,
  source             text not null,
  source_ref         text not null,
  verified           boolean not null default true,
  -- Parte comestible, solo cuando la fuente da peso bruto y neto.
  gross_weight_g     numeric,
  net_weight_g       numeric,
  edible_portion_pct numeric,
  yield_factor       numeric,
  search_vector      tsvector,
  created_at         timestamptz not null default now(),
  constraint foods_edible_pct_range check (
    edible_portion_pct is null or (edible_portion_pct > 0 and edible_portion_pct <= 100)
  )
);

create table if not exists nutrition.food_portions (
  id           bigserial primary key,
  food_id      text not null references nutrition.foods(id) on delete cascade,
  label        text not null,
  unit         text not null,
  amount       numeric not null,
  grams        numeric not null,
  gross_grams  numeric,
  -- true = calculada por proporción desde la medida de la fuente.
  is_derived   boolean not null default false,
  source       text not null,
  constraint portions_grams_positive check (grams > 0),
  constraint portions_amount_positive check (amount > 0),
  unique (food_id, label)
);

create table if not exists nutrition.food_nutrients (
  id               bigserial primary key,
  food_id          text not null references nutrition.foods(id) on delete cascade,
  -- 'portion' = tal cual lo declara la fuente. '100g' = derivado del peso neto.
  basis            text not null check (basis in ('portion','100g')),
  basis_grams      numeric not null,
  is_derived       boolean not null default false,
  energy_kcal      numeric, protein_g        numeric, fat_g           numeric,
  carbs_g          numeric, fat_sat_g        numeric, fat_mono_g      numeric,
  fat_poly_g       numeric, cholesterol_mg   numeric, sugar_g         numeric,
  fiber_g          numeric, vitamin_a_mg_re  numeric, vitamin_c_mg    numeric,
  folate_mg        numeric, calcium_mg       numeric, iron_mg         numeric,
  potassium_mg     numeric, sodium_mg        numeric, phosphorus_mg   numeric,
  ethanol_g        numeric, glycemic_index   numeric, glycemic_load   numeric,
  unique (food_id, basis)
);

create table if not exists nutrition.food_aliases (
  id       bigserial primary key,
  food_id  text not null references nutrition.foods(id) on delete cascade,
  alias    text not null,
  source   text not null,
  unique (food_id, alias)
);

create table if not exists nutrition.food_tags (
  id       bigserial primary key,
  food_id  text not null references nutrition.foods(id) on delete cascade,
  tag      text not null,
  -- Regla objetiva que justifica la etiqueta. Sin ella no se emite.
  rationale text not null,
  unique (food_id, tag)
);

-- ── Registro de acceso: detecta raspado por volumen ────────────────────────
create table if not exists nutrition.access_log (
  id         bigserial primary key,
  user_id    uuid,
  action     text not null,
  query      text,
  result_n   int,
  at         timestamptz not null default now()
);
create index if not exists access_log_user_time on nutrition.access_log (user_id, at desc);

-- ═══ ÍNDICES ══════════════════════════════════════════════════════════════
create index if not exists foods_search       on nutrition.foods using gin (search_vector);
create index if not exists foods_group        on nutrition.foods (group_smae);
create index if not exists foods_group_zen    on nutrition.foods (group_zencrus);
create index if not exists portions_food      on nutrition.food_portions (food_id);
create index if not exists nutrients_food     on nutrition.food_nutrients (food_id, basis);
create index if not exists aliases_food       on nutrition.food_aliases (food_id);
create index if not exists tags_tag           on nutrition.food_tags (tag);

-- ═══ SEGURIDAD ════════════════════════════════════════════════════════════
alter table nutrition.foods           enable row level security;
alter table nutrition.food_portions   enable row level security;
alter table nutrition.food_nutrients  enable row level security;
alter table nutrition.food_aliases    enable row level security;
alter table nutrition.food_tags       enable row level security;
alter table nutrition.access_log      enable row level security;

-- Forzar RLS también para el dueño de la tabla: sin esto, un rol con BYPASSRLS
-- o el propietario podría saltárselo.
alter table nutrition.foods           force row level security;
alter table nutrition.food_portions   force row level security;
alter table nutrition.food_nutrients  force row level security;
alter table nutrition.food_aliases    force row level security;
alter table nutrition.food_tags       force row level security;

-- Sin política = nadie lee. No se crea ninguna a propósito: el acceso pasa
-- exclusivamente por las funciones de abajo.
revoke all on all tables in schema nutrition from anon, authenticated, public;

-- ═══ ACCESO CONTROLADO ════════════════════════════════════════════════════

-- Tope del servidor. El cliente puede pedir lo que quiera; devuelve esto.
create or replace function nutrition.cap(n int) returns int
language sql immutable as $$ select least(greatest(coalesce(n,20), 1), 50) $$;

/**
 * Búsqueda de alimentos. Único camino de entrada al catálogo.
 *
 * `security definer` para que el usuario no necesite permisos sobre las
 * tablas; `search_path` fijado para que nadie pueda secuestrar la resolución
 * de nombres con un esquema propio.
 */
create or replace function public.search_foods(q text, lim int default 20)
returns table (
  id text, name text, group_smae text, group_zencrus text, preparation text,
  energy_kcal numeric, protein_g numeric, fat_g numeric, carbs_g numeric,
  fiber_g numeric, verified boolean
)
language plpgsql security definer set search_path = nutrition, pg_temp as $$
declare n int := nutrition.cap(lim);
begin
  if auth.uid() is null then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if q is null or length(btrim(q)) < 2 then
    return;                             -- sin término no se lista el catálogo
  end if;

  insert into nutrition.access_log(user_id, action, query, result_n)
  values (auth.uid(), 'search', left(q, 120), n);

  return query
    select f.id, f.name, f.group_smae, f.group_zencrus, f.preparation,
           nu.energy_kcal, nu.protein_g, nu.fat_g, nu.carbs_g, nu.fiber_g, f.verified
    from nutrition.foods f
    join nutrition.food_nutrients nu on nu.food_id = f.id and nu.basis = '100g'
    where f.search_vector @@ plainto_tsquery('spanish', q)
    order by ts_rank(f.search_vector, plainto_tsquery('spanish', q)) desc
    limit n;
end $$;

/** Ficha completa de un alimento: medidas, nutrientes y etiquetas. */
create or replace function public.get_food(food text)
returns jsonb
language plpgsql security definer set search_path = nutrition, pg_temp as $$
declare out jsonb;
begin
  if auth.uid() is null then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  insert into nutrition.access_log(user_id, action, query, result_n)
  values (auth.uid(), 'get_food', food, 1);

  select jsonb_build_object(
    'food',      to_jsonb(f) - 'search_vector',
    'portions',  (select coalesce(jsonb_agg(to_jsonb(p) - 'food_id'), '[]')
                    from nutrition.food_portions p where p.food_id = f.id),
    'nutrients', (select coalesce(jsonb_agg(to_jsonb(n) - 'food_id'), '[]')
                    from nutrition.food_nutrients n where n.food_id = f.id),
    'tags',      (select coalesce(jsonb_agg(t.tag), '[]')
                    from nutrition.food_tags t where t.food_id = f.id)
  ) into out
  from nutrition.foods f where f.id = food;

  return out;
end $$;

revoke all on function public.search_foods(text,int) from public, anon;
revoke all on function public.get_food(text)        from public, anon;
grant execute on function public.search_foods(text,int) to authenticated;
grant execute on function public.get_food(text)         to authenticated;

-- ═══ BÚSQUEDA ═════════════════════════════════════════════════════════════
create or replace function nutrition.refresh_search() returns void
language sql as $$
  update nutrition.foods f set search_vector =
    setweight(to_tsvector('spanish', coalesce(f.name,'')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(f.group_smae,'')), 'C') ||
    setweight(to_tsvector('spanish',
      coalesce((select string_agg(a.alias,' ') from nutrition.food_aliases a
                where a.food_id = f.id),'')), 'B');
$$;
