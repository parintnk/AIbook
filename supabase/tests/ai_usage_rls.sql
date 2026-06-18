-- Story 11.1 — ai_usage RLS + consume_ai_quota harness. Run on REMOTE via MCP execute_sql.
-- Transactional intent + self-cleaning. Proves: atomic cap enforcement, per-day independence,
-- own-row SELECT, client writes revoked, authenticated EXECUTE denied (42501). Picks the two oldest
-- real profiles as test subjects; ai_usage is otherwise empty in prod, and the harness deletes its
-- own rows at the end (and on the success path).
do $$
declare
  v_uid uuid;
  v_other uuid;
  r record;
  v_denied boolean;
  v_seen int;
begin
  select id into v_uid from public.profiles order by created_at limit 1;
  select id into v_other from public.profiles where id <> v_uid order by created_at limit 1;

  delete from public.ai_usage where profile_id in (v_uid, v_other) and feature in ('skeleton', 'doctor');

  -- (1) atomic cap enforcement: cap=3 → first 3 allowed, 4th denied, count stays 3.
  for i in 1..3 loop
    select * into r from public.consume_ai_quota(v_uid, 'skeleton', 3);
    if not r.allowed then raise exception 'consume #% should be allowed (under cap)', i; end if;
    if r.used <> i then raise exception 'consume #% should report used=%, got %', i, i, r.used; end if;
  end loop;
  select * into r from public.consume_ai_quota(v_uid, 'skeleton', 3);
  if r.allowed then raise exception 'consume past cap should be denied'; end if;
  if r.used <> 3 or r.quota <> 3 then raise exception 'at cap should report used=3 quota=3, got %/%', r.used, r.quota; end if;

  -- (2) per-feature / per-day independence: a different feature has its own counter.
  select * into r from public.consume_ai_quota(v_uid, 'doctor', 10);
  if not r.allowed or r.used <> 1 then raise exception 'doctor counter should be independent (used=1)'; end if;

  -- (3) authenticated EXECUTE on consume_ai_quota must be denied (service-role-only grant).
  set local role authenticated;
  begin
    perform public.consume_ai_quota(v_uid, 'skeleton', 3);
    v_denied := false;
  exception when insufficient_privilege then
    v_denied := true;
  end;
  reset role;
  if not v_denied then raise exception 'authenticated EXECUTE consume_ai_quota should raise 42501'; end if;

  -- (4) authenticated client write to ai_usage must be denied (insert/update/delete revoked).
  set local role authenticated;
  begin
    insert into public.ai_usage (profile_id, feature, day, count) values (v_uid, 'export', current_date, 1);
    v_denied := false;
  exception when insufficient_privilege then
    v_denied := true;
  end;
  reset role;
  if not v_denied then raise exception 'authenticated INSERT ai_usage should be denied'; end if;

  -- (5) own-row SELECT: as authenticated user v_uid, sees only their own rows (not v_other's).
  insert into public.ai_usage (profile_id, feature, day, count)
    values (v_other, 'skeleton', current_date, 1)
    on conflict (profile_id, feature, day) do update set count = 1;
  set local role authenticated;
  execute format('set local request.jwt.claims = %L', json_build_object('sub', v_uid)::text);
  select count(*) into v_seen from public.ai_usage where feature = 'skeleton';
  reset role;
  reset request.jwt.claims;
  if v_seen <> 1 then raise exception 'authenticated v_uid should see exactly 1 own skeleton row, saw %', v_seen; end if;

  -- cleanup
  delete from public.ai_usage where profile_id in (v_uid, v_other) and feature in ('skeleton', 'doctor', 'export');
  raise notice 'ai_usage_rls: ALL PASS';
end $$;
