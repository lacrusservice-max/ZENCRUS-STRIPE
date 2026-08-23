-- ═══════════════════════════════════════════════════════════════════════════
-- 016 · COMUNIDAD: GUARDADOS, BLOQUEOS Y DENUNCIAS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Tres cosas que la sección Social no tenía y que sí necesita antes de que la
-- use gente que no se conoce entre sí:
--
--   · guardar una publicación para volver a ella,
--   · bloquear a una persona ENTERA (no solo su chat, que es lo único que había),
--   · y denunciar una publicación o una cuenta.
--
-- ── Por qué el bloqueo es una tabla nueva y no una columna de `conversations` ─
-- Lo que existía era `conversations.status = 'blocked'`, que solo cierra UN
-- chat. Alguien a quien has bloqueado ahí seguía viendo tu perfil, tus
-- publicaciones y tus historias, y podía seguirte. Un bloqueo de verdad no vive
-- en la conversación: vive entre dos personas, exista o no una conversación.
-- Por eso es su propia tabla, y por eso la comprueba `socialAccess`, que es el
-- módulo único por el que pasa cada decisión de privacidad.
--
-- ── El bloqueo se mira en los DOS sentidos ──────────────────────────────────
-- La fila es dirigida —quién bloqueó a quién— porque hace falta saberlo para
-- poder desbloquear: solo quien bloqueó puede deshacerlo. Pero al decidir qué
-- se ve, basta con que exista una fila en cualquiera de los dos sentidos: si te
-- bloqueé, tampoco quiero verte yo.
--
-- ── Denunciar es acumular, no actuar ────────────────────────────────────────
-- Esta tabla no borra ni esconde nada por su cuenta. Guarda el aviso para que
-- alguien lo mire desde el panel de admin. Una denuncia que ocultara contenido
-- sola sería un botón para silenciar a cualquiera con unas cuantas cuentas.
--
-- Se aplica en Supabase (SQL Editor). Es idempotente: se puede volver a lanzar.

begin;

-- ═══ 1 · GUARDADOS ═════════════════════════════════════════════════════════
-- Sin identificador propio: la pareja persona+publicación ya es la clave, y así
-- guardar dos veces la misma no puede duplicar la fila.
create table if not exists public.saved_posts (
  user_id    uuid not null references public.users(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- El orden es por cuándo se guardó, no por cuándo se publicó: la lista de
-- guardados es un historial de MIS gestos, no un muro.
create index if not exists saved_posts_user_time
  on public.saved_posts (user_id, created_at desc);

-- ═══ 2 · BLOQUEOS ══════════════════════════════════════════════════════════
create table if not exists public.blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

-- Se pregunta en los dos sentidos en cada decisión de acceso, así que hace
-- falta índice también por la persona bloqueada: sin él, «¿quién me ha
-- bloqueado?» recorre la tabla entera en cada carga del muro.
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- ═══ 3 · DENUNCIAS ═════════════════════════════════════════════════════════
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.users(id) on delete cascade,
  -- No hay clave foránea al objeto denunciado porque puede ser de cuatro
  -- tablas distintas. Y porque una denuncia debe sobrevivir a que se borre lo
  -- denunciado: si desapareciera con ello, bastaría con borrar rápido para
  -- limpiar el historial.
  target_type  text not null check (target_type in ('post', 'user', 'comment', 'message')),
  target_id    uuid not null,
  reason       text not null check (reason in (
                 'spam', 'acoso', 'desnudos', 'violencia',
                 'autolesion', 'suplantacion', 'desinformacion', 'otro')),
  detail       text check (detail is null or char_length(detail) <= 1000),
  status       text not null default 'pendiente'
                 check (status in ('pendiente', 'revisada', 'descartada', 'aplicada')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.users(id) on delete set null,

  constraint reports_no_self check (
    target_type <> 'user' or reporter_id <> target_id
  )
);

-- Una denuncia por persona y objeto. Sin esto, pulsar dos veces «denunciar»
-- cuenta como dos avisos y una sola persona puede inflar el número que verá
-- quien las revise.
create unique index if not exists reports_una_por_persona
  on public.reports (reporter_id, target_type, target_id);

-- La cola de revisión: lo pendiente, lo más viejo primero.
create index if not exists reports_pendientes
  on public.reports (created_at) where status = 'pendiente';

-- ═══ 4 · CIERRE ════════════════════════════════════════════════════════════
-- Sin políticas: ni `anon` ni `authenticated` leen nada. El acceso pasa
-- exclusivamente por el backend, que sí sabe quién pregunta — aquí dentro no
-- existe `auth.uid()`, porque la sesión es un JWT propio, no Supabase Auth.
alter table public.saved_posts enable row level security;
alter table public.blocks      enable row level security;
alter table public.reports     enable row level security;

revoke all on public.saved_posts, public.blocks, public.reports
  from anon, authenticated;

commit;

-- ── Comprobación ───────────────────────────────────────────────────────────
select 'saved_posts' as tabla, count(*)::text as existe from information_schema.tables
  where table_schema = 'public' and table_name = 'saved_posts'
union all select 'blocks', count(*)::text from information_schema.tables
  where table_schema = 'public' and table_name = 'blocks'
union all select 'reports', count(*)::text from information_schema.tables
  where table_schema = 'public' and table_name = 'reports';
