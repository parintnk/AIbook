-- Story 6.3 verification — daily_featured RLS (public-read / moderator-of-profession write),
-- the curated_by auto-stamp default, the column-lock, and the UNIQUE(feature_date, profession_id).
-- Run against the project DB (`execute_sql`). Raises on any failure, NOTICE on success.
-- Role-switching required (service role bypasses RLS). The founder (parin.tnk@gmail.com) is the
-- moderator of every profession (seeded in 1.5); grayzoneno.13 is a plain non-moderator. Cleans
-- up its test rows at the end (runs the whole block in one transaction).

do $$
declare
  mod_uid uuid; nonmod_uid uuid; prof uuid; wf uuid;
  stamped uuid; anon_count int;
begin
  select id into mod_uid from auth.users where email = 'parin.tnk@gmail.com';        -- moderator of all
  select id into nonmod_uid from auth.users where email = 'grayzoneno.13@gmail.com';  -- non-moderator
  select id into prof from public.professions where slug = 'ai-automation';
  if mod_uid is null or nonmod_uid is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + ai-automation'; end if;

  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (mod_uid, prof, 'DF RLS published', 'published', now()) returning id into wf;

  -- ── non-moderator CANNOT insert a feature (RLS with-check) ──
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', nonmod_uid::text, 'role','authenticated')::text, true);
  begin
    insert into public.daily_featured (feature_date, profession_id, workflow_id) values (current_date - 1, prof, wf);
    raise exception 'RLS FAIL: a non-moderator inserted a feature';
  exception when insufficient_privilege then null; end;

  -- ── moderator CAN insert; curated_by auto-stamps to the caller ──
  perform set_config('request.jwt.claims', json_build_object('sub', mod_uid::text, 'role','authenticated')::text, true);
  insert into public.daily_featured (feature_date, profession_id, workflow_id) values (current_date - 1, prof, wf);
  select curated_by into stamped from public.daily_featured where workflow_id = wf and feature_date = current_date - 1;
  if stamped is distinct from mod_uid then raise exception 'STAMP FAIL: curated_by=% expected %', stamped, mod_uid; end if;

  -- ── column-lock: even a moderator cannot SET curated_by (no insert grant on it) ──
  begin
    insert into public.daily_featured (feature_date, profession_id, workflow_id, curated_by)
      values (current_date - 2, prof, wf, nonmod_uid);
    raise exception 'COLUMN-LOCK FAIL: set curated_by explicitly';
  exception when insufficient_privilege then null; end;

  -- ── UNIQUE(feature_date, profession_id) blocks a duplicate ──
  begin
    insert into public.daily_featured (feature_date, profession_id, workflow_id) values (current_date - 1, prof, wf);
    raise exception 'UNIQUE FAIL: duplicate feature_date+profession allowed';
  exception when unique_violation then null; end;

  -- ── anon CAN read the feature (public-read) ──
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', NULL, true);
  select count(*) into anon_count from public.daily_featured where workflow_id = wf;
  if anon_count < 1 then raise exception 'READ FAIL: anon cannot read the feature'; end if;

  -- ── cleanup (as the table owner) ──
  reset role;
  perform set_config('request.jwt.claims', NULL, true);
  delete from public.daily_featured where workflow_id = wf;
  delete from public.workflows where id = wf;
  raise notice 'daily_featured RLS: ALL ASSERTIONS PASSED (non-mod blocked, mod insert + curated_by stamp, column-lock, UNIQUE, anon read)';
end $$;
