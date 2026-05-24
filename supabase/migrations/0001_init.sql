-- =====================================================================
-- Zap initial schema
-- Paste into Supabase SQL Editor and run, or `supabase db push`.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------- Enums ----------------------------------------------------

do $$ begin
  create type side as enum ('yes', 'no');
exception when duplicate_object then null; end $$;

do $$ begin
  create type market_status as enum ('open', 'resolved', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type market_outcome as enum ('yes', 'no');
exception when duplicate_object then null; end $$;

do $$ begin
  create type trade_action as enum ('buy', 'sell');
exception when duplicate_object then null; end $$;

-- ---------- profiles -------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null,
  name            text not null,
  bio             text,
  avatar_url      text,
  cover_gradient  text,
  zaps            integer not null default 1000,
  total_predictions integer not null default 0,
  affinity        jsonb not null default '{}'::jsonb,
  onboarded       boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists profiles_username_idx on public.profiles using gin (username gin_trgm_ops);

-- ---------- categories -----------------------------------------------

create table if not exists public.categories (
  id        uuid primary key default gen_random_uuid(),
  slug      text unique not null,
  name      text not null,
  color     text not null,
  icon      text not null
);

insert into public.categories (slug, name, color, icon) values
  ('politics',      'Politics',      '#F59E0B', 'landmark'),
  ('crypto',        'Crypto',        '#A855F7', 'bitcoin'),
  ('sports',        'Sports',        '#10B981', 'trophy'),
  ('tech',          'Tech',          '#3B82F6', 'cpu'),
  ('economy',       'Economy',       '#EF4444', 'trending-up'),
  ('entertainment', 'Entertainment', '#EC4899', 'film'),
  ('general',       'General',       '#9CA3AF', 'hash')
on conflict (slug) do nothing;

-- ---------- markets --------------------------------------------------

create table if not exists public.markets (
  id              uuid primary key default gen_random_uuid(),
  question        text not null,
  description     text,
  category_id     uuid not null references public.categories(id) on delete restrict,
  resolution_date timestamptz not null,
  resolution_source text,
  yes_price       real not null default 50 check (yes_price between 0 and 100),
  no_price        real not null default 50 check (no_price  between 0 and 100),
  total_volume    integer not null default 0,
  status          market_status not null default 'open',
  outcome         market_outcome,
  hero_image_url  text,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null
);
create index if not exists markets_category_idx on public.markets (category_id);
create index if not exists markets_status_idx on public.markets (status);
create index if not exists markets_question_trgm_idx on public.markets using gin (question gin_trgm_ops);

-- ---------- positions ------------------------------------------------

create table if not exists public.positions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  market_id   uuid not null references public.markets(id) on delete cascade,
  side        side not null,
  shares      integer not null check (shares >= 0),
  avg_price   real not null,
  created_at  timestamptz not null default now(),
  unique (user_id, market_id, side)
);
create index if not exists positions_user_idx on public.positions (user_id);
create index if not exists positions_market_idx on public.positions (market_id);

-- ---------- trades ---------------------------------------------------

create table if not exists public.trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  market_id   uuid not null references public.markets(id) on delete cascade,
  side        side not null,
  action      trade_action not null,
  shares      integer not null check (shares > 0),
  price       real not null check (price between 0 and 100),
  created_at  timestamptz not null default now()
);
create index if not exists trades_market_created_idx on public.trades (market_id, created_at desc);
create index if not exists trades_user_created_idx on public.trades (user_id, created_at desc);

-- ---------- posts ----------------------------------------------------

create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.profiles(id) on delete cascade,
  body_html       text not null,
  category_id     uuid not null references public.categories(id) on delete restrict,
  market_id       uuid references public.markets(id) on delete set null,
  images          jsonb not null default '[]'::jsonb,
  likes           integer not null default 0,
  comments_count  integer not null default 0,
  shares          integer not null default 0,
  boost_zaps      integer not null default 0,
  boost_until     timestamptz,
  exposure_score  real not null default 0,
  throttled       boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_exposure_idx on public.posts (exposure_score desc);
create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);
create index if not exists posts_category_idx on public.posts (category_id);
create index if not exists posts_body_trgm_idx on public.posts using gin (body_html gin_trgm_ops);

-- ---------- comments (self-referencing for nesting) ------------------

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  parent_id   uuid references public.comments(id) on delete cascade,
  body        text not null,
  likes       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists comments_parent_idx on public.comments (parent_id);

-- ---------- follows --------------------------------------------------

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

-- ---------- bookmarks ------------------------------------------------

create table if not exists public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  post_id     uuid references public.posts(id) on delete cascade,
  market_id   uuid references public.markets(id) on delete cascade,
  created_at  timestamptz not null default now(),
  check (
    (post_id is not null and market_id is null)
    or (post_id is null and market_id is not null)
  ),
  unique (user_id, post_id, market_id)
);

-- ---------- likes (post + comment, for "did I like this?" queries) --

create table if not exists public.post_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.comment_likes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

-- ---------- expert_scores --------------------------------------------

create table if not exists public.expert_scores (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  brier       real not null default 0,
  calibration real not null default 0,
  volume      integer not null default 0,
  percentile  real not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, category_id)
);

-- ---------- notifications --------------------------------------------

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------- drafts ---------------------------------------------------

create table if not exists public.drafts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  body_html   text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  market_id   uuid references public.markets(id) on delete set null,
  images      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists drafts_user_idx on public.drafts (user_id, updated_at desc);

-- =====================================================================
-- Triggers
-- =====================================================================

-- Create profile row on signup with 1000 starting Zaps.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  candidate text;
  suffix int := 0;
begin
  base_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    '[^a-z0-9_]', '', 'g'
  ));
  if base_username = '' or base_username is null then
    base_username := 'user';
  end if;
  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username, name, zaps)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data->>'name', candidate),
    1000
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep posts.comments_count in sync.
create or replace function public.bump_post_comment_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comments_count = greatest(0, comments_count - 1) where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_bump_post_comment_count on public.comments;
create trigger trg_bump_post_comment_count
  after insert or delete on public.comments
  for each row execute function public.bump_post_comment_count();

-- Likes counters.
create or replace function public.bump_post_likes()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set likes = likes + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set likes = greatest(0, likes - 1) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_bump_post_likes on public.post_likes;
create trigger trg_bump_post_likes after insert or delete on public.post_likes
  for each row execute function public.bump_post_likes();

create or replace function public.bump_comment_likes()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set likes = likes + 1 where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update public.comments set likes = greatest(0, likes - 1) where id = old.comment_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_bump_comment_likes on public.comment_likes;
create trigger trg_bump_comment_likes after insert or delete on public.comment_likes
  for each row execute function public.bump_comment_likes();

-- =====================================================================
-- Realtime publication
-- =====================================================================
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    alter publication supabase_realtime add table public.posts;
    alter publication supabase_realtime add table public.comments;
    alter publication supabase_realtime add table public.trades;
    alter publication supabase_realtime add table public.markets;
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when duplicate_object then null;
end $$;

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.markets        enable row level security;
alter table public.positions      enable row level security;
alter table public.trades         enable row level security;
alter table public.posts          enable row level security;
alter table public.comments       enable row level security;
alter table public.follows        enable row level security;
alter table public.bookmarks      enable row level security;
alter table public.post_likes     enable row level security;
alter table public.comment_likes  enable row level security;
alter table public.expert_scores  enable row level security;
alter table public.notifications  enable row level security;
alter table public.drafts         enable row level security;

-- profiles: anyone signed-in can read; only the owner can update; insert via trigger only.
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles for select using (true);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- categories: public read, no writes from clients.
drop policy if exists "categories read all" on public.categories;
create policy "categories read all" on public.categories for select using (true);

-- markets: public read; client writes blocked (admin via service role only).
drop policy if exists "markets read all" on public.markets;
create policy "markets read all" on public.markets for select using (true);

-- positions: owner read-only from client (writes via server actions w/ service role).
drop policy if exists "positions read own" on public.positions;
create policy "positions read own" on public.positions for select
  using (auth.uid() = user_id);

-- trades: anyone can read (it's a public market). Inserts via server actions.
drop policy if exists "trades read all" on public.trades;
create policy "trades read all" on public.trades for select using (true);

-- posts: public read; insert/update/delete only by author.
drop policy if exists "posts read all" on public.posts;
create policy "posts read all" on public.posts for select using (true);
drop policy if exists "posts insert own" on public.posts;
create policy "posts insert own" on public.posts for insert
  with check (auth.uid() = author_id);
drop policy if exists "posts update own" on public.posts;
create policy "posts update own" on public.posts for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists "posts delete own" on public.posts;
create policy "posts delete own" on public.posts for delete
  using (auth.uid() = author_id);

-- comments: public read; insert/delete only by author.
drop policy if exists "comments read all" on public.comments;
create policy "comments read all" on public.comments for select using (true);
drop policy if exists "comments insert own" on public.comments;
create policy "comments insert own" on public.comments for insert
  with check (auth.uid() = author_id);
drop policy if exists "comments delete own" on public.comments;
create policy "comments delete own" on public.comments for delete
  using (auth.uid() = author_id);

-- follows: anyone can see; only the follower can write/remove their own follow.
drop policy if exists "follows read all" on public.follows;
create policy "follows read all" on public.follows for select using (true);
drop policy if exists "follows write own" on public.follows;
create policy "follows write own" on public.follows for insert
  with check (auth.uid() = follower_id);
drop policy if exists "follows delete own" on public.follows;
create policy "follows delete own" on public.follows for delete
  using (auth.uid() = follower_id);

-- bookmarks: private to owner.
drop policy if exists "bookmarks own all" on public.bookmarks;
create policy "bookmarks own all" on public.bookmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- post_likes / comment_likes: anyone can read; only owner toggles.
drop policy if exists "post_likes read all" on public.post_likes;
create policy "post_likes read all" on public.post_likes for select using (true);
drop policy if exists "post_likes write own" on public.post_likes;
create policy "post_likes write own" on public.post_likes for insert
  with check (auth.uid() = user_id);
drop policy if exists "post_likes delete own" on public.post_likes;
create policy "post_likes delete own" on public.post_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "comment_likes read all" on public.comment_likes;
create policy "comment_likes read all" on public.comment_likes for select using (true);
drop policy if exists "comment_likes write own" on public.comment_likes;
create policy "comment_likes write own" on public.comment_likes for insert
  with check (auth.uid() = user_id);
drop policy if exists "comment_likes delete own" on public.comment_likes;
create policy "comment_likes delete own" on public.comment_likes for delete
  using (auth.uid() = user_id);

-- expert_scores: public read, no client writes.
drop policy if exists "expert_scores read all" on public.expert_scores;
create policy "expert_scores read all" on public.expert_scores for select using (true);

-- notifications: private to owner.
drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select
  using (auth.uid() = user_id);
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- drafts: private to owner.
drop policy if exists "drafts own all" on public.drafts;
create policy "drafts own all" on public.drafts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- Storage buckets + policies
-- =====================================================================
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "post-images public read"  on storage.objects;
create policy "post-images public read" on storage.objects for select
  using (bucket_id = 'post-images');

drop policy if exists "post-images user upload" on storage.objects;
create policy "post-images user upload" on storage.objects for insert
  with check (
    bucket_id = 'post-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "post-images user delete" on storage.objects;
create policy "post-images user delete" on storage.objects for delete
  using (
    bucket_id = 'post-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars user upload" on storage.objects;
create policy "avatars user upload" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars user update" on storage.objects;
create policy "avatars user update" on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
