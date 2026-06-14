-- Story 2.2 — Recipe-card nodes (workflow_nodes).
-- One row per workflow step: tool + prompt + metadata (FR6). Nodes belong to a
-- parent workflow (cascade-delete with it); ownership is derived from the parent
-- (there is no author_id column) so RLS uses an exists-subquery on public.workflows.
-- 2.2 ships node metadata CRUD on a linear step-list; the React Flow canvas
-- (meaningful pos_x/pos_y writes, edges, reordering) is Story 2.3, sample outputs
-- (node_outputs) are Story 2.4, and the publish gate is Story 2.5.
-- [Source: architecture.md#Data-Model L116,L136; epics.md#Story-2.2; prd.md FR6/FR24]

-- ── Table ─────────────────────────────────────────────────────────────────
create table if not exists public.workflow_nodes (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  idx int not null,                       -- step order; service assigns max+1 on add
  -- canvas coordinates owned by the Story 2.3 React Flow editor; 2.2 writes the
  -- defaults only (the linear step-list ignores them).
  pos_x double precision not null default 0,
  pos_y double precision not null default 0,
  step_title text,
  tool_name text not null,                -- the mono tool chip (required)
  tool_version text,
  prompt text not null,                   -- mono; the EN side of FR24 (required)
  purpose text not null,                  -- why this step exists (required)
  est_time text,                          -- free-text ("~5 min") — NOT numeric
  est_cost text,                          -- free-text ("$0.02") — NOT numeric
  notes text,                             -- also the native-language note (FR24)
  note_lang text,                         -- optional BCP-47 tag for notes (FR24)
  tool_url text,                          -- validated https? in the app layer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Index ─────────────────────────────────────────────────────────────────
-- drives listDraftNodes (ordered by idx within a workflow). Deliberately NOT
-- unique(workflow_id, idx): the 2.3 canvas reorders nodes and a unique constraint
-- fights swaps — the service owns ordering.
create index if not exists workflow_nodes_workflow_idx
  on public.workflow_nodes (workflow_id, idx);

-- ── updated_at maintenance ────────────────────────────────────────────────
-- Reuse public.set_updated_at() defined in the profiles migration.
drop trigger if exists workflow_nodes_set_updated_at on public.workflow_nodes;
create trigger workflow_nodes_set_updated_at
  before update on public.workflow_nodes
  for each row execute procedure public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────
-- Nodes have no author_id — visibility/ownership is derived from the parent
-- workflow. A node is readable if its workflow is published OR the caller owns it;
-- writable only if the caller owns the parent. (select auth.uid()) is wrapped so
-- the planner caches it per statement (Supabase RLS perf guidance).
alter table public.workflow_nodes enable row level security;

create policy "workflow_nodes_select_visible" on public.workflow_nodes
  for select using (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id
        and (w.status = 'published' or w.author_id = (select auth.uid()))
    )
  );

create policy "workflow_nodes_insert_own" on public.workflow_nodes
  for insert with check (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.author_id = (select auth.uid())
    )
  );

create policy "workflow_nodes_update_own" on public.workflow_nodes
  for update using (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.author_id = (select auth.uid())
    )
  );

create policy "workflow_nodes_delete_own" on public.workflow_nodes
  for delete using (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.author_id = (select auth.uid())
    )
  );
