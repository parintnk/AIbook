-- Story 2.1 — Workflow drafts (create & manage).
-- workflows table (draft/published lifecycle) + status enum + RLS (drafts private
-- to the author, published world-readable) + updated_at trigger + indexes.
-- Drafts CRUD only; nodes/edges/outputs/publish are Stories 2.2-2.5.
-- [Source: architecture.md#Data-Model L114-121, #RLS L138-139; epics.md#Story-2.1]

-- ── Status enum (idempotent) ──────────────────────────────────────────────
do $$ begin
  create type public.workflow_status as enum ('draft', 'published');
exception when duplicate_object then null;
end $$;

-- ── Table ─────────────────────────────────────────────────────────────────
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  profession_id uuid not null references public.professions (id) on delete restrict,
  title text not null,
  summary text,
  status public.workflow_status not null default 'draft',
  -- direct fork parent; null = root. Forks (Epic 5) set this; null in 2.1.
  parent_id uuid references public.workflows (id) on delete set null,
  published_at timestamptz,
  last_verified_at timestamptz,
  -- denormalized counters (recomputed from votes / fork later); init to 0.
  fork_count int not null default 0 check (fork_count >= 0),
  tried_count int not null default 0 check (tried_count >= 0),
  worked_score numeric not null default 0 check (worked_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
-- drives the author-scoped "my drafts" workspace list (AC2)
create index if not exists workflows_author_status_idx
  on public.workflows (author_id, status);
-- profession feed / browse (Epic 6)
create index if not exists workflows_profession_status_pub_idx
  on public.workflows (profession_id, status, published_at desc);
-- lineage edge (Epic 5)
create index if not exists workflows_parent_idx
  on public.workflows (parent_id);

-- ── updated_at maintenance ────────────────────────────────────────────────
-- Reuse public.set_updated_at() defined in the profiles migration.
drop trigger if exists workflows_set_updated_at on public.workflows;
create trigger workflows_set_updated_at
  before update on public.workflows
  for each row execute procedure public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────
-- Published workflows are world-readable (incl. anon for public browse); drafts
-- are private to their author. Writes are owner-only. (select auth.uid()) is
-- wrapped so the planner caches it per statement (Supabase RLS perf guidance).
-- The draft->published transition (+ its real-output gate trigger) is Story 2.5;
-- 2.1 only ever writes status='draft' (enforced by the insert policy below).
alter table public.workflows enable row level security;

create policy "workflows_select_visible" on public.workflows
  for select using (
    status = 'published' or author_id = (select auth.uid())
  );

create policy "workflows_insert_own_draft" on public.workflows
  for insert with check (
    author_id = (select auth.uid()) and status = 'draft'
  );

create policy "workflows_update_own" on public.workflows
  for update using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "workflows_delete_own" on public.workflows
  for delete using (author_id = (select auth.uid()));
