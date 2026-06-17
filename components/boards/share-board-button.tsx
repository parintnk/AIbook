"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import styles from "./boards.module.css";

/**
 * Story 8.2 — copy a board's public permalink (`/boards/[id]`). Meaningful for public boards; on a
 * private board the toast nudges to flip it public first.
 */
export function ShareBoardButton({
  boardId,
  isPublic,
}: {
  boardId: string;
  isPublic: boolean;
}) {
  function share() {
    const url = `${window.location.origin}/boards/${boardId}`;
    navigator.clipboard?.writeText(url).then(
      () =>
        toast(
          isPublic
            ? "Board link copied."
            : "Link copied — make the board public so others can open it.",
        ),
      () => toast.error("Couldn't copy the link."),
    );
  }

  return (
    <button
      type="button"
      className={cn(styles.btn, styles.btnGhost)}
      onClick={share}
    >
      <Share2 width={16} height={16} aria-hidden="true" />
      Share
    </button>
  );
}
