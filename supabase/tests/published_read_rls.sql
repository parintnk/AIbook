-- Story 3.1 verification — a published workflow's full graph is world-readable to
-- ANON (FR6), while a draft stays private. Run via MCP `execute_sql`. Raises on any
-- failure, NOTICE-only on success. Role-switching is required (the service role
-- bypasses RLS). Covers the table policies (workflows/nodes/edges/outputs) AND the
-- storage.objects SELECT policy (Story 3.1's anon-published grant) via dummy objects.
--
-- Cleanup note: storage.objects has a protect_delete() trigger that blocks direct
-- DELETE, so we seed + assert inside a SUBTRANSACTION and force a rollback via a
-- sentinel exception at the end — the rollback (not a DELETE) undoes the dummy
-- objects + workflows. A non-sentinel error is a real failure and propagates.

do $$
declare
  author uuid;
  prof uuid;
  pub uuid;        -- published workflow
  drf uuid;        -- draft workflow
  pubnode uuid;
  drfnode uuid;
  n int;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';
  select id into prof from public.professions where slug = 'ai-automation';
  if author is null or prof is null then
    raise exception 'SETUP FAIL: need the parintnk user + ai-automation profession';
  end if;

  begin  -- subtransaction: everything here rolls back via the sentinel below
    insert into public.workflows (author_id, profession_id, title, status, published_at)
      values (author, prof, 'PUBLIC READ published', 'published', now()) returning id into pub;
    insert into public.workflows (author_id, profession_id, title)
      values (author, prof, 'PUBLIC READ draft') returning id into drf;

    insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
      values (pub, 0, 'ChatGPT', 'p', 'why') returning id into pubnode;
    insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
      values (pub, 1, 'Midjourney', 'p', 'why');
    insert into public.node_outputs (node_id, kind, text_content) values (pubnode, 'text', 'sample');
    insert into public.workflow_edges (workflow_id, source_node_id, target_node_id)
      select pub, pubnode, id from public.workflow_nodes where workflow_id = pub and idx = 1;

    insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
      values (drf, 0, 'ChatGPT', 'p', 'why') returning id into drfnode;
    insert into public.node_outputs (node_id, kind, text_content) values (drfnode, 'text', 'secret');

    insert into storage.objects (bucket_id, name) values ('node-outputs', pub || '/' || pubnode || '/main');
    insert into storage.objects (bucket_id, name) values ('node-outputs', drf || '/' || drfnode || '/main');

    -- ── Anon (signed-out visitor) ─────────────────────────────────────────────
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    set local role anon;

    -- (1) Published graph fully readable.
    select count(*) into n from public.workflows where id = pub;
    if n <> 1 then raise exception 'READ FAIL: anon sees % published workflow (expected 1)', n; end if;
    select count(*) into n from public.workflow_nodes where workflow_id = pub;
    if n <> 2 then raise exception 'READ FAIL: anon sees % published nodes (expected 2)', n; end if;
    select count(*) into n from public.workflow_edges where workflow_id = pub;
    if n <> 1 then raise exception 'READ FAIL: anon sees % published edges (expected 1)', n; end if;
    select count(*) into n from public.node_outputs where node_id = pubnode;
    if n <> 1 then raise exception 'READ FAIL: anon sees % published outputs (expected 1)', n; end if;

    -- (2) Draft graph invisible to anon.
    select count(*) into n from public.workflows where id = drf;
    if n <> 0 then raise exception 'LEAK: anon sees % draft workflow (expected 0)', n; end if;
    select count(*) into n from public.workflow_nodes where workflow_id = drf;
    if n <> 0 then raise exception 'LEAK: anon sees % draft nodes (expected 0)', n; end if;
    select count(*) into n from public.workflow_edges where workflow_id = drf;
    if n <> 0 then raise exception 'LEAK: anon sees % draft edges (expected 0)', n; end if;
    select count(*) into n from public.node_outputs where node_id = drfnode;
    if n <> 0 then raise exception 'LEAK: anon sees % draft outputs (expected 0)', n; end if;

    -- (3) Storage: anon SELECTs the published-path object (→ createSignedUrl works)
    -- but NOT the draft-path object.
    select count(*) into n from storage.objects
      where bucket_id = 'node-outputs' and name = pub || '/' || pubnode || '/main';
    if n <> 1 then raise exception 'STORAGE FAIL: anon sees % published object (expected 1)', n; end if;
    select count(*) into n from storage.objects
      where bucket_id = 'node-outputs' and name = drf || '/' || drfnode || '/main';
    if n <> 0 then raise exception 'STORAGE LEAK: anon sees % draft object (expected 0)', n; end if;

    reset role;
    raise exception 'ROLLBACK_SENTINEL';  -- undo all seed rows (incl. storage objects)
  exception
    when others then
      if sqlerrm = 'ROLLBACK_SENTINEL' then
        raise notice 'PUBLIC READ OK: anon reads the full published graph + its storage objects; draft graph + media stay private';
      else
        raise;  -- a real assertion/setup failure
      end if;
  end;
end $$;
