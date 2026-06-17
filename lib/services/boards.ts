import "server-only";
import {
  boardNameSchema,
  createBoardSchema,
  reorderBoardItemsSchema,
} from "@/lib/board-schema";
import { PAGE_SIZE, type WorkflowCardData } from "@/lib/explore";
import {
  CARD_SELECT,
  type PublishedCardRow,
  resolveThumbs,
  toCardData,
} from "@/lib/services/workflows";
import { createClient } from "@/lib/supabase/server";

/**
 * Boards domain/service layer (DR-1, Story 8.1 / FR4) — the only place board SQL lives.
 * A board is a lightweight bookmark collection owned by one user; `board_items` is the
 * (board, workflow) join. Save = insert a board_item — NO copy / edit / lineage (distinct
 * from Fork). Writes are RLS-bound on the user-session client: `owner_id` defaults to
 * auth.uid() + the column-lock pins it; a `board_items` insert is RLS-gated to the board's
 * owner + a PUBLISHED workflow; `item_count` is maintained by a ±1 trigger (never written
 * here). The /boards management page (switcher/reorder/rename) is Story 8.2.
 */

/** A board for the save-to-board picker: my board + whether it already contains the workflow. */
export type BoardForPicker = {
  id: string;
  name: string;
  isPublic: boolean;
  itemCount: number;
  contains: boolean;
};

export type SaveResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" | "db_error" };
export type RemoveResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" | "not_found" | "db_error" };
export type CreateBoardResult =
  | { ok: true; boardId: string }
  | { ok: false; error: "not_authenticated" | "invalid" | "db_error" };

/**
 * My boards (owner-only, oldest-first) annotated with whether each already contains
 * `workflowId` — the picker's checklist. Returns [] for anon. Two RLS-bound reads: my boards,
 * then ONE `.in("board_id", myIds).eq("workflow_id", …)` membership read. Scoping to MY board
 * ids matters — the board_items SELECT policy also exposes OTHER users' public-board items.
 */
export async function listMyBoardsForWorkflow(
  workflowId: string,
): Promise<BoardForPicker[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: boards } = await supabase
    .from("boards")
    .select("id, name, is_public, item_count")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });
  const rows = boards ?? [];
  if (rows.length === 0) return [];

  const myIds = rows.map((b) => b.id);
  const { data: items } = await supabase
    .from("board_items")
    .select("board_id")
    .in("board_id", myIds)
    .eq("workflow_id", workflowId);
  const containing = new Set((items ?? []).map((i) => i.board_id));

  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    isPublic: b.is_public,
    itemCount: b.item_count,
    contains: containing.has(b.id),
  }));
}

/**
 * The subset of `workflowIds` the caller has saved in ANY of their boards — drives the Save-icon
 * filled state on the detail header / WOTD hero / feed cards. Empty Set for anon or no boards.
 * Scoped to MY board ids (the SELECT policy also exposes other users' public-board items).
 */
export async function getSavedWorkflowIds(
  workflowIds: string[],
): Promise<Set<string>> {
  if (workflowIds.length === 0) return new Set();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data: boards } = await supabase
    .from("boards")
    .select("id")
    .eq("owner_id", user.id);
  const myIds = (boards ?? []).map((b) => b.id);
  if (myIds.length === 0) return new Set();

  const { data: items } = await supabase
    .from("board_items")
    .select("workflow_id")
    .in("board_id", myIds)
    .in("workflow_id", workflowIds);
  return new Set((items ?? []).map((i) => i.workflow_id));
}

/**
 * Save a published workflow into a board. Idempotent (`ON CONFLICT DO NOTHING` so a concurrent
 * double converges to one row — never insert-then-23505→db_error). RLS enforces board-owner +
 * published; the ±1 trigger maintains item_count.
 */
export async function saveToBoard(
  boardId: string,
  workflowId: string,
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("board_items")
    .upsert(
      { board_id: boardId, workflow_id: workflowId },
      { onConflict: "board_id,workflow_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: "db_error" };
  return { ok: true };
}

/** Remove a workflow from a board (the Undo / picker un-check). Zero rows deleted → not_found. */
export async function removeFromBoard(
  boardId: string,
  workflowId: string,
): Promise<RemoveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("board_items")
    .delete()
    .eq("board_id", boardId)
    .eq("workflow_id", workflowId)
    .select("board_id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Create a new board and immediately save the workflow into it — the picker's "+ Create new
 * board" path. Validates the name (Zod). A stray empty board on item-insert failure is acceptable
 * (manageable in Story 8.2). Returns the new board id.
 */
export async function createBoardAndSave(
  name: string,
  isPublic: boolean,
  workflowId: string,
): Promise<CreateBoardResult> {
  const parsed = createBoardSchema.safeParse({ name, isPublic });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: board, error: boardErr } = await supabase
    .from("boards")
    .insert({ name: parsed.data.name, is_public: parsed.data.isPublic })
    .select("id")
    .single();
  if (boardErr || !board) return { ok: false, error: "db_error" };

  const { error: itemErr } = await supabase
    .from("board_items")
    .insert({ board_id: board.id, workflow_id: workflowId });
  if (itemErr) return { ok: false, error: "db_error" };

  return { ok: true, boardId: board.id };
}

// ── Story 8.2 — Boards management (the /boards page) + board-following (FR21) ──

/** Board-list page size for the switcher rail (offset pagination). */
export const BOARDS_PAGE_SIZE = 24;

/** A board in the management switcher / list. */
export type BoardSummary = {
  id: string;
  name: string;
  isPublic: boolean;
  itemCount: number;
  followerCount: number;
  createdAt: string;
  /** Most-recent save into this board (the rail's "updated …"); null when empty. */
  lastSavedAt: string | null;
};

/** A board's detail (header) — adds the owner + the viewer's relationship to it. */
export type BoardDetail = BoardSummary & {
  ownerId: string;
  ownerHandle: string | null;
  isOwner: boolean;
  isFollowing: boolean;
};

export type MutateResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" | "not_found" | "db_error" };
export type RenameResult =
  | { ok: true }
  | {
      ok: false;
      error: "not_authenticated" | "invalid" | "not_found" | "db_error";
    };

/**
 * My boards for the management switcher (owner-only, newest-first, paginated). Scoped to
 * `owner_id = me` — the boards SELECT policy ALSO exposes OTHER users' public boards, so a
 * "my boards" read MUST filter by owner (the getSavedWorkflowIds trap). `lastSavedAt` = the
 * most-recent save per board (one extra `.in()` read over the page's boards). Anon → empty.
 */
export async function listMyBoards(
  offset = 0,
  limit = BOARDS_PAGE_SIZE,
): Promise<{ items: BoardSummary[]; total: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], total: 0 };

  const { data, count } = await supabase
    .from("boards")
    .select("id, name, is_public, item_count, follower_count, created_at", {
      count: "exact",
    })
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  const rows = data ?? [];
  if (rows.length === 0) return { items: [], total: count ?? 0 };

  // Most-recent save per board (the rail's "updated …"). Newest-first → the first row seen per
  // board is its max saved_at. Bounded by the page's boards.
  const ids = rows.map((b) => b.id);
  const { data: saves } = await supabase
    .from("board_items")
    .select("board_id, saved_at")
    .in("board_id", ids)
    .order("saved_at", { ascending: false });
  const lastByBoard = new Map<string, string>();
  for (const s of saves ?? []) {
    if (!lastByBoard.has(s.board_id)) lastByBoard.set(s.board_id, s.saved_at);
  }

  return {
    items: rows.map((b) => ({
      id: b.id,
      name: b.name,
      isPublic: b.is_public,
      itemCount: b.item_count,
      followerCount: b.follower_count,
      createdAt: b.created_at,
      lastSavedAt: lastByBoard.get(b.id) ?? null,
    })),
    total: count ?? rows.length,
  };
}

/**
 * A single board's detail for the header. RLS gates visibility (public OR owner → else no row →
 * `not_found`, which the public `/boards/[id]` route renders as a 404). `isFollowing` is the
 * viewer's own board_follows row (false for anon / owner). `lastSavedAt` = the most-recent save.
 */
export async function getBoard(
  boardId: string,
): Promise<
  { ok: true; board: BoardDetail } | { ok: false; error: "not_found" }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: board } = await supabase
    .from("boards")
    .select(
      "id, name, is_public, item_count, follower_count, created_at, owner_id, owner:profiles!boards_owner_id_fkey(handle)",
    )
    .eq("id", boardId)
    .maybeSingle();
  if (!board) return { ok: false, error: "not_found" };

  const isOwner = user?.id === board.owner_id;
  let isFollowing = false;
  if (user && !isOwner) {
    const { data: follow } = await supabase
      .from("board_follows")
      .select("board_id")
      .eq("board_id", boardId)
      .eq("follower_id", user.id)
      .maybeSingle();
    isFollowing = Boolean(follow);
  }

  const { data: lastSave } = await supabase
    .from("board_items")
    .select("saved_at")
    .eq("board_id", boardId)
    .order("saved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const owner = board.owner as { handle: string } | null;
  return {
    ok: true,
    board: {
      id: board.id,
      name: board.name,
      isPublic: board.is_public,
      itemCount: board.item_count,
      followerCount: board.follower_count,
      createdAt: board.created_at,
      lastSavedAt: lastSave?.saved_at ?? null,
      ownerId: board.owner_id,
      ownerHandle: owner?.handle ?? null,
      isOwner,
      isFollowing,
    },
  };
}

/**
 * A board's saved workflows as feed cards, ordered by `sort_order` (the reorder column) then
 * `saved_at`, paginated. `workflows!inner status='published'` (+ a JS re-filter) skips a since-
 * unpublished/deleted save (never a broken card — the listProfessionPins defense). RLS gates the
 * board's visibility. Reuses CARD_SELECT / toCardData / resolveThumbs.
 */
export async function listBoardItems(
  boardId: string,
  offset = 0,
  limit = PAGE_SIZE,
): Promise<{ items: WorkflowCardData[]; total: number }> {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("board_items")
    .select(
      `sort_order, saved_at, workflow:workflows!board_items_workflow_id_fkey!inner(${CARD_SELECT})`,
      { count: "exact" },
    )
    .eq("board_id", boardId)
    .eq("workflow.status", "published")
    .order("sort_order", { ascending: true })
    .order("saved_at", { ascending: true })
    .range(offset, offset + limit - 1);

  const rows = (data ?? []) as Array<{ workflow: PublishedCardRow | null }>;
  const cards = rows
    .map((r) => r.workflow)
    .filter((w): w is PublishedCardRow => w != null);
  const thumbs = await resolveThumbs(
    supabase,
    cards.map((w) => w.id),
  );
  return {
    items: cards.map((w) =>
      toCardData(w, thumbs.get(w.id) ?? { kind: null, url: null }),
    ),
    total: count ?? cards.length,
  };
}

/** Create a new (empty) board — the management page's "New board". Atomic single insert. */
export async function createBoard(
  name: string,
  isPublic: boolean,
): Promise<CreateBoardResult> {
  const parsed = createBoardSchema.safeParse({ name, isPublic });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: board, error } = await supabase
    .from("boards")
    .insert({ name: parsed.data.name, is_public: parsed.data.isPublic })
    .select("id")
    .single();
  if (error || !board) return { ok: false, error: "db_error" };
  return { ok: true, boardId: board.id };
}

/** Rename a board (owner-only via RLS + the update(name) grant). Zero rows → not_found. */
export async function renameBoard(
  boardId: string,
  name: string,
): Promise<RenameResult> {
  const parsed = boardNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("boards")
    .update({ name: parsed.data })
    .eq("id", boardId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

/** Toggle a board's public/private flag (owner-only via RLS + the update(is_public) grant). */
export async function setBoardVisibility(
  boardId: string,
  isPublic: boolean,
): Promise<MutateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("boards")
    .update({ is_public: isPublic })
    .eq("id", boardId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Delete a board (owner-only via RLS). Cascade drops its board_items (the −1 item_count trigger
 * fires per row). Zero rows → not_found (idempotent). Also clears a stray empty board from 8.1.
 */
export async function deleteBoard(boardId: string): Promise<MutateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("boards")
    .delete()
    .eq("id", boardId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Persist a board's item order: each workflow's new `sort_order` = its index in
 * `orderedWorkflowIds`. Clone of reorderPins — sequential per-row updates (a board is small; no
 * RPC); the update(sort_order) grant + owner RLS gate each. Never touches item_count (reorder is
 * count-invariant).
 */
export async function reorderBoardItems(
  boardId: string,
  orderedWorkflowIds: string[],
): Promise<MutateResult> {
  // Reject a malformed payload (non-UUID ids) rather than silently no-op'ing per row.
  if (!reorderBoardItemsSchema.safeParse(orderedWorkflowIds).success)
    return { ok: false, error: "db_error" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  for (let i = 0; i < orderedWorkflowIds.length; i++) {
    const { error } = await supabase
      .from("board_items")
      .update({ sort_order: i })
      .eq("board_id", boardId)
      .eq("workflow_id", orderedWorkflowIds[i] as string);
    if (error) return { ok: false, error: "db_error" };
  }
  return { ok: true };
}

/**
 * Follow a public board (FR21). Idempotent upsert (ON CONFLICT DO NOTHING — a concurrent double
 * converges to one row). `follower_id` is auto-stamped (default auth.uid()); RLS enforces
 * public + not-own (a private / own board → RLS reject → db_error, never a false follow). The ±1
 * trigger maintains follower_count.
 */
export async function followBoard(boardId: string): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("board_follows")
    .upsert(
      { board_id: boardId },
      { onConflict: "board_id,follower_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: "db_error" };
  return { ok: true };
}

/** Unfollow a board (delete the viewer's own follow row). Zero rows → not_found (idempotent). */
export async function unfollowBoard(boardId: string): Promise<RemoveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("board_follows")
    .delete()
    .eq("board_id", boardId)
    .eq("follower_id", user.id)
    .select("board_id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}
