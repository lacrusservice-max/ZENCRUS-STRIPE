begin;
create table if not exists public.saved_posts (
  user_id    uuid not null references public.users(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists saved_posts_user_time
  on public.saved_posts (user_id, created_at desc);
create table if not exists public.blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.users(id) on delete cascade,
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
create unique index if not exists reports_una_por_persona
  on public.reports (reporter_id, target_type, target_id);
create index if not exists reports_pendientes
  on public.reports (created_at) where status = 'pendiente';
alter table public.saved_posts enable row level security;
alter table public.blocks      enable row level security;
alter table public.reports     enable row level security;
revoke all on public.saved_posts, public.blocks, public.reports
  from anon, authenticated;
commit;