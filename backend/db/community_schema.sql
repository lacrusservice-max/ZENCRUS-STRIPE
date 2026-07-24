-- ============================================================================
-- ZENCRUS · Comunidad (feed social tipo Instagram)
-- Ejecutar en el editor SQL de Supabase. Idempotente (IF NOT EXISTS).
-- ============================================================================

-- ── Publicaciones ───────────────────────────────────────────────────────────
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  content      text,
  image_url    text,
  kind         text not null default 'post',            -- post | progress | achievement | meal | workout
  metadata     jsonb not null default '{}'::jsonb,      -- streak, achievement, macros, etc.
  likes_count  integer not null default 0,
  comments_count integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_posts_created  on public.posts (created_at desc);
create index if not exists idx_posts_user     on public.posts (user_id, created_at desc);

-- ── Likes ────────────────────────────────────────────────────────────────────
create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists idx_post_likes_user on public.post_likes (user_id);

-- ── Comentarios ───────────────────────────────────────────────────────────────
create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_post_comments_post on public.post_comments (post_id, created_at);

-- ── Seguidores ────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id  uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists idx_follows_following on public.follows (following_id);

-- ── Contadores automáticos (triggers) ─────────────────────────────────────────
create or replace function public.bump_post_likes() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_post_likes on public.post_likes;
create trigger trg_post_likes
  after insert or delete on public.post_likes
  for each row execute function public.bump_post_likes();

create or replace function public.bump_post_comments() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_post_comments on public.post_comments;
create trigger trg_post_comments
  after insert or delete on public.post_comments
  for each row execute function public.bump_post_comments();
