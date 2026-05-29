-- =====================================================================
-- Phase 0/1 audit fixes — atomic toggles + atomic trade execution.
-- Paste after 0007_categories_expand.sql. Idempotent.
--
-- 1. toggle_post_like(uuid) / toggle_post_bookmark(uuid) /
--    toggle_market_bookmark(uuid) / toggle_comment_like(uuid)
--    — single-statement upsert/delete to eliminate the SELECT-then-INSERT
--    race in `lib/db/posts.ts togglePostLike` and siblings.
--
-- 2. execute_trade(...) — SECURITY DEFINER function that atomically
--    debits Zaps, upserts the position, inserts the trade, and bumps
--    market price + volume. Replaces the non-atomic JS executeTrade.
--
-- 3. Adds INSERT policies for `positions` and `trades` so even if the
--    function is bypassed, only the owner can write their own row.
--
-- 4. Add `app.admin_user_id` GUC bootstrap section is unchanged from
--    earlier migrations — kept in 0005_hardening.sql.
-- =====================================================================

-- ---------- positions / trades: own-row INSERT/UPDATE policies -------

drop policy if exists "positions write own" on public.positions;
create policy "positions write own" on public.positions for insert
  with check (auth.uid() = user_id);

drop policy if exists "positions update own" on public.positions;
create policy "positions update own" on public.positions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "positions delete own" on public.positions;
create policy "positions delete own" on public.positions for delete
  using (auth.uid() = user_id);

drop policy if exists "trades write own" on public.trades;
create policy "trades write own" on public.trades for insert
  with check (auth.uid() = user_id);

-- ---------- toggle_post_like ----------------------------------------

create or replace function public.toggle_post_like(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_existed boolean;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.post_likes
    where user_id = v_user and post_id = p_post_id
    returning true into v_existed;
  if v_existed then
    return false;
  end if;
  insert into public.post_likes (user_id, post_id)
    values (v_user, p_post_id)
    on conflict do nothing;
  return true;
end $$;

grant execute on function public.toggle_post_like(uuid) to authenticated;
revoke all on function public.toggle_post_like(uuid) from anon;

-- ---------- toggle_post_bookmark ------------------------------------

create or replace function public.toggle_post_bookmark(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_existed boolean;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.bookmarks
    where user_id = v_user and post_id = p_post_id and market_id is null
    returning true into v_existed;
  if v_existed then
    return false;
  end if;
  insert into public.bookmarks (user_id, post_id) values (v_user, p_post_id);
  return true;
end $$;

grant execute on function public.toggle_post_bookmark(uuid) to authenticated;
revoke all on function public.toggle_post_bookmark(uuid) from anon;

-- ---------- toggle_market_bookmark -----------------------------------

create or replace function public.toggle_market_bookmark(p_market_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_existed boolean;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.bookmarks
    where user_id = v_user and market_id = p_market_id and post_id is null
    returning true into v_existed;
  if v_existed then
    return false;
  end if;
  insert into public.bookmarks (user_id, market_id) values (v_user, p_market_id);
  return true;
end $$;

grant execute on function public.toggle_market_bookmark(uuid) to authenticated;
revoke all on function public.toggle_market_bookmark(uuid) from anon;

-- ---------- toggle_comment_like --------------------------------------

create or replace function public.toggle_comment_like(p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_existed boolean;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.comment_likes
    where user_id = v_user and comment_id = p_comment_id
    returning true into v_existed;
  if v_existed then
    return false;
  end if;
  insert into public.comment_likes (user_id, comment_id) values (v_user, p_comment_id);
  return true;
end $$;

grant execute on function public.toggle_comment_like(uuid) to authenticated;
revoke all on function public.toggle_comment_like(uuid) from anon;

-- ---------- execute_trade --------------------------------------------
-- One transaction: balance check (FOR UPDATE), debit, position upsert,
-- trade insert, market price + volume bump. Returns the new balance.

create or replace function public.execute_trade(
  p_market_id uuid,
  p_side      side,
  p_action    trade_action,
  p_shares    integer,
  p_price     real
)
returns table (new_balance integer, new_shares integer, new_avg_price real)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user      uuid := auth.uid();
  v_balance   integer;
  v_cost      integer;
  v_existing  public.positions%rowtype;
  v_total     integer;
  v_avg       real;
  v_remaining integer;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_shares <= 0 then
    raise exception 'Shares must be positive' using errcode = '22023';
  end if;
  if p_price < 0 or p_price > 100 then
    raise exception 'Price must be between 0 and 100' using errcode = '22023';
  end if;
  if not exists (select 1 from public.markets where id = p_market_id and status = 'open') then
    raise exception 'Market is not open' using errcode = '22023';
  end if;

  v_cost := round((p_shares * p_price) / 100.0)::int;

  if p_action = 'buy' then
    -- Lock the profile row so concurrent buys can't both pass the
    -- balance check. Returns NOT FOUND if the row is missing.
    select zaps into v_balance from public.profiles
      where id = v_user for update;
    if v_balance is null then
      raise exception 'Profile not found' using errcode = 'P0002';
    end if;
    if v_balance < v_cost then
      raise exception 'Not enough Zaps' using errcode = '22023';
    end if;
    update public.profiles
       set zaps = zaps - v_cost,
           total_predictions = total_predictions + 1
     where id = v_user
    returning zaps into v_balance;

    -- Upsert position with avg-price math.
    select * into v_existing from public.positions
      where user_id = v_user and market_id = p_market_id and side = p_side
      for update;
    if found then
      v_total := v_existing.shares + p_shares;
      v_avg := (v_existing.avg_price * v_existing.shares + p_price * p_shares) / v_total;
      update public.positions
         set shares = v_total, avg_price = v_avg
       where id = v_existing.id;
    else
      v_total := p_shares;
      v_avg := p_price;
      insert into public.positions (user_id, market_id, side, shares, avg_price)
        values (v_user, p_market_id, p_side, p_shares, p_price);
    end if;

  elsif p_action = 'sell' then
    select * into v_existing from public.positions
      where user_id = v_user and market_id = p_market_id and side = p_side
      for update;
    if not found or v_existing.shares < p_shares then
      raise exception 'Not enough shares to sell' using errcode = '22023';
    end if;
    update public.profiles
       set zaps = zaps + v_cost
     where id = v_user
    returning zaps into v_balance;

    v_remaining := v_existing.shares - p_shares;
    if v_remaining = 0 then
      delete from public.positions where id = v_existing.id;
      v_total := 0;
      v_avg := 0;
    else
      update public.positions set shares = v_remaining
        where id = v_existing.id;
      v_total := v_remaining;
      v_avg := v_existing.avg_price;
    end if;
  else
    raise exception 'Unknown action' using errcode = '22023';
  end if;

  -- Record the trade ledger entry.
  insert into public.trades (user_id, market_id, side, action, shares, price)
    values (v_user, p_market_id, p_side, p_action, p_shares, p_price);

  -- Move the market price slightly toward the executed price + bump
  -- total_volume. Tiny linear nudge so a single trade can't crash a
  -- thin market; tune later.
  update public.markets
     set yes_price = case
           when p_side = 'yes' and p_action = 'buy' then least(99, yes_price + 0.5)
           when p_side = 'yes' and p_action = 'sell' then greatest(1, yes_price - 0.5)
           when p_side = 'no'  and p_action = 'buy' then greatest(1, yes_price - 0.5)
           when p_side = 'no'  and p_action = 'sell' then least(99, yes_price + 0.5)
           else yes_price
         end,
         no_price = case
           when p_side = 'yes' and p_action = 'buy' then greatest(1, no_price - 0.5)
           when p_side = 'yes' and p_action = 'sell' then least(99, no_price + 0.5)
           when p_side = 'no'  and p_action = 'buy' then least(99, no_price + 0.5)
           when p_side = 'no'  and p_action = 'sell' then greatest(1, no_price - 0.5)
           else no_price
         end,
         total_volume = total_volume + v_cost
   where id = p_market_id;

  return query select v_balance, v_total, v_avg;
end $$;

grant execute on function public.execute_trade(uuid, side, trade_action, integer, real) to authenticated;
revoke all on function public.execute_trade(uuid, side, trade_action, integer, real) from anon;
