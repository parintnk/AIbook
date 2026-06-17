"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SaveToBoardDialog } from "@/components/boards/save-to-board-dialog";
import { cn } from "@/lib/utils";
import styles from "./explore.module.css";

/**
 * Story 8.1 — the Save (bookmark) overlay on a feed card. Rendered as a SIBLING of the card's
 * whole-card <Link> (a button inside an <a> is invalid HTML) so a savemark click never navigates.
 * Signed-out → a sign-in link; signed-in → opens the Save-to-board picker, the bookmark filling
 * when the workflow is in ≥1 board. `initialSaved` is the SSR / Load-more seed.
 */
export function CardSaveMark({
  workflowId,
  signedIn,
  initialSaved,
}: {
  workflowId: string;
  signedIn: boolean;
  initialSaved: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(initialSaved);

  // Reconcile to server truth after a revalidate re-render (props change on nav/refresh only).
  useEffect(() => setSaved(initialSaved), [initialSaved]);

  if (!signedIn) {
    return (
      <Link
        href={`/sign-in?next=/workflows/${workflowId}`}
        className={styles.savemark}
        aria-label="Sign in to save"
      >
        <Bookmark width={15} height={15} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(styles.savemark, saved && styles.savemarkOn)}
        aria-pressed={saved}
        aria-label={saved ? "Saved — edit boards" : "Save to board"}
      >
        <Bookmark
          width={15}
          height={15}
          aria-hidden="true"
          fill={saved ? "currentColor" : "none"}
        />
      </button>
      <SaveToBoardDialog
        workflowId={workflowId}
        open={open}
        onOpenChange={setOpen}
        onSavedChange={setSaved}
      />
    </>
  );
}
