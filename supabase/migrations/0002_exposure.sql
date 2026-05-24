-- =====================================================================
-- Phase 6 — Smart exposure / boost / anti-throttle
-- Paste into Supabase SQL Editor after 0001_init.sql.
-- Idempotent — safe to re-run.
-- =====================================================================

-- ---------- post impressions ledger ----------------------------------
-- Lightweight rollup of viewer↔post events, used by the engagement and
-- CTR factors. Inserts come from the recordImpression server action.

create table if not exists public.post_impressions (
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  dwell_ms    integer not null default 0,
  clicked     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists post_impressions_post_idx
  on public.post_impressions (post_id, created_at desc);
create index if not exists post_impressions_user_idx
  on public.post_impressions (user_id, created_at desc);

alter table public.post_impressions enable row level security;

drop policy if exists "impressions insert any signed-in" on public.post_impressions;
create policy "impressions insert any signed-in"
  on public.post_impressions for insert
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "impressions read own or anon" on public.post_impressions;
create policy "impressions read own or anon"
  on public.post_impressions for select
  using (user_id is null or auth.uid() = user_id);

-- ---------- boost events ---------------------------------------------
-- Append-only ledger of every boost the user has spent Zaps on. Lets us
-- show historical campaigns even after the post.boost_until expires.

create table if not exists public.boost_events (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  zaps        integer not null check (zaps > 0),
  duration_h  integer not null check (duration_h in (1, 4, 24)),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  early_stopped_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists boost_events_post_idx
  on public.boost_events (post_id, ends_at desc);
create index if not exists boost_events_user_idx
  on public.boost_events (user_id, created_at desc);

alter table public.boost_events enable row level security;

drop policy if exists "boost_events read all" on public.boost_events;
create policy "boost_events read all" on public.boost_events for select using (true);

-- Writes go through server actions only — no client insert/update policies.

-- ---------- throttle events ------------------------------------------
-- Records each time a post is throttled (low engagement at the 2h or 1h
-- gate). 3 within 7 days drops the author into a 24h cooldown.

create table if not exists public.post_throttle_events (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now()
);
create index if not exists post_throttle_events_author_idx
  on public.post_throttle_events (author_id, created_at desc);

alter table public.post_throttle_events enable row level security;

drop policy if exists "throttle_events read own" on public.post_throttle_events;
create policy "throttle_events read own"
  on public.post_throttle_events for select
  using (auth.uid() = author_id);

-- ---------- cooldowns ------------------------------------------------
-- Adds a -0.3 starting penalty for 24h after 3 throttles in 7d.

create table if not exists public.author_cooldowns (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ends_at     timestamptz not null,
  reason      text not null default 'auto:3-throttles-7d'
);

alter table public.author_cooldowns enable row level security;

drop policy if exists "cooldowns read own" on public.author_cooldowns;
create policy "cooldowns read own"
  on public.author_cooldowns for select
  using (auth.uid() = user_id);

-- ---------- helper: percentile of an author in a category -----------

create or replace function public.expert_factor_for(
  p_user_id uuid,
  p_category_id uuid
) returns real
language sql stable as $$
  select coalesce(percentile / 100.0, 0.5)::real
  from public.expert_scores
  where user_id = p_user_id and category_id = p_category_id
  limit 1;
$$;

-- ---------- helper: engagement factor -------------------------------
-- Combines like/comment/share counts vs impressions, capped to [0,1].

create or replace function public.engagement_factor_for(p_post_id uuid)
returns real
language sql stable as $$
  with imp as (
    select count(*)::numeric as n,
           sum(case when clicked then 1 else 0 end)::numeric as clicks
    from public.post_impressions
    where post_id = p_post_id
  ),
  p as (
    select likes, comments_count, shares
    from public.posts where id = p_post_id
  )
  select greatest(0, least(1,
    -- engagement-per-impression, normalized
    case when imp.n < 5 then
      -- not enough data yet: fall back to raw engagement ÷ 50
      least(1, (p.likes * 1.0 + p.comments_count * 2.0 + p.shares * 3.0) / 50.0)
    else
      least(1,
        ( (p.likes * 1.0 + p.comments_count * 2.0 + p.shares * 3.0)
          / nullif(imp.n, 0)
        ) * 4.0
      )
    end
  ))::real
  from imp, p;
$$;

-- ---------- helper: freshness factor --------------------------------
-- Decay so that a new post (≤2h) ≈ 1.0 and a 48h-old post ≈ 0.
-- Half-life ~12h.

create or replace function public.freshness_factor_for(p_post_id uuid)
returns real
language sql stable as $$
  select greatest(0, least(1,
    exp(- extract(epoch from (now() - created_at)) / (12.0 * 3600.0))
  ))::real
  from public.posts where id = p_post_id;
$$;

-- ---------- helper: category affinity --------------------------------
-- Reads profiles.affinity jsonb (slug → score 0..1).

create or replace function public.category_affinity_for(
  p_user_id uuid,
  p_category_slug text
) returns real
language sql stable as $$
  select coalesce(
    (affinity ->> p_category_slug)::real,
    0.3
  )::real
  from public.profiles where id = p_user_id;
$$;

-- ---------- helper: boost factor ------------------------------------
-- Decays linearly across the boost window. boost_zaps drives amplitude.

create or replace function public.boost_factor_for(p_post_id uuid)
returns real
language sql stable as $$
  select case
    when boost_until is null or boost_until <= now() then 0::real
    else
      least(1,
        -- amplitude: 50 → 0.25, 200 → 0.5, 500 → 0.75, 1500 → 1
        (log(greatest(boost_zaps, 1)) / log(1500))::real
      ) *
      -- time-remaining decay
      greatest(0,
        extract(epoch from (boost_until - now()))
        / nullif(
            extract(epoch from (boost_until - created_at)),
            0
          )
      )::real
  end
  from public.posts where id = p_post_id;
$$;

-- ---------- main: compute_exposure_score(post_id) -------------------
-- Returns the final [0,1] exposure score and writes it back to the row.
-- This is what the feed orders by.

create or replace function public.compute_exposure_score(
  p_post_id uuid,
  p_viewer_id uuid default null
) returns real
language plpgsql stable as $$
declare
  v_post         record;
  v_category     record;
  v_expert       real;
  v_engagement   real;
  v_freshness    real;
  v_affinity     real;
  v_boost        real;
  v_score        real;
  v_throttled    boolean;
  v_cooldown_pen real := 0;
begin
  select p.*, c.slug as category_slug
    into v_post
    from public.posts p
    join public.categories c on c.id = p.category_id
    where p.id = p_post_id;

  if not found then
    return 0;
  end if;

  v_expert     := public.expert_factor_for(v_post.author_id, v_post.category_id);
  v_engagement := public.engagement_factor_for(p_post_id);
  v_freshness  := public.freshness_factor_for(p_post_id);
  v_boost      := public.boost_factor_for(p_post_id);
  v_throttled  := coalesce(v_post.throttled, false);

  if p_viewer_id is not null then
    v_affinity := public.category_affinity_for(p_viewer_id, v_post.category_slug);
  else
    v_affinity := 0.3;
  end if;

  -- cooldown penalty: -0.3 starting weight for 24h after 3 throttles
  if exists (
    select 1 from public.author_cooldowns
    where user_id = v_post.author_id and ends_at > now()
  ) then
    v_cooldown_pen := 0.3;
  end if;

  v_score :=
      0.40 * v_expert
    + 0.25 * v_engagement
    + 0.15 * v_freshness
    + 0.10 * v_affinity
    + 0.10 * v_boost
    - v_cooldown_pen;

  -- throttled posts: clamp to half visibility, no boost amplification
  if v_throttled then
    v_score := least(v_score, 0.5 * v_score);
  end if;

  v_score := greatest(0, least(1, v_score));

  -- Cache the viewer-independent score on the row so the index works.
  -- (Personalization is applied as an additive lift in the feed query.)
  if p_viewer_id is null then
    update public.posts set exposure_score = v_score where id = p_post_id;
  end if;

  return v_score;
end $$;

-- ---------- anti-spam: check_throttle(post_id) ----------------------
-- Should be called by a scheduled job (or on read). Returns true if the
-- post was just throttled.

create or replace function public.check_throttle(p_post_id uuid)
returns boolean
language plpgsql as $$
declare
  v_post       record;
  v_engagement real;
  v_age_h      numeric;
  v_throttle   boolean := false;
  v_reason     text;
  v_recent_throttles int;
begin
  select * into v_post from public.posts where id = p_post_id;
  if not found or v_post.throttled then
    return false;
  end if;

  v_age_h := extract(epoch from (now() - v_post.created_at)) / 3600.0;
  v_engagement := public.engagement_factor_for(p_post_id);

  -- Rule A: low engagement after 2h (no boost) → 0.5x penalty (throttle)
  if v_post.boost_until is null and v_age_h >= 2 and v_engagement < 0.10 then
    v_throttle := true;
    v_reason   := 'low_engagement_2h';
  end if;

  -- Rule B: low engagement after 1h DURING boost → throttle the boost
  if v_post.boost_until is not null
     and v_post.boost_until > now()
     and v_age_h >= 1
     and v_engagement < 0.15
  then
    v_throttle := true;
    v_reason   := 'low_engagement_boost_1h';
    -- end the boost early
    update public.posts set boost_until = now() where id = p_post_id;
    update public.boost_events
      set early_stopped_at = now()
      where post_id = p_post_id and early_stopped_at is null;
  end if;

  if v_throttle then
    update public.posts set throttled = true where id = p_post_id;
    insert into public.post_throttle_events (post_id, author_id, reason)
      values (p_post_id, v_post.author_id, v_reason);

    -- Rule C: 3 throttles in 7d → 24h cooldown
    select count(*) into v_recent_throttles
      from public.post_throttle_events
      where author_id = v_post.author_id
        and created_at > now() - interval '7 days';

    if v_recent_throttles >= 3 then
      insert into public.author_cooldowns (user_id, ends_at)
        values (v_post.author_id, now() + interval '24 hours')
        on conflict (user_id) do update
          set ends_at    = excluded.ends_at,
              started_at = now(),
              reason     = excluded.reason;
    end if;
  end if;

  -- Refresh the cached score either way.
  perform public.compute_exposure_score(p_post_id, null);
  return v_throttle;
end $$;

-- ---------- realtime: include the new tables ------------------------
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    alter publication supabase_realtime add table public.post_impressions;
    alter publication supabase_realtime add table public.boost_events;
  end if;
exception when duplicate_object then null;
end $$;
