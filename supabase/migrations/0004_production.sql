-- =====================================================================
-- Phase 11+ — Production readiness: banners, market proposals,
--             admin market creation, hero images.
-- Paste after 0003_personalization.sql. Idempotent.
-- =====================================================================

-- ---------- profiles: banner column ---------------------------------
-- The Phase 8 modal already supported a cover gradient preset; the new
-- banner_url is the uploaded image (3:1) that takes priority when set.
-- Falls back to the cover_gradient when null.

alter table public.profiles add column if not exists banner_url text;

-- ---------- markets: hero image + creation source -------------------

alter table public.markets add column if not exists hero_image_url text;
alter table public.markets add column if not exists creation_source text not null default 'admin'
  check (creation_source in ('admin', 'proposal_approved', 'seed'));

-- ---------- market_proposals (section 27) ----------------------------
-- Normal users submit; admin reviews. Approved → spawns a `markets` row
-- with `creation_source = 'proposal_approved'` and notifies the proposer.

create table if not exists public.market_proposals (
  id                uuid primary key default gen_random_uuid(),
  proposer_id       uuid not null references public.profiles(id) on delete cascade,
  question          text not null check (length(question) between 8 and 280),
  description       text not null default '',
  category_id       uuid not null references public.categories(id),
  resolution_date   timestamptz not null,
  resolution_source text not null,
  initial_yes_price integer not null check (initial_yes_price between 1 and 99),
  hero_image_url    text,
  status            text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reject_reason     text,
  reviewed_by       uuid references public.profiles(id),
  reviewed_at       timestamptz,
  approved_market_id uuid references public.markets(id),
  created_at        timestamptz not null default now()
);

create index if not exists market_proposals_status_idx
  on public.market_proposals (status, created_at desc);
create index if not exists market_proposals_proposer_idx
  on public.market_proposals (proposer_id, created_at desc);

alter table public.market_proposals enable row level security;

-- Proposers can read their own proposals; admins read all.
drop policy if exists "proposals read own or admin" on public.market_proposals;
create policy "proposals read own or admin"
  on public.market_proposals for select
  using (
    proposer_id = auth.uid()
    or public.is_admin(auth.uid())
  );

-- Proposers can insert their own pending proposal.
drop policy if exists "proposals insert own pending" on public.market_proposals;
create policy "proposals insert own pending"
  on public.market_proposals for insert
  with check (
    auth.uid() = proposer_id
    and status = 'pending'
  );

-- Proposers can withdraw their own pending proposals; admins can do anything.
drop policy if exists "proposals update own pending or admin" on public.market_proposals;
create policy "proposals update own pending or admin"
  on public.market_proposals for update
  using (
    (auth.uid() = proposer_id and status = 'pending')
    or public.is_admin(auth.uid())
  );

-- ---------- markets: lock direct user inserts -----------------------
-- Existing 0001 had no client insert/update policies for markets. Now
-- we explicitly add an admin-only insert policy as the only way for a
-- user-context client to create a market. The server still uses the
-- service-role client (which bypasses RLS) for proposal approval.

drop policy if exists "markets insert admin only" on public.markets;
create policy "markets insert admin only"
  on public.markets for insert
  with check (public.is_admin(auth.uid()));

-- ---------- banners storage bucket ----------------------------------
-- Public bucket; RLS scopes uploads to the uploader's folder, mirroring
-- the avatars + post-images buckets from 0001_init.sql.

insert into storage.buckets (id, name, public)
  values ('banners', 'banners', true)
  on conflict (id) do nothing;

drop policy if exists "banners read public" on storage.objects;
create policy "banners read public"
  on storage.objects for select
  using (bucket_id = 'banners');

drop policy if exists "banners write own" on storage.objects;
create policy "banners write own"
  on storage.objects for insert
  with check (
    bucket_id = 'banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "banners delete own" on storage.objects;
create policy "banners delete own"
  on storage.objects for delete
  using (
    bucket_id = 'banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- realtime publication ------------------------------------
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    alter publication supabase_realtime add table public.market_proposals;
  end if;
exception when duplicate_object then null;
end $$;
