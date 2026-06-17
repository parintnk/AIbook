"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SaveToBoardDialog } from "@/components/boards/save-to-board-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Save action (Story 8.1 / FR4 / UX-DR6). A GHOST button beside the PRIMARY Fork (distinct copy +
 * weight — UX-DR24). Opens the Save-to-board picker; the bookmark fills when this workflow is in
 * ≥1 of the viewer's boards. Signed-out → a "Save" link to sign-in (the save is auth-gated). The
 * dialog reports the aggregate saved-state back via `onSavedChange`; `initialSaved` is the SSR seed
 * (re-synced after a revalidatePath re-render — the JoinButton pattern). Renders on the workflow
 * detail header and the Workflow-of-the-Day hero.
 */
export function SaveButton({
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

  // Reconcile to server truth after a revalidatePath re-render (props change on nav/refresh only).
  useEffect(() => setSaved(initialSaved), [initialSaved]);

  if (!signedIn) {
    return (
      <Link
        href={`/sign-in?next=/workflows/${workflowId}`}
        className={cn(buttonVariants({ variant: "ghost" }), "shrink-0")}
      >
        <Bookmark className="size-4" aria-hidden />
        Save
      </Link>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-pressed={saved}
        className="shrink-0"
      >
        <Bookmark
          className={cn("size-4", saved && "fill-current")}
          aria-hidden
        />
        {saved ? "Saved" : "Save"}
      </Button>
      <SaveToBoardDialog
        workflowId={workflowId}
        open={open}
        onOpenChange={setOpen}
        onSavedChange={setSaved}
      />
    </>
  );
}
