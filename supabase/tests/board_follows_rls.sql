-- Story 8.2 verification — board_follows RLS, the ±1 follower_count trigger, the follower_id
-- column-lock, and a re-assert that board management writes stay owner-only. Run against the
-- project DB (`execute_sql`); raises on any failure, NOTICE on success. Role-switching required
-- (service role bypasses RLS). Asserts: a user may follow ONLY a PUBLIC board they do NOT own
-- (own / private → 42501); follower_id auto-stamps + can't be spoofed (insert grant = board_id
-- only); PK blocks a double-follow (23505); ±1 follower_count trigger (+greatest floor); a
-- non-owner cannot rename a board (UPDATE RLS owner-only → 0 rows); anon cannot follow.

do $$
declare
  author uuid; other uuid; prof uuid;
  priv uuid; pubb uuid;
  n int; who uuid;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';
  select id into other  from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof   from public.professions where slug = 'ai-automation';
  if author is null or other is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + the ai-automation profession'; end if;

  -- ── Author creates a public + a private board ───────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role','authenticated')::text, true);
  insert into public.boards (name) values ('BF private') returning id into priv;
  insert into public.boards (name, is_public) values ('BF public', true) returning id into pubb;

  -- author cannot follow their OWN public board (insert with-check: owner_id <> caller).
  begin
    insert into public.board_follows (board_id) values (pubb);
    raise exception 'RLS FAIL: author followed their own board';
  exception when insufficient_privilege then null; end;

  -- ── Another authenticated user ──────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role','authenticated')::text, true);

  -- cannot follow the author's PRIVATE board (with-check requires is_public).
  begin
    insert into public.board_follows (board_id) values (priv);
    raise exception 'RLS FAIL: other followed a private board';
  exception when insufficient_privilege then null; end;

  -- cannot spoof follower_id (the insert grant is board_id only → column denied).
  begin
    insert into public.board_follows (board_id, follower_id) values (pubb, author);
    raise exception 'GRANT FAIL: other set the locked follower_id directly';
  exception when insufficient_privilege then null; end;

  -- CAN follow the author's PUBLIC board → follower_id auto-stamps to other, follower_count → 1.
  insert into public.board_follows (board_id) values (pubb);
  select follower_id into who from public.board_follows where board_id = pubb;
  if who <> other then raise exception 'STAMP FAIL: follower_id not auto-stamped to the caller'; end if;
  select follower_count into n from public.boards where id = pubb;
  if n <> 1 then raise exception 'TRIGGER FAIL: follower_count=% after follow (expected 1)', n; end if;

  -- double-follow → PK blocks it.
  begin
    insert into public.board_follows (board_id) values (pubb);
    raise exception 'PK FAIL: a second follow row was created';
  exception when unique_violation then null; end;

  -- a non-owner cannot rename the board (UPDATE RLS owner-only → 0 rows, name unchanged).
  update public.boards set name = 'hacked' where id = pubb;

  -- ── Author confirms the name is intact ──────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role','authenticated')::text, true);
  select count(*) into n from public.boards where id = pubb and name = 'BF public';
  if n <> 1 then raise exception 'RLS FAIL: a non-owner renamed the board'; end if;

  -- ── Other unfollows → follower_count back to 0 (greatest floor) ──────────────
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role','authenticated')::text, true);
  delete from public.board_follows where board_id = pubb;  -- RLS delete-own
  select follower_count into n from public.boards where id = pubb;
  if n <> 0 then raise exception 'TRIGGER FAIL: follower_count=% after unfollow (expected 0)', n; end if;

  -- ── Anon cannot follow ──────────────────────────────────────────────────────
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  begin
    insert into public.board_follows (board_id) values (pubb);
    raise exception 'RLS FAIL: anon followed a board';
  exception when insufficient_privilege then null; end;

  -- ── Cleanup ─────────────────────────────────────────────────────────────────
  reset role;
  delete from public.boards where id in (priv, pubb);  -- cascades to board_follows

  raise notice 'RLS OK: board_follows — follow only a public board you do not own (own/private → 42501); follower_id auto-stamped + spoof-locked; PK blocks double-follow; ±1 follower_count trigger (+greatest); non-owner cannot rename; anon cannot follow.';
end $$;
