-- Story 9.2 — Notification GENERATION (FR20 / AR12). The WRITE side: a `notifications` table + a
-- shared SECURITY DEFINER `create_notification` helper (no-self / no-null-actor guard) + 7 AFTER-trigger
-- generators that create a row on fork / comment / follow / mention / featured / worked / pin. Each
-- derives the actor from NEW.<col> (NEVER auth.uid() → seed-safe) and denormalizes a render payload into
-- `data jsonb` so Story 9.3's realtime bell renders with zero joins. The bell UI + the Realtime
-- subscription + mark-read (the `read_at` UPDATE grant/policy) are STORY 9.3 — this migration only
-- provisions the table (RLS recipient-only SELECT, trigger-only write) + adds it to the realtime publication.
-- [Source: architecture.md:130 (notifications shape + 7-member type enum + index); epics.md#Story-9.2 (795-809);
--  20260619000001_reports.sql (polymorphic FK-less target idiom); 20260626000001_follows.sql + 20260620000001_workflow_lineage.sql
--  (SECURITY DEFINER trigger + execute-revoke + (select auth.uid()) RLS template)]

-- ── notification_type enum (7 members, verbatim order; idempotent — the profession_role pattern) ──
do $$ begin
  create type public.notification_type as enum
    ('fork', 'comment', 'follow', 'mention', 'featured', 'worked', 'pin');
exception when duplicate_object then null; end $$;

-- ── notifications table ─────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  -- nullable: a system/seed event may have no real actor (the helper skips those).
  actor_id uuid references public.profiles (id) on delete cascade,
  -- polymorphic, FK-LESS (the reports idiom) — the 9.3 bell routes by (target_type, target_id).
  target_type text not null check (target_type in ('workflow', 'comment', 'profile')),
  target_id uuid not null,
  -- denormalized render payload (actor handle/name/avatar + target title/snippet + route ids).
  data jsonb not null default '{}'::jsonb,
  -- null = unread (drives the bell's tint/dot/badge); WRITTEN by Story 9.3's mark-read.
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- The bell's unread-first / newest-first access path.
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, read_at, created_at desc);

-- ── RLS: recipient-only read; NO client write (trigger-only) ──────────────────────
-- The SELECT policy is load-bearing — it gates BOTH REST reads AND the Realtime channel (Supabase
-- enforces RLS on Realtime, so each subscriber receives only its own rows). `(select auth.uid())`
-- wrapped → no auth_rls_initplan. No INSERT/UPDATE/DELETE policy — rows are written ONLY by the
-- SECURITY DEFINER triggers (which bypass RLS as owner). Mark-read (read_at UPDATE) = Story 9.3.
alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (recipient_id = (select auth.uid()));

revoke insert, update, delete on public.notifications from anon, authenticated;

-- ── Realtime: publish the table so Story 9.3's channel fires (publication is currently empty) ──
-- Wrapped (idempotent): ALTER PUBLICATION … ADD TABLE has no IF NOT EXISTS, so a re-apply against a
-- DB that already has the table published raises 42710 — guard it like the enum above.
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

-- ── Shared helper: the single writer; centralizes the no-self + no-null-actor guard ──
-- security definer + execute revoked → trigger-internal only (not callable via /rest/v1/rpc → no
-- authenticated_security_definer_function_executable advisor WARN).
create or replace function public.create_notification(
  p_recipient uuid,
  p_type public.notification_type,
  p_actor uuid,
  p_target_type text,
  p_target_id uuid,
  p_data jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  -- no notification for: a missing recipient, a system/seed row with no actor, or your OWN action.
  if p_recipient is null or p_actor is null or p_recipient = p_actor then
    return;
  end if;
  insert into public.notifications (recipient_id, type, actor_id, target_type, target_id, data)
  values (p_recipient, p_type, p_actor, p_target_type, p_target_id, coalesce(p_data, '{}'::jsonb));
end;
$$;
revoke execute on function public.create_notification(uuid, public.notification_type, uuid, text, uuid, jsonb)
  from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- Part B — the 7 per-event AFTER-trigger generators. Each: security definer search_path='',
-- execute revoked; derives the actor from NEW.<col>; resolves the recipient (the work/comment owner);
-- builds `data`; calls create_notification (which no-ops on self / null-actor). All are ADDITIVE —
-- they coexist with every existing trigger on these tables.
-- ════════════════════════════════════════════════════════════════════════════════

-- ── follow: someone followed you → notify the followee ──
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_handle text; v_name text; v_avatar text;
begin
  select handle, display_name, avatar_url into v_handle, v_name, v_avatar
    from public.profiles where id = new.follower_id;
  perform public.create_notification(
    new.following_id, 'follow', new.follower_id, 'profile', new.follower_id,
    jsonb_build_object('actor_handle', v_handle, 'actor_name', v_name, 'actor_avatar', v_avatar)
  );
  return new;
end;
$$;
revoke execute on function public.notify_on_follow() from public, anon, authenticated;
drop trigger if exists notify_follow on public.follows;
create trigger notify_follow after insert on public.follows
  for each row execute procedure public.notify_on_follow();

-- ── fork: someone forked your workflow → notify the SOURCE (parent) author ──
create or replace function public.notify_on_fork()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recipient uuid; v_title text;
  v_handle text; v_name text; v_avatar text;
begin
  select author_id, title into v_recipient, v_title from public.workflows where id = new.parent_id;
  select handle, display_name, avatar_url into v_handle, v_name, v_avatar
    from public.profiles where id = new.author_id;
  perform public.create_notification(
    v_recipient, 'fork', new.author_id, 'workflow', new.parent_id,
    jsonb_build_object('actor_handle', v_handle, 'actor_name', v_name, 'actor_avatar', v_avatar,
      'source_workflow_title', v_title, 'source_workflow_id', new.parent_id, 'fork_id', new.id)
  );
  return new;
end;
$$;
revoke execute on function public.notify_on_fork() from public, anon, authenticated;
drop trigger if exists notify_fork on public.workflows;
create trigger notify_fork after insert on public.workflows
  for each row when (new.parent_id is not null) execute procedure public.notify_on_fork();

-- ── comment (+ mention): notify the workflow author (or the parent-comment author for a reply),
--    and every @-mentioned user in the body (de-duped vs the actor + the comment recipient) ──
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recipient uuid;
  v_handle text; v_name text; v_avatar text;
  v_mention uuid;
  v_m record;
begin
  select handle, display_name, avatar_url into v_handle, v_name, v_avatar
    from public.profiles where id = new.author_id;

  -- (a) the comment notification: reply → the parent comment's author; else → the workflow author.
  if new.parent_comment_id is not null then
    select author_id into v_recipient from public.comments where id = new.parent_comment_id;
  else
    select author_id into v_recipient from public.workflows where id = new.workflow_id;
  end if;
  perform public.create_notification(
    v_recipient, 'comment', new.author_id, 'comment', new.id,
    jsonb_build_object('actor_handle', v_handle, 'actor_name', v_name, 'actor_avatar', v_avatar,
      'comment_snippet', left(new.body, 140), 'workflow_id', new.workflow_id, 'comment_id', new.id)
  );

  -- (b) mentions: each DISTINCT @handle in the body, skipping the actor + the comment recipient
  --     (so a mentioned thread-owner gets ONE notification, not both a comment AND a mention).
  for v_m in
    select distinct lower(x.arr[1]) as h
    from regexp_matches(new.body, '@([a-z0-9_]{3,30})', 'g') as x(arr)
  loop
    select id into v_mention from public.profiles where handle = v_m.h;
    if v_mention is null or v_mention = new.author_id or v_mention = v_recipient then
      continue;
    end if;
    perform public.create_notification(
      v_mention, 'mention', new.author_id, 'comment', new.id,
      jsonb_build_object('actor_handle', v_handle, 'actor_name', v_name, 'actor_avatar', v_avatar,
        'workflow_id', new.workflow_id, 'comment_id', new.id)
    );
  end loop;
  return new;
end;
$$;
revoke execute on function public.notify_on_comment() from public, anon, authenticated;
drop trigger if exists notify_comment on public.comments;
create trigger notify_comment after insert on public.comments
  for each row execute procedure public.notify_on_comment();

-- ── featured: your workflow is the Workflow of the Day → notify its author (no actor display) ──
create or replace function public.notify_on_featured()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recipient uuid; v_title text;
begin
  select author_id, title into v_recipient, v_title from public.workflows where id = new.workflow_id;
  perform public.create_notification(
    v_recipient, 'featured', new.curated_by, 'workflow', new.workflow_id,
    jsonb_build_object('workflow_title', v_title, 'workflow_id', new.workflow_id)
  );
  return new;
end;
$$;
revoke execute on function public.notify_on_featured() from public, anon, authenticated;
drop trigger if exists notify_featured on public.daily_featured;
create trigger notify_featured after insert on public.daily_featured
  for each row execute procedure public.notify_on_featured();

-- ── worked: someone marked your workflow "worked" → notify its author. Fires on INSERT or the
--    transition-to-worked (skips a worked→worked note edit; outcome_votes is a changeable upsert). ──
create or replace function public.notify_on_worked()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recipient uuid; v_title text;
  v_handle text; v_name text; v_avatar text;
begin
  if tg_op = 'UPDATE' and old.verdict = 'worked' then
    return new;  -- already worked → a note/other-field edit, not a new "worked" event
  end if;
  select author_id, title into v_recipient, v_title from public.workflows where id = new.workflow_id;
  select handle, display_name, avatar_url into v_handle, v_name, v_avatar
    from public.profiles where id = new.voter_id;
  perform public.create_notification(
    v_recipient, 'worked', new.voter_id, 'workflow', new.workflow_id,
    jsonb_build_object('actor_handle', v_handle, 'actor_name', v_name, 'actor_avatar', v_avatar,
      'workflow_title', v_title, 'workflow_id', new.workflow_id)
  );
  return new;
end;
$$;
revoke execute on function public.notify_on_worked() from public, anon, authenticated;
drop trigger if exists notify_worked on public.outcome_votes;
create trigger notify_worked after insert or update on public.outcome_votes
  for each row when (new.verdict = 'worked') execute procedure public.notify_on_worked();

-- ── pin: a moderator pinned your workflow to a community's canon → notify its author ──
create or replace function public.notify_on_pin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recipient uuid; v_title text; v_slug text; v_pname text;
begin
  select author_id, title into v_recipient, v_title from public.workflows where id = new.workflow_id;
  select slug, name into v_slug, v_pname from public.professions where id = new.profession_id;
  perform public.create_notification(
    v_recipient, 'pin', new.pinned_by, 'workflow', new.workflow_id,
    jsonb_build_object('workflow_title', v_title, 'workflow_id', new.workflow_id,
      'community_slug', v_slug, 'community_name', v_pname)
  );
  return new;
end;
$$;
revoke execute on function public.notify_on_pin() from public, anon, authenticated;
drop trigger if exists notify_pin on public.profession_pins;
create trigger notify_pin after insert on public.profession_pins
  for each row execute procedure public.notify_on_pin();
