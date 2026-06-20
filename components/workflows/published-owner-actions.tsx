"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  deletePublishedWorkflowAction,
  unpublishWorkflowAction,
} from "@/app/(app)/workflows/actions";
import { Button } from "@/components/ui/button";

/**
 * Owner controls for a PUBLISHED workflow (the /workflows manager): Unpublish (→ private draft,
 * editable again) + Delete (with a confirm). Both refresh the list. `authorHandle` lets the action
 * revalidate the author's public profile feed too.
 */
export function PublishedOwnerActions({
  id,
  title,
  authorHandle,
}: {
  id: string;
  title: string;
  authorHandle: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onUnpublish() {
    if (
      !window.confirm(
        `Unpublish "${title}"? It becomes a private draft and leaves Explore until you publish again.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await unpublishWorkflowAction(id, authorHandle);
      if (res?.error) toast.error(res.error);
      else toast.success("Moved back to drafts.");
      router.refresh();
    });
  }

  function onDelete() {
    if (
      !window.confirm(
        `Delete "${title}"? This can't be undone. Forks already made will stay, detached.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deletePublishedWorkflowAction(id, authorHandle);
      if (res?.error) toast.error(res.error);
      else toast.success("Workflow deleted.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={onUnpublish}
      >
        Unpublish
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={onDelete}
      >
        Delete
      </Button>
    </div>
  );
}
