-- Story 4.2 — Threaded comments (FR19 / UX-DR19) + comment likes.
-- A viewer's threaded discussion on a PUBLISHED workflow: top-level comments + ONE
-- level of replies (depth capped by a trigger). Reads are public (anon incl.) on
-- published workflows; writes are the author's own. `comment_likes` is a per-(comment,
-- user) toggle (PK blocks double-like) that maintains the denormalized `like_count` via
-- a ±1 trigger — the LOCK-SAFE Story 1.5 `sync_member_count` pattern (a like is a pure
-- +1/−1 on the locked row, so NO `for update` lock is needed — contrast Story 4.1's
-- `worked_count`, which needed the lock ONLY because it did a full count(*) recompute).
-- `like_count` + `deleted_at` are client-write-locked (column grants); the like trigger
-- owns `like_count`, and `deleted_at` is provisioned for Story 4.3 moderation (no delete
-- UI in 4.2). Mirrors 20260617000001_outcome_votes.sql + node_outputs RLS/lock idiom.
-- [Source: epics.md#Story-4.2; FR19/UX-DR19/UX-DR17; architecture.md#comments,#comment_likes]

-- ── comments ────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  -- default auth.uid() (plain call — subqueries aren't allowed in defaults; the RLS
  -- with-check pins it, and author_id is NOT grantable on insert → no spoofing).
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- null = top-level; set = a reply. Depth is capped at ONE level by the trigger below.
  parent_comment_id uuid references public.comments (id) on delete cascade,
  body text not null,
  -- denormalized like tally, maintained by the ±1 trigger; client-write-locked.
  like_count int not null default 0 check (like_count >= 0),
  -- soft-delete tombstone — PROVISIONED for Story 4.3 moderation/author-delete; the
  -- viewer renders a "[comment removed]" stub when set. No delete path writes it in 4.2.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_body_len check (char_length(body) between 1 and 2000)
);

-- thread fetch (architecture.md:136) + reply lookup + the "Top" sort.
create index if not exists comments_workflow_created_idx on public.comments (workflow_id, created_at);
create index if not exists comments_parent_idx on public.comments (parent_comment_id);
create index if not exists comments_workflow_top_idx on public.comments (workflow_id, like_count desc, created_at desc);

-- (No set_updated_at trigger: nothing user-facing edits a comment body in 4.2, and the
--  like trigger writing like_count must NOT bump updated_at — that would falsely signal
--  an "edited" comment to any future edited-indicator. updated_at stays = created_at.)

-- ── Depth-1 + same-workflow guard (before insert) ──────────────────────────────
-- A reply may attach ONLY to a top-level comment on the SAME workflow. security definer
-- (reads all comments, bypassing RLS) + execute revoked → trigger-internal.
create or replace function public.enforce_comment_depth()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  parent_parent uuid;
begin
  if new.parent_comment_id is null then
    return new;  -- top-level comment, nothing to check
  end if;
  -- Scope the parent lookup to the SAME workflow as the new reply (the insert RLS
  -- already gates that workflow to published). A parent on any OTHER workflow is treated
  -- as "not found" and yields one generic message — so this definer trigger can't be
  -- used as a cross-RLS oracle to probe whether/what comments exist on a workflow the
  -- caller cannot read. (FOUND is plpgsql's built-in row-returned flag.)
  select c.parent_comment_id into parent_parent
    from public.comments c
    where c.id = new.parent_comment_id and c.workflow_id = new.workflow_id;
  if not found then
    raise exception 'invalid parent comment for this workflow';
  end if;
  if parent_parent is not null then
    raise exception 'replies are one level deep (cannot reply to a reply)';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_comment_depth() from public, anon, authenticated;

drop trigger if exists comments_enforce_depth on public.comments;
create trigger comments_enforce_depth
  before insert on public.comments
  for each row execute procedure public.enforce_comment_depth();

-- ── comment_likes ─────────────────────────────────────────────────────────────
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- one like per (comment, user) — blocks a double-like; also the (comment_id) index.
  primary key (comment_id, profile_id)
);
create index if not exists comment_likes_profile_idx on public.comment_likes (profile_id);

-- ── like_count maintenance (±1 — the LOCK-SAFE sync_member_count pattern) ───────
-- A like is a pure insert/delete (+1/−1); `like_count = like_count + 1` re-reads the
-- committed value under the row lock the UPDATE takes → no lost-update WITHOUT an
-- explicit `for update`. (4.1's full count(*) recompute needed the lock; this does NOT.)
create or replace function public.comment_likes_sync_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
    return old;
  end if;
  return null;
end;
$$;
revoke execute on function public.comment_likes_sync_count() from public, anon, authenticated;

drop trigger if exists comment_likes_count on public.comment_likes;
create trigger comment_likes_count
  after insert or delete on public.comment_likes
  for each row execute procedure public.comment_likes_sync_count();

-- ── RLS: comments ─────────────────────────────────────────────────────────────
-- Public-read on published workflows (anon incl.); author manages their own comment.
alter table public.comments enable row level security;

create policy "comments_select_published" on public.comments
  for select using (
    exists (select 1 from public.workflows w where w.id = workflow_id and w.status = 'published')
  );

create policy "comments_insert_own" on public.comments
  for insert with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.workflows w where w.id = workflow_id and w.status = 'published')
  );

create policy "comments_delete_own" on public.comments
  for delete using (author_id = (select auth.uid()));
-- (No UPDATE policy: body is immutable in 4.2; like_count + deleted_at are written only
--  by the definer trigger / a future mod path — never by the client.)

-- column-lock (mirrors node_outputs_harden): the client may insert ONLY these columns.
-- author_id (defaults auth.uid()), like_count, deleted_at, timestamps → not writable.
-- No update grant at all (no client edit in 4.2). SELECT + DELETE remain table-level,
-- gated by the policies above.
revoke insert, update on public.comments from anon, authenticated;
grant insert (workflow_id, parent_comment_id, body) on public.comments to authenticated;

-- ── RLS: comment_likes ────────────────────────────────────────────────────────
-- Own-only (a user reads/toggles only their OWN like; the public signal is like_count).
alter table public.comment_likes enable row level security;

create policy "comment_likes_select_own" on public.comment_likes
  for select using (profile_id = (select auth.uid()));

create policy "comment_likes_insert_own" on public.comment_likes
  for insert with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.comments c
      join public.workflows w on w.id = c.workflow_id
      where c.id = comment_id and w.status = 'published'
    )
  );

create policy "comment_likes_delete_own" on public.comment_likes
  for delete using (profile_id = (select auth.uid()));
-- (No column-lock needed — RLS scopes writes to the caller's own row; profile_id
--  defaults auth.uid() and the with-check pins it.)
