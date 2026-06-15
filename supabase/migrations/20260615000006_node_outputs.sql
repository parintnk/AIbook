-- Story 2.4 — Per-node sample outputs (node_outputs).
-- One real creator output per node (FR10 real-output rule): an image/video/file in
-- Supabase Storage, or inline text. Outputs have no author_id; ownership derives
-- TWO hops (output -> node -> workflow -> author), so RLS uses a nested exists-
-- subquery on public.workflow_nodes + public.workflows, mirroring workflow_nodes.
-- unique(node_id): exactly one current output per node (replace-on-reupload). The
-- publish GATE (>=1 output before draft->published) is Story 2.5, not here.
-- [Source: architecture.md#Data-Model L118,L136; epics.md#Story-2.4 L419-425]

-- ── Kind enum (idempotent) ──────────────────────────────────────────────────
do $$ begin
  create type public.node_output_kind as enum ('image', 'video', 'text', 'file');
exception when duplicate_object then null;
end $$;

-- ── Table ─────────────────────────────────────────────────────────────────
create table if not exists public.node_outputs (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.workflow_nodes (id) on delete cascade,
  kind public.node_output_kind not null,
  storage_path text,         -- object path in the node-outputs bucket (binary kinds)
  text_content text,         -- inline content (text kind only)
  mime text,                 -- the VALIDATED (sniffed + re-encoded) mime (binary kinds)
  bytes bigint,              -- stored object size (binary kinds)
  created_at timestamptz not null default now(),
  -- one current output per node (replace-on-reupload).
  constraint node_outputs_one_per_node unique (node_id),
  -- payload shape must match the kind.
  constraint node_outputs_kind_payload check (
    case
      when kind = 'text' then
        text_content is not null and storage_path is null
      else -- image | video | file
        storage_path is not null and text_content is null
        and mime is not null and bytes is not null
    end
  ),
  constraint node_outputs_bytes_nonneg check (bytes is null or bytes >= 0)
);

-- (node_id) index is provided by the unique constraint above.

-- ── Row Level Security ────────────────────────────────────────────────────
-- Two-hop ownership: an output is readable if its node's workflow is published OR
-- the caller owns that workflow; writable only if the caller owns the parent DRAFT.
-- (select auth.uid()) wrapped for the per-statement planner cache (Supabase guidance).
alter table public.node_outputs enable row level security;

create policy "node_outputs_select_visible" on public.node_outputs
  for select using (
    exists (
      select 1
      from public.workflow_nodes n
      join public.workflows w on w.id = n.workflow_id
      where n.id = node_id
        and (w.status = 'published' or w.author_id = (select auth.uid()))
    )
  );

create policy "node_outputs_insert_own" on public.node_outputs
  for insert with check (
    exists (
      select 1
      from public.workflow_nodes n
      join public.workflows w on w.id = n.workflow_id
      where n.id = node_id
        and w.author_id = (select auth.uid())
        and w.status = 'draft'
    )
  );

create policy "node_outputs_update_own" on public.node_outputs
  for update using (
    exists (
      select 1 from public.workflow_nodes n
      join public.workflows w on w.id = n.workflow_id
      where n.id = node_id and w.author_id = (select auth.uid()) and w.status = 'draft'
    )
  ) with check (
    exists (
      select 1 from public.workflow_nodes n
      join public.workflows w on w.id = n.workflow_id
      where n.id = node_id and w.author_id = (select auth.uid()) and w.status = 'draft'
    )
  );

create policy "node_outputs_delete_own" on public.node_outputs
  for delete using (
    exists (
      select 1 from public.workflow_nodes n
      join public.workflows w on w.id = n.workflow_id
      where n.id = node_id and w.author_id = (select auth.uid()) and w.status = 'draft'
    )
  );
