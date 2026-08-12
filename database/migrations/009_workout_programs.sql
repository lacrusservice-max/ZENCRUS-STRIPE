-- ═══════════════════════════════════════════════════════════════════════════
-- ZENCRUS · Programas de entrenamiento · esquema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Un programa es un plan de varias semanas: qué hacer cada día, cuánto subir
-- cada semana y cuándo bajar para recuperar. Es el paso que convierte «voy al
-- gimnasio» en «estoy siguiendo algo».
--
--
-- LO QUE **NO** LLEVA TABLA — leer antes de añadir ninguna
-- ───────────────────────────────────────────────────────
-- Los DÍAS COMPLETADOS no se guardan en ningún sitio nuevo. Ya están en
-- `workout_sessions`, que desde la migración 008 lleva `program_id`,
-- `program_week` y `program_day`. Una tabla de «días hechos» sería una segunda
-- copia de la misma verdad, y las dos copias acaban discrepando: se descarta un
-- entrenamiento y el día sigue marcado como hecho, o al revés.
--
-- Consecuencia práctica: «¿qué llevo del programa?» es una consulta a las
-- sesiones, no un contador que haya que mantener al día.
--
--
-- POR QUÉ EL PLAN VA EN JSONB Y LA INSCRIPCIÓN NO
-- ───────────────────────────────────────────────
-- El plan —doce semanas × cuatro días × seis ejercicios— se lee SIEMPRE ENTERO
-- y nunca se filtra ni se ordena por sus partes. Nadie pregunta «dame los
-- programas cuyo tercer ejercicio del martes sea press militar». Normalizarlo
-- serían tres tablas y cuatro cruces para leer algo que siempre se quiere
-- completo.
--
-- La INSCRIPCIÓN es lo contrario: se pregunta por ella constantemente («¿tengo
-- un programa activo?», «¿por qué semana voy?»), se ordena y se indexa. Eso sí
-- son columnas.

begin;

-- ═══ 1 · PLANTILLAS ═══════════════════════════════════════════════════════

create table if not exists public.workout_programs (
  id            uuid primary key default gen_random_uuid(),

  -- null = programa de ZENCRUS, visible para todos. Con dueño = suyo y de
  -- nadie más. Una sola tabla para los dos casos porque son la misma cosa con
  -- distinto autor, y separarlas obligaría a consultar dos veces siempre.
  user_id       uuid references public.users(id) on delete cascade,

  name          text not null,
  description   text,

  weeks         smallint not null check (weeks between 1 and 52),
  days_per_week smallint not null check (days_per_week between 1 and 7),

  goal          text not null default 'hypertrophy'
                check (goal in ('strength', 'hypertrophy', 'endurance', 'general')),
  level         text not null default 'intermediate'
                check (level in ('beginner', 'intermediate', 'advanced')),

  -- El modo en que se entrena este programa. Decide qué le enseña la app al
  -- usuario cuando lo empieza: con barra hay calculadora de discos, en casa no.
  mode          text not null default 'gym'
                check (mode in ('gym', 'home', 'outdoor', 'class')),

  /**
   * Cada cuántas semanas toca DESCARGA. Null = el plan ya la lleva escrita en
   * sus porcentajes y no hay que calcular nada.
   *
   * Cuatro es lo habitual: tres semanas subiendo y una bajando. No es una
   * norma física, es que a la cuarta semana la fatiga acumulada empieza a
   * comerse la ganancia y bajar una semana rinde más que insistir.
   */
  deload_every  smallint check (deload_every is null or deload_every between 2 and 12),

  -- El plan entero: semanas → días → ejercicios, con su progresión.
  plan          jsonb not null default '{}'::jsonb,

  -- Un programa de ZENCRUS se puede retirar del catálogo sin borrarlo: quien
  -- lo esté siguiendo tiene que poder terminarlo.
  is_published  boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.workout_programs.user_id is
  'null = programa de ZENCRUS, para todos. Con valor = privado de esa persona.';
comment on column public.workout_programs.deload_every is
  'Cada cuántas semanas se baja la carga. Null = el plan ya lo lleva escrito.';
comment on column public.workout_programs.plan is
  'Semanas, días y ejercicios. Va en jsonb porque se lee entero y nunca se filtra por dentro.';

-- El catálogo: los de ZENCRUS publicados.
create index if not exists wp_catalogo
  on public.workout_programs (goal, level) where user_id is null and is_published;
-- Y los míos.
create index if not exists wp_mios
  on public.workout_programs (user_id, created_at desc) where user_id is not null;

-- ═══ 2 · INSCRIPCIONES ════════════════════════════════════════════════════
-- Seguir un programa. Guarda POR DÓNDE VA, no lo que ya hizo: eso está en las
-- sesiones.

create table if not exists public.program_enrollments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,

  -- Un programa retirado del catálogo no puede desaparecerle a quien lo sigue,
  -- así que se borra en cascada solo si se borra de verdad la plantilla.
  program_id    uuid not null references public.workout_programs(id) on delete cascade,

  started_at    timestamptz not null default now(),
  ended_at      timestamptz,

  -- Por dónde va. Se adelanta al terminar el último día de la semana.
  current_week  smallint not null default 1 check (current_week >= 1),
  current_day   smallint not null default 1 check (current_day between 1 and 7),

  status        text not null default 'active'
                check (status in ('active', 'completed', 'abandoned')),

  /**
   * Pesos que la persona ha fijado a mano, por ejercicio.
   *
   * La progresión los calcula sola desde los récords, PERO el usuario manda:
   * la filosofía de ZENCRUS es que la IA propone y la persona ajusta cada
   * valor. Lo que ponga aquí gana sobre lo calculado, y se recuerda de una
   * semana a la siguiente en vez de tener que volver a corregirlo cada vez.
   */
  overrides     jsonb not null default '{}'::jsonb,

  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint enrollment_ended_iff_closed check (
    (status = 'active'  and ended_at is null) or
    (status <> 'active' and ended_at is not null)
  )
);

comment on column public.program_enrollments.overrides is
  'Pesos fijados a mano por ejercicio. Ganan sobre lo que calcula la progresión.';

/**
 * UN SOLO PROGRAMA ACTIVO POR PERSONA.
 *
 * Mismo criterio que la sesión abierta. Dos programas a la vez no es
 * flexibilidad: es no seguir ninguno, porque el volumen de los dos se suma
 * sobre el mismo cuerpo y la progresión de cada uno cuenta con recuperar de lo
 * suyo. Si alguien quiere cambiar, abandona y empieza otro.
 */
create unique index if not exists pe_one_active
  on public.program_enrollments (user_id) where status = 'active';

create index if not exists pe_user_time
  on public.program_enrollments (user_id, started_at desc);

-- ═══ 3 · MANTENIMIENTO ════════════════════════════════════════════════════

drop trigger if exists workout_programs_touch on public.workout_programs;
create trigger workout_programs_touch
  before update on public.workout_programs
  for each row execute function public.touch_workout_session();

drop trigger if exists program_enrollments_touch on public.program_enrollments;
create trigger program_enrollments_touch
  before update on public.program_enrollments
  for each row execute function public.touch_workout_session();

-- ═══ 4 · CIERRE ═══════════════════════════════════════════════════════════
-- Sin políticas: el acceso pasa por el backend, que sí sabe quién pregunta.
-- Ojo con la tentación de abrir `workout_programs` a `anon` «porque el catálogo
-- es público»: el catálogo es público, pero esta tabla también guarda los
-- programas PRIVADOS de cada persona, en las mismas filas.
alter table public.workout_programs   enable row level security;
alter table public.program_enrollments enable row level security;

revoke all on public.workout_programs, public.program_enrollments
  from anon, authenticated;

commit;

-- ── Comprobación ──────────────────────────────────────────────────────────
select 'tablas' as que, count(*)::text as n from information_schema.tables
  where table_schema='public' and table_name in ('workout_programs','program_enrollments')
union all select 'un programa activo', count(*)::text from pg_indexes
  where indexname = 'pe_one_active'
union all select 'sesiones ya enlazan', count(*)::text from information_schema.columns
  where table_name='workout_sessions' and column_name in ('program_id','program_week','program_day');
