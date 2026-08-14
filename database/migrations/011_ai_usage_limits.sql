-- ═══════════════════════════════════════════════════════════════════════════
-- ZENCRUS · Cuotas de uso de IA · esquema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- EL AGUJERO QUE CIERRA
-- ─────────────────────
-- Hoy `chat.routes.ts` solo pasa por `authenticate`. No hay comprobación de
-- plan ni tope de mensajes: cualquier usuario con sesión puede mandar los que
-- quiera. Y el plan Premium se decide en el TELÉFONO —`premiumStore` guarda
-- `plan: 'premium'` en AsyncStorage y la app lee eso para desbloquear— así que
-- tampoco hace falta pagar para tenerlo.
--
-- A 0,0059 MXN por mensaje, alguien con un script haciendo 10.000 al día
-- cuesta ~1.770 MXN al mes pagando 249. No es un riesgo teórico: es una fuga
-- abierta, y la única razón de que no duela todavía es que nadie la ha visto.
--
--
-- POR QUÉ UNA TABLA Y NO REDIS
-- ────────────────────────────
-- Hay REDIS_URL en el entorno y sería más rápido, pero una cuota que se pierde
-- al reiniciar Redis es una cuota que no existe: el minuto siguiente al
-- reinicio todo el mundo vuelve a tener el día entero. Esto se consulta una vez
-- por mensaje —no por request de una pantalla— así que el coste de ir a
-- Postgres es irrelevante al lado de los segundos que tarda el propio modelo.
--
--
-- POR QUÉ UNA FUNCIÓN Y NO UN SELECT + UN UPDATE
-- ──────────────────────────────────────────────
-- Leer el contador y luego incrementarlo desde el backend deja una ventana
-- entre las dos consultas. Dos peticiones simultáneas —que es exactamente lo
-- que hace una app que reintenta— leen ambas «24 de 25» y ambas escriben 25.
-- `consumir_cuota` hace las dos cosas en una sola sentencia atómica: el
-- `where` del ON CONFLICT es lo que impide pasarse del límite aunque lleguen
-- mil peticiones a la vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- ai_usage_daily · un contador por usuario, día y tipo de gasto
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.ai_usage_daily (
  user_id     uuid not null references public.users(id) on delete cascade,

  -- El día en la zona del usuario, no en UTC. Railway corre en UTC y si el
  -- corte fuera el suyo, la cuota se reiniciaría a las 6 de la tarde en México.
  usage_date  date not null,

  -- Se separa por tipo porque cuestan órdenes de magnitud distintos y sus
  -- topes son independientes: 25 mensajes no son 25 fotos.
  kind        text not null check (kind in ('chat', 'photo', 'plan')),

  count       integer not null default 0 check (count >= 0),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (user_id, usage_date, kind)
);

-- Para el panel de admin: quién está topando su cuota y con qué frecuencia.
create index if not exists ai_usage_daily_fecha_idx
  on public.ai_usage_daily (usage_date desc, kind);

drop trigger if exists ai_usage_daily_updated_at on public.ai_usage_daily;
create trigger ai_usage_daily_updated_at
  before update on public.ai_usage_daily
  for each row execute function update_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- consumir_cuota · incrementa si cabe, en una sola sentencia atómica
-- ───────────────────────────────────────────────────────────────────────────
--
-- Devuelve si se permitió, cuántos lleva y cuál era el tope. El backend NO
-- decide: pregunta y obedece.
--
-- La clave es el `where` del ON CONFLICT DO UPDATE. Si el contador ya alcanzó
-- el límite, la actualización no ocurre, `returning` no devuelve fila, y
-- v_usados queda en NULL — que es como se distingue «cabía» de «no cabía» sin
-- una segunda consulta que reabriría la ventana de carrera.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.consumir_cuota(
  p_user_id uuid,
  p_kind    text,
  p_limite  integer,
  p_fecha   date
)
returns table (permitido boolean, usados integer, limite integer)
language plpgsql
as $$
declare
  v_usados integer;
begin
  -- Un límite negativo significa «sin tope» (planes internos, pruebas).
  if p_limite < 0 then
    insert into public.ai_usage_daily (user_id, usage_date, kind, count)
    values (p_user_id, p_fecha, p_kind, 1)
    on conflict (user_id, usage_date, kind)
    do update set count = public.ai_usage_daily.count + 1
    returning public.ai_usage_daily.count into v_usados;

    return query select true, v_usados, p_limite;
    return;
  end if;

  insert into public.ai_usage_daily (user_id, usage_date, kind, count)
  values (p_user_id, p_fecha, p_kind, 1)
  on conflict (user_id, usage_date, kind)
  do update set count = public.ai_usage_daily.count + 1
    where public.ai_usage_daily.count < p_limite
  returning public.ai_usage_daily.count into v_usados;

  if v_usados is null then
    -- No se actualizó: ya estaba en el tope. Se lee para poder informar.
    select a.count into v_usados
      from public.ai_usage_daily a
     where a.user_id = p_user_id and a.usage_date = p_fecha and a.kind = p_kind;
    return query select false, coalesce(v_usados, p_limite), p_limite;
  else
    return query select true, v_usados, p_limite;
  end if;
end;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- devolver_cuota · deshace un consumo
-- ───────────────────────────────────────────────────────────────────────────
--
-- Existe porque hay gastos que no deben cobrarse al usuario: una foto que no
-- era comida, un reintento tras un fallo del modelo, una llamada que reventó
-- antes de responder. Sin esto, un error del sistema le come cuota a quien
-- paga, que es la forma más rápida de que una queja tenga razón.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.devolver_cuota(
  p_user_id uuid,
  p_kind    text,
  p_fecha   date
)
returns integer
language plpgsql
as $$
declare
  v_usados integer;
begin
  update public.ai_usage_daily
     set count = greatest(count - 1, 0)
   where user_id = p_user_id and usage_date = p_fecha and kind = p_kind
  returning count into v_usados;

  return coalesce(v_usados, 0);
end;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- RLS · igual que en la 010: cerrado, sin políticas permisivas
-- ───────────────────────────────────────────────────────────────────────────
-- El proyecto no usa Supabase Auth, así que `auth.uid()` sería siempre NULL y
-- cualquier política escrita con ella no autorizaría a nadie. Se activa RLS y
-- se deja sin política: solo entra el backend con service_role.
alter table public.ai_usage_daily enable row level security;
