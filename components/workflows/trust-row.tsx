import Link from "next/link";
import { formatVerifiedAge } from "@/lib/format/verified-age";
import { cn } from "@/lib/utils";

/**
 * The read-only trust row on the public workflow detail header (Story 3.3 / FR13 /
 * UX-DR9 / UX-DR21). A server component (no client JS — SSR'd into the anon/SEO
 * header) that READS the existing, client-write-locked `workflows` counters and
 * renders graceful zero-states: Epic 4 (outcome votes → `tried_count`) and Epic 5
 * (forks → `fork_count` / `parent_id`) populate the columns later and this row
 * reflects them automatically. Every signal pairs color with an icon AND a
 * number/label — never color-only (UX-DR9 / Accessibility Floor).
 */
export function TrustRow({
  workflowId,
  triedCount,
  forkCount,
  parentId,
  parentHandle,
  lastVerifiedAt,
  publishedAt,
}: {
  workflowId: string;
  triedCount: number;
  forkCount: number;
  parentId: string | null;
  parentHandle?: string | null;
  lastVerifiedAt: string | null;
  publishedAt: string | null;
}) {
  const verified = formatVerifiedAge(lastVerifiedAt, publishedAt);
  // The workflow has a lineage tree to explore if it has forks OR an ancestor (Story 5.3 / FR16).
  const hasLineage = forkCount > 0 || parentId != null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2.5">
      {/* Outcome pill — success once there are "tried" votes (Epic 4 / FR11 populates
          the count and owns the exact verdict weighting); honest neutral zero-state
          until then (never a green "·0"). */}
      {triedCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3.5 py-2 font-semibold text-[13px] text-success shadow-sm">
          <CheckIcon className="size-3.5" />
          Tried &amp; Worked ·{" "}
          <span className="font-mono text-[13px]">{triedCount}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary px-3.5 py-2 font-medium text-[13px] text-muted-foreground">
          <CheckIcon className="size-3.5" />
          Be the first to try this
        </span>
      )}

      {/* Fork count — omitted at 0 (Epic 5 increments it; no "Forked 0×"). */}
      {forkCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-[13px] text-muted-foreground">
          <ForkIcon className="size-3.5" />
          Forked{" "}
          <b className="font-mono font-bold text-foreground">{forkCount}×</b>
        </span>
      ) : null}

      {/* Lineage — "Original by creator" (no parent), "Forked from @x" (Story 5.1 — the
          resolved parent author), or "Variation" if the parent is no longer readable. The
          clickable parent link is Story 5.2. */}
      <span className="inline-flex items-center gap-1.5 font-medium text-[13px] text-muted-foreground">
        {parentId == null ? (
          <OriginIcon className="size-3.5" />
        ) : (
          <ForkIcon className="size-3.5" />
        )}
        {parentId == null ? (
          "Original by creator"
        ) : parentHandle ? (
          <Link
            href={`/workflows/${parentId}`}
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Forked from @{parentHandle}
          </Link>
        ) : (
          "Variation"
        )}
      </span>

      {/* Lineage tree entry (Story 5.3 / FR16 / UX-DR14) — the "explore the family tree" affordance,
          shown whenever there's lineage to explore (forks below or an ancestor above). */}
      {hasLineage ? (
        <Link
          href={`/workflows/${workflowId}/lineage`}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 font-medium text-[12.5px] text-accent-foreground underline-offset-2 hover:underline"
        >
          <TreeIcon className="size-3.5" />
          View lineage
        </Link>
      ) : null}

      {/* Last verified — neutral under 90 days; amber-cautionary past it, with the
          literal re-check sentence so the meaning isn't color-only (UX-DR21). */}
      {verified ? (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[12.5px]",
            verified.isStale ? "text-warning" : "text-muted-foreground",
          )}
        >
          <ClockIcon className="size-3.5 shrink-0" />
          <span>
            {verified.isStale
              ? `${verified.label} — Tools change fast — this may need a re-check`
              : verified.label}
          </span>
        </span>
      ) : null}
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

function ForkIcon({ className }: { className?: string }) {
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
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="9" r="2.4" />
      <path d="M6 8.4v7.2M8.2 6h4.5a3 3 0 0 1 3 3v.2" />
    </svg>
  );
}

function TreeIcon({ className }: { className?: string }) {
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
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="12" r="3" />
      <path d="M9 6h3a3 3 0 0 1 3 3M9 18h3a3 3 0 0 0 3-3" />
    </svg>
  );
}

function OriginIcon({ className }: { className?: string }) {
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
      <path d="M12 2.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16l-5.2 2.6 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
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
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
