-- Story 5.1 — fork_workflow RPC: atomically copy a PUBLISHED workflow into the caller's new draft.
-- SECURITY DEFINER is REQUIRED: it sets parent_id (client-locked) on the new draft, and the
-- maintain_workflow_lineage AFTER-INSERT trigger then writes the closure rows + increments the
-- source's fork_count (also locked). Granting execute to `authenticated` trips the
-- authenticated_security_definer_function_executable advisor — the EXPECTED 4th WARN (like
-- publish_workflow); an atomic multi-table copy that writes locked columns has no column-grant
-- alternative (contrast 4.3's narrow comment-hide grant). Published-only + ONE generic error
-- (published existence is public → no oracle). Binary outputs: ZERO-COPY reference (Q1=b) —
-- storage_path copied as-is (source is published → the fork can read it via the 3.1 published-read
-- storage RLS); text_content copied; no storage duplication, and the whole fork is one DB txn.
-- [Source: epics.md#Story-5.1 AC1/AC2; publish_workflow_fn.sql (the DEFINER precedent); UX-DR7]

create or replace function public.fork_workflow(p_source_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_src public.workflows;
  v_fork_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Published-only (you may fork any published workflow, incl. your own). One generic error.
  select * into v_src from public.workflows
    where id = p_source_id and status = 'published';
  if not found then
    raise exception 'invalid fork source';
  end if;

  -- The new draft copy (author = the CALLER, not the definer owner). The AFTER-INSERT trigger
  -- (maintain_workflow_lineage) writes the closure rows + increments v_src.fork_count.
  insert into public.workflows (author_id, profession_id, title, summary, status, parent_id)
    values (v_uid, v_src.profession_id, v_src.title, v_src.summary, 'draft', p_source_id)
    returning id into v_fork_id;

  -- Copy nodes + edges + outputs in ONE statement. `src_nodes` is MATERIALIZED so the volatile
  -- gen_random_uuid() runs once → a stable old->new id map reused for edges + outputs. FK checks
  -- (edge/output -> new node) fire at statement-end, by when the new nodes exist (the classic
  -- `with parent as (insert…) insert…from parent` mechanic). No temp table (unreachable under
  -- search_path='').
  with src_nodes as materialized (
    select n.*, gen_random_uuid() as new_id
    from public.workflow_nodes n where n.workflow_id = p_source_id
  ),
  ins_nodes as (
    insert into public.workflow_nodes
      (id, workflow_id, idx, pos_x, pos_y, step_title, tool_name, tool_version,
       prompt, purpose, est_time, est_cost, notes, note_lang, tool_url)
    select new_id, v_fork_id, idx, pos_x, pos_y, step_title, tool_name, tool_version,
           prompt, purpose, est_time, est_cost, notes, note_lang, tool_url
    from src_nodes
  ),
  ins_edges as (
    insert into public.workflow_edges (workflow_id, source_node_id, target_node_id)
    select v_fork_id, s.new_id, t.new_id
    from public.workflow_edges e
    join src_nodes s on s.id = e.source_node_id
    join src_nodes t on t.id = e.target_node_id
    where e.workflow_id = p_source_id
  )
  insert into public.node_outputs (node_id, kind, storage_path, text_content, mime, bytes)
  select sn.new_id, o.kind, o.storage_path, o.text_content, o.mime, o.bytes
  from public.node_outputs o
  join src_nodes sn on sn.id = o.node_id;

  return v_fork_id;
end;
$$;

revoke execute on function public.fork_workflow(uuid) from public, anon;
grant execute on function public.fork_workflow(uuid) to authenticated;
