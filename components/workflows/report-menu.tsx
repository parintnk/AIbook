"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ReportDialog } from "./report-dialog";

/**
 * The ••• overflow → "Report" entry point (Story 4.3 / UX-DR18), shared by the workflow detail
 * header and each comment row. Opens the report dialog for the given target. Only rendered for
 * signed-in users (reporting is gated behind sign-in, matching Like/Reply).
 */
export function ReportMenu({
  targetType,
  targetId,
  disabled = false,
  className,
}: {
  targetType: "workflow" | "comment";
  targetId: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <button
              type="button"
              aria-label="More actions"
              title="More — report"
              className={cn(
                "inline-flex items-center rounded-md px-1 text-muted-foreground transition hover:text-foreground disabled:opacity-50",
                className,
              )}
            />
          }
        >
          <DotsIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={() => setOpen(true)}>
            <FlagIcon className="size-3.5" />
            Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog
        targetType={targetType}
        targetId={targetId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}
