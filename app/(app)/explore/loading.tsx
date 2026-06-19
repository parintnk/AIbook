import { CardGridSkeleton } from "@/components/explore/card-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "@/components/workflows/explore.module.css";

/**
 * Cold-load skeleton for /explore (Story 6.1) — the most-visited public route and the
 * heaviest first paint (WOTD hero + profession chips + Trending feed + New-this-week rail,
 * 5 service calls). Mirrors page.tsx's wrapper + WOTD band + chips row + section head + feed
 * grid so the streamed swap to real content is shift-stable (NFR1, the workflow-detail
 * precedent). `sr-only` owns the a11y cue; the blocks are decorative.
 */

// Chip placeholders for the horizontally-scrolling profession rail.
const CHIPS = ["a", "b", "c", "d", "e", "f"];

export default function Loading() {
  return (
    <div
      className={`${styles.explore} mx-auto w-full max-w-[1180px] px-6 py-8`}
    >
      <span className="sr-only">Loading explore…</span>
      {/* WOTD hero band (page.tsx wraps it in mb-[34px]). */}
      <Skeleton className="mb-[34px] h-[280px] w-full rounded-card" />
      {/* Profession chips (.chips: margin-bottom 28px). */}
      <div className="mb-7 flex gap-2.5 overflow-hidden">
        {CHIPS.map((k) => (
          <Skeleton key={k} className="h-9 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      {/* Section head (title + sub). */}
      <div className="mb-4 flex flex-col gap-2">
        <Skeleton className="h-6 w-60" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <CardGridSkeleton />
    </div>
  );
}
