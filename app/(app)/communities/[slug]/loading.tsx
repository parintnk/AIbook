import { CardGridSkeleton } from "@/components/explore/card-grid-skeleton";
import styles from "@/components/professions/community.module.css";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Cold-load skeleton for /communities/[slug] (Story 6.2) — heavy (6 parallel queries: feed,
 * mods, pins, membership, WOTD, mod-gate). Mirrors page.tsx's hero + 2-col `.grid` (the 300px
 * rail beside the 1fr feed) so the streamed swap is shift-stable. `sr-only` owns the a11y cue.
 */
export default function Loading() {
  return (
    <div
      className={`${styles.community} mx-auto w-full max-w-[1180px] px-6 py-8`}
    >
      <span className="sr-only">Loading community…</span>
      {/* Profession hero band. */}
      <Skeleton className="mb-6 h-[200px] w-full rounded-card" />
      <div className={styles.grid}>
        {/* Rail (300px col): mods / start-here / house-rules / about cards. */}
        <div className="flex flex-col gap-[18px]">
          <Skeleton className="h-44 w-full rounded-card" />
          <Skeleton className="h-56 w-full rounded-card" />
        </div>
        {/* Main feed column. */}
        <CardGridSkeleton />
      </div>
    </div>
  );
}
