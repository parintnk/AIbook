-- Story 4.1 — Outcome votes (FR11 / UX-DR8: Verified-by-Outcome voting).
-- A viewer's single (changeable) outcome vote per PUBLISHED workflow. The three
-- "tried" verdicts (worked/tweaked/failed) feed the workflow's denormalized trust
-- counters; 'untried' (👀) is excluded. Those counters (tried_count/worked_score +
-- the new worked/tweaked/failed_count) are CLIENT-WRITE-LOCKED (the 2.1 harden grants
-- only title/summary/profession_id), so a SECURITY DEFINER trigger is the ONLY writer —
-- recomputed from the votes on any change (mirrors the Story 1.5 professions.member_count
-- idiom). Story 3.3's trust row already READS tried_count/worked_score, so this makes
-- those numbers live. Individual votes are PRIVATE (RLS own-only); the public signal is
-- the aggregate on workflows.
-- [Source: epics.md#Story-4.1; FR11; 20260614000001_workflows.sql counters + 2.1 harden;
--  20260613000001_professions.sql sync_member_count; 20260615000006_node_outputs.sql RLS idiom]

-- ── Verdict enum (idempotent) ───────────────────────────────────────────────
do $$ begin
  create type public.outcome_verdict as enum ('worked', 'tweaked', 'failed', 'untried');
exception when duplicate_object then null;
end $$;

-- ── Per-verdict tallies on workflows ────────────────────────────────────────
-- The segmented control reads these via the existing PUBLISHED_SELECT *. NOT granted
-- to authenticated → auto-locked exactly like the existing tried_count/worked_score
-- (the 2.1 harden's `grant update (title, summary, profession_id)` excludes them).
alter table public.workflows
  add column if not exists worked_count  int not null default 0 check (worked_count  >= 0),
  add column if not exists tweaked_count int not null default 0 check (tweaked_count >= 0),
  add column if not exists failed_count  int not null default 0 check (failed_count  >= 0);

-- ── Table ───────────────────────────────────────────────────────────────────
create table if not exists public.outcome_votes (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  -- default auth.uid() (a plain function call — subqueries are not allowed in defaults;
  -- the RLS with-check pins it against spoofing). profiles(id) is what author_id uses.
  voter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  verdict public.outcome_verdict not null,
  note text,                 -- optional, mainly for 🔧 (UI input deferred); capped below
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one changeable vote per (workflow, voter) — the FR11 upsert key.
  constraint outcome_votes_one_per_user unique (workflow_id, voter_id),
  constraint outcome_votes_note_len check (note is null or char_length(note) <= 280)
);

-- (workflow_id, voter_id) is indexed by the unique constraint; add voter_id for "my votes".
create index if not exists outcome_votes_voter_idx on public.outcome_votes (voter_id);

-- reuse public.set_updated_at() (profiles migration).
create trigger outcome_votes_set_updated_at
  before update on public.outcome_votes
  for each row execute procedure public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────
-- A voter manages ONLY their own vote (votes are private). Voting requires a PUBLISHED
-- workflow. (select auth.uid()) wrapped for the per-statement planner cache.
alter table public.outcome_votes enable row level security;

create policy "outcome_votes_select_own" on public.outcome_votes
  for select using (voter_id = (select auth.uid()));

create policy "outcome_votes_insert_own" on public.outcome_votes
  for insert with check (
    voter_id = (select auth.uid())
    and exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.status = 'published'
    )
  );

-- update: change your own vote. The with-check also re-enforces the published gate
-- (mirrors insert) so a vote can't be MOVED onto a non-published workflow via UPDATE.
create policy "outcome_votes_update_own" on public.outcome_votes
  for update using (voter_id = (select auth.uid()))
  with check (
    voter_id = (select auth.uid())
    and exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.status = 'published'
    )
  );

create policy "outcome_votes_delete_own" on public.outcome_votes
  for delete using (voter_id = (select auth.uid()));

-- ── Recompute trigger (SECURITY DEFINER — the ONLY writer of the locked counters) ──
-- FULL recompute (not ±1): a verdict change MOVES a vote between buckets, so a full
-- recompute from the table is uniform across insert/update/delete and self-heals.
-- tried_count = worked+tweaked+failed (👀 excluded); worked_score = worked + 0.5*tweaked
-- (v1 weighting — [NOTE FOR PM]: tune post-launch; the tried>passive ordering is fixed).
-- Definer (not invoker) because authenticated cannot write the locked counters — same
-- justification as publish_workflow; but these stay trigger-internal (execute revoked
-- from everyone) so they do NOT trip the authenticated-definer-executable advisor.
create or replace function public.recompute_workflow_outcomes(p_workflow_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize recompute per workflow: lock the workflow row FIRST so a concurrent
  -- vote's recompute blocks here, then re-reads the votes on a fresh snapshot AFTER
  -- this one commits — no lost-update on the denormalized counter under READ COMMITTED
  -- (the member_count precedent is safe via count+1-on-locked-row; a full recompute isn't).
  perform 1 from public.workflows where id = p_workflow_id for update;
  update public.workflows w set
    worked_count  = c.worked,
    tweaked_count = c.tweaked,
    failed_count  = c.failed,
    tried_count   = c.worked + c.tweaked + c.failed,
    worked_score  = c.worked + 0.5 * c.tweaked
  from (
    select
      (count(*) filter (where verdict = 'worked'))::int  as worked,
      (count(*) filter (where verdict = 'tweaked'))::int as tweaked,
      (count(*) filter (where verdict = 'failed'))::int  as failed
    from public.outcome_votes
    where workflow_id = p_workflow_id
  ) c
  where w.id = p_workflow_id;
end;
$$;

create or replace function public.outcome_votes_recompute_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_workflow_outcomes(old.workflow_id);
    return old;
  end if;
  perform public.recompute_workflow_outcomes(new.workflow_id);
  -- defensive: an UPDATE that ever moved the vote to another workflow recomputes both.
  if tg_op = 'UPDATE' and new.workflow_id <> old.workflow_id then
    perform public.recompute_workflow_outcomes(old.workflow_id);
  end if;
  return new;
end;
$$;

revoke execute on function public.recompute_workflow_outcomes(uuid) from public, anon, authenticated;
revoke execute on function public.outcome_votes_recompute_tg() from public, anon, authenticated;

drop trigger if exists outcome_votes_recompute on public.outcome_votes;
create trigger outcome_votes_recompute
  after insert or update or delete on public.outcome_votes
  for each row execute procedure public.outcome_votes_recompute_tg();
