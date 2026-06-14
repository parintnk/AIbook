-- Story 2.3 hardening (mirrors workflow_nodes_harden) — column-level write locks.
-- RLS gates which ROWS; these grants gate which COLUMNS. Edges are immutable, so
-- authenticated gets INSERT only (NO update grant at all) and may set only the
-- three FK columns; id/created_at stay default-owned.
--
-- ⚠️ workflow_id + source_node_id + target_node_id are ALL grantable on INSERT
-- (an edge must declare its parent + endpoints), so the RLS insert `with check`
-- (parent owned by caller) is the ONLY thing stopping an edge being attached to
-- someone else's workflow. Keep BOTH the grant and the policy. The endpoints'
-- own parent is NOT checked by the FK — the service verifies both nodes belong to
-- the workflow (the only cross-workflow guard until a trigger is added).

revoke insert, update on public.workflow_edges from anon, authenticated;
grant insert (workflow_id, source_node_id, target_node_id)
  on public.workflow_edges to authenticated;
-- No `grant update` — edges are never edited (create/delete only). DELETE is a
-- table-level privilege gated by the RLS delete policy; no column grant needed.
