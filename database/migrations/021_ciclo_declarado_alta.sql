-- ───────────────────────────────────────────────────────────────────────────
-- 021 · Lo que ella DECLARA en el alta, separado de lo que calculamos
-- ───────────────────────────────────────────────────────────────────────────
--
-- La pantalla de alta del mockup pregunta cuánto le dura el ciclo y cuántos
-- días sangra. Eso es información real —y valiosa: sin ella la primera
-- predicción se hace con la media de la población y puede fallar por una
-- semana en un ciclo largo—, pero NO es lo mismo que `avg_cycle_days`.
--
-- ── Por qué no se reutilizan `avg_cycle_days` / `avg_period_days` ──────────
-- Porque la 018 dejó dicho, en su propio comentario, para qué son: medias
-- calculadas a partir de SU historial, y `NULL` mientras no haya historial
-- suficiente, «porque una media poblacional guardada como si fuera suya es el
-- primer paso para una predicción que miente».
--
-- Escribir ahí lo que alguien declaró de memoria en el alta rompe justo esa
-- garantía: seis meses después nadie podría distinguir «lo medimos» de «nos lo
-- dijo el primer día». Y son cosas distintas — lo declarado es un punto de
-- partida que la realidad corrige; lo calculado ES la realidad.
--
-- ── Cómo se usan ───────────────────────────────────────────────────────────
-- Solo como prior, y solo mientras no haya historial. En cuanto hay ciclos
-- completos, manda lo medido y esto queda de recuerdo. No se borra: sirve para
-- comparar lo que creía con lo que resultó ser, que es una de las cosas más
-- útiles que puede enseñarle la app.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.health_profile
  add column if not exists declared_cycle_days smallint
    check (declared_cycle_days is null or declared_cycle_days between 15 and 60);

alter table public.health_profile
  add column if not exists declared_period_days smallint
    check (declared_period_days is null or declared_period_days between 1 and 15);

comment on column public.health_profile.declared_cycle_days is
  'Duración de ciclo que la usuaria declaró en el alta. Prior, no medición: ver avg_cycle_days.';

comment on column public.health_profile.declared_period_days is
  'Días de sangrado que la usuaria declaró en el alta. Prior, no medición: ver avg_period_days.';
