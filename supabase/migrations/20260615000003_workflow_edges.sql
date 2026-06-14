-- Story 2.3 — React Flow edges (workflow_edges).
-- One row per connection between two nodes of the SAME workflow (FR6/FR7 graph).
-- Supports branching: a node may have many out-edges and many in-edges. Edges have
-- no author_id; ownership is derived from the parent workflow (cascade-delete with
-- it) so RLS uses an exists-subquery on public.workflows, mirroring workflow_nodes.
-- Edges are immutable (create/delete only — never edited), so there is no
-- updated_at, no UPDATE policy, and no update grant (see _harden).
-- [Source: architecture.md#Data-Model L117; epics.md#Story-2.3 L399-405]

-- ── Table ─────────────────────────────────────────────────────────────────
create table if not exists public.workflow_edges (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  source_node_id uuid not null references public.workflow_nodes (id) on delete cascade,
  target_node_id uuid not null references public.workflow_nodes (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- A node can't connect to itself.
  constraint workflow_edges_no_self check (source_node_id <> target_node_id),
  -- One edge per (source -> target) direction; React Flow dedupes visually but a
  -- direct PostgREST write could double-insert. Directed: (a->b) and (b->a) coexist.
  constraint workflow_edges_unique unique (workflow_id, source_node_id, target_node_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────
-- listEdges scopes by workflow; per-node lookups help canvas rebuilds. The unique
-- constraint already covers (workflow_id, source, target).
create index if not exists workflow_edges_workflow_idx
  on public.workflow_edges (workflow_id);
create index if not exists workflow_edges_source_idx
  on public.workflow_edges (source_node_id);
create index if not exists workflow_edges_target_idx
  on public.workflow_edges (target_node_id);

-- ── Row Level Security ────────────────────────────────────────────────────
-- Same posture as workflow_nodes: readable if the parent workflow is published OR
-- the caller owns it; writable only by the parent's author. (select auth.uid()) is
-- wrapped so the planner caches it per statement (Supabase RLS perf guidance).
-- No UPDATE policy — edges are immutable.
alter table public.workflow_edges enable row level security;

create policy "workflow_edges_select_visible" on public.workflow_edges
  for select using (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id
        and (w.status = 'published' or w.author_id = (select auth.uid()))
    )
  );

create policy "workflow_edges_insert_own" on public.workflow_edges
  for insert with check (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.author_id = (select auth.uid())
    )
  );

create policy "workflow_edges_delete_own" on public.workflow_edges
  for delete using (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.author_id = (select auth.uid())
    )
  );
