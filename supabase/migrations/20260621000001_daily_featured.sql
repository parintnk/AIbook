-- Story 6.3 — Daily Featured "Workflow of the Day" (FR5 / UX-DR16 / AR7).
-- One curated feature per profession per day. The discovery surfaces (Explore home +
-- profession community) read the most recent feature and render a prominent WOTD hero.
-- v1 = MANUAL curation: the founder (moderator of every profession, seeded in Story 1.5)
-- sets a row; the Cron / Edge Function auto-rotation is the documented later path (AR7),
-- NOT built here. Public-read (the surface is public); writes are moderator-gated, reusing
-- Story 1.5's is_profession_moderator + the Story 4.3 column-lock idiom. No FK-less polymorphism
-- here (both targets are real FKs); no trigger (the read enforces published — a featured draft
-- simply doesn't render, so no before-insert validation / SECURITY DEFINER fn is needed).
-- [Source: epics.md#Story 6.3 (AC1 WOTD hero / profession-of-the-day; AC2 daily_featured
--  UNIQUE(feature_date,profession_id)+curated_by, v1 manual + Cron later); FR5; UX-DR16;
--  architecture.md#daily_featured §127, #background-jobs §79 (AR7), #RLS-posture §139;
--  20260617000002_tags.sql (public-read), 20260619000001_reports.sql (mod-gate + column-lock),
--  20260613000001_professions.sql is_profession_moderator]

-- ── Table ─────────────────────────────────────────────────────────────────
create table if not exists public.daily_featured (
  id uuid primary key default gen_random_uuid(),
  feature_date date not null,
  profession_id uuid not null references public.professions (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  -- Who curated this feature. default auth.uid() (plain call — subqueries aren't allowed in a
  -- column default; the column-lock below keeps the client from spoofing it). A seed/service
  -- insert (no JWT) leaves it null → on delete set null. Mirrors reports.reporter_id's posture.
  curated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- One feature per profession per day (the profession-of-the-day rotation; Cron fills later).
  constraint daily_featured_one_per_profession_per_day unique (feature_date, profession_id)
);

-- The read orders by feature_date desc (most recent feature, optionally scoped to a profession).
create index if not exists daily_featured_date_idx
  on public.daily_featured (feature_date desc);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.daily_featured enable row level security;

-- Public-readable: the WOTD hero renders for anyone (anon included), like the published feed.
create policy "daily_featured_select_all" on public.daily_featured
  for select using (true);

-- Writes are moderator-gated to the row's profession (the founder mods all → can curate any in
-- v1; future-proof for real per-profession mods). REUSES Story 1.5 is_profession_moderator
-- (security invoker, reads public profession_members → no recursion / no definer). `(select
-- auth.uid())` is wrapped so the planner caches it (avoids the auth_rls_initplan advisor).
create policy "daily_featured_insert_moderator" on public.daily_featured
  for insert with check (public.is_profession_moderator((select auth.uid()), profession_id));
create policy "daily_featured_update_moderator" on public.daily_featured
  for update using (public.is_profession_moderator((select auth.uid()), profession_id))
  with check (public.is_profession_moderator((select auth.uid()), profession_id));
create policy "daily_featured_delete_moderator" on public.daily_featured
  for delete using (public.is_profession_moderator((select auth.uid()), profession_id));

-- Column-lock (the 2.1 harden idiom): the client may set only the curation columns. curated_by is
-- owned by its default (auth.uid()) + cannot be spoofed; id/created_at are defaulted. RLS gates
-- WHO (a moderator); these grants gate WHICH COLUMNS.
revoke insert, update on public.daily_featured from anon, authenticated;
grant insert (feature_date, profession_id, workflow_id) on public.daily_featured to authenticated;
grant update (feature_date, workflow_id) on public.daily_featured to authenticated;
