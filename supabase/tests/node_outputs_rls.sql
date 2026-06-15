-- Story 2.4 verification — node_outputs RLS + column locks + CHECK + unique.
-- Run against the project DB (Supabase SQL editor or `execute_sql`). Raises an
-- exception on any failure and is a no-op (NOTICE only) on success. Role-switching
-- is required because the service role bypasses RLS.
--
-- Outputs have no author_id — ownership derives TWO hops (output -> node ->
-- workflow -> author). Asserts: a draft node's output is visible/writable only by
-- the workflow's author; other authenticated users AND anon see 0 and cannot mutate
-- (and cannot attach an output to a node they don't own); a PUBLISHED workflow's
-- output is world-readable (incl. anon); authenticated users cannot reparent an
-- output (node_id column-lock); the kind/payload CHECK rejects a mismatched row; and
-- unique(node_id) blocks a second output on the same node.

do $$
declare
  author uuid;
  other uuid;
  prof uuid;
  wf uuid;        -- author's draft
  pub uuid;       -- a published workflow (anon-read target)
  dnode uuid;     -- node in the draft
  pubnode uuid;   -- node in the published workflow
  oid uuid;       -- output on the draft node
  n int;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';
  select id into other from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof from public.professions where slug = 'ai-automation';
  if author is null or other is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + the ai-automation profession';
  end if;

  -- Seed as the table owner (bypasses RLS/grants): a draft + a published workflow,
  -- a node in each, and a published output for the anon-read assertion.
  insert into public.workflows (author_id, profession_id, title)
    values (author, prof, 'OUTPUT RLS draft') returning id into wf;
  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (author, prof, 'OUTPUT RLS published', 'published', now()) returning id into pub;
  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (wf, 0, 'ChatGPT', 'p', 'why') returning id into dnode;
  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (pub, 0, 'ChatGPT', 'p', 'why') returning id into pubnode;
  insert into public.node_outputs (node_id, kind, storage_path, mime, bytes)
    values (pubnode, 'image', pub || '/' || pubnode || '/main', 'image/webp', 10);

  -- ── Author (authenticated) ────────────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role', 'authenticated')::text, true);

  -- Author can attach an output to their own draft's node (RLS insert check passes).
  insert into public.node_outputs (node_id, kind, storage_path, mime, bytes)
    values (dnode, 'image', wf || '/' || dnode || '/main', 'image/webp', 123)
    returning id into oid;

  select count(*) into n from public.node_outputs where id = oid;
  if n <> 1 then raise exception 'RLS FAIL: author sees % draft output rows (expected 1)', n; end if;

  update public.node_outputs set bytes = 456 where id = oid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS FAIL: author updated % output rows (expected 1)', n; end if;

  -- Column lock: author may NOT reparent the output to another node.
  begin
    update public.node_outputs set node_id = pubnode where id = oid;
    raise exception 'GRANT FAIL: author reparented an output (node_id writable)';
  exception when insufficient_privilege then null; end;

  -- CHECK: switching to kind=text while keeping storage_path violates the payload rule.
  begin
    update public.node_outputs set kind = 'text', text_content = 'x' where id = oid;
    raise exception 'CHECK FAIL: a text output kept its storage_path';
  exception when check_violation then null; end;

  -- unique(node_id): a second output on the same node is rejected.
  begin
    insert into public.node_outputs (node_id, kind, storage_path, mime, bytes)
      values (dnode, 'image', wf || '/' || dnode || '/main2', 'image/webp', 9);
    raise exception 'UNIQUE FAIL: a second output was attached to one node';
  exception when unique_violation then null; end;

  -- Author can read the published workflow's output (world-readable).
  select count(*) into n from public.node_outputs where node_id = pubnode;
  if n <> 1 then raise exception 'RLS FAIL: author sees % published output (expected 1)', n; end if;

  -- ── Another authenticated user ────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role', 'authenticated')::text, true);

  select count(*) into n from public.node_outputs where id = oid;
  if n <> 0 then raise exception 'RLS FAIL: other user sees % draft output (expected 0)', n; end if;

  update public.node_outputs set bytes = 1 where id = oid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FAIL: other user updated % output rows (expected 0)', n; end if;
  delete from public.node_outputs where id = oid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FAIL: other user deleted % output rows (expected 0)', n; end if;

  -- Other user cannot attach an output to a node they don't own (RLS insert → 42501).
  begin
    insert into public.node_outputs (node_id, kind, storage_path, mime, bytes)
      values (dnode, 'image', wf || '/' || dnode || '/x', 'image/webp', 1);
    raise exception 'RLS FAIL: other user attached an output to a node they do not own';
  exception when insufficient_privilege then null; end;

  -- Other user CAN read the published output.
  select count(*) into n from public.node_outputs where node_id = pubnode;
  if n <> 1 then raise exception 'RLS FAIL: other user sees % published output (expected 1)', n; end if;

  -- ── Anon (no session) ─────────────────────────────────────────────────────
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  select count(*) into n from public.node_outputs where id = oid;
  if n <> 0 then raise exception 'RLS FAIL: anon sees % draft output (expected 0)', n; end if;
  select count(*) into n from public.node_outputs where node_id = pubnode;
  if n <> 1 then raise exception 'RLS FAIL: anon sees % published output (expected 1)', n; end if;

  -- ── Author can delete their own output ────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.node_outputs where id = oid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS FAIL: author deleted % own output rows (expected 1)', n; end if;

  -- ── Cleanup ───────────────────────────────────────────────────────────────
  reset role;
  delete from public.workflows where id in (wf, pub); -- cascades to nodes + outputs

  raise notice 'RLS OK: outputs inherit two-hop visibility (draft=author-only, published=world); writes owner-only; cross-node insert blocked; node_id column-locked; kind/payload CHECK + unique(node_id) enforced';
end $$;

-- ── Storage-policy notes ────────────────────────────────────────────────────
-- The storage.objects policies (20260615000008_node_outputs_bucket.sql) bind via
-- (storage.foldername(name))[1]::uuid -> workflows.author_id, mirroring this two-hop
-- model on the object path. They can't be role-tested here the same way (the storage
-- schema's auth.uid() resolution differs under execute_sql), so they are exercised by
-- the authed e2e (e2e/node-output-upload.authed.spec.ts): an author uploads to
-- {workflow_id}/{node_id}/main under their session and the object round-trips via a
-- signed URL; the server upload itself runs RLS-bound (the user-session client), so a
-- non-owner path would be denied by the insert policy.
