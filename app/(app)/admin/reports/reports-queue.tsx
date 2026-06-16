"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compactAgo } from "@/lib/format/relative-time";
import type { ReportView } from "@/lib/services/reports";
import { REPORT_REASONS } from "@/lib/validation/report";
import { removeCommentAction, resolveReportAction } from "./actions";

const REASON_LABEL = new Map<string, string>(
  REPORT_REASONS.map((r) => [r.value, r.label]),
);

/**
 * The reports queue list (Story 4.3, v1 simple). Optimistically removes a report on Resolve /
 * Remove (reverting + toasting on server error), passing the moderator's optional resolution note.
 * Removing a comment resolves ALL open reports on it (the service does), so we drop them all
 * locally too. RLS is the real gate on the actions.
 */
export function ReportsQueue({ reports: initial }: { reports: ReportView[] }) {
  const [reports, setReports] = useState(initial);
  // Per-row resolution note (optional) the moderator can type before Resolve / Remove.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function run(
    optimistic: (rs: ReportView[]) => ReportView[],
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    successMsg: string,
  ) {
    if (isPending) return;
    const snapshot = reports;
    setReports(optimistic);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast(successMsg);
      } else {
        setReports(snapshot);
        toast.error(res.error);
      }
    });
  }

  function resolve(r: ReportView) {
    run(
      (rs) => rs.filter((x) => x.id !== r.id),
      () => resolveReportAction(r.id, notes[r.id]),
      "Report resolved.",
    );
  }

  function removeComment(r: ReportView) {
    run(
      (rs) =>
        rs.filter(
          (x) => !(x.target_type === "comment" && x.target_id === r.target_id),
        ),
      () => removeCommentAction(r.target_id, notes[r.id]),
      "Comment removed.",
    );
  }

  if (reports.length === 0) {
    return (
      <p className="rounded-card border border-border border-dashed p-8 text-center text-muted-foreground text-sm">
        No open reports — the community's healthy.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {reports.map((r) => {
        const targetHref =
          r.target_type === "workflow" ? `/workflows/${r.target_id}` : null;
        return (
          <li
            key={r.id}
            className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-[11px] text-destructive uppercase tracking-wide">
                {REASON_LABEL.get(r.reason) ?? r.reason}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-[11px] text-secondary-foreground capitalize">
                {r.target_type}
              </span>
              {r.professionName ? (
                <span className="text-muted-foreground text-xs">
                  {r.professionName}
                </span>
              ) : null}
              <span className="ml-auto font-mono text-[12px] text-muted-foreground">
                {compactAgo(r.created_at)}
              </span>
            </div>

            <div className="min-w-0">
              {targetHref ? (
                <Link
                  href={targetHref}
                  className="font-medium text-sm hover:underline"
                >
                  {r.targetTitle ?? "Untitled workflow"}
                </Link>
              ) : (
                <p className="text-sm">
                  <span className="text-muted-foreground">
                    Comment on{" "}
                    {r.targetTitle ? (
                      <span className="text-foreground">{r.targetTitle}</span>
                    ) : (
                      "a workflow"
                    )}
                    :
                  </span>{" "}
                  <span className="text-foreground/90 italic">
                    “{r.targetPreview ?? "—"}”
                  </span>
                </p>
              )}
              {r.detail ? (
                <p className="mt-1 text-muted-foreground text-sm">
                  “{r.detail}”
                </p>
              ) : null}
              <p className="mt-1 text-muted-foreground text-xs">
                reported by @{r.reporter?.handle ?? "unknown"}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={notes[r.id] ?? ""}
                onChange={(e) =>
                  setNotes((n) => ({ ...n, [r.id]: e.target.value }))
                }
                placeholder="Resolution note (optional)"
                maxLength={2000}
                disabled={isPending}
                aria-label="Resolution note"
                className="sm:max-w-xs"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => resolve(r)}
                >
                  Resolve
                </Button>
                {r.target_type === "comment" ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => removeComment(r)}
                  >
                    Remove comment
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
