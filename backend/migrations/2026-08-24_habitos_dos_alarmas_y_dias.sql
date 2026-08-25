-- ═══════════════════════════════════════════════════════════════════════════
-- HÁBITOS · dos alarmas por hábito, y qué días suena cada una
-- ═══════════════════════════════════════════════════════════════════════════
-- Un horario de sueño tiene DOS momentos, no uno: acostarse y despertar. Hasta
-- ahora `alarma` solo cubría el primero, así que el despertador —que es
-- justamente para lo que se pone una alarma de sueño— no existía.
--
--   alarma           suena a la hora de `hora`      (acostarse, o el hábito normal)
--   alarma_fin       suena a la hora de `hora_fin`  (despertar; solo horarios de sueño)
--   alarma_dias      qué días suena la primera
--   alarma_fin_dias  qué días suena la segunda
--
-- ── Los días van en un solo número ─────────────────────────────────────────
-- Máscara de bits: bit 0 = lunes, bit 1 = martes … bit 6 = domingo. 127 son
-- los siete. Se guarda así y no en siete columnas ni en un array porque lo
-- único que se pregunta es «¿suena hoy?», y eso es una operación de bits.
--
--   solo entre semana  → 31   (1+2+4+8+16)
--   solo fin de semana → 96   (32+64)
--   todos los días     → 127
--
-- ── Por qué 127 por defecto ────────────────────────────────────────────────
-- Porque una alarma que no suena ningún día no es una alarma. Que no suene se
-- decide con `alarma = false`, no dejándola sin días: son dos cosas distintas
-- y mezclarlas deja al usuario con un despertador mudo sin saber por qué.
--
-- Solo AÑADE columnas: nada existente pierde nada.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table habit_definitions
  add column if not exists alarma_dias     smallint not null default 127,
  add column if not exists alarma_fin      boolean  not null default false,
  add column if not exists alarma_fin_dias smallint not null default 127;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'habit_definitions_dias_ck') then
    alter table habit_definitions
      add constraint habit_definitions_dias_ck
      check (alarma_dias between 1 and 127) not valid;
    alter table habit_definitions validate constraint habit_definitions_dias_ck;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'habit_definitions_fin_dias_ck') then
    alter table habit_definitions
      add constraint habit_definitions_fin_dias_ck
      check (alarma_fin_dias between 1 and 127) not valid;
    alter table habit_definitions validate constraint habit_definitions_fin_dias_ck;
  end if;

  -- Despertar sin hora de despertar no significa nada.
  if not exists (select 1 from pg_constraint where conname = 'habit_definitions_alarma_fin_ck') then
    alter table habit_definitions
      add constraint habit_definitions_alarma_fin_ck
      check (alarma_fin = false or hora_fin is not null) not valid;
    alter table habit_definitions validate constraint habit_definitions_alarma_fin_ck;
  end if;
end $$;

commit;
