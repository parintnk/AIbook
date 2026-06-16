-- Story 4.3 verification — reports RLS (insert-own / moderator-of-profession read+resolve), the
-- before-insert integrity/profession trigger, the resolution-stamp trigger, the column-locks, and
-- the comments mod-hide delta. Run against the project DB (`execute_sql`). Raises on any failure,
-- NOTICE on success. Role-switching required (service role bypasses RLS). The founder
-- (parin.tnk@gmail.com) is the moderator of every profession (seeded in 1.5); grayzoneno.13 is a
-- plain non-moderator (the reporter).

do $$
declare
  author uuid; other uuid; prof uuid;
  pub uuid; draft uuid; cmt uuid; cmt2 uuid;
  rid uuid; pid uuid;
  n int;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';      -- moderator of all
  select id into other  from auth.users where email = 'grayzoneno.13@gmail.com';  -- non-moderator reporter
  select id into prof   from public.professions where slug = 'ai-automation';
  if author is null or other is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + the ai-automation profession'; end if;

  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (author, prof, 'RPT RLS published', 'published', now()) returning id into pub;
  insert into public.workflows (author_id, profession_id, title)
    values (author, prof, 'RPT RLS draft') returning id into draft;
  insert into public.comments (workflow_id, author_id, body)
    values (pub, author, 'a comment') returning id into cmt;
  insert into public.comments (workflow_id, author_id, body)
    values (pub, author, 'another comment') returning id into cmt2;

  -- ── Reporter (a non-moderator) ──────────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role','authenticated')::text, true);

  -- file a report on the published workflow + on a comment (bare insert — reporter can't read back).
  insert into public.reports (target_type, target_id, reason) values ('workflow', pub, 'spam');
  insert into public.reports (target_type, target_id, reason, detail) values ('comment', cmt, 'harassment', 'rude');

  -- a DRAFT target is rejected by the trigger (one generic error → no oracle).
  begin
    insert into public.reports (target_type, target_id, reason) values ('workflow', draft, 'other');
    raise exception 'TARGET FAIL: reported a draft workflow';
  exception when raise_exception then null; end;

  -- a NONEXISTENT target is rejected too.
  begin
    insert into public.reports (target_type, target_id, reason) values ('workflow', gen_random_uuid(), 'other');
    raise exception 'TARGET FAIL: reported a nonexistent workflow';
  exception when raise_exception then null; end;

  -- the partial-unique blocks a 2nd OPEN report on the same target by the same user.
  begin
    insert into public.reports (target_type, target_id, reason) values ('workflow', pub, 'copyright');
    raise exception 'DUP FAIL: a 2nd open report on the same target was allowed';
  exception when unique_violation then null; end;

  -- reporter_id is column-locked — a spoofed reporter_id is denied.
  begin
    insert into public.reports (target_type, target_id, reason, reporter_id) values ('workflow', pub, 'spam', author);
    raise exception 'SPOOF FAIL: set someone else''s reporter_id';
  exception when insufficient_privilege then null; end;

  -- the reporter CANNOT read the queue (mod-only select).
  select count(*) into n from public.reports;
  if n <> 0 then raise exception 'RLS FAIL: reporter read % reports (expected 0)', n; end if;

  -- the reporter CANNOT resolve a report (mod-only update → 0 rows).
  update public.reports set status = 'resolved';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FAIL: reporter resolved % reports (expected 0)', n; end if;

  -- the reporter CANNOT hide a comment (mod-gated update → 0 rows).
  update public.comments set deleted_at = now() where id = cmt2;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FAIL: a non-moderator hid % comments (expected 0)', n; end if;

  -- ── Moderator (the founder, mod of every profession) ────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role','authenticated')::text, true);

  -- the moderator SEES the two open reports.
  select count(*) into n from public.reports where target_id in (pub, cmt) and status = 'open';
  if n <> 2 then raise exception 'RLS FAIL: moderator sees % open reports (expected 2)', n; end if;

  -- the trigger denormalized the right profession_id.
  select profession_id into pid from public.reports where target_type = 'workflow' and target_id = pub limit 1;
  if pid <> prof then raise exception 'TRIGGER FAIL: profession_id=% (expected %)', pid, prof; end if;

  -- resolve the workflow report → the trigger stamps resolved_by + resolved_at.
  select id into rid from public.reports where target_type = 'workflow' and target_id = pub limit 1;
  update public.reports set status = 'resolved', resolution = 'Dismissed' where id = rid;
  select count(*) into n from public.reports
    where id = rid and status = 'resolved' and resolved_by = author and resolved_at is not null;
  if n <> 1 then raise exception 'STAMP FAIL: resolved_by/resolved_at not stamped on resolve'; end if;

  -- resolved_by is column-locked — a direct client write is denied.
  begin
    update public.reports set resolved_by = other where id = rid;
    raise exception 'GRANT FAIL: moderator wrote the locked resolved_by directly';
  exception when insufficient_privilege then null; end;

  -- the moderator CAN hide a reported comment (deleted_at), and ONLY deleted_at.
  update public.comments set deleted_at = now() where id = cmt;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'MOD-HIDE FAIL: moderator hid % comments (expected 1)', n; end if;
  begin
    update public.comments set body = 'hacked' where id = cmt;
    raise exception 'GRANT FAIL: moderator wrote the locked comment body';
  exception when insufficient_privilege then null; end;

  -- after the workflow report is resolved, the reporter may file a NEW one (partial-unique only blocks OPEN).
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role','authenticated')::text, true);
  insert into public.reports (target_type, target_id, reason) values ('workflow', pub, 'not_working');

  -- ── Anon ────────────────────────────────────────────────────────────────────
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  begin
    insert into public.reports (target_type, target_id, reason) values ('workflow', pub, 'spam');
    raise exception 'RLS FAIL: anon filed a report';
  exception when insufficient_privilege then null; end;

  -- ── Cleanup ─────────────────────────────────────────────────────────────────
  reset role;
  delete from public.reports where target_id in (pub, cmt, cmt2); -- no FK on target_id → delete explicitly
  delete from public.workflows where id in (pub, draft);          -- cascades to comments

  raise notice 'RLS OK: reports insert-own (reporter_id locked, no spoof); published-only target trigger (draft/nonexistent rejected) + profession_id denormalized; partial-unique blocks 2nd OPEN (re-report after resolve OK); reporter cannot read/resolve; moderator reads + resolves (resolved_by/at stamped + locked); comment mod-hide (deleted_at only, body locked); non-mod hide denied; anon cannot report.';
end $$;
