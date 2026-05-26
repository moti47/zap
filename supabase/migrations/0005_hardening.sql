-- =====================================================================
-- Phase 11+ — Final production hardening
--
-- Paste after 0004_production.sql. Idempotent.
--
-- 1. Promote `profiles.role text` → `profiles.is_admin boolean` so the
--    admin flag is type-safe and queryable.
-- 2. Sync the boolean to `process.env.ADMIN_USER_ID` exposed via the
--    Supabase `app.admin_user_id` setting (set via:
--       alter database postgres set app.admin_user_id = '<uuid>';
--    or per-request via `set_config('app.admin_user_id', '<uuid>', false)`).
-- 3. Enforce — no one but that env-pinned UUID can hold is_admin=true.
-- 4. Make sure `updated_at` exists on profiles (cache-bust key for the
--    UserAvatar component).
-- 5. Make sure every public bucket policy has insert+update+delete
--    scoped to the uploader's folder.
-- =====================================================================

-- ---------- profiles.is_admin -----------------------------------------

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Backfill from the legacy role column when present.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
    update public.profiles set is_admin = true where role = 'admin' and is_admin = false;
  end if;
end $$;

-- ---------- updated_at ------------------------------------------------

alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create or replace function public.profiles_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at_trg on public.profiles;
create trigger profiles_set_updated_at_trg
  before update on public.profiles
  for each row execute function public.profiles_set_updated_at();

-- ---------- env-pinned admin enforcement ------------------------------
-- The admin user id lives in the Postgres config so the trigger can
-- read it without round-tripping to the application. Set it once:
--     alter database postgres set app.admin_user_id = '<uuid>';
-- Then this trigger ensures no one else can flip is_admin to true.

create or replace function public.enforce_admin_pin()
returns trigger language plpgsql as $$
declare
  pinned uuid;
begin
  pinned := nullif(current_setting('app.admin_user_id', true), '')::uuid;
  if new.is_admin = true and (pinned is null or new.id <> pinned) then
    raise exception 'is_admin can only be true for the env-pinned ADMIN_USER_ID (% != %)', new.id, pinned;
  end if;
  return new;
end $$;

drop trigger if exists enforce_admin_pin_trg on public.profiles;
create trigger enforce_admin_pin_trg
  before insert or update of is_admin on public.profiles
  for each row execute function public.enforce_admin_pin();

-- Backstop: nuke any stray admin flags that no longer match the pin.
do $$
declare
  pinned uuid;
begin
  pinned := nullif(current_setting('app.admin_user_id', true), '')::uuid;
  update public.profiles set is_admin = false
    where is_admin = true and (pinned is null or id <> pinned);
end $$;

-- Re-point the `is_admin(uid)` SQL helper at the boolean column.
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

-- ---------- ensure banner bucket policies are complete ----------------
-- 0004 already created the bucket; this re-asserts the update policy so
-- re-uploads (replace banner) work.

do $$ begin
  perform 1 from pg_policies where schemaname = 'storage' and policyname = 'banners update own';
  if not found then
    create policy "banners update own"
      on storage.objects for update
      using (
        bucket_id = 'banners'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- ---------- realtime --------------------------------------------------

do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    -- profiles is already in the publication via 0001_init.sql; this
    -- block is just a safety net for fresh databases.
    begin
      alter publication supabase_realtime add table public.profiles;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
