-- ═══════════════════════════════════════════════════════════════════════════
-- ZENCRUS · Registro de nutrición y versionado de planes · esquema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- OJO ANTES DE APLICARLA: hay una `meal_logs` anterior
-- ────────────────────────────────────────────────────
-- La 001 creó una tabla con ese mismo nombre pero de otra cosa —adherencia al
-- plan, con los alimentos en un blob JSONB— y nunca se conectó a nada: no
-- aparece en una sola consulta del backend. El bloque `do $$` de más abajo la
-- renombra a `meal_logs_v1_adherencia` conservando lo que tenga, y solo si
-- detecta la forma vieja. Nada se pierde y la migración es idempotente.
--
--
-- LO QUE HABÍA ANTES
-- ──────────────────
-- Nada en el servidor. Lo que la gente come vivía ÚNICAMENTE en el teléfono,
-- en AsyncStorage, bajo la llave `nutrition_2026-08-13`. Es exactamente el
-- mismo agujero que tenían los entrenamientos antes de la migración 008, con
-- las mismas dos consecuencias:
--
--   1 · Al cambiar de móvil o reinstalar, el historial entero desaparece. Meses
--       de registro, borrados sin aviso y sin forma de recuperarlos.
--   2 · El servidor no puede leer ni escribir nada de la alimentación. ZENA no
--       puede responder «¿cuántas calorías llevo hoy?», no puede registrar una
--       comida que le pidan por chat, y el reconocimiento por foto no tendría
--       dónde dejar el resultado.
--
-- El punto 2 es el que bloquea todo lo demás: sin estas tablas no hay
-- herramientas de lectura, ni de escritura, ni foto, ni IA proactiva.
--
--
-- LO QUE SE CONSERVA DEL MODELO DEL TELÉFONO — leer antes de tocar nada
-- ────────────────────────────────────────────────────────────────────
-- El store del móvil ya tenía decisiones tomadas y algunas no son obvias.
-- Se respetan tal cual para que la migración no cambie el comportamiento:
--
--   · `active` NO es un borrado. Una entrada con active=false sigue VISIBLE en
--     el diario del día pero sale de los totales. Sirve para «esto lo dejé a la
--     mitad» sin perder el registro de que estuvo ahí. Es distinto de
--     `deleted_at`, que sí es borrado (suave).
--
--   · Los macros se guardan YA CALCULADOS para la cantidad registrada, no por
--     100 g. Cada fila es autosuficiente: se lee sin tocar el catálogo. Eso es
--     lo que hace que el histórico no se mueva cuando el catálogo se corrige.
--
--   · `emoji` viaja con la entrada en vez de recalcularse en cada pantalla, y
--     el comentario del store explica por qué: así el icono es el mismo en la
--     búsqueda, en la revisión y en el diario, sin que cada vista recuerde
--     pedirlo.
--
--   · Las seis comidas son fijas: desayuno, almuerzo, cena y tres snacks. No es
--     una tabla aparte porque no son datos, son la estructura del día.
--
--
-- DÓNDE ESTO SE APARTA DE LA 008 — y por qué
-- ──────────────────────────────────────────
-- `workout_sessions` denormaliza sus totales porque calcularlos exige recorrer
-- las series y multiplicar peso por repeticiones. Aquí los totales son una
-- suma de cinco columnas sobre las ~15 filas de un día: recalcularlos sale
-- más barato que mantenerlos sincronizados y arriesgarse a que deriven.
--
-- Por eso `nutrition_days` guarda SOLO lo que no se puede derivar de las
-- entradas —vasos de agua y racha— y los totales se calculan al leer, con el
-- índice de abajo. Si algún día la pantalla de progreso pide noventa días de
-- golpe y se nota, ese es el momento de materializarlos, no antes.
--
--
-- SOBRE RLS
-- ─────────
-- El backend entra con SERVICE_ROLE, que se salta RLS por diseño: el filtro
-- real es que `user_id` sale del JWT y nunca de la petición. Las políticas de
-- abajo son la SEGUNDA línea —protegen si algún día el móvil consulta directo
-- o si se filtra la llave anónima—, no la primera. No relajar el filtro del
-- backend confiando en ellas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- PASO 0 · apartar la meal_logs vieja
-- ───────────────────────────────────────────────────────────────────────────
--
-- La 001 ya creó una tabla llamada `meal_logs`, pero de otra cosa: era
-- adherencia al plan —`meal_name`, `items` en un blob JSONB, `completed`—, no
-- registro de alimentos. Nunca se conectó: no aparece en una sola consulta del
-- backend, y el móvil siempre guardó en AsyncStorage.
--
-- No se borra: se aparta con su nombre y sus datos intactos, por si alguna
-- instalación llegó a escribir algo. Cuando se confirme que está vacía en
-- producción, un `drop table public.meal_logs_v1_adherencia` la retira.
--
-- El `where` sobre `items` distingue la vieja de la nueva: si esta migración
-- ya corrió, la tabla actual no tiene esa columna y el bloque no hace nada.
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meal_logs' and column_name = 'items'
  ) then
    -- La política de la 001 apunta a auth.uid() y este proyecto no usa
    -- Supabase Auth: no autorizaba a nadie. Se va con la tabla.
    drop policy if exists "meal_logs_own" on public.meal_logs;
    alter table public.meal_logs rename to meal_logs_v1_adherencia;
    raise notice 'meal_logs anterior (adherencia al plan) renombrada a meal_logs_v1_adherencia';
  end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- meal_logs · una fila por alimento registrado
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.meal_logs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,

  -- El día al que pertenece la comida, no el instante en que se registró.
  -- Son cosas distintas: la cena de las 23:50 que se apunta a las 00:10 es
  -- del día anterior, y quien la apunta espera verla ahí.
  log_date      date not null,

  meal_slot     text not null
                check (meal_slot in ('breakfast','lunch','dinner','snack1','snack2','snack3')),

  -- Enlace al catálogo cuando el alimento vino de ahí. `on delete set null`
  -- por la misma razón que `routine_id` en la 008: borrar o depurar el
  -- catálogo no puede borrar lo que alguien ya se comió.
  food_id       uuid references public.foods(id) on delete set null,

  -- El nombre se COPIA aunque haya food_id. Si el catálogo se renombra o se
  -- fusiona por deduplicación, el historial sigue diciendo lo que el usuario
  -- registró aquel día.
  name          text not null,
  emoji         text,

  amount        numeric(10,2) not null check (amount > 0),
  unit          text not null default 'g',

  -- ── Macros, ya calculados para `amount` ────────────────────────────────
  calories      numeric(10,2) not null default 0 check (calories  >= 0),
  protein_g     numeric(10,2) not null default 0 check (protein_g >= 0),
  carbs_g       numeric(10,2) not null default 0 check (carbs_g   >= 0),
  fat_g         numeric(10,2) not null default 0 check (fat_g     >= 0),
  fiber_g       numeric(10,2) not null default 0 check (fiber_g   >= 0),

  -- Visible en el diario pero fuera de los totales. Ver la nota de arriba.
  active        boolean not null default true,

  -- Por dónde entró. Es lo que permite medir si el reconocimiento por foto
  -- acierta —comparando cuántas entradas 'photo' se corrigen después— sin
  -- montar telemetría aparte.
  source        text not null default 'manual'
                check (source in ('manual','search','barcode','photo','ai','plan')),

  -- Borrado suave: «bórrame el desayuno» tiene que ser reversible. La consulta
  -- del día filtra por deleted_at is null; una tarea de limpieza se lleva lo
  -- que pase de treinta días.
  deleted_at    timestamptz,

  -- Idempotencia offline, igual que en workout_sessions: el móvil reintenta
  -- cuando la red va y viene, y sin esto cada reintento duplicaría la comida.
  -- Lo genera la app, no el servidor.
  client_id     text not null,

  -- Hora real de la comida cuando se sabe. Sirve para el patrón de horarios
  -- que ZENA usa para adaptarse; no es lo mismo que created_at.
  consumed_at   timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint meal_logs_client_id_unico unique (user_id, client_id)
);

-- La consulta que corre en cada apertura de la pantalla de Nutrición: el día
-- de un usuario, sin lo borrado. El índice parcial deja fuera lo borrado para
-- que no estorbe.
create index if not exists meal_logs_dia_idx
  on public.meal_logs (user_id, log_date)
  where deleted_at is null;

-- Para la pantalla de progreso y para los resúmenes de ZENA: rangos de fechas.
create index if not exists meal_logs_rango_idx
  on public.meal_logs (user_id, log_date desc, meal_slot)
  where deleted_at is null;

-- Cuántas veces se registró un alimento del catálogo y cuántas se corrigió:
-- es el dato que decide si un platillo sube a «validado por la comunidad».
create index if not exists meal_logs_food_idx
  on public.meal_logs (food_id)
  where food_id is not null and deleted_at is null;


-- ───────────────────────────────────────────────────────────────────────────
-- nutrition_days · lo del día que NO se deriva de las entradas
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.nutrition_days (
  user_id       uuid not null references public.users(id) on delete cascade,
  log_date      date not null,

  water_glasses smallint not null default 0
                check (water_glasses between 0 and 50),

  -- Días seguidos registrando. Se guarda en vez de calcularse porque la regla
  -- de qué rompe una racha es una decisión de producto que puede cambiar, y
  -- recalcular el histórico entero cada vez que cambie sería absurdo.
  streak        integer not null default 0 check (streak >= 0),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  primary key (user_id, log_date)
);


-- ───────────────────────────────────────────────────────────────────────────
-- plan_versions · historial inmutable de cambios de plan
-- ───────────────────────────────────────────────────────────────────────────
--
-- Solo se INSERTA. Nunca se actualiza ni se borra una fila de aquí.
--
-- Cada cambio de targets, dieta, rutina u objetivo guarda el estado COMPLETO
-- anterior antes de aplicar el nuevo. Restaurar no borra nada: crea una
-- versión más que es copia de una vieja, y así la línea del tiempo nunca
-- pierde un paso.
--
-- Es lo que convierte «la IA me cambió algo raro» en un problema de dos
-- toques, y lo que permite que ZENA pueda deshacer lo que acaba de hacer.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.plan_versions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,

  tipo          text not null
                check (tipo in ('targets','dieta','rutina','objetivo')),

  -- El estado anterior entero, tal cual estaba. No un diff: un diff obliga a
  -- reconstruir desde el principio para saber qué había, y basta con que se
  -- pierda un eslabón para no poder restaurar nada.
  snapshot      jsonb not null,

  creado_por    text not null
                check (creado_por in ('usuario','ia','nutriologa','sistema')),

  -- En palabras del usuario: «ajuste por cambio de peso». Es lo que se enseña
  -- en la pantalla de historial, así que se escribe para leerse.
  motivo        text,

  -- Trazabilidad hasta el mensaje que lo provocó, cuando lo hizo ZENA. Sin
  -- clave ajena a propósito: si se borra una conversación, el historial del
  -- plan no puede irse con ella.
  session_id    uuid,
  message_id    uuid,

  created_at    timestamptz not null default now()
);

-- El historial de un usuario, de lo más nuevo a lo más viejo: es como se pinta
-- la pantalla y como ZENA busca «lo que había antes».
create index if not exists plan_versions_usuario_idx
  on public.plan_versions (user_id, created_at desc);

create index if not exists plan_versions_tipo_idx
  on public.plan_versions (user_id, tipo, created_at desc);


-- ───────────────────────────────────────────────────────────────────────────
-- updated_at automático
-- ───────────────────────────────────────────────────────────────────────────
-- Se reutiliza `update_updated_at()`, que la 001 ya definió y que usan users,
-- diet_plans, workout_routines, chat_sessions y subscriptions. Definir otra
-- función idéntica con otro nombre solo crearía dos sitios donde arreglar lo
-- mismo el día que haya que tocarlo.
-- ───────────────────────────────────────────────────────────────────────────
drop trigger if exists meal_logs_updated_at on public.meal_logs;
create trigger meal_logs_updated_at
  before update on public.meal_logs
  for each row execute function update_updated_at();

drop trigger if exists nutrition_days_updated_at on public.nutrition_days;
create trigger nutrition_days_updated_at
  before update on public.nutrition_days
  for each row execute function update_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- RLS · cerrado a cal y canto
-- ───────────────────────────────────────────────────────────────────────────
--
-- ZENCRUS NO usa Supabase Auth: la autenticación es propia (JWT firmado por el
-- backend) y los usuarios viven en `public.users`, no en `auth.users`. Por eso
-- aquí NO se escriben políticas con `auth.uid()`: en este proyecto esa función
-- devuelve siempre NULL, así que una política `using (auth.uid() = user_id)`
-- no autoriza a nadie. Parecería seguridad y no haría nada — o peor, daría por
-- protegido algo que en realidad solo está roto.
--
-- Lo que se hace es lo que de verdad corresponde a esta arquitectura: activar
-- RLS y NO crear ninguna política permisiva. Con eso, cualquiera que llegue
-- con la llave anónima —el móvil, un script, alguien que la extraiga del
-- bundle— no ve ni escribe una sola fila. El único camino es el backend, que
-- entra con SERVICE_ROLE y se salta RLS por diseño.
--
-- El filtro real, entonces, sigue siendo el de siempre: `user_id` sale del JWT
-- verificado y NUNCA de la petición. Esto es la red debajo, para el día que la
-- llave anónima se filtre o alguien decida consultar directo desde el móvil.
--
-- Si algún día se migra a Supabase Auth, este es el bloque que hay que
-- reescribir con políticas `auth.uid() = user_id` de verdad.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.meal_logs      enable row level security;
alter table public.nutrition_days enable row level security;
alter table public.plan_versions  enable row level security;

-- Por si una migración anterior dejó políticas sueltas con el nombre viejo.
drop policy if exists meal_logs_propio      on public.meal_logs;
drop policy if exists nutrition_days_propio on public.nutrition_days;
drop policy if exists plan_versions_lectura on public.plan_versions;
