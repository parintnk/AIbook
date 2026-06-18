-- Story 9.1 verification — follows RLS, the ±1 TWO-row follower/following counter trigger, the
-- follower_id column-lock, the no-self-follow guard, the PUBLIC follow graph, and the NEW profiles
-- UPDATE column-lock (a client can't write its own counts but the edit form's columns still work).
-- Run against the project DB (`execute_sql`); raises on any failure, NOTICE on success. The whole
-- block is one transaction → a RAISE rolls everything back (incl. the display_name probe). Asserts:
-- a user may follow anyone but themselves (self → 42501/23514); follower_id auto-stamps + can't be
-- spoofed (insert grant = following_id only); PK blocks a double-follow (23505); the 2-row ±1 trigger
-- moves BOTH counts (+greatest floor); SELECT is public (anon reads the edge); profiles.follower_count
-- is client-unwritable while display_name still is; anon cannot follow.

do $$
declare
  author uuid; other uuid;
  before_fc int; before_gc int; n int; who uuid; orig_name text;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';
  select id into other  from auth.users where email = 'grayzoneno.13@gmail.com';
  if author is null or other is null then
    raise exception 'SETUP FAIL: need both test users'; end if;

  -- ── Author session; pre-clean any stray edge from a prior run ────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role','authenticated')::text, true);
  delete from public.follows where follower_id = author and following_id = other;

  select follower_count  into before_fc from public.profiles where id = other;   -- other's followers
  select following_count into before_gc from public.profiles where id = author;  -- author's following

  -- author cannot follow THEMSELVES (RLS with-check following_id<>me + the table CHECK).
  begin
    insert into public.follows (following_id) values (author);
    raise exception 'RLS FAIL: a self-follow was allowed';
  exception when insufficient_privilege or check_violation then null; end;

  -- author follows other → follower_id auto-stamps; other.follower_count +1, author.following_count +1.
  insert into public.follows (following_id) values (other);
  select follower_id into who from public.follows where follower_id = author and following_id = other;
  if who <> author then raise exception 'STAMP FAIL: follower_id not auto-stamped to the caller'; end if;
  select follower_count into n from public.profiles where id = other;
  if n <> before_fc + 1 then raise exception 'TRIGGER FAIL: other.follower_count delta=% (expected +1)', n - before_fc; end if;
  select following_count into n from public.profiles where id = author;
  if n <> before_gc + 1 then raise exception 'TRIGGER FAIL: author.following_count delta=% (expected +1)', n - before_gc; end if;

  -- author cannot write its OWN follower_count (the NEW profiles column-lock) → 42501 …
  begin
    update public.profiles set follower_count = 9999 where id = author;
    raise exception 'GRANT FAIL: a client wrote its own follower_count';
  exception when insufficient_privilege then null; end;
  -- … but a normal display_name UPDATE by the owner still works (the edit form is unaffected).
  select display_name into orig_name from public.profiles where id = author;
  update public.profiles set display_name = '__rls_probe__' where id = author;
  select count(*) into n from public.profiles where id = author and display_name = '__rls_probe__';
  if n <> 1 then raise exception 'GRANT FAIL: the column-lock broke a normal display_name update'; end if;
  update public.profiles set display_name = orig_name where id = author;  -- restore

  -- double-follow → PK blocks it.
  begin
    insert into public.follows (following_id) values (other);
    raise exception 'PK FAIL: a second follow row was created';
  exception when unique_violation then null; end;

  -- ── Other session: cannot spoof follower_id (insert grant = following_id only) ──
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role','authenticated')::text, true);
  begin
    insert into public.follows (follower_id, following_id) values (author, other);
    raise exception 'GRANT FAIL: other set the locked follower_id directly';
  exception when insufficient_privilege then null; end;

  -- ── Anon: the follow GRAPH is PUBLIC (SELECT using(true)) but anon cannot WRITE it ──
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  select count(*) into n from public.follows where follower_id = author and following_id = other;
  if n <> 1 then raise exception 'RLS FAIL: the public follow graph is not anon-readable (got %)', n; end if;
  begin
    insert into public.follows (following_id) values (author);
    raise exception 'RLS FAIL: anon followed a user';
  exception when insufficient_privilege then null; end;

  -- ── Author unfollows → BOTH counts back to baseline (greatest floor) ────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role','authenticated')::text, true);
  delete from public.follows where following_id = other;  -- RLS delete-own
  select follower_count into n from public.profiles where id = other;
  if n <> before_fc then raise exception 'TRIGGER FAIL: other.follower_count=% after unfollow (expected baseline %)', n, before_fc; end if;
  select following_count into n from public.profiles where id = author;
  if n <> before_gc then raise exception 'TRIGGER FAIL: author.following_count=% after unfollow (expected baseline %)', n, before_gc; end if;

  reset role;
  raise notice 'RLS OK: follows — no self-follow (42501/23514); follower_id auto-stamped + spoof-locked; PK blocks double-follow; 2-row ±1 trigger (+greatest); SELECT public (anon reads, cannot write); profiles.follower_count client-unwritable while display_name works; counts return to baseline on unfollow.';
end $$;
