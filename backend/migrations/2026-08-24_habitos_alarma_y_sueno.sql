-- ═══════════════════════════════════════════════════════════════════════════
-- HÁBITOS · alarma propia y horario de sueño
-- ═══════════════════════════════════════════════════════════════════════════
-- La hora ya disparaba un recordatorio. Ahora un hábito puede además tener
-- ALARMA: sonido propio, aviso de tiempo sensible y posponer.
--
--   alarma            si además de avisar, suena
--   alarma_sonido     cuál; NULL = el de por defecto
--   alarma_posponer   si el aviso ofrece «Posponer»
--   hora_fin          para un horario de SUEÑO: `hora` es acostarse y esta,
--                     despertar. NULL = el hábito no es un horario de sueño.
--
-- `hora_fin` puede ser MENOR que `hora` y no es un error: dormir de 23:00 a
-- 07:00 cruza la medianoche. Por eso no hay restricción que las compare.
--
-- Solo AÑADE columnas: nada existente pierde nada.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table habit_definitions
  add column if not exists alarma          boolean not null default false,
  add column if not exists alarma_sonido   text    null,
  add column if not exists alarma_posponer boolean not null default true,
  add column if not exists hora_fin        time    null;

do $$
begin
  -- Un horario de sueño necesita las dos horas: sin la de acostarse, la de
  -- despertar no delimita nada.
  if not exists (select 1 from pg_constraint where conname = 'habit_definitions_sueno_ck') then
    alter table habit_definitions
      add constraint habit_definitions_sueno_ck
      check (hora_fin is null or hora is not null) not valid;
    alter table habit_definitions validate constraint habit_definitions_sueno_ck;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'habit_definitions_sonido_ck') then
    alter table habit_definitions
      add constraint habit_definitions_sonido_ck
      check (alarma_sonido is null or length(alarma_sonido) between 1 and 60) not valid;
    alter table habit_definitions validate constraint habit_definitions_sonido_ck;
  end if;
end $$;

-- El de fábrica que YA es un horario de sueño: se acuesta a las 23:00 y su
-- propia etiqueta pide siete horas, así que despertar a las 06:00. Sin alarma
-- encendida: eso lo decide cada quien.
update habit_definitions
   set hora_fin = '06:00'
 where habit_key = 'sleep' and es_default = true and hora_fin is null;

commit;
