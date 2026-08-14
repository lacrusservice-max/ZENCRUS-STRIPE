-- ═══════════════════════════════════════════════════════════════════════════
-- ZENCRUS · Seguimiento del usuario · esquema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- QUÉ ENTRA AQUÍ
-- ──────────────
-- Todo lo que el usuario registra sobre sí mismo y que hasta ahora vivía solo
-- en el teléfono: peso, medidas, hábitos, actividad diaria, ciclado de macros,
-- plan semanal de comidas y metas. Siete stores, ~1.000 líneas de AsyncStorage.
--
-- No es una tabla por store. Es una tabla por COSA, que no es lo mismo.
--
--
-- LA FUSIÓN QUE HACE ESTE ARCHIVO — leer antes de tocar nada
-- ─────────────────────────────────────────────────────────
-- `progressStore` y `bodyMeasurementsStore` guardan lo mismo con nombres
-- distintos:
--
--   progressStore.WeightEntry     → peso + fecha + nota
--   progressStore.Measurements    → cuello, pecho, cintura, cadera, brazos...
--   bodyMeasurementsStore.Body-
--     Measurement                 → todo lo anterior MÁS % grasa y % músculo
--
-- Y `profile-stats.tsx` lee de los DOS a la vez (líneas 76 y 187). O sea que
-- hoy hay dos verdades sobre cuánto pesa alguien, y ninguna manda.
--
-- Eso, que como bug de UI es molesto, como base para ZENA es incompatible: si
-- le preguntas «¿cuánto peso?» tiene que haber UNA respuesta, y si le pides
-- «apunta que peso 80» tiene que haber UN sitio donde escribirlo.
--
-- Por eso `body_metrics` es una sola tabla con todos los campos, y los dos
-- stores pasan a leer de ella. Sus interfaces no cambian —ninguna pantalla se
-- toca— pero por debajo comparten origen. Una fila con solo `weight_kg` es lo
-- que progressStore llamaba WeightEntry; una con las circunferencias llenas es
-- lo que bodyMeasurementsStore llamaba BodyMeasurement. Son la misma cosa
-- medida con más o menos detalle.
--
-- ‼️ AVISO APARTE: `bodyMeasurementsStore` siembra DEMO_MEASUREMENTS —cuatro
-- medidas inventadas— cuando no hay datos. Un usuario real las ve como suyas.
-- Eso NO se migra: subir datos falsos a producción los volvería permanentes y
-- ZENA razonaría sobre un cuerpo que no existe.
--
--
-- LO QUE NO SE GUARDA PORQUE SE DERIVA
-- ────────────────────────────────────
-- `streakStore` mantiene currentStreak, longestStreak y totalDaysActive. Aquí
-- solo se guarda la actividad de cada día; las rachas se calculan al leer. Un
-- contador guardado y una historia de la que se deduce el mismo contador
-- acaban discrepando siempre, y cuando discrepan gana el que está mal.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- body_metrics · peso y medidas, una fila por medición
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.body_metrics (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,

  measured_on   date not null,

  -- Todo opcional menos la fecha: alguien puede pesarse sin medirse, medirse
  -- sin pesarse, o apuntar solo el % de grasa que le dio la báscula.
  weight_kg       numeric(5,2)  check (weight_kg      is null or weight_kg      between 20 and 400),
  body_fat_pct    numeric(4,1)  check (body_fat_pct   is null or body_fat_pct   between 1 and 70),
  muscle_mass_pct numeric(4,1)  check (muscle_mass_pct is null or muscle_mass_pct between 1 and 80),

  -- Circunferencias en cm.
  neck_cm       numeric(5,1) check (neck_cm      is null or neck_cm      between 10 and 100),
  shoulders_cm  numeric(5,1) check (shoulders_cm is null or shoulders_cm between 40 and 200),
  chest_cm      numeric(5,1) check (chest_cm     is null or chest_cm     between 40 and 200),
  waist_cm      numeric(5,1) check (waist_cm     is null or waist_cm     between 30 and 250),
  hips_cm       numeric(5,1) check (hips_cm      is null or hips_cm      between 40 and 250),
  arm_left_cm   numeric(5,1) check (arm_left_cm   is null or arm_left_cm   between 10 and 100),
  arm_right_cm  numeric(5,1) check (arm_right_cm  is null or arm_right_cm  between 10 and 100),
  thigh_left_cm numeric(5,1) check (thigh_left_cm is null or thigh_left_cm between 20 and 120),
  thigh_right_cm numeric(5,1) check (thigh_right_cm is null or thigh_right_cm between 20 and 120),

  note          text,

  -- De dónde salió. `ai` es cuando ZENA lo registra porque el usuario se lo
  -- dijo por chat; sirve para poder revisarlas si algo sale raro.
  source        text not null default 'manual'
                check (source in ('manual', 'scale', 'ai', 'import')),

  -- Idempotencia offline, igual que en meal_logs.
  client_id     text not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint body_metrics_client_unico unique (user_id, client_id),

  -- Una fila sin ninguna medida no es un dato, es ruido.
  constraint body_metrics_algo_que_medir check (
    weight_kg is not null or body_fat_pct is not null or muscle_mass_pct is not null
    or neck_cm is not null or shoulders_cm is not null or chest_cm is not null
    or waist_cm is not null or hips_cm is not null
    or arm_left_cm is not null or arm_right_cm is not null
    or thigh_left_cm is not null or thigh_right_cm is not null
  )
);

-- La consulta de siempre: el histórico de alguien, de lo más reciente atrás.
create index if not exists body_metrics_usuario_idx
  on public.body_metrics (user_id, measured_on desc);

-- «¿Cuánto peso?» pregunta por la última fila CON peso, que no es la última
-- fila a secas: puede haberse medido la cintura ayer sin pesarse.
create index if not exists body_metrics_peso_idx
  on public.body_metrics (user_id, measured_on desc)
  where weight_kg is not null;


-- ───────────────────────────────────────────────────────────────────────────
-- habit_definitions · qué hábitos sigue cada quien
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.habit_definitions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,

  -- El id que usa la app ('sleep', 'water'...) o uno generado para los que
  -- crea el usuario. Es la llave con la que llegan los registros diarios.
  habit_key   text not null,
  label       text not null,
  icon        text not null default 'checkmark',

  -- Los cinco de fábrica se marcan para poder distinguirlos de los propios:
  -- si mañana cambia el texto de uno predeterminado, se actualiza sin tocar
  -- los que el usuario escribió.
  es_default  boolean not null default false,
  activo      boolean not null default true,
  orden       smallint not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint habit_definitions_key_unica unique (user_id, habit_key)
);


-- ───────────────────────────────────────────────────────────────────────────
-- habit_logs · qué hábitos se cumplieron cada día
-- ───────────────────────────────────────────────────────────────────────────
--
-- Una fila por hábito y día, no un JSON por día. El JSON sería más compacto,
-- pero la pregunta que más se hace es «¿cuántos días seguidos lleva con este
-- hábito?», y eso sobre un blob obliga a leerlo todo y recorrerlo en memoria.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.habit_logs (
  user_id     uuid not null references public.users(id) on delete cascade,
  habit_key   text not null,
  log_date    date not null,
  hecho       boolean not null default true,

  created_at  timestamptz not null default now(),

  primary key (user_id, habit_key, log_date)
);

create index if not exists habit_logs_dia_idx
  on public.habit_logs (user_id, log_date desc);


-- ───────────────────────────────────────────────────────────────────────────
-- activity_days · la actividad de cada día, de la que salen las rachas
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.activity_days (
  user_id        uuid not null references public.users(id) on delete cascade,
  activity_date  date not null,

  logged_food    boolean not null default false,
  logged_workout boolean not null default false,
  check_in_done  boolean not null default false,
  drank_water    boolean not null default false,

  -- Día salvado con un protector de racha. Es el único dato de aquí que NO se
  -- puede deducir de la actividad: hay que guardarlo.
  protegido      boolean not null default false,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  primary key (user_id, activity_date)
);

create index if not exists activity_days_usuario_idx
  on public.activity_days (user_id, activity_date desc);


-- ───────────────────────────────────────────────────────────────────────────
-- macro_cycles · el ciclado de macros de la semana
-- ───────────────────────────────────────────────────────────────────────────
--
-- Una fila por usuario: el ciclo activo. El histórico de ciclos anteriores
-- vive en `plan_versions` (migración 010), que es donde vive todo cambio de
-- plan y desde donde se restaura.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.macro_cycles (
  user_id     uuid primary key references public.users(id) on delete cascade,

  -- Nombre del preajuste ('classic', 'aggressive_cut'...) o 'custom'.
  preset      text not null default 'custom',

  -- Los siete días, de lunes a domingo: ['high','moderate',...]. Es un array
  -- y no siete columnas porque siempre se lee y escribe entero.
  cycle       jsonb not null,

  activo      boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint macro_cycles_siete_dias check (jsonb_array_length(cycle) = 7)
);


-- ───────────────────────────────────────────────────────────────────────────
-- meal_plans · el plan de comidas de una semana
-- ───────────────────────────────────────────────────────────────────────────
--
-- Aquí sí un JSONB, y a diferencia de los hábitos con razón: el plan se lee y
-- se escribe SIEMPRE entero —la pantalla pinta la semana completa— y nadie
-- pregunta «¿en cuántas semanas puse pollo el martes?». Normalizarlo daría
-- 35 filas por semana para servir siempre las 35 juntas.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.meal_plans (
  user_id     uuid not null references public.users(id) on delete cascade,

  -- Semana ISO, 'YYYY-WNN'. Es la llave que ya usa el store.
  week        text not null check (week ~ '^\d{4}-W\d{2}$'),

  -- { lun: { breakfast: [...], lunch: [...] }, mar: {...} }
  plan        jsonb not null default '{}'::jsonb,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (user_id, week)
);


-- ───────────────────────────────────────────────────────────────────────────
-- user_goals · metas con fecha
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.user_goals (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.users(id) on delete cascade,

  title        text not null,
  tipo         text not null check (tipo in ('weight', 'workout_frequency', 'streak', 'custom')),
  direccion    text not null check (direccion in ('increase', 'decrease')),

  start_value  numeric(10,2) not null,
  target_value numeric(10,2) not null,
  start_date   date not null,
  target_date  date not null,
  unit         text not null,

  -- Se cierra en vez de borrarse: una meta cumplida es justo lo que ZENA
  -- quiere recordar para celebrarlo y para proponer la siguiente.
  estado       text not null default 'activa'
               check (estado in ('activa', 'cumplida', 'abandonada', 'expirada')),
  cerrada_en   timestamptz,

  client_id    text not null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint user_goals_client_unico unique (user_id, client_id),
  constraint user_goals_fechas check (target_date >= start_date)
);

create index if not exists user_goals_activas_idx
  on public.user_goals (user_id, estado, target_date);


-- ───────────────────────────────────────────────────────────────────────────
-- updated_at automático
-- ───────────────────────────────────────────────────────────────────────────
drop trigger if exists body_metrics_updated_at on public.body_metrics;
create trigger body_metrics_updated_at before update on public.body_metrics
  for each row execute function update_updated_at();

drop trigger if exists habit_definitions_updated_at on public.habit_definitions;
create trigger habit_definitions_updated_at before update on public.habit_definitions
  for each row execute function update_updated_at();

drop trigger if exists activity_days_updated_at on public.activity_days;
create trigger activity_days_updated_at before update on public.activity_days
  for each row execute function update_updated_at();

drop trigger if exists macro_cycles_updated_at on public.macro_cycles;
create trigger macro_cycles_updated_at before update on public.macro_cycles
  for each row execute function update_updated_at();

drop trigger if exists meal_plans_updated_at on public.meal_plans;
create trigger meal_plans_updated_at before update on public.meal_plans
  for each row execute function update_updated_at();

drop trigger if exists user_goals_updated_at on public.user_goals;
create trigger user_goals_updated_at before update on public.user_goals
  for each row execute function update_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- RLS · cerrado, como en la 010 y la 011
-- ───────────────────────────────────────────────────────────────────────────
-- El proyecto no usa Supabase Auth: `auth.uid()` sería siempre NULL y una
-- política escrita con ella no autorizaría a nadie. Se activa RLS sin política
-- permisiva; el único camino es el backend con service_role.
alter table public.body_metrics      enable row level security;
alter table public.habit_definitions enable row level security;
alter table public.habit_logs        enable row level security;
alter table public.activity_days     enable row level security;
alter table public.macro_cycles      enable row level security;
alter table public.meal_plans        enable row level security;
alter table public.user_goals        enable row level security;
