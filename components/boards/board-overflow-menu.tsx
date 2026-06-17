"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteBoardAction } from "@/app/(app)/boards/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import styles from "./boards.module.css";
import { RenameBoardDialog } from "./rename-board-dialog";

/**
 * Story 8.2 — the per-board ••• overflow menu (owner-only) with Rename + Delete (No13 scope
 * decision Q2). Rename opens the dialog; Delete confirms (warning it removes the board + its N
 * saved items — the cascade) then navigates back to /boards. Delete also clears a stray empty
 * board left by 8.1's non-atomic create.
 */
export function BoardOverflowMenu({
  boardId,
  name,
  itemCount,
}: {
  boardId: string;
  name: string;
  itemCount: number;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (isPending) return;
    const msg =
      itemCount > 0
        ? `Delete "${name}"? This removes the board and its ${itemCount} saved ${itemCount === 1 ? "item" : "items"}. This can't be undone.`
        : `Delete "${name}"? This can't be undone.`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      const res = await deleteBoardAction(boardId);
      if (res.ok) {
        toast(`Deleted "${name}".`);
        router.push("/boards");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Board actions"
              title="Rename or delete"
              className={cn(styles.btn, styles.btnGhost)}
            />
          }
        >
          <DotsIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <Pencil className="size-3.5" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            Delete board
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameBoardDialog
        boardId={boardId}
        currentName={name}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
    </>
  );
}

function DotsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      width={16}
      height={16}
    >
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
