-- Story 2.1 AC#2 verification — workflow drafts are private to author_id (RLS).
-- Run against the project DB (Supabase SQL editor or `execute_sql`). Raises an
-- exception on any failure and is a no-op (NOTICE only) on success. Role-
-- switching is required because the service role bypasses RLS.
--
-- Asserts: a draft is visible/updatable/deletable only by its author; other
-- authenticated users AND anon see 0 rows and cannot mutate it.

do $$
declare
  author uuid;
  other uuid;
  prof uuid;
  wf uuid;
  n int;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';
  select id into other from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof from public.professions where slug = 'ai-automation';
  if author is null or other is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + the ai-automation profession';
  end if;

  -- Author creates a draft (RLS insert: author_id = auth.uid(), status='draft').
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role', 'authenticated')::text, true);
  insert into public.workflows (author_id, profession_id, title)
    values (author, prof, 'RLS test draft') returning id into wf;

  -- Author sees their own draft (1 row).
  select count(*) into n from public.workflows where id = wf;
  if n <> 1 then raise exception 'RLS FAIL: author sees % rows (expected 1)', n; end if;

  -- Another authenticated user sees 0 rows and cannot mutate it.
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role', 'authenticated')::text, true);
  select count(*) into n from public.workflows where id = wf;
  if n <> 0 then raise exception 'RLS FAIL: other user sees % draft rows (expected 0)', n; end if;
  update public.workflows set title = 'hacked' where id = wf;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FAIL: other user updated % rows (expected 0)', n; end if;
  delete from public.workflows where id = wf;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FAIL: other user deleted % rows (expected 0)', n; end if;

  -- Anon (no session) sees 0 rows.
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  select count(*) into n from public.workflows where id = wf;
  if n <> 0 then raise exception 'RLS FAIL: anon sees % draft rows (expected 0)', n; end if;

  -- Author can update + delete their own draft (metadata columns only).
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role', 'authenticated')::text, true);

  -- Column lock (workflows_harden): author may NOT self-publish or forge counters.
  begin
    update public.workflows set status = 'published' where id = wf;
    raise exception 'GRANT FAIL: author set status=published (publish gate bypassable)';
  exception when insufficient_privilege then null; end;
  begin
    update public.workflows set worked_score = 9999 where id = wf;
    raise exception 'GRANT FAIL: author forged worked_score counter';
  exception when insufficient_privilege then null; end;

  update public.workflows set title = 'RLS test draft (edited)' where id = wf;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS FAIL: author updated % rows (expected 1)', n; end if;
  delete from public.workflows where id = wf;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS FAIL: author deleted % rows (expected 1)', n; end if;

  reset role;
  raise notice 'RLS OK: draft private to author; other user + anon denied read/write; status/counters column-locked';
end $$;
