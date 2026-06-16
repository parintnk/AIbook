-- Story 4.3 — Report & moderation queue (v1 simple) (FR14 / UX-DR18).
-- Any signed-in user can report a PUBLISHED workflow or a comment on one (overflow → reason
-- picker + optional detail). Reports land in a `reports` table the founder/moderator reviews +
-- resolves. v1 = the founder is `moderator` of every profession (seeded in Story 1.5) → reviews
-- a flat list; the full per-profession mod-queue UI is deferred (Epic 7).
--
-- Polymorphic target: (target_type, target_id) — NO foreign key (it points at two tables),
-- mirroring the `notifications` idiom. A BEFORE INSERT trigger replaces the missing FK: it
-- validates the target exists AND is PUBLISHED (publicly readable → no private-existence oracle,
-- one generic error) and denormalizes the target's profession_id onto the report (drives the
-- per-profession mod RLS gate + the queue index). resolved_by/resolved_at are stamped by a
-- BEFORE UPDATE trigger (never client-set). Authorization REUSES Story 1.5's
-- is_profession_moderator (the founder mods all → sees everything in v1; future-proof for real
-- per-profession mods). Mirrors the outcome_votes/comments table + RLS + SECURITY DEFINER idiom.
-- [Source: epics.md#Story-4.3; FR14/UX-DR18; architecture.md#reports §131, #RLS-posture §139;
--  20260613000001_professions.sql is_profession_moderator; 20260618000001_comments.sql idiom]

-- ── Enums (idempotent) ──────────────────────────────────────────────────────
do $$ begin
  create type public.report_target_type as enum ('workflow', 'comment');
exception when duplicate_object then null;
end $$;
do $$ begin
  -- LOCKED — verbatim from architecture.md:131 / epics.md Story 4.3 AC1. Do not rename/reorder.
  create type public.report_reason as enum
    ('fake_output', 'spam', 'copyright', 'harassment', 'not_working', 'other');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.report_status as enum ('open', 'resolved');
exception when duplicate_object then null;
end $$;

-- ── reports ─────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  -- default auth.uid() (plain call — subqueries aren't allowed in defaults; the RLS with-check
  -- pins it + the column-lock blocks spoofing). profiles(id) is the FK target author_id uses.
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Polymorphic target: NO foreign key (points at two tables). The before-insert trigger is the
  -- integrity check, and it requires the target to be PUBLISHED (publicly readable content only).
  target_type public.report_target_type not null,
  target_id uuid not null,
  -- Denormalized from the target by the trigger (client-write-locked). Drives the mod RLS gate +
  -- the queue index; future-proofs the per-profession mod queue.
  profession_id uuid not null references public.professions (id) on delete cascade,
  reason public.report_reason not null,
  detail text,
  constraint reports_detail_len check (detail is null or char_length(detail) <= 2000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- One OPEN report per (reporter, target) — the cheap dup-spam guard; re-reporting is allowed once
-- a prior report is resolved (the partial predicate excludes resolved rows).
create unique index if not exists reports_one_open_per_reporter
  on public.reports (reporter_id, target_type, target_id) where status = 'open';
-- The admin queue: open-first, per-profession, newest-first.
create index if not exists reports_queue_idx
  on public.reports (status, profession_id, created_at desc);

-- ── Integrity + profession-denormalize guard (before insert) ────────────────
-- Replaces the impossible FK on target_id: confirms the target exists AND is PUBLISHED, and
-- resolves its profession_id onto the row. security definer (reads workflows/comments past RLS)
-- + execute revoked → trigger-internal. Validates ONLY published (publicly readable) content and
-- raises ONE generic error → it can NOT be used as a cross-RLS existence oracle (the 4.2 patch-P5
-- lesson: published content's existence is already public, so nothing private leaks).
create or replace function public.enforce_report_target()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  prof uuid;
begin
  if new.target_type = 'workflow' then
    select w.profession_id into prof
      from public.workflows w
      where w.id = new.target_id and w.status = 'published';
  elsif new.target_type = 'comment' then
    select w.profession_id into prof
      from public.comments c
      join public.workflows w on w.id = c.workflow_id
      where c.id = new.target_id and w.status = 'published';
  end if;
  if prof is null then
    raise exception 'invalid report target';
  end if;
  new.profession_id := prof;
  return new;
end;
$$;
revoke execute on function public.enforce_report_target() from public, anon, authenticated;

drop trigger if exists reports_enforce_target on public.reports;
create trigger reports_enforce_target
  before insert on public.reports
  for each row execute procedure public.enforce_report_target();

-- ── Resolution stamp (before update) ────────────────────────────────────────
-- resolved_by/resolved_at are derived (the client update grant is status+resolution only). When a
-- mod flips status to 'resolved', stamp the actor + time. auth.uid() reads the JWT-claims GUC and
-- is correct inside a definer fn. execute revoked → trigger-internal.
create or replace function public.stamp_report_resolution()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_by := auth.uid();
    new.resolved_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.stamp_report_resolution() from public, anon, authenticated;

drop trigger if exists reports_stamp_resolution on public.reports;
create trigger reports_stamp_resolution
  before update on public.reports
  for each row execute procedure public.stamp_report_resolution();

-- ── RLS: reports ────────────────────────────────────────────────────────────
-- File a report: any authenticated user, as themselves. Read/resolve: a moderator of the report's
-- profession ONLY (the founder, mod of all, in v1). Reporters CANNOT read the queue (no own-select
-- policy — privacy; their feedback is the confirmation toast, not a row read-back).
alter table public.reports enable row level security;

create policy "reports_insert_own" on public.reports
  for insert with check (reporter_id = (select auth.uid()));

create policy "reports_select_moderator" on public.reports
  for select using (public.is_profession_moderator((select auth.uid()), profession_id));

create policy "reports_update_moderator" on public.reports
  for update using (public.is_profession_moderator((select auth.uid()), profession_id))
  with check (public.is_profession_moderator((select auth.uid()), profession_id));

-- Column-lock (the 2.1 harden idiom): the client may INSERT only these 4 columns (reporter_id
-- defaults auth.uid(); profession_id is trigger-set; status defaults 'open'), and may UPDATE only
-- status + resolution (resolved_by/resolved_at are trigger-stamped). Everything else is locked.
revoke insert, update on public.reports from anon, authenticated;
grant insert (target_type, target_id, reason, detail) on public.reports to authenticated;
grant update (status, resolution) on public.reports to authenticated;

-- ── comments moderation delta (Story 4.3 wires the 4.2-provisioned deleted_at) ─
-- The 4.2 `comments` table revoked ALL client UPDATE. Let a moderator of the comment's profession
-- HIDE it (set deleted_at → the "[comment removed]" tombstone render). A narrow update(deleted_at)
-- grant + a mod-gated UPDATE policy — NOT a new authenticated-granted SECURITY DEFINER RPC (which
-- would add a 4th advisor WARN like publish_workflow). like_count/body/author_id stay locked (not
-- in the grant), so the 4.2 column-lock assertions still hold.
grant update (deleted_at) on public.comments to authenticated;
create policy "comments_update_moderator" on public.comments
  for update using (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id
        and public.is_profession_moderator((select auth.uid()), w.profession_id)
    )
  ) with check (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id
        and public.is_profession_moderator((select auth.uid()), w.profession_id)
    )
  );
