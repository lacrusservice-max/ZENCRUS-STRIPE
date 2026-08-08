-- ═══════════════════════════════════════════════════════════════════════════
-- ZENCRUS · migración de esquema  ·  APLICADA el 27-ago-2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Todo lo demás ya está cargado. Esto son tres cambios pequeños que no se
-- pueden hacer con la clave de servicio, porque alteran la forma de las tablas
-- y no su contenido. Es seguro ejecutarlo más de una vez.
--
-- Después de aplicarlo, corre:   python3 data-pipeline/load_supabase.py
-- y entrarán las 6.487 medidas derivadas y los dos índices glicémicos.

begin;

-- ── 1. Marca de derivado en las medidas ────────────────────────────────────
-- La regla del proyecto es que nada calculado viaje sin marca. Hoy no hay
-- dónde ponerla, así que las 6.487 medidas derivadas («1/2 taza», «2 piezas»)
-- se quedaron fuera aunque son aritmética exacta sobre la medida de la fuente.
-- Con esta columna entran, y se distinguen de un vistazo de las 2.863 que
-- vienen escritas en el libro.
alter table public.food_portions
  add column if not exists is_derived boolean not null default false;

comment on column public.food_portions.is_derived is
  'true = calculada por proporción desde la medida de la fuente, no declarada por ella.';

-- ── 2. Clave natural de las medidas ────────────────────────────────────────
-- Va por (food_id, seq) y NO por (food_id, description), que era el primer
-- intento y es falso: el USDA da varias medidas con el mismo nombre y distinto
-- peso. «Brussels sprouts, frozen» tiene dos «package (10 oz)», una de 95 g y
-- otra de 284 g, y son medidas distintas de verdad. Con description hay 306
-- colisiones en la tabla y crear el índice habría exigido borrar datos buenos
-- del USDA; con seq no hay ninguna en las 17.232 filas.
create unique index if not exists food_portions_food_seq
  on public.food_portions (food_id, seq);

-- ── 3. Unidades adimensionales ─────────────────────────────────────────────
-- El índice y la carga glicémica no se miden en kcal, g, mg ni µg: son números
-- sin unidad. La restricción actual solo admite esas cuatro, así que ambos
-- valores se quedaron fuera. Se añaden dos etiquetas y NO se quita ninguna de
-- las existentes, para que ningún nutriente ya cargado deje de cumplirla.
alter table public.nutrients drop constraint if exists nutrients_unit_check;
alter table public.nutrients add constraint nutrients_unit_check
  check (unit in ('kcal', 'g', 'mg', 'ug', 'IG', 'CG'));

insert into public.nutrients (id, code, name_es, name_en, unit, is_macro, sort_order)
values
  (33, 'glycemic_index', 'Índice glicémico', 'Glycemic index', 'IG', false, 33),
  (34, 'glycemic_load',  'Carga glicémica',  'Glycemic load',  'CG', false, 34)
on conflict (id) do update
  set code = excluded.code, name_es = excluded.name_es,
      name_en = excluded.name_en, unit = excluded.unit;

commit;

-- ── Comprobación ───────────────────────────────────────────────────────────
-- Debe devolver la columna nueva, el índice y los dos nutrientes.
select 'columna is_derived' as que,
       count(*)::text as resultado
  from information_schema.columns
 where table_name = 'food_portions' and column_name = 'is_derived'
union all
select 'índice único', count(*)::text
  from pg_indexes where indexname = 'food_portions_food_seq'
union all
select 'nutrientes glicémicos', count(*)::text
  from public.nutrients where code in ('glycemic_index', 'glycemic_load');
