-- ═══════════════════════════════════════════════════════════════════════════
-- ZENCRUS · Comunidad · esquema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- MODELO DE SEGURIDAD — leer antes de tocar nada
-- ─────────────────────────────────────────────
-- La autenticación de esta app es propia (JWT firmado por el backend), NO
-- Supabase Auth. En consecuencia `auth.uid()` no existe dentro de Postgres y
-- las políticas RLS no pueden saber quién pregunta.
--
-- Por eso el reparto de responsabilidades es este, y conviene tenerlo claro:
--
--   · RLS queda como cierre general: sin políticas, ni `anon` ni `authenticated`
--     leen una sola fila. Es la red que impide que alguien con la clave pública
--     de la app se lleve la base entera.
--   · TODA la lógica de privacidad —cuenta privada, solicitudes aceptadas, quién
--     ve qué publicación, quién puede escribir a quién— vive en el backend, en
--     un único módulo de autorización. Una comprobación olvidada en un endpoint
--     es una fuga; por eso no se reparten por los controladores.
--
-- Si algún día se migra a Supabase Auth, este archivo es el sitio donde añadir
-- las políticas por usuario, y el módulo del backend pasaría a ser redundante.

begin;

-- ═══ 1 · PERFIL PÚBLICO ═══════════════════════════════════════════════════
-- Lo que otra persona puede llegar a ver. Nada de aquí es sensible por sí solo:
-- lo sensible es el resto de la tabla `users` (correo, hash de contraseña,
-- peso, condiciones de salud), que NO se expone nunca en respuestas sociales.
alter table public.users add column if not exists is_private boolean not null default false;
alter table public.users add column if not exists bio text;

comment on column public.users.is_private is
  'true = las publicaciones y la lista de seguidores solo se ven tras aceptar la solicitud.';

-- La búsqueda es por nombre de usuario, así que tiene que ser único y rápido.
-- `lower()` porque nadie escribe respetando mayúsculas al buscar a alguien.
create unique index if not exists users_username_uniq
  on public.users (lower(username)) where username is not null;
create index if not exists users_username_search
  on public.users (lower(username) text_pattern_ops) where username is not null;

-- ═══ 2 · SEGUIMIENTO Y SOLICITUDES ════════════════════════════════════════
-- Una cuenta pública acepta al instante; una privada deja la fila en `pending`
-- hasta que su dueño decide. El estado vive en la propia relación para que no
-- haya dos tablas que puedan contradecirse.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'follow_status') then
    create type follow_status as enum ('pending', 'accepted');
  end if;
end $$;

alter table public.follows
  add column if not exists status follow_status not null default 'accepted';
alter table public.follows
  add column if not exists responded_at timestamptz;

-- Nadie se sigue a sí mismo. Es una invariante, no una validación de interfaz.
alter table public.follows drop constraint if exists follows_no_self;
alter table public.follows add constraint follows_no_self
  check (follower_id <> following_id);

create index if not exists follows_following_status
  on public.follows (following_id, status);
create index if not exists follows_follower_status
  on public.follows (follower_id, status);

-- ═══ 3 · PUBLICACIONES E HISTORIAS ════════════════════════════════════════
-- Ambas viven en `posts` y se distinguen por `kind`. La historia caduca; la
-- publicación no. Guardar la caducidad como fecha —y no como un booleano que
-- alguien tendría que ir apagando— hace que expirar sea una consulta, no un
-- proceso que puede fallar y dejar historias eternas.
alter table public.posts add column if not exists expires_at timestamptz;
alter table public.posts add column if not exists visibility text not null default 'followers';

alter table public.posts drop constraint if exists posts_visibility_chk;
alter table public.posts add constraint posts_visibility_chk
  check (visibility in ('public', 'followers'));

-- NO se restringe `kind` a ('post','story') a propósito. La app ya crea
-- publicaciones con `kind` en ('progress','achievement','meal','workout') —ver
-- `createPostSchema`— y una restricción así habría fallado al aplicarse sobre
-- las filas que ya existen. Lo que distingue a una historia es tener
-- `expires_at`, no su `kind`, y así lo comprueba el backend.
--
-- Por el mismo motivo tampoco se exige `(kind='story') = (expires_at is not null)`:
-- hoy pasaría, pero ataría el esquema a una clasificación que la app todavía
-- usa para otra cosa. Se puede añadir el día que `kind` se limpie.

create index if not exists posts_author_time on public.posts (user_id, created_at desc);
create index if not exists posts_kind_time on public.posts (kind, created_at desc);
-- Solo las historias vivas: el índice parcial evita recorrer las caducadas.
create index if not exists posts_stories_live
  on public.posts (expires_at) where kind = 'story';

-- ═══ 4 · MEDIOS DE UNA PUBLICACIÓN ════════════════════════════════════════
-- `posts.image_url` solo admitía una imagen. Aquí caben de una a cinco piezas,
-- con su orden, y vídeo además de imagen. El tope de cinco se comprueba también
-- en el backend; aquí queda como invariante para que ninguna vía lo salte.
create table if not exists public.post_media (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  url         text not null,
  media_type  text not null check (media_type in ('image', 'video')),
  width       int,
  height      int,
  duration_ms int,
  position    smallint not null check (position between 1 and 5),
  created_at  timestamptz not null default now(),
  unique (post_id, position)
);
create index if not exists post_media_post on public.post_media (post_id, position);

-- ═══ 5 · MENSAJES DIRECTOS ════════════════════════════════════════════════
-- Conversación de dos. El par se guarda ordenado —`user_lo` siempre menor que
-- `user_hi`— para que la clave única impida que existan dos conversaciones
-- entre las mismas dos personas según quién escribiera primero.
--
-- `status`: una cuenta pública recibe mensajes directamente; una privada los
-- deja en `pending` hasta que acepta. `requested_by` recuerda quién empezó,
-- porque solo la otra parte puede aceptar.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'conv_status') then
    create type conv_status as enum ('pending', 'accepted', 'blocked');
  end if;
end $$;

create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  user_lo       uuid not null references public.users(id) on delete cascade,
  user_hi       uuid not null references public.users(id) on delete cascade,
  status        conv_status not null default 'accepted',
  requested_by  uuid references public.users(id) on delete set null,
  last_message_at timestamptz,
  created_at    timestamptz not null default now(),
  constraint conv_ordered check (user_lo < user_hi),
  unique (user_lo, user_hi)
);
create index if not exists conv_lo on public.conversations (user_lo, last_message_at desc);
create index if not exists conv_hi on public.conversations (user_hi, last_message_at desc);

-- Tabla propia: `public.messages` es del chat con la IA (session_id,
-- sender_type) y mezclar ambas cosas acabaría filtrando una en la otra.
create table if not exists public.direct_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.users(id) on delete cascade,
  body            text,
  media_url       text,
  media_type      text check (media_type in ('image', 'video')),
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  -- Un mensaje vacío no es un mensaje.
  constraint dm_not_empty check (coalesce(btrim(body), '') <> '' or media_url is not null)
);
create index if not exists dm_conv_time on public.direct_messages (conversation_id, created_at desc);

-- ═══ 6 · NOTIFICACIONES SOCIALES ══════════════════════════════════════════
-- `public.notifications` son avisos push del sistema (recordatorios, plan
-- listo). Estas son de persona a persona y necesitan saber QUIÉN las provocó,
-- que es justo lo que aquella no guarda.
create table if not exists public.social_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  actor_id    uuid not null references public.users(id) on delete cascade,
  type        text not null check (type in
                ('like', 'comment', 'follow', 'follow_request', 'follow_accepted', 'mention')),
  post_id     uuid references public.posts(id) on delete cascade,
  comment_id  uuid references public.post_comments(id) on delete cascade,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now(),
  -- Nadie necesita que le avisen de lo que acaba de hacer.
  constraint notif_not_self check (user_id <> actor_id)
);
create index if not exists sn_user_time on public.social_notifications (user_id, created_at desc);
create index if not exists sn_user_unread on public.social_notifications (user_id) where not is_read;

-- ═══ 7 · CIERRE ═══════════════════════════════════════════════════════════
-- Sin políticas: ni `anon` ni `authenticated` leen nada. El acceso pasa
-- exclusivamente por el backend, que sí sabe quién pregunta.
alter table public.post_media           enable row level security;
alter table public.conversations        enable row level security;
alter table public.direct_messages      enable row level security;
alter table public.social_notifications enable row level security;

revoke all on public.post_media, public.conversations,
              public.direct_messages, public.social_notifications
  from anon, authenticated;

commit;

-- ── Comprobación ──────────────────────────────────────────────────────────
select 'users.is_private' as que, count(*)::text as ok from information_schema.columns
  where table_name='users' and column_name='is_private'
union all select 'follows.status', count(*)::text from information_schema.columns
  where table_name='follows' and column_name='status'
union all select 'posts.expires_at', count(*)::text from information_schema.columns
  where table_name='posts' and column_name='expires_at'
union all select 'tablas nuevas', count(*)::text from information_schema.tables
  where table_name in ('post_media','conversations','direct_messages','social_notifications');
