-- =====================================================================
-- Phase 11+ — Hyper-personalization, quests, streaks, reputation, admin
-- Idempotent — safe to re-run.
-- =====================================================================

-- ---------- profiles: new economy + streak columns -------------------
-- New users start with 50 Zaps (down from 1000). Existing rows are
-- untouched.

alter table public.profiles
  alter column zaps set default 50;

-- ---------- streaks (denormalized on profiles) -----------------------

alter table public.profiles add column if not exists current_streak    integer not null default 0;
alter table public.profiles add column if not exists longest_streak    integer not null default 0;
alter table public.profiles add column if not exists last_active_day   date;
alter table public.profiles add column if not exists recoveries_available integer not null default 1;
alter table public.profiles add column if not exists recovery_history  jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists pending_recovery_for date;

-- ---------- ranking snapshot (set at fetch time) ---------------------
-- Set once when the feed is fetched. Updates to likes/comments do NOT
-- mutate this — order is frozen until the user explicitly refreshes.

alter table public.posts add column if not exists rank_snapshot_score real;
alter table public.posts add column if not exists rank_snapshot_at    timestamptz;

-- ---------- post taxonomy used by the new ranking --------------------

alter table public.posts add column if not exists hashtags         text[] not null default '{}'::text[];
alter table public.posts add column if not exists sentiment_style  text;
alter table public.posts add column if not exists content_format   text;

create index if not exists posts_rank_snapshot_idx
  on public.posts (rank_snapshot_score desc nulls last, created_at desc, id desc);
create index if not exists posts_hashtags_idx
  on public.posts using gin (hashtags);

-- =====================================================================
-- Quests
-- =====================================================================

create table if not exists public.quest_progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  kind       text not null,
  progress   integer not null default 0,
  goal       integer not null,
  reward     integer not null,
  completed  boolean not null default false,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, day, kind)
);
create index if not exists quest_progress_user_day_idx on public.quest_progress (user_id, day desc);

alter table public.quest_progress enable row level security;
drop policy if exists "quests read own" on public.quest_progress;
create policy "quests read own" on public.quest_progress for select using (auth.uid() = user_id);
drop policy if exists "quests upsert own" on public.quest_progress;
create policy "quests upsert own" on public.quest_progress for insert with check (auth.uid() = user_id);
drop policy if exists "quests update own" on public.quest_progress;
create policy "quests update own" on public.quest_progress for update using (auth.uid() = user_id);

-- =====================================================================
-- Reputation
-- =====================================================================
-- Per (user, category) row, mirroring expert_scores but with the new
-- 10-metric breakdown. Composite score + tier are computed in app code.

create table if not exists public.reputation_metrics (
  user_id           uuid not null references public.profiles(id) on delete cascade,
  category_id       uuid not null references public.categories(id) on delete cascade,
  accuracy          real not null default 0.5,
  calibration       real not null default 0.5,
  conviction_quality real not null default 0.5,
  early_edge        real not null default 0.5,
  consensus_outperf real not null default 0.5,
  difficulty        real not null default 0.5,
  consistency       real not null default 0.5,
  risk_discipline   real not null default 0.5,
  market_impact     real not null default 0.5,
  trust             real not null default 0.5,
  resolved_count    integer not null default 0,
  volume_zaps       integer not null default 0,
  composite         real not null default 0.5,
  tier              text not null default 'new',
  updated_at        timestamptz not null default now(),
  primary key (user_id, category_id)
);

alter table public.reputation_metrics enable row level security;
drop policy if exists "reputation read all" on public.reputation_metrics;
create policy "reputation read all" on public.reputation_metrics for select using (true);
-- writes only via service role

-- =====================================================================
-- Zaps ledger (audit + anti-inflation)
-- =====================================================================

create table if not exists public.zap_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  delta       integer not null,
  reason      text not null,
  ref_table   text,
  ref_id      uuid,
  balance_after integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists zap_events_user_idx on public.zap_events (user_id, created_at desc);

alter table public.zap_events enable row level security;
drop policy if exists "zap_events read own" on public.zap_events;
create policy "zap_events read own" on public.zap_events for select using (auth.uid() = user_id);
-- writes via service role only

-- =====================================================================
-- Session-aware signal log (passive + active + negative)
-- =====================================================================
-- Append-only; the personalization worker reads recent rows and merges
-- them into profiles.affinity.

create table if not exists public.signal_events (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid references public.posts(id) on delete cascade,
  signal     text not null,
  category   text,
  hashtags   text[] not null default '{}'::text[],
  author_id  uuid references public.profiles(id) on delete set null,
  weight     real not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists signal_events_user_idx on public.signal_events (user_id, created_at desc);

alter table public.signal_events enable row level security;
drop policy if exists "signals insert own" on public.signal_events;
create policy "signals insert own" on public.signal_events for insert with check (auth.uid() = user_id);
drop policy if exists "signals read own" on public.signal_events;
create policy "signals read own" on public.signal_events for select using (auth.uid() = user_id);

-- =====================================================================
-- Admin lockdown
-- =====================================================================
-- Only the user whose id matches the ADMIN_USER_ID env var (read on the
-- server) is allowed admin-level rows. We expose `is_admin()` as a
-- SQL helper that checks the `profiles.role = 'admin'` column. Promotion
-- to admin is service-role-only — there is no client policy that lets
-- a user grant themselves the role.

alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user', 'admin'));

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable as $$
  select coalesce((select role from public.profiles where id = uid), 'user') = 'admin';
$$;

-- =====================================================================
-- Quest counts helper — server-side increment + auto-mark completed
-- =====================================================================

create or replace function public.bump_quest_progress(
  p_user_id uuid,
  p_day date,
  p_kind text,
  p_delta integer default 1
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.quest_progress
     set progress = least(goal, progress + p_delta),
         completed = case when progress + p_delta >= goal then true else completed end
   where user_id = p_user_id and day = p_day and kind = p_kind;
end $$;

-- =====================================================================
-- Realtime publication
-- =====================================================================
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    alter publication supabase_realtime add table public.quest_progress;
    alter publication supabase_realtime add table public.zap_events;
  end if;
exception when duplicate_object then null;
end $$;
