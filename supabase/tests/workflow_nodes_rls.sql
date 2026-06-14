-- Story 2.2 verification — workflow_nodes RLS + column locks.
-- Run against the project DB (Supabase SQL editor or `execute_sql`). Raises an
-- exception on any failure and is a no-op (NOTICE only) on success. Role-
-- switching is required because the service role bypasses RLS.
--
-- Nodes have no author_id — visibility/ownership is derived from the parent
-- workflow. Asserts: a draft's nodes are visible/writable only by the parent's
-- author; other authenticated users AND anon see 0 and cannot mutate (and cannot
-- attach a node to a draft they don't own); a PUBLISHED workflow's nodes are
-- world-readable (incl. anon); and authenticated users cannot rewrite the
-- service/trigger-owned columns (workflow_id reparent, created_at) — column lock.

do $$
declare
  author uuid;
  other uuid;
  prof uuid;
  wf uuid;        -- author's draft
  pub uuid;       -- a published workflow (anon-read target)
  nid uuid;       -- node in the draft
  pubnode uuid;   -- node in the published workflow
  n int;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';
  select id into other from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof from public.professions where slug = 'ai-automation';
  if author is null or other is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + the ai-automation profession';
  end if;

  -- Seed as the table owner (bypasses RLS/grants): a draft + a published workflow,
  -- and a node in the published one for the anon-read assertion.
  insert into public.workflows (author_id, profession_id, title)
    values (author, prof, 'NODE RLS draft') returning id into wf;
  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (author, prof, 'NODE RLS published', 'published', now()) returning id into pub;
  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (pub, 0, 'ChatGPT', 'p', 'why') returning id into pubnode;

  -- ── Author (authenticated) ────────────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role', 'authenticated')::text, true);

  -- Author can add a node to their own draft (RLS insert with check passes).
  insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
    values (wf, 0, 'ChatGPT', 'a prompt', 'a purpose') returning id into nid;

  select count(*) into n from public.workflow_nodes where id = nid;
  if n <> 1 then raise exception 'RLS FAIL: author sees % draft node rows (expected 1)', n; end if;

  update public.workflow_nodes set prompt = 'edited' where id = nid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS FAIL: author updated % node rows (expected 1)', n; end if;

  -- Column lock: author may NOT reparent the node or forge created_at.
  begin
    update public.workflow_nodes set workflow_id = pub where id = nid;
    raise exception 'GRANT FAIL: author reparented a node (workflow_id writable)';
  exception when insufficient_privilege then null; end;
  begin
    update public.workflow_nodes set created_at = now() where id = nid;
    raise exception 'GRANT FAIL: author forged created_at';
  exception when insufficient_privilege then null; end;

  -- Author can also read the published workflow's node (world-readable).
  select count(*) into n from public.workflow_nodes where id = pubnode;
  if n <> 1 then raise exception 'RLS FAIL: author sees % published node (expected 1)', n; end if;

  -- ── Another authenticated user ────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role', 'authenticated')::text, true);

  select count(*) into n from public.workflow_nodes where id = nid;
  if n <> 0 then raise exception 'RLS FAIL: other user sees % draft node (expected 0)', n; end if;

  update public.workflow_nodes set prompt = 'hacked' where id = nid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FAIL: other user updated % node rows (expected 0)', n; end if;
  delete from public.workflow_nodes where id = nid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FAIL: other user deleted % node rows (expected 0)', n; end if;

  -- Other user cannot attach a node to a draft they don't own (RLS insert check
  -- → 42501). This is the only guard, since workflow_id is grantable on insert.
  begin
    insert into public.workflow_nodes (workflow_id, idx, tool_name, prompt, purpose)
      values (wf, 1, 'X', 'p', 'why');
    raise exception 'RLS FAIL: other user attached a node to a draft they do not own';
  exception when insufficient_privilege then null; end;

  -- Other user CAN read the published workflow's node.
  select count(*) into n from public.workflow_nodes where id = pubnode;
  if n <> 1 then raise exception 'RLS FAIL: other user sees % published node (expected 1)', n; end if;

  -- ── Anon (no session) ─────────────────────────────────────────────────────
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  select count(*) into n from public.workflow_nodes where id = nid;
  if n <> 0 then raise exception 'RLS FAIL: anon sees % draft node (expected 0)', n; end if;
  select count(*) into n from public.workflow_nodes where id = pubnode;
  if n <> 1 then raise exception 'RLS FAIL: anon sees % published node (expected 1)', n; end if;

  -- ── Cleanup ───────────────────────────────────────────────────────────────
  reset role;
  delete from public.workflows where id in (wf, pub); -- cascades to nodes

  raise notice 'RLS OK: nodes inherit parent visibility (draft=author-only, published=world); writes owner-only; cross-draft insert blocked; workflow_id/created_at column-locked';
end $$;
