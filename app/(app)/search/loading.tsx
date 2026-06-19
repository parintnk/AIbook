import { CardGridSkeleton } from "@/components/explore/card-grid-skeleton";
import styles from "@/components/search/search.module.css";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Cold-load skeleton for /search (Story 10.2). The `?q=` path embeds the query and ranks
 * PUBLISHED workflows by cosine similarity (the slow semantic path), so a frozen nav is most
 * visible here. Mirrors page.tsx's wrapper + search box + result bar; the results reuse the
 * shared CardGridSkeleton. The no-query landing is instant, but this shell is harmless there
 * too (it shares the same box + container).
 */
export default function Loading() {
  return (
    <div className={`${styles.search} mx-auto w-full max-w-[1180px] px-6 py-8`}>
      <span className="sr-only">Searching…</span>
      {/* Search box. */}
      <Skeleton className="h-[52px] w-full rounded-full" />
      {/* Result bar (count + filter chips). */}
      <div className="mt-7 mb-6 flex items-center gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <CardGridSkeleton />
    </div>
  );
}
