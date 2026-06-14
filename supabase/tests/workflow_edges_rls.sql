-- Story 2.3 verification — workflow_edges RLS + immutability + ordering RPCs.
-- Run against the project DB (Supabase SQL editor or `execute_sql`). Raises an
-- exception on any failure and is a no-op (NOTICE only) on success. Role-switching
-- is required because the service role bypasses RLS.
--
-- Edges inherit visibility/ownership from the parent workflow (no author_id) and
-- are IMMUTABLE (create/delete only — no update grant). Asserts: an owner can wire
-- their own draft's nodes; self-edges + duplicates are blocked; other authed users
-- and anon see 0 + cannot mutate; a PUBLISHED workflow's edges are anon-readable;
-- authenticated has no UPDATE privilege; and the atomic node-ordering RPCs enforce
-- owner+draft (42501) + a matching node set (22023).

do $$
declare
  author uuid;
  other uuid;
  prof uuid;
  wf uuid;        -- author's draft
  pub uuid;       -- a published workflow (anon-read target)
  n1 uuid; n2 uuid;
  pn1 uuid; pn2 uuid;
  eid uuid;       -- author's draft edge
  n int;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';
  select id into other from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof from public.professions where slug = 'ai-automation';
  if author is null or other is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + the ai-automation profession';
  end if;

  -- Seed as table owner (bypasses RLS): a draft + 2 nodes; a published workflow +
  -- 2 nodes + an edge (for the anon-read assertion).
  insert into public.workflows (author_id, profession_id, title)
    values (author, prof, 'EDGE RLS draft') returning id into wf;
  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (wf, 0, 'ChatGPT', 'p', 'why') returning id into n1;
  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (wf, 1, 'Midjourney', 'p', 'why') returning id into n2;

  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (author, prof, 'EDGE RLS published', 'published', now()) returning id into pub;
  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (pub, 0, 'ChatGPT', 'p', 'why') returning id into pn1;
  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (pub, 1, 'Midjourney', 'p', 'why') returning id into pn2;
  insert into public.workflow_edges (workflow_id, source_node_id, target_node_id)
    values (pub, pn1, pn2);

  -- ── Author (authenticated) ────────────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role', 'authenticated')::text, true);

  -- Connect own nodes.
  insert into public.workflow_edges (workflow_id, source_node_id, target_node_id)
    values (wf, n1, n2) returning id into eid;
  select count(*) into n from public.workflow_edges where id = eid;
  if n <> 1 then raise exception 'RLS FAIL: author sees % own edge (expected 1)', n; end if;

  -- Self-edge blocked (check constraint).
  begin
    insert into public.workflow_edges (workflow_id, source_node_id, target_node_id) values (wf, n1, n1);
    raise exception 'CHECK FAIL: self-edge was allowed';
  exception when check_violation then null; end;

  -- Duplicate blocked (unique constraint).
  begin
    insert into public.workflow_edges (workflow_id, source_node_id, target_node_id) values (wf, n1, n2);
    raise exception 'UNIQUE FAIL: duplicate edge was allowed';
  exception when unique_violation then null; end;

  -- Immutability: authenticated has NO update grant on workflow_edges.
  begin
    update public.workflow_edges set source_node_id = n2 where id = eid;
    raise exception 'GRANT FAIL: author updated an edge (edges must be immutable)';
  exception when insufficient_privilege then null; end;

  -- ── Another authenticated user ────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role', 'authenticated')::text, true);

  select count(*) into n from public.workflow_edges where id = eid;
  if n <> 0 then raise exception 'RLS FAIL: other user sees % draft edge (expected 0)', n; end if;

  delete from public.workflow_edges where id = eid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FAIL: other user deleted % edge rows (expected 0)', n; end if;

  -- Other user cannot wire someone else's draft (RLS insert check → 42501).
  begin
    insert into public.workflow_edges (workflow_id, source_node_id, target_node_id) values (wf, n1, n2);
    raise exception 'RLS FAIL: other user inserted an edge onto a draft they do not own';
  exception when insufficient_privilege then null; end;

  -- Other user CAN read the published workflow's edge.
  select count(*) into n from public.workflow_edges where workflow_id = pub;
  if n <> 1 then raise exception 'RLS FAIL: other user sees % published edge (expected 1)', n; end if;

  -- ── Anon ──────────────────────────────────────────────────────────────────
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  select count(*) into n from public.workflow_edges where id = eid;
  if n <> 0 then raise exception 'RLS FAIL: anon sees % draft edge (expected 0)', n; end if;
  select count(*) into n from public.workflow_edges where workflow_id = pub;
  if n <> 1 then raise exception 'RLS FAIL: anon sees % published edge (expected 1)', n; end if;

  -- ── Node-ordering RPCs (author) ───────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role', 'authenticated')::text, true);

  -- reorder: swap n1/n2 → n2 becomes idx 0.
  perform public.reorder_workflow_nodes(wf, array[n2, n1]);
  if (select idx from public.workflow_nodes where id = n2) <> 0 then
    raise exception 'REORDER FAIL: n2 idx <> 0 after swap';
  end if;

  -- reorder with a mismatched node set → 22023.
  begin
    perform public.reorder_workflow_nodes(wf, array[n1]);
    raise exception 'REORDER FAIL: mismatched node set was accepted';
  exception when sqlstate '22023' then null; end;

  -- append as the OTHER user → 42501 (owner check inside the RPC).
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role', 'authenticated')::text, true);
  begin
    perform public.append_workflow_node(wf, null, 'X', null, 'p', 'w', null, null, null, null, null, 0, 0);
    raise exception 'RPC FAIL: other user appended a node to a draft they do not own';
  exception when insufficient_privilege then null; end;

  -- ── Cleanup ───────────────────────────────────────────────────────────────
  reset role;
  delete from public.workflows where id in (wf, pub); -- cascades to nodes + edges

  raise notice 'RLS OK: edges inherit parent visibility; self/dup blocked; immutable (no update); other+anon denied; published anon-readable; ordering RPCs enforce owner(42501)+node-set(22023)';
end $$;
