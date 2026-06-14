"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteDraftAction } from "@/app/(app)/workflows/actions";
import { Button } from "@/components/ui/button";

/** Deletes a draft (with a confirm) and refreshes the list. */
export function DeleteDraftButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteDraftAction(id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Draft deleted.");
      }
      // Refresh either way: a "no longer exists" race should still drop the
      // stale row, and a real error re-syncs the list against the server.
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={onDelete}
    >
      {isPending ? "Deleting…" : "Delete"}
    </Button>
  );
}
