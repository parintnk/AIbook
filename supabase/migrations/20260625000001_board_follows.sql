-- Story 8.2 — Boards management page (FR4 / FR21).
-- Pulls board-FOLLOWING (FR21, the board portion of Epic 9.1) forward: a `board_follows` (board,
-- follower) join + a denormalized boards.follower_count maintained by the LOCK-SAFE ±1 trigger (the
-- board_items_sync_count / comment_likes pattern — a follow is a pure +1/−1 on the locked row, so NO
-- `for update`). A user may follow only a PUBLIC board they do NOT own (RLS insert with-check);
-- follower_id is owned by its default auth.uid() (spoof-proof, column-locked); PK(board_id, follower_id)
-- blocks a double-follow. The management writes (rename / visibility toggle / delete / reorder) need NO
-- new SQL — the 8.1 grants/policies (update(name,is_public), update(sort_order), delete-own) cover them.
-- [Source: epics.md#Story-8.2 + #Story-9.1 (board_follows = FR21); architecture.md (board_follows
--  board_id, follower_id); 20260624000001_boards.sql (±1 trigger + column-lock + exists-through-parent RLS)]

-- ── boards.follower_count (denormalized, ±1 trigger-maintained, client-write-locked) ──
alter table public.boards
  add column if not exists follower_count int not null default 0 check (follower_count >= 0);

-- ── board_follows ─────────────────────────────────────────────────────────────
create table if not exists public.board_follows (
  board_id uuid not null references public.boards (id) on delete cascade,
  -- default auth.uid() (PLAIN call — no subquery in a column default; the column-lock below keeps
  -- the client from spoofing it; a seed insert with no JWT leaves it null → cascade).
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- one follow per (board, follower) — blocks a double-follow.
  primary key (board_id, follower_id)
);
-- "boards I follow" lookup (the Epic 9 feed reads this; cheap to add now).
create index if not exists board_follows_follower_idx on public.board_follows (follower_id);

-- ── follower_count maintenance (±1 — the LOCK-SAFE board_items_sync_count pattern) ──
-- `follower_count = follower_count + 1` re-reads the committed value under the row lock the UPDATE
-- takes → no lost-update WITHOUT an explicit `for update`. security definer (writes the count column
-- the client cannot) + execute revoked from public/anon/authenticated → trigger-internal, no advisor WARN.
create or replace function public.board_follows_sync_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.boards set follower_count = follower_count + 1 where id = new.board_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.boards set follower_count = greatest(follower_count - 1, 0) where id = old.board_id;
    return old;
  end if;
  return null;
end;
$$;
revoke execute on function public.board_follows_sync_count() from public, anon, authenticated;

drop trigger if exists board_follows_count on public.board_follows;
create trigger board_follows_count
  after insert or delete on public.board_follows
  for each row execute procedure public.board_follows_sync_count();

-- ── RLS: board_follows ──────────────────────────────────────────────────────────
-- A user reads only THEIR OWN follow rows (powers "am I following?"; the displayed count is the
-- denormalized boards.follower_count → no follower-list exposure). INSERT: only a PUBLIC board the
-- user does NOT own. DELETE: own. `(select auth.uid())` wrapped → planner caches it (no auth_rls_initplan).
alter table public.board_follows enable row level security;

create policy "board_follows_select_own" on public.board_follows
  for select using (follower_id = (select auth.uid()));
create policy "board_follows_insert_public_not_own" on public.board_follows
  for insert with check (
    follower_id = (select auth.uid())
    and exists (
      select 1 from public.boards b
      where b.id = board_id and b.is_public and b.owner_id <> (select auth.uid())
    )
  );
create policy "board_follows_delete_own" on public.board_follows
  for delete using (follower_id = (select auth.uid()));

-- Column-lock: the client inserts only (board_id); follower_id is owned by its default (auth.uid())
-- → not grantable → spoof-proof; created_at defaults. No update grant (a follow is never edited).
revoke insert, update on public.board_follows from anon, authenticated;
grant insert (board_id) on public.board_follows to authenticated;
