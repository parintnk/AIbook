-- Story 4.1 verification — outcome_votes RLS + the SECURITY DEFINER recompute trigger
-- + the workflows counter column-lock. Run against the project DB (`execute_sql`).
-- Raises on any failure, no-op (NOTICE) on success. Role-switching is required (the
-- service role bypasses RLS).
--
-- Asserts: a voter manages ONLY their own vote (own-only select; UNIQUE blocks a 2nd
-- raw insert); votes are gated to PUBLISHED workflows (draft insert → 42501); the
-- counters are column-locked (a direct UPDATE workflows SET tried_count → 42501); and
-- the recompute trigger keeps workflows.worked/tweaked/failed_count + tried_count
-- (👀 'untried' EXCLUDED) + worked_score (worked + 0.5*tweaked) correct across
-- insert / verdict-change / delete.

do $$
declare
  author uuid;
  other uuid;
  prof uuid;
  pub uuid;       -- a published workflow (votable)
  draft uuid;     -- a draft (NOT votable)
  n int;
  sc numeric;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';
  select id into other from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof from public.professions where slug = 'ai-automation';
  if author is null or other is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + the ai-automation profession';
  end if;

  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (author, prof, 'VOTE RLS published', 'published', now()) returning id into pub;
  insert into public.workflows (author_id, profession_id, title)
    values (author, prof, 'VOTE RLS draft') returning id into draft;

  -- ── Author (authenticated) ────────────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role', 'authenticated')::text, true);

  -- Vote 'worked' → trigger recomputes pub: worked=1, tried=1, score=1.
  insert into public.outcome_votes (workflow_id, verdict) values (pub, 'worked');
  select worked_count into n from public.workflows where id = pub;
  if n <> 1 then raise exception 'TRIGGER FAIL: worked_count=% after worked vote (expected 1)', n; end if;
  select tried_count into n from public.workflows where id = pub;
  if n <> 1 then raise exception 'TRIGGER FAIL: tried_count=% after worked vote (expected 1)', n; end if;
  select worked_score into sc from public.workflows where id = pub;
  if sc <> 1 then raise exception 'TRIGGER FAIL: worked_score=% after worked vote (expected 1)', sc; end if;

  -- Change to 'tweaked' → worked=0, tweaked=1, tried=1, score=0.5 (the v1 weighting).
  update public.outcome_votes set verdict = 'tweaked' where workflow_id = pub and voter_id = author;
  select worked_count into n from public.workflows where id = pub;
  if n <> 0 then raise exception 'TRIGGER FAIL: worked_count=% after change to tweaked (expected 0)', n; end if;
  select tweaked_count into n from public.workflows where id = pub;
  if n <> 1 then raise exception 'TRIGGER FAIL: tweaked_count=% (expected 1)', n; end if;
  select worked_score into sc from public.workflows where id = pub;
  if sc <> 0.5 then raise exception 'TRIGGER FAIL: worked_score=% after tweaked (expected 0.5)', sc; end if;

  -- Change to 'untried' (👀) → EXCLUDED from tried_count + score.
  update public.outcome_votes set verdict = 'untried' where workflow_id = pub and voter_id = author;
  select tried_count into n from public.workflows where id = pub;
  if n <> 0 then raise exception 'TRIGGER FAIL: tried_count=% with only an untried vote (expected 0 — 👀 excluded)', n; end if;
  select worked_score into sc from public.workflows where id = pub;
  if sc <> 0 then raise exception 'TRIGGER FAIL: worked_score=% with only untried (expected 0)', sc; end if;

  -- Back to 'worked' for the cross-user assertions.
  update public.outcome_votes set verdict = 'worked' where workflow_id = pub and voter_id = author;

  -- Voting on a DRAFT is blocked (insert with-check → 42501).
  begin
    insert into public.outcome_votes (workflow_id, verdict) values (draft, 'worked');
    raise exception 'RLS FAIL: voted on a draft workflow';
  exception when insufficient_privilege then null; end;

  -- The counters are column-locked — a direct client UPDATE is denied.
  begin
    update public.workflows set tried_count = 99 where id = pub;
    raise exception 'GRANT FAIL: author wrote the locked tried_count directly';
  exception when insufficient_privilege then null; end;

  -- A second RAW insert (not the upsert path) → UNIQUE(workflow_id, voter_id).
  begin
    insert into public.outcome_votes (workflow_id, verdict) values (pub, 'failed');
    raise exception 'UNIQUE FAIL: a second vote row was created for one (workflow, voter)';
  exception when unique_violation then null; end;

  -- The UPDATE policy re-enforces the published gate (review patch): a vote cannot be
  -- MOVED onto a draft / non-published workflow via UPDATE (mirrors the insert with-check).
  begin
    update public.outcome_votes set workflow_id = draft where workflow_id = pub and voter_id = author;
    raise exception 'RLS FAIL: moved a vote onto a draft workflow via UPDATE';
  exception when insufficient_privilege then null; end;

  -- ── Another authenticated user ────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role', 'authenticated')::text, true);

  -- Cannot read the author's vote (own-only select).
  select count(*) into n from public.outcome_votes where workflow_id = pub and voter_id = author;
  if n <> 0 then raise exception 'RLS FAIL: other user read % of the author''s vote (expected 0)', n; end if;

  -- Other user casts 'failed' → pub now worked=1 (author) + failed=1 (other), tried=2, score=1.
  insert into public.outcome_votes (workflow_id, verdict) values (pub, 'failed');
  select worked_count into n from public.workflows where id = pub;
  if n <> 1 then raise exception 'TRIGGER FAIL: worked_count=% with two voters (expected 1)', n; end if;
  select failed_count into n from public.workflows where id = pub;
  if n <> 1 then raise exception 'TRIGGER FAIL: failed_count=% (expected 1)', n; end if;
  select tried_count into n from public.workflows where id = pub;
  if n <> 2 then raise exception 'TRIGGER FAIL: tried_count=% with two tried voters (expected 2)', n; end if;

  -- Other user reads their OWN vote (count 1).
  select count(*) into n from public.outcome_votes where workflow_id = pub and voter_id = other;
  if n <> 1 then raise exception 'RLS FAIL: other user sees % of their own vote (expected 1)', n; end if;

  -- ── Anon ──────────────────────────────────────────────────────────────────
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  -- Anon reads no individual votes (own-only policy, no uid) but CAN read the public counts.
  select count(*) into n from public.outcome_votes where workflow_id = pub;
  if n <> 0 then raise exception 'RLS FAIL: anon read % vote rows (expected 0)', n; end if;
  select tried_count into n from public.workflows where id = pub;
  if n <> 2 then raise exception 'RLS FAIL: anon sees tried_count=% on the published workflow (expected 2)', n; end if;

  -- ── Delete recompute (author retracts) ──────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role', 'authenticated')::text, true);
  delete from public.outcome_votes where workflow_id = pub and voter_id = author;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS FAIL: author deleted % own vote rows (expected 1)', n; end if;
  select worked_count into n from public.workflows where id = pub;
  if n <> 0 then raise exception 'TRIGGER FAIL: worked_count=% after author retracted (expected 0)', n; end if;
  select tried_count into n from public.workflows where id = pub;
  if n <> 1 then raise exception 'TRIGGER FAIL: tried_count=% after author retracted, other''s failed remains (expected 1)', n; end if;

  -- ── Cleanup ─────────────────────────────────────────────────────────────────
  reset role;
  delete from public.workflows where id in (pub, draft); -- cascades to outcome_votes

  raise notice 'RLS OK: outcome_votes own-only + published-gated; counters column-locked; UNIQUE one-vote; recompute trigger correct across insert/verdict-change/delete (untried excluded, worked+0.5*tweaked).';
end $$;
