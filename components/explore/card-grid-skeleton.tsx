import { Skeleton } from "@/components/ui/skeleton";
import styles from "@/components/workflows/explore.module.css";

/**
 * Cold-load skeleton for a WorkflowCard feed grid — shared by the /explore, /search,
 * and /communities/[slug] route `loading.tsx` shells. Reuses the real `.feedgrid` +
 * `.wfcard` geometry (and `.wthumb` / `.wauth` / `.wstats` offsets) from
 * explore.module.css so the streamed swap to real cards is shift-stable; the inner
 * blocks are the shared `Skeleton` primitive. Decorative (`aria-hidden`) — the route
 * `loading.tsx` owns the `sr-only` screen-reader cue.
 */

// Six placeholders = two rows of the 3-col grid (a sensible above-the-fold default for
// every feed; the media queries collapse it to 2/1 cols exactly like the real grid).
const CARDS = ["a", "b", "c", "d", "e", "f"];

/**
 * `gridClassName` overrides the grid container — /search passes its own 2-col `.results`
 * (vs explore's 3-col `.feedgrid`); the cards themselves are WorkflowCards on both, so the
 * inner `.wfcard` geometry is shared.
 */
export function CardGridSkeleton({
  gridClassName,
}: {
  gridClassName?: string;
} = {}) {
  return (
    <div className={gridClassName ?? styles.feedgrid} aria-hidden="true">
      {CARDS.map((k) => (
        <div key={k} className={styles.wfcard}>
          <div className={styles.wthumb}>
            <Skeleton className="h-full w-full rounded-none" />
          </div>
          <Skeleton className="mb-2.5 h-[18px] w-3/4" />
          <div className={styles.wauth}>
            <Skeleton className="size-[22px] shrink-0 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className={styles.wstats}>
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-6 w-[88px] rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
