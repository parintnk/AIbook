"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { castOutcomeVoteAction } from "@/app/(app)/workflows/actions";
import type { OutcomeVerdict } from "@/lib/services/outcome-votes";
import { cn } from "@/lib/utils";

/**
 * The outcome-vote segmented control (Story 4.1 / FR11 / UX-DR8). One changeable vote
 * per published workflow; the chosen segment + its count update optimistically and
 * revert with a toast on error (the server recompute is the truth → `router.refresh()`
 * reconciles). Color + icon + label, never color-only. Anon sees the counts (read-only)
 * + a "Sign in to vote" link.
 */

type Counts = { worked: number; tweaked: number; failed: number };

const VERDICTS: {
  verdict: OutcomeVerdict;
  label: string;
  countKey: keyof Counts | null;
  activeText: string;
  Icon: (p: { className?: string }) => React.ReactElement;
}[] = [
  {
    verdict: "worked",
    label: "Tried & Worked",
    countKey: "worked",
    activeText: "text-success",
    Icon: CheckIcon,
  },
  {
    verdict: "tweaked",
    label: "Worked with tweaks",
    countKey: "tweaked",
    activeText: "text-warning",
    Icon: WrenchIcon,
  },
  {
    verdict: "failed",
    label: "Didn't work",
    countKey: "failed",
    activeText: "text-destructive",
    Icon: XIcon,
  },
  {
    verdict: "untried",
    label: "Haven't tried",
    countKey: null,
    activeText: "text-foreground",
    Icon: HelpIcon,
  },
];

/** Move the optimistic tally as the verdict changes (👀 untried isn't counted). */
function adjust(
  c: Counts,
  from: OutcomeVerdict | null,
  to: OutcomeVerdict,
): Counts {
  const next = { ...c };
  if (from && from !== "untried") next[from] = Math.max(0, next[from] - 1);
  if (to !== "untried") next[to] = next[to] + 1;
  return next;
}

export function OutcomeVote({
  workflowId,
  counts,
  myVerdict,
  canVote,
}: {
  workflowId: string;
  counts: Counts;
  myVerdict: OutcomeVerdict | null;
  canVote: boolean;
}) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<OutcomeVerdict | null>(myVerdict);
  const [tally, setTally] = useState<Counts>(counts);
  const [isPending, startTransition] = useTransition();

  // Re-read truth (AC2): after a vote the server recomputes the tallies and
  // `router.refresh()` re-renders the page (a new `counts` object + my persisted
  // verdict). Resync local state from those props so a divergence (e.g. someone else
  // voted while mine was in flight) reconciles to server truth instead of sticking
  // optimistic. The parent is an RSC → props only change on refresh/nav, never during
  // the in-flight self-re-render, so this never clobbers an optimistic update.
  useEffect(() => {
    setVerdict(myVerdict);
    setTally(counts);
  }, [myVerdict, counts]);

  function onPick(next: OutcomeVerdict) {
    if (!canVote || next === verdict) return;
    const prevVerdict = verdict;
    const prevTally = tally;
    setVerdict(next);
    setTally(adjust(tally, prevVerdict, next));
    startTransition(async () => {
      const res = await castOutcomeVoteAction(workflowId, next);
      if (!res.ok) {
        setVerdict(prevVerdict);
        setTally(prevTally);
        toast.error("Couldn't save your vote. Try again.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-[12px] text-muted-foreground uppercase tracking-[0.10em]">
          Did this work for you?
        </p>
        {canVote ? null : (
          <Link
            href="/sign-in"
            className="text-[12px] text-accent-foreground underline underline-offset-2"
          >
            Sign in to vote
          </Link>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1 rounded-2xl bg-secondary p-1">
        {VERDICTS.map(({ verdict: v, label, countKey, activeText, Icon }) => {
          const active = verdict === v;
          return (
            <button
              key={v}
              type="button"
              disabled={!canVote || isPending}
              aria-pressed={active}
              onClick={() => onPick(v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-medium text-[13px] outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
                active
                  ? cn("bg-background shadow-sm", activeText)
                  : "text-muted-foreground enabled:hover:text-foreground",
              )}
            >
              <Icon className="size-[15px] shrink-0" />
              {label}
              {countKey ? (
                <span className="font-mono text-[12px] text-muted-foreground">
                  {tally[countKey]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function WrenchIcon({ className }: { className?: string }) {
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
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function HelpIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}
