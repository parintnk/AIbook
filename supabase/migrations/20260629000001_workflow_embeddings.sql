-- Story 10.1 — embeddings pipeline (FR2 / AR4 / AR6). The vector store for semantic search (Story 10.2):
-- one row per published workflow, WRITTEN by the embed job (service role → bypasses RLS) and READ by
-- 10.2's SECURITY DEFINER match RPC. pgvector 0.8 is already enabled in `public` (the baseline advisor
-- WARN — left as-is). `content_hash` drives the skip-reembed cost control (NFR2).
-- [Source: architecture.md:132 (shape + HNSW cosine); epics.md#Story-10.1 (839-845); 20260627000001_notifications.sql (RLS idioms)]

create table if not exists public.workflow_embeddings (
  workflow_id uuid primary key references public.workflows (id) on delete cascade,
  -- 1536 dims = OpenAI text-embedding-3-small (default). Any provider is asked for 1536 dims
  -- (the AI Gateway model is env-swappable) so this column never changes on a provider swap.
  embedding vector(1536) not null,
  content_hash text not null,
  updated_at timestamptz not null default now()
);

-- HNSW cosine index (pgvector 0.8) — the semantic-search nearest-neighbour access path (Story 10.2).
create index if not exists workflow_embeddings_embedding_idx
  on public.workflow_embeddings using hnsw (embedding vector_cosine_ops);

-- RLS: the embed job writes via the SERVICE ROLE (bypasses RLS); Story 10.2 reads via a SECURITY DEFINER
-- match RPC. No client read or write — RLS enabled + writes revoked + NO policy = fully locked to
-- anon/authenticated (zero rows on select; insert/update/delete denied) and advisor-clean (no rls_disabled).
alter table public.workflow_embeddings enable row level security;
revoke insert, update, delete on public.workflow_embeddings from anon, authenticated;
-- Explicit "no client read": reads go through the service role + Story 10.2's SECURITY DEFINER match
-- RPC (which bypasses RLS), never a direct client query. An always-false policy documents that intent
-- AND keeps the advisor surface at the 4-WARN baseline (silences the benign rls_enabled_no_policy INFO;
-- the alternative — RLS disabled — would trip the worse rls_disabled_in_public WARN).
-- drop-then-create keeps the migration re-apply-safe (Postgres has no `create policy if not exists`),
-- matching the rest of this file's idempotent guards.
drop policy if exists "workflow_embeddings_no_client_read" on public.workflow_embeddings;
create policy "workflow_embeddings_no_client_read" on public.workflow_embeddings
  for select using (false);
