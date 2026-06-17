import "server-only";
import { createBoardSchema } from "@/lib/board-schema";
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
