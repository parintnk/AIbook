-- Story 11.2 — append_skeleton RLS + atomicity harness. Run on REMOTE via MCP execute_sql.
-- Transactional intent + self-cleaning (deletes its temp workflows → cascades nodes/edges). Proves:
-- owner+draft → atomic 3-node + 2-edge insert (contiguous idx, staggered pos); non-owner → 42501;
-- published (non-draft) → 42501; a node missing NOT NULL tool_name aborts the WHOLE batch (atomic).
-- Setup inserts run as the MCP service role (bypass RLS); the append_skeleton calls run as
-- `authenticated` with a jwt sub so the SECURITY INVOKER RPC sees auth.uid().
do $$
declare
  v_uid uuid;
  v_prof uuid;
  v_wf uuid;
  v_pub uuid;
  v_cnt int;
  v_edges int;
  v_denied boolean;
  v_nodes jsonb := '[
    {"step_title":"A","tool_name":"ChatGPT","prompt":"p1","purpose":"u1"},
    {"step_title":"B","tool_name":"Claude","prompt":"p2","purpose":"u2"},
    {"step_title":"C","tool_name":"ChatGPT","prompt":"p3","purpose":"u3"}
  ]'::jsonb;
begin
  select id into v_uid from public.profiles order by created_at limit 1;
  select id into v_prof from public.professions order by created_at limit 1;

  insert into public.workflows (author_id, profession_id, title, status)
    values (v_uid, v_prof, 'ZZ append_skeleton test', 'draft') returning id into v_wf;
  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (v_uid, v_prof, 'ZZ append_skeleton pub', 'published', now()) returning id into v_pub;

  -- (1) owner + draft → atomic 3-node + 2-edge insert
  set local role authenticated;
  execute format('set local request.jwt.claims = %L', json_build_object('sub', v_uid)::text);
  perform public.append_skeleton(v_wf, v_nodes);
  reset role;
  reset request.jwt.claims;

  select count(*) into v_cnt from public.workflow_nodes where workflow_id = v_wf;
  if v_cnt <> 3 then raise exception 'expected 3 nodes, got %', v_cnt; end if;
  if (select count(*) from public.workflow_nodes where workflow_id = v_wf and idx in (0,1,2)) <> 3 then
    raise exception 'idx not contiguous 0..2'; end if;
  if (select count(*) from public.workflow_nodes where workflow_id = v_wf and pos_y in (0,170,340)) <> 3 then
    raise exception 'pos_y not staggered (0/170/340)'; end if;
  select count(*) into v_edges from public.workflow_edges where workflow_id = v_wf;
  if v_edges <> 2 then raise exception 'expected 2 chain edges, got %', v_edges; end if;

  -- (2) a NON-owner → 42501
  set local role authenticated;
  execute format('set local request.jwt.claims = %L', json_build_object('sub', gen_random_uuid())::text);
  begin
    perform public.append_skeleton(v_wf, v_nodes);
    v_denied := false;
  exception when insufficient_privilege then v_denied := true;
  end;
  reset role;
  reset request.jwt.claims;
  if not v_denied then raise exception 'non-owner append_skeleton should raise 42501'; end if;

  -- (3) a PUBLISHED workflow (owner, not draft) → 42501
  set local role authenticated;
  execute format('set local request.jwt.claims = %L', json_build_object('sub', v_uid)::text);
  begin
    perform public.append_skeleton(v_pub, v_nodes);
    v_denied := false;
  exception when insufficient_privilege then v_denied := true;
  end;
  reset role;
  reset request.jwt.claims;
  if not v_denied then raise exception 'published append_skeleton should raise 42501'; end if;

  -- (4) a node missing NOT NULL tool_name aborts the WHOLE batch (atomic) — count stays 3
  set local role authenticated;
  execute format('set local request.jwt.claims = %L', json_build_object('sub', v_uid)::text);
  begin
    perform public.append_skeleton(
      v_wf,
      '[{"tool_name":"X","prompt":"p","purpose":"u"},{"prompt":"no tool","purpose":"u"}]'::jsonb
    );
    v_denied := false;
  exception when not_null_violation then v_denied := true;
  end;
  reset role;
  reset request.jwt.claims;
  if not v_denied then raise exception 'missing tool_name should violate NOT NULL'; end if;
  if (select count(*) from public.workflow_nodes where workflow_id = v_wf) <> 3 then
    raise exception 'a failed batch must not add nodes (atomic)'; end if;

  -- cleanup (cascade nodes/edges)
  delete from public.workflows where id in (v_wf, v_pub);
  raise notice 'append_skeleton_rls: ALL PASS';
end $$;
