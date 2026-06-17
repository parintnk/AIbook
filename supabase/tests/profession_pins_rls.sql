-- Story 7.2 verification — profession_pins RLS (public-read / moderator-of-profession write),
-- the pinned_by auto-stamp default, the column-lock, and UNIQUE(profession_id, workflow_id).
-- Run against the project DB (`execute_sql`). Raises on any failure, NOTICE on success.
-- Role-switching required (service role bypasses RLS). The founder (parin.tnk@gmail.com) is the
-- moderator of every profession (seeded in 1.5); grayzoneno.13 is a plain non-moderator. Cleans
-- up its test rows at the end (runs the whole block in one transaction).

do $$
declare
  mod_uid uuid; nonmod_uid uuid; prof uuid; wf uuid; wf2 uuid;
  stamped uuid; anon_count int;
begin
  select id into mod_uid from auth.users where email = 'parin.tnk@gmail.com';        -- moderator of all
  select id into nonmod_uid from auth.users where email = 'grayzoneno.13@gmail.com';  -- non-moderator
  select id into prof from public.professions where slug = 'ai-automation';
  if mod_uid is null or nonmod_uid is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + ai-automation'; end if;

  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (mod_uid, prof, 'PIN RLS published', 'published', now()) returning id into wf;
  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (mod_uid, prof, 'PIN RLS published 2', 'published', now()) returning id into wf2;

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

  -- ── column-lock: even a moderator cannot SET pinned_by (no insert grant on it). wf2 keeps the
  --    row distinct so a FAILED lock would actually insert → the explicit COLUMN-LOCK FAIL raise. ──
  begin
    insert into public.profession_pins (profession_id, workflow_id, position, pinned_by)
      values (prof, wf2, 1, nonmod_uid);
    raise exception 'COLUMN-LOCK FAIL: set pinned_by explicitly';
  exception when insufficient_privilege then null; end;

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

  -- ── cleanup (as the table owner) ──
  reset role;
  perform set_config('request.jwt.claims', NULL, true);
  delete from public.profession_pins where workflow_id in (wf, wf2);
  delete from public.workflows where id in (wf, wf2);
  raise notice 'profession_pins RLS: ALL ASSERTIONS PASSED (non-mod blocked, mod pin + pinned_by stamp, column-lock, UNIQUE, anon read)';
end $$;
