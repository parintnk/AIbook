"use server";

import { revalidatePath } from "next/cache";
import type { WorkflowCardData } from "@/lib/explore";
import {
  type BoardForPicker,
  type BoardSummary,
  createBoard,
  createBoardAndSave,
  deleteBoard,
  followBoard,
  getSavedWorkflowIds,
  listBoardItems,
  listMyBoards,
  listMyBoardsForWorkflow,
  removeFromBoard,
  renameBoard,
  reorderBoardItems,
  saveToBoard,
  setBoardVisibility,
  unfollowBoard,
} from "@/lib/services/boards";

/**
 * Board Server Actions (Story 8.1 / FR4). Auth is enforced in the service (getUser + RLS); these
 * map service Results to friendly copy and revalidate the workflow detail so its SSR "saved" state
 * stays honest on the next visit. The optimistic client owns the immediate visual (the Save icon
 * fill + toast). `/boards` management is Story 8.2 — no page revalidation here.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

export type CreateBoardActionResult =
  | { ok: true; boardId: string }
  | { ok: false; error: string };

/** The picker's checklist — fetched lazily on dialog open (a read via a Server Action, per workflow). */
export async function loadMyBoardsAction(
  workflowId: string,
): Promise<BoardForPicker[]> {
  return listMyBoardsForWorkflow(workflowId);
}

export async function saveToBoardAction(
  boardId: string,
  workflowId: string,
): Promise<ActionResult> {
  const res = await saveToBoard(boardId, workflowId);
  if (res.ok) {
    revalidatePath(`/workflows/${workflowId}`);
    return { ok: true };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to save." };
  return { ok: false, error: "Couldn't save. Please try again." };
}

export async function removeFromBoardAction(
  boardId: string,
  workflowId: string,
): Promise<ActionResult> {
  const res = await removeFromBoard(boardId, workflowId);
  // `not_found` = the item is already gone → the desired end-state ("not in this board") already
  // holds, so the remove is idempotently successful. Treating it as a failure would make the
  // optimistic picker REVERT the removal back to "saved" + re-bump item_count (the code-review MED:
  // an Undo-race / second-tab / double-tap). Only a real error (auth / db) fails.
  if (res.ok || res.error === "not_found") {
    revalidatePath(`/workflows/${workflowId}`);
    return { ok: true };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to save." };
  return { ok: false, error: "Couldn't remove. Please try again." };
}

export async function createBoardAndSaveAction(
  name: string,
  isPublic: boolean,
  workflowId: string,
): Promise<CreateBoardActionResult> {
  const res = await createBoardAndSave(name, isPublic, workflowId);
  if (res.ok) {
    revalidatePath(`/workflows/${workflowId}`);
    return { ok: true, boardId: res.boardId };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to save." };
  if (res.error === "invalid")
    return { ok: false, error: "Enter a board name (1–60 chars)." };
  return { ok: false, error: "Couldn't create the board. Please try again." };
}

// ── Story 8.2 — Boards management page + board-following ──────────────────────

export type LoadBoardItemsResult = { items: WorkflowCardData[]; total: number };
export type LoadBoardsResult = { items: BoardSummary[]; total: number };

/** Management: create a new EMPTY board ("New board" on the management page). */
export async function createBoardAction(
  name: string,
  isPublic: boolean,
): Promise<CreateBoardActionResult> {
  const res = await createBoard(name, isPublic);
  if (res.ok) {
    revalidatePath("/boards");
    return { ok: true, boardId: res.boardId };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to create a board." };
  if (res.error === "invalid")
    return { ok: false, error: "Enter a board name (1–60 chars)." };
  return { ok: false, error: "Couldn't create the board. Please try again." };
}

/** Management: rename a board. */
export async function renameBoardAction(
  boardId: string,
  name: string,
): Promise<ActionResult> {
  const res = await renameBoard(boardId, name);
  if (res.ok) {
    revalidatePath("/boards");
    revalidatePath(`/boards/${boardId}`);
    return { ok: true };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to rename." };
  if (res.error === "invalid")
    return { ok: false, error: "Enter a board name (1–60 chars)." };
  return { ok: false, error: "Couldn't rename. Please try again." };
}

/** Management: toggle a board's public/private flag. */
export async function setBoardVisibilityAction(
  boardId: string,
  isPublic: boolean,
): Promise<ActionResult> {
  const res = await setBoardVisibility(boardId, isPublic);
  if (res.ok) {
    revalidatePath("/boards");
    revalidatePath(`/boards/${boardId}`);
    return { ok: true };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to change visibility." };
  return { ok: false, error: "Couldn't update visibility. Please try again." };
}

/** Management: delete a board (cascade removes its items). `not_found` = already gone → success. */
export async function deleteBoardAction(
  boardId: string,
): Promise<ActionResult> {
  const res = await deleteBoard(boardId);
  if (res.ok || res.error === "not_found") {
    revalidatePath("/boards");
    return { ok: true };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to delete." };
  return { ok: false, error: "Couldn't delete the board. Please try again." };
}

/** Management: persist a board's drag-reorder (workflow ids in their new order). */
export async function reorderBoardItemsAction(
  boardId: string,
  orderedWorkflowIds: string[],
): Promise<ActionResult> {
  const res = await reorderBoardItems(boardId, orderedWorkflowIds);
  if (res.ok) {
    revalidatePath("/boards");
    revalidatePath(`/boards/${boardId}`);
    return { ok: true };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to reorder." };
  return { ok: false, error: "Couldn't save the new order. Please try again." };
}

/** Management: remove an item from a board (the board-grid savemark). Idempotent (not_found → ok). */
export async function removeBoardItemAction(
  boardId: string,
  workflowId: string,
): Promise<ActionResult> {
  const res = await removeFromBoard(boardId, workflowId);
  if (res.ok || res.error === "not_found") {
    revalidatePath("/boards");
    revalidatePath(`/boards/${boardId}`);
    return { ok: true };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to remove." };
  return { ok: false, error: "Couldn't remove. Please try again." };
}

/** Follow a public board (FR21). */
export async function followBoardAction(
  boardId: string,
): Promise<ActionResult> {
  const res = await followBoard(boardId);
  if (res.ok) {
    revalidatePath(`/boards/${boardId}`);
    return { ok: true };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to follow." };
  return { ok: false, error: "Couldn't follow. Please try again." };
}

/** Unfollow a board. `not_found` = already not following → success (idempotent). */
export async function unfollowBoardAction(
  boardId: string,
): Promise<ActionResult> {
  const res = await unfollowBoard(boardId);
  if (res.ok || res.error === "not_found") {
    revalidatePath(`/boards/${boardId}`);
    return { ok: true };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to follow." };
  return { ok: false, error: "Couldn't unfollow. Please try again." };
}

/** Append the next page of a board's items (the items-grid "Load more"). */
export async function loadMoreBoardItemsAction(
  boardId: string,
  offset: number,
): Promise<LoadBoardItemsResult> {
  const res = await listBoardItems(boardId, offset);
  // Thread saved-state into appended cards (the public view's WorkflowCard fill) — the 6.1
  // load-more lesson; anon → empty set → unsaved. The owner grid ignores `saved`.
  const savedIds = await getSavedWorkflowIds(res.items.map((i) => i.id));
  return {
    items: res.items.map((i) => ({ ...i, saved: savedIds.has(i.id) })),
    total: res.total,
  };
}

/** Append the next page of my boards (the switcher's "Load more"). */
export async function loadMoreBoardsAction(
  offset: number,
): Promise<LoadBoardsResult> {
  return listMyBoards(offset);
}
