-- Story 2.2 hardening (mirrors workflows_harden) — column-level write locks on
-- workflow_nodes. RLS gates which ROWS an owner can touch; these grants gate which
-- COLUMNS. Without them an authenticated user hitting PostgREST directly (their own
-- JWT + the public anon key) could write id / created_at / updated_at — which are
-- trigger- or service-owned. authenticated may only write the node field columns.
--
-- ⚠️ workflow_id IS grantable on INSERT (a node must declare its parent), so the
-- RLS insert `with check` (parent must be owned by the caller) is the ONLY thing
-- stopping a node from being attached to someone else's draft. Keep BOTH the grant
-- and the policy. It is deliberately NOT grantable on UPDATE — a node can never be
-- reparented to a different workflow.

revoke insert, update on public.workflow_nodes from anon, authenticated;
grant insert (workflow_id, idx, pos_x, pos_y, step_title, tool_name, tool_version,
              prompt, purpose, est_time, est_cost, notes, note_lang, tool_url)
  on public.workflow_nodes to authenticated;
grant update (idx, pos_x, pos_y, step_title, tool_name, tool_version,
              prompt, purpose, est_time, est_cost, notes, note_lang, tool_url)
  on public.workflow_nodes to authenticated;
