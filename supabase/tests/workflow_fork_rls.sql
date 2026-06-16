-- Story 5.1 — Fork & lineage RLS/integrity harness. Run via MCP execute_sql against the remote;
-- the final RAISE rolls back ALL fixtures + forks (the comments_rls.sql/reports_rls.sql idiom).
-- Self-contained: borrows two profiles + a profession from existing rows, then creates its own
-- published source + draft. Asserts: the fork RPC copy + closure rows + fork_count; the
-- published-only gate (draft/nonexistent → raise); the column-locks hold (fork_count/parent_id +
-- workflow_lineage are not client-writable → 42501); the lineage-select privacy (a stranger
-- cannot see my PRIVATE draft fork's lineage).
do $$
declare
  v_u1 uuid; v_u2 uuid; v_prof uuid;
  v_src uuid; v_n1 uuid; v_n2 uuid; v_draft uuid; v_f1 uuid;
  v_nodes int; v_edges int; v_outs int; v_self int; v_p1 int; v_fc int;
  v_status text; v_author uuid; v_parent uuid; v_blocked boolean; v_seen int;
begin
  select id into v_u1 from public.profiles order by created_at limit 1;
  select id into v_u2 from public.profiles where id <> v_u1 limit 1;
  select profession_id into v_prof from public.workflows limit 1;

  -- ── fixtures: a PUBLISHED source (2 nodes / 1 edge / text+binary outputs) + a DRAFT ──
  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (v_u1, v_prof, 'FORKTEST SRC', 'published', now()) returning id into v_src;
  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (v_src, 0, 'ChatGPT', 'p', 'u') returning id into v_n1;
  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (v_src, 1, 'Midjourney', 'p', 'u') returning id into v_n2;
  insert into public.workflow_edges (workflow_id, source_node_id, target_node_id)
    values (v_src, v_n1, v_n2);
  insert into public.node_outputs (node_id, kind, text_content) values (v_n1, 'text', 't');
  insert into public.node_outputs (node_id, kind, storage_path, mime, bytes)
    values (v_n2, 'image', v_src || '/' || v_n2 || '/main', 'image/png', 1);
  insert into public.workflows (author_id, profession_id, title, status)
    values (v_u1, v_prof, 'FORKTEST DRAFT', 'draft') returning id into v_draft;

  -- ── 1. fork the published source as u1 → a draft copy + full closure + fork_count++ ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u1::text, 'role', 'authenticated')::text, true);
  v_f1 := public.fork_workflow(v_src);
  select status, author_id, parent_id into v_status, v_author, v_parent
    from public.workflows where id = v_f1;
  select count(*) into v_nodes from public.workflow_nodes where workflow_id = v_f1;
  select count(*) into v_edges from public.workflow_edges where workflow_id = v_f1;
  select count(*) into v_outs from public.node_outputs o
    join public.workflow_nodes n on n.id = o.node_id where n.workflow_id = v_f1;
  select count(*) into v_self from public.workflow_lineage
    where ancestor_id = v_f1 and descendant_id = v_f1 and depth = 0;
  select count(*) into v_p1 from public.workflow_lineage
    where ancestor_id = v_src and descendant_id = v_f1 and depth = 1;
  select fork_count into v_fc from public.workflows where id = v_src;
  if v_status <> 'draft' or v_author <> v_u1 or v_parent <> v_src
     or v_nodes <> 2 or v_edges <> 1 or v_outs <> 2
     or v_self <> 1 or v_p1 <> 1 or v_fc <> 1 then
    raise exception 'FAIL fork: status=% author_ok=% parent_ok=% nodes=% edges=% outs=% self=% p1=% fc=%',
      v_status, (v_author = v_u1), (v_parent = v_src), v_nodes, v_edges, v_outs, v_self, v_p1, v_fc;
  end if;

  -- ── 2. published-only gate: forking a DRAFT raises ──
  v_blocked := false;
  begin perform public.fork_workflow(v_draft); exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: forking a draft must raise'; end if;

  -- ── 3. forking a NONEXISTENT id raises (one generic error — no oracle) ──
  v_blocked := false;
  begin perform public.fork_workflow('00000000-0000-0000-0000-000000000000');
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: forking a nonexistent id must raise'; end if;

  -- ── 4. fork_count is column-locked from a direct client write ──
  set local role authenticated;
  v_blocked := false;
  begin update public.workflows set fork_count = 999 where id = v_src;
  exception when insufficient_privilege then v_blocked := true; end;
  reset role;
  if not v_blocked then raise exception 'FAIL: direct fork_count write must be 42501'; end if;

  -- ── 5. parent_id is column-locked ──
  set local role authenticated;
  v_blocked := false;
  begin update public.workflows set parent_id = v_src where id = v_draft;
  exception when insufficient_privilege then v_blocked := true; end;
  reset role;
  if not v_blocked then raise exception 'FAIL: direct parent_id write must be 42501'; end if;

  -- ── 6. workflow_lineage: no client writes ──
  set local role authenticated;
  v_blocked := false;
  begin insert into public.workflow_lineage (ancestor_id, descendant_id, depth)
    values (v_src, v_src, 9);
  exception when insufficient_privilege then v_blocked := true; end;
  reset role;
  if not v_blocked then raise exception 'FAIL: direct workflow_lineage insert must be denied'; end if;

  -- ── 7. lineage-select privacy: a STRANGER cannot see u1's PRIVATE draft fork's lineage ──
  if v_u2 is not null then
    set local role authenticated;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_u2::text, 'role', 'authenticated')::text, true);
    select count(*) into v_seen from public.workflow_lineage where descendant_id = v_f1;
    reset role;
    if v_seen <> 0 then
      raise exception 'FAIL: stranger saw % lineage rows of a private draft fork', v_seen;
    end if;
  end if;

  -- ── 8. fork_count DECREMENTS when a fork is deleted (the AFTER-DELETE trigger — symmetric
  --       counterpart to the ±1 INSERT increment; deleteDraft on a fork is reachable) ──
  delete from public.workflows where id = v_f1;
  select fork_count into v_fc from public.workflows where id = v_src;
  if v_fc <> 0 then
    raise exception 'FAIL: deleting the fork must decrement source fork_count to 0, got %', v_fc;
  end if;

  raise exception 'ALL FORK RLS/INTEGRITY TESTS PASSED (rolled back)';
end $$;
