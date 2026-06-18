-- Story 11.2 — append_skeleton: atomically insert an AI-generated 1..8 node skeleton + its linear
-- chain edges onto a draft, in ONE transaction. Mirrors append_workflow_node (20260615000005):
-- SECURITY INVOKER (the owner already has RLS + the column grants to insert nodes/edges; INVOKER keeps
-- it OFF the `authenticated_security_definer_function_executable` advisor → advisors stay 4 baseline),
-- `set search_path = ''`, an explicit owner+draft gate (clean 42501), and a `for update` row-lock on the
-- parent so concurrent appends can't collide on idx. Positions are staggered vertically (pos_y = idx*170)
-- so the generated nodes never overlap at (0,0). NOT NULL cols (tool_name/prompt/purpose) → a missing
-- field aborts the WHOLE batch (atomic). Returns (node_id, node_idx) per inserted node, in order.
-- [Source: 20260615000005_node_ordering_fns.sql (append_workflow_node idiom); epics.md#Story-11.2; advisor 0029]
create or replace function public.append_skeleton(
  p_workflow_id uuid,
  p_nodes jsonb
) returns table (node_id uuid, node_idx int)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_base int;
  v_count int;
  v_prev uuid := null;
  v_curr uuid;
  e record;
begin
  -- Owner + draft check up front for a clean 42501 (RLS also enforces it). Draft-only.
  if not exists (
    select 1 from public.workflows w
    where w.id = p_workflow_id and w.author_id = v_uid and w.status = 'draft'
  ) then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  v_count := jsonb_array_length(p_nodes);
  if v_count is null or v_count < 1 or v_count > 8 then
    raise exception 'bad_skeleton_size' using errcode = '22023';
  end if;

  -- Serialize concurrent appends on the parent row → no idx collision (the 2.3 pattern).
  perform 1 from public.workflows where id = p_workflow_id for update;

  select coalesce(max(n.idx), -1) into v_base
    from public.workflow_nodes n where n.workflow_id = p_workflow_id;

  for e in
    select (t.ord - 1)::int as i, t.elem as elem
    from jsonb_array_elements(p_nodes) with ordinality as t(elem, ord)
    order by t.ord
  loop
    insert into public.workflow_nodes (
      workflow_id, idx, pos_x, pos_y, step_title, tool_name, tool_version,
      prompt, purpose, est_time, est_cost, notes, note_lang, tool_url
    ) values (
      p_workflow_id, v_base + 1 + e.i, 0, (v_base + 1 + e.i) * 170,
      e.elem->>'step_title', e.elem->>'tool_name', e.elem->>'tool_version',
      e.elem->>'prompt', e.elem->>'purpose', e.elem->>'est_time', e.elem->>'est_cost',
      e.elem->>'notes', e.elem->>'note_lang', e.elem->>'tool_url'
    ) returning id into v_curr;

    if v_prev is not null then
      insert into public.workflow_edges (workflow_id, source_node_id, target_node_id)
        values (p_workflow_id, v_prev, v_curr);
    end if;
    v_prev := v_curr;

    node_id := v_curr;
    node_idx := v_base + 1 + e.i;
    return next;
  end loop;
end;
$$;

-- Lock down EXECUTE: authenticated only (anon can't reach it). INVOKER → RLS still applies.
revoke execute on function public.append_skeleton(uuid, jsonb) from public, anon;
grant execute on function public.append_skeleton(uuid, jsonb) to authenticated;
