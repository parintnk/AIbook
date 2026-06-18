-- Story 10.2 — semantic search match RPC (FR2 / AR4 / DR-4). Cosine KNN over the Story 10.1
-- `workflow_embeddings` HNSW index, PUBLISHED-gated, returning the page + the full matched count
-- in ONE round-trip (`count(*) over()` is computed pre-LIMIT, so every row carries the true total).
--
-- SECURITY DEFINER because it reads the CLIENT-LOCKED `workflow_embeddings` (10.1 `using(false)`).
-- EXECUTE is granted ONLY to `service_role` (revoked from public/anon/authenticated) → it stays OFF
-- the `authenticated_security_definer_function_executable` advisor (UNLIKE fork_workflow /
-- publish_workflow, which ARE client-called and DO carry that WARN by design) → advisors stay
-- 4 baseline. Called server-side via the 10.1 `createAdminClient()` (lib/services/search.ts).
--
-- `set search_path = ''` → every ref is schema-qualified; the pgvector distance operator (in `public`,
-- NOT pg_catalog) is reached via `operator(public.<=>)` (it would not resolve under the empty path).
-- The PUBLISHED re-assertion (the 6.3 lesson) means a draft's embedding can never surface, even via
-- the service role.
-- [Source: architecture.md DR-4 (66-67), workflow_embeddings (132); epics.md#Story-10.2 (847-861);
--  20260620000002_fork_workflow_fn.sql (the definer + revoke/grant idiom)]

create or replace function public.match_workflows(
  query_embedding vector(1536),
  match_limit int default 60,
  match_offset int default 0,
  p_profession_id uuid default null,
  p_tag_ids uuid[] default null,
  similarity_threshold float default 0
)
returns table (workflow_id uuid, similarity float, total_count bigint)
language sql stable security definer set search_path = '' as $$
  select
    e.workflow_id,
    1 - (e.embedding operator(public.<=>) query_embedding) as similarity,
    count(*) over() as total_count
  from public.workflow_embeddings e
  join public.workflows w on w.id = e.workflow_id
  where w.status = 'published'
    and (p_profession_id is null or w.profession_id = p_profession_id)
    and (
      p_tag_ids is null
      or exists (
        select 1 from public.workflow_tags wt
        where wt.workflow_id = e.workflow_id and wt.tag_id = any (p_tag_ids)
      )
    )
    and 1 - (e.embedding operator(public.<=>) query_embedding) >= similarity_threshold
  order by e.embedding operator(public.<=>) query_embedding, e.workflow_id
  limit match_limit offset match_offset
$$;

-- Service-role-only: the match reads the client-locked embeddings, so it must NOT be client-callable.
-- Revoke from ALL THREE (public, anon, authenticated) — leaving any one would trip the advisor; only
-- the service-role admin client (lib/supabase/admin.ts) invokes it.
revoke execute on function public.match_workflows(vector, int, int, uuid, uuid[], float)
  from public, anon, authenticated;
grant execute on function public.match_workflows(vector, int, int, uuid, uuid[], float)
  to service_role;
