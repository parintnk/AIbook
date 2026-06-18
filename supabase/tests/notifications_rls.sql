-- Story 9.2 verification — notification GENERATION (all 7 events) + the no-self / null-actor guard +
-- the @-mention parse & de-dupe + the worked-transition guard + the RLS (recipient-only SELECT, no
-- client write). Run against the project DB (`execute_sql`); the whole block is ONE transaction, so a
-- RAISE rolls EVERYTHING back (incl. the test workflows). On success it cleans up its own fixtures.
-- A = founder (parin.tnk), B = the 2nd user (grayzoneno.13). Generation is tested as the SERVICE role
-- (the triggers fire regardless of who inserts; actor is derived from NEW.<col>, set explicitly here).

do $$
declare
  a uuid; b uuid; prof uuid; b_handle text; a_handle text;
  wf   uuid := '99999999-0000-4000-8000-000000000001';  -- A's published workflow
  fwf  uuid := '99999999-0000-4000-8000-000000000002';  -- B's fork of wf
  sfwf uuid := '99999999-0000-4000-8000-000000000003';  -- A's self-fork of wf (no notif)
  cmt  uuid := '99999999-0000-4000-8000-00000000000a';  -- B comments on wf
  cmt2 uuid := '99999999-0000-4000-8000-00000000000b';  -- A comments on own wf, @mentions B
  cmt3 uuid := '99999999-0000-4000-8000-00000000000c';  -- B comments on wf, @mentions A (dedupe)
  n int; v_start timestamptz := clock_timestamp();
begin
  select id into a from auth.users where email = 'parin.tnk@gmail.com';
  select id into b from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into prof from public.professions where slug = 'ai-automation';
  if a is null or b is null or prof is null then raise exception 'SETUP FAIL: need both users + ai-automation'; end if;
  select handle into a_handle from public.profiles where id = a;
  select handle into b_handle from public.profiles where id = b;

  insert into public.workflows (id, author_id, profession_id, title, summary, status, published_at)
    values (wf, a, prof, 'NOTIF TEST wf', 'test', 'published', now());

  -- 1. FOLLOW — B follows A → A gets a follow notif (actor B, target = B's profile) --------------------
  insert into public.follows (follower_id, following_id) values (b, a);
  select count(*) into n from public.notifications
    where recipient_id = a and actor_id = b and type = 'follow' and target_type = 'profile' and target_id = b
      and data->>'actor_handle' = b_handle;
  if n <> 1 then raise exception 'FOLLOW gen FAIL (got %)', n; end if;

  -- 2. FORK — B forks A's wf → A gets a fork notif (target = the SOURCE wf) -----------------------------
  insert into public.workflows (id, author_id, profession_id, title, summary, status, parent_id)
    values (fwf, b, prof, 'NOTIF TEST fork', 'test', 'draft', wf);
  select count(*) into n from public.notifications
    where recipient_id = a and actor_id = b and type = 'fork' and target_id = wf
      and (data->>'source_workflow_id') = wf::text and (data->>'fork_id') = fwf::text;
  if n <> 1 then raise exception 'FORK gen FAIL (got %)', n; end if;

  -- no-self: A self-forks wf → NO fork notif (recipient = actor = A) -----------------------------------
  insert into public.workflows (id, author_id, profession_id, title, summary, status, parent_id)
    values (sfwf, a, prof, 'NOTIF TEST self-fork', 'test', 'draft', wf);
  select count(*) into n from public.notifications where type = 'fork' and recipient_id = a and actor_id = a;
  if n <> 0 then raise exception 'NO-SELF FAIL: a self-fork notified the author (got %)', n; end if;

  -- 3. COMMENT — B comments on A's wf → A gets a comment notif (snippet + ids) --------------------------
  insert into public.comments (id, workflow_id, author_id, body) values (cmt, wf, b, 'great workflow!');
  select count(*) into n from public.notifications
    where recipient_id = a and actor_id = b and type = 'comment' and target_type = 'comment' and target_id = cmt
      and data->>'comment_snippet' = 'great workflow!' and (data->>'workflow_id') = wf::text;
  if n <> 1 then raise exception 'COMMENT gen FAIL (got %)', n; end if;

  -- 4. MENTION (positive) + self-comment skip — A comments on OWN wf "@B" → NO comment notif (self),
  --    B gets a MENTION notif ----------------------------------------------------------------------------
  insert into public.comments (id, workflow_id, author_id, body)
    values (cmt2, wf, a, 'ping @' || b_handle || ' take a look');
  select count(*) into n from public.notifications where type = 'comment' and target_id = cmt2;
  if n <> 0 then raise exception 'SELF-COMMENT FAIL: A''s comment on own wf notified (got %)', n; end if;
  select count(*) into n from public.notifications
    where recipient_id = b and actor_id = a and type = 'mention' and target_id = cmt2;
  if n <> 1 then raise exception 'MENTION gen FAIL (got %)', n; end if;

  -- 5. MENTION dedupe — B comments on A's wf mentioning @A → A gets ONE comment, ZERO mention -----------
  insert into public.comments (id, workflow_id, author_id, body)
    values (cmt3, wf, b, 'thanks @' || a_handle || ' !');
  select count(*) into n from public.notifications where recipient_id = a and type = 'comment' and target_id = cmt3;
  if n <> 1 then raise exception 'COMMENT(dedupe-base) FAIL (got %)', n; end if;
  select count(*) into n from public.notifications where recipient_id = a and type = 'mention' and target_id = cmt3;
  if n <> 0 then raise exception 'MENTION DEDUPE FAIL: A got a mention despite being the comment recipient (got %)', n; end if;

  -- 6. FEATURED — A's wf featured by B → A gets a featured notif (future date avoids a UNIQUE clash) ----
  insert into public.daily_featured (feature_date, profession_id, workflow_id, curated_by)
    values ('2099-01-01', prof, wf, b);
  select count(*) into n from public.notifications
    where recipient_id = a and actor_id = b and type = 'featured' and target_id = wf;
  if n <> 1 then raise exception 'FEATURED gen FAIL (got %)', n; end if;

  -- null-actor: a feature with no curator → NO notif --------------------------------------------------
  insert into public.daily_featured (feature_date, profession_id, workflow_id, curated_by)
    values ('2099-01-02', prof, wf, null);
  select count(*) into n from public.notifications where type = 'featured' and target_id = wf and recipient_id = a;
  if n <> 1 then raise exception 'NULL-ACTOR FAIL: a null-curator feature notified (total featured for wf = %)', n; end if;

  -- 7. WORKED — B votes worked on A's wf → A gets a worked notif; a worked→worked edit → NO new notif --
  insert into public.outcome_votes (workflow_id, voter_id, verdict) values (wf, b, 'worked');
  select count(*) into n from public.notifications where recipient_id = a and actor_id = b and type = 'worked' and target_id = wf;
  if n <> 1 then raise exception 'WORKED gen FAIL (got %)', n; end if;
  update public.outcome_votes set verdict = 'worked' where workflow_id = wf and voter_id = b;  -- no transition
  select count(*) into n from public.notifications where recipient_id = a and type = 'worked' and target_id = wf;
  if n <> 1 then raise exception 'WORKED TRANSITION-GUARD FAIL: a worked→worked edit re-notified (got %)', n; end if;

  -- 8. PIN — a mod (B) pins A's published wf → A gets a pin notif --------------------------------------
  insert into public.profession_pins (profession_id, workflow_id, position, pinned_by) values (prof, wf, 99, b);
  select count(*) into n from public.notifications
    where recipient_id = a and actor_id = b and type = 'pin' and target_id = wf and data ? 'community_slug';
  if n <> 1 then raise exception 'PIN gen FAIL (got %)', n; end if;

  -- 9. RLS — recipient-only SELECT + no client INSERT --------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', b::text, 'role', 'authenticated')::text, true);
  -- B sees their OWN notifications (the mention from A) ...
  select count(*) into n from public.notifications where recipient_id = b;
  if n < 1 then raise exception 'RLS FAIL: B cannot read its own notifications'; end if;
  -- ... but NOT A's notifications (recipient-only) ...
  select count(*) into n from public.notifications where recipient_id = a;
  if n <> 0 then raise exception 'RLS FAIL: B can read A''s notifications (got %)', n; end if;
  -- ... and a client cannot forge a notification (insert revoked) ...
  begin
    insert into public.notifications (recipient_id, type, actor_id, target_type, target_id)
      values (b, 'follow', a, 'profile', a);
    raise exception 'GRANT FAIL: a client inserted a notification';
  exception when insufficient_privilege then null; end;
  reset role;

  -- ── Cleanup (net-zero on success; a RAISE above already rolled back) ────────────────────────────────
  delete from public.notifications where created_at >= v_start and recipient_id in (a, b);
  delete from public.follows where follower_id = b and following_id = a;
  delete from public.daily_featured where feature_date in ('2099-01-01', '2099-01-02') and profession_id = prof;
  delete from public.workflows where id in (wf, fwf, sfwf);  -- cascades comments / votes / pins / lineage

  raise notice 'RLS OK: notifications — all 7 events generate (follow/fork/comment/mention/featured/worked/pin), no-self + null-actor skip, @-mention parse + de-dupe, worked-transition guard, recipient-only SELECT, client-insert blocked.';
end $$;
