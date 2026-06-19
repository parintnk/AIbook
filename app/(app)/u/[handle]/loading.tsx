import styles from "@/components/profile/profile.module.css";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Cold-load skeleton for /u/[handle] (Story 9.1) — the public creator profile (profile +
 * verified-badge + follow-state, 3-4 queries). Mirrors page.tsx's cover (avatar + name + bio +
 * social row), the 3-up stat cards, and the AI Stack chips so the swap is shift-stable.
 * `sr-only` owns the a11y cue; the blocks are decorative.
 */

const STATS = ["a", "b", "c"];
const STACK = ["a", "b", "c", "d"];

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <span className="sr-only">Loading profile…</span>
      <header className={styles.cover}>
        <div className={styles.phead}>
          <div className={styles.pavatar}>
            <Skeleton className="h-full w-full rounded-[30px]" />
          </div>
          <div className={styles.pinfo}>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="mt-3 h-4 w-full max-w-[420px]" />
            <Skeleton className="mt-1.5 h-4 w-3/5 max-w-[420px]" />
            <div className="mt-4 flex items-center gap-3">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      </header>
      {/* Contribution stats (3-up grid). */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        {STATS.map((k) => (
          <div
            key={k}
            className="glass flex flex-col items-center gap-1 rounded-2xl p-4"
          >
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </section>
      {/* AI Stack. */}
      <section className="mt-6">
        <Skeleton className="h-6 w-28" />
        <div className="mt-3 flex flex-wrap gap-2">
          {STACK.map((k) => (
            <Skeleton key={k} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      </section>
    </main>
  );
}
