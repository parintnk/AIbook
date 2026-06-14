-- Story 2.3 — atomic node ordering (resolves the 2.2 deferred createNode idx race).
-- The read-then-write ops (append, reorder) serialize on a `for update` row-lock of
-- the parent workflow so concurrent canvas edits can't interleave; update_positions
-- is a single blind UPDATE (atomic on its own, no lock needed). They are SECURITY
-- INVOKER (the default): the owner already has RLS + the column grants to insert
-- nodes / write idx / write pos, and column-level UPDATE on workflows satisfies the
-- `for update` row-lock — so no privilege escalation is needed (and the advisor's
-- "definer executable" warning is avoided). Atomicity comes from the transaction +
-- the row-lock, NOT from the security context. An explicit owner+draft check
-- still runs first so a non-owner gets a clean 42501 instead of a silent no-op.
-- set search_path='' is the codebase convention; every object is schema-qualified.
-- `idx` stays free of a unique constraint (2.2 omitted it so swaps don't fight a
-- constraint); the row-lock gives correctness instead.
-- [Source: 2-2 review (deferred idx race); architecture.md DR-1; advisor 0029]

-- (a) Append a node atomically: max(idx)+1 (0 for the first) + insert. Replaces
-- the service's read-then-write. Returns the new node id.
create or replace function public.append_workflow_node(
  p_workflow_id uuid,
  p_step_title text,
  p_tool_name text,
  p_tool_version text,
  p_prompt text,
  p_purpose text,
  p_est_time text,
  p_est_cost text,
  p_notes text,
  p_note_lang text,
  p_tool_url text,
  p_pos_x double precision default 0,
  p_pos_y double precision default 0
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_next int;
  v_id uuid;
begin
  -- Owner + draft check up front for a clean 42501 (RLS also enforces it). Draft-only (2.2 rule).
  if not exists (
    select 1 from public.workflows w
    where w.id = p_workflow_id and w.author_id = v_uid and w.status = 'draft'
  ) then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  -- Serialize concurrent appends on the parent row → no idx collision.
  perform 1 from public.workflows where id = p_workflow_id for update;

  select coalesce(max(idx), -1) + 1 into v_next
    from public.workflow_nodes where workflow_id = p_workflow_id;

  insert into public.workflow_nodes (
    workflow_id, idx, pos_x, pos_y, step_title, tool_name, tool_version,
    prompt, purpose, est_time, est_cost, notes, note_lang, tool_url
  ) values (
    p_workflow_id, v_next, p_pos_x, p_pos_y, p_step_title, p_tool_name,
    p_tool_version, p_prompt, p_purpose, p_est_time, p_est_cost, p_notes,
    p_note_lang, p_tool_url
  ) returning id into v_id;

  return v_id;
end;
$$;

-- (b) Reorder: set the full idx sequence in one transaction. The canvas computes
-- the new order client-side and sends the ordered node-id array. Two-phase
-- (park out of range, then 0..n-1) so ordering is never transiently ambiguous.
create or replace function public.reorder_workflow_nodes(
  p_workflow_id uuid,
  p_node_ids uuid[]
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count int;
  i int;
begin
  if not exists (
    select 1 from public.workflows w
    where w.id = p_workflow_id and w.author_id = v_uid and w.status = 'draft'
  ) then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  perform 1 from public.workflows where id = p_workflow_id for update;

  -- The id array must be exactly the workflow's node set (no partial reorder,
  -- no foreign ids). Guards a stale/extra-id client payload.
  select count(*) into v_count
    from public.workflow_nodes where workflow_id = p_workflow_id;
  if v_count <> coalesce(array_length(p_node_ids, 1), 0) then
    raise exception 'node_set_mismatch' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_node_ids) nid
    where not exists (
      select 1 from public.workflow_nodes n
      where n.id = nid and n.workflow_id = p_workflow_id
    )
  ) then
    raise exception 'node_set_mismatch' using errcode = '22023';
  end if;

  -- Phase 1: park out of the way. Phase 2: 0..n-1 in array order.
  update public.workflow_nodes set idx = idx + 1000000
    where workflow_id = p_workflow_id;
  for i in 1 .. array_length(p_node_ids, 1) loop
    update public.workflow_nodes set idx = i - 1
      where id = p_node_ids[i] and workflow_id = p_workflow_id;
  end loop;
end;
$$;

-- (c) Batch position write: persist canvas drag for many nodes in one round-trip
-- + one ownership check. p_positions = [{ "id": "...", "pos_x": 1, "pos_y": 2 }, …]
create or replace function public.update_node_positions(
  p_workflow_id uuid,
  p_positions jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.workflows w
    where w.id = p_workflow_id and w.author_id = v_uid and w.status = 'draft'
  ) then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  update public.workflow_nodes n
  set pos_x = (e->>'pos_x')::double precision,
      pos_y = (e->>'pos_y')::double precision
  from jsonb_array_elements(p_positions) e
  where n.id = (e->>'id')::uuid and n.workflow_id = p_workflow_id;
end;
$$;

-- Lock down EXECUTE: authenticated only (anon can't reach these).
revoke execute on function public.append_workflow_node(
  uuid, text, text, text, text, text, text, text, text, text, text,
  double precision, double precision
) from public, anon;
revoke execute on function public.reorder_workflow_nodes(uuid, uuid[])
  from public, anon;
revoke execute on function public.update_node_positions(uuid, jsonb)
  from public, anon;
grant execute on function public.append_workflow_node(
  uuid, text, text, text, text, text, text, text, text, text, text,
  double precision, double precision
) to authenticated;
grant execute on function public.reorder_workflow_nodes(uuid, uuid[])
  to authenticated;
grant execute on function public.update_node_positions(uuid, jsonb)
  to authenticated;
