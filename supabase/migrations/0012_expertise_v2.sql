-- =====================================================================
-- Polish 5 — Expertise v2.
-- Replaces the 0.5-default reputation with a "start at 0" model:
--   - Brand-new users see 0 expertise across every category.
--   - Expertise only rises once they actually resolve positions.
--   - The composite weighs accuracy (40%), calibration (25%), volume
--     ramp (15%), conviction (10%), consistency (10%) into a [0..100]
--     score per category.
-- Idempotent. Paste after 0011.
-- =====================================================================

-- Update defaults so new rows insert at 0 across the board.
alter table public.reputation_metrics
  alter column accuracy set default 0,
  alter column calibration set default 0,
  alter column conviction_quality set default 0,
  alter column early_edge set default 0,
  alter column consensus_outperf set default 0,
  alter column difficulty set default 0,
  alter column consistency set default 0,
  alter column risk_discipline set default 0,
  alter column market_impact set default 0,
  alter column trust set default 0,
  alter column composite set default 0,
  alter column tier set default 'new';

-- Reset existing 0.5-defaulted rows that never saw a real signal.
update public.reputation_metrics
   set accuracy = 0,
       calibration = 0,
       conviction_quality = 0,
       early_edge = 0,
       consensus_outperf = 0,
       difficulty = 0,
       consistency = 0,
       risk_discipline = 0,
       market_impact = 0,
       trust = 0,
       composite = 0,
       tier = 'new'
 where resolved_count = 0;

-- ---------- recompute_user_expertise(user_id) -----------------------
-- Walks every category the user has resolved positions in and
-- rebuilds their `reputation_metrics` row from the underlying ledger.
-- Returns the count of categories touched.
--
-- Formula (per category):
--   accuracy        = wins / resolved
--   calibration     = 1 - mean(|outcome - p_at_entry|)
--   conviction      = mean(shares_won / shares_traded)       (0..1)
--   consistency     = 1 - stddev(per_trade_pnl_norm)         (0..1)
--   volume_ramp     = min(resolved / 25, 1)                  (caps at 25
--                                                              resolutions)
--   composite       = 0.40 * accuracy
--                   + 0.25 * calibration
--                   + 0.10 * conviction
--                   + 0.10 * consistency
--                   + 0.15 * volume_ramp                     (all 0..1)
--   tier            = case bands on composite (new < bronze < silver
--                     < gold < diamond < legend)
--   stored as composite × 100.
--
-- Users with 0 resolved trades in a category are skipped (left at 0).

create or replace function public.recompute_user_expertise(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_touched int := 0;
  v_row record;
  v_accuracy real;
  v_calibration real;
  v_conviction real;
  v_consistency real;
  v_volume_ramp real;
  v_composite real;
  v_tier text;
  v_resolved int;
  v_volume_zaps int;
begin
  for v_row in
    select m.category_id
      from public.markets m
      join public.positions po on po.market_id = m.id
     where po.user_id = p_user_id
       and m.status = 'resolved'
       and m.outcome in ('YES','NO')
     group by m.category_id
  loop
    select
      count(*)::int,
      coalesce(sum(po.shares * po.avg_price / 100)::int, 0),
      avg(case
            when (po.side = 'YES' and m.outcome = 'YES') then 1.0
            when (po.side = 'NO'  and m.outcome = 'NO')  then 1.0
            else 0.0
          end),
      avg(1.0 - abs(
        (case when m.outcome = 'YES' then 1.0 else 0.0 end)
        - (po.avg_price / 100.0)
      ))
    into v_resolved, v_volume_zaps, v_accuracy, v_calibration
      from public.positions po
      join public.markets m on m.id = po.market_id
     where po.user_id = p_user_id
       and m.category_id = v_row.category_id
       and m.status = 'resolved'
       and m.outcome in ('YES','NO');

    if v_resolved = 0 then continue; end if;

    -- conviction: are you holding meaningful share sizes? scaled to [0,1]
    v_conviction := least(
      1.0,
      (select avg(po.shares::real) / 100.0
         from public.positions po
         join public.markets m on m.id = po.market_id
        where po.user_id = p_user_id
          and m.category_id = v_row.category_id
          and m.status = 'resolved')
    );
    if v_conviction is null then v_conviction := 0; end if;

    -- consistency: 1 - stddev of per-trade win indicator. higher stddev
    -- means choppier results, lower consistency.
    v_consistency := greatest(
      0.0,
      1.0 - coalesce((select stddev_pop(case
        when (po.side = 'YES' and m.outcome = 'YES') then 1.0
        when (po.side = 'NO'  and m.outcome = 'NO')  then 1.0
        else 0.0
      end)
      from public.positions po
      join public.markets m on m.id = po.market_id
     where po.user_id = p_user_id
       and m.category_id = v_row.category_id
       and m.status = 'resolved'), 0.5)
    );

    v_volume_ramp := least(1.0, v_resolved::real / 25.0);

    v_composite := least(1.0, greatest(0.0,
        0.40 * v_accuracy
      + 0.25 * v_calibration
      + 0.10 * v_conviction
      + 0.10 * v_consistency
      + 0.15 * v_volume_ramp
    ));

    v_tier := case
      when v_resolved < 5 then 'new'
      when v_composite >= 0.85 then 'legend'
      when v_composite >= 0.72 then 'diamond'
      when v_composite >= 0.60 then 'gold'
      when v_composite >= 0.48 then 'silver'
      when v_composite >= 0.35 then 'bronze'
      else 'new'
    end;

    insert into public.reputation_metrics (
      user_id, category_id,
      accuracy, calibration, conviction_quality, consistency,
      resolved_count, volume_zaps, composite, tier
    ) values (
      p_user_id, v_row.category_id,
      v_accuracy, v_calibration, v_conviction, v_consistency,
      v_resolved, v_volume_zaps, v_composite, v_tier
    )
    on conflict (user_id, category_id) do update set
      accuracy = excluded.accuracy,
      calibration = excluded.calibration,
      conviction_quality = excluded.conviction_quality,
      consistency = excluded.consistency,
      resolved_count = excluded.resolved_count,
      volume_zaps = excluded.volume_zaps,
      composite = excluded.composite,
      tier = excluded.tier,
      updated_at = now();

    v_touched := v_touched + 1;
  end loop;

  return v_touched;
end
$$;

grant execute on function public.recompute_user_expertise(uuid) to authenticated;

-- ---------- recompute hook on market resolution ---------------------
-- Whenever a market flips to resolved, walk every holder and refresh
-- their expertise for that category.
create or replace function public.recompute_expertise_on_resolve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'resolved' and (old.status is null or old.status <> 'resolved') then
    perform public.recompute_user_expertise(po.user_id)
      from public.positions po
     where po.market_id = new.id;
  end if;
  return new;
end
$$;

drop trigger if exists recompute_expertise_on_resolve_trg on public.markets;
create trigger recompute_expertise_on_resolve_trg
  after update of status on public.markets
  for each row execute function public.recompute_expertise_on_resolve();
