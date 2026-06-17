"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { pinWorkflowAction } from "@/app/(app)/communities/[slug]/actions";
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
import type { ProfessionPin } from "@/lib/services/professions";
import { cn } from "@/lib/utils";
import styles from "./community.module.css";

/**
 * Story 7.3 — the mod-only "Pin a workflow" affordance: opens a Dialog with a single-select list of
 * the profession's published workflows (already-pinned excluded) → pins the chosen one to the end of
 * "Start here". Reuses the report-dialog radio-list pattern. Hidden from members (the rail gates this
 * on isModerator — UX-DR21). A re-pin is harmless anyway (UNIQUE → 23505 → idempotent).
 */
export function PinWorkflowDialog({
  professionId,
  pinnable,
  pinnedIds,
}: {
  professionId: string;
  pinnable: ProfessionPin[];
  pinnedIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pinned = new Set(pinnedIds);
  const options = pinnable.filter((w) => !pinned.has(w.id));

  function close(next: boolean) {
    setOpen(next);
    if (!next) setSelected(null);
  }

  function submit() {
    if (!selected || isPending) return;
    startTransition(async () => {
      const res = await pinWorkflowAction(professionId, selected);
      if (res.ok) {
        toast("Pinned to Start here.");
        close(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <button
        type="button"
        className={styles.headBtn}
        onClick={() => setOpen(true)}
      >
        <Plus width={13} height={13} aria-hidden="true" />
        Pin a workflow
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pin a workflow to Start here</DialogTitle>
          <DialogDescription>
            Curate the essential recipes newcomers should try first.
          </DialogDescription>
        </DialogHeader>

        {options.length > 0 ? (
          <fieldset
            className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto px-4"
            disabled={isPending}
          >
            <legend className="sr-only">Choose a workflow to pin</legend>
            {options.map((w) => (
              <label
                key={w.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                  selected === w.id
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="pin-workflow"
                  value={w.id}
                  checked={selected === w.id}
                  onChange={() => setSelected(w.id)}
                  className="size-4 accent-primary"
                />
                <span className="font-medium">{w.title}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="px-4 text-muted-foreground text-sm">
            Every published workflow in this profession is already pinned.
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" disabled={isPending} />}>
            Cancel
          </DialogClose>
          <Button disabled={!selected || isPending} onClick={submit}>
            {isPending ? "Pinning…" : "Pin workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
