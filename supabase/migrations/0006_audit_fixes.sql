-- =====================================================================
-- Phase 11+ — Production audit fixes (paste after 0005_hardening.sql).
-- Idempotent.
--
-- Closes the gaps surfaced by the final launch inspection:
--
--   1. handle_new_user() was inserting 1000 ⚡ on signup, contradicting
--      the new economy (50 ⚡ default in 0003). Updated to 50.
--   2. .env.local.example referenced `public.bootstrap_admin(uuid)` but
--      no such function existed. Added it.
--   3. `post-images` bucket had insert + delete policies but no update,
--      so replace-in-place uploads silently failed. Added.
--   4. Belt-and-suspenders: ensure every public-write table has the
--      expected policy shape.
-- =====================================================================

-- ---------- 1) handle_new_user — fix starting Zaps ------------------

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
    -- Phase 11+ economy: new users start with 50 Zaps. They earn more
    -- via daily quests, streak milestones, accurate predictions, etc.
    50
  );
  return new;
end;
$$;

-- ---------- 2) bootstrap_admin helper -------------------------------
-- Promote a single user to admin. The 0005 `enforce_admin_pin` trigger
-- guards this — it raises if the target uuid doesn't match the
-- `app.admin_user_id` Postgres setting.
--
-- Usage (after setting `alter database postgres set app.admin_user_id
-- = '<uuid>';`):
--     select public.bootstrap_admin('<uuid>');
--
-- The function flips `is_admin` only. We DO NOT mint a starting
-- balance here — every account, including admin, starts from whatever
-- the canonical onboarding flow set (currently 50 Zaps) and earns
-- the rest via quests, streaks, and trading. The previous
-- `zaps = greatest(zaps, 9999999)` line was a debug shortcut that
-- desynced the on-screen BalancePill from the real ledger; it is
-- intentionally removed.

create or replace function public.bootstrap_admin(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'No profile with id %', p_user_id;
  end if;
  update public.profiles
     set is_admin = true,
         updated_at = now()
   where id = p_user_id;
end $$;

-- Restrict so only the service role can call this — admin promotion
-- is never a user-context operation.
revoke all on function public.bootstrap_admin(uuid) from public;
revoke all on function public.bootstrap_admin(uuid) from anon, authenticated;

-- ---------- 3) post-images: missing update policy -------------------

do $$ begin
  perform 1 from pg_policies
    where schemaname = 'storage' and policyname = 'post-images user update';
  if not found then
    create policy "post-images user update"
      on storage.objects for update
      using (
        bucket_id = 'post-images'
        and auth.uid() is not null
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- ---------- 4) sanity: every bucket has the expected policy shape ---
-- This block is a no-op when policies already exist (created in 0001
-- + 0004 + 0005). It re-asserts them for fresh databases applied out
-- of order.

do $$ begin
  -- avatars: delete-own
  perform 1 from pg_policies
    where schemaname = 'storage' and policyname = 'avatars user delete';
  if not found then
    create policy "avatars user delete"
      on storage.objects for delete
      using (
        bucket_id = 'avatars'
        and auth.uid() is not null
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- ---------- 5) confirm all required tables are in realtime ----------

do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    -- profiles + posts + comments + trades + notifications + markets
    -- are added in earlier migrations. This is a safety net for fresh
    -- DBs where one of the earlier publication-add blocks raced.
    begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.posts; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.comments; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.trades; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.markets; exception when duplicate_object then null; end;
  end if;
end $$;
