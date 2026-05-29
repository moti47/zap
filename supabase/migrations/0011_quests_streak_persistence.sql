-- =====================================================================
-- Polish 4 — Persisted daily quests + streaks.
-- Lifts quest progress, claim state, and streak from the in-memory
-- Zustand store onto `public.profiles` so:
--   - progress survives reloads
--   - new quests roll only when the local day actually advances
--   - claim credits go to the canonical `profiles.zaps` column
--   - streak credits flow through the same atomic path as quests
-- All operations are idempotent.
-- Paste after 0010_user_management_and_streaks.sql.
-- =====================================================================

alter table public.profiles
  add column if not exists quest_day text;
alter table public.profiles
  add column if not exists quest_progress jsonb not null default '{}'::jsonb;
alter table public.profiles
  add column if not exists quest_claimed jsonb not null default '{}'::jsonb;
alter table public.profiles
  add column if not exists streak_current int not null default 0;
alter table public.profiles
  add column if not exists streak_longest int not null default 0;
alter table public.profiles
  add column if not exists streak_last_check_in date;

-- ---------- bump_quest(kind, delta) ----------------------------------
-- Increments the per-day counter for `kind` for the calling user.
-- Resets the progress map when the local `expected_day` differs from
-- the stored day (the client passes its own YYYY-MM-DD so timezone
-- rollover stays consistent with the user's clock — server-side now()
-- would otherwise hop to UTC).

create or replace function public.bump_quest(
  p_kind text,
  p_delta int default 1,
  p_expected_day text default to_char(now() at time zone 'utc', 'YYYY-MM-DD')
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_progress jsonb;
  v_claimed jsonb;
  v_day text;
  v_cur int;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 then
    select quest_progress, quest_claimed into v_progress, v_claimed
      from public.profiles where id = v_uid;
    return jsonb_build_object(
      'progress', coalesce(v_progress, '{}'::jsonb),
      'claimed', coalesce(v_claimed, '{}'::jsonb)
    );
  end if;

  -- Roll the day if needed (atomic compare-and-swap on quest_day).
  select quest_day, quest_progress, quest_claimed
    into v_day, v_progress, v_claimed
    from public.profiles where id = v_uid for update;
  if v_day is distinct from p_expected_day then
    v_progress := '{}'::jsonb;
    v_claimed := '{}'::jsonb;
    v_day := p_expected_day;
  end if;

  v_cur := coalesce((v_progress ->> p_kind)::int, 0) + p_delta;
  v_progress := jsonb_set(coalesce(v_progress, '{}'::jsonb), array[p_kind], to_jsonb(v_cur));

  update public.profiles
    set quest_day = v_day,
        quest_progress = v_progress,
        quest_claimed = coalesce(v_claimed, '{}'::jsonb)
    where id = v_uid;

  return jsonb_build_object('progress', v_progress, 'claimed', coalesce(v_claimed, '{}'::jsonb));
end
$$;

grant execute on function public.bump_quest(text, int, text) to authenticated;

-- ---------- claim_quest_reward(kind, goal, reward) -------------------
-- Atomically:
--   1. roll the day if needed (matches bump_quest)
--   2. verify progress[kind] >= goal AND not already claimed
--   3. mark claimed[kind] = true
--   4. credit profiles.zaps by `reward`
-- Returns { ok, reason?, new_balance, claimed }.

create or replace function public.claim_quest_reward(
  p_kind text,
  p_goal int,
  p_reward int,
  p_expected_day text default to_char(now() at time zone 'utc', 'YYYY-MM-DD')
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day text;
  v_progress jsonb;
  v_claimed jsonb;
  v_progress_val int;
  v_new_balance int;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_reward is null or p_reward <= 0 or p_reward > 1000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_reward');
  end if;
  if p_goal is null or p_goal <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_goal');
  end if;

  select quest_day, quest_progress, quest_claimed
    into v_day, v_progress, v_claimed
    from public.profiles where id = v_uid for update;

  if v_day is distinct from p_expected_day then
    -- Day rolled — no progress, can't claim today's quest from a
    -- previous day's progress map.
    update public.profiles
      set quest_day = p_expected_day,
          quest_progress = '{}'::jsonb,
          quest_claimed = '{}'::jsonb
      where id = v_uid;
    return jsonb_build_object('ok', false, 'reason', 'day_rolled');
  end if;

  if coalesce((v_claimed ->> p_kind)::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;

  v_progress_val := coalesce((v_progress ->> p_kind)::int, 0);
  if v_progress_val < p_goal then
    return jsonb_build_object('ok', false, 'reason', 'incomplete');
  end if;

  v_claimed := jsonb_set(coalesce(v_claimed, '{}'::jsonb), array[p_kind], 'true'::jsonb);
  update public.profiles
    set quest_claimed = v_claimed,
        zaps = zaps + p_reward
    where id = v_uid
    returning zaps into v_new_balance;

  return jsonb_build_object('ok', true, 'new_balance', v_new_balance, 'claimed', v_claimed);
end
$$;

grant execute on function public.claim_quest_reward(text, int, int, text) to authenticated;

-- ---------- touch_streak() -------------------------------------------
-- Called once per session/page load. If the user already checked in
-- today, no-op. If they checked in yesterday, increment current.
-- Otherwise reset to 1. Always credits `daily_reward` (passed by the
-- caller, capped at 50) on a fresh check-in. Updates longest.

create or replace function public.touch_streak(
  p_today date default (now() at time zone 'utc')::date,
  p_daily_reward int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_last date;
  v_current int;
  v_longest int;
  v_new_current int;
  v_new_longest int;
  v_credited int := 0;
  v_balance int;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_daily_reward is null or p_daily_reward < 0 then p_daily_reward := 0; end if;
  if p_daily_reward > 50 then p_daily_reward := 50; end if;

  select streak_last_check_in, streak_current, streak_longest, zaps
    into v_last, v_current, v_longest, v_balance
    from public.profiles where id = v_uid for update;

  if v_last is not null and v_last = p_today then
    -- Already checked in today.
    return jsonb_build_object(
      'current', v_current,
      'longest', v_longest,
      'credited', 0,
      'new_balance', v_balance,
      'already_today', true
    );
  end if;

  if v_last is not null and v_last = (p_today - interval '1 day')::date then
    v_new_current := coalesce(v_current, 0) + 1;
  else
    v_new_current := 1;
  end if;
  v_new_longest := greatest(coalesce(v_longest, 0), v_new_current);
  v_credited := p_daily_reward;

  update public.profiles
    set streak_current = v_new_current,
        streak_longest = v_new_longest,
        streak_last_check_in = p_today,
        zaps = zaps + v_credited
    where id = v_uid
    returning zaps into v_balance;

  return jsonb_build_object(
    'current', v_new_current,
    'longest', v_new_longest,
    'credited', v_credited,
    'new_balance', v_balance,
    'already_today', false
  );
end
$$;

grant execute on function public.touch_streak(date, int) to authenticated;
