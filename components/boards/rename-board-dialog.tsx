"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { renameBoardAction } from "@/app/(app)/boards/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MAX_BOARD_NAME, renameBoardSchema } from "@/lib/board-schema";

/**
 * Story 8.2 — rename a board (controlled Dialog opened from the ••• overflow menu). Validates with
 * the shared `renameBoardSchema` at the boundary; on success refreshes the route so the header +
 * rail reflect the new name.
 */
export function RenameBoardDialog({
  boardId,
  currentName,
  open,
  onOpenChange,
}: {
  boardId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [isPending, startTransition] = useTransition();

  // Reset to the current name whenever the dialog (re)opens.
  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  function submit() {
    if (isPending) return;
    const parsed = renameBoardSchema.safeParse({ name });
    if (!parsed.success) {
      toast.error(`Enter a board name (1–${MAX_BOARD_NAME} chars).`);
      return;
    }
    startTransition(async () => {
      const res = await renameBoardAction(boardId, parsed.data.name);
      if (res.ok) {
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename board</DialogTitle>
        </DialogHeader>
        <div className="px-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Board name"
            maxLength={MAX_BOARD_NAME}
            autoFocus
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || name.trim().length === 0}
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
