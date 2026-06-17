import { Flame, Plus, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { communityHref } from "@/lib/community-href";
import type { WorkflowSort } from "@/lib/explore";
import styles from "./community.module.css";

/**
 * The feed's segmented sort (Story 6.2 + 7.1) — "Hot" (trending / a recency-weighted engagement
 * blend), "New" (recency), and "Top" (all-time worked-%/forks). State lives in `?sort=`,
 * preserving the active `?tag=`. The "New workflow" primary button routes to the editor (it also
 * doubles as the empty-state CTA).
 */
export function FeedSortTabs({
  slug,
  sort,
  tag,
}: {
  slug: string;
  sort: WorkflowSort;
  tag: string | null;
}) {
  return (
    <div className={styles.feedbar}>
      <div className={styles.seg}>
        <Link
          href={communityHref(slug, "trending", tag)}
          className={
            sort === "trending"
              ? `${styles.segBtn} ${styles.segOn}`
              : styles.segBtn
          }
          aria-current={sort === "trending" ? "true" : undefined}
        >
          <Flame width={14} height={14} aria-hidden="true" />
          Hot
        </Link>
        <Link
          href={communityHref(slug, "new", tag)}
          className={
            sort === "new" ? `${styles.segBtn} ${styles.segOn}` : styles.segBtn
          }
          aria-current={sort === "new" ? "true" : undefined}
        >
          <Sparkles width={14} height={14} aria-hidden="true" />
          New
        </Link>
        <Link
          href={communityHref(slug, "top", tag)}
          className={
            sort === "top" ? `${styles.segBtn} ${styles.segOn}` : styles.segBtn
          }
          aria-current={sort === "top" ? "true" : undefined}
        >
          <TrendingUp width={14} height={14} aria-hidden="true" />
          Top
        </Link>
      </div>
      <Link href="/workflows/new" className={styles.newbtn}>
        <Plus width={15} height={15} aria-hidden="true" />
        New workflow
      </Link>
    </div>
  );
}
