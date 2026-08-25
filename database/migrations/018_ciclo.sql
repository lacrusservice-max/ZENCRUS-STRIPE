-- ═══════════════════════════════════════════════════════════════════════════
-- 018 · CICLO MENSTRUAL
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El módulo de ciclo de ZENCRUS. Hasta hoy el ciclo vivía ÚNICAMENTE en
-- AsyncStorage (`menstrualStore`): se perdía al reinstalar y no había forma de
-- calcular nada sobre un historial que no existía en ningún servidor.
--
-- Esta migración le da sitio, y con él la posibilidad de que exista la
-- correlación cruzada — el diferenciador del módulo — que necesita al menos
-- tres ciclos guardados para decir algo honesto.
--
-- ── Sobre RLS en este proyecto ─────────────────────────────────────────────
-- El prompt maestro pedía `USING (auth.uid() = user_id)`. Aquí eso NO puede
-- funcionar: ZENCRUS no usa Supabase Auth, así que `auth.uid()` es siempre
-- NULL y esa política no autorizaría a nadie. Es el mismo patrón ya
-- establecido en la 012 y la 017: RLS activado sin política permisiva, y el
-- aislamiento garantizado por el backend con service_role.
--
-- CONSECUENCIA QUE NO SE PUEDE OLVIDAR: cada consulta del backend a estas
-- tablas DEBE filtrar por el `user_id` del token, nunca por uno que venga en
-- el cuerpo o en la ruta. Estas son las tablas más sensibles de la app entera.
-- Ver docs/salud/DECISIONES.md · D-01.
--
-- ── Lo que NO está aquí ────────────────────────────────────────────────────
-- No hay tablas de comunidad: el contenido de ciclo se publica en la sección
-- Social que ya existe (`posts`), con un `kind` propio y visibilidad
-- restringida. Duplicar la moderación sería el peor error posible en
-- contenido de salud. Ver D-12.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- Vocabularios
-- ───────────────────────────────────────────────────────────────────────────

-- Los siete modos de vida. Cuatro más que Flo, y los tres de más son
-- justamente los que dejan gente fuera: posparto, anticoncepción continua y
-- ausencia de ciclo (relevante en atletas).
do $$ begin
  create type cycle_life_mode as enum (
    'seguimiento', 'buscando_embarazo', 'embarazo', 'posparto',
    'perimenopausia', 'anticoncepcion_continua', 'sin_ciclo'
  );
exception when duplicate_object then null; end $$;

-- Los 14 trackers. El valor de cada registro va en jsonb y se valida contra
-- un esquema zod distinto por tipo, en cliente y en servidor.
do $$ begin
  create type cycle_log_kind as enum (
    'sangrado', 'dolor', 'animo', 'energia', 'flujo', 'digestion', 'piel',
    'sueno', 'libido', 'temperatura_basal', 'prueba', 'anticoncepcion',
    'medicacion', 'perimenopausia'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type cycle_phase as enum ('menstrual', 'folicular', 'ovulatoria', 'lutea');
exception when duplicate_object then null; end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- health_profile · una fila por usuaria
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.health_profile (
  user_id            uuid primary key references public.users(id) on delete cascade,

  -- La llave del módulo. Preferencia propia y revocable, NO derivada del campo
  -- `gender`: ese se pide para el cálculo metabólico, y usarlo también como
  -- permiso acoplaría dos cosas que deben poder cambiar por separado.
  -- Ver D-13.
  cycle_enabled      boolean not null default false,

  life_mode          cycle_life_mode not null default 'seguimiento',

  -- Medias personales. NULL mientras no haya historial suficiente: una media
  -- poblacional guardada como si fuera suya es el primer paso para una
  -- predicción que miente.
  avg_cycle_days     smallint check (avg_cycle_days  is null or avg_cycle_days  between 15 and 60),
  avg_period_days    smallint check (avg_period_days is null or avg_period_days between 1 and 15),

  contraception      text,
  goals              jsonb not null default '{}'::jsonb,

  -- Las tres capas del modo privado, independientes entre sí a propósito:
  -- en Flo activar el anonimato cuesta perder pareja, wearables y datos.
  lock_biometric     boolean not null default false,
  lock_timeout_s     integer not null default 0 check (lock_timeout_s >= 0),
  discreet_mode      boolean not null default false,
  anonymous_mode     boolean not null default false,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);


-- ───────────────────────────────────────────────────────────────────────────
-- cycle_periods · cada menstruación
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.cycle_periods (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.users(id) on delete cascade,

  start_date   date not null,
  end_date     date,

  -- Distinguir lo confirmado de lo predicho es la base de la honestidad del
  -- módulo: una predicción nunca debe endurecerse en historial y contaminar
  -- las medias con la que fue la suposición de la app, no el cuerpo.
  confirmed    boolean not null default true,

  -- NULL mientras el ciclo esté en curso: su duración no se sabe hasta que
  -- empieza el siguiente, y rellenarla con la media sería guardar una
  -- estimación como si fuera un hecho.
  cycle_days   smallint check (cycle_days is null or cycle_days between 15 and 90),

  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint cycle_periods_inicio_unico unique (user_id, start_date)
);

create index if not exists cycle_periods_user_fecha
  on public.cycle_periods (user_id, start_date desc);


-- ───────────────────────────────────────────────────────────────────────────
-- cycle_logs · un registro por (usuaria, día, tipo)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Una fila por tipo y no un blob por día: la pregunta que más se hace es
-- «¿cómo evolucionó ESTE síntoma en los últimos seis meses?», y eso sobre un
-- JSON por día obliga a leerlo todo y recorrerlo en memoria.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.cycle_logs (
  user_id     uuid not null references public.users(id) on delete cascade,
  log_date    date not null,
  kind        cycle_log_kind not null,

  -- Forma distinta por tipo, validada por zod en cliente y servidor.
  -- sangrado: {level:1..5} · dolor: {zones:[{id,intensity}]}
  -- animo: {valence:-1..1, arousal:-1..1} · temperatura_basal: {celsius}
  value       jsonb not null,

  note        text,
  source      text not null default 'manual'
              check (source in ('manual', 'voz', 'widget', 'wearable', 'import')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (user_id, log_date, kind)
);

create index if not exists cycle_logs_user_fecha
  on public.cycle_logs (user_id, log_date desc);

-- Para la pregunta «este síntoma a lo largo del tiempo», que es la que
-- alimenta el mapa de calor y las correlaciones.
create index if not exists cycle_logs_user_kind_fecha
  on public.cycle_logs (user_id, kind, log_date desc);


-- ───────────────────────────────────────────────────────────────────────────
-- cycle_predictions · con su intervalo, siempre
-- ───────────────────────────────────────────────────────────────────────────
--
-- Ninguna predicción se guarda sin su banda. Dar una fecha exacta con una
-- variabilidad de ±3 días es fingir una precisión que no existe, y es
-- exactamente lo que hacen todas las apps de la categoría.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.cycle_predictions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.users(id) on delete cascade,

  computed_at       timestamptz not null default now(),
  model_version     text not null,

  next_period_low    date not null,
  next_period_likely date not null,
  next_period_high   date not null,

  ovulation_low     date,
  ovulation_likely  date,
  ovulation_high    date,

  fertile_start     date,
  fertile_end       date,

  -- 0–100. Se enseña siempre junto a la predicción, nunca escondida.
  confidence        smallint not null check (confidence between 0 and 100),

  -- Con cuántos ciclos se calculó: es lo que permite decir «registra dos
  -- ciclos más y la confianza sube a ~85%» en vez de un número sin origen.
  sample_cycles     smallint not null default 0 check (sample_cycles >= 0),

  -- En anticoncepción hormonal continua el modelo NO predice ovulación, y
  -- guarda por qué, para poder explicarlo en pantalla en vez de callar.
  suppressed_reason text,

  constraint cycle_predictions_banda_coherente
    check (next_period_low <= next_period_likely and next_period_likely <= next_period_high)
);

create index if not exists cycle_predictions_user_time
  on public.cycle_predictions (user_id, computed_at desc);


-- ───────────────────────────────────────────────────────────────────────────
-- cycle_correlations · fase ↔ métrica  ★ el diferenciador
-- ───────────────────────────────────────────────────────────────────────────
--
-- Lo que ninguna app del mundo tiene: cruzar la fase con lo que ZENCRUS ya
-- sabe de entrenamiento, nutrición y sueño.
--
-- Cada fila guarda su rigor con ella. Sin tamaño de muestra ni intervalo, una
-- correlación es una anécdota con aspecto de dato.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.cycle_correlations (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,

  phase         cycle_phase not null,
  metric        text not null,      -- 'fuerza_press_banca', 'kcal', 'sueno_horas'…

  -- Efecto respecto a la línea base personal de la usuaria, en porcentaje.
  effect_pct    numeric(6,2) not null,
  ci_low        numeric(6,2) not null,
  ci_high       numeric(6,2) not null,

  sample_size   smallint not null check (sample_size >= 3),
  p_value       numeric(6,4),

  computed_at   timestamptz not null default now(),

  -- La usuaria puede decir «esto no aplica a mí» y el sistema deja de
  -- mostrarlo. Su cuerpo, su última palabra.
  dismissed     boolean not null default false,

  constraint cycle_correlations_una_por_metrica unique (user_id, phase, metric)
);

create index if not exists cycle_correlations_user
  on public.cycle_correlations (user_id, phase) where dismissed = false;


-- ───────────────────────────────────────────────────────────────────────────
-- health_assessments · evaluaciones de síntomas
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.health_assessments (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.users(id) on delete cascade,

  kind              text not null
                    check (kind in ('sop','endometriosis','miomas','tdpm','sangrado_abundante','perimenopausia')),

  -- Versionado: un resultado guardado siempre sabe con qué cuestionario se
  -- generó. Sin esto, revisar un resultado de hace un año es adivinar.
  questionnaire_version text not null,
  answers           jsonb not null,

  -- Probabilidad, nunca certeza. Esto NO es un diagnóstico y la propia
  -- columna se llama así para que nadie lo confunda leyendo el esquema.
  likelihood        text not null check (likelihood in ('baja','moderada','alta')),

  -- Lo que de verdad cambia una consulta médica.
  questions_for_doctor jsonb not null default '[]'::jsonb,

  taken_at          timestamptz not null default now(),
  remind_at         date
);

create index if not exists health_assessments_user
  on public.health_assessments (user_id, taken_at desc);


-- ───────────────────────────────────────────────────────────────────────────
-- health_reports · reportes clínicos generados
-- ───────────────────────────────────────────────────────────────────────────
--
-- El PDF se genera EN EL DISPOSITIVO y no se sube: aquí solo queda constancia
-- de que se generó y con qué rango. Los datos de salud no salen del teléfono
-- para producir un documento.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.health_reports (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,

  range_start   date not null,
  range_end     date not null,
  generated_at  timestamptz not null default now(),

  -- Huella del contenido, para saber si dos reportes son el mismo.
  content_hash  text,

  constraint health_reports_rango check (range_start <= range_end)
);

create index if not exists health_reports_user
  on public.health_reports (user_id, generated_at desc);


-- ───────────────────────────────────────────────────────────────────────────
-- partner_links · modo pareja
-- ───────────────────────────────────────────────────────────────────────────
--
-- Diseñado asumiendo relaciones de control: la revocación es inmediata,
-- silenciosa y no notifica a la pareja.
--
-- Y el permiso es granular, no todo-o-nada como en Flo: la usuaria elige
-- exactamente qué se comparte, campo por campo.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.partner_links (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references public.users(id) on delete cascade,
  partner_id    uuid references public.users(id) on delete cascade,

  -- Código de un solo uso. Expira en 15 minutos.
  code          text not null unique,
  expires_at    timestamptz not null,

  status        text not null default 'pendiente'
                check (status in ('pendiente','activo','revocado','expirado')),

  -- {fase, prediccion, energia, sintomas_agregado, sintomas_detalle,
  --  ventana_fertil, embarazo}. Todo false por defecto: compartir es un acto
  --  deliberado, nunca el estado inicial.
  scope         jsonb not null default '{}'::jsonb,

  linked_at     timestamptz,
  revoked_at    timestamptz,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),

  constraint partner_links_no_autoenlace check (partner_id is null or partner_id <> owner_id)
);

create index if not exists partner_links_owner on public.partner_links (owner_id, status);
create index if not exists partner_links_partner on public.partner_links (partner_id, status)
  where partner_id is not null;


-- ───────────────────────────────────────────────────────────────────────────
-- updated_at
-- ───────────────────────────────────────────────────────────────────────────
drop trigger if exists health_profile_updated_at on public.health_profile;
create trigger health_profile_updated_at before update on public.health_profile
  for each row execute function update_updated_at();

drop trigger if exists cycle_periods_updated_at on public.cycle_periods;
create trigger cycle_periods_updated_at before update on public.cycle_periods
  for each row execute function update_updated_at();

drop trigger if exists cycle_logs_updated_at on public.cycle_logs;
create trigger cycle_logs_updated_at before update on public.cycle_logs
  for each row execute function update_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- RLS · cerrado, como en la 012 y la 017
-- ───────────────────────────────────────────────────────────────────────────
-- Sin política permisiva: el proyecto no usa Supabase Auth y `auth.uid()`
-- sería siempre NULL. El único camino es el backend con service_role, que
-- DEBE filtrar por el user_id del token en cada consulta.
--
-- Estas ocho tablas son las más sensibles de ZENCRUS. Un fallo de filtrado
-- aquí no es un bug de privacidad cualquiera: es el historial reproductivo de
-- una persona en manos de otra.
alter table public.health_profile      enable row level security;
alter table public.cycle_periods       enable row level security;
alter table public.cycle_logs          enable row level security;
alter table public.cycle_predictions   enable row level security;
alter table public.cycle_correlations  enable row level security;
alter table public.health_assessments  enable row level security;
alter table public.health_reports      enable row level security;
alter table public.partner_links       enable row level security;
