-- Story 2.5 verification — the publish gate (FR9/FR10 MOAT) + the 2.1 self-publish
-- regression guard. Run against the project DB (Supabase SQL editor / `execute_sql`).
-- Raises on any failure, NOTICE-only on success. Role-switching is required: the
-- service role bypasses RLS, and `publish_workflow` is SECURITY DEFINER so it must be
-- exercised under a real `set local role authenticated` + request.jwt.claims session
-- to prove its own owner/draft re-assertion (the definer bypasses RLS, not auth.uid()).
--
-- Asserts: (1) a fully-covered draft publishes (status+published_at flip); (2) an
-- uncovered node blocks with reason=missing_outputs naming that node, status stays
-- draft; (3) a zero-node draft blocks with reason=no_nodes; (4) a non-owner gets 42501;
-- (5) anon has EXECUTE revoked on the function; (6) the self-publish column lock STILL
-- holds — a direct UPDATE status='published' raises insufficient_privilege (the definer
-- RPC did NOT re-open it); (7) once published, the graph is world-readable to anon with
-- no new policies.

do $$
declare
  author uuid;
  other uuid;
  prof uuid;
  wf_covered uuid;   -- draft, every node covered -> publishable
  wf_missing uuid;   -- draft, one node uncovered -> blocked
  wf_empty uuid;     -- draft, zero nodes -> blocked
  n_ok uuid;         -- covered node in wf_missing
  n_bad uuid;        -- uncovered node in wf_missing
  cov_node uuid;     -- the single node in wf_covered
  res jsonb;
  st text;
  pub_ts timestamptz;
  n int;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';
  select id into other from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof from public.professions where slug = 'ai-automation';
  if author is null or other is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + the ai-automation profession';
  end if;

  -- Seed as the table owner (bypasses RLS/grants).
  insert into public.workflows (author_id, profession_id, title)
    values (author, prof, 'PUBLISH GATE covered') returning id into wf_covered;
  insert into public.workflows (author_id, profession_id, title)
    values (author, prof, 'PUBLISH GATE missing') returning id into wf_missing;
  insert into public.workflows (author_id, profession_id, title)
    values (author, prof, 'PUBLISH GATE empty') returning id into wf_empty;

  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (wf_covered, 0, 'ChatGPT', 'p', 'why') returning id into cov_node;
  insert into public.node_outputs (node_id, kind, text_content)
    values (cov_node, 'text', 'sample');

  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (wf_missing, 0, 'ChatGPT', 'p', 'why') returning id into n_ok;
  insert into public.node_outputs (node_id, kind, text_content)
    values (n_ok, 'text', 'sample');
  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (wf_missing, 1, 'Midjourney', 'p', 'why') returning id into n_bad;
  -- n_bad intentionally has NO output.

  -- ── Author (authenticated) ────────────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role', 'authenticated')::text, true);

  -- (1) Fully-covered draft publishes.
  res := public.publish_workflow(wf_covered);
  if (res->>'ok') <> 'true' then
    raise exception 'GATE FAIL: covered draft did not publish: %', res;
  end if;
  select status, published_at into st, pub_ts from public.workflows where id = wf_covered;
  if st <> 'published' or pub_ts is null then
    raise exception 'GATE FAIL: covered workflow status=% published_at=% (expected published + ts)', st, pub_ts;
  end if;

  -- (2) Uncovered node blocks; names the node; status stays draft.
  res := public.publish_workflow(wf_missing);
  if (res->>'ok') <> 'false' or (res->>'reason') <> 'missing_outputs' then
    raise exception 'GATE FAIL: uncovered draft expected missing_outputs, got %', res;
  end if;
  if (res->'missing'->0->>'id')::uuid <> n_bad then
    raise exception 'GATE FAIL: missing[0].id=% expected the uncovered node %', res->'missing'->0->>'id', n_bad;
  end if;
  select status into st from public.workflows where id = wf_missing;
  if st <> 'draft' then raise exception 'GATE FAIL: blocked workflow flipped to % (expected draft)', st; end if;

  -- (3) Zero-node draft blocks with no_nodes.
  res := public.publish_workflow(wf_empty);
  if (res->>'ok') <> 'false' or (res->>'reason') <> 'no_nodes' then
    raise exception 'GATE FAIL: empty draft expected no_nodes, got %', res;
  end if;
  select status into st from public.workflows where id = wf_empty;
  if st <> 'draft' then raise exception 'GATE FAIL: empty workflow flipped to % (expected draft)', st; end if;

  -- ── (4) Non-owner -> 42501 (the RPC's owner/draft re-assertion) ────────────
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role', 'authenticated')::text, true);
  begin
    perform public.publish_workflow(wf_missing);
    raise exception 'GATE FAIL: a non-owner published someone else''s draft';
  exception when insufficient_privilege then null; end;  -- errcode 42501

  -- ── (5) Anon has EXECUTE revoked ───────────────────────────────────────────
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    perform public.publish_workflow(wf_missing);
    raise exception 'GRANT FAIL: anon could execute publish_workflow';
  exception when insufficient_privilege then null; end;

  -- ── (6) Self-publish column lock STILL holds (the key 2.1 regression guard) ─
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role', 'authenticated')::text, true);
  begin
    update public.workflows set status = 'published', published_at = now() where id = wf_missing;
    raise exception 'REGRESSION: author directly flipped status to published (column lock re-opened!)';
  exception when insufficient_privilege then null; end;
  select status into st from public.workflows where id = wf_missing;
  if st <> 'draft' then raise exception 'REGRESSION: wf_missing is % after a blocked direct update', st; end if;

  -- ── (7) Published graph is world-readable to anon (no new policies) ─────────
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  select count(*) into n from public.workflows where id = wf_covered;
  if n <> 1 then raise exception 'PUBLISH FAIL: anon sees % published workflow (expected 1)', n; end if;
  select count(*) into n from public.workflow_nodes where workflow_id = wf_covered;
  if n <> 1 then raise exception 'PUBLISH FAIL: anon sees % published nodes (expected 1)', n; end if;
  select count(*) into n from public.node_outputs where node_id = cov_node;
  if n <> 1 then raise exception 'PUBLISH FAIL: anon sees % published outputs (expected 1)', n; end if;

  -- ── Cleanup ───────────────────────────────────────────────────────────────
  reset role;
  delete from public.workflows where id in (wf_covered, wf_missing, wf_empty); -- cascades

  raise notice 'PUBLISH GATE OK: covered->published(+ts); missing_outputs names the node + stays draft; no_nodes; non-owner 42501; anon execute revoked; self-publish column lock intact; published graph world-readable';
end $$;
