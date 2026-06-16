"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitReportAction } from "@/app/(app)/workflows/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  REPORT_REASONS,
  type ReportReasonValue,
} from "@/lib/validation/report";

/**
 * The report dialog (Story 4.3 / UX-DR18): a single-select reason picker + an optional detail, for
 * a published workflow or a comment. Submit creates a `reports` row (status='open') via the action
 * and confirms "Reported. A moderator will review." Neutral / non-punitive copy. Centered on ≥sm,
 * a full-height bottom Sheet on small screens (the Dialog primitive handles it).
 */
export function ReportDialog({
  targetType,
  targetId,
  open,
  onOpenChange,
}: {
  targetType: "workflow" | "comment";
  targetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState<ReportReasonValue | null>(null);
  const [detail, setDetail] = useState("");
  const [isPending, startTransition] = useTransition();

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setReason(null);
      setDetail("");
    }
  }

  function submit() {
    if (!reason || isPending) return;
    startTransition(async () => {
      const res = await submitReportAction({
        targetType,
        targetId,
        reason,
        detail: detail.trim() || null,
      });
      if (res.ok) {
        toast(
          res.duplicate
            ? "You've already reported this — thanks."
            : "Reported. A moderator will review.",
        );
        close(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Report this {targetType === "workflow" ? "workflow" : "comment"}
          </DialogTitle>
          <DialogDescription>
            Help keep the community trustworthy.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-1.5 px-4" disabled={isPending}>
          <legend className="sr-only">Reason for reporting</legend>
          {REPORT_REASONS.map((r) => (
            <label
              key={r.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                reason === r.value
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <input
                type="radio"
                name="report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="size-4 accent-primary"
              />
              <span className="font-medium">{r.label}</span>
            </label>
          ))}
        </fieldset>

        <div className="px-4">
          <label
            htmlFor="report-detail"
            className="font-medium text-muted-foreground text-sm"
          >
            Add context (optional)
          </label>
          <Textarea
            id="report-detail"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={2000}
            disabled={isPending}
            placeholder="What's wrong with this? A short note helps the moderator."
            className="mt-1.5"
          />
        </div>

        <p className="px-4 text-[12px] text-muted-foreground">
          Most content is auto-checked — reports go to community mods.
        </p>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" disabled={isPending} />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!reason || isPending}
            onClick={submit}
          >
            {isPending ? "Submitting…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
