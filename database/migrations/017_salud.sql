-- ═══════════════════════════════════════════════════════════════════════════
-- 017 · SALUD
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hasta ahora, de toda la sección de Salud solo los hábitos llegaban al
-- servidor. El sueño, el check-in, las pulsaciones, los pasos, el ciclo y la
-- ficha médica vivían ÚNICAMENTE en AsyncStorage: se perdían al reinstalar la
-- app o al cambiar de teléfono, y no había forma de recuperarlos.
--
-- Esta migración les da sitio. Sigue el patrón de la 012: una tabla por cosa,
-- índice por (user_id, fecha desc) porque la pregunta que más se hace es «los
-- últimos N días», y `client_id` donde el cliente puede escribir sin señal.
--
-- ── Las carreras NO tienen tabla propia ────────────────────────────────────
-- `workout_sessions` ya tiene `mode='outdoor'`, `distance_m`, `elevation_m`,
-- `avg_pace_s_km` y `calories_kcal`. Una carrera es una sesión de
-- entrenamiento, y meterla ahí la mete gratis en el historial de Entrena, en
-- las rachas y en los récords. Aquí solo se añade lo que esa tabla no puede
-- guardar: la geometría del recorrido.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- sleep_logs · una noche por fila
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.sleep_logs (
  user_id       uuid not null references public.users(id) on delete cascade,
  sleep_date    date not null,

  bedtime       time not null,
  wake_time     time not null,
  -- Se guarda calculado porque cruzar la medianoche es la mitad de los casos y
  -- no conviene rehacer esa resta en cada consulta.
  total_hours   numeric(4,2) not null check (total_hours >= 0 and total_hours <= 24),

  quality       text not null check (quality in ('poor', 'fair', 'good', 'excellent')),
  -- Si la calidad la dijo quien durmió o si se dedujo de las horas. Ocho horas
  -- dando vueltas en la cama no son un sueño «excelente», y mientras solo se
  -- miraba el reloj la app las llamaba así.
  quality_source text not null default 'derivada'
                 check (quality_source in ('declarada', 'derivada')),

  -- NULL mientras no haya un sensor que los mida. Estos dos campos existieron
  -- en el cliente como `total * 0.2` y `total * 0.25`, dos constantes que se
  -- enseñaban como fases medidas del sueño.
  deep_hours    numeric(4,2) check (deep_hours is null or deep_hours >= 0),
  rem_hours     numeric(4,2) check (rem_hours  is null or rem_hours  >= 0),

  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  primary key (user_id, sleep_date)
);

create index if not exists sleep_logs_dia_idx
  on public.sleep_logs (user_id, sleep_date desc);


-- ───────────────────────────────────────────────────────────────────────────
-- recovery_checkins · el único check-in de la app
-- ───────────────────────────────────────────────────────────────────────────
--
-- Los cuatro ejes van en 1-5 y SIEMPRE «más alto = mejor», incluidos el estrés
-- y el dolor, para que promediarlos sea una media y no una media con dos
-- signos cambiados. Antes había dos check-in en dos pantallas, uno en 1-5 y
-- otro en 1-10, preguntando ambos por la energía y el estrés.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.recovery_checkins (
  user_id     uuid not null references public.users(id) on delete cascade,
  checkin_date date not null,

  energy      smallint not null check (energy   between 1 and 5),
  soreness    smallint not null check (soreness between 1 and 5),
  stress      smallint not null check (stress   between 1 and 5),
  -- Opcional: las entradas anteriores a la unión no lo traen. El ánimo NO entra
  -- en el score de recuperación — un mal día de humor no es fatiga muscular.
  mood        smallint check (mood is null or mood between 1 and 5),

  intention   text,
  note        text,

  -- El score que se calculó ese día, guardado tal cual. NULL es un valor
  -- legítimo: significa que no había ni una señal con la que puntuar, que es
  -- distinto de un cero.
  score       smallint check (score is null or score between 0 and 100),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (user_id, checkin_date)
);

create index if not exists recovery_checkins_dia_idx
  on public.recovery_checkins (user_id, checkin_date desc);


-- ───────────────────────────────────────────────────────────────────────────
-- heart_rate_logs · mediciones sueltas, no un valor por día
-- ───────────────────────────────────────────────────────────────────────────
--
-- Una fila por medición y no por día porque el pulso en reposo y el de después
-- de subir escaleras son el mismo día y no son el mismo dato.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.heart_rate_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,

  measured_at timestamptz not null default now(),
  bpm         smallint not null check (bpm between 20 and 250),
  hr_type     text not null default 'resting'
              check (hr_type in ('resting', 'active', 'peak')),

  source      text not null default 'manual'
              check (source in ('manual', 'device', 'import')),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists heart_rate_logs_tiempo_idx
  on public.heart_rate_logs (user_id, measured_at desc);


-- ───────────────────────────────────────────────────────────────────────────
-- daily_steps · los pasos de cada día
-- ───────────────────────────────────────────────────────────────────────────
--
-- La AUSENCIA de fila es «ese día no se contó». Por eso no hay default 0 en
-- `steps`: un cero guardado dice «no se movió», y eso solo se puede afirmar de
-- un día en que algo estuviera contando.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.daily_steps (
  user_id     uuid not null references public.users(id) on delete cascade,
  step_date   date not null,

  steps       integer not null check (steps >= 0),
  distance_m  integer check (distance_m  is null or distance_m  >= 0),
  active_min  smallint check (active_min is null or active_min >= 0),
  floors      smallint check (floors     is null or floors     >= 0),
  calories_kcal integer check (calories_kcal is null or calories_kcal >= 0),

  source      text not null default 'pedometer'
              check (source in ('pedometer', 'manual', 'import')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (user_id, step_date)
);

create index if not exists daily_steps_dia_idx
  on public.daily_steps (user_id, step_date desc);


-- ───────────────────────────────────────────────────────────────────────────
-- run_tracks · la geometría de una carrera
-- ───────────────────────────────────────────────────────────────────────────
--
-- La cabecera de la carrera (distancia, ritmo, duración, kcal) va en
-- `workout_sessions` con `mode='outdoor'`. Aquí va solo lo que allí no cabe.
--
-- El recorrido se guarda como polyline codificada de Google y no como array de
-- JSON: una hora de carrera son ~3.600 puntos, que en JSON pesan unos 140 KB y
-- codificados rondan los 25 KB. Se envían por la red en cada sincronización y
-- se leen enteros cada vez que alguien abre una carrera.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.run_tracks (
  session_id  uuid primary key references public.workout_sessions(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,

  -- Polyline codificada con precisión 5 (~1 m). NULL = carrera sin GPS, que es
  -- un caso real: en interior, en cinta, o con el permiso denegado.
  polyline    text,
  point_count integer not null default 0 check (point_count >= 0),

  -- Parciales por kilómetro: [{ km, seconds, elevation_m, pace_s_km }, …].
  splits      jsonb not null default '[]'::jsonb,
  -- Series alineadas con los puntos, para las gráficas del detalle.
  altitudes   jsonb not null default '[]'::jsonb,
  cadences    jsonb not null default '[]'::jsonb,

  -- Ritmo ajustado por pendiente: lo que habrías corrido en llano. Se calcula
  -- en el cliente, donde ya está la traza entera en memoria.
  gap_s_km    integer check (gap_s_km is null or gap_s_km > 0),

  -- Cuánto se fio el GPS de sí mismo, en metros. Sirve para no presentar como
  -- medición una carrera grabada bajo un puente.
  avg_accuracy_m numeric(5,1) check (avg_accuracy_m is null or avg_accuracy_m >= 0),

  created_at  timestamptz not null default now()
);

create index if not exists run_tracks_user_idx
  on public.run_tracks (user_id, created_at desc);


-- ───────────────────────────────────────────────────────────────────────────
-- run_best_efforts · el mejor 1K, 5K, 10K…
-- ───────────────────────────────────────────────────────────────────────────
--
-- Tabla propia y no `personal_records` porque aquella está atada a
-- `exercise_key` y a `set_id` de una serie de gimnasio: un récord de sentadilla
-- sale de UNA serie concreta, mientras que el mejor 5K sale de recorrer la
-- traza entera buscando la ventana más rápida, y puede estar en medio de una
-- carrera de quince kilómetros.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.run_best_efforts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,

  distance_m  integer not null check (distance_m > 0),
  seconds     integer not null check (seconds > 0),

  session_id  uuid references public.workout_sessions(id) on delete cascade,
  achieved_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),

  -- Uno por distancia. El anterior no se guarda: está en las carreras, que es
  -- de donde se puede reconstruir entero.
  constraint run_best_efforts_una_por_distancia unique (user_id, distance_m)
);

create index if not exists run_best_efforts_user_idx
  on public.run_best_efforts (user_id, distance_m);


-- ───────────────────────────────────────────────────────────────────────────
-- cycle_entries · cada ciclo, por su día de inicio
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.cycle_entries (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,

  start_date  date not null,
  end_date    date,
  -- NULL mientras el ciclo esté en curso: su duración no se sabe hasta que
  -- empieza el siguiente, y rellenarla con la media sería una predicción
  -- guardada como si fuera un hecho.
  length_days smallint check (length_days is null or length_days between 15 and 60),
  period_days smallint check (period_days is null or period_days between 1 and 15),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint cycle_entries_inicio_unico unique (user_id, start_date)
);

create index if not exists cycle_entries_inicio_idx
  on public.cycle_entries (user_id, start_date desc);


-- ───────────────────────────────────────────────────────────────────────────
-- cycle_daily_logs · síntomas, ánimo y flujo de cada día
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.cycle_daily_logs (
  user_id     uuid not null references public.users(id) on delete cascade,
  log_date    date not null,

  -- Lista de llaves de síntoma. Array y no columnas porque la lista crece: hoy
  -- son once y las apps de referencia manejan más de setenta.
  symptoms    text[] not null default '{}',
  mood        text,
  flow        text check (flow is null or flow in ('none', 'light', 'medium', 'heavy')),

  -- Temperatura basal, en grados Celsius. Dos decimales porque el salto que
  -- marca la ovulación es de unas dos décimas: con uno solo se pierde la señal.
  bbt_celsius numeric(4,2) check (bbt_celsius is null or bbt_celsius between 34 and 42),

  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (user_id, log_date)
);

create index if not exists cycle_daily_logs_dia_idx
  on public.cycle_daily_logs (user_id, log_date desc);


-- ───────────────────────────────────────────────────────────────────────────
-- medical_id · la ficha que alguien necesita leer con prisa
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.medical_id (
  user_id       uuid primary key references public.users(id) on delete cascade,

  blood_type    text,
  allergies     text,
  conditions    text,
  medications   text,
  organ_donor   boolean not null default false,
  notes         text,

  -- [{ name, relationship, phone }, …]. JSON y no tabla aparte porque nunca se
  -- consultan sueltos: o se lee la ficha entera o no se lee.
  contacts      jsonb not null default '[]'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- ───────────────────────────────────────────────────────────────────────────
-- updated_at
-- ───────────────────────────────────────────────────────────────────────────
drop trigger if exists sleep_logs_updated_at on public.sleep_logs;
create trigger sleep_logs_updated_at before update on public.sleep_logs
  for each row execute function update_updated_at();

drop trigger if exists recovery_checkins_updated_at on public.recovery_checkins;
create trigger recovery_checkins_updated_at before update on public.recovery_checkins
  for each row execute function update_updated_at();

drop trigger if exists daily_steps_updated_at on public.daily_steps;
create trigger daily_steps_updated_at before update on public.daily_steps
  for each row execute function update_updated_at();

drop trigger if exists cycle_entries_updated_at on public.cycle_entries;
create trigger cycle_entries_updated_at before update on public.cycle_entries
  for each row execute function update_updated_at();

drop trigger if exists cycle_daily_logs_updated_at on public.cycle_daily_logs;
create trigger cycle_daily_logs_updated_at before update on public.cycle_daily_logs
  for each row execute function update_updated_at();

drop trigger if exists medical_id_updated_at on public.medical_id;
create trigger medical_id_updated_at before update on public.medical_id
  for each row execute function update_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- RLS · cerrado, como en la 012
-- ───────────────────────────────────────────────────────────────────────────
-- El proyecto no usa Supabase Auth: `auth.uid()` sería siempre NULL y una
-- política escrita con ella no autorizaría a nadie. Se activa RLS sin política
-- permisiva; el único camino es el backend con service_role.
--
-- OJO con las dos del ciclo y con la ficha médica: al no haber política que
-- filtre por usuario, quien las protege de verdad es el backend. Cada consulta
-- a `cycle_entries`, `cycle_daily_logs` y `medical_id` DEBE filtrar por el
-- `user_id` del token, nunca por uno que venga en el cuerpo o en la ruta.
alter table public.sleep_logs        enable row level security;
alter table public.recovery_checkins enable row level security;
alter table public.heart_rate_logs   enable row level security;
alter table public.daily_steps       enable row level security;
alter table public.run_tracks        enable row level security;
alter table public.run_best_efforts  enable row level security;
alter table public.cycle_entries     enable row level security;
alter table public.cycle_daily_logs  enable row level security;
alter table public.medical_id        enable row level security;
