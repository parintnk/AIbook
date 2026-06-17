-- Story 7.2 — Pinned canon ("Start here") for a profession community (FR17).
-- A moderator curates an ordered set of "essential" workflows for their profession; the community
-- home renders them as the "Start here" rail card (Story 7.2 replaces the 6.2 interim most-forked
-- proxy). v1 = MANUAL curation: the founder (moderator of every profession, seeded in Story 1.5)
-- pins rows; the in-app pin/unpin mod UI is Story 7.3 (role-gated, hidden from members per UX-DR21),
-- NOT built here. Public-read (the rail is public); writes are moderator-gated, reusing Story 1.5's
-- is_profession_moderator + the Story 4.3/6.3 column-lock idiom. No new SECURITY DEFINER fn (reuses
-- the helper) → no new advisor WARN; the read enforces published, so a pinned draft/deleted/
-- unpublished workflow simply doesn't render.
-- [Source: epics.md#Story 7.2 (house rules + pinned canon + join); FR17; architecture.md#RLS-posture
--  §139 ("pin canon" = mod action); 20260621000001_daily_featured.sql (clone template),
--  20260613000001_professions.sql is_profession_moderator]

-- ── Table ─────────────────────────────────────────────────────────────────
create table if not exists public.profession_pins (
  id uuid primary key default gen_random_uuid(),
  profession_id uuid not null references public.professions (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  -- Ordered "Start here" list (ascending). Mods set the order; ties break by id.
  position int not null default 0,
  -- Who pinned this. default auth.uid() (PLAIN call — subqueries aren't allowed in a column
  -- default; the column-lock below keeps the client from spoofing it). A seed insert (no JWT)
  -- leaves it null → on delete set null. Mirrors daily_featured.curated_by.
  pinned_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- One pin per workflow per profession (no duplicate canon entry).
  constraint profession_pins_unique unique (profession_id, workflow_id)
);

-- The rail reads pins for one profession ordered by position.
create index if not exists profession_pins_profession_position_idx
  on public.profession_pins (profession_id, position);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.profession_pins enable row level security;

-- Public-readable: the "Start here" rail renders for anyone (anon included), like the published feed.
create policy "profession_pins_select_all" on public.profession_pins
  for select using (true);

-- Writes are moderator-gated to the row's profession (the founder mods all → can curate any in v1;
-- future-proof for real per-profession mods). REUSES Story 1.5 is_profession_moderator (security
-- invoker, reads public profession_members → no recursion / no definer). `(select auth.uid())` is
-- wrapped so the planner caches it (avoids the auth_rls_initplan advisor).
create policy "profession_pins_insert_moderator" on public.profession_pins
  for insert with check (public.is_profession_moderator((select auth.uid()), profession_id));
create policy "profession_pins_update_moderator" on public.profession_pins
  for update using (public.is_profession_moderator((select auth.uid()), profession_id))
  with check (public.is_profession_moderator((select auth.uid()), profession_id));
create policy "profession_pins_delete_moderator" on public.profession_pins
  for delete using (public.is_profession_moderator((select auth.uid()), profession_id));

-- Column-lock (the 2.1 harden idiom): the client may set only the curation columns. pinned_by is
-- owned by its default (auth.uid()) + cannot be spoofed; id/created_at are defaulted. RLS gates
-- WHO (a moderator); these grants gate WHICH COLUMNS.
revoke insert, update on public.profession_pins from anon, authenticated;
grant insert (profession_id, workflow_id, position) on public.profession_pins to authenticated;
grant update (position, workflow_id) on public.profession_pins to authenticated;
