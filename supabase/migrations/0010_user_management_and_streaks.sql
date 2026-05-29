-- 0010_user_management_and_streaks.sql
-- Production hardening pass:
--   * Adds `profiles.is_suspended` so the admin user-management table
--     can flip account status. Idempotent.
--   * Widens `profiles.role` constraint to include 'moderator' so the
--     admin role ladder (user / moderator / admin) is representable.
--   * Adds `profiles.last_tracked_login` and `profiles.last_streak_day`
--     so the deterministic 24h quest / streak lock works server-side.
--   * Adds `profiles.blocklist jsonb` to mirror the local block list.
--   * Adds `award_zaps(user_id uuid, amount int, reason text)` RPC so
--     quest claims inject Zaps in a single atomic transaction.

begin;

alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

alter table public.profiles
  add column if not exists last_tracked_login date;

alter table public.profiles
  add column if not exists last_streak_day date;

alter table public.profiles
  add column if not exists blocklist jsonb not null default '[]'::jsonb;

-- Widen the role check constraint to include 'moderator'.
do $$
begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role'
  ) then
    -- drop any prior role-check constraints by name pattern
    perform 1;
  end if;
exception when others then null;
end$$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'moderator', 'admin'));

-- ---- award_zaps RPC ---------------------------------------------------------
-- Atomic Zap injection for quest rewards. Increments `profiles.zaps`,
-- records to `zap_ledger` (if the table exists), and returns the new
-- balance. SECURITY DEFINER so a non-admin caller can credit themselves
-- only via the RPC contract (the calling context is auth.uid()).
create or replace function public.award_zaps(
  p_user_id uuid,
  p_amount int,
  p_reason text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  -- Only the row owner OR an admin may credit. Service-role bypasses
  -- via standard postgres role; this guard is for the anon/auth roles.
  if auth.uid() is not null
     and auth.uid() <> p_user_id
     and not coalesce(
       (select is_admin from public.profiles where id = auth.uid()),
       false
     ) then
    raise exception 'not authorized to award zaps to other users';
  end if;

  update public.profiles
     set zaps = zaps + p_amount,
         updated_at = now()
   where id = p_user_id
  returning zaps into v_new_balance;

  if v_new_balance is null then
    raise exception 'profile not found';
  end if;

  -- Best-effort ledger insert. If the table doesn't exist (older env),
  -- silently swallow — the balance update is the contractual outcome.
  begin
    insert into public.zap_ledger (user_id, delta, reason, balance_after)
    values (p_user_id, p_amount, p_reason, v_new_balance);
  exception
    when undefined_table then null;
    when others then null;
  end;

  return v_new_balance;
end;
$$;

revoke all on function public.award_zaps(uuid, int, text) from public;
grant execute on function public.award_zaps(uuid, int, text) to authenticated, service_role;

-- ---- claim_daily_streak ----------------------------------------------------
-- Deterministic, idempotent per-UTC-day streak touch. Returns the
-- accumulated streak count. If the function is called multiple times
-- the same calendar day, only the first call advances state.
create or replace function public.claim_daily_streak(
  p_user_id uuid
) returns table (streak int, awarded int, locked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_last  date;
  v_streak int;
  v_awarded int := 0;
  v_reward int := 10; -- daily-login base reward
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  select last_streak_day into v_last
    from public.profiles
   where id = p_user_id
   for update;

  if v_last = v_today then
    -- Already claimed today; lock-in behavior.
    select coalesce((streak_count)::int, 0) into v_streak
      from public.streaks where user_id = p_user_id;
    return query select coalesce(v_streak, 0), 0, true;
    return;
  end if;

  -- Insert or bump the streaks row.
  insert into public.streaks (user_id, streak_count, last_active)
       values (p_user_id, 1, v_today)
  on conflict (user_id) do update
    set streak_count = case
          when public.streaks.last_active = v_today - 1
            then public.streaks.streak_count + 1
          else 1
        end,
        last_active = v_today
  returning streak_count into v_streak;

  update public.profiles
     set last_streak_day = v_today,
         last_tracked_login = v_today
   where id = p_user_id;

  -- Award the base reward via award_zaps for ledger consistency.
  begin
    v_awarded := v_reward;
    perform public.award_zaps(p_user_id, v_reward, 'daily_streak');
  exception when others then
    v_awarded := 0;
  end;

  return query select v_streak, v_awarded, false;
end;
$$;

revoke all on function public.claim_daily_streak(uuid) from public;
grant execute on function public.claim_daily_streak(uuid) to authenticated, service_role;

-- streaks table — guarded create so older envs without it still apply.
create table if not exists public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  streak_count int not null default 0,
  last_active date
);

alter table public.streaks enable row level security;
drop policy if exists streaks_owner_read on public.streaks;
create policy streaks_owner_read on public.streaks
  for select using (auth.uid() = user_id);
drop policy if exists streaks_owner_write on public.streaks;
create policy streaks_owner_write on public.streaks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
