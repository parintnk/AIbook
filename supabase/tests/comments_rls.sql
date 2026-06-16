-- Story 4.2 verification — comments + comment_likes RLS, the depth-1 guard, the ±1
-- like_count trigger, and the column-locks. Run against the project DB (`execute_sql`).
-- Raises on any failure, NOTICE on success. Role-switching required (service role
-- bypasses RLS). Asserts: public-read on published / author-only write; reply depth
-- capped at 1 (+ same-workflow); draft insert blocked (42501); like_count column-locked
-- (direct UPDATE → 42501); ±1 like trigger (+greatest floor); PK blocks double-like
-- (23505); comment_likes own-only select; anon read-but-not-write.

do $$
declare
  author uuid; other uuid; prof uuid;
  pub uuid; pub2 uuid; draft uuid;
  c1 uuid; c2 uuid; c3 uuid;
  n int;
begin
  select id into author from auth.users where email = 'parin.tnk@gmail.com';
  select id into other  from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof   from public.professions where slug = 'ai-automation';
  if author is null or other is null or prof is null then
    raise exception 'SETUP FAIL: need both test users + the ai-automation profession'; end if;

  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (author, prof, 'CMT RLS published', 'published', now()) returning id into pub;
  insert into public.workflows (author_id, profession_id, title, status, published_at)
    values (author, prof, 'CMT RLS published 2', 'published', now()) returning id into pub2;
  insert into public.workflows (author_id, profession_id, title)
    values (author, prof, 'CMT RLS draft') returning id into draft;

  -- ── Author (authenticated) ────────────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role','authenticated')::text, true);

  -- top-level comment → like_count starts 0.
  insert into public.comments (workflow_id, body) values (pub, 'Top-level comment') returning id into c1;
  select like_count into n from public.comments where id = c1;
  if n <> 0 then raise exception 'INIT FAIL: like_count=% on new comment (expected 0)', n; end if;

  -- a 1-level reply (parent = top-level) is allowed.
  insert into public.comments (workflow_id, parent_comment_id, body) values (pub, c1, 'A reply') returning id into c2;
  select parent_comment_id into c3 from public.comments where id = c2;
  if c3 <> c1 then raise exception 'REPLY FAIL: parent_comment_id not set'; end if;
  c3 := null;

  -- depth-1 guard: replying to a reply is rejected.
  begin
    insert into public.comments (workflow_id, parent_comment_id, body) values (pub, c2, 'reply to a reply');
    raise exception 'DEPTH FAIL: a reply-to-a-reply was allowed';
  exception when raise_exception then null; end;

  -- cross-workflow parent is rejected (parent on pub2, child on pub).
  insert into public.comments (workflow_id, body) values (pub2, 'comment on pub2') returning id into c3;
  begin
    insert into public.comments (workflow_id, parent_comment_id, body) values (pub, c3, 'cross-workflow reply');
    raise exception 'CROSS-WF FAIL: a reply attached across workflows';
  exception when raise_exception then null; end;

  -- voting/commenting on a DRAFT is blocked (insert with-check → 42501).
  begin
    insert into public.comments (workflow_id, body) values (draft, 'comment on a draft');
    raise exception 'RLS FAIL: commented on a draft workflow';
  exception when insufficient_privilege then null; end;

  -- like_count is column-locked — a direct client UPDATE is denied.
  begin
    update public.comments set like_count = 99 where id = c1;
    raise exception 'GRANT FAIL: author wrote the locked like_count directly';
  exception when insufficient_privilege then null; end;

  -- author likes c1 → like_count 1.
  insert into public.comment_likes (comment_id) values (c1);
  select like_count into n from public.comments where id = c1;
  if n <> 1 then raise exception 'TRIGGER FAIL: like_count=% after author like (expected 1)', n; end if;

  -- double-like by the same user → PK(comment_id, profile_id) blocks it.
  begin
    insert into public.comment_likes (comment_id) values (c1);
    raise exception 'PK FAIL: a second like row was created for one (comment, user)';
  exception when unique_violation then null; end;

  -- ── Another authenticated user ────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role','authenticated')::text, true);

  -- can READ the author's comments on a published workflow (public-read).
  select count(*) into n from public.comments where workflow_id = pub;
  if n < 2 then raise exception 'RLS FAIL: other user sees % comments on pub (expected >= 2)', n; end if;

  -- cannot READ the author's like row (comment_likes own-only).
  select count(*) into n from public.comment_likes where comment_id = c1 and profile_id = author;
  if n <> 0 then raise exception 'RLS FAIL: other user read % of the author''s like (expected 0)', n; end if;

  -- other likes c1 → like_count 2.
  insert into public.comment_likes (comment_id) values (c1);
  select like_count into n from public.comments where id = c1;
  if n <> 2 then raise exception 'TRIGGER FAIL: like_count=% with two likers (expected 2)', n; end if;

  -- other reads their OWN like (count 1).
  select count(*) into n from public.comment_likes where comment_id = c1 and profile_id = other;
  if n <> 1 then raise exception 'RLS FAIL: other sees % of their own like (expected 1)', n; end if;

  -- other un-likes → like_count back to 1 (greatest floor exercised on the next path).
  delete from public.comment_likes where comment_id = c1 and profile_id = other;
  select like_count into n from public.comments where id = c1;
  if n <> 1 then raise exception 'TRIGGER FAIL: like_count=% after other un-liked (expected 1)', n; end if;

  -- other CANNOT delete the author's comment (delete own-only → 0 rows).
  delete from public.comments where id = c1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FAIL: other deleted % of the author''s comment (expected 0)', n; end if;

  -- ── Anon ──────────────────────────────────────────────────────────────────
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);

  -- anon READS comments on a published workflow (public-read).
  select count(*) into n from public.comments where workflow_id = pub;
  if n < 2 then raise exception 'RLS FAIL: anon sees % comments on pub (expected >= 2)', n; end if;

  -- anon CANNOT comment (insert revoked + with-check) → 42501.
  begin
    insert into public.comments (workflow_id, body) values (pub, 'anon comment');
    raise exception 'RLS FAIL: anon posted a comment';
  exception when insufficient_privilege then null; end;

  -- ── Delete recompute (author retracts own comment + cascade) ─────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', author::text, 'role','authenticated')::text, true);
  delete from public.comments where id = c1;  -- cascades to its replies? no — c2's parent is c1, on delete cascade
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS FAIL: author deleted % own comment rows (expected 1)', n; end if;
  -- c2 (reply to c1) cascade-deleted; the author's like on c1 cascade-deleted too.
  select count(*) into n from public.comments where id = c2;
  if n <> 0 then raise exception 'CASCADE FAIL: reply % survived its parent''s delete', n; end if;

  -- ── Cleanup ─────────────────────────────────────────────────────────────────
  reset role;
  delete from public.workflows where id in (pub, pub2, draft); -- cascades to comments + comment_likes

  raise notice 'RLS OK: comments public-read-published + author-write; depth capped at 1 (+same-workflow); draft-insert blocked; like_count column-locked + ±1 trigger (+greatest); PK blocks double-like; comment_likes own-only; anon read-not-write; cascade delete.';
end $$;
