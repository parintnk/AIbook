-- Story 9.1 — Follow / unfollow users (FR21, the USER half; the board half = board_follows, Story 8.2).
-- A `follows` (follower, following) edge + denormalized profiles.follower_count / following_count
-- maintained by the LOCK-SAFE ±1 trigger (the board_follows_sync_count pattern — a follow is a pure
-- +1/−1 on the locked row, so NO `for update`), but it touches TWO profile rows per follow (the
-- followee's follower_count + the follower's following_count). A user may follow anyone but THEMSELVES
-- (RLS insert with-check + a table CHECK); follower_id is owned by its default auth.uid() (spoof-proof,
-- column-locked); PK(follower_id, following_id) blocks a double-follow. The follow GRAPH is PUBLIC-read
-- (SELECT using(true), like profiles) so a profile's Followers/Following LISTS render for any viewer.
-- This migration ALSO column-locks profiles UPDATE — it was only RLS-row-gated with Supabase's default
-- broad column grants, so an authenticated user could write its OWN follower_count; the grant below
-- restricts client UPDATE to the columns the profile-edit form writes, leaving the counts trigger-only.
-- [Source: epics.md#Story-9.1; architecture.md (follows: follower_id, following_id, PK(both));
--  20260625000001_board_follows.sql (±1 trigger + column-lock + (select auth.uid()) RLS); 20260612000001_profiles.sql]

-- ── profiles.follower_count / following_count (denormalized, ±1 trigger-maintained, client-write-locked) ──
alter table public.profiles
  add column if not exists follower_count int not null default 0 check (follower_count >= 0);
alter table public.profiles
  add column if not exists following_count int not null default 0 check (following_count >= 0);

-- ── profiles UPDATE column-lock (SECURITY) ─────────────────────────────────────
-- profiles was previously gated ONLY by the profiles_update_own ROW policy + Supabase's default broad
-- column grants → a client could `update public.profiles set follower_count = 9999 where id = me`.
-- Grant UPDATE on exactly the columns lib/services/profiles.ts#updateProfile writes; follower_count /
-- following_count (+ id / created_at / updated_at) stay client-unwritable — only the follows_sync_counts
-- SECURITY DEFINER trigger and the set_updated_at BEFORE trigger touch them (a BEFORE trigger setting
-- NEW.updated_at does NOT require the invoker to hold UPDATE on updated_at).
revoke update on public.profiles from anon, authenticated;
grant update (handle, display_name, bio, avatar_url, hire_me_url, hire_me_visible, primary_profession_id)
  on public.profiles to authenticated;

-- ── follows ───────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  -- default auth.uid() (PLAIN call — no subquery in a column default; the column-lock below keeps the
  -- client from spoofing it; a seed insert with no JWT leaves it null → cascade).
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- one follow per (follower, following) — blocks a double-follow.
  primary key (follower_id, following_id),
  -- no self-follow (defense-in-depth alongside the RLS insert with-check).
  constraint follows_no_self check (follower_id <> following_id)
);
-- "who follows X" + the followee-side count/list reads (the PK already covers (follower_id) = "who I follow").
create index if not exists follows_following_idx on public.follows (following_id);

-- ── follower_count / following_count maintenance (±1 — the LOCK-SAFE board_follows_sync_count pattern,
-- but TWO rows per follow). `count = count + 1` re-reads the committed value under the row lock the
-- UPDATE takes → no lost-update WITHOUT `for update`. security definer (writes the count columns the
-- client cannot) + execute revoked from public/anon/authenticated → trigger-internal, no advisor WARN. ──
create or replace function public.follows_sync_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set follower_count = follower_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles set follower_count = greatest(follower_count - 1, 0) where id = old.following_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    return old;
  end if;
  return null;
end;
$$;
revoke execute on function public.follows_sync_counts() from public, anon, authenticated;

drop trigger if exists follows_sync on public.follows;
create trigger follows_sync
  after insert or delete on public.follows
  for each row execute procedure public.follows_sync_counts();

-- ── RLS: follows ──────────────────────────────────────────────────────────────
-- The follow GRAPH is PUBLIC (SELECT using(true), like profiles) so a profile's Followers/Following
-- LISTS render for any viewer + the per-row "am I following?" reads. INSERT: as yourself, never
-- yourself. DELETE: own. `(select auth.uid())` wrapped → planner caches it (no auth_rls_initplan).
alter table public.follows enable row level security;

create policy "follows_select_all" on public.follows
  for select using (true);
create policy "follows_insert_not_self" on public.follows
  for insert with check (
    follower_id = (select auth.uid()) and following_id <> (select auth.uid())
  );
create policy "follows_delete_own" on public.follows
  for delete using (follower_id = (select auth.uid()));

-- Column-lock: the client inserts only (following_id); follower_id is owned by its default (auth.uid())
-- → not grantable → spoof-proof; created_at defaults. No update grant (a follow is never edited).
revoke insert, update on public.follows from anon, authenticated;
grant insert (following_id) on public.follows to authenticated;
