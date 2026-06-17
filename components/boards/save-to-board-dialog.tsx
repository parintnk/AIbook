"use client";

import { Globe, Lock, Plus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createBoardAndSaveAction,
  loadMyBoardsAction,
  removeFromBoardAction,
  saveToBoardAction,
} from "@/app/(app)/boards/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createBoardSchema, MAX_BOARD_NAME } from "@/lib/board-schema";
import type { BoardForPicker } from "@/lib/services/boards";
import { cn } from "@/lib/utils";

/**
 * Story 8.1 — the Save-to-board picker (FR4 / UX-DR6). A CONTROLLED Dialog (SaveButton /
 * CardSaveMark own the trigger + the open state + the filled icon). On open it lazily loads my
 * boards (loadMyBoardsAction) and renders a CHECKLIST — a workflow can live in multiple boards
 * (PK(board_id, workflow_id)). Each toggle fires immediately + optimistically (the 4.3
 * reports-queue pattern: revert + toast.error on failure) with an Undo on save. "+ Create new
 * board" creates + saves in one action. The Dialog primitive becomes a full-height Sheet on
 * phones (UX-DR23). `onSavedChange` reports the aggregate "in ≥1 board" state up so the trigger
 * icon fills. A single `isPending` (useTransition) serializes mutations (the 4.2/7.3 in-flight guard).
 */
export function SaveToBoardDialog({
  workflowId,
  open,
  onOpenChange,
  onSavedChange,
}: {
  workflowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSavedChange?: (saved: boolean) => void;
}) {
  const [boards, setBoards] = useState<BoardForPicker[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPublic, setNewPublic] = useState(false);

  // Load my boards each time the dialog opens (lazy, per workflow).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBoards(null);
    loadMyBoardsAction(workflowId).then((rows) => {
      if (!cancelled) setBoards(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, workflowId]);

  // Report "saved in ≥1 board" up so the trigger icon fills.
  // biome-ignore lint/correctness/useExhaustiveDependencies: react to `boards`; onSavedChange is parent-stable.
  useEffect(() => {
    if (boards) onSavedChange?.(boards.some((b) => b.contains));
  }, [boards]);

  function setMembership(
    board: { id: string; name: string },
    shouldContain: boolean,
  ) {
    if (isPending) return; // in-flight guard — serialize mutations (4.2/7.3 lesson)
    setBoards(
      (bs) =>
        bs?.map((b) =>
          b.id === board.id
            ? {
                ...b,
                contains: shouldContain,
                itemCount: Math.max(0, b.itemCount + (shouldContain ? 1 : -1)),
              }
            : b,
        ) ?? null,
    );
    startTransition(async () => {
      const res = shouldContain
        ? await saveToBoardAction(board.id, workflowId)
        : await removeFromBoardAction(board.id, workflowId);
      if (res.ok) {
        if (shouldContain) {
          toast(`Saved to ${board.name}.`, {
            action: {
              label: "Undo",
              onClick: () => setMembership(board, false),
            },
          });
        } else {
          toast(`Removed from ${board.name}.`);
        }
      } else {
        setBoards(
          (bs) =>
            bs?.map((b) =>
              b.id === board.id
                ? {
                    ...b,
                    contains: !shouldContain,
                    itemCount: Math.max(
                      0,
                      b.itemCount + (shouldContain ? -1 : 1),
                    ),
                  }
                : b,
            ) ?? null,
        );
        toast.error(res.error);
      }
    });
  }

  function submitCreate() {
    if (isPending) return;
    const parsed = createBoardSchema.safeParse({
      name: newName,
      isPublic: newPublic,
    });
    if (!parsed.success) {
      toast.error(`Enter a board name (1–${MAX_BOARD_NAME} chars).`);
      return;
    }
    startTransition(async () => {
      const res = await createBoardAndSaveAction(
        parsed.data.name,
        parsed.data.isPublic,
        workflowId,
      );
      if (res.ok) {
        setBoards((bs) => [
          ...(bs ?? []),
          {
            id: res.boardId,
            name: parsed.data.name,
            isPublic: parsed.data.isPublic,
            itemCount: 1,
            contains: true,
          },
        ]);
        toast(`Saved to ${parsed.data.name}.`);
        setCreating(false);
        setNewName("");
        setNewPublic(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save to board</DialogTitle>
          <DialogDescription>
            Bookmark this workflow — no copy, no fork. Pick a board or create
            one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto px-4">
          {boards === null ? (
            <p className="py-6 text-center text-muted-foreground text-sm">
              Loading your boards…
            </p>
          ) : boards.length === 0 && !creating ? (
            <p className="py-6 text-center text-muted-foreground text-sm">
              No boards yet — create your first one below.
            </p>
          ) : (
            boards.map((b) => (
              <label
                key={b.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                  b.contains
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border hover:bg-muted/50",
                  isPending && "pointer-events-none opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={b.contains}
                  onChange={() => setMembership(b, !b.contains)}
                  className="size-4 accent-primary"
                />
                <span className="flex-1 font-medium">{b.name}</span>
                <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                  {b.isPublic ? (
                    <Globe width={12} height={12} aria-hidden="true" />
                  ) : (
                    <Lock width={12} height={12} aria-hidden="true" />
                  )}
                  {b.itemCount}
                </span>
              </label>
            ))
          )}

          {creating ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border border-dashed p-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Board name"
                maxLength={MAX_BOARD_NAME}
                autoFocus
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-sm">
                <input
                  type="checkbox"
                  checked={newPublic}
                  onChange={(e) => setNewPublic(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Make this board public
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={submitCreate}
                  disabled={isPending || newName.trim().length === 0}
                >
                  {isPending ? "Saving…" : "Create & save"}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={isPending}
              className="mt-1 flex items-center gap-2 rounded-xl border border-border border-dashed px-3 py-2.5 text-muted-foreground text-sm transition hover:bg-muted/50 hover:text-foreground"
            >
              <Plus width={15} height={15} aria-hidden="true" />
              Create new board
            </button>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
