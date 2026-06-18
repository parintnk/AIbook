-- Story 10.1 verification — workflow_embeddings is LOCKED to clients (service-role/job writes only;
-- Story 10.2 reads via a SECURITY DEFINER match RPC). Asserts: an authenticated client SELECTs 0 rows
-- (the `using (false)` policy), and INSERT/UPDATE/DELETE are blocked (revoked → 42501). Run against the
-- project DB (`execute_sql`); ONE transaction, a RAISE rolls everything back. Cleans up its own fixtures.
-- A = founder (parin.tnk), B = the 2nd user (grayzoneno.13). The seed row is inserted as the privileged
-- harness role (the revoke targets anon/authenticated only).

do $$
declare
  a uuid; b uuid; prof uuid;
  wf uuid := '77777777-0000-4000-8000-000000000001';
  vec text := '[' || array_to_string(array_fill(0.1::float4, array[1536]), ',') || ']';
  n int;
begin
  select id into a from auth.users where email = 'parin.tnk@gmail.com';
  select id into b from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof from public.professions where slug = 'ai-automation';
  if a is null or b is null or prof is null then raise exception 'SETUP FAIL: need both users + ai-automation'; end if;

  insert into public.workflows (id, author_id, profession_id, title, summary, status, published_at)
    values (wf, a, prof, 'EMB TEST wf', 'test', 'published', now());
  insert into public.workflow_embeddings (workflow_id, embedding, content_hash)
    values (wf, vec::vector, 'hash0');

  -- ── as B (authenticated) ──────────────────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', b::text, 'role', 'authenticated')::text, true);

  -- SELECT → 0 rows (the `using (false)` policy locks reads; 10.2's definer RPC bypasses it)
  select count(*) into n from public.workflow_embeddings where workflow_id = wf;
  if n <> 0 then raise exception 'RLS SELECT FAIL: a client read an embedding (got %)', n; end if;

  -- INSERT → 42501 (grant revoked)
  begin
    insert into public.workflow_embeddings (workflow_id, embedding, content_hash) values (wf, vec::vector, 'forged');
    raise exception 'GRANT FAIL: a client inserted an embedding';
  exception when insufficient_privilege then null; end;

  -- UPDATE → 42501
  begin
    update public.workflow_embeddings set content_hash = 'x' where workflow_id = wf;
    raise exception 'GRANT FAIL: a client updated an embedding';
  exception when insufficient_privilege then null; end;

  -- DELETE → 42501
  begin
    delete from public.workflow_embeddings where workflow_id = wf;
    raise exception 'GRANT FAIL: a client deleted an embedding';
  exception when insufficient_privilege then null; end;

  reset role;

  -- the row is intact (B could neither read nor write it)
  select count(*) into n from public.workflow_embeddings where workflow_id = wf;
  if n <> 1 then raise exception 'INTEGRITY FAIL: embedding row changed (got %)', n; end if;

  delete from public.workflows where id = wf;  -- cascades the embedding
  raise notice 'RLS OK: workflow_embeddings — client SELECT = 0 rows (using false), client insert/update/delete → 42501, service-role writes intact.';
end $$;
