-- Story 10.2 (Task 8 — absorbed Story 10.3) — Postgres FTS keyword fallback (FR2 "done-when": when
-- the embedding service errors/times out, search transparently degrades to keyword matches, never an
-- error screen). A GENERATED `tsvector` over workflows(title, summary) + a GIN index = the fallback's
-- fast path. NO trigger, NO new table → advisors stay 4 baseline. Published rows are public (RLS), so
-- `keywordSearch` runs RLS-bound (no service role, no RPC — the fallback never touches embeddings).
--
-- title weighted A, summary weighted B (a title hit ranks above a summary-only hit). The generated
-- expression is IMMUTABLE (constant 'english' regconfig) as required for a stored generated column.
-- Nodes' text in the FTS is a deferral (title+summary covers the mockup's keyword rows) — see deferred-work.
-- [Source: epics.md#Story-10.3 (863-873); architecture.md (132 — "keyword fallback via Postgres FTS
--  tsvector on workflows(title, summary)")]

alter table public.workflows
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  ) stored;

create index if not exists workflows_search_vector_idx
  on public.workflows using gin (search_vector);
