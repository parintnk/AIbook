"use server";

import { revalidatePath } from "next/cache";
import {
  type BoardForPicker,
  createBoardAndSave,
  listMyBoardsForWorkflow,
  removeFromBoard,
  saveToBoard,
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
