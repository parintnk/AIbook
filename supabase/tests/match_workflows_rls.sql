-- Story 10.2 verification — the match_workflows RPC is SERVICE-ROLE-ONLY and PUBLISHED-gated.
-- Asserts: (1) an `authenticated` client CANNOT execute it (EXECUTE revoked → 42501 → stays off the
-- advisor); (2) a DRAFT workflow's embedding NEVER surfaces (the `w.status='published'` re-assertion);
-- (3) the profession filter narrows. Run against the project DB (`execute_sql`); ONE transaction, a
-- RAISE rolls everything back; cleans up its own fixtures. A = founder (parin.tnk), B = the 2nd user.
-- The seed rows are inserted as the privileged harness role (the revoke targets anon/authenticated).

do $$
declare
  a uuid; b uuid; prof uuid; prof2 uuid;
  wf_pub uuid := '88888888-0000-4000-8000-000000000001';
  wf_draft uuid := '88888888-0000-4000-8000-000000000002';
  vec text := '[' || array_to_string(array_fill(0.1::float4, array[1536]), ',') || ']';
  n int; found_pub boolean; found_draft boolean;
begin
  select id into a from auth.users where email = 'parin.tnk@gmail.com';
  select id into b from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof from public.professions where slug = 'ai-automation';
  select id into prof2 from public.professions where slug = 'graphic-designer';
  if a is null or b is null or prof is null or prof2 is null then
    raise exception 'SETUP FAIL: need both users + ai-automation + graphic-designer';
  end if;

  -- a PUBLISHED + a DRAFT workflow in `prof`, both embedded with the same stub vector.
  insert into public.workflows (id, author_id, profession_id, title, summary, status, published_at)
    values (wf_pub, a, prof, 'MW TEST published', 't', 'published', now()),
           (wf_draft, a, prof, 'MW TEST draft', 't', 'draft', null);
  insert into public.workflow_embeddings (workflow_id, embedding, content_hash)
    values (wf_pub, vec::vector, 'h'), (wf_draft, vec::vector, 'h');

  -- ── as B (authenticated): EXECUTE is revoked → 42501 ──────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', b::text, 'role', 'authenticated')::text, true);
  begin
    perform 1 from public.match_workflows(vec::vector, 10, 0, null, null, 0);
    raise exception 'GRANT FAIL: authenticated executed match_workflows';
  exception when insufficient_privilege then null; end;
  reset role;

  -- ── as the privileged role: PUBLISHED-only gate ───────────────────────────────
  select bool_or(workflow_id = wf_pub), bool_or(workflow_id = wf_draft)
    into found_pub, found_draft
    from public.match_workflows(vec::vector, 50, 0, prof, null, 0);
  if not coalesce(found_pub, false) then
    raise exception 'GATE FAIL: the published wf did not match';
  end if;
  if coalesce(found_draft, false) then
    raise exception 'GATE FAIL: a DRAFT embedding surfaced via match_workflows';
  end if;

  -- ── profession filter narrows (prof2 excludes the test wfs) ────────────────────
  select count(*) into n from public.match_workflows(vec::vector, 50, 0, prof2, null, 0)
    where workflow_id in (wf_pub, wf_draft);
  if n <> 0 then
    raise exception 'FILTER FAIL: profession filter did not exclude the test wfs (got %)', n;
  end if;

  delete from public.workflows where id in (wf_pub, wf_draft);  -- cascades the embeddings
  raise notice 'RLS OK: match_workflows — authenticated execute denied (42501), draft embedding never surfaces (published gate), profession filter narrows.';
end $$;
