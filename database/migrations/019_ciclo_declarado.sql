-- ═══════════════════════════════════════════════════════════════════════════
-- 019 · CICLO · marcar el inicio declarado a mano
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `cycle_periods` es una VISTA MATERIALIZADA de `cycle_logs`: el servidor la
-- recalcula en la misma petición en que cambian los registros de sangrado, así
-- que no puede quedarse vieja. Ver backend/src/utils/ciclo.ts.
--
-- Eso deja una cosa sin sitio: el inicio que la usuaria declara a mano. Es la
-- ÚNICA entrada de esta tabla que no se puede deducir de los registros —es una
-- afirmación suya que manda sobre la deducción— y si no se guarda aparte, el
-- siguiente recálculo la borra.
--
-- ── Por qué una columna nueva y no reusar `confirmed` ──────────────────────
-- `confirmed` ya significa otra cosa: distingue un periodo real de uno predicho,
-- para que una predicción nunca se endurezca en historial y contamine las
-- medias. Todas las filas de esta tabla son reales —salen de su sangrado— así
-- que `confirmed` es true en todas, y darle un segundo significado dejaría la
-- columna respondiendo a dos preguntas distintas a la vez. Eso es exactamente
-- el tipo de atajo que dentro de seis meses nadie sabe leer.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.cycle_periods
  add column if not exists declared boolean not null default false;

comment on column public.cycle_periods.declared is
  'La usuaria marcó a mano que aquí empezó su regla. Manda sobre la deducción y sobrevive al recálculo.';

comment on column public.cycle_periods.confirmed is
  'El periodo es real y no una predicción. Hoy siempre true: esta tabla nunca guarda periodos predichos (esos van en cycle_predictions).';

-- El recálculo pregunta por los declarados en cada escritura de sangrado.
create index if not exists cycle_periods_declarados
  on public.cycle_periods (user_id, start_date) where declared = true;
