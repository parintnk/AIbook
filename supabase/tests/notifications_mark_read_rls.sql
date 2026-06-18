-- Story 9.3 verification — notifications MARK-READ. The new client write: a column-locked,
-- recipient-scoped `read_at` UPDATE (migration 20260628000001). Asserts: a recipient marks its OWN
-- notification read; a non-recipient's UPDATE no-ops (RLS USING excludes the row, silently); a write
-- to any column other than read_at is blocked (the column grant). Run against the project DB
-- (`execute_sql`); the whole block is ONE transaction, so a RAISE rolls everything back. On success it
-- cleans up its own fixtures. A = founder (parin.tnk), B = the 2nd user (grayzoneno.13). Seed rows are
-- inserted as the privileged harness role (the revoke targets anon/authenticated only).

do $$
declare
  a uuid; b uuid;
  na uuid := '88888888-0000-4000-8000-000000000001';  -- A's notification
  nb uuid := '88888888-0000-4000-8000-000000000002';  -- B's notification
  n int; ra timestamptz;
begin
  select id into a from auth.users where email = 'parin.tnk@gmail.com';
  select id into b from auth.users where email = 'grayzoneno.13@gmail.com';
  if a is null or b is null then raise exception 'SETUP FAIL: need both prod test users'; end if;

  insert into public.notifications (id, recipient_id, type, actor_id, target_type, target_id, data)
    values (na, a, 'follow', b, 'profile', b, '{}'::jsonb),
           (nb, b, 'follow', a, 'profile', a, '{}'::jsonb);

  -- ── as B ────────────────────────────────────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', b::text, 'role', 'authenticated')::text, true);

  -- B marks its OWN notification read → ok
  update public.notifications set read_at = now() where id = nb;
  select read_at into ra from public.notifications where id = nb;
  if ra is null then raise exception 'MARK-READ FAIL: B could not mark its own notification read'; end if;

  -- B cannot even SEE A's notification (recipient-only SELECT) → its UPDATE can match no row
  select count(*) into n from public.notifications where id = na;
  if n <> 0 then raise exception 'RLS SELECT FAIL: B can see A''s notification (got %)', n; end if;
  update public.notifications set read_at = now() where id = na;  -- silently affects 0 rows

  -- B cannot write a NON-read_at column on its own row (column-lock) → 42501
  begin
    update public.notifications set type = 'comment' where id = nb;
    raise exception 'COLUMN-LOCK FAIL: B wrote a non-read_at column';
  exception when insufficient_privilege then null; end;

  reset role;

  -- A's notification is STILL unread (B's cross-recipient UPDATE was a no-op)
  select read_at into ra from public.notifications where id = na;
  if ra is not null then raise exception 'RLS UPDATE FAIL: B marked A''s notification read'; end if;

  -- ── as A ────────────────────────────────────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  update public.notifications set read_at = now() where id = na;
  reset role;

  select read_at into ra from public.notifications where id = na;
  if ra is null then raise exception 'MARK-READ FAIL: A could not mark its own notification read'; end if;

  delete from public.notifications where id in (na, nb);
  raise notice 'RLS OK: notifications mark-read — own read_at update works (A + B), cross-recipient update no-ops (RLS), non-read_at column write blocked (column-lock).';
end $$;
