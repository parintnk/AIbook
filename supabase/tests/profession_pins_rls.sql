-- Story 7.2 + 7.3 verification — profession_pins RLS (public-read / moderator-of-profession write),
-- the pinned_by auto-stamp, the column-lock, UNIQUE(profession_id, workflow_id), PLUS the Story 7.3
-- hardening: the BEFORE INSERT trigger (pin must target a PUBLISHED workflow of the SAME profession),
-- the position >= 0 CHECK, and the narrowed update grant (workflow_id no longer client-updatable).
-- Run against the project DB (`execute_sql`). The founder (parin.tnk@gmail.com) is moderator of every
-- profession (seeded 1.5); grayzoneno.13 is a non-moderator. Cleanup runs even if an assertion raises
-- (7.3 — the inner block's EXCEPTION handler cleans up + re-raises → no PIN RLS residue on failure).
-- NOTE: the trigger raises SQLSTATE P0001 (raise_exception) — the SAME class as a test assertion's
-- `raise exception` — so the two trigger tests use a `blocked` flag (NOT a `when raise_exception`
-- catch, which would swallow the assertion and pass falsely).

do $$
declare
  mod_uid uuid; nonmod_uid uuid; prof uuid; prof_b uuid;
  wf uuid; wf2 uuid; wf_draft uuid; wf_b uuid;
  stamped uuid; anon_count int; blocked boolean;
begin
  select id into mod_uid from auth.users where email = 'parin.tnk@gmail.com';        -- moderator of all
  select id into nonmod_uid from auth.users where email = 'grayzoneno.13@gmail.com';  -- non-moderator
  select id into prof from public.professions where slug = 'ai-automation';
  select id into prof_b from public.professions where slug = 'web-developer';
  if mod_uid is null or nonmod_uid is null or prof is null or prof_b is null then
    raise exception 'SETUP FAIL: need both test users + ai-automation + web-developer'; end if;

  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (mod_uid, prof, 'PIN RLS published', 'published', now()) returning id into wf;
  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (mod_uid, prof, 'PIN RLS published 2', 'published', now()) returning id into wf2;
  insert into public.workflows (author_id, profession_id, title, status)
    values (mod_uid, prof, 'PIN RLS draft', 'draft') returning id into wf_draft;
  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (mod_uid, prof_b, 'PIN RLS other-profession', 'published', now()) returning id into wf_b;

  begin
    -- ── non-moderator CANNOT pin (RLS with-check) ──
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', nonmod_uid::text, 'role','authenticated')::text, true);
    begin
      insert into public.profession_pins (profession_id, workflow_id, position) values (prof, wf, 0);
      raise exception 'RLS FAIL: a non-moderator pinned a workflow';
    exception when insufficient_privilege then null; end;

    -- ── moderator CAN pin; pinned_by auto-stamps to the caller ──
    perform set_config('request.jwt.claims', json_build_object('sub', mod_uid::text, 'role','authenticated')::text, true);
    insert into public.profession_pins (profession_id, workflow_id, position) values (prof, wf, 0);
    select pinned_by into stamped from public.profession_pins where workflow_id = wf and profession_id = prof;
    if stamped is distinct from mod_uid then raise exception 'STAMP FAIL: pinned_by=% expected %', stamped, mod_uid; end if;

    -- ── column-lock: even a moderator cannot SET pinned_by (no insert grant on it) ──
    begin
      insert into public.profession_pins (profession_id, workflow_id, position, pinned_by)
        values (prof, wf2, 1, nonmod_uid);
      raise exception 'COLUMN-LOCK FAIL: set pinned_by explicitly';
    exception when insufficient_privilege then null; end;

    -- ── 7.3 trigger: cannot pin an UNPUBLISHED workflow (generic error → flag, not a catch-and-pass) ──
    blocked := false;
    begin
      insert into public.profession_pins (profession_id, workflow_id, position) values (prof, wf_draft, 5);
    exception when raise_exception then blocked := true; end;
    if not blocked then raise exception 'TRIGGER FAIL: pinned a draft workflow'; end if;

    -- ── 7.3 trigger: cannot pin a workflow that belongs to ANOTHER profession ──
    blocked := false;
    begin
      insert into public.profession_pins (profession_id, workflow_id, position) values (prof, wf_b, 6);
    exception when raise_exception then blocked := true; end;
    if not blocked then raise exception 'TRIGGER FAIL: pinned a cross-profession workflow'; end if;

    -- ── 7.3 CHECK: position must be >= 0 ──
    begin
      insert into public.profession_pins (profession_id, workflow_id, position) values (prof, wf2, -1);
      raise exception 'CHECK FAIL: negative position allowed';
    exception when check_violation then null; end;

    -- ── 7.3 grant: workflow_id is no longer updatable (reorder is position-only; no re-point) ──
    begin
      update public.profession_pins set workflow_id = wf2 where profession_id = prof and workflow_id = wf;
      raise exception 'GRANT FAIL: a moderator re-pointed workflow_id';
    exception when insufficient_privilege then null; end;

    -- ── reorder via position IS allowed (the one remaining update grant) ──
    update public.profession_pins set position = 3 where profession_id = prof and workflow_id = wf;

    -- ── UNIQUE(profession_id, workflow_id) blocks a duplicate pin ──
    begin
      insert into public.profession_pins (profession_id, workflow_id, position) values (prof, wf, 2);
      raise exception 'UNIQUE FAIL: duplicate profession+workflow pin allowed';
    exception when unique_violation then null; end;

    -- ── anon CAN read the pin (public-read) ──
    reset role;
    set local role anon;
    perform set_config('request.jwt.claims', NULL, true);
    select count(*) into anon_count from public.profession_pins where workflow_id = wf;
    if anon_count < 1 then raise exception 'READ FAIL: anon cannot read the pin'; end if;
  exception when others then
    -- cleanup on ANY failure, then re-raise (7.3 — leave no PIN RLS residue on a partial failure)
    reset role;
    perform set_config('request.jwt.claims', NULL, true);
    delete from public.profession_pins where workflow_id in (wf, wf2, wf_draft, wf_b);
    delete from public.workflows where id in (wf, wf2, wf_draft, wf_b);
    raise;
  end;

  -- ── happy-path cleanup (as the table owner) ──
  reset role;
  perform set_config('request.jwt.claims', NULL, true);
  delete from public.profession_pins where workflow_id in (wf, wf2, wf_draft, wf_b);
  delete from public.workflows where id in (wf, wf2, wf_draft, wf_b);
  raise notice 'profession_pins RLS + 7.3 hardening: ALL ASSERTIONS PASSED (non-mod blocked; mod pin + pinned_by stamp; column-lock; trigger blocks draft + cross-profession; position>=0 CHECK; workflow_id not updatable; position reorder ok; UNIQUE; anon read)';
end $$;
