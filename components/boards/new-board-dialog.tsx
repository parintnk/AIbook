"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createBoardAction } from "@/app/(app)/boards/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createBoardSchema, MAX_BOARD_NAME } from "@/lib/board-schema";
import styles from "./boards.module.css";

/**
 * Story 8.2 — "New board" (the management page's two entry points: the gradient pill in the
 * heading + the dashed row at the rail's end). Creates an EMPTY board (single atomic insert) then
 * navigates to it (`?board=<id>`). Self-contained trigger + controlled Dialog (→ Sheet on phone).
 */
export function NewBoardButton({
  variant = "header",
}: {
  variant?: "header" | "rail";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (isPending) return;
    const parsed = createBoardSchema.safeParse({ name, isPublic });
    if (!parsed.success) {
      toast.error(`Enter a board name (1–${MAX_BOARD_NAME} chars).`);
      return;
    }
    startTransition(async () => {
      const res = await createBoardAction(
        parsed.data.name,
        parsed.data.isPublic,
      );
      if (res.ok) {
        setOpen(false);
        setName("");
        setIsPublic(false);
        router.push(`/boards?board=${res.boardId}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      {variant === "header" ? (
        <button
          type="button"
          className={styles.newboardbtn}
          onClick={() => setOpen(true)}
        >
          <Plus width={16} height={16} aria-hidden="true" />
          New board
        </button>
      ) : (
        <button
          type="button"
          className={styles.newboardlink}
          onClick={() => setOpen(true)}
        >
          <span className={styles.plus}>
            <Plus width={14} height={14} aria-hidden="true" />
          </span>
          New board
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New board</DialogTitle>
            <DialogDescription>
              A board is a collection of saved workflows. Make it public so
              others can follow it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 px-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Board name"
              maxLength={MAX_BOARD_NAME}
              autoFocus
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-sm">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="size-4 accent-primary"
              />
              Make this board public
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={isPending || name.trim().length === 0}
            >
              {isPending ? "Creating…" : "Create board"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
