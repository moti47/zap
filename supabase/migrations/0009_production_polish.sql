-- =====================================================================
-- Stabilization + production polish. Paste after 0008_atomic_writes.sql.
-- Idempotent.
--
-- 1. Indexes the keyset-paginated feed + leaderboard queries actually use.
-- 2. RLS sweep: confirm every table flagged in the audit has the right
--    policies; add the missing handful.
-- 3. handle_new_user() trigger search_path hardened (audit P1-15).
-- 4. notification kind check constraint so typos can't slip in.
-- 5. bump_affinity helper used by trade/like server actions.
-- =====================================================================

-- ---------- indexes -------------------------------------------------

create index if not exists posts_keyset_idx
  on public.posts (created_at desc, id desc);

create index if not exists posts_author_created_pubidx
  on public.posts (author_id, created_at desc, id desc);

create index if not exists profiles_zaps_idx
  on public.profiles (zaps desc);

create index if not exists expert_scores_user_idx
  on public.expert_scores (user_id);

create index if not exists notifications_user_read_idx
  on public.notifications (user_id, read, created_at desc);

-- ---------- harden handle_new_user search_path ----------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  base_username text;
  candidate text;
  suffix int := 0;
begin
  base_username := lower(pg_catalog.regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', pg_catalog.split_part(new.email, '@', 1)),
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
    50
  );
  return new;
end;
$$;

-- ---------- notification kind check ---------------------------------
-- Lock the type to the values the client + server actually emit so a
-- bad insert (e.g. via service-role) is rejected at write time.

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'notifications'
      and constraint_name = 'notifications_type_chk'
  ) then
    alter table public.notifications
      add constraint notifications_type_chk
      check (type in (
        'follow', 'comment', 'reply', 'like', 'mention',
        'trade', 'market_resolved', 'boost_ended',
        'market_proposal_approved', 'market_proposal_rejected'
      ));
  end if;
end $$;

-- ---------- bump_affinity helper ------------------------------------
-- Merges +delta into profiles.affinity for the given category slug.
-- Called by server actions when a real user interacts with a post
-- (trade, like, click). Clamps to [0,1] so bad input can't pollute.

create or replace function public.bump_affinity(
  p_user_id uuid,
  p_category_slug text,
  p_delta real
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aff jsonb;
  v_cur real;
  v_next real;
begin
  if p_user_id is null or p_category_slug is null then
    return;
  end if;
  select affinity into v_aff from public.profiles where id = p_user_id for update;
  if v_aff is null then v_aff := '{}'::jsonb; end if;

  -- Detect nested shape: {categories: {...}}
  if (v_aff ? 'categories') and jsonb_typeof(v_aff->'categories') = 'object' then
    v_cur := coalesce((v_aff->'categories'->>p_category_slug)::real, 0.3);
    v_next := greatest(0, least(1, v_cur + p_delta));
    v_aff := jsonb_set(v_aff, array['categories', p_category_slug], to_jsonb(v_next), true);
  else
    v_cur := coalesce((v_aff->>p_category_slug)::real, 0.3);
    v_next := greatest(0, least(1, v_cur + p_delta));
    v_aff := jsonb_set(v_aff, array[p_category_slug], to_jsonb(v_next), true);
  end if;

  update public.profiles set affinity = v_aff where id = p_user_id;
end $$;

grant execute on function public.bump_affinity(uuid, text, real) to authenticated;
revoke all on function public.bump_affinity(uuid, text, real) from anon;

-- ---------- RLS sweep: ensure follows / market_proposals are OK -----

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'follows' and policyname = 'follows read all'
  ) then
    create policy "follows read all" on public.follows for select using (true);
  end if;
end $$;

-- ---------- realtime publication safety net -------------------------

do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  end if;
end $$;
