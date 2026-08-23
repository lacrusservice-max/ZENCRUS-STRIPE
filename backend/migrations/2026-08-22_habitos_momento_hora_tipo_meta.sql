-- ═══════════════════════════════════════════════════════════════════════════
-- HÁBITOS · momento del día, hora, tipo y meta de tiempo
-- ═══════════════════════════════════════════════════════════════════════════
-- Hasta aquí un hábito era un booleano con nombre e icono. La pantalla nueva
-- pide cuatro cosas que el modelo no sabía decir:
--
--   momento        para agrupar en MAÑANA / TARDE / NOCHE
--   hora           para enseñarla al lado de la tarjeta
--   tipo           'hacer' (lo normal) o 'evitar' (sin pantallas, no fumar…)
--   meta_segundos  los que llevan cronómetro; NULL = sin cronómetro
--
-- Y `habit_logs` necesita guardar el progreso del cronómetro, no solo el sí/no.
--
-- Solo AÑADE columnas: ninguna fila existente pierde nada, y todo lo viejo
-- sigue funcionando porque cada columna trae valor por defecto o admite NULL.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── Definiciones ───────────────────────────────────────────────────────────
alter table habit_definitions
  add column if not exists momento       text    not null default 'manana',
  add column if not exists hora          time    null,
  add column if not exists tipo          text    not null default 'hacer',
  add column if not exists meta_segundos integer null;

-- Las restricciones van aparte y con `not valid` primero para no bloquear la
-- tabla mientras revisa lo que ya hay; se validan a continuación.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'habit_definitions_momento_ck') then
    alter table habit_definitions
      add constraint habit_definitions_momento_ck
      check (momento in ('manana','tarde','noche')) not valid;
    alter table habit_definitions validate constraint habit_definitions_momento_ck;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'habit_definitions_tipo_ck') then
    alter table habit_definitions
      add constraint habit_definitions_tipo_ck
      check (tipo in ('hacer','evitar')) not valid;
    alter table habit_definitions validate constraint habit_definitions_tipo_ck;
  end if;

  -- Un cronómetro de cero o negativo no significa nada. NULL sí: «sin cronómetro».
  if not exists (select 1 from pg_constraint where conname = 'habit_definitions_meta_ck') then
    alter table habit_definitions
      add constraint habit_definitions_meta_ck
      check (meta_segundos is null or meta_segundos between 1 and 86400) not valid;
    alter table habit_definitions validate constraint habit_definitions_meta_ck;
  end if;
end $$;

-- ── Registros ──────────────────────────────────────────────────────────────
-- Los segundos acumulados del cronómetro ese día. 0 para todo lo que ya existe,
-- que es exactamente lo que era: no se había cronometrado nada.
alter table habit_logs
  add column if not exists segundos integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'habit_logs_segundos_ck') then
    alter table habit_logs
      add constraint habit_logs_segundos_ck
      check (segundos >= 0) not valid;
    alter table habit_logs validate constraint habit_logs_segundos_ck;
  end if;
end $$;

-- ── Los dos de fábrica que su propia etiqueta ya define ─────────────────────
-- No se reparte el resto a ojo: quedan en 'manana' por defecto y cada quien los
-- mueve. Solo se tocan los dos casos que la etiqueta deja sin ninguna duda.
update habit_definitions
   set momento = 'noche', hora = '23:00'
 where habit_key = 'sleep' and es_default = true and momento = 'manana';

update habit_definitions
   set meta_segundos = 300, hora = '07:00'
 where habit_key = 'mind' and es_default = true and meta_segundos is null;

commit;
