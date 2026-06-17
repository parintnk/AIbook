-- Story 8.1 verification — boards + board_items RLS, the ±1 item_count trigger, and the column-locks.
-- Run against the project DB (`execute_sql`). Raises on any failure, NOTICE on success. Role-switching
-- required (service role bypasses RLS). Asserts: owner-only board write + owner_id/item_count
-- column-locked (42501); public-vs-private board read (a 2nd user / anon see only public); board_items
-- insert only by the board OWNER + only a PUBLISHED workflow (draft / cross-user → 42501); ±1
-- item_count trigger (+greatest floor); PK blocks a double-save (23505); board_items read gated
-- through the board's visibility; anon read-public-not-write.

do $$
declare
  author uuid; other uuid; prof uuid;
  pub uuid; draft uuid;
  priv uuid; pubb uuid; otherb uuid;
  n int;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';
  select id into other  from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof   from public.professions where slug = 'ai-automation';
  if author is null or other is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + the ai-automation profession'; end if;

  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (author, prof, 'BRD RLS published', 'published', now()) returning id into pub;
  insert into public.workflows (author_id, profession_id, title)
    values (author, prof, 'BRD RLS draft') returning id into draft;

  -- ── Author (authenticated) ────────────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role','authenticated')::text, true);

  -- create a private + a public board; owner_id auto-stamps to the caller, item_count starts 0.
  insert into public.boards (name) values ('Private board') returning id into priv;
  insert into public.boards (name, is_public) values ('Public board', true) returning id into pubb;

  select count(*) into n from public.boards where id = priv and owner_id = author;
  if n <> 1 then raise exception 'STAMP FAIL: board owner_id not auto-stamped to the caller'; end if;
  select item_count into n from public.boards where id = priv;
  if n <> 0 then raise exception 'INIT FAIL: item_count=% on a new board (expected 0)', n; end if;

  -- owner_id is column-locked — a direct re-assign is denied.
  begin
    update public.boards set owner_id = other where id = priv;
    raise exception 'GRANT FAIL: author re-assigned the locked owner_id directly';
  exception when insufficient_privilege then null; end;

  -- item_count is column-locked — a direct write is denied.
  begin
    update public.boards set item_count = 99 where id = priv;
    raise exception 'GRANT FAIL: author wrote the locked item_count directly';
  exception when insufficient_privilege then null; end;

  -- save the published workflow into the private board → item_count 1 (±1 trigger).
  insert into public.board_items (board_id, workflow_id) values (priv, pub);
  select item_count into n from public.boards where id = priv;
  if n <> 1 then raise exception 'TRIGGER FAIL: item_count=% after save (expected 1)', n; end if;

  -- also save into the public board (so the 2nd user / anon can read a public board's item).
  insert into public.board_items (board_id, workflow_id) values (pubb, pub);

  -- double-save the same (board, workflow) → PK blocks it.
  begin
    insert into public.board_items (board_id, workflow_id) values (priv, pub);
    raise exception 'PK FAIL: a second (board, workflow) row was created';
  exception when unique_violation then null; end;

  -- saving a DRAFT workflow → blocked (insert with-check requires published) → 42501.
  begin
    insert into public.board_items (board_id, workflow_id) values (priv, draft);
    raise exception 'RLS FAIL: saved a draft workflow';
  exception when insufficient_privilege then null; end;

  -- ── Another authenticated user ────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role','authenticated')::text, true);

  -- other creates their own board.
  insert into public.boards (name) values ('Other board') returning id into otherb;

  -- cannot READ the author's PRIVATE board.
  select count(*) into n from public.boards where id = priv;
  if n <> 0 then raise exception 'RLS FAIL: other read the author''s private board (expected 0)'; end if;

  -- CAN read the author's PUBLIC board.
  select count(*) into n from public.boards where id = pubb;
  if n <> 1 then raise exception 'RLS FAIL: other cannot read the author''s public board'; end if;

  -- cannot read the PRIVATE board's items (gated through the board's visibility).
  select count(*) into n from public.board_items where board_id = priv;
  if n <> 0 then raise exception 'RLS FAIL: other read the private board''s items (expected 0)'; end if;

  -- CAN read the PUBLIC board's items.
  select count(*) into n from public.board_items where board_id = pubb;
  if n <> 1 then raise exception 'RLS FAIL: other cannot read the public board''s items (expected 1)'; end if;

  -- cannot insert into the author's board (insert requires the board's owner).
  begin
    insert into public.board_items (board_id, workflow_id) values (priv, pub);
    raise exception 'RLS FAIL: other saved into the author''s board';
  exception when insufficient_privilege then null; end;

  -- ── Author again: cross-user write + remove ─────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role','authenticated')::text, true);

  -- cannot insert into OTHER's board.
  begin
    insert into public.board_items (board_id, workflow_id) values (otherb, pub);
    raise exception 'RLS FAIL: author saved into another user''s board';
  exception when insufficient_privilege then null; end;

  -- remove from the private board → item_count back to 0 (greatest floor exercised).
  delete from public.board_items where board_id = priv and workflow_id = pub;
  select item_count into n from public.boards where id = priv;
  if n <> 0 then raise exception 'TRIGGER FAIL: item_count=% after remove (expected 0)', n; end if;

  -- ── Anon ──────────────────────────────────────────────────────────────────
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);

  -- anon reads a PUBLIC board.
  select count(*) into n from public.boards where id = pubb;
  if n <> 1 then raise exception 'RLS FAIL: anon cannot read a public board'; end if;

  -- anon cannot read a PRIVATE board.
  select count(*) into n from public.boards where id = priv;
  if n <> 0 then raise exception 'RLS FAIL: anon read a private board (expected 0)'; end if;

  -- anon cannot create a board (insert revoked).
  begin
    insert into public.boards (name) values ('anon board');
    raise exception 'RLS FAIL: anon created a board';
  exception when insufficient_privilege then null; end;

  -- ── Cleanup ─────────────────────────────────────────────────────────────────
  reset role;
  delete from public.boards where id in (priv, pubb, otherb);  -- cascades to board_items
  delete from public.workflows where id in (pub, draft);

  raise notice 'RLS OK: boards owner-only write + owner_id/item_count column-locked; public-vs-private read (2nd user + anon); board_items owner-only insert + published-gate (draft/cross-user blocked); ±1 item_count trigger (+greatest); PK blocks double-save; items read gated by board visibility; anon read-public-not-write.';
end $$;
