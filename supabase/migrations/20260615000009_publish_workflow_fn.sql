-- Story 2.5 — Publish gate (real-output rule, FR9/FR10). The draft -> published
-- transition.
--
-- ⚠️ SECURITY DEFINER (NOT invoker like the 2.3 ordering fns). Publishing writes
-- workflows(status, published_at), which are DELIBERATELY revoked from `authenticated`
-- (the Story 2.1 self-publish column lock — 20260614000002_workflows_harden.sql). An
-- invoker fn would run as the caller and need those columns granted to authenticated,
-- which a direct PostgREST `UPDATE workflows SET status='published'` could then use to
-- bypass the output gate (re-opening the 2.1 HIGH). As DEFINER it runs as the table
-- owner, so the column lock stays fully closed for direct writes and this RPC is the
-- ONLY path to published — gated on owner + draft + every-node-has-an-output first.
-- This trips the `authenticated_security_definer_function_executable` advisor WARN
-- (the one 2.3 avoided via invoker) — that is the intended, documented exception here.
--
-- Returns jsonb {ok, reason?, missing?:[{id,idx}]} so the app can NAME the nodes that
-- still lack an output (a variable-length list — not encodable in a RAISE message).
-- RAISE 42501 is reserved for the auth/not-found failure (service maps it to
-- not_found, the codebase convention). A zero-node draft is NOT publishable (FR9).
-- [Source: epics.md#Story-2.5 L431-449; 2.1 harden; 2.3 fn idiom (20260615000005)]

create or replace function public.publish_workflow(p_workflow_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_missing jsonb;
  v_node_count int;
  v_published int;
begin
  -- Re-assert owner + draft as the calling user (definer bypasses RLS, so check
  -- auth.uid() ourselves). Clean 42501 -> the service maps it to not_found.
  if not exists (
    select 1 from public.workflows w
    where w.id = p_workflow_id
      and w.author_id = v_uid
      and w.status = 'draft'
  ) then
    raise exception 'not_owner_or_not_draft' using errcode = '42501';
  end if;

  -- Lock the parent so a concurrent node/output delete can't race the gate.
  perform 1 from public.workflows where id = p_workflow_id for update;

  -- FR9 + FR10 enforced ATOMICALLY: publish only if the draft has >=1 node AND no
  -- node lacks an output. The gate predicate and the write share ONE statement (one
  -- snapshot), so a concurrent output-delete / node-insert cannot slip an uncovered
  -- node past the gate. (The parent FOR UPDATE above cannot prevent that on its own —
  -- child-table DML takes no conflicting lock on the workflows row.) Definer can
  -- write the 2.1-locked status/published_at columns.
  update public.workflows w
    set status = 'published',
        published_at = now()
  where w.id = p_workflow_id
    and exists (
      select 1 from public.workflow_nodes where workflow_id = p_workflow_id)
    and not exists (
      select 1 from public.workflow_nodes n
      where n.workflow_id = p_workflow_id
        and not exists (
          select 1 from public.node_outputs o where o.node_id = n.id));
  get diagnostics v_published = row_count;

  if v_published = 1 then
    return jsonb_build_object('ok', true, 'reason', null, 'missing', '[]'::jsonb);
  end if;

  -- Not published -> re-derive WHY under the same row lock for the caller's message:
  -- zero nodes (FR9) vs. the ordered list of uncovered nodes (FR10).
  select count(*) into v_node_count
    from public.workflow_nodes where workflow_id = p_workflow_id;
  if v_node_count = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_nodes', 'missing', '[]'::jsonb);
  end if;

  select coalesce(
           jsonb_agg(jsonb_build_object('id', n.id, 'idx', n.idx) order by n.idx),
           '[]'::jsonb)
    into v_missing
  from public.workflow_nodes n
  where n.workflow_id = p_workflow_id
    and not exists (select 1 from public.node_outputs o where o.node_id = n.id);

  return jsonb_build_object('ok', false, 'reason', 'missing_outputs', 'missing', v_missing);
end;
$$;

revoke execute on function public.publish_workflow(uuid) from public, anon;
grant execute on function public.publish_workflow(uuid) to authenticated;

-- Defense-in-depth: a published row must carry a timestamp (the RPC sets both
-- atomically; this guarantees no future path flips status without one). Safe now —
-- all existing rows are 'draft'.
alter table public.workflows
  drop constraint if exists workflows_published_has_ts;
alter table public.workflows
  add constraint workflows_published_has_ts
  check (status <> 'published' or published_at is not null);
