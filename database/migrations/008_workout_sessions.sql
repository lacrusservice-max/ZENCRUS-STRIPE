-- ═══════════════════════════════════════════════════════════════════════════
-- ZENCRUS · Sesiones de entrenamiento · esquema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- LO QUE HABÍA ANTES
-- ──────────────────
-- Nada. `workout_routines` guarda el PLAN (qué pretendo hacer) y la app
-- registraba lo REALIZADO en AsyncStorage, dentro del teléfono. O sea: al
-- cambiar de móvil se perdía el historial entero, y el servidor no tenía con
-- qué calcular una estadística ni con qué progresar un programa.
--
-- Aquí entra lo realizado. El plan y lo hecho son cosas distintas y no se
-- mezclan: casi nunca coinciden, y esa diferencia es justo el dato interesante.
--
--
-- LA DECISIÓN QUE GOBIERNA ESTE ARCHIVO — leer antes de tocar nada
-- ───────────────────────────────────────────────────────────────
-- ZENCRUS va a tener CUATRO formas de entrenar: gimnasio, en casa, aire libre
-- con GPS y clases guiadas. Solo las dos primeras se construyen ahora, pero las
-- cuatro caben en estas tablas DESDE HOY, porque meter después una sesión que
-- no tiene kilos —o que no tiene series en absoluto— obliga a rehacer el
-- modelo y a migrar el historial de todo el mundo.
--
-- De ahí las tres reglas que explican casi cada columna:
--
--   1 · `weight_kg` y `reps` son NULLABLE. Una plancha de 45 s no tiene reps;
--       una serie de dominadas no tiene kilos; un kilómetro no tiene ninguna de
--       las dos. Lo que se exige es que cada serie traiga AL MENOS UNA medida
--       (reps, tiempo o distancia), no una en concreto.
--
--   2 · Una sesión SIN NINGUNA SERIE es válida. Una carrera de 8 km y una clase
--       de 40 min son sesiones completas y no tienen series que registrar. Por
--       eso los totales de distancia, desnivel y calorías viven en la SESIÓN, y
--       no se derivan de sus series.
--
--   3 · Lo que es propio de un modo y de nadie más va en `metrics` (jsonb): la
--       ruta de una carrera, el identificador de una clase. Lo que preguntan
--       TODOS los modos —cuánto duró, cuánto costó, qué día fue— es una columna
--       de verdad, porque es lo que ordena e indexa el historial.
--
-- Ver `007_social.sql` para el modelo de seguridad: la autenticación es propia,
-- `auth.uid()` no existe dentro de Postgres, y RLS queda como cierre general.

begin;

-- ═══ 1 · SESIONES ═════════════════════════════════════════════════════════

create table if not exists public.workout_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,

  -- El eje que había que meter hoy. Cambia qué se registra y cómo se lee
  -- después: en 'gym' manda el volumen, en 'outdoor' manda la distancia.
  mode          text not null default 'gym'
                check (mode in ('gym', 'home', 'outdoor', 'class')),

  -- De dónde salió la sesión. 'freestyle' es entrar y empezar a levantar sin
  -- plan ninguno, que es como se entrena la mitad de los días.
  source        text not null default 'freestyle'
                check (source in ('routine', 'program', 'class', 'freestyle')),

  -- La rutina se BORRA con on delete set null a propósito: borrar una rutina no
  -- puede borrar el historial de los meses que se entrenó con ella.
  routine_id    uuid references public.workout_routines(id) on delete set null,

  -- Programas de varias semanas. La tabla todavía no existe —es el paso 3—, así
  -- que esto es un uuid suelto sin clave ajena. Está aquí para que el día que
  -- exista no haga falta migrar el historial ya registrado.
  program_id    uuid,
  program_week  smallint check (program_week is null or program_week between 1 and 104),
  program_day   smallint check (program_day  is null or program_day  between 1 and 7),

  title         text not null,

  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  -- Se guarda además de calcularse por resta: una sesión se puede PAUSAR (dejar
  -- el móvil, ir al baño) y entonces el tiempo de reloj miente sobre el
  -- entrenamiento. Esto es el tiempo que de verdad se estuvo entrenando.
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),

  status        text not null default 'active'
                check (status in ('active', 'completed', 'discarded')),

  -- ── Totales ────────────────────────────────────────────────────────────
  -- Denormalizados a propósito. El historial y las estadísticas los piden en
  -- CADA pantalla; recalcularlos recorriendo las series de dos años de
  -- entrenamiento en cada consulta es lo que convierte una lista en una espera.
  -- Se recalculan al cerrar la sesión y al tocar cualquiera de sus series.
  total_sets      integer not null default 0 check (total_sets >= 0),
  total_reps      integer not null default 0 check (total_reps >= 0),
  -- Kilos movidos = suma de peso × reps, SIN el calentamiento. Solo tiene
  -- sentido donde hay kilos; en casa o corriendo se queda en cero.
  total_volume_kg numeric(10,2) not null default 0 check (total_volume_kg >= 0),

  -- ── Lo de aire libre ───────────────────────────────────────────────────
  -- Viven en la sesión y NO se derivan de las series: una carrera continua no
  -- tiene series de las que sumar nada.
  distance_m    integer   check (distance_m  is null or distance_m  >= 0),
  elevation_m   integer   check (elevation_m is null or elevation_m >= 0),
  avg_pace_s_km integer   check (avg_pace_s_km is null or avg_pace_s_km > 0),

  -- ── Lo que preguntan todos los modos ───────────────────────────────────
  calories_kcal integer   check (calories_kcal is null or calories_kcal >= 0),
  avg_hr        smallint  check (avg_hr is null or avg_hr between 20 and 250),
  max_hr        smallint  check (max_hr is null or max_hr between 20 and 250),
  -- Esfuerzo percibido de la sesión entera, 1 a 10. Es el dato más barato de
  -- pedir y el mejor predictor de si alguien va camino de pasarse.
  perceived_effort smallint check (perceived_effort is null or perceived_effort between 1 and 10),
  notes         text,

  -- Lo propio de cada modo: la ruta de la carrera, la clase que se siguió.
  -- Aquí va lo que NO se consulta ordenando ni filtrando.
  metrics       jsonb not null default '{}'::jsonb,

  -- Idempotencia. El teléfono reintenta cuando la red va y viene —un gimnasio
  -- en un sótano es exactamente eso— y sin esto cada reintento abriría otra
  -- sesión. Lo pone la app, no el servidor.
  client_id     text not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Una sesión cerrada tiene final; una abierta, no.
  constraint session_ended_iff_closed check (
    (status = 'active'  and ended_at is null) or
    (status <> 'active' and ended_at is not null)
  )
);

comment on column public.workout_sessions.mode is
  'gym | home | outdoor | class. Cambia qué se mide, no solo cómo se pinta.';
comment on column public.workout_sessions.metrics is
  'Lo propio de un modo: ruta GPS resumida, id de la clase. Nunca lo que se ordena o filtra.';
comment on column public.workout_sessions.client_id is
  'Identificador que pone la app para que un reintento no abra una segunda sesión.';

-- El reintento no puede crear una segunda sesión.
create unique index if not exists ws_user_client
  on public.workout_sessions (user_id, client_id);

-- SOLO UNA SESIÓN ABIERTA POR PERSONA. Sin esto, «reanudar» es ambiguo: dos
-- sesiones activas y la app no sabe a cuál volver. Nadie entrena dos veces a la
-- vez, así que la base lo garantiza en vez de confiar en que el cliente mire.
create unique index if not exists ws_one_active
  on public.workout_sessions (user_id) where status = 'active';

-- El historial siempre se lee igual: lo mío, lo último primero.
create index if not exists ws_user_time
  on public.workout_sessions (user_id, started_at desc);
-- Y las estadísticas por modo («cuánto corrí este mes»).
create index if not exists ws_user_mode_time
  on public.workout_sessions (user_id, mode, started_at desc)
  where status = 'completed';

-- ═══ 2 · SERIES ═══════════════════════════════════════════════════════════
-- Una fila por serie realmente hecha. Es la unidad mínima del historial: de
-- aquí salen los récords, las progresiones y los kilos por grupo muscular.

create table if not exists public.workout_sets (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.workout_sessions(id) on delete cascade,
  -- Repetido a propósito. Sin él, «mis récords» tiene que cruzar con sesiones
  -- para saber de quién es cada serie, y eso es un cruce en cada consulta de
  -- estadísticas. La sesión es de un solo dueño, así que no puede desincronizarse.
  user_id       uuid not null references public.users(id) on delete cascade,

  -- ── Qué ejercicio ──────────────────────────────────────────────────────
  -- El catálogo de 206 vive en un JSON en memoria del servidor, no en una
  -- tabla, así que esto NO puede ser clave ajena. Y aunque lo fuera, tampoco
  -- convendría: alguien escribe «press inclinado en la multipower del gimnasio
  -- viejo» y esa serie tiene que poder registrarse igual.
  exercise_slug text,
  exercise_name text not null,
  -- Con lo que se agrupa. Es el slug si vino del catálogo, y si no el nombre
  -- normalizado (minúsculas, sin acentos). Lo calcula el backend, para que
  -- «Press Banca» y «press banca» sean el mismo ejercicio en las estadísticas.
  exercise_key  text not null,
  muscle        text,

  order_index   smallint not null default 0,  -- el ejercicio dentro de la sesión
  set_index     smallint not null default 0,  -- la serie dentro del ejercicio

  kind          text not null default 'normal'
                check (kind in ('warmup', 'normal', 'dropset', 'failure', 'amrap', 'superset')),

  -- ── De dónde sale la carga ─────────────────────────────────────────────
  -- ESTA es la columna que permite registrar una serie sin kilos sin tener que
  -- inventarse un cero. Un cero significaría «levantó 0 kg», que es falso: en
  -- unas dominadas se levanta el cuerpo entero.
  load_type     text not null default 'weight'
                check (load_type in ('weight', 'bodyweight', 'band', 'assisted', 'none')),
  -- Nullable de verdad. En 'weight' son los kilos de la barra; en 'bodyweight'
  -- el lastre añadido (null si no hubo); en 'assisted' la ayuda, en negativo.
  weight_kg     numeric(6,2) check (weight_kg is null or weight_kg between -300 and 1000),
  band_color    text,

  -- ── Qué se midió ───────────────────────────────────────────────────────
  -- Las tres nullable. Un ejercicio se mide por repeticiones, por tiempo o por
  -- distancia según lo que sea, y a veces por dos a la vez (400 m en 82 s).
  reps             smallint check (reps is null or reps between 0 and 1000),
  duration_seconds integer  check (duration_seconds is null or duration_seconds >= 0),
  distance_m       integer  check (distance_m is null or distance_m >= 0),

  -- Una serie sin ninguna medida no es una serie, es una fila vacía. Esto es lo
  -- que sustituye a «reps not null»: exige que se haya medido ALGO, sin obligar
  -- a que sea lo que se mide en un gimnasio.
  constraint set_has_a_measure check (
    reps is not null or duration_seconds is not null or distance_m is not null
  ),

  -- ── Esfuerzo ───────────────────────────────────────────────────────────
  -- RIR (repeticiones en recámara) y RPE (esfuerzo percibido) son la MISMA
  -- escala mirada al revés: RPE = 10 − RIR. Se guardan las dos columnas y el
  -- backend rellena la otra — es una conversión de unidades, como kg y libras,
  -- no una estimación. Así una gráfica funciona sin importar cuál eligió el
  -- usuario, que es una preferencia y cambia de un día para otro.
  rir           smallint     check (rir is null or rir between 0 and 10),
  rpe           numeric(3,1) check (rpe is null or rpe between 1 and 10),

  -- Descanso REAL antes de esta serie, no el programado. La diferencia entre
  -- los dos explica la mitad de las sesiones que salen peor de lo esperado.
  rest_taken_seconds integer check (rest_taken_seconds is null or rest_taken_seconds >= 0),

  -- 1RM estimado (Epley). Se guarda calculado en vez de derivarse al leer
  -- porque es lo que ordena los récords, y una fórmula en el `order by` no usa
  -- índice. Null cuando no aplica: sin kilos no hay 1RM.
  est_1rm       numeric(6,2) check (est_1rm is null or est_1rm >= 0),

  notes         text,
  -- Idempotencia, igual que en la sesión: registrar una serie sin cobertura y
  -- reintentar no puede dejar la serie por duplicado.
  client_id     text not null,
  performed_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

comment on column public.workout_sets.load_type is
  'De dónde sale la carga. Permite una serie sin kilos sin fingir un peso de 0.';
comment on column public.workout_sets.exercise_key is
  'Clave de agrupación: slug del catálogo, o el nombre normalizado si se escribió a mano.';
comment on constraint set_has_a_measure on public.workout_sets is
  'Reps, tiempo o distancia: al menos una. Cuál, depende del ejercicio.';

create unique index if not exists wset_session_client
  on public.workout_sets (session_id, client_id);
create index if not exists wset_session_order
  on public.workout_sets (session_id, order_index, set_index);
-- La consulta de «cómo voy en press de banca»: mío, de este ejercicio, en orden.
create index if not exists wset_user_exercise_time
  on public.workout_sets (user_id, exercise_key, performed_at desc);

-- ═══ 3 · RÉCORDS ══════════════════════════════════════════════════════════
-- Los récords vivían en el teléfono. Tienen que estar aquí porque son lo que un
-- programa de varias semanas necesita para decidir cuánto subir la carga, y esa
-- decisión la toma el servidor.
--
-- `metric` en vez de una columna «mejor marca»: en el gimnasio el récord es el
-- 1RM, en calistenia son las repeticiones, en una plancha es el tiempo y
-- corriendo es la distancia. Todos son récords y todos hacen la misma ilusión.
create table if not exists public.personal_records (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  exercise_key  text not null,
  exercise_name text not null,

  metric        text not null check (metric in
                  ('est_1rm', 'max_weight', 'max_reps', 'max_duration', 'max_distance', 'best_volume')),
  value         numeric(10,2) not null,

  -- Con qué se consiguió, para poder enseñarlo: «120 kg × 3».
  weight_kg     numeric(6,2),
  reps          smallint,

  -- Se borran con la serie: si se corrige una serie mal metida, el récord que
  -- salió de ella no puede sobrevivirle.
  set_id        uuid references public.workout_sets(id) on delete cascade,
  session_id    uuid references public.workout_sessions(id) on delete set null,
  achieved_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),

  -- Un récord por ejercicio y métrica. El anterior no se guarda: el histórico
  -- está en las series, que es de donde se puede reconstruir entero.
  constraint pr_one_per_metric unique (user_id, exercise_key, metric)
);

create index if not exists pr_user_time
  on public.personal_records (user_id, achieved_at desc);

-- ═══ 4 · MANTENIMIENTO ════════════════════════════════════════════════════

create or replace function public.touch_workout_session() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists workout_sessions_touch on public.workout_sessions;
create trigger workout_sessions_touch
  before update on public.workout_sessions
  for each row execute function public.touch_workout_session();

-- ═══ 5 · CIERRE ═══════════════════════════════════════════════════════════
-- Sin políticas: ni `anon` ni `authenticated` leen una fila. Todo pasa por el
-- backend, que sí sabe quién pregunta. Mismo criterio que la comunidad.
alter table public.workout_sessions  enable row level security;
alter table public.workout_sets      enable row level security;
alter table public.personal_records  enable row level security;

revoke all on public.workout_sessions, public.workout_sets, public.personal_records
  from anon, authenticated;

commit;

-- ── Comprobación ──────────────────────────────────────────────────────────
select 'tablas' as que, count(*)::text as n from information_schema.tables
  where table_schema='public' and table_name in
    ('workout_sessions','workout_sets','personal_records')
union all select 'una sola sesión abierta', count(*)::text from pg_indexes
  where indexname = 'ws_one_active'
union all select 'series sin kilos', count(*)::text from information_schema.columns
  where table_name='workout_sets' and column_name='weight_kg' and is_nullable='YES'
union all select 'al menos una medida', count(*)::text from pg_constraint
  where conname = 'set_has_a_measure';
