-- Story 2.4 hardening (mirrors workflow_nodes_harden) — column-level write locks on
-- node_outputs. RLS gates which ROWS an owner can touch; these grants gate which
-- COLUMNS. Without them an authenticated user hitting PostgREST directly (their own
-- JWT + the public anon key) could write id / created_at, which are default-owned.
--
-- ⚠️ node_id IS grantable on INSERT (an output must declare its parent node), so the
-- RLS insert `with check` (parent node's workflow must be an owned draft) is the ONLY
-- thing stopping an output from being attached to someone else's node. Keep BOTH the
-- grant and the policy. It is deliberately NOT grantable on UPDATE — an output can
-- never be re-pointed to a different node. DELETE is table-level, gated by the RLS
-- delete policy.

revoke insert, update on public.node_outputs from anon, authenticated;
grant insert (node_id, kind, storage_path, text_content, mime, bytes)
  on public.node_outputs to authenticated;
grant update (kind, storage_path, text_content, mime, bytes)
  on public.node_outputs to authenticated;
