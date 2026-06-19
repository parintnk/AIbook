"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Tag } from "@/lib/explore";
import { type ProfessionOption, WorkflowForm } from "./workflow-form";

/**
 * The /new "Workflow details" modal — opens immediately so creating a workflow starts
 * by filling the basics (title/summary/profession/tags), then `createDraftAction` drops
 * you straight onto the editor canvas. Dismissing it returns to the drafts list (the
 * silhouette behind it is decorative — there's no draft to edit until you create one).
 */
export function NewWorkflowDialog({
  professions,
  allTags,
}: {
  professions: ProfessionOption[];
  allTags: Tag[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) router.push("/workflows");
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New workflow</DialogTitle>
          <DialogDescription>
            Add the basics — you'll build the recipe on the canvas next.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 pt-1">
          <WorkflowForm professions={professions} allTags={allTags} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
