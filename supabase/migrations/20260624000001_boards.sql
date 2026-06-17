-- Story 8.1 — Save to a Board (FR4 / UX-DR6).
-- A user saves any PUBLISHED workflow into a personal `board` — a lightweight bookmark: NO copy,
-- NO edit, NO lineage (distinct from Fork). `boards` is an owned parent (one user, a name, a
-- public/private flag, a denormalized item_count); `board_items` is the (board, workflow) join.
-- A workflow may live in multiple boards (the picker is a checklist) — PK(board_id, workflow_id)
-- blocks a double-save into one board. item_count is maintained by a ±1 trigger (the LOCK-SAFE
-- comment_likes / sync_member_count pattern — a save is a pure +1/−1 on the locked row, so NO
-- `for update` is needed; contrast 4.1's full count(*) recompute). owner_id/item_count are
-- client-write-locked (column grants): owner_id is owned by its default auth.uid() (spoof-proof),
-- the trigger owns item_count. boards are public-readable when is_public else owner-only; board_items
-- writes are gated through the parent board's owner (the workflow_tags exists-through-parent idiom)
-- and only a PUBLISHED workflow may be saved (the comment_likes published-gate). The /boards
-- management page (switcher/reorder/rename/follow counts/pagination) is Story 8.2 — sort_order +
-- its index + the update(sort_order) grant are created here (AR4) but DORMANT in 8.1.
-- [Source: epics.md#Story-8.1; FR4/AR4/AR5/UX-DR6; 20260618000001_comments.sql (±1 trigger + m2m),
--  20260622000001_profession_pins.sql + 20260621000001_daily_featured.sql (owned-table column-lock),
--  20260617000002_tags.sql (exists-through-parent RLS)]

-- ── boards ──────────────────────────────────────────────────────────────────
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  -- default auth.uid() (PLAIN call — subqueries aren't allowed in a column default; the column-lock
  -- below keeps the client from spoofing it; a seed insert with no JWT leaves it null → cascade).
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  is_public boolean not null default false,
  -- denormalized count of board_items, maintained by the ±1 trigger; client-write-locked.
  item_count int not null default 0 check (item_count >= 0),
  created_at timestamptz not null default now(),
  constraint boards_name_len check (char_length(trim(name)) between 1 and 60)
);
-- "my boards" lookup (owner_id = me).
create index if not exists boards_owner_idx on public.boards (owner_id);

-- ── board_items ───────────────────────────────────────────────────────────────
create table if not exists public.board_items (
  board_id uuid not null references public.boards (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  -- manual order within a board (ascending). DORMANT in 8.1 (defaults 0); Story 8.2 owns reorder.
  sort_order int not null default 0,
  saved_at timestamptz not null default now(),
  -- one save per (board, workflow) — blocks a double-save into the same board.
  primary key (board_id, workflow_id)
);
-- AR4-mandated: the board's items ordered for the 8.2 management page.
create index if not exists board_items_board_sort_idx on public.board_items (board_id, sort_order);

-- ── item_count maintenance (±1 — the LOCK-SAFE comment_likes pattern) ──────────
-- `item_count = item_count + 1` re-reads the committed value under the row lock the UPDATE takes
-- → no lost-update WITHOUT an explicit `for update`. security definer (writes the count column the
-- client cannot) + execute revoked from public/anon/authenticated → trigger-internal, no advisor WARN.
create or replace function public.board_items_sync_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.boards set item_count = item_count + 1 where id = new.board_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.boards set item_count = greatest(item_count - 1, 0) where id = old.board_id;
    return old;
  end if;
  return null;
end;
$$;
revoke execute on function public.board_items_sync_count() from public, anon, authenticated;

drop trigger if exists board_items_count on public.board_items;
create trigger board_items_count
  after insert or delete on public.board_items
  for each row execute procedure public.board_items_sync_count();

-- ── RLS: boards ─────────────────────────────────────────────────────────────
-- Public-readable when is_public (so others can view a public board — Story 8.2/9); else owner-only.
-- Writes are the owner's own. `(select auth.uid())` wrapped → planner caches it (no auth_rls_initplan).
alter table public.boards enable row level security;

create policy "boards_select_visible" on public.boards
  for select using (is_public or owner_id = (select auth.uid()));
create policy "boards_insert_own" on public.boards
  for insert with check (owner_id = (select auth.uid()));
create policy "boards_update_own" on public.boards
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "boards_delete_own" on public.boards
  for delete using (owner_id = (select auth.uid()));

-- Column-lock (the 2.1/7.2 idiom): the client may set only name + is_public. owner_id is owned by
-- its default (auth.uid()) → not grantable → spoof-proof; item_count is trigger-only; id/created_at
-- are defaulted. RLS gates WHO; these grants gate WHICH COLUMNS.
revoke insert, update on public.boards from anon, authenticated;
grant insert (name, is_public) on public.boards to authenticated;
grant update (name, is_public) on public.boards to authenticated;

-- ── RLS: board_items ──────────────────────────────────────────────────────────
-- A board's items are visible when the board itself is visible to the viewer (public OR owner).
-- Writes only by the board's OWNER (ownership lives on the parent boards row — the workflow_tags
-- exists-through-parent idiom), and INSERT additionally requires a PUBLISHED workflow (a draft can
-- never be saved — the comment_likes published-gate; the public Save buttons only target published).
alter table public.board_items enable row level security;

create policy "board_items_select_visible" on public.board_items
  for select using (
    exists (
      select 1 from public.boards b
      where b.id = board_id and (b.is_public or b.owner_id = (select auth.uid()))
    )
  );
create policy "board_items_insert_owner" on public.board_items
  for insert with check (
    exists (select 1 from public.boards b where b.id = board_id and b.owner_id = (select auth.uid()))
    and exists (select 1 from public.workflows w where w.id = workflow_id and w.status = 'published')
  );
create policy "board_items_update_owner" on public.board_items
  for update using (
    exists (select 1 from public.boards b where b.id = board_id and b.owner_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.boards b where b.id = board_id and b.owner_id = (select auth.uid()))
  );
create policy "board_items_delete_owner" on public.board_items
  for delete using (
    exists (select 1 from public.boards b where b.id = board_id and b.owner_id = (select auth.uid()))
  );

-- Column-lock: the client inserts only (board_id, workflow_id); saved_at defaults now(); sort_order
-- defaults 0 (Story 8.2 reorder uses the update(sort_order) grant — DORMANT in 8.1).
revoke insert, update on public.board_items from anon, authenticated;
grant insert (board_id, workflow_id) on public.board_items to authenticated;
grant update (sort_order) on public.board_items to authenticated;
